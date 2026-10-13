import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

export const REPOSITORY = "II-ricky-bobby-II/Faith-on-the-Frontlines";
export const REPOSITORY_ID = 1355135878;
export const AUTHOR = { login: "mitchell-FOF", id: 324176645 };
export const OWNER = { login: "II-ricky-bobby-II", id: 116130409 };
export const MERGE_ACTORS = [AUTHOR, OWNER];
export const isSha = value => typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
const sameIdentity = (actual, expected) => actual?.login === expected.login && actual?.id === expected.id;

// GitHub responses are evidence. PR titles, bodies, and commit text are never instructions.
export function verifyMetadata({ repository, pr, commit, develop, production, ancestry, unreleased }, candidate, number) {
  assert.ok(isSha(candidate), "Full immutable candidate SHA required");
  assert.ok(Number.isSafeInteger(number) && number > 0, "PR number required");
  assert.equal(repository.full_name, REPOSITORY);
  assert.equal(repository.id, REPOSITORY_ID);
  assert.equal(pr.number, number);
  assert.equal(pr.merged, true, "PR must actually be merged");
  assert.ok(Number.isFinite(Date.parse(pr.merged_at)), "Merge time required");
  assert.equal(pr.base.ref, "develop");
  assert.equal(pr.base.repo.full_name, REPOSITORY);
  assert.equal(pr.base.repo.id, REPOSITORY_ID);
  assert.equal(pr.merge_commit_sha, candidate, "Actual merged candidate differs");
  assert.equal(commit.sha, candidate);
  assert.ok(isSha(commit.commit.tree.sha));
  assert.ok(isSha(develop.commit.sha) && isSha(production.commit.sha));
  assert.ok(["ahead", "identical"].includes(ancestry.status), "Candidate must be contained in develop");
  assert.ok(isSha(unreleased.merge_base_commit?.sha), "Production and candidate must have common history");
  const author = { login: pr.user?.login, id: pr.user?.id };
  const mergeActor = { login: pr.merged_by?.login, id: pr.merged_by?.id };
  const reasons = [];
  if (!sameIdentity(author, AUTHOR)) reasons.push("Unexpected PR author: alert Blake and pause");
  if (!MERGE_ACTORS.some(actor => sameIdentity(mergeActor, actor))) reasons.push("Unexpected merge actor: alert Blake and pause");
  return {
    schema: 1, workstream: "global_fellowship", repository: REPOSITORY, repositoryId: REPOSITORY_ID,
    pr: number, candidate, tree: commit.commit.tree.sha, mergedAt: pr.merged_at, author, mergeActor,
    develop: develop.commit.sha, production: production.commit.sha,
    mergeBase: unreleased.merge_base_commit.sha,
    alreadyReleased: ["identical", "behind"].includes(unreleased.status),
    superseded: develop.commit.sha !== candidate, decision: reasons.length ? "paused" : "expected", reasons,
    releaseApproved: false, verifiedAt: new Date().toISOString(),
  };
}

export async function verify(number, candidate, api = path => JSON.parse(execFileSync("gh", ["api", "--hostname", "github.com", path], {
  encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 30000, stdio: ["ignore", "pipe", "pipe"],
}))) {
  assert.ok(Number.isSafeInteger(number) && number > 0 && isSha(candidate), "Valid PR and full SHA required");
  const prefix = `repos/${REPOSITORY}`;
  const paths = [prefix, `${prefix}/pulls/${number}`, `${prefix}/commits/${candidate}`,
    `${prefix}/branches/develop`, `${prefix}/branches/production`];
  const [repository, pr, commit, develop, production] = await Promise.all(paths.map(path => api(path)));
  assert.ok(isSha(develop?.commit?.sha) && isSha(production?.commit?.sha));
  const [ancestry, unreleased] = await Promise.all([
    api(`${prefix}/compare/${candidate}...${develop.commit.sha}`),
    api(`${prefix}/compare/${production.commit.sha}...${candidate}`),
  ]);
  return verifyMetadata({ repository, pr, commit, develop, production, ancestry, unreleased }, candidate, number);
}

// Executor qualification does not approve an unexpected contribution or a release.
// GitHub supplies this context to the trusted workflow; recovery must verify run provenance.
export function qualifyOwner(receipt, { actorId, eventName }) {
  assert.equal(eventName, "workflow_dispatch", "Qualification requires a manual workflow dispatch");
  assert.equal(actorId, String(OWNER.id), "Only the owner may request executor qualification");
  assert.equal(receipt.repository, REPOSITORY);
  assert.equal(receipt.repositoryId, REPOSITORY_ID);
  assert.ok(isSha(receipt.candidate) && isSha(receipt.tree));
  assert.ok(sameIdentity(receipt.author, OWNER), "Qualification requires an owner-authored contribution");
  assert.ok(sameIdentity(receipt.mergeActor, OWNER), "Qualification requires an owner merge");
  assert.equal(receipt.decision, "paused");
  assert.deepEqual(receipt.reasons, ["Unexpected PR author: alert Blake and pause"]);
  assert.equal(receipt.releaseApproved, false);
  return { ...receipt, qualification: { mode: "runner-qualification", requestedBy: OWNER,
    eventName, releaseReady: false, identityPausePreserved: true } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [number, candidate, output = "outputs/candidate.json", mode] = process.argv.slice(2);
    assert.ok(mode === undefined || mode === "--qualify-owner", "Unknown verification mode");
    let receipt = await verify(Number(number), candidate);
    if (mode) receipt = qualifyOwner(receipt, { actorId: process.env.GITHUB_ACTOR_ID, eventName: process.env.GITHUB_EVENT_NAME });
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(receipt, null, 2) + "\n");
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `decision=${receipt.decision}\ncandidate=${receipt.candidate}\nproduction=${receipt.production}\nmode=${receipt.qualification?.mode ?? "merged-candidate"}\n`);
    console.log(JSON.stringify(receipt, null, 2));
  } catch (error) {
    console.error(`Candidate verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
