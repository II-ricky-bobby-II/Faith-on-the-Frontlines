import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
export async function sealResults(directory) {
  const files = [];
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (["d1", "registry", "manifest.json", "wrangler.log"].includes(entry.name)) continue;
      const full = join(path, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) files.push({ path: relative(directory, full), sha256: hash(await readFile(full)) });
    }
  }
  await walk(directory);
  const report = JSON.parse(await readFile(join(directory, "report.json"), "utf8"));
  await writeFile(join(directory, "manifest.json"), JSON.stringify({ schema: 1, candidate: report.candidate, files: files.sort((a, b) => a.path.localeCompare(b.path)) }, null, 2) + "\n");
}

export async function verifyResults(directory, candidate) {
  const root = resolve(directory);
  const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
  assert.equal(manifest.candidate, candidate, "Saved results belong to another candidate");
  for (const file of manifest.files) {
    assert.ok(typeof file.path === "string" && !file.path.split(/[\\/]/).includes("..") && !file.path.startsWith("/"), "Unsafe result path");
    assert.equal(hash(await readFile(join(root, file.path))), file.sha256, `Modified result: ${file.path}`);
  }
  const report = JSON.parse(await readFile(join(root, "report.json"), "utf8"));
  assert.equal(report.candidate, candidate);
  return { candidate, files: manifest.files.length, technicalStatus: report.technicalStatus, mode: report.mode, releaseReady: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(await verifyResults(process.argv[2], process.argv[3])); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
