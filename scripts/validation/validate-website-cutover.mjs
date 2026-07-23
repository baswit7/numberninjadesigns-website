import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXPECTED_BRAND = "NumberNinjaDesigns";
const EXPECTED_ETSY_URL = "https://www.etsy.com/shop/NumberNinjaDesigns";
const EXPECTED_SITE_ORIGIN = "https://www.numberninjadesigns.com";
const EXPECTED_EMAIL_SUFFIX = "@numberninjadesigns.com";
const LEGACY_IDENTITY = /(?:NumberNinjaTees|NinjaNumberTees|ninjanumbertees\.com|numberninjatees\.github\.io)/i;
const failures = [];
const passes = [];

function relativePath(path) {
  return path.slice(ROOT.length + 1).replaceAll("\\", "/");
}

function read(relative) {
  return readFileSync(resolve(ROOT, relative), "utf8");
}

function parseJson(relative) {
  try {
    return JSON.parse(read(relative));
  } catch (error) {
    failures.push(relative + ": invalid JSON: " + error.message);
    return null;
  }
}

function assert(condition, summary) {
  if (condition) passes.push(summary);
  else failures.push(summary);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assetByteCandidates(path) {
  const bytes = readFileSync(path);
  if (extname(path).toLowerCase() !== ".svg") return [bytes];
  const normalized = Buffer.from(bytes.toString("utf8").replaceAll("\r\n", "\n"), "utf8");
  return normalized.equals(bytes) ? [bytes] : [bytes, normalized];
}

function attributeValues(source, tag, attribute) {
  const values = [];
  const expression = new RegExp("<" + tag + "\\b[^>]*\\b" + attribute + "\\s*=\\s*([\"'])(.*?)\\1", "gis");
  let match;
  while ((match = expression.exec(source))) values.push(match[2]);
  return values;
}

function idsIn(source) {
  return attributeValues(source, "[a-z][a-z0-9:-]*", "id");
}

function stripMarkup(value) {
  return value.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&copy;/g, "©")
    .replace(/\s+/g, " ")
    .trim();
}

function imageDimensions(path) {
  const bytes = readFileSync(path);
  const extension = extname(path).toLowerCase();
  if (extension === ".png") {
    if (bytes.length < 24 || bytes.toString("ascii", 1, 4) !== "PNG") throw new Error("invalid PNG");
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("invalid JPEG");
    const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const length = bytes.readUInt16BE(offset + 2);
      if (sof.has(marker)) {
        return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      if (length < 2) throw new Error("invalid JPEG segment");
      offset += 2 + length;
    }
    throw new Error("JPEG dimensions not found");
  }
  if (extension === ".svg") {
    const source = bytes.toString("utf8");
    const viewBox = source.match(/\bviewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
    if (!viewBox) throw new Error("SVG viewBox not found");
    return { width: Number(viewBox[1]), height: Number(viewBox[2]) };
  }
  throw new Error("unsupported image extension " + extension);
}

function cssBracesBalanced(source) {
  const sanitized = source.replace(/\/\*[\s\S]*?\*\//g, "");
  let depth = 0;
  let quote = "";
  for (let index = 0; index < sanitized.length; index += 1) {
    const character = sanitized[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "'" || character === "\"") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0 && quote === "";
}

const publicHtml = [
  "index.html",
  "about.html",
  "budget-planner-basic.html",
  "contact.html",
  "data-deletion.html",
  "designs.html",
  "developer.html",
  "privacy.html",
  "support/index.html",
  "terms.html"
];
const callbackHtml = ["tiktok/callback/index.html"];
const allHtml = publicHtml.concat(callbackHtml);
const htmlCache = new Map(allHtml.map((file) => [file, read(file)]));
const identityContractFiles = [
  "shared/contracts/execution/approval-record.schema.json",
  "shared/contracts/execution/execution-policy.schema.json",
  "shared/contracts/execution/execution-request.schema.json",
  "shared/contracts/execution/idempotency-record.schema.json",
  "shared/contracts/execution/risk-assessment.schema.json",
  "shared/contracts/execution/rollback-plan.schema.json",
  "shared/contracts/readiness/approval-chain.schema.json",
  "shared/contracts/readiness/dependency-check.schema.json",
  "shared/contracts/readiness/execution-plan.schema.json",
  "shared/contracts/readiness/execution-step.schema.json",
  "shared/contracts/readiness/preflight-check.schema.json",
  "shared/contracts/readiness/readiness-decision.schema.json",
  "shared/contracts/readiness/readiness-report.schema.json"
];

for (const file of publicHtml) {
  const html = htmlCache.get(file);
  assert(/^<!doctype html>/i.test(html.trimStart()), file + ": HTML5 doctype");
  assert(/<html\b[^>]*\blang=["'][a-z]{2}(?:-[A-Z]{2})?["']/i.test(html), file + ": language declared");
  assert(/<meta\b[^>]*\bcharset=["']?utf-8/i.test(html), file + ": UTF-8 metadata");
  assert(/<meta\b[^>]*\bname=["']viewport["'][^>]*\bcontent=/i.test(html), file + ": responsive viewport");
  assert(/<title>[^<]{8,}<\/title>/i.test(html), file + ": non-empty title");
  assert(/<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["'][^"']{30,}["']/i.test(html), file + ": SEO description");
  assert(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']https:\/\//i.test(html), file + ": HTTPS canonical");
  const canonical = (html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/i) || [])[1];
  assert(Boolean(canonical) && canonical.startsWith(EXPECTED_SITE_ORIGIN + "/"), file + ": canonical uses the NumberNinjaDesigns domain");
  assert(!LEGACY_IDENTITY.test(html), file + ": no active legacy identity");
  for (const property of ["og:title", "og:description", "og:type", "og:url"]) {
    assert(new RegExp("<meta\\b[^>]*\\bproperty=[\"']" + property + "[\"'][^>]*\\bcontent=", "i").test(html), file + ": " + property + " metadata");
  }
  assert((html.match(/<main\b/gi) || []).length === 1, file + ": one main landmark");
  assert(/<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(html), file + ": primary heading");
  assert(/<link\b[^>]*\brel=["']icon["']/i.test(html), file + ": favicon linked");

  const ids = idsIn(html);
  assert(ids.length === new Set(ids).size, file + ": IDs are unique");

  for (const imageTag of html.match(/<img\b[^>]*>/gi) || []) {
    assert(/\balt\s*=\s*["'][^"']*["']/i.test(imageTag), file + ": image has alt attribute");
  }
  for (const buttonTag of html.match(/<button\b[^>]*>/gi) || []) {
    assert(/\btype\s*=\s*["'](?:button|submit|reset)["']/i.test(buttonTag), file + ": button type declared");
  }
  for (const scriptBody of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(scriptBody[1]);
      passes.push(file + ": JSON-LD parses");
    } catch (error) {
      failures.push(file + ": JSON-LD invalid: " + error.message);
    }
  }
}

function validateLocalReference(owner, value) {
  if (!value || value.startsWith("#") || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(value)) return;
  const split = value.split("#");
  const local = decodeURIComponent(split[0].split("?")[0]);
  const fragment = split[1] || "";
  const ownerPath = resolve(ROOT, owner);
  const target = local ? resolve(dirname(ownerPath), local) : ownerPath;
  assert(existsSync(target), owner + ": local reference exists: " + value);
  if (existsSync(target) && fragment && extname(target).toLowerCase() === ".html") {
    const targetSource = readFileSync(target, "utf8");
    assert(idsIn(targetSource).includes(fragment), owner + ": fragment target exists: " + value);
  }
}

for (const [file, html] of htmlCache) {
  for (const href of attributeValues(html, "a", "href")) {
    validateLocalReference(file, href);
    if (/etsy\.(?:com|me)/i.test(href)) {
      assert(href === EXPECTED_ETSY_URL, file + ": Etsy URL is exact");
    }
    if (/^mailto:/i.test(href)) {
      assert(href.toLowerCase().endsWith(EXPECTED_EMAIL_SUFFIX), file + ": email uses the NumberNinjaDesigns domain");
    }
  }
  for (const href of attributeValues(html, "link", "href")) validateLocalReference(file, href);
  for (const src of attributeValues(html, "script", "src")) validateLocalReference(file, src);
  for (const src of attributeValues(html, "img", "src")) validateLocalReference(file, src);
}

for (const cssFile of ["styles.css", "commerce.css", "seo.css"]) {
  const css = read(cssFile);
  assert(cssBracesBalanced(css), cssFile + ": CSS braces and quotes balance");
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) validateLocalReference(cssFile, match[1]);
}

const homeSource = read("index.html");
const commerceStyles = read("commerce.css");
assert(homeSource.includes("commerce.css?v=20260723-home-apparel-grid"), "index.html: homepage apparel grid uses the current stylesheet cache key");
assert(/\.apparel-item\s*\{\s*padding:\s*24px 12px;/m.test(commerceStyles), "commerce.css: desktop apparel cards use equal total horizontal padding");
assert(/\.apparel-item:first-child\s*\{[^}]*padding-left:\s*0;[^}]*padding-right:\s*24px;/s.test(commerceStyles), "commerce.css: first apparel card preserves the outer edge and equal media width");
assert(/\.apparel-item:last-child\s*\{[^}]*padding-left:\s*24px;[^}]*padding-right:\s*0;[^}]*border-right-color:\s*transparent;/s.test(commerceStyles), "commerce.css: last apparel card preserves the outer edge, border width and equal media width");

const brandFiles = allHtml.concat([
  "README.md",
  "docs/ARCHITECTURE.md",
  "commerce.js",
  "styles.css",
  "data/products.js",
  "data/designs.json"
]);
for (const file of brandFiles) {
  const source = read(file);
  assert(!/(?:NumberNinjaTees|NinjaNumberTees)/.test(source), file + ": no legacy cased brand token");
  assert(!/Ninja\\A\s*Number\\A\s*Tees/i.test(source), file + ": no legacy visual brand token");
  assert(!/numberninjatees\.etsy\.com/i.test(source), file + ": no legacy Etsy shop URL");
}

for (const file of identityContractFiles) {
  const contract = parseJson(file);
  assert(Boolean(contract) && contract.$id.startsWith(EXPECTED_SITE_ORIGIN + "/contracts/"), file + ": schema identity uses the NumberNinjaDesigns domain");
  assert(!LEGACY_IDENTITY.test(read(file)), file + ": no legacy schema identity");
}

const indexText = stripMarkup(htmlCache.get("index.html"));
assert(indexText.includes("Data, Excel, SQL and BI designs"), "index.html: focused design catalog is visible");
assert(indexText.includes("Digital Products"), "index.html: Digital Products is visible");
assert(htmlCache.get("index.html").includes(EXPECTED_ETSY_URL), "index.html: new Etsy shop is linked");
assert(htmlCache.get("index.html").includes('"name": "NumberNinjaDesigns"'), "index.html: structured organization name migrated");
assert(!htmlCache.get("index.html").includes("assets/designs/mockups/"), "index.html: homepage uses full artwork instead of distant shirt mockups");
for (const artwork of [
  "assets/designs/29-excel-overlord.png",
  "assets/designs/07-my-brain-runs-on-sql.png",
  "assets/designs/13-kpi-hunter.png"
]) {
  assert(htmlCache.get("index.html").includes(artwork), "index.html: complete homepage artwork is visible " + artwork);
}

const storefrontCss = read("styles.css");
const commerceCss = read("commerce.css");
const seoCss = read("seo.css");
assert(/\.asset-image\s*\{[^}]*object-fit:\s*contain;/s.test(storefrontCss), "styles.css: gallery artwork cannot be cropped");
assert(/@media\s*\(max-width:\s*560px\)[\s\S]*?\.design-grid\s*\{[^}]*grid-template-columns:\s*1fr;/s.test(storefrontCss), "styles.css: mobile gallery uses one readable column");
assert(!storefrontCss.includes("-webkit-line-clamp"), "styles.css: catalog titles are never truncated");
assert(/\.hero-apparel-visual img\s*\{[^}]*object-fit:\s*contain;/s.test(commerceCss), "commerce.css: homepage hero artwork remains complete");
assert(/\.apparel-item img\s*\{[^}]*object-fit:\s*contain;/s.test(commerceCss), "commerce.css: homepage collection artwork remains complete");
assert(/\.concept-card-image img\s*\{[^}]*object-fit:\s*contain;/s.test(seoCss), "seo.css: concept artwork cannot be cropped");
assert(/\.collection-index-media img\s*\{[^}]*object-fit:\s*contain;/s.test(seoCss), "seo.css: collection artwork cannot be cropped");
assert(/\.gallery-list \.asset-image\s*\{[^}]*object-fit:\s*contain;/s.test(seoCss), "seo.css: catalog artwork cannot be cropped");
assert(/\.variant-card img\s*\{[^}]*object-fit:\s*contain;/s.test(seoCss), "seo.css: detail artwork cannot be cropped");
assert(/\.variant-card\.is-mockup img\s*\{[^}]*object-fit:\s*contain;/s.test(seoCss), "seo.css: product mockups remain fully visible");
assert(/\.variant-card\.is-mockup img\s*\{[^}]*filter:\s*brightness\(2\.35\) contrast\(0\.62\) saturate\(1\.2\);/s.test(seoCss), "seo.css: dark product mockups use the approved high-contrast treatment");
assert(!/\.variant-card\.is-mockup img\s*\{[^}]*transform:/s.test(seoCss), "seo.css: product mockups are centered without artificial crop scaling");
assert(/\.variant-gallery\.variant-count-2\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.78fr\) minmax\(0,\s*1\.22fr\);/s.test(seoCss), "seo.css: single-artwork detail pages make the product mockup the visual focus");
assert(/\.variant-gallery\.has-multiple:not\(\.variant-count-2\) \.variant-card\.is-mockup\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s.test(seoCss), "seo.css: multi-artwork detail pages center the product mockup across the gallery");
assert(!seoCss.includes("-webkit-line-clamp"), "seo.css: collection copy is never truncated");

const designs = parseJson("data/designs.json");
if (designs) {
  assert(Array.isArray(designs) && designs.length === 55, "data/designs.json: exactly 55 catalog items");
  const ids = designs.map((design) => design.id);
  const liveDesigns = designs.filter((design) => design.status === "live");
  const qualityHolds = designs.filter((design) => design.status === "quality-hold");
  assert(ids.length === new Set(ids).size, "data/designs.json: design IDs unique");
  assert(liveDesigns.length > 0, "data/designs.json: quality-approved designs remain publishable");
  assert(qualityHolds.length > 0, "data/designs.json: incomplete artwork is explicitly quality-held");
  for (const design of designs) {
    assert(["live", "quality-hold"].includes(design.status), "design " + design.id + ": supported publication status");
    assert(design.description.includes(EXPECTED_BRAND), "design " + design.id + ": exact brand in description");
    for (const field of ["image", "thumbnail", "mockupImage"]) {
      assert(typeof design[field] === "string" && existsSync(resolve(ROOT, design[field])), "design " + design.id + ": " + field + " exists");
    }
  }
  const cards = htmlCache.get("designs.html").match(/<article\b[^>]*\bdata-design-card\b[^>]*>/gi) || [];
  assert(cards.length === liveDesigns.length, "designs.html: only quality-approved design cards are rendered");
  const cardIds = cards.map((card) => (card.match(/\bid=["']([^"']+)["']/i) || [])[1]).filter(Boolean);
  const liveIds = liveDesigns.map((design) => design.id);
  assert(cardIds.length === liveDesigns.length && cardIds.every((id) => liveIds.some((designId) => id.endsWith(designId))), "designs.html: every rendered card maps to a quality-approved catalog item");
  for (const design of qualityHolds) {
    assert(!htmlCache.get("designs.html").includes(design.thumbnail), "designs.html: quality-held thumbnail is not published " + design.id);
    assert(!htmlCache.get("designs.html").includes(design.image), "designs.html: quality-held artwork is not published " + design.id);
    assert(!htmlCache.get("designs.html").includes(design.mockupImage), "designs.html: quality-held mockup is not published " + design.id);
  }
}

const assetRegistry = parseJson("docs/migration/asset-registry.json");
if (assetRegistry && designs) {
  assert(assetRegistry.schemaVersion === "1.0.0", "asset registry: schema version");
  assert(assetRegistry.brand === EXPECTED_BRAND, "asset registry: exact brand");
  assert(assetRegistry.designCount === 55 && assetRegistry.designs.length === 55, "asset registry: 55 design records");
  assert(assetRegistry.assetCount >= 166, "asset registry: baseline catalog assets plus approved brand assets");
  let countedAssets = 0;
  for (const registered of assetRegistry.designs) {
    const design = designs.find((item) => item.id === registered.designId);
    assert(Boolean(design), "asset registry: catalog match for " + registered.designId);
    assert(Array.isArray(registered.visibleText) && registered.visibleText.length > 0, "asset registry: visible text for " + registered.designId);
    assert(typeof registered.visibleTextBasis === "string" && registered.visibleTextBasis.length > 0, "asset registry: visible text basis for " + registered.designId);
    assert(design && registered.publicationStatus === design.status, "asset registry: publication status for " + registered.designId);
    assert(Array.isArray(registered.variants) && registered.variants.length === 3, "asset registry: three variants for " + registered.designId);
    for (const variant of registered.variants) {
      countedAssets += 1;
      const full = resolve(ROOT, variant.path);
      assert(existsSync(full), "asset registry: file exists " + variant.path);
      if (!existsSync(full)) continue;
      const dimensions = imageDimensions(full);
      assert(dimensions.width === variant.dimensions.width && dimensions.height === variant.dimensions.height, "asset registry: dimensions match " + variant.path);
      assert(statSync(full).size === variant.sizeBytes, "asset registry: byte size matches " + variant.path);
      assert(sha256(full) === variant.sha256, "asset registry: SHA-256 matches " + variant.path);
    }
  }
  for (const asset of assetRegistry.standaloneAssets || []) {
    countedAssets += 1;
    const full = resolve(ROOT, asset.path);
    assert(existsSync(full), "asset registry: standalone file exists " + asset.path);
    if (!existsSync(full)) continue;
    const dimensions = imageDimensions(full);
    const registryBytesMatch = assetByteCandidates(full).some(
      (bytes) => bytes.length === asset.sizeBytes && createHash("sha256").update(bytes).digest("hex") === asset.sha256,
    );
    assert(dimensions.width === asset.dimensions.width && dimensions.height === asset.dimensions.height, "asset registry: standalone dimensions match " + asset.path);
    assert(registryBytesMatch, "asset registry: standalone canonical size matches " + asset.path);
    assert(registryBytesMatch, "asset registry: standalone canonical SHA-256 matches " + asset.path);
    assert(Array.isArray(asset.visibleText), "asset registry: standalone visible text recorded " + asset.path);
    assert(typeof asset.publicationStatus === "string", "asset registry: standalone publication status recorded " + asset.path);
  }
  assert(countedAssets === assetRegistry.assetCount, "asset registry: asset count reconciles");
}

const reconstruction = parseJson("docs/migration/reconstruction-manifest.json");
if (reconstruction) {
  const entries = reconstruction.entries || [];
  assert(reconstruction.schemaVersion === "1.0.0", "reconstruction manifest: schema version");
  assert(entries.length === 792 && reconstruction.summary.totalPaths === 792, "reconstruction manifest: 792 dirty paths classified");
  assert(new Set(entries.map((entry) => entry.path)).size === 792, "reconstruction manifest: dirty paths unique");
  const included = entries.filter((entry) => entry.includeDecision === "include");
  const excluded = entries.filter((entry) => entry.includeDecision === "exclude");
  assert(included.length === 7 && excluded.length === 785, "reconstruction manifest: include/exclude totals");
  assert(entries.filter((entry) => entry.sourceStatus === "modified").length === 9, "reconstruction manifest: 9 modified paths");
  assert(entries.filter((entry) => entry.sourceStatus === "untracked").length === 783, "reconstruction manifest: 783 untracked paths");
  for (const entry of entries) {
    assert(typeof entry.rationale === "string" && entry.rationale.length > 0, "reconstruction entry rationale: " + entry.path);
    assert(typeof entry.reconstructionMethod === "string" && entry.reconstructionMethod.length > 0, "reconstruction entry method: " + entry.path);
    assert(Array.isArray(entry.validation) && entry.validation.length > 0, "reconstruction entry validation: " + entry.path);
    const sourceHash = entry.hashes && entry.hashes.sourceSha256;
    assert(sourceHash === null || /^[a-f0-9]{64}$/.test(sourceHash), "reconstruction entry safe source hash: " + entry.path);
    if (entry.includeDecision === "include") {
      const full = resolve(ROOT, entry.path);
      assert(existsSync(full), "reconstruction included file exists: " + entry.path);
      assert(entry.hashes.reconstructedSha256 === sha256(full), "reconstruction included hash matches: " + entry.path);
    } else {
      assert(entry.hashes.reconstructedSha256 === null, "reconstruction excluded path was not copied: " + entry.path);
    }
  }
}

const sitemap = read("sitemap.xml");
const sitemapUrls = Array.from(sitemap.matchAll(/<loc>(https:\/\/[^<]+)<\/loc>/g), (match) => match[1]);
assert(sitemapUrls.length > 0 && sitemapUrls.length === new Set(sitemapUrls).size, "sitemap.xml: unique HTTPS locations");
assert(sitemapUrls.every((url) => url.startsWith(EXPECTED_SITE_ORIGIN + "/")), "sitemap.xml: all locations use the NumberNinjaDesigns domain");
assert(read("robots.txt").includes("Sitemap: " + EXPECTED_SITE_ORIGIN + "/sitemap.xml"), "robots.txt: canonical sitemap declared");

const vercelConfig = parseJson("vercel.json");
if (vercelConfig) {
  const expectedRedirectHosts = ["numberninjadesigns.com", "ninjanumbertees.com", "www.ninjanumbertees.com"];
  const redirects = Array.isArray(vercelConfig.redirects) ? vercelConfig.redirects : [];
  for (const host of expectedRedirectHosts) {
    const redirect = redirects.find((item) => Array.isArray(item.has) && item.has.some((condition) => condition.type === "host" && condition.value === host));
    assert(Boolean(redirect), "vercel.json: redirect registered for " + host);
    assert(Boolean(redirect) && redirect.destination === EXPECTED_SITE_ORIGIN + "/:path*" && redirect.permanent === true, "vercel.json: " + host + " permanently redirects to the canonical identity");
  }
}

console.log("Website cutover validation");
console.log("PASS assertions: " + passes.length);
if (failures.length) {
  console.error("FAIL assertions: " + failures.length);
  for (const failure of failures) console.error("- " + failure);
  process.exitCode = 1;
} else {
  console.log("FAIL assertions: 0");
  console.log("Result: PASS");
}
