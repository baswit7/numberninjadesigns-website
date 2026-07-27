import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';

import {
  ETSY_IMAGE_FUNNEL,
  ETSY_VIDEO_SPECS,
  applyEtsyDominanceListing,
  buildEtsyDominanceProfile,
  renderSupportHtml,
  validateEtsyDigitalUploadPlan,
} from '../src/commercial/etsy-dominance-engine.mjs';
import { analyzeGoogleSheetsReadiness, googleSheetsEditionFilename } from '../src/compatibility/google-sheets-readiness.mjs';
import { PREMIUM_LISTING_PAGES, calculateMonthly, renderPremiumListingHtml } from '../src/commercial/etsy-premium-visual-engine.mjs';

const definition = { id: 'budget-planner-ultimate', formulas: [{ operation: 'SUM' }, { operation: 'SUMIFS' }] };

test('builds compliant English-first and Dutch Etsy dominance profiles', () => {
  for (const [locale, currency] of [['en-US', 'USD'], ['nl-NL', 'EUR']]) {
    const profile = buildEtsyDominanceProfile({ definition, configuration: { locale, currency, filename: `ultimate-${locale}.xlsx` } });
    assert.ok(profile.title.length <= 140);
    assert.equal(profile.tags.length, 13);
    assert.ok(profile.tags.every(tag => tag.length <= 20));
    assert.equal(profile.imageFunnel.length, 20);
    assert.equal(profile.videos.length, 2);
    assert.equal(profile.priceExperiment.control.price, 29);
    assert.equal(profile.priceExperiment.challenger.price, 34);
    assert.equal(profile.bundleLadder.filter(bundle => bundle.status === 'AVAILABLE').length, 1);
    assert.equal(profile.bundleLadder.filter(bundle => bundle.status === 'ROADMAP_NOT_FOR_SALE').length, 2);
    assert.equal(profile.supportPromise.publicPromise.length > 10, true);
    const listing = applyEtsyDominanceListing({ faq: [], includedFiles: [] }, profile);
    assert.equal(listing.includedFiles.length, 6);
    assert.equal(listing.faq.at(-1).id, 'support');
    assert.match(renderSupportHtml(profile), /Content-Security-Policy/);
  }
  assert.equal(ETSY_IMAGE_FUNNEL.length, 20);
  assert.equal(ETSY_VIDEO_SPECS.length, 2);
  assert.ok(ETSY_VIDEO_SPECS.every(video => video.durationSeconds >= 3 && video.durationSeconds <= 15 && video.audio === false));
  assert.ok(ETSY_VIDEO_SPECS.every(video => video.durationSeconds === 15 && video.storyboardImageIds.length === 4));
});

test('renders twenty premium commercial pages without placeholder copy', () => {
  const evidence = {
    locale: 'en-US', currency: 'USD', inputCapacity: 10000, sheetCount: 24, formulaDefinitionCount: 67,
    sourceSheets: ['Transactions', 'Annual Budget', 'Debts', 'Goals', 'Net-Worth History'],
    annualBudget: Array.from({ length: 12 }, (_, index) => ({ month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][index], fixed: 1900, variable: 1100, savings: 650, rollover: index ? 50 : 0, planned: index ? 3700 : 3650 })),
    monthly: Array.from({ length: 12 }, (_, index) => ({ month: String(index + 1), income: 4200 + index * 20, expenses: 2500 + index * 15, savings: 650, cashflow: 1050 + index * 5, budget: 3700, variance: 1200 })),
    paycheck: [{ period: 'Pay period 1', start: new Date('2026-01-01T12:00:00Z'), income: 2100, allocated: 1780, remaining: 320 }, { period: 'Pay period 2', start: new Date('2026-01-16T12:00:00Z'), income: 2100, allocated: 1925, remaining: 175 }],
    debts: [{ name: 'Credit card', balance: 4100, rate: .189, payment: 245, progress: .21 }],
    goals: [{ name: 'Emergency fund', target: 12000, value: 4500, monthly: 400, remaining: 7500, progress: .375 }],
    netWorth: Array.from({ length: 12 }, (_, index) => ({ assets: 22500 + index * 700, liabilities: 19250 - index * 300, net: 3250 + index * 1000 })),
    subscriptions: [{ name: 'Cloud storage', amount: 9.99, frequency: 'Monthly', status: 'Active', annual: 119.88 }],
    bills: [{ name: 'Housing', amount: 1450, method: 'Direct debit', status: 'Scheduled' }],
  };
  assert.equal(PREMIUM_LISTING_PAGES.length, 20);
  for (const page of PREMIUM_LISTING_PAGES) {
    const html = renderPremiumListingHtml(evidence, page.id);
    assert.match(html, new RegExp(`data-page-id="${page.id}"`));
    assert.doesNotMatch(html, /\b(?:TODO|LOREM|PLACEHOLDER)\b|=…/iu);
  }
  assert.match(renderPremiumListingHtml(evidence, 'hero'), /EXCEL \+ GOOGLE SHEETS/);
  assert.match(renderPremiumListingHtml(evidence, 'dashboard-overview'), /<svg class="chart-svg"/);

  const dutchEvidence = { ...evidence, locale: 'nl-NL', currency: 'EUR' };
  for (const page of PREMIUM_LISTING_PAGES) {
    const html = renderPremiumListingHtml(dutchEvidence, page.id);
    assert.doesNotMatch(html, /\b(?:CONNECTED SHEETS|INPUT ROWS|BUILT-IN FORMULA DEFINITIONS|AUTOMATED QUALITY CHECKS|HONEST COMPATIBILITY LABELS|CURRENT BALANCE|HUMAN SUPPORT)\b/iu);
  }
});

test('classifies Dutch transaction types without replacing commercial proof with zeroes', () => {
  const annualBudget = [{ month: 'Jan', planned: 3600 }];
  const monthly = calculateMonthly([
    { date: new Date('2026-01-25T12:00:00Z'), type: 'Inkomst', amount: 4200 },
    { date: new Date('2026-01-02T12:00:00Z'), type: 'Uitgave', amount: 1450 },
    { date: new Date('2026-01-10T12:00:00Z'), type: 'Sparen', amount: 400 },
  ], annualBudget);
  assert.equal(monthly[0].income, 4200);
  assert.equal(monthly[0].expenses, 1450);
  assert.equal(monthly[0].savings, 400);
  assert.equal(monthly[0].cashflow, 2350);
});

test('validates an exact Etsy-ready five-file buyer upload plan', () => {
  const megabyte = 1024 * 1024;
  const plan = validateEtsyDigitalUploadPlan([
    { filename: 'budget-os-en-us-excel-light.xlsx', bytes: 6 * megabyte },
    { filename: 'budget-os-en-us-excel-dark.xlsx', bytes: 6 * megabyte },
    { filename: 'budget-os-en-us-sheets-light.xlsx', bytes: 6 * megabyte },
    { filename: 'budget-os-en-us-sheets-dark.xlsx', bytes: 6 * megabyte },
    { filename: 'budget-os-en-us-guides.zip', bytes: megabyte },
  ]);
  assert.equal(plan.status, 'PASS');
  assert.equal(plan.fileCount, 5);
  assert.throws(() => validateEtsyDigitalUploadPlan([{ filename: 'oversized.xlsx', bytes: 20 * megabyte + 1 }]), /size policy/);
  assert.throws(() => validateEtsyDigitalUploadPlan([{ filename: 'unsafe name.xlsx', bytes: megabyte }]), /filename is invalid/);
});

async function workbookFixture(formula = 'SUM(A1:A2)', extraEntries = {}) {
  const zip = new JSZip();
  zip.file('xl/workbook.xml', '<workbook/>');
  zip.file('xl/worksheets/sheet1.xml', `<worksheet><sheetData><c r="A3"><f>${formula}</f><v>3</v></c></sheetData></worksheet>`);
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('xl/styles.xml', `<styleSheet>${' '.repeat(2_000)}</styleSheet>`);
  for (const [path, value] of Object.entries(extraEntries)) zip.file(path, value);
  return zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
}

test('fails Google Sheets readiness closed on Excel-only functions and package features', async () => {
  const passing = await analyzeGoogleSheetsReadiness({ workbookBytes: await workbookFixture(), definition, JSZip, generatedAt: '2026-07-22T00:00:00.000Z' });
  assert.equal(passing.status, 'PASS');
  assert.equal(passing.claim, 'GOOGLE_SHEETS_IMPORT_READY');
  assert.equal(passing.nativeImportVerified, false);
  assert.equal(googleSheetsEditionFilename('Finance Plan.xlsx'), 'Finance-Plan-google-sheets-import.xlsx');

  const failing = await analyzeGoogleSheetsReadiness({
    workbookBytes: await workbookFixture('_xlfn.LET(A1,1,A1)', { 'xl/vbaProject.bin': 'macro' }),
    definition,
    JSZip,
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(failing.status, 'FAIL');
  assert.ok(failing.issues.some(issue => issue.code === 'BLOCKED_XLSX_FEATURE'));
  assert.ok(failing.issues.some(issue => issue.code === 'UNSUPPORTED_FORMULA_FUNCTION'));
});
