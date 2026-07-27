import assert from 'node:assert/strict';
import test from 'node:test';

import {
  portfolioFamilies,
  portfolioProductById,
  portfolioProductDefinitions,
  validatePortfolioCatalog,
} from '../src/products/portfolio-catalog.mjs';

test('portfolio catalog covers every requested family with strict reusable definitions', () => {
  const report = validatePortfolioCatalog();
  assert.equal(report.status, 'PASS');
  assert.equal(report.productCount, 85);
  assert.equal(report.familyCount, 5);
  assert.deepEqual(portfolioFamilies, ['personal-finance', 'small-business', 'projects-productivity', 'wedding-event', 'life-family']);
  assert.equal(Object.keys(portfolioProductById).length, 85);
  assert(portfolioProductDefinitions.every(definition => Object.isFrozen(definition)));
});

test('platform and wedding claims remain fail-closed until runtime evidence exists', () => {
  assert(portfolioProductDefinitions.every(definition => definition.compatibilityProfile.googleSheets === 'PROVISIONAL_IMPORT_CHECKLIST_REQUIRED'));
  assert(portfolioProductDefinitions.every(definition => !definition.platformProfiles.includes('dual-platform')));
  const weddingDefinitions = portfolioProductDefinitions.filter(definition => definition.family === 'wedding-event');
  assert.equal(weddingDefinitions.length, 15);
  assert.equal(portfolioProductById['wedding-planning-spreadsheet'].releaseStatus, 'RELEASE_CANDIDATE');
  assert(weddingDefinitions.filter(definition => definition.id !== 'wedding-planning-spreadsheet').every(definition => definition.releaseStatus === 'MARKET_VALIDATION_REQUIRED'));
});
