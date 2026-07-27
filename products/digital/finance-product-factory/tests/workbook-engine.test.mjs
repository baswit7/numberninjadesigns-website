import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { validateContract } from '../src/contracts/index.js';
import { scoreProduct } from '../src/engines/quality-engine.js';
import { sha256Hex } from '../src/engines/security.js';
import { generateWorkbook } from '../src/engines/workbook-engine.js';
import { compatibilityReport, inspectWorkbook } from '../src/engines/validation-engine.js';
import { createFactoryRuntime } from '../src/factory-runtime.js';
import currencies from '../src/currencies/index.mjs';
import locales from '../src/locales/index.mjs';
import { productDefinitions } from '../src/products/index.mjs';
import themes from '../src/themes/index.mjs';

const column = (id, type, role, validationId = null) => ({
  schemaVersion: '1.0.0', id, labelKey: `columns.${id}`, type, width: 16, role,
  format: null, validationId, required: role === 'input',
});

const print = { orientation: 'landscape', paperSize: 'A4', fitToWidth: 1, fitToHeight: 0 };
const sheet = (id, type, columns, inputRows, formulas = [], validations = [], sampleRows = []) => ({
  schemaVersion: '1.0.0', id, nameKey: `sheets.${id}`, type, order: id === 'dashboard' ? 0 : id === 'transactions' ? 1 : 2,
  hidden: false, columns, inputRows, freeze: { rows: 4, columns: 0 }, autoFilter: type !== 'dashboard', print, formulas, validations, sampleRows,
});

const categoryValidation = {
  schemaVersion: '1.0.0', id: 'category-list', sheetId: 'transactions', columnId: 'category', type: 'list',
  source: 'categories.category', required: true, severity: 'error',
};
const varianceFormula = {
  schemaVersion: '1.0.0', id: 'variance', sheetId: 'transactions', target: 'variance', operation: 'ROW_DIFFERENCE',
  parameters: { leftColumnId: 'budget', rightColumnId: 'amount' }, fillDirection: 'down', inputRowsBound: true,
};
const totalFormula = {
  schemaVersion: '1.0.0', id: 'total', sheetId: 'dashboard', target: 'value', operation: 'SUM',
  parameters: { range: { sheetId: 'transactions', columnId: 'amount' } }, fillDirection: 'none', inputRowsBound: false,
};
const sheets = [
  sheet('dashboard', 'dashboard', [column('metric', 'string', 'label'), column('value', 'currency', 'calculated')], 1, [totalFormula], [], [{ metric: 'Total expenses' }]),
  sheet('transactions', 'input', [
    column('date', 'date', 'input'), column('category', 'string', 'input', 'category-list'), column('budget', 'currency', 'input'),
    column('amount', 'currency', 'input'), column('variance', 'formula', 'calculated'),
  ], 100, [varianceFormula], [categoryValidation], [{ date: '2026-01-02', category: 'Housing', budget: 1000, amount: 950 }]),
  sheet('categories', 'lookup', [column('category', 'string', 'input')], 4, [], [], [{ category: 'Housing' }, { category: 'Food' }]),
];
const definition = {
  id: 'engine-test', version: '1.0.0', category: 'personal-finance', productFamily: 'budgeting', descriptionKey: 'products.engineTest.description', tags: ['test'],
  sheets, formulas: [totalFormula, varianceFormula], validations: [categoryValidation],
};
const configuration = {
  schemaVersion: '1.0.0', productId: definition.id, productVersion: definition.version, locale: 'en-US', market: 'US', currency: 'USD', year: 2026,
  themeId: 'tactical-dark', title: 'Workbook Engine Test', filename: 'Workbook_Engine_Test.xlsx', inputCapacity: 50, sampleDataEnabled: true,
  categoryOverrides: [], featureFlags: {}, branding: { enabled: true }, outputOptions: { workbook: true, package: true, customerDocs: true, listing: true, imageManifests: true },
};
const localization = {
  locale: 'en-US', messages: Object.fromEntries([
    ['sheets.dashboard', 'Dashboard'], ['sheets.transactions', 'Transactions'], ['sheets.categories', 'Categories'],
    ...['metric', 'value', 'date', 'category', 'budget', 'amount', 'variance'].map(id => [`columns.${id}`, id[0].toUpperCase() + id.slice(1)]),
  ]), formats: { date: 'mm/dd/yyyy', decimalSeparator: '.', thousandsSeparator: ',', paperSize: 'Letter' },
};
const currencyProfile = { code: 'USD', formats: { accounting: '[$$-en-US] #,##0.00;[Red]-[$$-en-US] #,##0.00', percentage: '0.0%' } };
const theme = {
  fonts: { heading: 'Aptos Display', body: 'Aptos', mono: 'Consolas' },
  colors: { background: '#070707', surface: '#0F0F0F', accent: '#00FF94', text: '#EDEBE3', muted: '#777777' },
};

test('generic workbook engine emits a styled and structurally verifiable XLSX', async () => {
  const generated = await generateWorkbook({ definition, configuration, localization, currencyProfile, theme, ExcelJS, generatedAt: new Date('2026-07-15T00:00:00.000Z') });
  assert.ok(generated.byteLength > 10_000);
  assert.deepEqual(generated.metrics, {
    sheets: 3, rows: 55, columns: 8, tables: 2, formulas: 51, validations: 50, conditionalFormats: 1, protectedSheets: 2,
  });

  const report = await inspectWorkbook(generated.bytes, {
    definition, configuration, expectedSheetNames: ['Dashboard', 'Transactions', 'Categories'], ExcelJS, JSZip,
  });
  assert.equal(report.status, 'PASS', JSON.stringify(report.issues));
  assert.equal(report.extensions.metrics.sheets, 3);
  assert.ok(report.extensions.metrics.formulas >= generated.metrics.formulas);
  assert.ok(report.extensions.metrics.validations >= 50);
  assert.ok(report.extensions.metrics.filters >= 2);
  assert.ok(report.extensions.metrics.panes >= 3);
  assert.ok(report.extensions.metrics.formattedCurrencyCells > 0);
  assert.equal(validateContract('ValidationReport', report).valid, true);

  const compatibility = compatibilityReport(definition, configuration, report, { evidence: {
    'excel-desktop': { version: 'Microsoft 365', status: 'PASS', checks: ['Open/save smoke passed.'], limitations: [] },
    'excel-web': { version: null, status: 'PASS', checks: ['Feature compatibility profile passed.'], limitations: [] },
  }, generatedAt: '2026-07-15T00:00:00.000Z' });
  assert.equal(validateContract('CompatibilityReport', compatibility).valid, true);
  const quality = scoreProduct({
    definition, definitionReport: { status: 'PASS' }, configurationReport: { status: 'PASS' }, workbookReport: report,
    compatibilityReport: compatibility, generatedAt: '2026-07-15T00:00:00.000Z',
  });
  assert.equal(quality.status, 'PASS');
  assert.ok(quality.score >= 90);
  assert.equal(validateContract('QualityReport', quality).valid, true);

  const reread = new ExcelJS.Workbook();
  await reread.xlsx.load(generated.bytes);
  assert.equal(reread.getWorksheet('Dashboard').getCell('B5').formula, "SUM('Transactions'!$D$5:$D$54)");
  assert.equal(reread.getWorksheet('Transactions').getCell('E5').formula, 'IF(COUNTA(A5:D5)=0,"",IFERROR(C5-D5,0))');
  assert.equal(reread.getWorksheet('Transactions').getCell('B5').dataValidation.type, 'list');
  assert.equal(reread.getWorksheet('Transactions').getCell('B5').dataValidation.formulae[0], "'Categories'!$A$5:$A$8");
  assert.equal(reread.getWorksheet('Transactions').getCell('C5').protection.locked, false);
  assert.equal(reread.getWorksheet('Transactions').getCell('E5').protection.locked, true);
  assert.ok(reread.getWorksheet('Transactions').sheetProtection);
});

test('empty-row guards exclude calculated columns between input columns', async () => {
  const interleavedDefinition = structuredClone(definition);
  interleavedDefinition.sheets[1].columns = [
    column('date', 'date', 'input'),
    column('variance', 'formula', 'calculated'),
    column('category', 'string', 'input', 'category-list'),
    column('budget', 'currency', 'input'),
    column('amount', 'currency', 'input'),
  ];

  const generated = await generateWorkbook({
    definition: interleavedDefinition,
    configuration,
    localization,
    currencyProfile,
    theme,
    ExcelJS,
    generatedAt: new Date('2026-07-15T00:00:00.000Z'),
  });
  const reread = new ExcelJS.Workbook();
  await reread.xlsx.load(generated.bytes);

  assert.equal(
    reread.getWorksheet('Transactions').getCell('B5').formula,
    'IF(COUNTA(A5,C5:E5)=0,"",IFERROR(D5-E5,0))',
  );
});

test('formula registry rejects unknown executable behavior fail-closed', async () => {
  const unsafe = structuredClone(definition);
  unsafe.sheets[0].formulas[0].operation = 'RAW_EVAL';
  unsafe.formulas[0].operation = 'RAW_EVAL';
  await assert.rejects(
    generateWorkbook({ definition: unsafe, configuration, localization, currencyProfile, theme, ExcelJS }),
    error => error.code === 'UNSUPPORTED_FORMULA_OPERATION',
  );
});

test('native compatibility probe certifies the exact workbook bytes that are packaged', async () => {
  const factory = createFactoryRuntime({ definitions: productDefinitions, locales, currencies, themes });
  const productConfiguration = factory.configuration('budget-planner-basic');
  const fixedTimestamp = '2026-07-15T00:00:00.000Z';
  let probedSha256 = null;
  const result = await factory.generate(productConfiguration, {
    ExcelJS,
    JSZip,
    generatedAt: fixedTimestamp,
    allowSyntheticListingImagesForReview: true,
    compatibilityProbe: async ({ workbookBytes, validationReport, generatedAt }) => {
      probedSha256 = await sha256Hex(workbookBytes);
      assert.equal(validationReport.generatedAt, fixedTimestamp);
      assert.equal(generatedAt, fixedTimestamp);
      return {
        'excel-desktop': {
          version: 'test-native-probe',
          status: 'PASS',
          checks: ['Exact byte sequence accepted by the injected native probe.'],
          limitations: ['Test probe only; production evidence is generated by Microsoft Excel COM.'],
        },
      };
    },
  });

  const packagedWorkbook = result.package.files.get(`product/${result.package.workbookFilename}`);
  assert.ok(packagedWorkbook);
  assert.equal(await sha256Hex(result.workbook.bytes), probedSha256);
  assert.equal(await sha256Hex(packagedWorkbook.bytes), probedSha256);
  assert.equal(result.validationReport.generatedAt, fixedTimestamp);
  assert.equal(result.qualityReport.generatedAt, fixedTimestamp);
  assert.equal(result.compatibilityReport.generatedAt, fixedTimestamp);
  assert.equal(result.compatibilityReport.status, 'PASS');
  assert.equal(result.package.generatedManifest.releaseStatus, 'READY_FOR_REVIEW');
  assert.equal(result.package.releaseManifest.status, 'READY_FOR_REVIEW');
});
