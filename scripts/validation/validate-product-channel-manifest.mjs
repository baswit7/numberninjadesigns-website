import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const canonicalHost = "https://www.numberninjadesigns.com";
const schemaUrl = `${canonicalHost}/data/product-channel-manifest.schema.json`;
const channelMarkets = new Map([
  ["en-US", "US"],
  ["de-DE", "DE"]
]);

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function contentProjection(product) {
  return {
    productId: product.productId,
    productVersion: product.productVersion,
    locale: product.locale,
    market: product.market,
    site: product.site,
    release: {
      status: product.release?.status,
      ownerApproved: product.release?.ownerApproved,
      indexingApproved: product.release?.indexingApproved,
      providerPublicationAllowed: product.release?.providerPublicationAllowed
    },
    etsy: product.etsy,
    pinterest: product.pinterest
  };
}

export function calculateContentHash(product) {
  return createHash("sha256")
    .update(stableStringify(contentProjection(product)), "utf8")
    .digest("hex");
}

function checkObject(value, location, keys, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${location} must be an object`);
    return false;
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) errors.push(`${location}.${key} is required`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) errors.push(`${location}.${key} is not allowed`);
  }
  return true;
}

function checkNullableId(value, location, errors) {
  if (value !== null && (typeof value !== "string" || !/^[0-9]+$/.test(value))) {
    errors.push(`${location} must be null or a numeric provider identifier`);
  }
}

function checkNullableUrl(value, location, errors) {
  if (value === null) return;
  try {
    if (new URL(value).protocol !== "https:") errors.push(`${location} must use HTTPS`);
  } catch {
    errors.push(`${location} must be null or an absolute URL`);
  }
}

export function validateManifest(manifest) {
  const errors = [];
  const topKeys = ["$schema", "schemaVersion", "canonicalHost", "products"];
  if (!checkObject(manifest, "manifest", topKeys, errors)) return errors;
  if (manifest.$schema !== schemaUrl) errors.push("manifest.$schema is not canonical");
  if (manifest.schemaVersion !== "1.0.0") errors.push("manifest.schemaVersion must be 1.0.0");
  if (manifest.canonicalHost !== canonicalHost) errors.push("manifest.canonicalHost is not canonical");
  if (!Array.isArray(manifest.products) || manifest.products.length === 0) {
    errors.push("manifest.products must be a non-empty array");
    return errors;
  }

  const productIds = new Set();
  for (const [index, product] of manifest.products.entries()) {
    const location = `manifest.products[${index}]`;
    const productKeys = [
      "productId",
      "productVersion",
      "locale",
      "market",
      "site",
      "release",
      "etsy",
      "pinterest"
    ];
    if (!checkObject(product, location, productKeys, errors)) continue;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.productId || "")) {
      errors.push(`${location}.productId is invalid`);
    }
    if (productIds.has(product.productId)) errors.push(`${location}.productId is duplicated`);
    productIds.add(product.productId);
    if (!/^\d+\.\d+\.\d+$/.test(product.productVersion || "")) {
      errors.push(`${location}.productVersion must be semantic version x.y.z`);
    }
    if (channelMarkets.get(product.locale) !== product.market) {
      errors.push(`${location} has an unsupported locale/market channel`);
    }

    const siteKeys = ["canonicalUrl", "title", "description", "indexable", "sitemapIncluded"];
    checkObject(product.site, `${location}.site`, siteKeys, errors);
    try {
      const url = new URL(product.site?.canonicalUrl);
      if (url.origin !== canonicalHost || !/\/[a-z0-9-]+\.html$/.test(url.pathname)) {
        errors.push(`${location}.site.canonicalUrl must be a canonical product page`);
      }
    } catch {
      errors.push(`${location}.site.canonicalUrl must be an absolute URL`);
    }

    const releaseKeys = [
      "status",
      "ownerApproved",
      "indexingApproved",
      "providerPublicationAllowed",
      "contentHash"
    ];
    checkObject(product.release, `${location}.release`, releaseKeys, errors);
    const validHash =
      /^[a-f0-9]{64}$/.test(product.release?.contentHash || "") &&
      product.release.contentHash === calculateContentHash(product);
    if (!validHash) errors.push(`${location}.release.contentHash does not match the current content`);

    const etsyKeys = ["publicationEnabled", "listingId", "listingUrl"];
    checkObject(product.etsy, `${location}.etsy`, etsyKeys, errors);
    checkNullableId(product.etsy?.listingId, `${location}.etsy.listingId`, errors);
    checkNullableUrl(product.etsy?.listingUrl, `${location}.etsy.listingUrl`, errors);

    const pinterestKeys = ["publicationEnabled", "locale", "market", "boardId", "pinId", "pinUrl"];
    checkObject(product.pinterest, `${location}.pinterest`, pinterestKeys, errors);
    if (product.pinterest?.locale !== product.locale || product.pinterest?.market !== product.market) {
      errors.push(`${location}.Pinterest channel must match the product locale/market`);
    }
    checkNullableId(product.pinterest?.boardId, `${location}.pinterest.boardId`, errors);
    checkNullableId(product.pinterest?.pinId, `${location}.pinterest.pinId`, errors);
    checkNullableUrl(product.pinterest?.pinUrl, `${location}.pinterest.pinUrl`, errors);

    if (product.site?.indexable && !(product.release?.ownerApproved && product.release?.indexingApproved && validHash)) {
      errors.push(`${location} cannot be indexable without explicit approval and a valid hash`);
    }
    if (product.site?.sitemapIncluded && !(product.site?.indexable && product.release?.indexingApproved)) {
      errors.push(`${location} cannot be in the sitemap unless explicitly indexable`);
    }
    const providerEnabled =
      product.etsy?.publicationEnabled === true || product.pinterest?.publicationEnabled === true;
    if (
      providerEnabled &&
      !(product.release?.ownerApproved && product.release?.providerPublicationAllowed && validHash)
    ) {
      errors.push(`${location} cannot enable provider publication without explicit approval and a valid hash`);
    }
  }
  return errors;
}

export async function validateRepository() {
  const [manifest, schema, sitemap] = await Promise.all([
    readFile(path.join(root, "data", "product-channel-manifest.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "data", "product-channel-manifest.schema.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "sitemap.xml"), "utf8")
  ]);
  const errors = validateManifest(manifest);
  try {
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(schema.$id, schemaUrl);
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.$defs.product.additionalProperties, false);
  } catch (error) {
    errors.push(`schema contract is invalid: ${error.message}`);
  }

  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  for (const product of manifest.products) {
    const pagePath = new URL(product.site.canonicalUrl).pathname.slice(1);
    const html = await readFile(path.join(root, pagePath), "utf8");
    if (!html.includes(`<title>${product.site.title}</title>`)) {
      errors.push(`${product.productId} title differs from its public page`);
    }
    if (!html.includes(`content="${product.site.description}"`)) {
      errors.push(`${product.productId} description differs from its public page`);
    }
    const occurrences = sitemapUrls.filter((url) => url === product.site.canonicalUrl).length;
    if (product.site.sitemapIncluded ? occurrences !== 1 : occurrences !== 0) {
      errors.push(`${product.productId} sitemap state differs from its manifest`);
    }
  }
  return { errors, productCount: manifest.products.length, sitemapUrlCount: sitemapUrls.length };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const result = await validateRepository();
  if (result.errors.length > 0) {
    for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `${JSON.stringify({
        valid: true,
        schemaVersion: "1.0.0",
        products: result.productCount,
        sitemapUrls: result.sitemapUrlCount
      })}\n`
    );
  }
}
