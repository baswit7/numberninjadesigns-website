import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(root, "support", "index.html"), "utf8");
const css = readFileSync(path.join(root, "support", "styles.css"), "utf8");
const app = readFileSync(path.join(root, "support", "app.js"), "utf8");
const data = readFileSync(path.join(root, "support", "data.js"), "utf8");

test("public support assets are valid standalone static files", () => {
  for (const file of ["support/app.js", "support/data.js"]) {
    const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.numberninjadesigns\.com\/support\/">/);
  assert.match(html, /https:\/\/www\.etsy\.com\/shop\/NumberNinjaDesigns/);
  assert.match(html, /type="application\/ld\+json"/);
  assert.match(html, /src="\.\/data\.js"/);
  assert.match(html, /src="\.\/app\.js"/);
  assert.doesNotMatch(html, /\b(?:src|href)="https?:\/\/[^"]+\.(?:js|css)"/i);
});

test("support page has restrictive CSP and no executable HTML sinks", () => {
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(`${app}\n${data}`, /\b(?:innerHTML|outerHTML|insertAdjacentHTML|eval|Function)\b/);
  assert.doesNotMatch(html, /\son[a-z]+\s*=|javascript:/i);
});

test("catalog covers seven products and four production locales without API dependency", () => {
  assert.equal((data.match(/\n\s+product\(/g) ?? []).length, 7);
  for (const productId of [
    "budget-planner-basic",
    "budget-planner-professional",
    "budget-planner-ultimate",
    "monthly-budget-planner",
    "debt-snowball-planner",
    "savings-goal-tracker",
    "subscription-tracker"
  ]) assert.ok(data.includes(`"${productId}"`), `missing ${productId}`);
  for (const locale of ["nl-NL", "en-US", "en-GB", "de-DE"]) assert.ok(data.includes(`"${locale}"`));
  assert.doesNotMatch(app, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
  assert.doesNotMatch(`${app}\n${data}`, /\b(?:localStorage|sessionStorage|indexedDB)\b/);
});

test("answers are deterministic, source-bound and escalate honestly through customer email", () => {
  for (const intent of ["contents", "compatibility", "configuration", "download", "privacy", "sensitive", "unknown"]) {
    assert.ok(app.includes(`"${intent}"`), `missing ${intent} behavior`);
  }
  assert.match(app, /Google Sheets support: no/);
  assert.match(app, /Google Sheets-ondersteuning: nee/);
  assert.match(app, /buildSources/);
  assert.match(app, /mailto:support@numberninjadesigns\.com/);
  assert.ok(html.includes("Een supportverzoek is pas verzonden nadat jij de e-mail verstuurt."));
  assert.ok(html.includes("Er wordt niets automatisch verzonden."));
  assert.doesNotMatch(`${html}\n${app}`, /ticket is aangemaakt|ticket has been created/i);
});

test("accessibility and responsive contracts are present", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const id of [...app.matchAll(/\$\("([^"]+)"\)/g)].map(match => match[1])) {
    assert.ok(ids.includes(id), `missing DOM id ${id}`);
  }
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<label[\s\S]*?<select id="product"/);
  assert.match(html, /<label[\s\S]*?<textarea id="question"/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.equal((css.match(/\{/g) ?? []).length, (css.match(/\}/g) ?? []).length);
});
