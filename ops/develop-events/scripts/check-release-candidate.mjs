import { readFile } from "node:fs/promises";
import { REPOSITORY } from "../lib/protocol.mjs";

export function checkReleaseCandidate(event) {
  const pr = event.pull_request;
  if (event.repository?.full_name !== REPOSITORY || pr?.base?.ref !== "production" ||
      pr.head?.ref !== "develop" || pr.head.repo?.full_name !== REPOSITORY || pr.base.repo?.full_name !== REPOSITORY) {
    throw new Error("Production releases must come from this repository's develop branch");
  }
  const matches = Array.from((pr.body ?? "").matchAll(/^Verified develop commit: `([0-9a-f]{40})`\s*$/gm));
  if (matches.length !== 1 || matches[0][1] !== pr.head.sha) {
    throw new Error("The release verification report must identify the current develop commit exactly. Reverify after develop changes.");
  }
  return pr.head.sha;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  readFile(process.env.GITHUB_EVENT_PATH, "utf8").then(JSON.parse).then(checkReleaseCandidate)
    .then(sha => console.log(`Release candidate matches recorded verification SHA ${sha}`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
