import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = (await readFile(new URL("../app/globals.css", import.meta.url), "utf8"))
  .replace(/^@import[^;]+;/gm, "");

function declaration(selector, property) {
  const rule = css.split("}").find((rule) => rule.split("{")[0].trim() === selector);
  assert.ok(rule, `Missing style for ${selector}`);
  const value = rule.split("{")[1].split(";")
    .map((entry) => entry.trim()).find((entry) => entry.startsWith(`${property}:`));
  assert.ok(value, `Missing ${property} on ${selector}`);
  const color = value.slice(property.length + 1).trim();
  const variable = /^var\((--[\w-]+)\)$/.exec(color);
  return variable ? declaration(":root", variable[1]) : color;
}

function luminance(hex) {
  assert.match(hex, /^#[\da-f]{6}$/i);
  const channels = hex.slice(1).match(/../g).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("invitation eyebrow meets normal-text WCAG AA contrast", () => {
  const ratio = contrast(declaration(".event-invite .eyebrow", "color"), declaration(".event-invite", "background"));
  assert.ok(ratio >= 4.5, `Invitation eyebrow contrast ${ratio.toFixed(3)}:1 is below 4.5:1`);
});

test("host inquiry secondary text meets normal-text WCAG AA contrast", () => {
  for (const selector of [".form-intro p", ".form-note"]) {
    const ratio = contrast(declaration(selector, "color"), declaration(":root", "--pale-blue"));
    assert.ok(ratio >= 4.5, `${selector} contrast ${ratio.toFixed(3)}:1 is below 4.5:1`);
  }
});
