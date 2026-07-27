import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateLocalizationBundle,
  validateProductDefinition,
  validateThemeDefinition,
} from '../src/contracts/index.js';
import { currencyCatalog, currencyIds, requiredCurrencyMatrix } from '../src/currencies/index.mjs';
import {
  commercialMessageCatalog,
  localeCatalog,
  previewLocaleIds,
  productionLocaleIds,
  requiredCommercialMessageKeys,
  requiredMessageKeys,
  requiredUiMessageKeys,
  uiMessageCatalog,
} from '../src/locales/index.mjs';
import {
  betaProductDefinitions,
  careerProductDefinitions,
  defaultVisibleProductDefinitions,
  productDefinitionById,
  productDefinitions,
  productionProductDefinitions,
  releaseCandidateProductDefinitions,
} from '../src/products/index.mjs';
import { themeCatalog, themeIds } from '../src/themes/index.mjs';

const ACTIVE_PRODUCT_IDS = Object.freeze([
  'budget-planner-basic',
  'budget-planner-professional',
  'budget-planner-ultimate',
  'monthly-budget-planner',
  'debt-snowball-planner',
  'savings-goal-tracker',
  'subscription-tracker',
]);
const BETA_PRODUCT_IDS = Object.freeze([
  'annual-budget-planner',
  'debt-avalanche-planner',
  'sinking-funds-planner',
  'bill-payment-calendar',
  'net-worth-tracker',
  'side-hustle-profit-tracker',
  'small-business-income-expense-tracker',
]);
const LISTING_IMAGE_IDS = Object.freeze([
  'hero',
  'dashboard-overview',
  'monthly-budget',
  'key-features',
  'light-dark-comparison',
  'whats-included',
  'language-currency-options',
  'how-it-works',
  'workbook-previews',
  'digital-download',
  'excel-google-sheets',
  'paycheck-planning',
  'debt-payoff',
  'savings-goals',
  'net-worth',
  'bill-subscriptions',
  'privacy-no-account',
  'support-promise',
  'buyer-fit',
  'value-stack',
]);
const LISTING_IMAGE_FILENAMES = Object.freeze(LISTING_IMAGE_IDS.map((id, index) => `${String(index + 1).padStart(2, '0')}-${id}.png`));

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => Number.parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function visitObjects(value, visitor, path = 'parameters') {
  if (!value || typeof value !== 'object') return;
  visitor(value, path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitObjects(item, visitor, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) visitObjects(child, visitor, `${path}.${key}`);
}

const placeholders = value => [...value.matchAll(/\{([a-zA-Z][\w]*)\}/g)].map(match => match[1]).sort();
const humanizeFeatureId = value => String(value).replace(/[._-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());

const ISO_DATE_LITERAL = /^\d{4}-\d{2}-\d{2}$/;
const CUSTOMER_FORMULA_LITERAL_FIELDS = new Set(['criteria', 'right', 'value', 'whenFalse', 'whenTrue']);
const LEGACY_CUSTOMER_LITERALS = new Set([
  'ACTIVE',
  'CANCEL_CANDIDATE',
  'EXPENSE',
  'INCOME',
  'JAN',
  'ON_TRACK',
  'OVER_BUDGET',
  'PAUSED',
  'SAVINGS',
  'Active',
  'Auto Loan',
  'Credit Card',
  'Medical Debt',
  'On track',
  'Over budget',
  'Personal Loan',
  'Review for cancellation',
  'Student Loan',
]);
const ALLOWED_CONFIGURATION_PATHS = new Set([
  'currency',
  'extensions.productAppearance',
  'inputCapacity',
  'locale',
  'market',
  'productId',
  'sampleDataEnabled',
  'themeId',
  'year',
]);

function assertLocalizedValue(value, label) {
  assert.deepEqual(Object.keys(value).sort(), ['fallback', 'messageKey'], `${label} localized-value shape`);
  assert.equal(typeof value.messageKey, 'string', `${label} message key`);
  assert.ok(value.messageKey.trim(), `${label} non-empty message key`);
  assert.equal(typeof value.fallback, 'string', `${label} fallback`);
  assert.ok(value.fallback.trim(), `${label} non-empty fallback`);
  for (const locale of productionLocaleIds) {
    const rendered = localeCatalog[locale].messages[value.messageKey];
    assert.equal(typeof rendered, 'string', `${label}:${locale}:${value.messageKey}`);
    assert.ok(rendered.trim(), `${label}:${locale}:${value.messageKey} renders non-empty`);
    assert.notEqual(rendered, value.messageKey, `${label}:${locale} must not expose the technical message key`);
  }
}

function assertFormulaCustomerLiteralsAreSemantic(value, label, field = '') {
  if (typeof value === 'string') {
    assert.equal(CUSTOMER_FORMULA_LITERAL_FIELDS.has(field), false, `${label}.${field} must use localizedValue`);
    assert.equal(LEGACY_CUSTOMER_LITERALS.has(value), false, `${label}.${field} exposes legacy literal ${value}`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (typeof value.messageKey === 'string') {
    assertLocalizedValue(value, label);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFormulaCustomerLiteralsAreSemantic(item, `${label}[${index}]`, field));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    assertFormulaCustomerLiteralsAreSemantic(child, `${label}.${key}`, key);
  }
}

test('four production locales have complete reviewed key coverage', () => {
  assert.deepEqual(productionLocaleIds, ['nl-NL', 'en-US', 'en-GB', 'de-DE']);
  const canonicalKeys = [...requiredMessageKeys].sort();
  for (const locale of productionLocaleIds) {
    const bundle = localeCatalog[locale];
    assert.equal(validateLocalizationBundle(bundle).valid, true, `${locale} contract`);
    assert.equal(bundle.status, 'active');
    assert.equal(bundle.fallbackLocale, null);
    assert.equal(bundle.extensions.productionReady, true);
    assert.equal(bundle.extensions.coverage, 1);
    assert.equal(bundle.extensions.reviewed, true);
    assert.deepEqual(Object.keys(bundle.messages).sort(), canonicalKeys, `${locale} key coverage`);
    for (const [key, value] of Object.entries(bundle.messages)) {
      assert.equal(typeof value, 'string', `${locale}:${key}`);
      assert.ok(value.trim().length > 0, `${locale}:${key} is empty`);
      assert.doesNotMatch(value, /(?:TODO|TBD|lorem ipsum|placeholder)/i, `${locale}:${key}`);
    }
  }
});

test('prepared locales remain explicitly non-production', () => {
  assert.deepEqual(previewLocaleIds, ['fr-FR', 'es-ES', 'it-IT']);
  for (const locale of previewLocaleIds) {
    const bundle = localeCatalog[locale];
    assert.equal(validateLocalizationBundle(bundle).valid, true, `${locale} contract`);
    assert.equal(bundle.status, 'beta');
    assert.equal(bundle.extensions.productionReady, false);
    assert.equal(bundle.extensions.reviewed, false);
    assert.equal(bundle.fallbackLocale, 'en-US');
  }
  assert.equal(localeCatalog['fr-FR'].extensions.coverage, 1);
  assert.ok(localeCatalog['es-ES'].extensions.coverage < 1);
  assert.ok(localeCatalog['it-IT'].extensions.coverage < 1);
});

test('production UI messages are complete and preserve interpolation contracts', () => {
  assert.ok(requiredUiMessageKeys.length >= 100, 'primary UI key surface is unexpectedly small');
  const expected = [...requiredUiMessageKeys].sort();
  for (const locale of productionLocaleIds) {
    const messages = uiMessageCatalog[locale];
    assert.deepEqual(Object.keys(messages).sort(), expected, `${locale} UI key coverage`);
    for (const key of expected) {
      assert.equal(typeof messages[key], 'string', `${locale}:${key}`);
      assert.ok(messages[key].trim(), `${locale}:${key} is empty`);
      assert.deepEqual(placeholders(messages[key]), placeholders(uiMessageCatalog['en-US'][key]), `${locale}:${key} placeholders`);
      assert.equal(localeCatalog[locale].messages[key], messages[key], `${locale}:${key} bundle value`);
    }
  }
});

test('commercial listing and FAQ copy is reviewed in every production locale', () => {
  assert.deepEqual(requiredCommercialMessageKeys, [
    'listing.bundleSuggestion',
    'listing.digitalNotice',
    'listing.faq.compatibility.answer',
    'listing.faq.compatibility.question',
    'listing.faq.digital.answer',
    'listing.faq.digital.question',
    'listing.faq.privacy.answer',
    'listing.faq.privacy.question',
    'listing.faq.refunds.answer',
    'listing.faq.refunds.question',
    'listing.for',
    'listing.includedFiles',
    'listing.pricePositioning',
    'listing.upsellSuggestion',
    'listing.useCases',
  ]);
  for (const locale of productionLocaleIds) {
    assert.deepEqual(Object.keys(commercialMessageCatalog[locale]).sort(), requiredCommercialMessageKeys, `${locale} commercial keys`);
    for (const key of requiredCommercialMessageKeys) {
      const value = commercialMessageCatalog[locale][key];
      assert.ok(value.trim(), `${locale}:${key}`);
      assert.equal(localeCatalog[locale].messages[key], value);
    }
  }
  for (const locale of productionLocaleIds) {
    const messages = commercialMessageCatalog[locale];
    assert.match(messages['listing.faq.digital.answer'], /digital|digitale|digitaler|numérique/i);
    assert.match(messages['listing.faq.compatibility.answer'], /2019/);
    assert.match(messages['listing.faq.privacy.answer'], /local|lokaal|lokal/i);
    assert.match(messages['listing.faq.refunds.answer'], /marketplace|Marktplatz/i);
  }
});

test('six independent currency profiles cover the required regional matrix', () => {
  assert.deepEqual(currencyIds, ['EUR', 'USD', 'GBP', 'CAD', 'AUD', 'CHF']);
  for (const code of currencyIds) {
    const profile = currencyCatalog[code];
    assert.equal(profile.schemaVersion, '1.0.0');
    assert.equal(profile.id, code);
    assert.equal(profile.code, code);
    assert.equal(profile.decimalDigits, 2);
    assert.ok(['BEFORE', 'AFTER'].includes(profile.symbolPosition));
    assert.ok(profile.workbookNumberFormats.standard.includes('0.00'));
    assert.ok(profile.workbookNumberFormats.accounting.includes('0.00'));
    assert.ok(profile.supportedMarkets.includes(profile.defaultMarket));
    assert.ok(['A4', 'Letter'].includes(profile.regionalDefaults.paperSize));
  }
  assert.deepEqual(requiredCurrencyMatrix, [
    { locale: 'nl-NL', currency: 'EUR', market: 'NL' },
    { locale: 'nl-NL', currency: 'USD', market: 'NL' },
    { locale: 'en-US', currency: 'USD', market: 'US' },
    { locale: 'en-US', currency: 'EUR', market: 'US' },
    { locale: 'en-GB', currency: 'GBP', market: 'GB' },
    { locale: 'de-DE', currency: 'EUR', market: 'DE' },
  ]);
});

test('six semantic themes pass contract and contrast foundations', () => {
  assert.deepEqual(themeIds, ['executive-navy', 'modern-minimal', 'warm-neutral', 'sage-finance', 'soft-pastel', 'lavender-balance']);
  for (const id of themeIds) {
    const theme = themeCatalog[id];
    assert.equal(validateThemeDefinition(theme).valid, true, `${id} contract`);
    assert.equal(theme.status, 'active');
    assert.ok(contrast(theme.colors.text, theme.colors.background) >= 4.5, `${id} body contrast`);
    assert.ok(contrast(theme.colors.inverseText, theme.colors.primary) >= 4.5, `${id} header contrast`);
    assert.ok(contrast(theme.colors.inputText, theme.colors.inputFill) >= 4.5, `${id} input contrast`);
    assert.ok(contrast(theme.colors.formulaText, theme.colors.formulaFill) >= 4.5, `${id} formula contrast`);
    assert.ok(contrast(theme.colors.successText, theme.colors.successFill) >= 4.5, `${id} success contrast`);
    assert.ok(contrast(theme.colors.warningText, theme.colors.warningFill) >= 4.5, `${id} warning contrast`);
    assert.ok(contrast(theme.colors.errorText, theme.colors.errorFill) >= 4.5, `${id} error contrast`);
    assert.notEqual(theme.colors.inputFill, theme.colors.formulaFill, `${id} input/formula recognition`);
    assert.equal(theme.extensions.printProfile.monochromeSafe, true);
    assert.equal(theme.extensions.imageProductionPalette.length, 6);
  }
});

test('catalog exposes seven active products, six release candidates, seven workbook betas and three career betas', () => {
  assert.equal(productDefinitions.length, 23);
  assert.equal(Object.keys(productDefinitionById).length, 23);
  assert.deepEqual(productionProductDefinitions.map(item => item.id), ACTIVE_PRODUCT_IDS);
  assert.deepEqual(betaProductDefinitions.map(item => item.id), BETA_PRODUCT_IDS);
  assert.deepEqual(defaultVisibleProductDefinitions.map(item => item.id), ACTIVE_PRODUCT_IDS);
  for (const definition of productionProductDefinitions) {
    assert.equal(definition.status, 'active');
    assert.equal(definition.version, '1.0.0');
    assert.equal(definition.extensions.defaultVisible, true);
  }
  for (const definition of betaProductDefinitions) {
    assert.equal(definition.status, 'beta');
    assert.equal(definition.version, '0.1.0');
    assert.equal(definition.recommended, false);
    assert.equal(definition.extensions.defaultVisible, false);
  }
  for (const definition of releaseCandidateProductDefinitions) {
    assert.equal(definition.status, 'beta');
    assert.equal(definition.version, '0.9.0');
    assert.equal(definition.recommended, true);
    assert.equal(definition.extensions.releaseCandidate, true);
    assert.equal(definition.extensions.defaultVisible, true);
    assert.equal(definition.extensions.platformProfiles.googleSheets, 'PROVISIONAL_IMPORT_CHECKLIST_REQUIRED');
  }
  assert.deepEqual(careerProductDefinitions.map(item => item.id), [
    'professional-cv-template-pack',
    'motivation-letter-template-pack',
    'complete-job-application-pack',
  ]);
  for (const definition of careerProductDefinitions) {
    assert.equal(definition.status, 'beta');
    assert.equal(definition.version, '0.9.0');
    assert.equal(definition.extensions.defaultVisible, false);
    assert.equal(definition.extensions.approvalRequired, true);
  }
});

test('all twenty-three definitions pass the closed ProductDefinition contract', () => {
  for (const definition of productDefinitions) {
    const report = validateProductDefinition(definition);
    assert.equal(report.valid, true, `${definition.id}: ${JSON.stringify(report.issues)}`);
    assert.equal(definition.schemaVersion, '1.0.0');
    assert.equal(definition.defaultConfiguration.schemaVersion, '1.0.0');
    assert.equal(definition.defaultConfiguration.productId, definition.id);
    assert.equal(definition.defaultConfiguration.productVersion, definition.version);
    assert.equal(definition.defaultConfiguration.inputCapacity, 100);
    assert.ok(Array.isArray(definition.defaultConfiguration.categoryOverrides));
    assert.ok(Object.values(definition.defaultConfiguration.featureFlags).every(value => typeof value === 'boolean'));
    if (definition.outputTypes?.includes('docx')) {
      const hasWorkbook = definition.outputTypes.includes('xlsx');
      assert.ok(definition.defaultConfiguration.filename.endsWith(hasWorkbook ? '.xlsx' : '.docx'));
      assert.equal(definition.defaultConfiguration.outputOptions.documents, true);
      assert.equal(definition.defaultConfiguration.outputOptions.workbook, hasWorkbook);
      assert.ok(definition.documentTemplates.length >= 14);
      assert.ok(definition.documentTemplates.every(template => template.filename.endsWith('.docx')));
      assert.deepEqual(definition.imageSpecifications.map(item => item.id), ['document-preview']);
      assert.ok(definition.compatibility.targets.includes('docx-ooxml'));
      assert.ok(definition.exportProfile.include.includes('documents'));
      assert.equal(definition.qualityRules.reduce((sum, rule) => sum + rule.weight, 0), 1);
      assert.ok(definition.commercialMetadata.keywords.length >= 2);
      continue;
    }
    assert.ok(definition.defaultConfiguration.filename.endsWith('.xlsx'));
    assert.deepEqual(Object.keys(definition.defaultConfiguration.outputOptions).sort(), ['customerDocs', 'imageManifests', 'listing', 'package', 'workbook']);
    assert.ok(definition.sheets.length >= 3);
    assert.ok(definition.formulas.length >= 1);
    assert.ok(definition.validations.length >= 1);
    assert.deepEqual(definition.imageSpecifications.map(item => item.id), LISTING_IMAGE_IDS);
    assert.deepEqual(definition.imageSpecifications.map((item, index) => `${String(index + 1).padStart(2, '0')}-${item.id}.${item.format}`), LISTING_IMAGE_FILENAMES);
    for (const image of definition.imageSpecifications) {
      assert.equal(image.width, 2400, `${definition.id}:${image.id} width`);
      assert.equal(image.height, 1600, `${definition.id}:${image.id} height`);
      assert.equal(image.format, 'png', `${definition.id}:${image.id} format`);
      assert.equal(image.required, true, `${definition.id}:${image.id} required`);
    }
    assert.equal(definition.qualityRules.reduce((sum, rule) => sum + rule.weight, 0), 1);
    assert.ok(definition.commercialMetadata.keywords.length >= 2);
    assert.ok(definition.compatibility.targets.includes('excel-desktop'));
    assert.ok(definition.exportProfile.include.includes('workbook'));
  }
});

test('active product matrix covers every production locale, currency and theme', () => {
  for (const definition of productionProductDefinitions) {
    assert.deepEqual(definition.supportedLocales, productionLocaleIds, `${definition.id} locales`);
    assert.deepEqual(definition.supportedCurrencies, currencyIds, `${definition.id} currencies`);
    assert.deepEqual(definition.supportedThemes, themeIds, `${definition.id} themes`);
    for (const locale of productionLocaleIds) {
      assert.ok(localeCatalog[locale].messages[definition.nameKey], `${definition.id}:${locale}:name`);
      assert.ok(localeCatalog[locale].messages[definition.descriptionKey], `${definition.id}:${locale}:description`);
    }
  }
});

test('all active commercial feature IDs resolve without raw or mixed-language fallback', () => {
  const featureIds = [...new Set(productionProductDefinitions.flatMap(definition => definition.features))].sort();
  const catalogFeatureIds = [...new Set([...productionProductDefinitions, ...releaseCandidateProductDefinitions].flatMap(definition => definition.features))].sort();
  assert.equal(featureIds.length, 44, 'active feature-key surface');
  assert.deepEqual(
    Object.keys(localeCatalog['en-US'].messages).filter(key => key.startsWith('features.')).sort(),
    catalogFeatureIds.map(featureId => `features.${featureId}`),
    'feature localization catalog exactly covers the complete generator catalog',
  );

  for (const definition of productionProductDefinitions) {
    assert.equal(new Set(definition.features).size, definition.features.length, `${definition.id} has unique feature IDs`);
    for (const featureId of definition.features) {
      const messageKey = `features.${featureId}`;
      const fallback = humanizeFeatureId(featureId);
      const translations = Object.fromEntries(productionLocaleIds.map(locale => [locale, localeCatalog[locale].messages[messageKey]]));
      for (const [locale, value] of Object.entries(translations)) {
        assert.equal(typeof value, 'string', `${definition.id}:${locale}:${messageKey}`);
        assert.ok(value.trim(), `${definition.id}:${locale}:${messageKey} is non-empty`);
        assert.notEqual(value, messageKey, `${definition.id}:${locale}:${messageKey} exposes its key`);
        assert.notEqual(value.toLocaleLowerCase(locale), featureId.toLocaleLowerCase(locale), `${definition.id}:${locale}:${messageKey} exposes its raw ID`);
        assert.notEqual(value.toLocaleLowerCase(locale), fallback.toLocaleLowerCase(locale), `${definition.id}:${locale}:${messageKey} uses the humanized fallback`);
      }
      assert.equal(translations['en-GB'], translations['en-US'], `${definition.id}:${messageKey} en-GB coverage`);
      assert.notEqual(translations['nl-NL'], translations['en-US'], `${definition.id}:${messageKey} Dutch may not fall back to English`);
      assert.notEqual(translations['de-DE'], translations['en-US'], `${definition.id}:${messageKey} German may not fall back to English`);
      assert.notEqual(translations['nl-NL'], translations['de-DE'], `${definition.id}:${messageKey} Dutch and German must remain independently reviewed`);
    }
  }
});

test('active customer-visible samples, lists and formula literals are semantic in every production locale', () => {
  for (const definition of productionProductDefinitions) {
    for (const sheet of definition.sheets) {
      for (const [rowIndex, row] of sheet.sampleRows.entries()) {
        for (const [columnId, value] of Object.entries(row)) {
          const label = `${definition.id}:${sheet.id}:sampleRows[${rowIndex}].${columnId}`;
          if (value == null || ['number', 'boolean'].includes(typeof value)) continue;
          if (typeof value === 'string') {
            assert.match(value, ISO_DATE_LITERAL, `${label} must be an ISO date or localizedValue`);
            continue;
          }
          if (Object.hasOwn(value, 'configurationPath')) {
            assert.equal(sheet.id, 'configuration', `${label} configuration reference belongs on configuration sheet`);
            assert.deepEqual(Object.keys(value), ['configurationPath'], `${label} configuration-reference shape`);
            assert.ok(ALLOWED_CONFIGURATION_PATHS.has(value.configurationPath), `${label} allowed technical configuration path`);
            continue;
          }
          assertLocalizedValue(value, label);
        }
      }

      for (const rule of sheet.validations) {
        if (!Array.isArray(rule.values)) continue;
        const label = `${definition.id}:${sheet.id}:${rule.id}`;
        assert.equal(rule.extensions?.translateValues, true, `${label} list values must be translated`);
        for (const messageKey of rule.values) {
          assert.equal(typeof messageKey, 'string', `${label} semantic list key`);
          assert.match(messageKey, /^values\./, `${label} uses values.* keys`);
          for (const locale of productionLocaleIds) {
            const rendered = localeCatalog[locale].messages[messageKey];
            assert.equal(typeof rendered, 'string', `${label}:${locale}:${messageKey}`);
            assert.ok(rendered.trim(), `${label}:${locale}:${messageKey} renders non-empty`);
            assert.notEqual(rendered, messageKey, `${label}:${locale} must not expose the technical list key`);
          }
        }
      }

      for (const formula of sheet.formulas) {
        assertFormulaCustomerLiteralsAreSemantic(
          formula.parameters,
          `${definition.id}:${sheet.id}:${formula.id}.parameters`,
        );
      }
    }
  }
});

test('sheet contracts contain nested data-only formulas and validations', () => {
  for (const definition of productDefinitions) {
    for (const sheet of definition.sheets ?? []) {
      assert.equal(sheet.schemaVersion, '1.0.0');
      assert.ok(Number.isInteger(sheet.inputRows));
      assert.ok(typeof sheet.autoFilter === 'boolean' || typeof sheet.autoFilter === 'string');
      assert.deepEqual(Object.keys(sheet.print).sort(), ['fitToHeight', 'fitToWidth', 'orientation', 'paperSize']);
      for (const column of sheet.columns) {
        assert.equal(column.schemaVersion, '1.0.0');
        assert.ok(Object.hasOwn(column, 'validationId'));
        assert.ok(localeCatalog['en-US'].messages[column.labelKey], `${definition.id}:${column.labelKey}`);
      }
      for (const item of sheet.formulas) {
        assert.equal(item.schemaVersion, '1.0.0');
        assert.equal(item.sheetId, sheet.id);
        assert.ok(item.parameters && typeof item.parameters === 'object');
        assert.doesNotMatch(JSON.stringify(item.parameters), /"=[^"\n]+"/, `${definition.id}:${item.id} raw formula`);
        if (item.fillDirection === 'down') assert.equal(item.inputRowsBound, true);
      }
      for (const rule of sheet.validations) {
        assert.equal(rule.schemaVersion, '1.0.0');
        assert.equal(rule.sheetId, sheet.id);
        if (Object.hasOwn(rule, 'source')) assert.equal(typeof rule.source, 'string');
        if (Object.hasOwn(rule, 'values')) assert.ok(rule.values.every(value => ['string', 'number', 'boolean'].includes(typeof value)));
      }
    }
  }
});

test('formula and validation references resolve without direct circular targets', () => {
  for (const definition of productDefinitions) {
    const sheets = new Map((definition.sheets ?? []).map(item => [item.id, item]));
    const formulas = new Map((definition.formulas ?? []).map(item => [item.id, item]));
    const columnsFor = sheetId => new Set((sheets.get(sheetId)?.columns ?? []).map(item => item.id));

    for (const item of definition.formulas ?? []) {
      const currentColumns = columnsFor(item.sheetId);
      const criteriaSheetId = item.parameters.sumRange?.sheetId ?? item.parameters.range?.sheetId;

      visitObjects(item.parameters, (reference, path) => {
        for (const [key, value] of Object.entries(reference)) {
          if (key.endsWith('SheetId')) {
            assert.ok(sheets.has(value), `${definition.id}:${item.id}:${path}.${key} -> missing sheet ${value}`);
          }
          if (key === 'formulaId') {
            assert.ok(formulas.has(value), `${definition.id}:${item.id}:${path}.${key} -> missing formula ${value}`);
          }
          if (key.endsWith('ColumnId') && key !== 'columnId') {
            assert.ok(currentColumns.has(value), `${definition.id}:${item.id}:${path}.${key} -> missing column ${value}`);
            assert.notEqual(value, item.target, `${definition.id}:${item.id}:${path}.${key} directly references its target`);
          }
        }

        if (!Object.hasOwn(reference, 'columnId')) return;
        const referencedSheetId = reference.sheetId
          ?? reference.sourceSheetId
          ?? (path.includes('.criteria[') ? criteriaSheetId : item.sheetId);
        assert.ok(referencedSheetId, `${definition.id}:${item.id}:${path} has no resolvable sheet`);
        assert.ok(columnsFor(referencedSheetId).has(reference.columnId), `${definition.id}:${item.id}:${path}.columnId -> missing ${referencedSheetId}.${reference.columnId}`);
        const isPreviousOrNextRow = Number.isInteger(reference.rowOffset) && reference.rowOffset !== 0;
        if (referencedSheetId === item.sheetId && !isPreviousOrNextRow) {
          assert.notEqual(reference.columnId, item.target, `${definition.id}:${item.id}:${path}.columnId directly references its target`);
        }
      });
    }

    for (const rule of definition.validations ?? []) {
      if (!rule.source?.includes('.')) continue;
      const [sheetId, rawColumnId] = rule.source.split('.');
      const [columnId] = rawColumnId.split('#');
      if (sheetId === 'configuration') continue;
      assert.ok(sheets.has(sheetId), `${definition.id}:${rule.id} -> missing source sheet ${sheetId}`);
      assert.ok(columnsFor(sheetId).has(columnId), `${definition.id}:${rule.id} -> missing source column ${rule.source}`);
    }
  }
});

test('active products ship safe examples, populated lookups and professional instructions', () => {
  for (const definition of productionProductDefinitions) {
    assert.equal(definition.defaultConfiguration.sampleDataEnabled, true, `${definition.id} sample-data default`);
    const populatedLookups = definition.sheets.filter(sheet => sheet.type === 'lookup' && sheet.sampleRows.length > 0);
    assert.ok(populatedLookups.length >= 1, `${definition.id} populated lookup`);

    const instructions = definition.sheets.find(sheet => sheet.id === 'instructions');
    assert.ok(instructions, `${definition.id} instructions`);
    assert.equal(instructions.type, 'report');
    assert.equal(instructions.sampleRows.length, 5);

    for (const sheet of definition.sheets) {
      const columnIds = new Set(sheet.columns.map(column => column.id));
      if (sheet.type === 'input') {
        assert.ok(sheet.sampleRows.length >= 1 && sheet.sampleRows.length <= Math.min(sheet.inputRows, 100), `${definition.id}:${sheet.id} has a bounded professional example set`);
      }
      for (const [rowIndex, row] of sheet.sampleRows.entries()) {
        for (const [key, value] of Object.entries(row)) {
          assert.ok(columnIds.has(key), `${definition.id}:${sheet.id}:${rowIndex} unknown sample column ${key}`);
          const visibleValue = typeof value === 'string' ? value : value?.fallback;
          if (value && typeof value === 'object') {
            if (Object.hasOwn(value, 'configurationPath')) {
              assert.ok(ALLOWED_CONFIGURATION_PATHS.has(value.configurationPath), `${definition.id}:${sheet.id}:${rowIndex}:${key} configuration reference`);
            } else {
              assert.equal(typeof value.messageKey, 'string', `${definition.id}:${sheet.id}:${rowIndex}:${key} message key`);
              assert.ok(localeCatalog['en-US'].messages[value.messageKey], `${definition.id}:${sheet.id}:${rowIndex}:${key} localized sample key`);
            }
          }
          if (typeof visibleValue === 'string') {
            assert.doesNotMatch(visibleValue, /^[=+\-@]/, `${definition.id}:${sheet.id}:${rowIndex}:${key} formula-like sample`);
            assert.doesNotMatch(visibleValue, /(?:TODO|TBD|lorem ipsum|placeholder)/i, `${definition.id}:${sheet.id}:${rowIndex}:${key}`);
          }
        }
      }
    }

    const categories = definition.sheets.find(sheet => sheet.id === 'categories');
    if (categories) {
      const categoryType = row => String(row.type?.fallback ?? row.type ?? '').toUpperCase();
      assert.ok(categories.sampleRows.filter(row => categoryType(row) === 'INCOME').length >= 1, `${definition.id} income category`);
      assert.ok(categories.sampleRows.filter(row => ['EXPENSE', 'SAVINGS'].includes(categoryType(row))).length >= 6, `${definition.id} expense/savings categories`);
    }
  }
});

test('Budget Planner Basic exposes budget, actual, category, month and year analysis', () => {
  const definition = productDefinitionById['budget-planner-basic'];
  assert.deepEqual(definition.sheets.map(item => item.id), ['dashboard', 'income', 'expenses', 'categories', 'category-analysis', 'instructions']);
  assert.ok(definition.features.includes('budget-vs-actual'));
  assert.ok(definition.features.includes('category-analysis'));
  assert.ok(definition.features.includes('monthly-totals'));
  assert.ok(definition.features.includes('annual-totals'));
  const operations = new Set(definition.formulas.map(item => item.operation));
  for (const operation of ['SUM', 'SUMIF', 'SUMIFS', 'SUBTRACT', 'IFERROR']) assert.ok(operations.has(operation), operation);
  const formulaIds = new Set(definition.formulas.map(item => item.id));
  for (const id of ['total-income', 'total-expenses', 'monthly-income', 'monthly-expenses', 'analysis-budgeted', 'analysis-actual', 'analysis-variance']) assert.ok(formulaIds.has(id), id);
  const analysis = definition.sheets.find(item => item.id === 'category-analysis');
  assert.ok(analysis.sampleRows.length >= 8);
  assert.deepEqual(analysis.columns.map(item => item.id), ['category', 'budgeted', 'actual', 'variance']);
  for (const id of ['income', 'expenses']) {
    const current = definition.sheets.find(item => item.id === id);
    assert.equal(current.inputRows, 100);
    assert.equal(current.freeze.rows, 1);
    assert.equal(current.autoFilter, true);
    assert.ok(current.validations.some(rule => rule.type === 'list'));
  }
});
