import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
export async function auditBrowser(origin, out) {
  if (!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(origin)) throw new Error("Only an isolated loopback preview is allowed");
  const browser = await chromium.launch({ chromiumSandbox: true });
  const result = { checks: [], failures: [], accessibility: [], blockedExternalRequests: [], pageErrors: [],
    manualReviewRequired: true, fixtures: { database: "local synthetic D1", cms: "local synthetic Payload HTTP server", email: "no provider" } };
  const check = async (name, action) => {
    try { await action(); result.checks.push({ name, status: "passed" }); }
    catch (error) { result.checks.push({ name, status: "failed" }); result.failures.push({ name, error: error.message }); }
  };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, serviceWorkers: "block" });
      await context.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.origin === origin || ["data:", "blob:"].includes(url.protocol)) return route.continue();
        result.blockedExternalRequests.push(url.origin); return route.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", error => result.pageErrors.push(error.message));
      for (const path of ["/", "/events", "/events/audit-fixture-event", "/about", "/contact", "/host-an-event", "/privacy", "/accessibility"]) {
        await check(`${viewport.width}px ${path}`, async () => {
          const response = await page.goto(origin + path, { waitUntil: "networkidle" });
          assert(response.status() === 200, `Route returned ${response.status()}`);
          assert(await page.locator("main").count() === 1, "Expected one main landmark");
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
          assert(!overflow, "Horizontal overflow");
          await page.screenshot({ path: join(out, `${viewport.width}-${path === "/" ? "home" : path.slice(1).replaceAll("/", "-")}.png`), fullPage: true });
          if (path === "/events") {
            assert(await page.getByRole("heading", { name: "Fixture venue", exact: true }).count() === 1, "CMS venue is missing from events");
            assert(await page.locator('a[href="/events/audit-fixture-event"]').count() === 1, "CMS detail link is missing from events");
          }
          if (path === "/events/audit-fixture-event") assert(await page.getByRole("heading", { name: "Audit fixture gathering", exact: true }).count() === 1, "CMS detail fixture is missing");
          await page.addScriptTag({ content: axeSource });
          const accessibility = await page.evaluate(async () => {
            const audit = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
            return { violations: audit.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
              nodes: v.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })), incomplete: audit.incomplete.map(v => ({ id: v.id, impact: v.impact, help: v.help })) };
          });
          result.accessibility.push({ path, viewport, ...accessibility });
          assert(accessibility.violations.length === 0, `${accessibility.violations.length} accessibility violations`);
        });
      }
      if (viewport.width === 390) {
        await check("keyboard mobile menu", async () => {
          await page.goto(origin + "/", { waitUntil: "networkidle" });
          const menu = page.getByRole("button", { name: "Open navigation", exact: true });
          await menu.focus(); await page.keyboard.press("Enter");
          assert(await page.getByRole("button", { name: "Close navigation" }).getAttribute("aria-expanded") === "true", "Keyboard did not open menu");
          await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Events", exact: true }).click();
          await page.waitForURL(origin + "/events");
          assert(await page.getByRole("navigation", { name: "Mobile navigation" }).count() === 0, "Menu did not close after navigation");
        });
      }
      if (viewport.width === 1280) {
        await check("invitation validation and D1 upsert", async () => {
          for (const multipart of [{ email: "invalid", consent: "yes" }, { email: "audit@example.invalid" }]) {
            const response = await context.request.post(origin + "/api/event-invitations", { multipart });
            assert(response.status() === 400, "Invalid signup was accepted");
          }
          for (const firstName of ["First", "Updated"]) {
            const response = await context.request.post(origin + "/api/event-invitations", { multipart: { email: "audit@example.invalid", firstName, consent: "yes", source: "audit" } });
            assert(response.status() === 201, "D1 signup/upsert failed");
          }
          const honeypot = await context.request.post(origin + "/api/event-invitations", { multipart: { email: "honeypot@example.invalid", consent: "yes", website: "bot" } });
          assert(honeypot.status() === 202, "Honeypot response changed");
          await page.goto(origin + "/", { waitUntil: "networkidle" });
          const form = page.locator("form.event-invite-form");
          await form.getByRole("button", { name: "Join the invitation list" }).click();
          await form.getByRole("alert").waitFor({ state: "visible" });
          await form.getByLabel("Email address", { exact: true }).fill("audit@example.invalid");
          await form.getByLabel(/First name/).fill("Browser");
          await form.getByRole("checkbox").check();
          await form.getByRole("button", { name: "Join the invitation list" }).click();
          await form.getByRole("status").waitFor({ state: "visible" });
        });
        await check("inquiry accepts valid input without a live provider", async () => {
          const invalid = await context.request.post(origin + "/api/inquiry", { multipart: { email: "invalid" } });
          assert(invalid.status() === 400, "Invalid inquiry accepted");
          await page.goto(origin + "/contact", { waitUntil: "networkidle" });
          const form = page.locator("form.inquiry-form");
          await form.getByLabel("Contact name *", { exact: true }).fill("Synthetic audit");
          await form.getByLabel("Email *", { exact: true }).fill("inquiry@example.invalid");
          await form.getByLabel("City & state *", { exact: true }).fill("Fixture city, CA");
          await form.getByRole("button", { name: "Send message" }).click();
          await form.getByRole("status").waitFor({ state: "visible" });
        });
      }
      await context.close();
    }
    result.blockedExternalRequests = [...new Set(result.blockedExternalRequests)];
    if (result.pageErrors.length) result.failures.push({ name: "browser JavaScript", error: result.pageErrors.join("; ") });
    return result;
  } finally { await browser.close(); }
}
