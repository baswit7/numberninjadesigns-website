import { assertSafeStructure, sha256Hex, stableStringify } from '../engines/security.js';

const SUPPORTED = Object.freeze({
  MarketOpportunity: new Set(['1.0.0', '1']),
  ProductManifest: new Set(['1.0.0', '1']),
  ListingPackage: new Set(['1.0.0', '1']),
});

function get(value, ...keys) {
  for (const key of keys) if (value[key] !== undefined && value[key] !== null) return value[key];
  return null;
}

function numberOrNull(value) {
  if (value === null || value === '') return null;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function schemaVersion(input) {
  return String(get(input, 'schemaVersion', 'schema_version', 'version') ?? 'unknown');
}

async function provenance(input, options) {
  return {
    sourceModule: options.sourceModule,
    sourceType: options.sourceType,
    sourceVersion: schemaVersion(input),
    sourceId: options.sourceId ?? null,
    importedAt: options.importedAt ?? new Date().toISOString(),
    sha256: await sha256Hex(stableStringify(input)),
    mutationPolicy: 'READ_ONLY_COPY',
  };
}

function failure(contract, error, sourceVersion = 'unknown') {
  return { status: 'INCOMPATIBLE', contract, sourceVersion, value: null, provenance: null, errors: [{ code: 'ADAPTER_REJECTED', message: error.message }] };
}

export async function adaptMarketOpportunity(input, options = {}) {
  const contract = 'MarketOpportunity';
  try {
    assertSafeStructure(input);
    const version = schemaVersion(input);
    if (!SUPPORTED[contract].has(version)) throw new Error(`Unsupported ${contract} schema version ${version}.`);
    const keyword = String(get(input, 'keyword', 'primary_keyword', 'niche') ?? '').trim();
    if (!keyword) throw new Error('Market opportunity keyword is required.');
    const value = {
      schemaVersion: '1.0.0',
      id: String(get(input, 'id', 'opportunity_id') ?? `opportunity-${(await sha256Hex(keyword)).slice(0, 12)}`),
      keyword,
      demandScore: numberOrNull(get(input, 'demandScore', 'demand_score', 'demand')),
      competitionScore: numberOrNull(get(input, 'competitionScore', 'competition_score', 'competition')),
      opportunityScore: numberOrNull(get(input, 'opportunityScore', 'opportunity_score', 'score')),
      medianPrice: numberOrNull(get(input, 'medianPrice', 'median_price', 'price')),
      currency: String(get(input, 'currency') ?? 'UNKNOWN'),
      targetAudience: get(input, 'targetAudience', 'target_audience'),
      keywords: [...new Set([keyword, ...(get(input, 'keywords', 'tags') ?? [])].map(String))],
      evidenceQuality: String(get(input, 'evidenceQuality', 'evidence_quality') ?? 'UNKNOWN'),
      sourceFields: structuredClone(input),
    };
    return { status: 'PASS', contract, sourceVersion: version, value, provenance: await provenance(input, { ...options, sourceModule: options.sourceModule ?? 'etsy-intelligence-engine', sourceType: options.sourceType ?? 'MarketOpportunity' }), errors: [] };
  } catch (error) { return failure(contract, error, schemaVersion(input ?? {})); }
}

export async function adaptProductManifest(input, options = {}) {
  const contract = 'ProductManifest';
  try {
    assertSafeStructure(input);
    const version = schemaVersion(input);
    if (!SUPPORTED[contract].has(version)) throw new Error(`Unsupported ${contract} schema version ${version}.`);
    const productId = String(get(input, 'product_id', 'productId', 'id') ?? '').trim();
    if (!productId) throw new Error('Product manifest product ID is required.');
    const value = {
      schemaVersion: '1.0.0',
      productId,
      productName: String(get(input, 'product_name', 'productName', 'name') ?? productId),
      productType: String(get(input, 'product_type', 'productType') ?? 'digital-workbook'),
      locale: String(get(input, 'locale') ?? 'unknown'),
      currency: String(get(input, 'currency') ?? 'unknown'),
      features: [...new Set((get(input, 'features') ?? []).map(String))],
      compatibility: get(input, 'compatibility') ?? {},
      sourceFields: structuredClone(input),
    };
    return { status: 'PASS', contract, sourceVersion: version, value, provenance: await provenance(input, { ...options, sourceModule: options.sourceModule ?? 'listing-intelligence-engine', sourceType: options.sourceType ?? 'ProductManifest' }), errors: [] };
  } catch (error) { return failure(contract, error, schemaVersion(input ?? {})); }
}

export async function adaptListingPackage(input, options = {}) {
  const contract = 'ListingPackage';
  try {
    assertSafeStructure(input);
    const version = schemaVersion(input);
    if (!SUPPORTED[contract].has(version)) throw new Error(`Unsupported ${contract} schema version ${version}.`);
    const title = String(get(input, 'title', 'primary_title') ?? '').trim();
    if (!title) throw new Error('Listing package title is required.');
    const value = {
      schemaVersion: '1.0.0',
      status: 'IMPORTED_DRAFT',
      title,
      description: String(get(input, 'description', 'full_description') ?? ''),
      tags: [...new Set((get(input, 'tags', 'keywords') ?? []).map(String))],
      priceAdvice: get(input, 'price_advice', 'priceAdvice') ?? null,
      imageCopy: get(input, 'image_copy', 'imageCopy') ?? [],
      bundleSuggestions: get(input, 'bundle_suggestions', 'bundleSuggestions') ?? [],
      sourceFields: structuredClone(input),
    };
    return { status: 'PASS', contract, sourceVersion: version, value, provenance: await provenance(input, { ...options, sourceModule: options.sourceModule ?? 'listing-intelligence-engine', sourceType: options.sourceType ?? 'ListingPackage' }), errors: [] };
  } catch (error) { return failure(contract, error, schemaVersion(input ?? {})); }
}

export const INTELLIGENCE_ADAPTER_CAPABILITIES = Object.freeze({
  readOnly: true,
  supportedContracts: Object.keys(SUPPORTED),
  affectsWorkbookIntegrity: false,
  livePublication: false,
  fixedExternalPaths: false,
});
