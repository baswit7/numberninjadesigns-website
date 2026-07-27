import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { resolveCategoryProfile } from '../src/engines/category-engine.js';
import { createFactoryRuntime } from '../src/factory-runtime.js';
import { currencyCatalog } from '../src/currencies/index.mjs';
import { localeCatalog } from '../src/locales/index.mjs';
import { productDefinitions } from '../src/products/index.mjs';
import { themeCatalog } from '../src/themes/index.mjs';
import { generateWorkbook } from '../src/engines/workbook-engine.js';

const factory = createFactoryRuntime({ definitions: productDefinitions, locales: localeCatalog, currencies: currencyCatalog, themes: themeCatalog });
const productId = 'budget-planner-professional';
const definition = factory.resolveProduct(productId);

function professionalSelections(overrides = {}) {
  return {
    ...definition.defaultConfiguration,
    locale: 'en-US',
    currency: 'USD',
    themeId: 'sage-finance',
    inputCapacity: 100,
    categoryOverrides: [],
    extensions: { ...definition.defaultConfiguration.extensions, productAppearance: 'light' },
    ...overrides,
  };
}

test('every selectable XLSX, DOCX and ZIP product starts with at least ten relevant categories', () => {
  const selectable = productDefinitions.filter(candidate => candidate.status === 'active' || candidate.extensions?.releaseCandidate === true);
  for (const candidate of selectable) {
    const configuration = factory.configuration(candidate.id);
    assert.ok(configuration.categoryOverrides.length >= 10, `${candidate.id} has ${configuration.categoryOverrides.length} categories`);
    assert.equal(configuration.extensions.categoryResolution.source, 'AUTO', candidate.id);
  }

  const wedding = factory.configuration('wedding-planner-release-candidate');
  assert.deepEqual(wedding.categoryOverrides.slice(0, 10), [
    'Locatie', 'Catering', 'Fotografie', 'Videografie', 'Muziek en DJ',
    'Bloemen en decoratie', 'Kleding', 'Ringen', 'Uitnodigingen en drukwerk', 'Vervoer',
  ]);
});

test('Professional en-US USD resolves its canonical category profile before validation and preview', () => {
  const configuration = factory.configuration(productId, professionalSelections());
  assert.equal(definition.extensions.categoryProfileId, 'budget-planner-professional-categories-v1');
  assert.deepEqual(configuration.categoryOverrides, [
    'Salary', 'Freelance', 'Housing', 'Utilities', 'Groceries', 'Transport', 'Insurance', 'Personal', 'Savings',
    'Healthcare',
  ]);
  assert.deepEqual(configuration.extensions.categoryResolution, {
    schemaVersion: '1.0.0',
    profileId: definition.extensions.categoryProfileId,
    source: 'AUTO',
    locale: 'en-US',
    currency: 'USD',
    tier: 'professional',
    count: 10,
  });

  const validation = factory.validate(configuration);
  assert.equal(validation.valid, true, JSON.stringify(validation.findings));
  assert.equal(validation.reports.find(report => report.id === 'configuration-semantics').report.status, 'PASS');

  const preview = factory.preview(configuration);
  const categoryRows = preview.sheets.find(sheet => sheet.id === 'categories').rows;
  assert.deepEqual(categoryRows.map(row => row.category), configuration.categoryOverrides.slice(0, 5));
});

test('preview and XLSX export consume the same normalized Professional categories without duplication', async () => {
  const configuration = factory.configuration(productId, professionalSelections());
  const validation = factory.validate(configuration);
  const previewCategories = factory.preview(configuration).sheets.find(sheet => sheet.id === 'categories').rows.map(row => row.category);
  const generated = await generateWorkbook({
    definition: validation.definition,
    configuration,
    localization: validation.localization,
    currencyProfile: validation.currencyProfile,
    theme: validation.theme,
    ExcelJS,
    JSZip,
    generatedAt: '2026-07-16T00:00:00.000Z',
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(generated.bytes);
  const sheet = workbook.getWorksheet('Categories');
  const exportedCategories = configuration.categoryOverrides.map((_, index) => sheet.getCell(5 + index, 1).value);
  assert.deepEqual(exportedCategories, configuration.categoryOverrides);
  assert.deepEqual(exportedCategories.slice(0, previewCategories.length), previewCategories);
  assert.equal(new Set(exportedCategories).size, exportedCategories.length);
});

test('empty persisted categories migrate to automatic profile defaults instead of winning over them', () => {
  const persistedState = {
    schemaVersion: '1.0.0',
    ...professionalSelections(),
    categoryOverrides: [],
    extensions: { productAppearance: 'light', paletteId: 'sage-finance' },
  };
  const configuration = factory.configuration(productId, {}, { persistedState });
  assert.equal(configuration.categoryOverrides.length, 10);
  assert.equal(configuration.extensions.categoryResolution.source, 'AUTO');
  assert.equal(factory.validate(configuration).valid, true);
});

test('non-empty legacy categories remain manual while clearing them restores automatic defaults', () => {
  const manual = factory.configuration(productId, professionalSelections({
    categoryOverrides: ['Primary income', 'Housing'],
    extensions: {
      ...definition.defaultConfiguration.extensions,
      productAppearance: 'light',
      categoryResolution: { source: 'MANUAL' },
    },
  }));
  assert.deepEqual(manual.categoryOverrides, ['Primary income', 'Housing']);
  assert.equal(manual.extensions.categoryResolution.source, 'MANUAL');

  const restored = factory.configuration(productId, {
    ...manual,
    categoryOverrides: [],
    extensions: { ...manual.extensions, categoryResolution: { ...manual.extensions.categoryResolution, source: 'MANUAL' } },
  });
  assert.equal(restored.categoryOverrides.length, 10);
  assert.equal(restored.extensions.categoryResolution.source, 'AUTO');
});

test('semantic validation rejects an unresolved category configuration with exact findings', () => {
  const unresolved = {
    ...factory.configuration(productId, professionalSelections()),
    categoryOverrides: [],
    extensions: { productAppearance: 'light', paletteId: 'sage-finance' },
  };
  const validation = factory.validate(unresolved);
  const semantic = validation.reports.find(report => report.id === 'configuration-semantics').report;
  assert.equal(validation.valid, false);
  assert.deepEqual(semantic.issues.map(issue => issue.code), [
    'CONFIG_CATEGORY_MINIMUM',
    'CONFIG_CATEGORY_PROFILE_EMPTY',
    'CONFIG_CATEGORY_RESOLUTION_MISSING',
  ]);
});

test('category profile matching is case-insensitive for tier and currency-agnostic for USD', () => {
  const profile = resolveCategoryProfile({
    productDefinition: definition,
    locale: 'en-US',
    currency: 'USD',
    tier: 'Professional',
    translate: factory.translator('en-US'),
  });
  assert.equal(profile.tier, 'professional');
  assert.equal(profile.currencyFiltered, false);
  assert.equal(profile.categories.length, 10);
  assert.throws(() => resolveCategoryProfile({
    productDefinition: definition,
    locale: 'en-US',
    currency: 'USD',
    tier: 'ultimate',
    translate: factory.translator('en-US'),
  }), error => error.code === 'CATEGORY_TIER_MISMATCH');
});
