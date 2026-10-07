export const REPOSITORY = "II-ricky-bobby-II/Faith-on-the-Frontlines";
export const REPOSITORY_ID = "1355135878";
export const EVENT_NAME = "github.develop.merged";
export const PROTOCOL_VERSION = "2026-07-28";
export const MAX_BODY = 262144;

export function canonicalArguments(value) {
  if (!value || Object.keys(value).some(k => !["repository", "base_branch"].includes(k)) ||
      value.repository !== REPOSITORY || value.base_branch !== "develop") {
    throw new Error("Only this repository's develop branch is supported");
  }
  return JSON.stringify({ repository: REPOSITORY, base_branch: "develop" });
}

export function validateCallback(raw, allowedHosts) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.hash ||
      (url.port && url.port !== "443") || !allowedHosts.some(host => host.startsWith(".") ? url.hostname.endsWith(host) : url.hostname === host)) {
    throw new Error("Callback must use HTTPS on an explicitly approved ChatGPT callback host");
  }
  return url;
}

export function signingKey(secret) {
  if (typeof secret !== "string" || !/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret)) {
    throw new Error("Invalid webhook secret");
  }
  const bytes = Uint8Array.from(atob(secret.slice(6)), c => c.charCodeAt(0));
  if (bytes.length < 24 || bytes.length > 64) throw new Error("Invalid webhook key length");
  return bytes;
}

export async function signWebhook(secret, eventId, timestamp, body) {
  const key = await crypto.subtle.importKey("raw", signingKey(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key,
    new TextEncoder().encode(`${eventId}.${timestamp}.${body}`)));
  return "v1," + btoa(String.fromCharCode(...signature));
}

export function normalizeMerge(payload) {
  const pr = payload?.pull_request;
  if (payload?.repository?.full_name !== REPOSITORY ||
      String(payload?.repository?.id) !== REPOSITORY_ID ||
      payload.action !== "closed" || pr?.merged !== true || pr?.base?.ref !== "develop" ||
      !Number.isSafeInteger(pr.number) || pr.number < 1 ||
      !/^[0-9a-f]{40}$/.test(pr.merge_commit_sha ?? "") ||
      !pr.user?.login || !pr.merged_by?.login || !Number.isFinite(Date.parse(pr.merged_at))) {
    throw new Error("Expected a merged pull request into this repository's develop branch");
  }
  return {
    eventId: `${REPOSITORY}:pr:${pr.number}:merged:${pr.merge_commit_sha}`,
    name: EVENT_NAME,
    timestamp: new Date(pr.merged_at).toISOString(),
    data: {
      repository: REPOSITORY, base_branch: "develop", pr_number: pr.number,
      title: String(pr.title ?? "").slice(0, 500),
      author_login: pr.user.login, author_id: String(pr.user.id),
      merged_by_login: pr.merged_by.login, merged_by_id: String(pr.merged_by.id),
      merge_commit_sha: pr.merge_commit_sha,
      url: `https://github.com/${REPOSITORY}/pull/${pr.number}`,
    },
    cursor: null,
  };
}

export function eventDefinition() {
  return {
    name: EVENT_NAME,
    description: "A pull request by any author was merged into Faith on the Frontlines develop. Check the recorded identity, notify Blake, then coordinate verification under the saved release policy.",
    delivery: ["webhook"],
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: { repository: { const: REPOSITORY, type: "string" }, base_branch: { const: "develop", type: "string" } },
      required: ["repository", "base_branch"],
    },
    payloadSchema: {
      type: "object", additionalProperties: false,
      properties: {
        repository: { const: REPOSITORY, type: "string" }, base_branch: { const: "develop", type: "string" },
        pr_number: { type: "integer", minimum: 1 }, title: { type: "string" },
        author_login: { type: "string" }, author_id: { type: "string" },
        merged_by_login: { type: "string" }, merged_by_id: { type: "string" },
        merge_commit_sha: { type: "string", pattern: "^[0-9a-f]{40}$" }, url: { type: "string", format: "uri" },
      },
      required: ["repository", "base_branch", "pr_number", "title", "author_login", "author_id", "merged_by_login", "merged_by_id", "merge_commit_sha", "url"],
    },
  };
}

export function validateGitHubClaims(claims, audience, now = Math.floor(Date.now() / 1000)) {
  if (claims.iss !== "https://token.actions.githubusercontent.com" || claims.aud !== audience ||
      !Number.isFinite(claims.exp) || claims.exp <= now ||
      !Number.isFinite(claims.nbf) || claims.nbf > now + 30 ||
      claims.repository !== REPOSITORY || String(claims.repository_id) !== REPOSITORY_ID ||
      claims.event_name !== "pull_request_target" || claims.ref !== "refs/heads/develop" ||
      claims.workflow_ref !== `${REPOSITORY}/.github/workflows/notify-develop-merge.yml@refs/heads/develop`) {
    throw new Error("Unexpected GitHub workflow identity");
  }
  return claims;
}

export function isPublicAddress(address) {
  if (address.includes(":")) {
    const a = address.toLowerCase();
    // Global unicast only; reject IPv4-mapped and reserved/documentation space.
    return /^[23][0-9a-f]{3}:/.test(a) && !a.startsWith("2001:db8:") && !a.startsWith("2001:0:");
  }
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}
