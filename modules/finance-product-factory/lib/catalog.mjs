import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CANONICAL_SCHEMA_VERSION = "1.0.0";
export const PRODUCT_VERSION = "1.0.1";

export const PROVIDER_DISABLED_DEFAULTS = Object.freeze({
  enabled: false,
  adapter: null,
  externalListingId: null,
  syncState: "not-configured"
});

export const EXPECTED_PRODUCTS = Object.freeze({
  "budget-planner-basic": Object.freeze({
    slug: "budget-planner-basic",
    productId: "numberninja-budget-planner-v1",
    sku: "NND-DIG-FIN-001",
    route: "budget-planner-basic.html"
  }),
  "debt-payoff-tracker": Object.freeze({
    slug: "debt-payoff-tracker",
    productId: "numberninja-debt-payoff-tracker-v1",
    sku: "NND-DIG-FIN-002",
    route: "debt-payoff-tracker.html"
  }),
  "net-worth-tracker": Object.freeze({
    slug: "net-worth-tracker",
    productId: "numberninja-net-worth-tracker-v1",
    sku: "NND-DIG-FIN-003",
    route: "net-worth-tracker.html"
  })
});

export const PUBLIC_PRODUCT_KEYS = Object.freeze([
  "id",
  "slug",
  "productId",
  "sku",
  "version",
  "name",
  "status",
  "statusLabel",
  "type",
  "shortDescription",
  "targetAudience",
  "features",
  "sheets",
  "formulaFamilies",
  "compatibility",
  "availability",
  "detailHref",
  "pricingRationale",
  "ownerPricing",
  "cta"
]);

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const productsDirectory = join(moduleRoot, "products");
export const repositoryRoot = resolve(moduleRoot, "..", "..");
export const defaultCatalogTarget = join(repositoryRoot, "data", "products.js");

const topLevelKeys = [
  "schemaVersion",
  "productVersion",
  "identity",
  "organization",
  "catalog",
  "workbook",
  "delivery",
  "seo",
  "instructions",
  "pricing",
  "disclosures",
  "launchState",
  "provider",
  "provenance"
];

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const skuPattern = /^NND-DIG-FIN-[0-9]{3}$/;
const routePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/;
const currencyPattern = /^[A-Z]{3}$/;
const localePattern = /^[a-z]{2}-[A-Z]{2}$/;
const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|[/\\]{2}|\/)/;
const credentialKeyPattern =
  /(?:api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|credential|authorization)/i;

export class CanonicalProductValidationError extends Error {
  constructor(source, issues) {
    super(
      `Invalid canonical finance product (${source}):\n${issues
        .map((issue) => `- ${issue}`)
        .join("\n")}`
    );
    this.name = "CanonicalProductValidationError";
    this.source = source;
    this.issues = issues;
  }
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function expectObject(value, path, keys, issues) {
  if (!isPlainObject(value)) {
    issues.push(`${path} must be an object.`);
    return null;
  }

  const expected = new Set(keys);
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) {
      issues.push(`${path}.${key} is required.`);
    }
  }
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      issues.push(`${path}.${key} is not allowed by the canonical contract.`);
    }
  }
  return value;
}

function expectExact(value, expected, path, issues) {
  if (!Object.is(value, expected)) {
    issues.push(`${path} must equal ${JSON.stringify(expected)}.`);
  }
}

function expectString(value, path, issues, pattern = null) {
  if (typeof value !== "string" || value.trim() === "") {
    issues.push(`${path} must be a non-empty string.`);
    return;
  }
  if (pattern && !pattern.test(value)) {
    issues.push(`${path} has an invalid format: ${JSON.stringify(value)}.`);
  }
}

function expectPositiveNumber(value, path, issues) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    issues.push(`${path} must be a finite number greater than zero.`);
  }
}

function expectStringArray(value, path, issues) {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(`${path} must be a non-empty array.`);
    return;
  }

  const seen = new Set();
  value.forEach((item, index) => {
    expectString(item, `${path}[${index}]`, issues);
    if (typeof item === "string" && seen.has(item)) {
      issues.push(`${path} contains duplicate value ${JSON.stringify(item)}.`);
    }
    seen.add(item);
  });
}

function rejectCredentialKeys(value, path, issues) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectCredentialKeys(item, `${path}[${index}]`, issues)
    );
    return;
  }
  if (!isPlainObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (credentialKeyPattern.test(key)) {
      issues.push(`${path}.${key} is a forbidden credential-like field.`);
    }
    rejectCredentialKeys(child, `${path}.${key}`, issues);
  }
}

function validateIdentity(record, issues) {
  const identity = expectObject(
    record.identity,
    "$.identity",
    ["id", "slug", "productId", "sku", "route"],
    issues
  );
  if (!identity) return;

  expectString(identity.id, "$.identity.id", issues, slugPattern);
  expectString(identity.slug, "$.identity.slug", issues, slugPattern);
  expectString(identity.productId, "$.identity.productId", issues, slugPattern);
  expectString(identity.sku, "$.identity.sku", issues, skuPattern);
  expectString(identity.route, "$.identity.route", issues, routePattern);

  const expected = EXPECTED_PRODUCTS[identity.id];
  if (!expected) {
    issues.push(`$.identity.id is not one of the three stable product ids.`);
    return;
  }

  for (const key of ["slug", "productId", "sku", "route"]) {
    expectExact(identity[key], expected[key], `$.identity.${key}`, issues);
  }
}

function validateOrganization(record, issues) {
  const organization = expectObject(
    record.organization,
    "$.organization",
    ["brand", "branch", "governance"],
    issues
  );
  if (!organization) return;

  expectExact(
    organization.brand,
    "NumberNinjaDesigns",
    "$.organization.brand",
    issues
  );
  expectExact(
    organization.branch,
    "Digital Production",
    "$.organization.branch",
    issues
  );
  expectExact(
    organization.governance,
    "Studio OS",
    "$.organization.governance",
    issues
  );
}

function validateCatalogFields(record, issues) {
  const catalog = expectObject(
    record.catalog,
    "$.catalog",
    [
      "name",
      "status",
      "statusLabel",
      "type",
      "shortDescription",
      "targetAudience",
      "availability",
      "cta"
    ],
    issues
  );
  if (!catalog) return;

  expectString(catalog.name, "$.catalog.name", issues);
  expectExact(catalog.status, "coming-soon", "$.catalog.status", issues);
  expectExact(
    catalog.statusLabel,
    "Coming soon",
    "$.catalog.statusLabel",
    issues
  );
  expectExact(catalog.type, "Excel workbook", "$.catalog.type", issues);
  expectString(
    catalog.shortDescription,
    "$.catalog.shortDescription",
    issues
  );
  expectString(catalog.targetAudience, "$.catalog.targetAudience", issues);
  expectExact(
    catalog.availability,
    "preview-only",
    "$.catalog.availability",
    issues
  );

  const cta = expectObject(catalog.cta, "$.catalog.cta", ["label"], issues);
  if (cta) expectString(cta.label, "$.catalog.cta.label", issues);
}

function validateWorkbook(record, issues) {
  const workbook = expectObject(
    record.workbook,
    "$.workbook",
    [
      "features",
      "sheets",
      "formulaFamilies",
      "compatibility",
      "dashboards",
      "charts"
    ],
    issues
  );
  if (!workbook) return;

  for (const key of [
    "features",
    "sheets",
    "formulaFamilies",
    "compatibility",
    "dashboards",
    "charts"
  ]) {
    expectStringArray(workbook[key], `$.workbook.${key}`, issues);
  }
}

function validateDeliveryAndSeo(record, issues) {
  const delivery = expectObject(
    record.delivery,
    "$.delivery",
    ["fileFormats", "includedFiles", "deliveryFiles"],
    issues
  );
  if (delivery) {
    for (const key of ["fileFormats", "includedFiles", "deliveryFiles"]) {
      expectStringArray(delivery[key], `$.delivery.${key}`, issues);
    }
  }

  const seo = expectObject(
    record.seo,
    "$.seo",
    ["primaryKeyword", "title", "tags"],
    issues
  );
  if (seo) {
    expectString(seo.primaryKeyword, "$.seo.primaryKeyword", issues);
    expectString(seo.title, "$.seo.title", issues);
    expectStringArray(seo.tags, "$.seo.tags", issues);
  }

  expectStringArray(record.instructions, "$.instructions", issues);
}

function validatePricing(record, issues) {
  const pricing = expectObject(
    record.pricing,
    "$.pricing",
    [
      "strategy",
      "amount",
      "currency",
      "discountFloor",
      "basis",
      "marketDataUsed",
      "rationale"
    ],
    issues
  );
  if (!pricing) return;

  expectExact(pricing.strategy, "FIXED_LAUNCH", "$.pricing.strategy", issues);
  expectPositiveNumber(pricing.amount, "$.pricing.amount", issues);
  expectString(pricing.currency, "$.pricing.currency", issues, currencyPattern);
  expectPositiveNumber(
    pricing.discountFloor,
    "$.pricing.discountFloor",
    issues
  );
  if (
    typeof pricing.amount === "number" &&
    typeof pricing.discountFloor === "number" &&
    pricing.discountFloor > pricing.amount
  ) {
    issues.push("$.pricing.discountFloor cannot exceed $.pricing.amount.");
  }
  expectExact(
    pricing.basis,
    "owner-hypothesis",
    "$.pricing.basis",
    issues
  );
  expectExact(
    pricing.marketDataUsed,
    false,
    "$.pricing.marketDataUsed",
    issues
  );
  expectString(pricing.rationale, "$.pricing.rationale", issues);
  if (
    typeof pricing.rationale === "string" &&
    !pricing.rationale.includes(
      "not derived from marketplace sales, demand, conversion, or revenue evidence"
    )
  ) {
    issues.push(
      "$.pricing.rationale must explicitly state that no marketplace evidence was used."
    );
  }
}

function validateGovernance(record, issues) {
  const disclosures = expectObject(
    record.disclosures,
    "$.disclosures",
    ["ai", "legal"],
    issues
  );
  if (disclosures) {
    expectString(disclosures.ai, "$.disclosures.ai", issues);
    expectString(disclosures.legal, "$.disclosures.legal", issues);
    if (
      typeof disclosures.ai === "string" &&
      (!disclosures.ai.includes("NumberNinjaDesigns") ||
        disclosures.ai.includes("NumberNinjaTees"))
    ) {
      issues.push(
        "$.disclosures.ai must use the NumberNinjaDesigns brand identity."
      );
    }
  }

  const launchState = expectObject(
    record.launchState,
    "$.launchState",
    ["stage", "approval", "publicationReady"],
    issues
  );
  if (launchState) {
    expectExact(
      launchState.stage,
      "quality-approved",
      "$.launchState.stage",
      issues
    );
    expectExact(
      launchState.approval,
      "owner-approved",
      "$.launchState.approval",
      issues
    );
    expectExact(
      launchState.publicationReady,
      false,
      "$.launchState.publicationReady",
      issues
    );
  }

  const provider = expectObject(
    record.provider,
    "$.provider",
    ["enabled", "adapter", "externalListingId", "syncState"],
    issues
  );
  if (provider) {
    for (const [key, expected] of Object.entries(PROVIDER_DISABLED_DEFAULTS)) {
      expectExact(provider[key], expected, `$.provider.${key}`, issues);
    }
  }
}

function validateProvenance(record, issues) {
  const provenance = expectObject(
    record.provenance,
    "$.provenance",
    [
      "sourceManifest",
      "sourceProductId",
      "sourceProductName",
      "blueprintId",
      "language",
      "locale",
      "theme",
      "generatedAt"
    ],
    issues
  );
  if (!provenance) return;

  expectString(provenance.sourceManifest, "$.provenance.sourceManifest", issues);
  if (
    typeof provenance.sourceManifest === "string" &&
    (absolutePathPattern.test(provenance.sourceManifest) ||
      !/^outputs\/finance-product-factory\/[a-z0-9-]+\/product-manifest\.json$/.test(
        provenance.sourceManifest
      ))
  ) {
    issues.push(
      "$.provenance.sourceManifest must be a repository-relative finance manifest path."
    );
  }
  expectString(
    provenance.sourceProductId,
    "$.provenance.sourceProductId",
    issues,
    slugPattern
  );
  expectString(
    provenance.sourceProductName,
    "$.provenance.sourceProductName",
    issues
  );
  expectString(
    provenance.blueprintId,
    "$.provenance.blueprintId",
    issues,
    slugPattern
  );
  expectString(provenance.language, "$.provenance.language", issues);
  expectString(
    provenance.locale,
    "$.provenance.locale",
    issues,
    localePattern
  );
  expectString(provenance.theme, "$.provenance.theme", issues);
  expectString(provenance.generatedAt, "$.provenance.generatedAt", issues);
  if (
    typeof provenance.generatedAt === "string" &&
    Number.isNaN(Date.parse(provenance.generatedAt))
  ) {
    issues.push("$.provenance.generatedAt must be a valid ISO date-time.");
  }
}

export function validateCanonicalProduct(
  record,
  { source = "<in-memory-record>" } = {}
) {
  const issues = [];
  const product = expectObject(record, "$", topLevelKeys, issues);
  if (!product) throw new CanonicalProductValidationError(source, issues);

  expectExact(
    product.schemaVersion,
    CANONICAL_SCHEMA_VERSION,
    "$.schemaVersion",
    issues
  );
  expectExact(
    product.productVersion,
    PRODUCT_VERSION,
    "$.productVersion",
    issues
  );
  rejectCredentialKeys(product, "$", issues);
  validateIdentity(product, issues);
  validateOrganization(product, issues);
  validateCatalogFields(product, issues);
  validateWorkbook(product, issues);
  validateDeliveryAndSeo(product, issues);
  validatePricing(product, issues);
  validateGovernance(product, issues);
  validateProvenance(product, issues);

  if (issues.length > 0) {
    throw new CanonicalProductValidationError(source, issues);
  }
  return product;
}

export function validateCanonicalCatalog(products) {
  if (!Array.isArray(products)) {
    throw new CanonicalProductValidationError("<catalog>", [
      "Catalog input must be an array."
    ]);
  }

  const issues = [];
  const validated = [];
  products.forEach((product, index) => {
    try {
      validated.push(
        validateCanonicalProduct(product, {
          source: product?.identity?.id ?? `record ${index}`
        })
      );
    } catch (error) {
      if (error instanceof CanonicalProductValidationError) {
        issues.push(...error.issues.map((issue) => `[record ${index}] ${issue}`));
      } else {
        throw error;
      }
    }
  });

  if (products.length !== Object.keys(EXPECTED_PRODUCTS).length) {
    issues.push(
      `Catalog must contain exactly ${Object.keys(EXPECTED_PRODUCTS).length} products; received ${products.length}.`
    );
  }

  for (const field of ["id", "slug", "productId", "sku", "route"]) {
    const seen = new Set();
    products.forEach((product, index) => {
      const value = product?.identity?.[field];
      if (seen.has(value)) {
        issues.push(
          `[record ${index}] $.identity.${field} duplicates ${JSON.stringify(value)}.`
        );
      }
      seen.add(value);
    });
  }

  const actualIds = new Set(
    products.map((product) => product?.identity?.id).filter(Boolean)
  );
  for (const id of Object.keys(EXPECTED_PRODUCTS)) {
    if (!actualIds.has(id)) issues.push(`Catalog is missing stable product ${id}.`);
  }

  if (issues.length > 0) {
    throw new CanonicalProductValidationError("<catalog>", issues);
  }
  return validated;
}

export async function readCanonicalProducts({
  directory = productsDirectory
} = {}) {
  const names = (await readdir(directory))
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right, "en"));

  const records = await Promise.all(
    names.map(async (name) => {
      const path = join(directory, name);
      let record;
      try {
        record = JSON.parse(await readFile(path, "utf8"));
      } catch (error) {
        throw new Error(`Cannot parse canonical product ${path}: ${error.message}`);
      }
      return validateCanonicalProduct(record, { source: path });
    })
  );

  return validateCanonicalCatalog(records);
}

export function projectPublicProduct(product) {
  validateCanonicalProduct(product, {
    source: product?.identity?.id ?? "<public-projection>"
  });

  return {
    id: product.identity.id,
    slug: product.identity.slug,
    productId: product.identity.productId,
    sku: product.identity.sku,
    version: product.productVersion,
    name: product.catalog.name,
    status: product.catalog.status,
    statusLabel: product.catalog.statusLabel,
    type: product.catalog.type,
    shortDescription: product.catalog.shortDescription,
    targetAudience: product.catalog.targetAudience,
    features: [...product.workbook.features],
    sheets: [...product.workbook.sheets],
    formulaFamilies: [...product.workbook.formulaFamilies],
    compatibility: [...product.workbook.compatibility],
    availability: product.catalog.availability,
    detailHref: product.identity.route,
    pricingRationale: product.pricing.rationale,
    ownerPricing: {
      strategy: product.pricing.strategy,
      amount: product.pricing.amount,
      currency: product.pricing.currency,
      discountFloor: product.pricing.discountFloor,
      basis: product.pricing.basis,
      marketDataUsed: product.pricing.marketDataUsed
    },
    cta: {
      label: product.catalog.cta.label,
      href: product.identity.route
    }
  };
}

export function buildPublicCatalog(products) {
  const orderedProducts = [...validateCanonicalCatalog(products)].sort(
    (left, right) => left.identity.sku.localeCompare(right.identity.sku, "en")
  );

  return {
    products: orderedProducts.map(projectPublicProduct),
    bundles: [
      {
        id: "finance-bundle",
        name: "Finance Bundle",
        statusLabel: "Coming soon"
      },
      {
        id: "excel-bundle",
        name: "Excel Bundle",
        statusLabel: "Coming soon"
      },
      {
        id: "data-analyst-bundle",
        name: "Data Analyst Bundle",
        statusLabel: "Coming soon"
      }
    ],
    resources: []
  };
}

function indent(value, spaces) {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

export function renderCatalogModule(products) {
  const catalogJson = indent(
    JSON.stringify(buildPublicCatalog(products), null, 2),
    2
  );

  return `(function exposeCatalog(global) {
  "use strict";

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function freezeChild(key) {
      deepFreeze(value[key]);
    });
    return Object.freeze(value);
  }

  global.NumberNinjaCatalog = deepFreeze(
${catalogJson}
  );
})(window);
`;
}

export async function inspectCatalogDrift(targetPath, expectedContents) {
  try {
    const actualContents = await readFile(targetPath, "utf8");
    const normalizedActual = actualContents.replace(/\r\n?/g, "\n");
    const normalizedExpected = expectedContents.replace(/\r\n?/g, "\n");
    return {
      matches: normalizedActual === normalizedExpected,
      reason:
        normalizedActual === normalizedExpected
          ? "Catalog matches canonical products."
          : "Catalog content differs from canonical products."
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        matches: false,
        reason: "Catalog file does not exist."
      };
    }
    throw error;
  }
}

export async function writeCatalogAtomically(targetPath, contents) {
  const drift = await inspectCatalogDrift(targetPath, contents);
  if (drift.matches) return { changed: false, targetPath };

  await mkdir(dirname(targetPath), { recursive: true });
  const temporaryPath = join(
    dirname(targetPath),
    `.${basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`
  );
  let handle = null;

  try {
    handle = await open(temporaryPath, "wx", 0o644);
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, targetPath);
    return { changed: true, targetPath };
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {});
    }
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw new Error(
      `Unable to write catalog atomically to ${targetPath}: ${error.message}`
    );
  }
}
