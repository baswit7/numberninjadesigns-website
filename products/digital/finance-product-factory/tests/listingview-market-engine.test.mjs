import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  analyzeListingViewSourceSet,
  classifyMarketText,
  normalizeListingViewNumber,
  renderMarketReportMarkdown,
} from '../src/market/listingview-market-engine.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(repositoryRoot, 'incoming', 'listingview-2026-07-20');

test('ListingView number normalization preserves raw values and handles point thousands explicitly', () => {
  assert.deepEqual(normalizeListingViewNumber('$110.081', { kind: 'money' }), {
    raw: '$110.081', value: 110081, kind: 'money', detectedFormat: 'thousands-dot', status: 'PASS', warnings: [],
  });
  assert.equal(normalizeListingViewNumber('5.515', { kind: 'integer' }).value, 5515);
  assert.equal(normalizeListingViewNumber('1.540', { kind: 'integer' }).value, 1540);
  assert.equal(normalizeListingViewNumber('2.388,76', { kind: 'money' }).value, 2388.76);
  assert.equal(normalizeListingViewNumber('96,75', { kind: 'decimal' }).value, 96.75);
  assert.equal(normalizeListingViewNumber('4.3%', { kind: 'percentage' }).value, 0.043);
  const ambiguous = normalizeListingViewNumber('12.34', { kind: 'integer' });
  assert.equal(ambiguous.status, 'AMBIGUOUS');
  assert.equal(ambiguous.value, null);
  assert.equal(ambiguous.raw, '12.34');
});

test('content classification rejects physical wedding noise and recognizes targeted spreadsheet niches', () => {
  assert.equal(classifyMarketText('Personalized bridesmaid makeup bag wedding gift'), 'irrelevant-general');
  assert.equal(classifyMarketText('Wedding planner spreadsheet with RSVP vendor tracker'), 'wedding-planning');
  assert.equal(classifyMarketText('Project manager spreadsheet Gantt Kanban Eisenhower Excel'), 'project-management');
  assert.equal(classifyMarketText('Small business bookkeeping spreadsheet profit and loss'), 'small-business-bookkeeping');
  assert.equal(classifyMarketText('Biweekly paycheck budget Google Sheets and Excel'), 'paycheck-biweekly');
});

test('the deduplicated 20 July source set is recursively registered, content-classified and fail-closed', async () => {
  const { sourceRegister, normalizedRecords, marketReport } = await analyzeListingViewSourceSet(sourceRoot);
  assert.equal(sourceRegister.files.filter(file => file.extension === '.csv').length, 19);
  assert.equal(sourceRegister.files.filter(file => file.extension === '.png').length, 0);
  assert(sourceRegister.files.every(file => file.readable));
  assert(sourceRegister.files.some(file => file.relativePath.startsWith('csv/')));
  assert(sourceRegister.files.every(file => !file.duplicateOf));
  assert(sourceRegister.files.some(file => file.classification === 'irrelevant-general'));
  assert.equal(normalizedRecords.records.length, 641);
  assert(marketReport.sourceSummary.uniqueRelevantListings > 0);
  assert(marketReport.productClusters.some(item => item.value === 'paycheck-biweekly'));
  assert.equal(marketReport.screenshotEvidence.length, 0);
  assert.equal(marketReport.opportunities.find(item => item.product === 'Wedding Planner').evidenceStatus, 'INSUFFICIENT');
  assert.match(renderMarketReportMarkdown(marketReport), /All raw values are preserved/);
});
