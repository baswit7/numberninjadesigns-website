import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routes = [
  {
    id: "budget-planner-basic",
    file: "budget-planner-basic.html",
    tabs: "7",
    formulas: "104+"
  },
  {
    id: "debt-payoff-tracker",
    file: "debt-payoff-tracker.html",
    tabs: "5",
    formulas: "141+"
  },
  {
    id: "net-worth-tracker",
    file: "net-worth-tracker.html",
    tabs: "6",
    formulas: "150+"
  }
];

async function source(file) {
  return readFile(path.join(root, file), "utf8");
}

function jsonLdDocuments(html) {
  return [...html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)]
    .map((match) => JSON.parse(match[1]));
}

function containsKey(value, forbiddenKey) {
  if (!value || typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, forbiddenKey)) return true;
  return Object.values(value).some((child) => containsKey(child, forbiddenKey));
}

test("all finance routes exist and the catalog references each route", async () => {
  const index = await source("index.html");
  const commerce = await source("commerce.js");

  for (const route of routes) {
    await access(path.join(root, route.file));
    assert.match(index, new RegExp(`href=["']${route.file.replace(".", "\\.")}["']`));
    assert.match(commerce, new RegExp(`id:\\s*["']${route.id}["']`));
    assert.match(commerce, new RegExp(`href:\\s*["']${route.file.replace(".", "\\.")}["']`));
  }

  assert.match(index, /data-product-catalog/);
  assert.match(index, /aria-busy=["']true["']/);
  assert.match(index, /src=["']data\/products\.js["']/);
  assert.match(index, /src=["']commerce\.js["']/);
});

test("brand and launch gate are consistent across public finance pages", async () => {
  const files = ["index.html", ...routes.map((route) => route.file), "commerce.js"];
  for (const file of files) {
    const text = await source(file);
    assert.match(text, /NumberNinjaDesigns/, `${file} must use the canonical brand`);
    assert.doesNotMatch(text, /NumberNinjaTees/, `${file} must not use the retired brand`);
    assert.doesNotMatch(text, /PUBLICATION_READY/i);
  }

  for (const route of routes) {
    const html = await source(route.file);
    assert.match(html, /Owner approved/i);
    assert.match(html, new RegExp(`(?:Tabs[\\s\\S]{0,120}${route.tabs}|${route.tabs}\\s+real tabs)`, "i"));
    assert.ok(html.includes(route.formulas), `${route.file} must expose ${route.formulas} formula truth`);
  }
});

test("finance pages contain no transaction or direct-file access routes", async () => {
  const files = ["index.html", ...routes.map((route) => route.file)];
  for (const file of files) {
    const html = await source(file);
    const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]);
    assert.equal(
      hrefs.some((href) => /(?:checkout|cart|purchase|download|\.xlsx(?:$|[?#])|\.zip(?:$|[?#]))/i.test(href)),
      false,
      `${file} must not expose a transaction or direct-file route`
    );
    const actionText = [...html.matchAll(/<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)]
      .map((match) => match[1].replace(/<[^>]+>/g, " "));
    assert.equal(
      actionText.some((text) => /\b(?:buy|purchase|download|checkout)\b/i.test(text)),
      false,
      `${file} must not present a live transaction action`
    );
  }
});

test("interactive workbook previews expose accessible controls and keyboard behavior", async () => {
  for (const route of routes) {
    const html = await source(route.file);
    assert.match(html, /data-workbook-preview/);
    assert.match(html, /role=["']tablist["']/);
    assert.match(html, /role=["']tab["']/);
    assert.match(html, /aria-controls=/);
    assert.match(html, /aria-selected=/);
    assert.match(html, /role=["']tabpanel["']/);
    assert.match(html, /aria-live=["']polite["']/);
  }

  const commerce = await source("commerce.js");
  for (const hook of ["data-sheet-tab", "data-sheet-panel", "data-preview-status"]) {
    assert.ok(commerce.includes(hook), `commerce.js must implement ${hook}`);
  }
  for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
    assert.ok(commerce.includes(key), `commerce.js must support ${key}`);
  }
  assert.match(commerce, /detailHref/);
  assert.match(commerce, /replaceChildren/);
});

test("SEO metadata is parseable and detail schemas omit offers", async () => {
  const index = await source("index.html");
  assert.match(index, /<link\s+rel=["']canonical["']\s+href=["']https:\/\//i);
  assert.match(index, /<meta\s+property=["']og:title["']/i);
  assert.ok(jsonLdDocuments(index).length > 0);

  for (const route of routes) {
    const html = await source(route.file);
    assert.match(html, new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']https://[^"']+/${route.file.replace(".", "\\.")}["']`, "i"));
    assert.match(html, /<meta\s+property=["']og:title["']/i);
    const documents = jsonLdDocuments(html);
    assert.ok(documents.length > 0, `${route.file} must contain JSON-LD`);
    const serialized = JSON.stringify(documents);
    assert.match(serialized, /"@type":"Product"/);
    assert.match(serialized, /"@type":"SoftwareApplication"/);
    assert.equal(containsKey(documents, "offers"), false, `${route.file} must omit offers before launch`);
  }
});

test("storefront has no remote scripts or provider calls and includes recovery styling", async () => {
  const files = ["index.html", ...routes.map((route) => route.file)];
  for (const file of files) {
    const html = await source(file);
    assert.doesNotMatch(html, /<script\b[^>]*\bsrc=["']https?:\/\//i);
  }

  const commerce = await source("commerce.js");
  assert.doesNotMatch(commerce, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
  assert.match(commerce, /buildRecoveryCard/);

  const css = await source("commerce.css");
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.catalog-recovery/);
  assert.match(css, /:focus-visible/);
});
