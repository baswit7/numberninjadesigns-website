import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INTELLIGENCE_ADAPTER_CAPABILITIES,
  adaptListingPackage,
  adaptMarketOpportunity,
  adaptProductManifest,
} from '../src/adapters/intelligence-adapters.js';
import { sha256Hex, stableStringify } from '../src/engines/security.js';

const IMPORTED_AT = '2026-07-15T00:00:00.000Z';

test('intelligence adapter capabilities preserve the read-only integrity boundary', () => {
  assert.deepEqual(INTELLIGENCE_ADAPTER_CAPABILITIES, {
    readOnly: true,
    supportedContracts: ['MarketOpportunity', 'ProductManifest', 'ListingPackage'],
    affectsWorkbookIntegrity: false,
    livePublication: false,
    fixedExternalPaths: false,
  });
  assert(Object.isFrozen(INTELLIGENCE_ADAPTER_CAPABILITIES));
});

test('MarketOpportunity normalization is deterministic, provenance-rich and non-mutating', async () => {
  const source = {
    schema_version: '1',
    opportunity_id: 'opp-42',
    primary_keyword: 'budget spreadsheet',
    demand_score: '82,5',
    competition_score: '31.25',
    opportunity_score: 76,
    median_price: '14,95',
    currency: 'EUR',
    target_audience: ['households'],
    tags: ['budget spreadsheet', 'excel budget'],
    evidence_quality: 'MEASURED',
  };
  const snapshot = structuredClone(source);
  const result = await adaptMarketOpportunity(source, { importedAt: IMPORTED_AT, sourceId: 'export-7' });

  assert.equal(result.status, 'PASS');
  assert.equal(result.contract, 'MarketOpportunity');
  assert.equal(result.sourceVersion, '1');
  assert.deepEqual(source, snapshot);
  assert.notStrictEqual(result.value.sourceFields, source);
  assert.deepEqual(result.value.keywords, ['budget spreadsheet', 'excel budget']);
  assert.equal(result.value.demandScore, 82.5);
  assert.equal(result.value.competitionScore, 31.25);
  assert.equal(result.value.medianPrice, 14.95);
  assert.deepEqual(result.provenance, {
    sourceModule: 'etsy-intelligence-engine',
    sourceType: 'MarketOpportunity',
    sourceVersion: '1',
    sourceId: 'export-7',
    importedAt: IMPORTED_AT,
    sha256: await sha256Hex(stableStringify(source)),
    mutationPolicy: 'READ_ONLY_COPY',
  });
});

test('ProductManifest normalization retains compatibility data without influencing workbooks', async () => {
  const source = {
    schemaVersion: '1.0.0',
    product_id: 'debt-snowball-planner',
    product_name: 'Debt Snowball Planner',
    product_type: 'digital-workbook',
    locale: 'en-US',
    currency: 'USD',
    features: ['snowball', 'progress', 'snowball'],
    compatibility: { excelDesktop: 'REVIEW_REQUIRED' },
  };
  const result = await adaptProductManifest(source, { importedAt: IMPORTED_AT });

  assert.equal(result.status, 'PASS');
  assert.equal(result.value.productId, 'debt-snowball-planner');
  assert.deepEqual(result.value.features, ['snowball', 'progress']);
  assert.deepEqual(result.value.compatibility, { excelDesktop: 'REVIEW_REQUIRED' });
  assert.equal(result.provenance.sourceModule, 'listing-intelligence-engine');
  assert.equal(result.provenance.mutationPolicy, 'READ_ONLY_COPY');
});

test('ListingPackage remains an imported draft and preserves review inputs', async () => {
  const source = {
    version: '1',
    primary_title: 'Budget Planner Spreadsheet',
    full_description: 'A local workbook draft for review.',
    keywords: ['budget', 'excel', 'budget'],
    price_advice: { status: 'SOURCE_REQUIRED', amount: null },
    image_copy: [{ id: 'hero', headline: 'Plan with clarity' }],
    bundle_suggestions: ['Finance essentials'],
  };
  const result = await adaptListingPackage(source, { importedAt: IMPORTED_AT });

  assert.equal(result.status, 'PASS');
  assert.equal(result.value.status, 'IMPORTED_DRAFT');
  assert.equal(result.value.title, 'Budget Planner Spreadsheet');
  assert.deepEqual(result.value.tags, ['budget', 'excel']);
  assert.deepEqual(result.value.priceAdvice, { status: 'SOURCE_REQUIRED', amount: null });
  assert.deepEqual(result.value.bundleSuggestions, ['Finance essentials']);
});

test('adapters fail closed on incompatible versions, missing identities and unsafe structures', async () => {
  const incompatible = await adaptMarketOpportunity({ schemaVersion: '2.0.0', keyword: 'budget' });
  const missingIdentity = await adaptProductManifest({ schemaVersion: '1.0.0' });
  const unsafe = await adaptListingPackage(JSON.parse('{"schemaVersion":"1","title":"Unsafe","__proto__":{"polluted":true}}'));

  for (const result of [incompatible, missingIdentity, unsafe]) {
    assert.equal(result.status, 'INCOMPATIBLE');
    assert.equal(result.value, null);
    assert.equal(result.provenance, null);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].code, 'ADAPTER_REJECTED');
  }
  assert.equal({}.polluted, undefined);
});
