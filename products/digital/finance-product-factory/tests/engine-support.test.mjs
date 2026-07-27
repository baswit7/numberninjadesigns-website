import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateCompatibilityReport,
  validateProductConfiguration,
  validateQualityReport,
  validateValidationReport,
} from '../src/contracts/index.js';
import { createBatchPlan, runBatch, UI_BATCH_LIMIT } from '../src/engines/batch-engine.js';
import { resolveProductConfiguration } from '../src/engines/configuration-engine.js';
import { buildFormula } from '../src/engines/formula-engine.js';
import {
  DEFAULT_UI_PREFERENCES,
  STORAGE_KEYS,
  importDraft,
  loadUiPreferences,
  migrateStoredState,
  saveUiPreferences,
} from '../src/engines/persistence-engine.js';
import { buildPreviewModel } from '../src/engines/preview-engine.js';
import { scoreProduct } from '../src/engines/quality-engine.js';
import { safeJsonParse, safeSpreadsheetText, validateZipPath } from '../src/engines/security.js';
import { compatibilityReport, makeValidationReport, validateConfiguration } from '../src/engines/validation-engine.js';
import { localeCatalog } from '../src/locales/index.mjs';
import { productDefinitionById } from '../src/products/index.mjs';

const timestamp = '2026-07-15T00:00:00.000Z';

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

const definition = Object.freeze({
  id: 'budget-planner-basic',
  version: '1.0.0',
  supportedLocales: Object.freeze(['en-US', 'nl-NL']),
  supportedCurrencies: Object.freeze(['USD', 'EUR']),
  supportedThemes: Object.freeze(['executive-navy', 'tactical-dark']),
  defaultConfiguration: Object.freeze({
    locale: 'nl-NL',
    market: 'NL',
    currency: 'EUR',
    year: 2026,
    themeId: 'executive-navy',
    title: 'Budget Planner Basic',
    filename: 'Budget_Planner_Basic.xlsx',
    inputCapacity: 100,
    sampleDataEnabled: true,
    categoryOverrides: Object.freeze([]),
    featureFlags: Object.freeze({ dashboard: true }),
    branding: Object.freeze({ enabled: true, brandName: 'NumberNinjaDesigns' }),
  }),
  compatibility: Object.freeze({
    targets: Object.freeze(['excel-desktop', 'excel-web']),
    minimumExcelVersion: '2019',
    limitations: Object.freeze([]),
  }),
});

function normalizedConfiguration() {
  const productDefinition = productDefinitionById['budget-planner-basic'];
  const messages = localeCatalog['nl-NL'].messages;
  return resolveProductConfiguration({
    productDefinition,
    userSelections: {
      market: 'NL',
      year: 2026,
      title: 'Budget Planner Basic',
      filename: 'Budget_Planner_Basic.xlsx',
      inputCapacity: 100,
      sampleDataEnabled: true,
    },
    locale: 'nl-NL',
    currency: 'EUR',
    tier: 'basic',
    theme: 'executive-navy',
    translate: (key, fallback = key) => messages[key] ?? fallback,
    now: new Date(timestamp),
  });
}

function assertContractPass(report, label) {
  assert.equal(report.valid, true, `${label}: ${JSON.stringify(report.issues)}`);
  assert.equal(report.status, 'PASS');
}

test('resolveProductConfiguration emits the strict ProductConfiguration v1 contract', () => {
  const configuration = normalizedConfiguration();
  assertContractPass(validateConfiguration(productDefinitionById['budget-planner-basic'], configuration), 'engine configuration validation');
  assertContractPass(validateProductConfiguration(configuration), 'ProductConfiguration contract validation');
});

test('v1 draft migration preserves state and produces a strict ProductConfiguration', () => {
  const source = {
    schemaVersion: '1.0.0',
    savedAt: timestamp,
    step: 4,
    configuration: normalizedConfiguration(),
    approval: { status: 'DRAFT', reason: '' },
    lastGeneration: null,
  };
  const snapshot = structuredClone(source);
  const migrated = migrateStoredState(source);
  assert.deepEqual(source, snapshot, 'migration must not mutate the stored source object');
  assert.equal(migrated.schemaVersion, '2.0.0');
  assert.equal(migrated.savedAt, timestamp);
  assert.equal(migrated.step, 4);
  assertContractPass(validateProductConfiguration(migrated.configuration), 'migrated v1 configuration');
});

test('legacy draft migration maps legacy identifiers and produces a strict ProductConfiguration', () => {
  const migrated = migrateStoredState({
    product: 'basic',
    locale: 'nl-NL',
    currency: 'EUR',
    year: 2026,
    theme: 'Executive Navy',
    title: 'Legacy Budget Planner',
    filename: 'Legacy Budget Planner.xlsx',
    inputCapacity: 100,
    sampleDataEnabled: false,
  });
  assert.equal(migrated.schemaVersion, '2.0.0');
  assert.equal(migrated.configuration.productId, 'budget-planner-basic');
  assert.equal(migrated.configuration.themeId, 'executive-navy');
  assert.equal(migrated.configuration.filename, 'Legacy-Budget-Planner.xlsx');
  assertContractPass(validateProductConfiguration(migrated.configuration), 'migrated legacy configuration');
});

test('generator appearance defaults safely to light and persists independently from the draft', () => {
  const storage = memoryStorage({ [STORAGE_KEYS.draft]: '{"schemaVersion":"2.0.0","configuration":{"locale":"de-DE","themeId":"tactical-dark"}}' });
  assert.deepEqual(loadUiPreferences(storage), { preferences: DEFAULT_UI_PREFERENCES, warnings: [] });
  const saved = saveUiPreferences({ schemaVersion: '1.0.0', appearance: 'dark' }, storage);
  assert.equal(saved.appearance, 'dark');
  assert.equal(loadUiPreferences(storage).preferences.appearance, 'dark');
  assert.match(storage.getItem(STORAGE_KEYS.draft), /"locale":"de-DE"/, 'UI preference save must not rewrite the product draft');
});

test('preview model uses the real localized product sample rows', () => {
  const product = productDefinitionById['budget-planner-basic'];
  for (const locale of ['nl-NL', 'de-DE']) {
    const messages = localeCatalog[locale].messages;
    const translate = (key, fallback = key) => messages[key] ?? fallback;
    const configuration = {
      ...structuredClone(product.defaultConfiguration),
      locale,
      market: locale === 'de-DE' ? 'DE' : 'NL',
      currency: 'EUR',
      title: translate(product.nameKey),
      filename: `budget-planner-basic-${locale}-2026-light.xlsx`,
    };
    const preview = buildPreviewModel(product, configuration, { translate });
    const income = preview.sheets.find(sheet => sheet.id === 'income');
    assert.equal(income.rows[0].description, translate('sample.description.monthlySalary'));
    assert.equal(income.rows[0].category, translate('sample.category.salary'));
    assert.equal(income.rows[0].amount, 3200);
    assert.doesNotMatch(JSON.stringify(income.rows.flatMap(row => Object.values(row))), /\b(?:description|category)\b/i);
  }
});

test('invalid or polluted generator preferences fail closed to light', () => {
  for (const raw of [
    '{not-json',
    '{"schemaVersion":"2.0.0","appearance":"dark"}',
    '{"schemaVersion":"1.0.0","appearance":"system"}',
    '{"schemaVersion":"1.0.0","appearance":"dark","locale":"de-DE"}',
    '{"__proto__":{"appearance":"dark"}}',
  ]) {
    const loaded = loadUiPreferences(memoryStorage({ [STORAGE_KEYS.preferences]: raw }));
    assert.equal(loaded.preferences.appearance, 'light', raw);
    assert.equal(loaded.warnings.length, 1, raw);
  }
});

test('spreadsheet text neutralizes every Excel formula prefix after leading whitespace', () => {
  for (const payload of ['=1+1', '+1+1', '-1+1', '@SUM(A1:A2)', '  =HYPERLINK("https://example.invalid")', '\n=cmd']) {
    assert.ok(safeSpreadsheetText(payload).startsWith("'"), `payload was not neutralized: ${JSON.stringify(payload)}`);
  }
  assert.equal(safeSpreadsheetText('Ordinary text'), 'Ordinary text');
});

test('formula builder rejects untrusted nested formula expressions', () => {
  assert.equal(buildFormula('SUM', ['A1:A2']), '=SUM(A1:A2)');
  assert.throws(
    () => buildFormula('SUM', ['=WEBSERVICE("https://attacker.invalid")']),
    /unsafe|unsupported|reference/i,
  );
});

test('ZIP paths reject traversal, absolute paths and prototype-like segments', () => {
  assert.equal(validateZipPath('docs\\README.md'), 'docs/README.md');
  for (const path of ['../escape.txt', 'folder/../../escape.txt', '/absolute.txt', 'C:\\absolute.txt', 'safe/__proto__/value.txt']) {
    assert.throws(() => validateZipPath(path), undefined, `unsafe ZIP path was accepted: ${JSON.stringify(path)}`);
  }
});

test('ZIP paths reject control characters', () => {
  assert.throws(() => validateZipPath('safe\u0000name.txt'), undefined, 'NUL-containing ZIP path was accepted');
});

test('ZIP paths reject Windows alternate data streams', () => {
  assert.throws(() => validateZipPath('safe/file.txt:payload'), undefined, 'Windows ADS ZIP path was accepted');
});

test('JSON import rejects prototype-pollution keys without modifying Object.prototype', () => {
  for (const payload of [
    '{"__proto__":{"polluted":true}}',
    '{"safe":{"constructor":{"prototype":{"polluted":true}}}}',
  ]) {
    assert.throws(() => safeJsonParse(payload), /forbidden object key/i);
    assert.throws(() => importDraft(payload), /forbidden object key/i);
  }
  assert.equal(Object.prototype.polluted, undefined);
});

test('batch planning enforces the default UI combination limit', () => {
  const exactlyAtLimit = createBatchPlan({
    productIds: Array.from({ length: UI_BATCH_LIMIT }, (_, index) => `product-${index + 1}`),
  });
  assert.equal(exactlyAtLimit.count, UI_BATCH_LIMIT);
  assert.equal(exactlyAtLimit.variants.length, UI_BATCH_LIMIT);

  assert.throws(() => createBatchPlan({
    productIds: ['one', 'two'],
    locales: ['nl-NL', 'en-US'],
    currencies: ['EUR', 'USD'],
    themeIds: ['executive-navy', 'tactical-dark'],
    capacities: [50, 100],
  }), /safe limit is 25/i);
});

test('batch execution isolates variant failures and continues remaining work', async () => {
  const plan = createBatchPlan({ productIds: ['one', 'two', 'three'] });
  const calls = [];
  const result = await runBatch(plan, async variant => {
    calls.push(variant.productId);
    if (variant.productId === 'two') throw new Error('controlled failure');
    return `${variant.productId}.xlsx`;
  });

  assert.deepEqual(calls, ['one', 'two', 'three']);
  assert.equal(result.status, 'PASS_WITH_FAILURES');
  assert.equal(result.completed, 3);
  assert.deepEqual(result.results.map(item => item.status), ['PASS', 'FAIL', 'PASS']);
  assert.equal(result.results[1].error, 'controlled failure');
});

test('batch cancellation stops before starting the next variant', async () => {
  const plan = createBatchPlan({ productIds: ['one', 'two', 'three'] });
  const controller = new AbortController();
  let calls = 0;
  const result = await runBatch(plan, async variant => {
    calls += 1;
    return variant.productId;
  }, {
    signal: controller.signal,
    onProgress: ({ completed }) => {
      if (completed === 1) controller.abort();
    },
  });

  assert.equal(result.status, 'CANCELLED');
  assert.equal(result.completed, 1);
  assert.equal(result.total, 3);
  assert.equal(calls, 1);
});

test('validation, quality and compatibility engines emit strict report contracts', () => {
  const configuration = normalizedConfiguration();
  const definitionReport = makeValidationReport({ stage: 'DEFINITION', productId: definition.id, generatedAt: timestamp });
  const configurationReport = makeValidationReport({ stage: 'CONFIGURATION', productId: definition.id, generatedAt: timestamp });
  const workbookReport = makeValidationReport({
    stage: 'WORKBOOK',
    productId: definition.id,
    metrics: { formulas: 12, validations: 3, filters: 2, panes: 2 },
    generatedAt: timestamp,
  });
  for (const [label, report] of Object.entries({ definitionReport, configurationReport, workbookReport })) {
    assertContractPass(validateValidationReport(report), label);
  }

  const compatibility = compatibilityReport(definition, configuration, workbookReport, {
    generatedAt: timestamp,
    evidence: {
      'excel-desktop': { version: '2021', status: 'PASS', checks: ['Native open/save passed.'], limitations: [] },
      'excel-web': { version: null, status: 'PASS', checks: ['Web open passed.'], limitations: [] },
    },
  });
  assertContractPass(validateCompatibilityReport(compatibility), 'CompatibilityReport');

  const quality = scoreProduct({
    definition,
    definitionReport,
    configurationReport,
    workbookReport,
    compatibilityReport: compatibility,
    generatedAt: timestamp,
  });
  assertContractPass(validateQualityReport(quality), 'QualityReport');
  assert.equal(quality.status, 'PASS');

  assert.equal(validateValidationReport({ ...workbookReport, unknown: true }).valid, false);
  assert.equal(validateCompatibilityReport({ ...compatibility, unknown: true }).valid, false);
  assert.equal(validateQualityReport({ ...quality, unknown: true }).valid, false);
});

test('ValidationReport blocker accounting remains strict and deterministic', () => {
  const report = makeValidationReport({
    stage: 'SECURITY',
    productId: definition.id,
    errors: [{ code: 'UNSAFE_INPUT', severity: 'BLOCKER', path: '$.title', message: 'Unsafe input rejected.' }],
    generatedAt: timestamp,
  });
  assert.equal(report.status, 'FAIL');
  assert.equal(report.valid, false);
  assert.deepEqual(report.summary, { errorCount: 0, blockerCount: 1 });
  assertContractPass(validateValidationReport(report), 'blocking ValidationReport structure');
});
