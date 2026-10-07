import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist/server", { recursive: true });
await cp("worker", "dist/server/worker", { recursive: true });
await cp("lib", "dist/server/lib", { recursive: true });
await writeFile("dist/server/index.js", 'export { default } from "./worker/index.mjs";\n');
await cp("public", "dist/client", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await cp(".openai/hosting.json", "dist/.openai/hosting.json");
await cp("drizzle", "dist/.openai/drizzle", { recursive: true });
await writeFile("dist/server/wrangler.json", JSON.stringify({
  name: "fotf-develop-events", main: "index.js", compatibility_date: "2026-09-10",
  compatibility_flags: [], no_bundle: true,
  assets: { directory: "../client", binding: "ASSETS", not_found_handling: "none" },
  d1_databases: [{ binding: "DB", database_name: "fotf-develop-events", database_id: "local" }],
  rules: [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }],
}));
JSON.parse(await readFile("dist/.openai/hosting.json", "utf8"));
console.log("Built isolated event bridge Worker and schema migrations");
