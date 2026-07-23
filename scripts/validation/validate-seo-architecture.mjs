import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ORIGIN = "https://www.numberninjadesigns.com";
const GENERATED_DATE = "2026-07-23";
const failures = [];
let assertions = 0;

function assert(condition, message) {
  assertions += 1;
  if (!condition) failures.push(message);
}

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function repoPath(absolutePath) {
  return relative(ROOT, absolutePath).replaceAll("\\", "/");
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  const results = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) results.push(...walk(path));
    else results.push(path);
  }
  return results;
}

function firstMatch(source, expression) {
  return expression.exec(source)?.[1]?.trim() || "";
}

function stripMarkup(value) {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|#38);/gi, "&")
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function attributeValues(source, attribute) {
  const values = [];
  const expression = new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, "gis");
  let match;
  while ((match = expression.exec(source))) values.push(match[2]);
  return values;
}

function tagAttribute(source, tag, attribute) {
  return firstMatch(source, new RegExp(`<${tag}\\b[^>]*\\b${attribute}\\s*=\\s*["']([^"']+)["'][^>]*>`, "i"));
}

function metaContent(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return firstMatch(source, new RegExp(`<meta\\b(?=[^>]*\\bname\\s*=\\s*["']${escaped}["'])[^>]*\\bcontent\\s*=\\s*["']([^"']*)["'][^>]*>`, "i"));
}

function canonicalOf(source) {
  return firstMatch(source, /<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/i);
}

function titleOf(source) {
  return stripMarkup(firstMatch(source, /<title>([\s\S]*?)<\/title>/i));
}

function h1Values(source) {
  const values = [];
  const expression = /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi;
  let match;
  while ((match = expression.exec(source))) values.push(stripMarkup(match[1]));
  return values;
}

function idsOf(source) {
  return new Set(attributeValues(source, "id"));
}

function localTarget(fromFile, rawUrl) {
  const normalized = rawUrl.trim();
  if (!normalized || /^(?:mailto:|tel:|data:|javascript:)/i.test(normalized)) return null;

  let urlPath = normalized;
  let fragment = "";
  if (/^https?:\/\//i.test(normalized)) {
    const parsed = new URL(normalized);
    if (parsed.origin !== ORIGIN) return null;
    urlPath = parsed.pathname;
    fragment = parsed.hash.slice(1);
  } else {
    const hashIndex = urlPath.indexOf("#");
    if (hashIndex >= 0) {
      fragment = urlPath.slice(hashIndex + 1);
      urlPath = urlPath.slice(0, hashIndex);
    }
    urlPath = urlPath.split("?")[0];
  }

  let target;
  if (!urlPath) target = fromFile;
  else if (urlPath.startsWith("/")) target = resolve(ROOT, `.${urlPath}`);
  else target = resolve(dirname(fromFile), urlPath);

  if (urlPath.endsWith("/") || (existsSync(target) && statSync(target).isDirectory())) {
    target = resolve(target, "index.html");
  }

  return { target, fragment: decodeURIComponent(fragment) };
}

function allSchemaTypes(value, output = []) {
  if (Array.isArray(value)) {
    for (const child of value) allSchemaTypes(child, output);
  } else if (value && typeof value === "object") {
    if (typeof value["@type"] === "string") output.push(value["@type"]);
    for (const child of Object.values(value)) allSchemaTypes(child, output);
  }
  return output;
}

const catalog = json("data/designs.json");
const seo = json("data/seo-content.json");
const sourceGroups = new Map();
const publishedGroups = new Map();
for (const design of catalog) {
  if (!sourceGroups.has(design.slug)) sourceGroups.set(design.slug, []);
  sourceGroups.get(design.slug).push(design);
  if (design.status === "live") {
    if (!publishedGroups.has(design.slug)) publishedGroups.set(design.slug, []);
    publishedGroups.get(design.slug).push(design);
  }
}

const collectionSlugs = Object.values(seo.collections).map((collection) => collection.slug);
const guideSlugs = seo.guides.map((guide) => guide.slug);
const sourceConceptSlugs = [...sourceGroups.keys()];
const publishedConceptSlugs = [...publishedGroups.keys()];

assert(catalog.length === 55, `Catalog must contain 55 variants; found ${catalog.length}.`);
assert(sourceGroups.size === 45, `Catalog must resolve to 45 source concepts; found ${sourceGroups.size}.`);
assert(Object.keys(seo.products).length === sourceGroups.size, "Every source concept needs exactly one curated SEO copy record.");
assert(new Set(Object.keys(seo.products)).size === sourceGroups.size, "SEO product slugs must be unique.");
assert(publishedGroups.size > 0, "At least one quality-approved concept must be published.");
assert(Object.values(seo.collections).length === 6, "Exactly six topical collections are required.");
assert(new Set(collectionSlugs).size === collectionSlugs.length, "Collection slugs must be unique.");
assert(new Set(guideSlugs).size === guideSlugs.length, "Guide slugs must be unique.");

for (const slug of sourceConceptSlugs) {
  assert(Boolean(seo.products[slug]), `Missing curated SEO copy for ${slug}.`);
  const category = sourceGroups.get(slug)[0].category;
  assert(Boolean(seo.collections[category]), `Missing collection mapping for ${category}.`);
}

const conceptFiles = walk(resolve(ROOT, "designs")).filter((path) => extname(path) === ".html");
const collectionFiles = walk(resolve(ROOT, "collections")).filter((path) => extname(path) === ".html");
const guideFiles = walk(resolve(ROOT, "guides")).filter((path) => extname(path) === ".html");
assert(conceptFiles.length === publishedGroups.size, `Expected ${publishedGroups.size} quality-approved concept pages; found ${conceptFiles.length}.`);
assert(collectionFiles.length === 7, `Expected 7 generated collection pages; found ${collectionFiles.length}.`);
assert(guideFiles.length === 4, `Expected 4 generated guide pages; found ${guideFiles.length}.`);

for (const slug of publishedConceptSlugs) assert(existsSync(resolve(ROOT, "designs", slug, "index.html")), `Missing quality-approved concept page: ${slug}.`);
for (const slug of sourceConceptSlugs.filter((slug) => !publishedGroups.has(slug))) {
  assert(!existsSync(resolve(ROOT, "designs", slug, "index.html")), `Quality-held concept page must not be generated: ${slug}.`);
}
for (const slug of collectionSlugs) assert(existsSync(resolve(ROOT, "collections", slug, "index.html")), `Missing collection page: ${slug}.`);
for (const slug of guideSlugs) assert(existsSync(resolve(ROOT, "guides", slug, "index.html")), `Missing guide page: ${slug}.`);

const rootHtml = readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
  .map((entry) => resolve(ROOT, entry.name));
const callbackHtml = walk(resolve(ROOT, "tiktok")).filter((path) => extname(path) === ".html");
const publicHtml = [...rootHtml, ...conceptFiles, ...collectionFiles, ...guideFiles, ...callbackHtml];
const publicSource = publicHtml.map((file) => readFileSync(file, "utf8")).join("\n");
for (const design of catalog.filter((item) => item.status === "quality-hold")) {
  assert(!publicSource.includes(design.thumbnail), `Quality-held thumbnail must not be published: ${design.id}.`);
  assert(!publicSource.includes(design.image), `Quality-held artwork must not be published: ${design.id}.`);
  assert(!publicSource.includes(design.mockupImage), `Quality-held mockup must not be published: ${design.id}.`);
}
const indexableCanonicals = new Map();
const titleOwners = new Map();
const descriptionOwners = new Map();

for (const file of publicHtml) {
  const relativePath = repoPath(file);
  const source = readFileSync(file, "utf8");
  const title = titleOf(source);
  const description = metaContent(source, "description");
  const robots = metaContent(source, "robots").toLowerCase();
  const canonical = canonicalOf(source);
  const h1s = h1Values(source);
  const isCallback = relativePath.startsWith("tiktok/");
  const is404 = relativePath === "404.html";
  const indexable = !robots.includes("noindex") && !isCallback && !is404;

  assert(Boolean(title), `${relativePath}: missing title.`);
  assert(h1s.length === 1, `${relativePath}: expected exactly one H1; found ${h1s.length}.`);
  if (!isCallback) assert(Boolean(description), `${relativePath}: missing meta description.`);
  assert(!/(?:TODO|lorem ipsum|placeholder)/i.test(stripMarkup(source)), `${relativePath}: contains unfinished placeholder language.`);
  assert(!/(?:NumberNinjaTees|NinjaNumberTees|ninjanumbertees\.com|numberninjatees\.github\.io)/i.test(source), `${relativePath}: contains legacy identity.`);

  if (indexable) {
    assert(canonical.startsWith(`${ORIGIN}/`), `${relativePath}: indexable page has an invalid canonical.`);
    assert(!robots.includes("nofollow"), `${relativePath}: indexable page must allow link following.`);
    assert(title.length >= 20 && title.length <= 75, `${relativePath}: title length ${title.length} is outside 20–75 characters.`);
    assert(description.length >= 100 && description.length <= 190, `${relativePath}: description length ${description.length} is outside 100–190 characters.`);
    assert(!indexableCanonicals.has(canonical), `${relativePath}: duplicate canonical also used by ${indexableCanonicals.get(canonical)}.`);
    indexableCanonicals.set(canonical, relativePath);
    assert(!titleOwners.has(title), `${relativePath}: duplicate title also used by ${titleOwners.get(title)}.`);
    titleOwners.set(title, relativePath);
    assert(!descriptionOwners.has(description), `${relativePath}: duplicate description also used by ${descriptionOwners.get(description)}.`);
    descriptionOwners.set(description, relativePath);
  }

  const schemas = [];
  const schemaExpression = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let schemaMatch;
  while ((schemaMatch = schemaExpression.exec(source))) {
    try {
      schemas.push(JSON.parse(schemaMatch[1]));
    } catch (error) {
      failures.push(`${relativePath}: invalid JSON-LD: ${error.message}`);
    }
  }
  if (indexable && relativePath !== "about.html" && relativePath !== "contact.html") {
    assert(schemas.length > 0, `${relativePath}: indexable content page needs JSON-LD.`);
  }

  for (const rawUrl of [...attributeValues(source, "href"), ...attributeValues(source, "src")]) {
    const resolved = localTarget(file, rawUrl);
    if (!resolved) continue;
    assert(existsSync(resolved.target), `${relativePath}: broken local reference ${rawUrl} -> ${repoPath(resolved.target)}.`);
    if (existsSync(resolved.target) && resolved.fragment && extname(resolved.target) === ".html") {
      const targetSource = readFileSync(resolved.target, "utf8");
      assert(idsOf(targetSource).has(resolved.fragment), `${relativePath}: missing fragment #${resolved.fragment} in ${repoPath(resolved.target)}.`);
    }
  }

  for (const imageTag of source.match(/<img\b[^>]*>/gi) || []) {
    assert(/\balt\s*=\s*["'][^"']*["']/i.test(imageTag), `${relativePath}: image is missing alt text.`);
    assert(/\bwidth\s*=\s*["']\d+["']/i.test(imageTag) && /\bheight\s*=\s*["']\d+["']/i.test(imageTag), `${relativePath}: image is missing intrinsic dimensions.`);
  }
}

for (const file of conceptFiles) {
  const relativePath = repoPath(file);
  const slug = relativePath.split("/")[1];
  const source = readFileSync(file, "utf8");
  const group = publishedGroups.get(slug);
  const collection = seo.collections[group[0].category];
  const schemaTypes = [];
  const schemaExpression = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = schemaExpression.exec(source))) allSchemaTypes(JSON.parse(match[1]), schemaTypes);
  assert(source.includes(seo.products[slug].hook), `${relativePath}: curated hook is not rendered.`);
  assert(source.includes(`collections/${collection.slug}/`), `${relativePath}: missing parent collection link.`);
  assert(source.includes(`search_query=${encodeURIComponent(group[0].title).replaceAll("%20", "%20")}`), `${relativePath}: missing focused Etsy search.`);
  assert(schemaTypes.includes("VisualArtwork"), `${relativePath}: missing VisualArtwork entity.`);
  assert(schemaTypes.includes("BreadcrumbList"), `${relativePath}: missing BreadcrumbList entity.`);
  assert(!schemaTypes.includes("Offer"), `${relativePath}: must not publish an Offer without verified listing data.`);
  assert(!/"price"\s*:|availability\s*":/i.test(source), `${relativePath}: must not fabricate price or stock schema.`);
  assert((source.match(/class="variant-card(?:\s|")/g) || []).length === group.length + 1, `${relativePath}: expected every artwork variant plus one product mockup.`);
  assert((source.match(/class="variant-card is-artwork"/g) || []).length === group.length, `${relativePath}: rendered artwork count does not match catalog.`);
  assert((source.match(/class="variant-card is-mockup"/g) || []).length === 1, `${relativePath}: expected exactly one product mockup.`);
}

for (const file of collectionFiles.filter((path) => repoPath(path) !== "collections/index.html")) {
  const relativePath = repoPath(file);
  const slug = relativePath.split("/")[1];
  const source = readFileSync(file, "utf8");
  const collection = Object.values(seo.collections).find((candidate) => candidate.slug === slug);
  const expectedConcepts = [...publishedGroups.values()].filter((variants) => variants[0].category === Object.keys(seo.collections).find((key) => seo.collections[key].slug === slug)).length;
  assert(Boolean(collection), `${relativePath}: unknown collection.`);
  assert((source.match(/class="concept-card"/g) || []).length === expectedConcepts, `${relativePath}: concept count does not match catalog.`);
  assert((source.match(/<details>/g) || []).length === 3, `${relativePath}: collection must render three useful FAQ answers.`);
}

for (const file of guideFiles.filter((path) => repoPath(path) !== "guides/index.html")) {
  const relativePath = repoPath(file);
  const source = readFileSync(file, "utf8");
  const mainArticle = firstMatch(source, /<article\b[^>]*class\s*=\s*["']guide-layout["'][^>]*>([\s\S]*?)<\/article>/i);
  const wordCount = stripMarkup(mainArticle).split(/\s+/).filter(Boolean).length;
  assert(wordCount >= 500, `${relativePath}: guide is too thin at ${wordCount} words; minimum is 500.`);
  assert((source.match(/<section id="section-/g) || []).length >= 4, `${relativePath}: guide needs at least four substantive sections.`);
  assert(source.includes("Marketplace availability") || source.includes("Etsy is the current source"), `${relativePath}: missing marketplace disclosure.`);
}

const noindexFiles = ["privacy.html", "terms.html", "data-deletion.html", "developer.html", "budget-planner-basic.html", "404.html", "tiktok/callback/index.html"];
for (const relativePath of noindexFiles) {
  const source = read(relativePath);
  assert(metaContent(source, "robots").toLowerCase().includes("noindex"), `${relativePath}: expected noindex directive.`);
}

const sitemapSource = read("sitemap.xml");
const sitemapLocs = [...sitemapSource.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].replaceAll("&amp;", "&"));
const sitemapLastmods = [...sitemapSource.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map((match) => match[1]);
assert(sitemapLocs.length === indexableCanonicals.size, `Sitemap must contain all ${indexableCanonicals.size} indexable URLs; found ${sitemapLocs.length}.`);
assert(new Set(sitemapLocs).size === sitemapLocs.length, "Sitemap contains duplicate URLs.");
assert(sitemapLastmods.length === sitemapLocs.length, "Every sitemap URL needs a lastmod.");
assert(sitemapLastmods.every((value) => value === GENERATED_DATE), `Every sitemap lastmod must be ${GENERATED_DATE}.`);
assert(sitemapLocs.every((value) => value.startsWith(`${ORIGIN}/`)), "Sitemap contains a foreign or non-canonical origin.");
assert(sitemapLocs.length === indexableCanonicals.size, `Sitemap/indexable canonical count mismatch: ${sitemapLocs.length} vs ${indexableCanonicals.size}.`);
for (const canonical of indexableCanonicals.keys()) assert(sitemapLocs.includes(canonical), `Sitemap is missing indexable canonical ${canonical}.`);
for (const location of sitemapLocs) assert(indexableCanonicals.has(location), `Sitemap contains a non-indexable URL: ${location}.`);
for (const relativePath of noindexFiles) {
  const canonical = canonicalOf(read(relativePath));
  if (canonical) assert(!sitemapLocs.includes(canonical), `Sitemap must exclude noindex page ${relativePath}.`);
}

assert(read("robots.txt").includes(`Sitemap: ${ORIGIN}/sitemap.xml`), "robots.txt must advertise the canonical sitemap.");
assert(!/Disallow:\s*\//i.test(read("robots.txt")), "robots.txt must not block site crawling.");

const vercel = json("vercel.json");
const securityHeaders = new Map(vercel.headers?.[0]?.headers?.map((entry) => [entry.key.toLowerCase(), entry.value]) || []);
for (const header of ["x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"]) {
  assert(securityHeaders.has(header), `vercel.json is missing security header ${header}.`);
}
assert(vercel.headers.some((rule) => rule.headers?.some((entry) => entry.key === "X-Robots-Tag" && entry.value.includes("noindex"))), "TikTok callback needs an HTTP noindex fallback.");

if (failures.length) {
  console.error(`SEO architecture validation FAILED: ${failures.length} failure(s), ${assertions} assertions.`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`SEO architecture validation passed: ${assertions} assertions across ${publicHtml.length} HTML pages and ${sitemapLocs.length} sitemap URLs.`);
