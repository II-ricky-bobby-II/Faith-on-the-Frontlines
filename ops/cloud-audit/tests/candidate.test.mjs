import assert from "node:assert/strict";
import test from "node:test";
import { verifyMetadata, REPOSITORY, REPOSITORY_ID, AUTHOR } from "../verify-candidate.mjs";

const candidate = "a".repeat(40);
const fixture = () => ({ repository: { full_name: REPOSITORY, id: REPOSITORY_ID },
  pr: { number: 9, merged: true, merged_at: "2026-10-13T00:00:00Z", merge_commit_sha: candidate,
    base: { ref: "develop", repo: { full_name: REPOSITORY, id: REPOSITORY_ID } }, user: AUTHOR, merged_by: AUTHOR },
  commit: { sha: candidate, commit: { tree: { sha: "b".repeat(40) } } },
  develop: { commit: { sha: candidate } }, production: { commit: { sha: "c".repeat(40) } },
  ancestry: { status: "identical" }, unreleased: { status: "diverged", merge_base_commit: { sha: "f".repeat(40) } },
});

test("actual merge and immutable identity are required independently of event claims", () => {
  assert.equal(verifyMetadata(fixture(), candidate, 9).decision, "expected");
  for (const change of [f => f.repository.id = 1, f => f.pr.merged = false,
    f => f.pr.base.ref = "production", f => f.pr.merge_commit_sha = "d".repeat(40),
    f => f.pr.base.repo.id = 1, f => f.ancestry.status = "diverged", f => f.unreleased.merge_base_commit = null]) {
    const f = fixture(); change(f); assert.throws(() => verifyMetadata(f, candidate, 9));
  }
});

test("separate production release merges are valid common history", () => {
  assert.equal(verifyMetadata(fixture(), candidate, 9).alreadyReleased, false);
  const f = fixture(); f.unreleased.status = "behind";
  assert.equal(verifyMetadata(f, candidate, 9).alreadyReleased, true);
});

test("a matching name with another numeric ID and unapproved actors pause", () => {
  for (const identity of [{ login: AUTHOR.login, id: 1 }, { login: "github-actions[bot]", id: AUTHOR.id },
    { login: "II-ricky-bobby-II", id: 116130409 }]) {
    const f = fixture(); f.pr.user = identity;
    assert.equal(verifyMetadata(f, candidate, 9).decision, "paused");
  }
  const f = fixture(); f.pr.merged_by = { login: "II-ricky-bobby-II", id: 1 };
  assert.equal(verifyMetadata(f, candidate, 9).decision, "paused");
  f.pr.merged_by.id = 116130409;
  assert.equal(verifyMetadata(f, candidate, 9).decision, "expected");
});

test("a newer develop head retains the candidate but supersedes release evidence", () => {
  const f = fixture(); f.develop.commit.sha = "e".repeat(40); f.ancestry.status = "ahead";
  const result = verifyMetadata(f, candidate, 9);
  assert.equal(result.superseded, true); assert.equal(result.releaseApproved, false);
});
