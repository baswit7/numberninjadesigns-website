import { formulaCount } from './formula-engine.js';
import { sanitizeFilename, stableStringify } from './security.js';

export const ALLOWED_CAPACITIES = Object.freeze([50, 100, 250, 500, 1000, 2500, 5000, 10000]);
export const VALIDATION_STATUSES = Object.freeze(['PASS', 'FAIL']);
export const ALLOWED_PRODUCT_APPEARANCES = Object.freeze(['light', 'dark']);

function issue(code, message, path = '', severity = 'ERROR', details = undefined) {
  return { code, severity, path, message, ...(details === undefined ? {} : { details }) };
}

export function validateConfiguration(definition, configuration, catalogs = {}) {
  const errors = [];
  const warnings = [];
  if (!configuration || typeof configuration !== 'object') {
    errors.push(issue('CONFIG_TYPE', 'Configuration must be an object.'));
  } else {
    if (configuration.schemaVersion !== '1.0.0') errors.push(issue('CONFIG_SCHEMA_VERSION', 'Configuration schemaVersion must be 1.0.0.', 'schemaVersion'));
    if (configuration.productId !== definition.id) errors.push(issue('CONFIG_PRODUCT_ID', 'Configuration productId does not match the definition.', 'productId'));
    if (configuration.productVersion !== definition.version) errors.push(issue('CONFIG_PRODUCT_VERSION', 'Configuration productVersion does not match the definition.', 'productVersion'));
    if (!definition.supportedLocales.includes(configuration.locale)) errors.push(issue('CONFIG_LOCALE', `Unsupported locale ${configuration.locale}.`, 'locale'));
    if (!definition.supportedCurrencies.includes(configuration.currency)) errors.push(issue('CONFIG_CURRENCY', `Unsupported currency ${configuration.currency}.`, 'currency'));
    if (!definition.supportedThemes.includes(configuration.themeId)) errors.push(issue('CONFIG_THEME', `Unsupported theme ${configuration.themeId}.`, 'themeId'));
    const declaredOutputs = definition.outputTypes ?? ['xlsx', 'zip'];
    const appearance = configuration.extensions?.productAppearance ?? 'light';
    if (!ALLOWED_PRODUCT_APPEARANCES.includes(appearance)) errors.push(issue('CONFIG_APPEARANCE', `Unsupported workbook appearance ${appearance}.`, 'extensions.productAppearance'));
    if (configuration.extensions?.paletteId && configuration.extensions.paletteId !== configuration.themeId) errors.push(issue('CONFIG_PALETTE_MISMATCH', 'extensions.paletteId must match themeId.', 'extensions.paletteId'));
    const supportedAppearances = definition.extensions?.supportedAppearances;
    if (Array.isArray(supportedAppearances) && !supportedAppearances.includes(appearance)) errors.push(issue('CONFIG_APPEARANCE_UNSUPPORTED', `Product ${definition.id} does not support workbook appearance ${appearance}.`, 'extensions.productAppearance'));
    if (!ALLOWED_CAPACITIES.includes(configuration.inputCapacity)) errors.push(issue('CONFIG_CAPACITY', `inputCapacity must be one of ${ALLOWED_CAPACITIES.join(', ')}.`, 'inputCapacity'));
    if (!Number.isInteger(configuration.year) || configuration.year < 2000 || configuration.year > 2100) errors.push(issue('CONFIG_YEAR', 'Year must be an integer from 2000 through 2100.', 'year'));
    if (typeof configuration.market !== 'string' || !/^[A-Z]{2}$/.test(configuration.market)) errors.push(issue('CONFIG_MARKET', 'Market must be an ISO alpha-2 country code.', 'market'));
    const filename = String(configuration.filename ?? '');
    const expectedExtension = declaredOutputs.includes('xlsx') ? 'xlsx' : declaredOutputs.includes('docx') ? 'docx' : 'xlsx';
    const filenameBase = filename.replace(/\.(?:xlsx|docx)$/i, '');
    if (!filename.toLowerCase().endsWith(`.${expectedExtension}`) || !filenameBase || `${sanitizeFilename(filenameBase, '')}.${expectedExtension}` !== filename) {
      errors.push(issue('CONFIG_FILENAME', `Filename must be a stable, safe .${expectedExtension} filename.`, 'filename'));
    }
    if (Boolean(configuration.outputOptions?.workbook) !== declaredOutputs.includes('xlsx')) errors.push(issue('CONFIG_WORKBOOK_OUTPUT', 'Workbook output must match the declared XLSX capability.', 'outputOptions.workbook'));
    if (Boolean(configuration.outputOptions?.documents) !== declaredOutputs.includes('docx')) errors.push(issue('CONFIG_DOCUMENT_OUTPUT', 'Document output must match the declared DOCX capability.', 'outputOptions.documents'));
    const categories = configuration.categoryOverrides ?? [];
    if (!Array.isArray(categories)) errors.push(issue('CONFIG_CATEGORIES', 'categoryOverrides must be an array.', 'categoryOverrides'));
    else {
      const normalized = categories.map(value => String(value).trim().toLocaleLowerCase('en-US'));
      if (normalized.some(value => !value)) errors.push(issue('CONFIG_CATEGORY_EMPTY', 'Categories may not be empty.', 'categoryOverrides'));
      if (new Set(normalized).size !== normalized.length) errors.push(issue('CONFIG_CATEGORY_DUPLICATE', 'Duplicate categories are not allowed.', 'categoryOverrides'));
      if (categories.length > 100) errors.push(issue('CONFIG_CATEGORY_LIMIT', 'No more than 100 category overrides are allowed.', 'categoryOverrides'));
      if (categories.length < 10) errors.push(issue('CONFIG_CATEGORY_MINIMUM', 'At least 10 relevant categories are required.', 'categoryOverrides', 'ERROR', { minimum: 10, actual: categories.length }));
      const profileId = definition.extensions?.categoryProfileId ?? `${definition.productFamily ?? definition.id}-categories-v1`;
      if (profileId) {
        const resolution = configuration.extensions?.categoryResolution;
        if (!categories.length) errors.push(issue('CONFIG_CATEGORY_PROFILE_EMPTY', `Category profile ${profileId} resolved to zero categories.`, 'categoryOverrides', 'ERROR', { profileId }));
        if (!resolution || typeof resolution !== 'object') {
          errors.push(issue('CONFIG_CATEGORY_RESOLUTION_MISSING', 'Resolved category metadata is required.', 'extensions.categoryResolution', 'ERROR', { profileId }));
        } else {
          if (resolution.profileId !== profileId) errors.push(issue('CONFIG_CATEGORY_PROFILE_MISMATCH', 'Resolved category profile does not match the product definition.', 'extensions.categoryResolution.profileId', 'ERROR', { expected: profileId, actual: resolution.profileId }));
          if (!['AUTO', 'MANUAL'].includes(resolution.source)) errors.push(issue('CONFIG_CATEGORY_SOURCE', 'Category resolution source must be AUTO or MANUAL.', 'extensions.categoryResolution.source'));
          if (resolution.locale !== configuration.locale) errors.push(issue('CONFIG_CATEGORY_LOCALE', 'Resolved category locale does not match the configuration.', 'extensions.categoryResolution.locale', 'ERROR', { expected: configuration.locale, actual: resolution.locale }));
          if (resolution.currency !== configuration.currency) errors.push(issue('CONFIG_CATEGORY_CURRENCY', 'Resolved category currency does not match the configuration.', 'extensions.categoryResolution.currency', 'ERROR', { expected: configuration.currency, actual: resolution.currency }));
          if (Number(resolution.count) !== categories.length) errors.push(issue('CONFIG_CATEGORY_COUNT', 'Resolved category count does not match categoryOverrides.', 'extensions.categoryResolution.count', 'ERROR', { expected: categories.length, actual: resolution.count }));
          const tier = definition.extensions?.tier ?? null;
          if ((resolution.tier ?? null) !== tier) errors.push(issue('CONFIG_CATEGORY_TIER', 'Resolved category tier does not match the product definition.', 'extensions.categoryResolution.tier', 'ERROR', { expected: tier, actual: resolution.tier ?? null }));
        }
      }
    }
    if (catalogs.locales && !catalogs.locales[configuration.locale]) errors.push(issue('CATALOG_LOCALE_MISSING', 'Locale bundle is missing.', 'locale'));
    if (catalogs.currencies && !catalogs.currencies[configuration.currency]) errors.push(issue('CATALOG_CURRENCY_MISSING', 'Currency profile is missing.', 'currency'));
    if (catalogs.themes && !catalogs.themes[configuration.themeId]) errors.push(issue('CATALOG_THEME_MISSING', 'Theme definition is missing.', 'themeId'));
  }
  return makeValidationReport({ stage: 'CONFIGURATION', errors, warnings, productId: definition.id });
}

function xmlTargets(zip, relsText, baseDirectory) {
  const targets = [];
  for (const match of relsText.matchAll(/<Relationship\b[^>]*\bTarget="([^"]+)"[^>]*>/g)) {
    const target = match[1].replaceAll('\\', '/');
    if (target.startsWith('#') || /^[a-z]+:/i.test(target)) continue;
    const parts = `${baseDirectory}/${target}`.split('/');
    const normalized = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') normalized.pop(); else normalized.push(part);
    }
    const path = normalized.join('/');
    if (!zip.file(path)) targets.push(path);
  }
  return targets;
}

export async function inspectWorkbook(bytes, {
  definition,
  configuration,
  expectedSheetNames,
  ExcelJS: ExcelJSRuntime = globalThis.ExcelJS,
  JSZip: JSZipRuntime = globalThis.JSZip,
  generatedAt = new Date().toISOString(),
} = {}) {
  const errors = [];
  const warnings = [];
  if (!ExcelJSRuntime || !JSZipRuntime) return makeValidationReport({ stage: 'WORKBOOK', productId: definition?.id, errors: [issue('RUNTIME_MISSING', 'Local ExcelJS or JSZip runtime is unavailable.')], warnings, generatedAt });
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1_000) return makeValidationReport({ stage: 'WORKBOOK', productId: definition?.id, errors: [issue('XLSX_BYTES', 'Workbook bytes are missing or too small.')], warnings, generatedAt });

  let workbook;
  try {
    workbook = new ExcelJSRuntime.Workbook();
    await workbook.xlsx.load(bytes);
  } catch (error) {
    return makeValidationReport({ stage: 'WORKBOOK', productId: definition?.id, errors: [issue('XLSX_REREAD', `ExcelJS re-read failed: ${error.message}`)], warnings, generatedAt });
  }

  const actualSheets = workbook.worksheets.map(sheet => sheet.name);
  if (expectedSheetNames && stableStringify(actualSheets) !== stableStringify(expectedSheetNames)) {
    errors.push(issue('XLSX_SHEET_ORDER', 'Workbook sheet order or names differ from the definition.', 'worksheets', 'ERROR', { expected: expectedSheetNames, actual: actualSheets }));
  }
  const formulas = formulaCount(workbook);
  const expectedCharts = definition?.sheets?.reduce((total, sheet) => total + (sheet.extensions?.charts?.length ?? 0), 0) ?? 0;
  const expectedChartDrawings = definition?.sheets?.filter(sheet => (sheet.extensions?.charts?.length ?? 0) > 0).length ?? 0;
  let validations = 0;
  let filters = 0;
  let panes = 0;
  let formattedCurrencyCells = 0;
  const sheetReports = [];
  for (const sheet of workbook.worksheets) {
    const validationModel = sheet.dataValidations?.model ?? {};
    const validationCount = Object.keys(validationModel).length;
    const hasFilter = Boolean(sheet.autoFilter) || sheet.getTables().length > 0;
    const frozen = (sheet.views ?? []).some(view => view.state === 'frozen' && Number(view.ySplit || view.xSplit) > 0);
    let sheetFormulaCount = 0;
    let currencyCells = 0;
    sheet.eachRow({ includeEmpty: false }, row => row.eachCell({ includeEmpty: false }, cell => {
      const mergedFollower = cell.isMerged && cell.master?.address !== cell.address;
      if (!mergedFollower && cell.value && typeof cell.value === 'object' && typeof cell.value.formula === 'string') {
        sheetFormulaCount += 1;
        if (cell.value.formula.includes('#REF!')) errors.push(issue('FORMULA_REF', `#REF! found in ${sheet.name}!${cell.address}.`, `${sheet.name}!${cell.address}`));
      }
      if (typeof cell.numFmt === 'string') {
        const format = cell.numFmt;
        const symbol = ({ EUR: '€', USD: '$', GBP: '£', CAD: '$', AUD: '$', CHF: 'CHF' })[configuration?.currency];
        if (/[#0]/.test(format) && (format.includes(configuration?.currency ?? '\u0000') || (symbol && format.includes(symbol)) || /\[\$/.test(format))) currencyCells += 1;
      }
    }));
    validations += validationCount;
    filters += Number(hasFilter);
    panes += Number(frozen);
    formattedCurrencyCells += currencyCells;
    sheetReports.push({ name: sheet.name, rowCount: sheet.rowCount, columnCount: sheet.columnCount, formulaCount: sheetFormulaCount, dataValidationCount: validationCount, autoFilter: hasFilter, frozenPane: frozen, currencyFormatCells: currencyCells });
  }
  if (formulas < 1) errors.push(issue('XLSX_FORMULAS', 'Workbook contains no live formulas.'));
  if (formattedCurrencyCells < 1) errors.push(issue('XLSX_CURRENCY_FORMAT', 'Workbook contains no verified currency number formats.'));
  const requiredInputSheets = definition?.sheets?.filter(sheet => ['input', 'transactions', 'schedule'].includes(String(sheet.type).toLowerCase())) ?? [];
  if (filters < requiredInputSheets.length) errors.push(issue('XLSX_FILTERS', 'One or more input sheets lack an auto-filter.', 'worksheets'));
  if (panes < requiredInputSheets.length) errors.push(issue('XLSX_PANES', 'One or more input sheets lack a frozen pane.', 'worksheets'));
  const requiredValidations = definition?.validations?.length ?? 0;
  if (requiredValidations > 0 && validations < 1) errors.push(issue('XLSX_VALIDATIONS', 'Expected data validations are absent.', 'worksheets'));

  let zip;
  try {
    zip = await JSZipRuntime.loadAsync(bytes);
  } catch (error) {
    errors.push(issue('XLSX_ZIP', `ZIP parsing failed: ${error.message}`));
  }
  let zipReport = null;
  if (zip) {
    const entries = Object.keys(zip.files).filter(path => !zip.files[path].dir);
    const requiredParts = ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml'];
    const missingParts = requiredParts.filter(path => !zip.file(path));
    if (missingParts.length) errors.push(issue('OOXML_REQUIRED_PARTS', `Missing required OOXML parts: ${missingParts.join(', ')}.`));
    const worksheetParts = entries.filter(path => /^xl\/worksheets\/sheet\d+\.xml$/.test(path));
    const chartParts = entries.filter(path => /^xl\/charts\/chart\d+\.xml$/.test(path));
    const drawingParts = entries.filter(path => /^xl\/drawings\/drawing\d+\.xml$/.test(path));
    const rawFeatures = { formulas: 0, validations: 0, filters: 0, panes: 0, charts: chartParts.length, drawings: drawingParts.length };
    for (const path of worksheetParts) {
      const text = await zip.file(path).async('string');
      rawFeatures.formulas += (text.match(/<f(?:\s|>)/g) ?? []).length;
      rawFeatures.validations += (text.match(/<dataValidation(?:\s|>)/g) ?? []).length;
      rawFeatures.filters += (text.match(/<autoFilter(?:\s|\/|>)/g) ?? []).length;
      rawFeatures.panes += (text.match(/<pane(?:\s|\/|>)/g) ?? []).length;
    }
    for (const path of entries.filter(path => /^xl\/tables\/table\d+\.xml$/.test(path))) {
      const text = await zip.file(path).async('string');
      rawFeatures.filters += (text.match(/<autoFilter(?:\s|\/|>)/g) ?? []).length;
    }
    const relsText = zip.file('xl/_rels/workbook.xml.rels') ? await zip.file('xl/_rels/workbook.xml.rels').async('string') : '';
    const missingTargets = xmlTargets(zip, relsText, 'xl');
    for (const path of entries.filter(entry => /^xl\/(?:worksheets|drawings)\/_rels\/.+\.rels$/.test(entry))) {
      const baseDirectory = path.slice(0, path.indexOf('/_rels/'));
      const relationshipText = await zip.file(path).async('string');
      missingTargets.push(...xmlTargets(zip, relationshipText, baseDirectory));
    }
    if (missingTargets.length) errors.push(issue('OOXML_RELATIONSHIPS', `Missing relationship targets: ${missingTargets.join(', ')}.`));
    if (chartParts.length !== expectedCharts) errors.push(issue('OOXML_CHART_COUNT', `Expected ${expectedCharts} chart parts but found ${chartParts.length}.`, 'xl/charts', 'ERROR', { expected: expectedCharts, actual: chartParts.length }));
    if (drawingParts.length !== expectedChartDrawings) errors.push(issue('OOXML_DRAWING_COUNT', `Expected ${expectedChartDrawings} chart drawing parts but found ${drawingParts.length}.`, 'xl/drawings', 'ERROR', { expected: expectedChartDrawings, actual: drawingParts.length }));
    const contentTypesText = zip.file('[Content_Types].xml') ? await zip.file('[Content_Types].xml').async('string') : '';
    for (const path of chartParts) {
      const chartText = await zip.file(path).async('string');
      if (!/<c:chartSpace\b/.test(chartText) || !/<c:chart\b/.test(chartText) || !/<c:ser\b/.test(chartText)) errors.push(issue('OOXML_CHART_STRUCTURE', `Chart part ${path} lacks required chart or series elements.`, path));
      if (/#REF!|\[[^\]]+\.xlsx\]/i.test(chartText)) errors.push(issue('OOXML_CHART_REFERENCE', `Chart part ${path} contains an invalid or external workbook reference.`, path));
      if (!contentTypesText.includes(`PartName="/${path}"`)) errors.push(issue('OOXML_CHART_CONTENT_TYPE', `Chart part ${path} lacks a content-type override.`, path));
    }
    if (rawFeatures.formulas !== formulas) warnings.push(issue('FORMULA_COUNT_DIFFERENCE', 'Raw OOXML and re-read formula counts differ.', '', 'WARNING', { raw: rawFeatures.formulas, reread: formulas }));
    // ExcelJS expands one OOXML `sqref` range into a per-cell validation model on
    // re-read, so raw element counts and model entry counts are intentionally not
    // comparable. Presence on both sides is the reliable structural invariant.
    if (validations > 0 && rawFeatures.validations === 0) errors.push(issue('OOXML_VALIDATIONS', 'Re-read validations are absent from worksheet XML.'));
    if (rawFeatures.filters < filters) errors.push(issue('OOXML_FILTERS', 'Re-read filters are not fully represented in worksheet XML.'));
    if (rawFeatures.panes < panes) errors.push(issue('OOXML_PANES', 'Re-read panes are not fully represented in worksheet XML.'));
    zipReport = { entries: entries.length, worksheetParts: worksheetParts.length, chartParts: chartParts.length, drawingParts: drawingParts.length, missingParts, missingRelationshipTargets: [...new Set(missingTargets)], rawFeatures };
  }

  return makeValidationReport({
    stage: 'WORKBOOK', productId: definition?.id, errors, warnings,
    metrics: { bytes: bytes.byteLength, sheets: actualSheets.length, formulas, validations, filters, panes, formattedCurrencyCells, charts: expectedCharts },
    details: { configuration: configuration ? { locale: configuration.locale, currency: configuration.currency, themeId: configuration.themeId, productAppearance: configuration.extensions?.productAppearance ?? 'light', inputCapacity: configuration.inputCapacity } : null, sheets: sheetReports, zip: zipReport },
    generatedAt,
  });
}

export function makeValidationReport({ stage, productId = null, errors = [], warnings = [], metrics = {}, details = {}, generatedAt = new Date().toISOString() }) {
  const issues = errors.map(error => ({
    code: error.code,
    severity: error.severity === 'BLOCKER' ? 'blocker' : 'error',
    path: error.path || '$',
    message: error.message,
    ...(error.details && Object.hasOwn(error.details, 'expected') ? { expected: error.details.expected } : {}),
    ...(error.details && Object.hasOwn(error.details, 'actual') ? { actual: error.details.actual } : {}),
  }));
  const blockerCount = issues.filter(item => item.severity === 'blocker').length;
  return {
    schemaVersion: '1.0.0',
    contract: `FinanceProduct${stage[0]}${stage.slice(1).toLowerCase()}`,
    status: issues.length ? 'FAIL' : 'PASS',
    valid: issues.length === 0,
    issues,
    summary: { errorCount: issues.length - blockerCount, blockerCount },
    generatedAt,
    extensions: {
      stage,
      productId,
      warningCount: warnings.length,
      warnings,
      metrics,
      details,
      overrides: [],
    },
  };
}

export function compatibilityReport(definition, configuration, workbookReport, {
  evidence = {},
  documentReport = null,
  generatedAt = new Date().toISOString(),
} = {}) {
  const structuralPass = workbookReport?.status === 'PASS';
  const targets = (definition.compatibility?.targets ?? ['excel-desktop', 'excel-web']).map(target => {
    const supplied = evidence[target];
    if (supplied) {
      return {
        target,
        version: supplied.version ?? null,
        status: supplied.status,
        verified: supplied.status !== 'NOT_TESTED',
        checks: [...(supplied.checks ?? [])],
        limitations: [...(supplied.limitations ?? [])],
      };
    }
    if (target === 'docx-ooxml') {
      const passed = documentReport?.status === 'PASS' && documentReport?.valid === true;
      return {
        target,
        version: 'ECMA-376',
        status: passed ? 'PASS' : 'FAIL',
        verified: true,
        checks: [passed ? 'DOCX ZIP structure, mandatory OOXML parts, relationships, text markers and placeholders passed.' : 'DOCX structural validation failed or was not supplied.'],
        limitations: ['Native PDF export is not implemented.', 'Google Docs is supported only as manual DOCX import compatibility, not as native export.', ...(definition.compatibility?.limitations ?? [])],
      };
    }
    if (!structuralPass) return { target, version: null, status: 'FAIL', verified: true, checks: ['Structural XLSX validation failed.'], limitations: [...(definition.compatibility?.limitations ?? [])] };
    return {
      target,
      version: target === 'excel-desktop' ? definition.compatibility?.minimumExcelVersion ?? null : null,
      status: 'PARTIAL',
      verified: true,
      checks: ['ExcelJS re-read and OOXML structural checks passed.'],
      limitations: ['Native application open/save was not supplied as evidence.', ...(definition.compatibility?.limitations ?? [])],
    };
  });
  const statuses = targets.map(target => target.status);
  const status = statuses.includes('FAIL') ? 'FAIL' : statuses.every(value => value === 'PASS') ? 'PASS' : statuses.every(value => value === 'NOT_TESTED') ? 'NOT_TESTED' : 'PARTIAL';
  return {
    schemaVersion: '1.0.0',
    productId: definition.id,
    productVersion: definition.version,
    status,
    targets,
    generatedAt,
    extensions: { locale: configuration.locale, currency: configuration.currency },
  };
}
