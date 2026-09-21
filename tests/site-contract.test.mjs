import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { sampleEvents } from "../data/events.ts";

const projectRoot = new URL("../", import.meta.url);

test("sample events have valid, unique public identifiers", () => {
  assert.ok(sampleEvents.length > 0);

  const slugs = new Set();
  for (const event of sampleEvents) {
    assert.match(event.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(slugs.has(event.slug), false, `duplicate event slug: ${event.slug}`);
    slugs.add(event.slug);

    assert.ok(event.title.trim());
    assert.ok(event.venue.trim());
    assert.ok(event.city.trim());
    assert.match(event.state, /^[A-Z]{2}$/);
    assert.match(event.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(Number.isNaN(Date.parse(`${event.date}T00:00:00Z`)), false);
    assert.match(event.contactEmail, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  }
});

test("primary navigation routes resolve to application pages", async () => {
  const routes = [
    "about",
    "accessibility",
    "contact",
    "events",
    "host-an-event",
    "privacy",
  ];

  await Promise.all(
    routes.map((route) => access(new URL(`app/${route}/page.tsx`, projectRoot))),
  );

  const [header, footer] = await Promise.all([
    readFile(new URL("components/Header.tsx", projectRoot), "utf8"),
    readFile(new URL("components/Footer.tsx", projectRoot), "utf8"),
  ]);

  for (const route of ["about", "contact", "events", "host-an-event"]) {
    assert.match(`${header}\n${footer}`, new RegExp(`href=["']/${route}["']`));
  }
  for (const route of ["accessibility", "privacy"]) {
    assert.match(footer, new RegExp(`href=["']/${route}["']`));
  }
});

test("release workflows keep validation ahead of production deployment", async () => {
  const [quality, deploy, generatedWrangler] = await Promise.all([
    readFile(new URL(".github/workflows/quality.yml", projectRoot), "utf8"),
    readFile(new URL(".github/workflows/deploy.yml", projectRoot), "utf8"),
    readFile(new URL("dist/server/wrangler.json", projectRoot), "utf8"),
  ]);

  assert.match(quality, /pull_request:[\s\S]*develop[\s\S]*production/);
  assert.match(quality, /github\.base_ref == 'production'/);
  assert.match(quality, /github\.head_ref != 'develop'/);
  assert.match(quality, /npm ci/);
  assert.match(quality, /npm run lint/);
  assert.match(quality, /npm test/);

  assert.match(deploy, /push:[\s\S]*branches:\s*\[production\]/);
  assert.match(deploy, /environment:\s*production/);
  assert.match(deploy, /secrets\.CLOUDFLARE_API_TOKEN/);

  const deploymentConfig = JSON.parse(generatedWrangler);
  const database = deploymentConfig.d1_databases?.find(
    ({ binding }) => binding === "DB",
  );
  assert.ok(database, "production build must retain the DB binding");
  assert.match(database.database_id, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
});
