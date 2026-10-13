import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sealResults, verifyResults } from "../results.mjs";

test("independent recovery rejects candidate mismatch, altered evidence and escaping paths", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fotf-result-test-"));
  const candidate = "a".repeat(40);
  try {
    await writeFile(join(directory, "report.json"), JSON.stringify({ candidate, technicalStatus: "failed", mode: "runner-qualification" }));
    await writeFile(join(directory, "failure.log"), "Original failure retained\n");
    await sealResults(directory);
    const recovered = await verifyResults(directory, candidate);
    assert.equal(recovered.technicalStatus, "failed");
    assert.equal(recovered.releaseReady, false);
    await assert.rejects(verifyResults(directory, "b".repeat(40)), /another candidate/);
    await writeFile(join(directory, "failure.log"), "Replaced failure\n");
    await assert.rejects(verifyResults(directory, candidate), /Modified result/);
    await writeFile(join(directory, "manifest.json"), JSON.stringify({ candidate, files: [{ path: "../outside", sha256: "x" }] }));
    await assert.rejects(verifyResults(directory, candidate), /Unsafe result path/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
