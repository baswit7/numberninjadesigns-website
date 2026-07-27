import { buildCommercialPackage } from './commercial/package-engine.js';
import { validateContract } from './contracts/index.js';
import { resolveProductConfiguration } from './engines/configuration-engine.js';
import { generateDocuments } from './engines/document-engine.js';
import { buildPreviewModel } from './engines/preview-engine.js';
import { scoreProduct } from './engines/quality-engine.js';
import {
  compatibilityReport,
  inspectWorkbook,
  validateConfiguration,
} from './engines/validation-engine.js';
import {
  createTranslator,
  expectedSheetNames,
  generateWorkbook,
} from './engines/workbook-engine.js';
import { ProductRegistry } from './registry/index.js';
import { resolveWorkbookTheme } from './themes/index.mjs';

export const FACTORY_VERSION = '1.1.0';

export class FactoryRuntimeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'FactoryRuntimeError';
    this.code = code;
    this.details = details;
  }
}

function assertCatalog(catalog, label) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) throw new TypeError(`${label} catalog must be an object.`);
  return catalog;
}

function requiredCatalogEntry(catalog, id, label) {
  const entry = catalog[id];
  if (!entry) throw new FactoryRuntimeError('CATALOG_ENTRY_MISSING', `${label} '${id}' is not registered.`, { id, label });
  return entry;
}

function currencyProfileReport(profile, code) {
  const issues = [];
  if (!profile || profile.code !== code || profile.schemaVersion !== '1.0.0') issues.push({ code: 'CURRENCY_PROFILE_IDENTITY', severity: 'blocker', path: '$', message: `Currency profile ${code} has an invalid identity.` });
  if (!profile?.workbookNumberFormats?.standard || !profile?.workbookNumberFormats?.accounting) issues.push({ code: 'CURRENCY_NUMBER_FORMATS', severity: 'blocker', path: '$.workbookNumberFormats', message: `Currency profile ${code} lacks workbook number formats.` });
  if (!Number.isInteger(profile?.decimalDigits) || profile.decimalDigits < 0 || profile.decimalDigits > 4) issues.push({ code: 'CURRENCY_DECIMALS', severity: 'error', path: '$.decimalDigits', message: `Currency profile ${code} has invalid decimals.` });
  const blockerCount = issues.filter(issue => issue.severity === 'blocker').length;
  return {
    schemaVersion: '1.0.0',
    contract: 'CurrencyProfile',
    status: issues.length ? 'FAIL' : 'PASS',
    valid: issues.length === 0,
    issues,
    summary: { errorCount: issues.length - blockerCount, blockerCount },
    generatedAt: null,
    extensions: { code },
  };
}

function flattenFindings(reports) {
  return reports.flatMap(({ id, report }) => (report.issues ?? []).map(issue => ({ source: id, ...issue })));
}

function catalogStatus(reports) {
  return reports.every(({ report }) => report.status === 'PASS') ? 'PASS' : 'FAIL';
}

function commercialCompleteness(definition) {
  const metadata = definition.commercialMetadata ?? {};
  const checks = [metadata.titleKey, metadata.descriptionKey, metadata.category, metadata.targetAudience?.length, metadata.keywords?.length, metadata.marketplaces?.length, metadata.licenseKey, metadata.disclaimerKeys?.length];
  return checks.filter(Boolean).length / checks.length * 100;
}

function localeCoverage(localization) {
  const value = Number(localization.extensions?.coverage ?? 0);
  return value <= 1 ? value * 100 : value;
}

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function outputTypes(definition) {
  return definition.outputTypes ?? ['xlsx', 'zip'];
}

function mergeArtifactValidationReports(workbookReport, documentReport, generatedAt) {
  if (!workbookReport) return documentReport;
  if (!documentReport) return workbookReport;
  const issues = [...workbookReport.issues, ...documentReport.issues];
  const blockerCount = issues.filter(issue => issue.severity === 'blocker').length;
  return {
    schemaVersion: '1.0.0',
    contract: 'DigitalProductArtifacts',
    status: issues.length ? 'FAIL' : 'PASS',
    valid: issues.length === 0,
    issues,
    summary: { errorCount: issues.length - blockerCount, blockerCount },
    generatedAt,
    extensions: {
      stage: 'ARTIFACTS',
      warningCount: (workbookReport.extensions?.warningCount ?? 0) + (documentReport.extensions?.warningCount ?? 0),
      warnings: [...(workbookReport.extensions?.warnings ?? []), ...(documentReport.extensions?.warnings ?? [])],
      metrics: { ...(workbookReport.extensions?.metrics ?? {}), ...(documentReport.extensions?.metrics ?? {}) },
      details: { workbook: workbookReport.status, documents: documentReport.status },
      overrides: [],
    },
  };
}

export class FinanceProductFactoryRuntime {
  constructor({ definitions, locales, currencies, themes }) {
    if (!Array.isArray(definitions) || !definitions.length) throw new TypeError('At least one product definition is required.');
    this.locales = assertCatalog(locales, 'Locale');
    this.currencies = assertCatalog(currencies, 'Currency');
    this.themes = assertCatalog(themes, 'Theme');
    this.registry = new ProductRegistry(definitions);
  }

  listProducts(filters = {}) {
    return this.registry.list(filters);
  }

  resolveProduct(productId, options = {}) {
    const definition = this.registry.resolve(productId, options);
    if (!definition) throw new FactoryRuntimeError('PRODUCT_NOT_FOUND', `Product '${productId}' is not available.`, { productId });
    return definition;
  }

  resolveCatalogs(configuration) {
    const baseTheme = requiredCatalogEntry(this.themes, configuration.themeId, 'Theme');
    return {
      localization: requiredCatalogEntry(this.locales, configuration.locale, 'Locale'),
      currencyProfile: requiredCatalogEntry(this.currencies, configuration.currency, 'Currency'),
      theme: resolveWorkbookTheme(baseTheme, configuration.extensions?.productAppearance ?? 'light'),
    };
  }

  configuration(productId, input = {}, { persistedState = {} } = {}) {
    const definition = this.resolveProduct(productId, { allowBeta: true, allowDeprecated: false });
    const persistedConfiguration = persistedState?.configuration && typeof persistedState.configuration === 'object'
      ? persistedState.configuration
      : persistedState;
    const locale = input.locale ?? persistedConfiguration?.locale ?? definition.defaultConfiguration.locale;
    const localization = requiredCatalogEntry(this.locales, locale, 'Locale');
    const defaultTitle = definition.defaultConfiguration.title;
    const requestedTitle = input.title ?? persistedConfiguration?.title;
    const hasCustomTitle = typeof requestedTitle === 'string' && requestedTitle.trim() && requestedTitle !== defaultTitle;
    const title = hasCustomTitle ? requestedTitle : createTranslator(localization)(definition.nameKey, defaultTitle);
    return resolveProductConfiguration({
      productDefinition: definition,
      userSelections: { ...input, title },
      persistedState,
      locale,
      currency: input.currency ?? persistedConfiguration?.currency ?? definition.defaultConfiguration.currency,
      tier: definition.extensions?.tier ?? null,
      theme: input.themeId ?? persistedConfiguration?.themeId ?? definition.defaultConfiguration.themeId,
      translate: createTranslator(localization),
    });
  }

  translator(locale) {
    return createTranslator(requiredCatalogEntry(this.locales, locale, 'Locale'));
  }

  validate(configuration) {
    const definition = this.resolveProduct(configuration.productId, { version: configuration.productVersion, allowBeta: true, allowDeprecated: false });
    const { localization, currencyProfile, theme } = this.resolveCatalogs(configuration);
    const reports = [
      { id: 'product-definition', report: validateContract('ProductDefinition', definition) },
      { id: 'product-configuration', report: validateContract('ProductConfiguration', configuration) },
      { id: 'configuration-semantics', report: validateConfiguration(definition, configuration, { locales: this.locales, currencies: this.currencies, themes: this.themes }) },
      { id: 'localization', report: validateContract('LocalizationBundle', localization) },
      { id: 'theme', report: validateContract('ThemeDefinition', theme) },
      { id: 'currency-profile', report: currencyProfileReport(currencyProfile, configuration.currency) },
    ];
    return {
      schemaVersion: '1.0.0',
      status: catalogStatus(reports),
      valid: reports.every(({ report }) => report.valid),
      reports,
      findings: flattenFindings(reports),
      definition,
      localization,
      currencyProfile,
      theme,
    };
  }

  preview(inputConfiguration) {
    const configuration = this.configuration(inputConfiguration.productId, inputConfiguration);
    const validation = this.validate(configuration);
    if (!validation.valid) throw new FactoryRuntimeError('PREVIEW_VALIDATION_FAILED', 'Preview configuration is invalid.', { findings: validation.findings });
    const declaredOutputs = outputTypes(validation.definition);
    if (declaredOutputs.includes('docx') && !declaredOutputs.includes('xlsx')) {
      const language = configuration.locale.split('-')[0];
      return {
        schemaVersion: '1.0.0',
        type: 'document',
        productId: validation.definition.id,
        locale: configuration.locale,
        documents: validation.definition.documentTemplates.filter(template => template.language === language).map(template => ({ id: template.id, title: template.title, filename: template.filename, sections: template.sections.length })),
      };
    }
    return buildPreviewModel(validation.definition, configuration, {
      translate: createTranslator(validation.localization),
      theme: validation.theme,
      currencyProfile: validation.currencyProfile,
    });
  }

  async generate(inputConfiguration, {
    ExcelJS: ExcelJSRuntime = globalThis.ExcelJS,
    JSZip: JSZipRuntime = globalThis.JSZip,
    compatibilityEvidence = {},
    compatibilityProbe = null,
    listingImageProvider = null,
    photoshopEvidence = null,
    allowSyntheticListingImagesForReview = false,
    humanVisualApproval = null,
    generatedAt = new Date().toISOString(),
    onProgress = () => {},
  } = {}) {
    const configuration = this.configuration(inputConfiguration.productId, inputConfiguration);
    if (compatibilityProbe !== null && typeof compatibilityProbe !== 'function') throw new TypeError('compatibilityProbe must be a function when supplied.');
    if (listingImageProvider !== null && typeof listingImageProvider !== 'function') throw new TypeError('listingImageProvider must be a function when supplied.');
    const started = nowMs();
    const preflight = this.validate(configuration);
    if (!preflight.valid) throw new FactoryRuntimeError('PRE_GENERATION_VALIDATION_FAILED', 'Generation is blocked by invalid contracts or catalogs.', { findings: preflight.findings });
    const { definition, localization, currencyProfile, theme } = preflight;
    const translate = createTranslator(localization);
    const declaredOutputs = outputTypes(definition);
    onProgress({ stage: 'VALIDATED', progress: 0.12, message: 'Contracts and catalogs passed.' });

    let generated = null;
    let workbookValidationReport = null;
    if (declaredOutputs.includes('xlsx')) {
      generated = await generateWorkbook({ definition, configuration, localization, currencyProfile, theme, ExcelJS: ExcelJSRuntime, JSZip: JSZipRuntime, generatedAt });
      onProgress({ stage: 'WORKBOOK_GENERATED', progress: 0.45, message: `${generated.metrics.formulas} formulas generated.` });
      const sheetNames = expectedSheetNames({ definition, configuration, localization, currencyProfile, theme });
      workbookValidationReport = await inspectWorkbook(generated.bytes, { definition, configuration, expectedSheetNames: sheetNames, ExcelJS: ExcelJSRuntime, JSZip: JSZipRuntime, generatedAt });
      if (!workbookValidationReport.valid) throw new FactoryRuntimeError('WORKBOOK_VALIDATION_FAILED', 'Generated workbook failed structural validation.', { report: workbookValidationReport });
      onProgress({ stage: 'WORKBOOK_REREAD', progress: 0.62, message: 'Workbook re-read and OOXML checks passed.' });
    }
    let documents = null;
    if (declaredOutputs.includes('docx')) {
      documents = await generateDocuments({ definition, configuration, JSZip: JSZipRuntime, generatedAt });
      if (!documents.validationReport.valid) throw new FactoryRuntimeError('DOCUMENT_VALIDATION_FAILED', 'Generated documents failed structural validation.', { report: documents.validationReport });
      onProgress({ stage: 'DOCUMENTS_GENERATED', progress: generated ? 0.68 : 0.62, message: `${documents.artifacts.length} validated DOCX documents generated.` });
    }
    const validationReport = mergeArtifactValidationReports(workbookValidationReport, documents?.validationReport ?? null, generatedAt);
    if (!validationReport) throw new FactoryRuntimeError('NO_OUTPUT_GENERATED', 'The product declares no executable output capability.');

    const resolvedCompatibilityEvidence = compatibilityProbe && generated
      ? await compatibilityProbe({
        definition,
        configuration,
        workbookBytes: Uint8Array.from(generated.bytes),
        validationReport,
        generatedAt,
      })
      : compatibilityEvidence;
    if (!resolvedCompatibilityEvidence || typeof resolvedCompatibilityEvidence !== 'object' || Array.isArray(resolvedCompatibilityEvidence)) {
      throw new FactoryRuntimeError('COMPATIBILITY_EVIDENCE_INVALID', 'Compatibility evidence must be an object keyed by declared target.');
    }
    onProgress({ stage: 'COMPATIBILITY_VERIFIED', progress: 0.76, message: compatibilityProbe && generated ? 'Native compatibility probe completed.' : 'Compatibility evidence evaluated.' });
    const compatibility = compatibilityReport(definition, configuration, workbookValidationReport, { evidence: resolvedCompatibilityEvidence, documentReport: documents?.validationReport ?? null, generatedAt });
    const quality = scoreProduct({
      definition,
      definitionReport: preflight.reports.find(item => item.id === 'product-definition').report,
      configurationReport: preflight.reports.find(item => item.id === 'product-configuration').report,
      workbookReport: validationReport,
      localeCoverage: localeCoverage(localization),
      commercialCompleteness: commercialCompleteness(definition),
      instructionsComplete: (definition.sheets ?? []).some(sheet => sheet.id === 'instructions') || definition.features.includes('instructions') || definition.features.includes('user-guide'),
      compatibilityReport: compatibility,
      accessibilityScore: 100,
      exportCompleteness: 100,
      generatedAt,
    });
    onProgress({ stage: 'QUALITY_SCORED', progress: 0.8, message: `Quality score ${quality.score}/100.` });

    const commercialPackage = configuration.outputOptions.package ? await buildCommercialPackage({
      definition,
      configuration,
      workbookBytes: generated?.bytes ?? null,
      documentArtifacts: documents?.artifacts ?? [],
      validationReport,
      qualityReport: quality,
      compatibilityReport: compatibility,
      theme,
      translate,
      JSZip: JSZipRuntime,
      factoryVersion: FACTORY_VERSION,
      generatedAt,
      listingImageProvider,
      photoshopEvidence,
      allowSyntheticListingImagesForReview,
      humanVisualApproval,
    }) : null;
    onProgress({ stage: 'PACKAGE_BUILT', progress: 0.96, message: commercialPackage ? `${commercialPackage.files.size} package files built.` : 'Package output disabled.' });
    const durationMs = Number((nowMs() - started).toFixed(2));
    const result = {
      schemaVersion: '1.0.0',
      factoryVersion: FACTORY_VERSION,
      generatedAt,
      definition,
      configuration,
      validationReport,
      qualityReport: quality,
      compatibilityReport: compatibility,
      package: commercialPackage,
      durationMs,
      summary: {
        productId: definition.id,
        productVersion: definition.version,
        workbookBytes: generated?.byteLength ?? 0,
        documentBytes: documents?.artifacts.reduce((total, artifact) => total + artifact.byteLength, 0) ?? 0,
        documents: documents?.artifacts.length ?? 0,
        packageBytes: commercialPackage?.zipBytes.byteLength ?? 0,
        sheets: generated?.metrics.sheets ?? 0,
        formulas: generated?.metrics.formulas ?? 0,
        validations: generated?.metrics.validations ?? 0,
        validationStatus: validationReport.status,
        qualityScore: quality.score,
        compatibilityStatus: compatibility.status,
        releaseStatus: commercialPackage?.generatedManifest.releaseStatus ?? 'DRAFT',
        durationMs,
      },
      ...(generated ? { workbook: generated } : {}),
      ...(documents ? { documents } : {}),
    };
    onProgress({ stage: 'COMPLETE', progress: 1, message: 'Generation completed.' });
    return result;
  }
}

export const createFactoryRuntime = catalogs => new FinanceProductFactoryRuntime(catalogs);
