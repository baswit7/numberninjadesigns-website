import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { validateProductDefinition } from '../src/contracts/index.js';
import { createBatchPlan, variantKey } from '../src/engines/batch-engine.js';
import { createFactoryRuntime } from '../src/factory-runtime.js';
import currencies from '../src/currencies/index.mjs';
import locales, { productionLocaleIds, requiredMessageKeys } from '../src/locales/index.mjs';
import { productDefinitionById, productDefinitions, productionProductDefinitions } from '../src/products/index.mjs';
import themes, { resolveWorkbookTheme, themeIds } from '../src/themes/index.mjs';

const GENERATED_AT = '2026-07-15T00:00:00.000Z';
const factory = createFactoryRuntime({ definitions: productDefinitions, locales, currencies, themes });

function luminance(hex) {
  const channels = String(hex).replace('#', '').match(/../g).map(value => Number.parseInt(value, 16) / 255);
  const linear = channels.map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(left, right) {
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function customerVisibleKeys(definition) {
  const keys = new Set();
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [property, child] of Object.entries(value)) {
      if (/Key$/u.test(property) && typeof child === 'string') keys.add(child);
      if (/Keys$/u.test(property) && Array.isArray(child)) child.filter(item => typeof item === 'string').forEach(item => keys.add(item));
      visit(child);
    }
  };
  visit(definition);
  for (const sheet of definition.sheets) {
    if (sheet.type === 'dashboard') sheet.formulas.forEach(formula => keys.add(`metrics.${formula.target}`));
    for (const rule of sheet.validations) if (rule.extensions?.translateValues) rule.values.forEach(key => keys.add(key));
    if (sheet.formulas.some(formula => JSON.stringify(formula.parameters).includes('MONTH_EQUALS'))) {
      for (const month of ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']) keys.add(`values.month.${month}`);
    }
  }
  return [...keys].sort();
}

test('Professional and Ultimate are contract-valid, tiered production definitions', () => {
  const cases = [
    ['budget-planner-professional', 'professional', 4, 11],
    ['budget-planner-ultimate', 'ultimate', 7, 24],
  ];
  for (const [id, tier, minimumCharts, minimumSheets] of cases) {
    const definition = productDefinitionById[id];
    assert.ok(definition, `${id} must be registered`);
    assert.equal(validateProductDefinition(definition).valid, true);
    assert.equal(definition.status, 'active');
    assert.equal(definition.extensions.tier, tier);
    assert.deepEqual(definition.supportedLocales, ['nl-NL', 'en-US', 'en-GB', 'de-DE']);
    assert.deepEqual(definition.extensions.supportedAppearances, ['light', 'dark']);
    assert.ok(definition.sheets.length >= minimumSheets);
    assert.equal(new Set(definition.extensions.moduleIds).size, definition.extensions.moduleIds.length);
    assert.ok(definition.extensions.moduleIds.length >= minimumSheets);
    const charts = definition.sheets.flatMap(sheet => sheet.extensions?.charts ?? []);
    assert.equal(charts.length, minimumCharts);
    assert.ok(charts.every(chart => ['bar', 'column', 'doughnut', 'line'].includes(chart.type)));
    assert.ok(charts.every(chart => chart.titleKey && chart.categories && chart.series.length > 0));
  }
});

test('six preserved palettes resolve to accessible light and true-dark workbook themes', () => {
  assert.deepEqual(themeIds, ['executive-navy', 'modern-minimal', 'warm-neutral', 'sage-finance', 'soft-pastel', 'lavender-balance']);
  for (const id of themeIds) {
    assert.equal(resolveWorkbookTheme(id, 'light'), themes[id]);
    const dark = resolveWorkbookTheme(id, 'dark');
    assert.equal(dark.id, id);
    assert.equal(dark.extensions.appearance, 'dark');
    for (const [foreground, background] of [
      ['text', 'background'], ['text', 'surface'], ['inputText', 'inputFill'], ['formulaText', 'formulaFill'],
      ['successText', 'successFill'], ['warningText', 'warningFill'], ['errorText', 'errorFill'],
    ]) assert.ok(contrast(dark.colors[foreground], dark.colors[background]) >= 4.5, `${id} ${foreground}/${background}`);
  }
});

test('every active product locale resolves customer-visible semantic keys without fallback', () => {
  assert.deepEqual(productionLocaleIds, ['nl-NL', 'en-US', 'en-GB', 'de-DE']);
  for (const locale of productionLocaleIds) {
    const bundle = locales[locale];
    assert.equal(bundle.status, 'active');
    assert.equal(bundle.fallbackLocale, null);
    assert.deepEqual(Object.keys(bundle.messages).sort(), requiredMessageKeys);
    for (const definition of productionProductDefinitions) {
      for (const key of customerVisibleKeys(definition)) {
        assert.ok(Object.hasOwn(bundle.messages, key), `${definition.id}:${locale}:${key}`);
        assert.ok(bundle.messages[key].trim(), `${definition.id}:${locale}:${key} is empty`);
        assert.notEqual(bundle.messages[key], key, `${definition.id}:${locale}:${key} is untranslated`);
      }
    }
  }
  assert.equal(locales['fr-FR'].status, 'beta');
  assert.equal(locales['fr-FR'].fallbackLocale, 'en-US');
});

test('Basic, Professional and Ultimate default filenames carry tier, locale, year and appearance', () => {
  const cases = [
    ['budget-planner-basic', 'nl-NL', 'light', 'basic-budget-planner-nl-NL-2026-light.xlsx'],
    ['budget-planner-professional', 'en-GB', 'dark', 'professional-budget-planner-en-GB-2026-dark.xlsx'],
    ['budget-planner-ultimate', 'de-DE', 'light', 'ultimate-budget-planner-de-DE-2026-light.xlsx'],
    ['budget-planner-ultimate', 'nl-NL', 'dark', 'ultimate-budget-planner-nl-NL-2026-dark.xlsx'],
  ];
  for (const [productId, locale, productAppearance, expected] of cases) {
    const configuration = factory.configuration(productId, { locale, year: 2026, extensions: { productAppearance } });
    assert.equal(configuration.filename, expected);
  }
});

test('batch planning treats workbook appearance as an independent collision-safe dimension', () => {
  const plan = createBatchPlan({
    productIds: ['budget-planner-professional'],
    locales: ['nl-NL'],
    currencies: ['EUR'],
    themeIds: ['sage-finance'],
    appearances: ['light', 'dark'],
    capacities: [50],
    outputs: ['workbook'],
  });
  assert.equal(plan.count, 2);
  assert.deepEqual(plan.variants.map(variant => variant.productAppearance), ['light', 'dark']);
  assert.equal(new Set(plan.variants.map(variantKey)).size, 2);
});

test('Professional and Ultimate emit real localized OOXML charts in light and dark workbooks', async () => {
  const cases = [
    ['budget-planner-professional', 'nl-NL', 'light', 4],
    ['budget-planner-professional', 'nl-NL', 'dark', 4],
    ['budget-planner-ultimate', 'nl-NL', 'light', 7],
    ['budget-planner-ultimate', 'nl-NL', 'dark', 7],
    ['budget-planner-ultimate', 'de-DE', 'light', 7],
    ['budget-planner-ultimate', 'de-DE', 'dark', 7],
  ];
  for (const [productId, locale, productAppearance, expectedCharts] of cases) {
      const configuration = factory.configuration(productId, {
        locale, currency: 'EUR', themeId: 'sage-finance', inputCapacity: 50,
        extensions: { productAppearance },
        outputOptions: { package: false, customerDocs: false, listing: false, imageManifests: false },
      });
      const result = await factory.generate(configuration, { ExcelJS, JSZip, generatedAt: GENERATED_AT });
      assert.equal(result.validationReport.status, 'PASS', JSON.stringify(result.validationReport.issues));
      assert.equal(result.workbook.metrics.charts, expectedCharts);
      assert.equal(result.validationReport.extensions.details.configuration.productAppearance, productAppearance);
      assert.equal(result.validationReport.extensions.details.zip.chartParts, expectedCharts);
      assert.equal(result.validationReport.extensions.details.zip.missingRelationshipTargets.length, 0);

      const zip = await JSZip.loadAsync(result.workbook.bytes);
      const chartParts = Object.keys(zip.files).filter(path => /^xl\/charts\/chart\d+\.xml$/.test(path));
      assert.equal(chartParts.length, expectedCharts);
      const chartXml = [];
      for (const path of chartParts) {
        const xml = await zip.file(path).async('string');
        chartXml.push(xml);
        assert.match(xml, /<c:chartSpace\b/);
        assert.match(xml, /<c:ser\b/);
        assert.doesNotMatch(xml, /#REF!|\[[^\]]+\.xlsx\]/i);
      }

      const reread = new ExcelJS.Workbook();
      await reread.xlsx.load(result.workbook.bytes);
      assert.equal(reread.worksheets.length, result.definition.sheets.length);
      assert.ok(reread.worksheets.some(worksheet => worksheet.getCell('A1').value === configuration.title));
      assert.equal(configuration.title, locales[locale].messages[result.definition.nameKey]);
      assert.deepEqual(reread.worksheets.map(sheet => sheet.name), result.definition.sheets.map(sheet => locales[locale].messages[sheet.nameKey]));
      for (const chart of result.definition.sheets.flatMap(sheet => sheet.extensions?.charts ?? [])) {
        assert.ok(chartXml.some(xml => xml.includes(locales[locale].messages[chart.titleKey])), `${locale}:${chart.titleKey}`);
      }
  }
});
