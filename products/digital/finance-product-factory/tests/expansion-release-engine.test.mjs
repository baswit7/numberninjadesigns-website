import test from 'node:test';
import assert from 'node:assert/strict';

import { buildExpansionReleasePackage, TAGS_BY_PRODUCT, validateExpansionReleasePackage } from '../src/commercial/expansion-release-engine.mjs';

const definition = {
  id: 'project-management-spreadsheet',
  version: '0.9.0',
  productFamily: 'project-management',
  features: ['project-dashboard', 'task-register', 'risk-register'],
  formulas: [{ operation: 'SUM' }, { operation: 'COUNTIF' }],
  sheets: [{ id: 'dashboard', type: 'dashboard', order: 1 }, { id: 'tasks', type: 'input', order: 2 }],
  extensions: { tier: 'ultimate', evidenceStatus: 'LISTINGVIEW_SUPPORTED' },
};

const result = {
  definition,
  configuration: { filename: 'project.xlsx', locale: 'en-US', currency: 'USD', themeId: 'executive-navy', extensions: { productAppearance: 'light' } },
  workbook: { bytes: new Uint8Array(20_000) },
  summary: { sheets: 2, formulas: 12, validations: 8 },
  validationReport: { status: 'PASS' },
  qualityReport: { status: 'PASS' },
  compatibilityReport: { status: 'PASS', targets: [{ target: 'excel-desktop', status: 'PASS', checks: ['Native open/save passed.'], limitations: [] }] },
};

const marketReport = {
  bands: { price: { p25: 4, median: 9, p75: 17 } },
  recurringTitlePhrases: [{ value: 'project planner', count: 22 }, { value: 'task tracker', count: 19 }],
};

test('every generated release profile has exactly thirteen unique Etsy-safe tags', () => {
  for (const [productId, tags] of Object.entries(TAGS_BY_PRODUCT)) {
    assert.equal(tags.length, 13, productId);
    assert.equal(new Set(tags).size, 13, productId);
    assert.ok(tags.every(tag => tag.length <= 20), productId);
  }
});

test('release package is complete and keeps Google Sheets claims provisional', () => {
  const release = buildExpansionReleasePackage({ definition, result, marketReport, workbookSha256: 'a'.repeat(64) });
  assert.equal(release.validation.status, 'PASS');
  assert.equal(release.listing.tags.length, 13);
  assert.equal(release.compatibility.googleSheets.status, 'PROVISIONAL');
  assert.equal(release.compatibility.googleSheets.salesClaimAllowed, false);
  assert.equal(release.manifest.releaseStatus, 'READY_FOR_EXCEL_RELEASE');
  assert.equal(release.listing.imagePlan.length, 10);
});

test('release validator rejects unsupported Google Sheets claims and incomplete tags', () => {
  const files = new Map([['listing/etsy-listing.json', 'Fully compatible with Google Sheets']]);
  const listing = { tags: ['one'], title: 'Short', imagePlan: [] };
  const report = validateExpansionReleasePackage(files, listing);
  assert.equal(report.status, 'FAIL');
  assert.ok(report.errors.some(error => error.code === 'UNSUPPORTED_GOOGLE_CLAIM'));
  assert.ok(report.errors.some(error => error.code === 'ETSY_TAG_COUNT'));
});
