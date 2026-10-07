import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import worker, { verifyGitHubToken, verifyCallback } from "../worker/index.mjs";
import { normalizeMerge, signWebhook, signingKey, canonicalArguments, validateCallback, validateGitHubClaims,
  REPOSITORY, REPOSITORY_ID, EVENT_NAME, isPublicAddress } from "../lib/protocol.mjs";
import { deliver } from "../scripts/send-event.mjs";
import { checkReleaseCandidate } from "../scripts/check-release-candidate.mjs";

const secret = "whsec_" + Buffer.alloc(32, 42).toString("base64");
const sha = "a".repeat(40);
const fixture = (author = "mitchell-FOF") => ({ action: "closed", repository: { full_name: REPOSITORY, id: Number(REPOSITORY_ID) },
  pull_request: { number: 9, merged: true, base: { ref: "develop" }, merge_commit_sha: sha,
    user: { login: author, id: 324176645 }, merged_by: { login: "mitchell-FOF", id: 324176645 },
    title: "Feature", merged_at: "2026-10-07T12:00:00Z" } });
const claims = () => ({ iss: "https://token.actions.githubusercontent.com", aud: "https://bridge.example",
  exp: Math.floor(Date.now() / 1000) + 300, nbf: Math.floor(Date.now() / 1000) - 1,
  repository: REPOSITORY, repository_id: REPOSITORY_ID, event_name: "pull_request_target", ref: "refs/heads/develop",
  workflow_ref: `${REPOSITORY}/.github/workflows/notify-develop-merge.yml@refs/heads/develop` });

function d1() {
  const database = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("../drizzle", import.meta.url)).filter(f => f.endsWith(".sql"))) {
    database.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
  }
  return { database, prepare(sql) {
    let bindings = [];
    return { bind(...values) { bindings = values; return this; },
      async run() { return database.prepare(sql).run(...bindings); },
      async first() { return database.prepare(sql).get(...bindings) ?? null; },
      async all() { return { results: database.prepare(sql).all(...bindings) }; } };
  } };
}

const envFor = () => ({ DB: d1(), SUBSCRIPTION_KEY: Buffer.alloc(32, 21).toString("base64"), ACTION_AUDIENCE: "https://bridge.example" });
const rpc = async (env, method, params = {}, user = "owner") => {
  const response = await worker.fetch(new Request("https://bridge.example/mcp", { method: "POST",
    headers: { "Content-Type": "application/json", ...(user ? { "oai-authenticated-user-id": user } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }), env);
  return { status: response.status, body: await response.json() };
};
const subscription = () => ({ name: EVENT_NAME, arguments: { repository: REPOSITORY, base_branch: "develop" },
  delivery: { mode: "webhook", url: "https://chatgpt.com/mcp-events/test-callback", secret } });
const callbackFetch = async (url, options) => {
  if (String(url).startsWith("https://cloudflare-dns.com/")) return Response.json({ Status: 0, Answer: [{ type: 1, data: "104.18.1.1" }] });
  return Response.json({ challenge: JSON.parse(options.body).challenge });
};

test("only actual develop merges become events, and unexpected authors are still delivered", () => {
  assert.equal(normalizeMerge(fixture("unexpected-contributor")).data.author_login, "unexpected-contributor");
  for (const change of [p => p.action = "opened", p => p.pull_request.merged = false,
    p => p.pull_request.base.ref = "production", p => p.repository.id = 1,
    p => p.pull_request.merge_commit_sha = "develop", p => p.pull_request.merged_by = null]) {
    const payload = fixture(); change(payload); assert.throws(() => normalizeMerge(payload));
  }
  assert.equal(normalizeMerge(fixture()).eventId, normalizeMerge(fixture()).eventId);
});

test("HMAC matches Standard Webhooks signing input exactly", async () => {
  const body = JSON.stringify(normalizeMerge(fixture()));
  const expected = "v1," + createHmac("sha256", Buffer.alloc(32, 42)).update(`event.123.${body}`).digest("base64");
  assert.equal(await signWebhook(secret, "event", "123", body), expected);
  assert.throws(() => signingKey("whsec_YQ=="));
});

test("subscription filters and callback targets cannot escape the configured scope", () => {
  assert.equal(canonicalArguments({ base_branch: "develop", repository: REPOSITORY }), canonicalArguments({ repository: REPOSITORY, base_branch: "develop" }));
  assert.throws(() => canonicalArguments({ repository: "other/repo", base_branch: "develop" }));
  assert.throws(() => canonicalArguments({ repository: REPOSITORY, base_branch: "develop", author: "someone" }));
  for (const url of ["http://chatgpt.com/hook", "https://chatgpt.com.evil.test/hook", "https://127.0.0.1/hook", "https://user@chatgpt.com/hook", "https://chatgpt.com:444/hook"]) {
    assert.throws(() => validateCallback(url, ["chatgpt.com", ".chatgpt.com"]));
  }
  for (const address of ["127.0.0.1", "100.117.38.123", "192.168.1.1", "10.1.1.1", "::1", "::ffff:127.0.0.1", "fd00::1", "2001:db8::1", "169.254.169.254"]) assert.equal(isPublicAddress(address), false);
  assert.equal(isPublicAddress("104.18.1.1"), true);
});

test("workflow authorization rejects expired, wrong-repo, wrong-audience and untrusted-head claims", () => {
  assert.equal(validateGitHubClaims(claims(), "https://bridge.example").repository, REPOSITORY);
  for (const delta of [{ exp: 1 }, { repository_id: "1" }, { aud: "wrong" }, { ref: "refs/heads/attacker" },
    { event_name: "pull_request" }, { workflow_ref: `${REPOSITORY}/other.yml@refs/heads/develop` }, { iss: "https://evil.test" }]) {
    assert.throws(() => validateGitHubClaims({ ...claims(), ...delta }, "https://bridge.example"));
  }
});

test("GitHub OIDC requires a real RSA signature with a fixed issuer key endpoint", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-key", jku: "https://evil.test" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(claims())).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${body}`), privateKey).toString("base64url");
  const token = `${header}.${body}.${signature}`;
  const fetcher = async url => { assert.equal(url, "https://token.actions.githubusercontent.com/.well-known/jwks");
    return Response.json({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: "test-key" }] }); };
  const request = value => new Request("https://bridge.example/api/delivery-context", { headers: { Authorization: `Bearer ${value}` } });
  await verifyGitHubToken(request(token), envFor(), fetcher);
  await assert.rejects(verifyGitHubToken(request(`${header}.${body}.${Buffer.alloc(256).toString("base64url")}`), envFor(), fetcher));
});

test("callback activation rejects private DNS, wrong challenges and redirects", async () => {
  await verifyCallback({}, subscription().delivery.url, "sub_test", secret, callbackFetch);
  await assert.rejects(verifyCallback({}, subscription().delivery.url, "sub_test", secret,
    async () => Response.json({ Status: 0, Answer: [{ type: 1, data: "10.0.0.1" }] })));
  await assert.rejects(verifyCallback({}, subscription().delivery.url, "sub_test", secret,
    async (url, options) => String(url).includes("dns-query") ? callbackFetch(url, options) : Response.json({ challenge: "wrong" })));
});

test("MCP discovery advertises events, authenticated reads never expose delivery secrets", async () => {
  const env = envFor();
  assert.equal((await rpc(env, "server/discover")).body.result.supportedVersions[0], "2026-07-28");
  assert.equal((await rpc(env, "events/list")).body.result.events[0].name, EVENT_NAME);
  assert.equal((await rpc(env, "tools/call", { name: "release_policy" })).body.result.content.length, 1);
  assert.equal((await rpc(env, "tools/list", {}, null)).status, 401);
  assert.equal((await rpc(env, "events/subscribe", { ...subscription(), name: "other" })).body.error.code, -32602);
});

test("subscriptions persist encrypted, renew idempotently and stop on unsubscribe", async () => {
  const originalFetch = globalThis.fetch; globalThis.fetch = callbackFetch;
  try {
    const env = envFor();
    const first = await rpc(env, "events/subscribe", subscription());
    assert.ok(first.body.result?.id);
    const next = await rpc(env, "events/subscribe", { ...subscription(), ttlMs: 60000 });
    assert.equal(first.body.result.id, next.body.result.id);
    assert.equal(env.DB.database.prepare("SELECT COUNT(*) AS count FROM subscriptions").get().count, 1);
    const stored = env.DB.database.prepare("SELECT delivery_encrypted FROM subscriptions").get().delivery_encrypted;
    assert.equal(stored.includes(secret), false); assert.equal(stored.includes("chatgpt.com"), false);
    const status = await rpc(env, "tools/call", { name: "bridge_status" });
    assert.equal(JSON.stringify(status).includes(secret), false);
    assert.equal((await rpc(env, "tools/call", { name: "bridge_status" }, "other-owner")).body.result.content[0].text.includes(first.body.result.id), false);
    await rpc(env, "events/unsubscribe", subscription());
    assert.equal(env.DB.database.prepare("SELECT active FROM subscriptions").get().active, 0);
    await rpc(env, "events/unsubscribe", subscription());
  } finally { globalThis.fetch = originalFetch; }
});

test("direct sender retries transient failures with a stable event ID and stops on 410/413", async () => {
  const event = normalizeMerge(fixture()); const sub = { id: "sub_test", secret, url: subscription().delivery.url, expires_at: Date.now() + 60000 };
  const observed = []; let count = 0;
  const receipt = await deliver(sub, event, async (_url, options) => {
    observed.push(options.headers["webhook-id"]); assert.equal(options.redirect, "error");
    assert.equal(options.body, JSON.stringify(event)); return new Response(null, { status: ++count === 1 ? 503 : 202 });
  }, async () => {});
  assert.deepEqual(receipt, { status: 202, attempts: 2 }); assert.deepEqual(observed, [event.eventId, event.eventId]);
  for (const status of [410, 413]) { let attempts = 0;
    const result = await deliver(sub, event, async () => { attempts++; return new Response(null, { status }); }, async () => {});
    assert.equal(attempts, 1); assert.equal(result.status, status);
  }
});

test("no sender can read subscriptions or write receipts without workflow authentication", async () => {
  const env = envFor();
  for (const path of ["/api/delivery-context", "/api/delivery-receipts"]) {
    const response = await worker.fetch(new Request(`https://bridge.example${path}`, { method: "POST", body: "{}" }), env);
    assert.equal(response.status, 401);
  }
});

test("authorized Action retrieves current encrypted delivery context and acknowledged reruns are skipped", async () => {
  const originalFetch = globalThis.fetch;
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "action-key" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims())).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString("base64url");
  const token = `${header}.${payload}.${signature}`;
  globalThis.fetch = async (url, options) => String(url).includes("/.well-known/jwks")
    ? Response.json({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: "action-key" }] }) : callbackFetch(url, options);
  try {
    const env = envFor();
    const registered = await rpc(env, "events/subscribe", subscription());
    const id = registered.body.result.id;
    const event = normalizeMerge(fixture());
    const api = async (path, body) => {
      const response = await worker.fetch(new Request(`https://bridge.example${path}`, { method: "POST",
        headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }), env);
      assert.equal(response.status, 200); return response.json();
    };
    const initial = await api("/api/delivery-context", { event_id: event.eventId });
    assert.equal(initial.subscriptions[0].secret, secret);
    assert.equal(initial.subscriptions[0].id, id);
    await api("/api/delivery-receipts", { event_id: event.eventId, subscription_id: id, status: 202, attempts: 1 });
    // A delayed failure receipt must not overwrite an earlier success.
    await api("/api/delivery-receipts", { event_id: event.eventId, subscription_id: id, status: 503, attempts: 4 });
    assert.equal((await api("/api/delivery-context", { event_id: event.eventId })).subscriptions.length, 0);
    const nextEvent = { ...event, eventId: `${REPOSITORY}:pr:10:merged:${sha}` };
    assert.equal((await api("/api/delivery-context", { event_id: nextEvent.eventId })).subscriptions.length, 1);
    await api("/api/delivery-receipts", { event_id: nextEvent.eventId, subscription_id: id, status: 410, attempts: 1 });
    assert.equal((await api("/api/delivery-context", { event_id: nextEvent.eventId })).active_count, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("production candidate requires the exact verified SHA and a same-repository develop head", () => {
  const release = () => ({ repository: { full_name: REPOSITORY }, pull_request: {
    base: { ref: "production", repo: { full_name: REPOSITORY } },
    head: { ref: "develop", sha, repo: { full_name: REPOSITORY } },
    body: `Verification evidence\nVerified develop commit: \`${sha}\`\n`,
  } });
  assert.equal(checkReleaseCandidate(release()), sha);
  for (const change of [p => p.pull_request.head.sha = "b".repeat(40),
    p => p.pull_request.head.repo.full_name = "other/Faith-on-the-Frontlines",
    p => p.pull_request.head.ref = "feature", p => p.pull_request.body = "No verification report",
    p => p.pull_request.body += `Verified develop commit: \`${sha}\`\n`]) {
    const payload = release(); change(payload); assert.throws(() => checkReleaseCandidate(payload));
  }
});
