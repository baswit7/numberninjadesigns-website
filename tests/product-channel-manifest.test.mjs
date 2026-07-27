import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateContentHash,
  validateManifest,
  validateRepository
} from "../scripts/validation/validate-product-channel-manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(path.join(root, "data", "product-channel-manifest.json"), "utf8")
);
const copyManifest = () => structuredClone(manifest);

test("canonical product-channel manifest validates against public product facts", async () => {
  const result = await validateRepository();
  assert.deepEqual(result.errors, []);
  assert.equal(result.productCount, 3);
});

test("unsupported locale/market combinations are rejected", () => {
  const candidate = copyManifest();
  candidate.products[0].market = "DE";
  candidate.products[0].pinterest.market = "DE";
  candidate.products[0].release.contentHash = calculateContentHash(candidate.products[0]);
  assert.ok(validateManifest(candidate).some((error) => error.includes("unsupported locale/market")));
});

test("stale hashes and unapproved indexing fail closed", () => {
  const stale = copyManifest();
  stale.products[0].site.title = "Changed after approval";
  assert.ok(validateManifest(stale).some((error) => error.includes("contentHash")));

  const unapproved = copyManifest();
  unapproved.products[0].release.indexingApproved = false;
  unapproved.products[0].release.contentHash = calculateContentHash(unapproved.products[0]);
  const errors = validateManifest(unapproved);
  assert.ok(errors.some((error) => error.includes("cannot be indexable")));
  assert.ok(errors.some((error) => error.includes("cannot be in the sitemap")));
});

test("provider publication and Pinterest channel selection remain explicitly gated", () => {
  const provider = copyManifest();
  provider.products[0].etsy.publicationEnabled = true;
  provider.products[0].release.contentHash = calculateContentHash(provider.products[0]);
  assert.ok(validateManifest(provider).some((error) => error.includes("cannot enable provider publication")));

  const channel = copyManifest();
  channel.products[0].pinterest.locale = "de-DE";
  channel.products[0].pinterest.market = "DE";
  channel.products[0].release.contentHash = calculateContentHash(channel.products[0]);
  assert.ok(validateManifest(channel).some((error) => error.includes("Pinterest channel must match")));
});
