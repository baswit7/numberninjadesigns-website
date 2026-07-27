import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandStylesheetVersion = "20260727-etsy-light-standard";
const consentScriptVersion = "20260727";
const consentScript = fs.readFileSync(
  path.join(repositoryRoot, "privacy-consent.js"),
  "utf8"
);
const consentStyles = fs.readFileSync(
  path.join(repositoryRoot, "privacy-consent.css"),
  "utf8"
);
const privacyPolicy = fs.readFileSync(
  path.join(repositoryRoot, "privacy.html"),
  "utf8"
);

function collectIndexFiles(directory) {
  const absoluteDirectory = path.join(repositoryRoot, directory);
  if (!fs.existsSync(absoluteDirectory)) return [];

  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap(entry => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectIndexFiles(relative);
    return entry.isFile() && entry.name === "index.html" ? [relative] : [];
  });
}

const rootHtmlFiles = fs
  .readdirSync(repositoryRoot, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith(".html"))
  .map(entry => entry.name);

const publicHtmlFiles = [
  ...rootHtmlFiles,
  ...collectIndexFiles("collections"),
  ...collectIndexFiles("designs"),
  ...collectIndexFiles("guides"),
  ...collectIndexFiles("support")
];

test("all public pages load the consent UI exactly once", () => {
  assert.ok(publicHtmlFiles.length > 40, "expected the complete public surface");

  for (const relativePath of publicHtmlFiles) {
    const html = fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
    const depth = relativePath.split(path.sep).length - 1;
    const prefix = "../".repeat(depth);

    assert.equal(
      (html.match(/privacy-consent\.css/g) || []).length,
      1,
      `${relativePath} must load the consent stylesheet once`
    );
    assert.equal(
      (html.match(/privacy-consent\.js/g) || []).length,
      1,
      `${relativePath} must load the consent script once`
    );
    assert.match(
      html,
      new RegExp(
        `href="${prefix.replaceAll("../", "\\.\\./")}privacy-consent\\.css\\?v=${brandStylesheetVersion}"`
      ),
      `${relativePath} must use the current consent stylesheet cache version`
    );
    assert.match(
      html,
      new RegExp(
        `src="${prefix.replaceAll("../", "\\.\\./")}privacy-consent\\.js\\?v=${consentScriptVersion}"`
      ),
      `${relativePath} must use a working relative script path`
    );
    assert.doesNotMatch(
      html,
      /s\.pinimg\.com\/ct\/core\.js/,
      `${relativePath} must not load Pinterest before consent`
    );
  }
});

test("consent stylesheet imports and binds the canonical Etsy-light tokens", () => {
  assert.match(
    consentStyles,
    new RegExp(
      `^@import url\\("brand\\.css\\?v=${brandStylesheetVersion}"\\);`
    )
  );

  for (const [label, pattern] of [
    ["root text", /#nnd-consent-root\s*\{[^}]*color:\s*var\(--brand-text\)/],
    ["banner surface", /\.nnd-consent-banner\s*\{[^}]*background:\s*var\(--brand-surface\)/],
    ["banner text", /\.nnd-consent-banner\s*\{[^}]*color:\s*var\(--brand-text\)/],
    ["primary action", /\.nnd-consent-button-primary\s*\{[^}]*background:\s*var\(--brand-accent\)/],
    ["primary action text", /\.nnd-consent-button-primary\s*\{[^}]*color:\s*var\(--brand-on-accent\)/],
    ["secondary action", /\.nnd-consent-button-secondary,[^}]*background:\s*var\(--brand-surface-2\)/],
    ["accessible link", /\.nnd-consent-copy a,[^}]*color:\s*var\(--brand-secondary\)/],
    ["accessible accent", /\.nnd-consent-option span\s*\{[^}]*color:\s*var\(--brand-accent-strong\)/],
  ]) {
    assert.match(consentStyles, pattern, `missing canonical ${label} binding`);
  }

  assert.doesNotMatch(consentStyles, /color-scheme\s*:\s*dark/i);
});

test("Pinterest tracking is production-only and contains no enhanced-match payload", () => {
  assert.match(consentScript, /const PINTEREST_TAG_ID = "2613073368837"/);
  assert.match(consentScript, /PRODUCTION_HOSTS\.has\(window\.location\.hostname\)/);
  assert.match(consentScript, /pintrk\("track", "pagevisit"/);
  assert.doesNotMatch(consentScript, /\{\s*em\s*:/);
  assert.doesNotMatch(consentScript, /hashed_email_address/);
  assert.doesNotMatch(consentScript, /user_email_address/);
});

test("privacy policy documents consent, withdrawal and disabled enhanced matching", () => {
  assert.match(privacyPolicy, /id="cookies-and-pinterest"/);
  assert.match(privacyPolicy, /nnd_privacy_consent_v1/);
  assert.match(privacyPolicy, /Automatic enhanced matching is disabled/);
  assert.match(privacyPolicy, /Consent can be withdrawn at any time/);
  assert.match(privacyPolicy, /Pinterest Privacy Policy/);
});
