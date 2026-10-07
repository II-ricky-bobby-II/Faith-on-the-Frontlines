import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { normalizeMerge, signWebhook, validateCallback, isPublicAddress, MAX_BODY } from "../lib/protocol.mjs";

export async function publicCallbackFetch(rawUrl, options) {
  const url = validateCallback(rawUrl, ["chatgpt.com", ".chatgpt.com", "openai.com", ".openai.com"]);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new Error("Non-public callback rejected");
  const selected = addresses[0];
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, { method: options.method, headers: options.headers, signal: options.signal,
      // Keep TLS/SNI/Host tied to the original URL while pinning the validated address.
      lookup: (_host, lookupOptions, callback) => lookupOptions.all
        ? callback(null, [selected]) : callback(null, selected.address, selected.family),
    }, response => {
      response.resume();
      resolve(new Response(null, { status: response.statusCode }));
    });
    request.on("error", reject);
    request.end(options.body);
  });
}

export async function deliver(subscription, event, fetcher = publicCallbackFetch, pause = delay) {
  const callback = validateCallback(subscription.url, ["chatgpt.com", ".chatgpt.com", "openai.com", ".openai.com"]);
  const body = JSON.stringify(event);
  if (Buffer.byteLength(body) > MAX_BODY) throw new Error("Event exceeds MCP delivery limit");
  let status = 503;
  for (let attempt = 1; attempt <= 4; attempt++) {
    if (attempt > 1) await pause(1000 * 2 ** (attempt - 2));
    if (subscription.expires_at <= Date.now()) return { status: 410, attempts: attempt };
    const timestamp = String(Math.floor(Date.now() / 1000));
    try {
      const response = await fetcher(callback.toString(), { method: "POST", body, redirect: "error",
        signal: AbortSignal.timeout(10000), headers: { "Content-Type": "application/json", "webhook-id": event.eventId,
          "webhook-timestamp": timestamp, "webhook-signature": await signWebhook(subscription.secret, event.eventId, timestamp, body),
          "X-MCP-Subscription-Id": subscription.id } });
      status = response.status;
      if (response.ok || (status !== 429 && status < 500)) return { status, attempts: attempt };
    } catch { status = 503; }
  }
  return { status, attempts: 4 };
}

export async function run(env = process.env, fetcher = fetch, callbackFetcher = publicCallbackFetch) {
  const bridge = new URL(env.FOTF_EVENTS_URL);
  if (bridge.protocol !== "https:" || bridge.username || bridge.password) throw new Error("Verified HTTPS bridge URL required");
  const event = normalizeMerge(JSON.parse(await readFile(env.GITHUB_EVENT_PATH, "utf8")));
  if (!env.ACTIONS_ID_TOKEN_REQUEST_URL || !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN || !env.FOTF_EVENTS_SITE_TOKEN) {
    throw new Error("OIDC permission and private Site service credential are required");
  }
  const oidcUrl = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  oidcUrl.searchParams.set("audience", bridge.origin);
  const oidc = await fetcher(oidcUrl, { headers: { Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
    redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!oidc.ok) throw new Error("Could not obtain GitHub workflow identity");
  const token = (await oidc.json()).value;
  const api = async (path, body) => {
    const response = await fetcher(new URL(path, bridge), { method: "POST", body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "OAI-Sites-Authorization": env.FOTF_EVENTS_SITE_TOKEN },
      redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Bridge operation failed (HTTP ${response.status})`);
    return response.json();
  };
  const context = await api("/api/delivery-context", { event_id: event.eventId });
  if (!context.active_count) throw new Error("David has no active subscription. Connect the plugin and subscribe before relying on notifications.");
  let failures = 0;
  for (const subscription of context.subscriptions) {
    const receipt = await deliver(subscription, event, callbackFetcher);
    await api("/api/delivery-receipts", { event_id: event.eventId, subscription_id: subscription.id, ...receipt });
    if (receipt.status < 200 || receipt.status >= 300) failures++;
  }
  if (failures) throw new Error(`${failures} notification deliveries failed; inspect the workflow and bridge status`);
  console.log(`PR #${event.data.pr_number}: ${context.subscriptions.length} deliveries acknowledged; already acknowledged deliveries skipped.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(error => { console.error(error.message); process.exitCode = 1; });
}
