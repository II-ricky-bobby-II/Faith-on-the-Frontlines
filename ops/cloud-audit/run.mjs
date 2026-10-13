import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditBrowser } from "./browser.mjs";
import { isSha, verify } from "./verify-candidate.mjs";
import { sealResults } from "./results.mjs";

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };
const site = resolve(option("--site") ?? join(dirname(fileURLToPath(import.meta.url)), "../.."));
const out = resolve(option("--out") ?? join(site, "outputs", `audit-${randomUUID()}`));
const qualification = args.includes("--qualification");
const git = (...arguments_) => execFileSync("git", arguments_, { cwd: site, encoding: "utf8" }).trim();
const candidate = option("--candidate") ?? git("rev-parse", "HEAD");
const production = option("--production") ?? git("rev-parse", "origin/production");
assert.ok(isSha(candidate) && isSha(production), "Full candidate and production SHAs required");
assert.equal(git("rev-parse", "HEAD"), candidate, "Checkout must be the exact candidate");
assert.equal(git("status", "--porcelain", "--untracked-files=normal"), "", "Candidate checkout must be clean");
const mergeBase = git("merge-base", production, candidate);
assert.ok(isSha(mergeBase), "Candidate and production need a shared history");

// Preserve the normal proxy/CA boundary, and withhold app/provider credentials from candidate commands.
const allowedEnv = /^(PATH|HOME|TMPDIR|TMP|TEMP|USER|LOGNAME|SHELL|SystemRoot|LANG|LC_.*|CI|TERM|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|http_proxy|https_proxy|all_proxy|no_proxy|SSL_CERT_FILE|SSL_CERT_DIR|NODE_EXTRA_CA_CERTS|REQUESTS_CA_BUNDLE|CURL_CA_BUNDLE|NODE_USE_ENV_PROXY|PLAYWRIGHT_BROWSERS_PATH)$/;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowedEnv.test(key)));
env.WRANGLER_SEND_METRICS = "false";
env.WRANGLER_LOG_PATH = join(out, "wrangler.log");
env.MINIFLARE_REGISTRY_PATH = join(out, "registry");
env.CI = "true";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const wrangler = join(site, "node_modules/wrangler/bin/wrangler.js");
const report = { schema: 1, workstream: "global_fellowship", candidate, production, mergeBase, tree: git("rev-parse", "HEAD^{tree}"),
  mode: qualification ? "runner-qualification" : "merged-candidate", node: process.version, platform: process.platform,
  startedAt: new Date().toISOString(), stages: [], technicalStatus: "running", releaseReady: false,
  remainingReviews: ["Complete unreleased code review", "Codex Security diff scan", "Manual accessibility and visual review", "Owner release approval"],
  limitations: ["Synthetic local D1 and CMS only", "Inquiry endpoint accepts input but does not send email/CRM", "No live email or production D1 acceptance"],
};
await mkdir(out, { recursive: true });
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
const sha256 = value => createHash("sha256").update(value).digest("hex");
const snapshot = () => ({ head: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"), status: git("status", "--porcelain") });
const original = snapshot();
let preview;
let cms;
let browserResult;

async function command(name, executable, arguments_, { cwd = site, timeout = 900000 } = {}) {
  const started = Date.now();
  const child = spawn(executable, arguments_, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", data => { output += data; });
  child.stderr.on("data", data => { output += data; });
  const timer = setTimeout(() => child.kill("SIGTERM"), timeout);
  const escalation = setTimeout(() => child.kill("SIGKILL"), timeout + 5000);
  let code;
  try { code = await new Promise((done, reject) => { child.on("error", reject); child.on("close", done); }); }
  finally { clearTimeout(timer); clearTimeout(escalation); }
  await writeFile(join(out, `${name}.log`), output);
  report.stages.push({ name, command: [executable, ...arguments_], status: code === 0 ? "passed" : "failed", exitCode: code, durationMs: Date.now() - started });
  console.log(`${name}: ${code === 0 ? "passed" : "failed"}`);
  if (code !== 0) throw new Error(`${name} failed; see ${name}.log`);
  return output;
}

async function freePort() {
  const server = createServer();
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  const port = server.address().port;
  await new Promise(done => server.close(done));
  return port;
}

try {
  assert.ok(Number(process.versions.node.split(".")[0]) >= 22 &&
    (Number(process.versions.node.split(".")[0]) > 22 || Number(process.versions.node.split(".")[1]) >= 13), "Node >=22.13 required");
  const actualEnv = (await readdir(site)).filter(name => (name.startsWith(".env") || name.startsWith(".dev.vars")) && name !== ".env.example");
  assert.deepEqual(actualEnv, [], "Use a fresh checkout without application credential files");
  if (!qualification) {
    const receipt = await verify(Number(option("--pr")), candidate);
    await writeFile(join(out, "candidate.json"), JSON.stringify(receipt, null, 2) + "\n");
    assert.equal(receipt.decision, "expected", receipt.reasons.join("; "));
    assert.equal(receipt.production, production, "Production base changed; restart audit");
    assert.equal(receipt.tree, report.tree);
    report.superseded = receipt.superseded;
  }
  const diff = git("diff", "--binary", `${production}..${candidate}`);
  await writeFile(join(out, "unreleased.patch"), diff + "\n");
  report.diffSha256 = sha256(diff);
  report.changedFiles = git("diff", "--name-status", `${production}..${candidate}`).split("\n").filter(Boolean);
  report.lockSha256 = sha256(await readFile(join(site, "package-lock.json")));
  await command("lint", npm, ["run", "lint"]);
  await command("build-and-unit", npm, ["test"]);
  await command("binding-types", process.execPath, [wrangler, "types", "--config", "dist/server/wrangler.json"]);
  await command("typecheck", join(site, "node_modules/.bin/tsc"), ["--noEmit", "--incremental", "false"]);
  const harness = dirname(fileURLToPath(import.meta.url));
  await command("candidate-verifier-tests", process.execPath, ["--test", join(harness, "tests/candidate.test.mjs")]);
  await command("event-protocol-tests", process.execPath, ["--test", "ops/develop-events/tests/events.test.mjs"]);

  const cmsHits = [];
  const fixtureEvent = { slug: "audit-fixture-event", title: "Audit fixture gathering", venue: "Fixture venue", city: "Fixture city", state: "CA",
    address: "Synthetic test address", date: "2099-01-01", time: "6:00 PM", speaker: "Fixture speaker", theme: "Fixture theme",
    description: "Synthetic CMS content for isolated integration checks.", contactEmail: "fixture@example.invalid", image: null };
  cms = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    cmsHits.push({ pathname: url.pathname, query: Object.fromEntries(url.searchParams) });
    response.writeHead(url.pathname === "/api/events" ? 200 : 404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ docs: [fixtureEvent] }));
  });
  await new Promise(done => cms.listen(0, "127.0.0.1", done));
  const cmsUrl = `http://127.0.0.1:${cms.address().port}`;
  const generated = JSON.parse(await readFile(join(site, "dist/server/wrangler.json"), "utf8"));
  const configPath = join(out, "fixture.wrangler.json");
  const config = { name: "fotf-audit-fixture", main: resolve(site, "dist/server", generated.main),
    compatibility_date: generated.compatibility_date, compatibility_flags: generated.compatibility_flags,
    assets: { ...generated.assets, directory: resolve(site, "dist/server", generated.assets.directory) },
    d1_databases: [{ binding: "DB", database_name: "fotf-audit-fixture", database_id: "00000000-0000-0000-0000-000000000001" }],
    images: { binding: "IMAGES" }, vars: { PAYLOAD_CMS_URL: cmsUrl }, routes: [] };
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
  const state = join(out, "d1");
  for (const migration of (await readdir(join(site, "drizzle"))).filter(name => name.endsWith(".sql")).sort()) {
    await command(`migration-${migration.replace(/\.sql$/, "")}`, process.execPath,
      [wrangler, "d1", "execute", "DB", "--local", "--config", configPath, "--persist-to", state, "--file", join(site, "drizzle", migration)]);
  }
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  preview = spawn(process.execPath, [wrangler, "dev", "--local", "--config", configPath, "--persist-to", state, "--ip", "127.0.0.1", "--port", String(port)], { cwd: site, env, stdio: ["ignore", "pipe", "pipe"] });
  let previewLog = "";
  preview.stdout.on("data", data => { previewLog += data; });
  preview.stderr.on("data", data => { previewLog += data; });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (preview.exitCode !== null) break;
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch { /* bounded startup retry */ }
    await new Promise(done => setTimeout(done, 500));
  }
  await writeFile(join(out, "preview.log"), previewLog);
  assert.ok(ready, "Isolated workerd preview did not become ready");
  browserResult = await auditBrowser(origin, out);
  await writeFile(join(out, "browser.json"), JSON.stringify(browserResult, null, 2) + "\n");
  await writeFile(join(out, "cms.json"), JSON.stringify(cmsHits, null, 2) + "\n");
  assert.ok(cmsHits.some(hit => hit.pathname === "/api/events"), "CMS fixture was not exercised");
  const readback = await command("d1-readback", process.execPath, [wrangler, "d1", "execute", "DB", "--local", "--config", configPath,
    "--persist-to", state, "--command", "SELECT email, first_name, consent, source, (SELECT COUNT(*) FROM event_invitations) AS row_count FROM event_invitations ORDER BY email", "--json"]);
  assert.match(readback, /"row_count":\s*1\b/, "Upsert must leave exactly one fixture row");
  assert.match(readback, /"first_name":\s*"Browser"/, "Browser signup did not update D1");
  assert.match(readback, /"consent":\s*1\b/, "Consent was not stored");
  assert.ok(!readback.includes("honeypot@example.invalid"), "Honeypot was written to D1");
  report.stages.push({ name: "browser-responsive-accessibility-integrations", status: browserResult.failures.length ? "failed" : "passed" });
  assert.equal(browserResult.failures.length, 0, "Browser audit has failures; see browser.json");
  assert.deepEqual(snapshot(), original, "Audit changed tracked candidate files");
  report.technicalStatus = "passed";
} catch (error) {
  report.technicalStatus = "failed";
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (preview && preview.exitCode === null) {
    preview.kill("SIGTERM");
    const stopped = await Promise.race([new Promise(done => preview.once("close", () => done(true))), new Promise(done => setTimeout(() => done(false), 5000))]);
    if (!stopped) preview.kill("SIGKILL");
  }
  if (cms) await new Promise(done => cms.close(done));
  report.candidatePreserved = JSON.stringify(snapshot()) === JSON.stringify(original);
  if (!report.candidatePreserved) {
    report.technicalStatus = "failed";
    report.error = "Audit changed the candidate checkout";
    process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await sealResults(out);
  console.log(`Saved ${report.technicalStatus} evidence: ${out}`);
}
