import { getContractSchema, getSchemaById, SCHEMA_VERSION } from './schemas/index.js';
import { isSemver } from './semver.js';

const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const OWN = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function jsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function matchesType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isPlainObject(value);
  if (type === 'integer') return Number.isInteger(value) && Number.isFinite(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function stableKey(value, ancestors = new WeakSet()) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (ancestors.has(value)) return '[[cycle]]';
  ancestors.add(value);
  const result = Array.isArray(value)
    ? `[${value.map(item => stableKey(item, ancestors)).join(',')}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableKey(value[key], ancestors)}`).join(',')}}`;
  ancestors.delete(value);
  return result;
}

function equivalent(left, right) {
  return stableKey(left) === stableKey(right);
}

function childPath(path, key) {
  return typeof key === 'number' ? `${path}[${key}]` : `${path}.${key}`;
}

function safeActual(value) {
  if (value === undefined) return 'undefined';
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'function' || typeof value === 'symbol') return typeof value;
  if (value && typeof value === 'object') return jsonType(value);
  return value;
}

function addIssue(context, code, path, message, details = {}) {
  if (context.issues.length >= context.maxIssues) return;
  const issue = {
    code,
    severity: details.severity ?? 'error',
    path,
    message,
  };
  if (OWN(details, 'expected')) issue.expected = details.expected;
  if (OWN(details, 'actual')) issue.actual = safeActual(details.actual);
  context.issues.push(issue);
}

function validateJsonValue(value, path, context, ancestors = new WeakSet()) {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    addIssue(context, 'NON_JSON_VALUE', path, 'Contract values must be JSON serializable.', { severity: 'blocker', actual: value });
    return;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    addIssue(context, 'NON_FINITE_NUMBER', path, 'Contract numbers must be finite.', { severity: 'blocker', actual: value });
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (!Array.isArray(value) && !isPlainObject(value)) {
    addIssue(context, 'NON_PLAIN_OBJECT', path, 'Contract objects must use a plain object prototype.', { severity: 'blocker', actual: value });
    return;
  }
  if (ancestors.has(value)) {
    addIssue(context, 'CYCLIC_VALUE', path, 'Contract values cannot contain cycles.', { severity: 'blocker' });
    return;
  }
  ancestors.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateJsonValue(item, childPath(path, index), context, ancestors));
  } else {
    for (const [key, item] of Object.entries(value)) validateJsonValue(item, childPath(path, key), context, ancestors);
  }
  ancestors.delete(value);
}

const formatValidators = new Map([
  ['semver', isSemver],
  ['date-time', value => DATE_TIME_PATTERN.test(value) && Number.isFinite(Date.parse(value))],
]);

function branchMatches(value, schema, path, context) {
  const branchContext = { ...context, issues: [], visiting: new WeakSet() };
  walkSchema(value, schema, path, branchContext);
  return branchContext.issues.length === 0;
}

function walkSchema(value, schema, path, context) {
  if (context.issues.length >= context.maxIssues) return;
  if (schema === true || schema === undefined) return;
  if (schema === false) {
    addIssue(context, 'SCHEMA_REJECTED', path, 'The schema rejects this value.');
    return;
  }

  if (schema.$ref) {
    const referenced = getSchemaById(schema.$ref);
    if (!referenced) {
      addIssue(context, 'UNKNOWN_SCHEMA_REFERENCE', path, `Unknown schema reference: ${schema.$ref}`, { severity: 'blocker' });
      return;
    }
    walkSchema(value, referenced, path, context);
  }

  if (schema.allOf) schema.allOf.forEach(branch => walkSchema(value, branch, path, context));
  if (schema.anyOf && !schema.anyOf.some(branch => branchMatches(value, branch, path, context))) {
    addIssue(context, 'ANY_OF_MISMATCH', path, 'Value does not match any allowed schema branch.');
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(branch => branchMatches(value, branch, path, context)).length;
    if (matches !== 1) addIssue(context, 'ONE_OF_MISMATCH', path, `Value must match exactly one schema branch; matched ${matches}.`);
  }
  if (schema.not && branchMatches(value, schema.not, path, context)) {
    addIssue(context, 'NOT_SCHEMA_MATCHED', path, 'Value matches a forbidden schema branch.');
  }

  if (OWN(schema, 'const') && !equivalent(value, schema.const)) {
    addIssue(context, 'CONST_MISMATCH', path, 'Value does not match the required constant.', { severity: 'blocker', expected: schema.const, actual: value });
  }
  if (schema.enum && !schema.enum.some(candidate => equivalent(candidate, value))) {
    addIssue(context, 'ENUM_MISMATCH', path, 'Value is not in the allowed set.', { expected: schema.enum, actual: value });
  }

  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowed.some(type => matchesType(value, type))) {
      addIssue(context, 'TYPE_MISMATCH', path, `Expected ${allowed.join(' or ')}, received ${jsonType(value)}.`, { expected: allowed, actual: value });
      return;
    }
  }

  const composite = value && typeof value === 'object';
  if (composite) {
    if (context.visiting.has(value)) {
      addIssue(context, 'CYCLIC_VALUE', path, 'Contract values cannot contain cycles.', { severity: 'blocker' });
      return;
    }
    context.visiting.add(value);
  }

  try {
    if (typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) addIssue(context, 'MIN_LENGTH', path, `String must contain at least ${schema.minLength} characters.`);
      if (schema.maxLength !== undefined && value.length > schema.maxLength) addIssue(context, 'MAX_LENGTH', path, `String must contain at most ${schema.maxLength} characters.`);
      if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) addIssue(context, 'PATTERN_MISMATCH', path, 'String does not match the required pattern.');
      if (schema.format) {
        const validator = formatValidators.get(schema.format);
        if (!validator) addIssue(context, 'UNSUPPORTED_SCHEMA_FORMAT', path, `Unsupported schema format: ${schema.format}`, { severity: 'blocker' });
        else if (!validator(value)) addIssue(context, 'FORMAT_MISMATCH', path, `String is not a valid ${schema.format}.`);
      }
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      if (schema.minimum !== undefined && value < schema.minimum) addIssue(context, 'MINIMUM', path, `Number must be at least ${schema.minimum}.`);
      if (schema.maximum !== undefined && value > schema.maximum) addIssue(context, 'MAXIMUM', path, `Number must be at most ${schema.maximum}.`);
      if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) addIssue(context, 'EXCLUSIVE_MINIMUM', path, `Number must be greater than ${schema.exclusiveMinimum}.`);
      if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) addIssue(context, 'EXCLUSIVE_MAXIMUM', path, `Number must be less than ${schema.exclusiveMaximum}.`);
      if (schema.multipleOf !== undefined && Math.abs(value / schema.multipleOf - Math.round(value / schema.multipleOf)) > 1e-12) addIssue(context, 'MULTIPLE_OF', path, `Number must be a multiple of ${schema.multipleOf}.`);
    }

    if (Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems) addIssue(context, 'MIN_ITEMS', path, `Array must contain at least ${schema.minItems} items.`);
      if (schema.maxItems !== undefined && value.length > schema.maxItems) addIssue(context, 'MAX_ITEMS', path, `Array must contain at most ${schema.maxItems} items.`);
      if (schema.uniqueItems) {
        const keys = value.map(item => stableKey(item));
        if (new Set(keys).size !== keys.length) addIssue(context, 'DUPLICATE_ITEMS', path, 'Array items must be unique.');
      }
      if (schema.items) value.forEach((item, index) => walkSchema(item, schema.items, childPath(path, index), context));
    }

    if (isPlainObject(value)) {
      const properties = schema.properties ?? {};
      for (const key of schema.required ?? []) {
        if (!OWN(value, key)) addIssue(context, 'REQUIRED_FIELD_MISSING', childPath(path, key), `Required field '${key}' is missing.`, { severity: 'blocker' });
      }
      for (const [key, child] of Object.entries(value)) {
        if (OWN(properties, key)) {
          walkSchema(child, properties[key], childPath(path, key), context);
        } else if (schema.additionalProperties === false) {
          if (context.unknownFields === 'reject') addIssue(context, 'UNKNOWN_FIELD', childPath(path, key), `Unknown field '${key}' is not allowed.`, { severity: 'blocker' });
        } else if (isPlainObject(schema.additionalProperties) || typeof schema.additionalProperties === 'boolean') {
          walkSchema(child, schema.additionalProperties, childPath(path, key), context);
        }
      }
      const propertyCount = Object.keys(value).length;
      if (schema.minProperties !== undefined && propertyCount < schema.minProperties) addIssue(context, 'MIN_PROPERTIES', path, `Object must contain at least ${schema.minProperties} properties.`);
      if (schema.maxProperties !== undefined && propertyCount > schema.maxProperties) addIssue(context, 'MAX_PROPERTIES', path, `Object must contain at most ${schema.maxProperties} properties.`);
    }
  } finally {
    if (composite) context.visiting.delete(value);
  }
}

function semanticIssue(issues, code, path, message, severity = 'error') {
  issues.push({ code, severity, path, message });
}

function duplicates(items, selector = item => item) {
  const seen = new Set();
  const repeated = new Set();
  for (const item of items) {
    const key = selector(item);
    if (seen.has(key)) repeated.add(key);
    seen.add(key);
  }
  return [...repeated].sort();
}

function addDuplicateIssues(issues, items, selector, path, label) {
  for (const value of duplicates(items, selector)) semanticIssue(issues, 'DUPLICATE_IDENTIFIER', path, `${label} '${value}' is duplicated.`);
}

function validateFormulaSemantics(value, issues, path = '$') {
  const hasArgs = OWN(value, 'args');
  const hasParameters = OWN(value, 'parameters');
  if (hasArgs === hasParameters) semanticIssue(issues, 'AMBIGUOUS_FORMULA_ARGUMENTS', path, 'Formula must define exactly one of args or parameters.', 'blocker');
}

function validateRuleSemantics(value, issues, path = '$') {
  if (value.type === 'list' && OWN(value, 'source') === OWN(value, 'values')) {
    semanticIssue(issues, 'LIST_SOURCE_INVALID', path, 'List validation requires exactly one of source or values.', 'blocker');
  }
  if (value.type === 'range' && (!OWN(value, 'minimum') || !OWN(value, 'maximum'))) {
    semanticIssue(issues, 'RANGE_BOUND_MISSING', path, 'Range validation requires minimum and maximum.', 'blocker');
  }
  if (OWN(value, 'minimum') && OWN(value, 'maximum') && value.minimum > value.maximum) {
    semanticIssue(issues, 'INVALID_RANGE', path, 'Validation minimum cannot exceed maximum.', 'blocker');
  }
}

function validateSheetSemantics(value, issues, path = '$') {
  addDuplicateIssues(issues, value.columns, item => item.id, `${path}.columns`, 'Column id');
  addDuplicateIssues(issues, value.formulas, item => item.id, `${path}.formulas`, 'Formula id');
  addDuplicateIssues(issues, value.validations, item => item.id, `${path}.validations`, 'Validation id');
  const validationIds = new Set(value.validations.map(item => item.id));
  for (const [index, column] of value.columns.entries()) {
    if (column.validationId && !validationIds.has(column.validationId)) semanticIssue(issues, 'UNKNOWN_VALIDATION_REFERENCE', `${path}.columns[${index}].validationId`, `Unknown validation '${column.validationId}'.`, 'blocker');
  }
  value.formulas.forEach((formula, index) => {
    if (formula.sheetId !== value.id) semanticIssue(issues, 'SHEET_REFERENCE_MISMATCH', `${path}.formulas[${index}].sheetId`, `Formula must reference containing sheet '${value.id}'.`, 'blocker');
    validateFormulaSemantics(formula, issues, `${path}.formulas[${index}]`);
  });
  value.validations.forEach((rule, index) => {
    if (rule.sheetId !== value.id) semanticIssue(issues, 'SHEET_REFERENCE_MISMATCH', `${path}.validations[${index}].sheetId`, `Validation must reference containing sheet '${value.id}'.`, 'blocker');
    validateRuleSemantics(rule, issues, `${path}.validations[${index}]`);
  });
}

function validateProductDefinitionSemantics(value, issues) {
  const outputTypes = value.outputTypes ?? ['xlsx', 'zip'];
  const sheets = value.sheets ?? [];
  const formulas = value.formulas ?? [];
  const validations = value.validations ?? [];
  const documentTemplates = value.documentTemplates ?? [];
  const configuration = value.defaultConfiguration;
  if (configuration.productId !== value.id) semanticIssue(issues, 'PRODUCT_REFERENCE_MISMATCH', '$.defaultConfiguration.productId', 'Default configuration must reference the owning product.', 'blocker');
  if (configuration.productVersion !== value.version) semanticIssue(issues, 'PRODUCT_REFERENCE_MISMATCH', '$.defaultConfiguration.productVersion', 'Default configuration must reference the owning product version.', 'blocker');
  for (const [field, supportedField] of [['locale', 'supportedLocales'], ['currency', 'supportedCurrencies'], ['themeId', 'supportedThemes']]) {
    if (!value[supportedField].includes(configuration[field])) semanticIssue(issues, 'UNSUPPORTED_DEFAULT', `$.defaultConfiguration.${field}`, `Default ${field} is absent from ${supportedField}.`, 'blocker');
  }
  if (['deprecated', 'retired'].includes(value.status) && value.recommended) semanticIssue(issues, 'INVALID_RECOMMENDATION', '$.recommended', 'Deprecated or retired products cannot be recommended.', 'blocker');

  if (outputTypes.includes('xlsx')) {
    if (!sheets.length) semanticIssue(issues, 'WORKBOOK_SHEETS_MISSING', '$.sheets', 'XLSX products require at least one sheet.', 'blocker');
    if (!value.exportProfile.workbookFilenameTemplate) semanticIssue(issues, 'WORKBOOK_FILENAME_TEMPLATE_MISSING', '$.exportProfile.workbookFilenameTemplate', 'XLSX products require a workbook filename template.', 'blocker');
    if (!value.exportProfile.include.includes('workbook')) semanticIssue(issues, 'WORKBOOK_EXPORT_MISSING', '$.exportProfile.include', "XLSX products must include the 'workbook' export.", 'blocker');
    if (!configuration.filename.toLowerCase().endsWith('.xlsx')) semanticIssue(issues, 'WORKBOOK_CONFIGURATION_FILENAME', '$.defaultConfiguration.filename', 'XLSX products require an .xlsx primary filename.', 'blocker');
  } else if (sheets.length || formulas.length || validations.length) {
    semanticIssue(issues, 'UNDECLARED_WORKBOOK_CONTENT', '$.sheets', 'Products without XLSX output cannot declare workbook sheets, formulas, or validations.', 'blocker');
  }
  if (outputTypes.includes('docx')) {
    if (!documentTemplates.length) semanticIssue(issues, 'DOCUMENT_TEMPLATES_MISSING', '$.documentTemplates', 'DOCX products require at least one document template.', 'blocker');
    if (!value.exportProfile.include.includes('documents')) semanticIssue(issues, 'DOCUMENT_EXPORT_MISSING', '$.exportProfile.include', "DOCX products must include the 'documents' export.", 'blocker');
    if (configuration.outputOptions.documents !== true) semanticIssue(issues, 'DOCUMENT_OUTPUT_DISABLED', '$.defaultConfiguration.outputOptions.documents', 'DOCX products must enable document output by default.', 'blocker');
    if (!outputTypes.includes('xlsx') && !configuration.filename.toLowerCase().endsWith('.docx')) semanticIssue(issues, 'DOCUMENT_CONFIGURATION_FILENAME', '$.defaultConfiguration.filename', 'Document-only products require a .docx primary filename.', 'blocker');
  } else if (documentTemplates.length) {
    semanticIssue(issues, 'UNDECLARED_DOCUMENT_CONTENT', '$.documentTemplates', 'Products without DOCX output cannot declare document templates.', 'blocker');
  }
  if (outputTypes.includes('zip') && !configuration.outputOptions.package) semanticIssue(issues, 'PACKAGE_OUTPUT_DISABLED', '$.defaultConfiguration.outputOptions.package', 'ZIP products must enable package output by default.', 'blocker');
  if (!outputTypes.includes('zip') && configuration.outputOptions.package) semanticIssue(issues, 'UNDECLARED_PACKAGE_OUTPUT', '$.defaultConfiguration.outputOptions.package', 'Products without ZIP output cannot enable package output.', 'blocker');

  addDuplicateIssues(issues, sheets, item => item.id, '$.sheets', 'Sheet id');
  addDuplicateIssues(issues, sheets, item => item.order, '$.sheets', 'Sheet order');
  addDuplicateIssues(issues, documentTemplates, item => item.id, '$.documentTemplates', 'Document template id');
  addDuplicateIssues(issues, documentTemplates, item => item.filename.toLowerCase(), '$.documentTemplates', 'Document filename');
  addDuplicateIssues(issues, value.configurableFields, item => item.id, '$.configurableFields', 'Configurable field id');
  addDuplicateIssues(issues, value.configurableFields, item => item.configurationPath, '$.configurableFields', 'Configuration path');
  addDuplicateIssues(issues, formulas, item => item.id, '$.formulas', 'Formula id');
  addDuplicateIssues(issues, validations, item => item.id, '$.validations', 'Validation id');
  addDuplicateIssues(issues, value.qualityRules, item => item.id, '$.qualityRules', 'Quality rule id');
  addDuplicateIssues(issues, value.imageSpecifications, item => item.id, '$.imageSpecifications', 'Image specification id');

  const supportedLanguages = new Set(value.supportedLocales.map(locale => locale.split('-')[0]));
  documentTemplates.forEach((template, index) => {
    if (!supportedLanguages.has(template.language)) semanticIssue(issues, 'UNSUPPORTED_DOCUMENT_LANGUAGE', `$.documentTemplates[${index}].language`, `Document language '${template.language}' is absent from supportedLocales.`, 'blocker');
  });

  const sheetIds = new Set(sheets.map(sheet => sheet.id));
  const columnsBySheet = new Map(sheets.map(sheet => [sheet.id, new Set(sheet.columns.map(column => column.id))]));
  const allValidationIds = new Set(validations.map(rule => rule.id));
  for (const sheet of sheets) for (const rule of sheet.validations) allValidationIds.add(rule.id);

  sheets.forEach((sheet, index) => {
    addDuplicateIssues(issues, sheet.columns, item => item.id, `$.sheets[${index}].columns`, 'Column id');
    addDuplicateIssues(issues, sheet.formulas, item => item.id, `$.sheets[${index}].formulas`, 'Formula id');
    addDuplicateIssues(issues, sheet.validations, item => item.id, `$.sheets[${index}].validations`, 'Validation id');
    sheet.columns.forEach((column, columnIndex) => {
      if (column.validationId && !allValidationIds.has(column.validationId)) semanticIssue(issues, 'UNKNOWN_VALIDATION_REFERENCE', `$.sheets[${index}].columns[${columnIndex}].validationId`, `Unknown validation '${column.validationId}'.`, 'blocker');
    });
    sheet.formulas.forEach((formula, formulaIndex) => {
      if (formula.sheetId !== sheet.id) semanticIssue(issues, 'SHEET_REFERENCE_MISMATCH', `$.sheets[${index}].formulas[${formulaIndex}].sheetId`, `Formula must reference containing sheet '${sheet.id}'.`, 'blocker');
      validateFormulaSemantics(formula, issues, `$.sheets[${index}].formulas[${formulaIndex}]`);
    });
    sheet.validations.forEach((rule, ruleIndex) => {
      if (rule.sheetId !== sheet.id) semanticIssue(issues, 'SHEET_REFERENCE_MISMATCH', `$.sheets[${index}].validations[${ruleIndex}].sheetId`, `Validation must reference containing sheet '${sheet.id}'.`, 'blocker');
      if (rule.columnId && !columnsBySheet.get(sheet.id)?.has(rule.columnId)) semanticIssue(issues, 'UNKNOWN_COLUMN_REFERENCE', `$.sheets[${index}].validations[${ruleIndex}].columnId`, `Unknown column '${rule.columnId}' in sheet '${sheet.id}'.`, 'blocker');
      validateRuleSemantics(rule, issues, `$.sheets[${index}].validations[${ruleIndex}]`);
    });
  });

  formulas.forEach((formula, index) => {
    if (!sheetIds.has(formula.sheetId)) semanticIssue(issues, 'UNKNOWN_SHEET_REFERENCE', `$.formulas[${index}].sheetId`, `Unknown sheet '${formula.sheetId}'.`, 'blocker');
    validateFormulaSemantics(formula, issues, `$.formulas[${index}]`);
  });
  validations.forEach((rule, index) => {
    if (!sheetIds.has(rule.sheetId)) semanticIssue(issues, 'UNKNOWN_SHEET_REFERENCE', `$.validations[${index}].sheetId`, `Unknown sheet '${rule.sheetId}'.`, 'blocker');
    else if (rule.columnId && !columnsBySheet.get(rule.sheetId)?.has(rule.columnId)) semanticIssue(issues, 'UNKNOWN_COLUMN_REFERENCE', `$.validations[${index}].columnId`, `Unknown column '${rule.columnId}' in sheet '${rule.sheetId}'.`, 'blocker');
    validateRuleSemantics(rule, issues, `$.validations[${index}]`);
  });

  const weight = value.qualityRules.reduce((total, rule) => total + rule.weight, 0);
  if (Math.abs(weight - 1) > 1e-9) semanticIssue(issues, 'QUALITY_WEIGHT_TOTAL', '$.qualityRules', `Quality rule weights must total 1; received ${weight}.`, 'blocker');
}

function documentText(template) {
  const values = [template.title, template.header?.text, template.footer?.text, ...(template.requiredText ?? [])];
  for (const section of template.sections) {
    values.push(section.title);
    for (const block of section.blocks) {
      values.push(block.text, ...(block.items ?? []), ...(block.columns ?? []), ...(block.rows ?? []).flat());
    }
  }
  return values.filter(value => typeof value === 'string').join('\n');
}

function validateDocumentTemplateSemantics(value, issues) {
  addDuplicateIssues(issues, value.sections, item => item.id, '$.sections', 'Section id');
  addDuplicateIssues(issues, value.placeholders, item => item.id, '$.placeholders', 'Placeholder id');
  addDuplicateIssues(issues, value.placeholders, item => item.token, '$.placeholders', 'Placeholder token');
  const declaredTokens = new Set(value.placeholders.map(item => item.token));
  const content = documentText(value);
  const tokens = [...content.matchAll(/\{\{[a-z][a-z0-9_]{1,62}\}\}/g)].map(match => match[0]);
  for (const token of new Set(tokens)) {
    if (!declaredTokens.has(token)) semanticIssue(issues, 'UNDECLARED_PLACEHOLDER', '$.sections', `Placeholder '${token}' is used but not declared.`, 'blocker');
  }
  value.placeholders.forEach((placeholder, index) => {
    if (placeholder.required && !content.includes(placeholder.token)) semanticIssue(issues, 'REQUIRED_PLACEHOLDER_UNUSED', `$.placeholders[${index}].token`, `Required placeholder '${placeholder.token}' is not used.`, 'blocker');
  });
  value.sections.forEach((section, sectionIndex) => section.blocks.forEach((block, blockIndex) => {
    const path = `$.sections[${sectionIndex}].blocks[${blockIndex}]`;
    if (['paragraph', 'heading'].includes(block.type) && !block.text?.trim()) semanticIssue(issues, 'DOCUMENT_TEXT_MISSING', `${path}.text`, `${block.type} blocks require text.`, 'blocker');
    if (block.type === 'heading' && !block.level) semanticIssue(issues, 'DOCUMENT_HEADING_LEVEL_MISSING', `${path}.level`, 'Heading blocks require a level.', 'blocker');
    if (block.type === 'list' && (!block.items?.length || typeof block.ordered !== 'boolean')) semanticIssue(issues, 'DOCUMENT_LIST_INVALID', path, 'List blocks require items and an ordered flag.', 'blocker');
    if (block.type === 'table') {
      if (!block.columns?.length || !Array.isArray(block.rows) || block.columnWidths?.length !== block.columns.length) semanticIssue(issues, 'DOCUMENT_TABLE_INVALID', path, 'Table blocks require columns, rows and one width per column.', 'blocker');
      if (block.rows?.some(row => row.length !== block.columns?.length)) semanticIssue(issues, 'DOCUMENT_TABLE_ROW_WIDTH', `${path}.rows`, 'Every table row must match the column count.', 'blocker');
      if (block.columnWidths && block.columnWidths.reduce((total, width) => total + width, 0) !== 9360) semanticIssue(issues, 'DOCUMENT_TABLE_GEOMETRY', `${path}.columnWidths`, 'Table column widths must total 9360 DXA.', 'blocker');
    }
    if (block.type === 'page-break' && Object.keys(block).some(key => key !== 'type')) semanticIssue(issues, 'DOCUMENT_PAGE_BREAK_INVALID', path, 'Page-break blocks cannot contain content properties.', 'blocker');
  }));
  if (!isSafeRelativePath(value.packaging.relativePath)) semanticIssue(issues, 'UNSAFE_RELATIVE_PATH', '$.packaging.relativePath', 'Document package path must remain relative and traversal-free.', 'blocker');
  if (!value.packaging.relativePath.toLowerCase().endsWith('.docx')) semanticIssue(issues, 'DOCUMENT_PACKAGE_EXTENSION', '$.packaging.relativePath', 'Document package path must end in .docx.', 'blocker');
}

function isSafeRelativePath(value) {
  if (typeof value !== 'string' || !value || /^[A-Za-z]:/.test(value) || /^[\\/]/.test(value) || /[\u0000-\u001f]/.test(value)) return false;
  return !value.split(/[\\/]/).some(segment => segment === '' || segment === '.' || segment === '..');
}

function validateGeneratedManifestSemantics(value, issues) {
  if (value.configuration.productId !== value.productId || value.configuration.productVersion !== value.productVersion) semanticIssue(issues, 'PRODUCT_REFERENCE_MISMATCH', '$.configuration', 'Configuration identity must match the manifest product identity.', 'blocker');
  for (const [key, path] of [['productId', '$.productId'], ['productVersion', '$.productVersion']]) {
    for (const reportName of ['qualityReport', 'compatibilityReport']) {
      if (value[reportName][key] !== value[key]) semanticIssue(issues, 'REPORT_REFERENCE_MISMATCH', `$.${reportName}.${key}`, `${reportName}.${key} must match ${path}.`, 'blocker');
    }
  }
  addDuplicateIssues(issues, value.files, item => item.path.toLowerCase(), '$.files', 'File path');
  value.files.forEach((file, index) => {
    if (!isSafeRelativePath(file.path)) semanticIssue(issues, 'UNSAFE_RELATIVE_PATH', `$.files[${index}].path`, 'Generated file path must remain inside the package root.', 'blocker');
    if (value.checksums[file.path] !== file.sha256) semanticIssue(issues, 'CHECKSUM_MISMATCH', `$.checksums.${file.path}`, 'Checksum index must match the corresponding file record.', 'blocker');
  });
  for (const path of Object.keys(value.checksums)) {
    if (!value.files.some(file => file.path === path)) semanticIssue(issues, 'ORPHAN_CHECKSUM', `$.checksums.${path}`, 'Checksum index cannot contain a path absent from files.', 'blocker');
  }
  addDuplicateIssues(issues, value.sourceDefinitions, item => `${item.type}:${item.id}:${item.version}`, '$.sourceDefinitions', 'Source definition');
  if (value.validationStatus !== value.validationReport.status) semanticIssue(issues, 'VALIDATION_STATUS_MISMATCH', '$.validationStatus', 'validationStatus must match validationReport.status.', 'blocker');
  if (Math.abs(value.qualityScore - value.qualityReport.score) > 1e-9) semanticIssue(issues, 'QUALITY_SCORE_MISMATCH', '$.qualityScore', 'qualityScore must match qualityReport.score.', 'blocker');
  if (value.compatibilityStatus !== value.compatibilityReport.status) semanticIssue(issues, 'COMPATIBILITY_STATUS_MISMATCH', '$.compatibilityStatus', 'compatibilityStatus must match compatibilityReport.status.', 'blocker');
  if (['READY_FOR_REVIEW', 'APPROVED', 'RELEASED'].includes(value.releaseStatus) && (value.validationStatus !== 'PASS' || value.qualityReport.status !== 'PASS' || value.compatibilityStatus !== 'PASS')) semanticIssue(issues, 'RELEASE_GATE_FAILED', '$.releaseStatus', 'A releasable manifest requires passing validation, quality and compatibility gates.', 'blocker');
}

function expectedCompatibilityStatus(targets) {
  const statuses = targets.map(target => target.status);
  if (statuses.includes('FAIL')) return 'FAIL';
  if (statuses.every(status => status === 'PASS')) return 'PASS';
  if (statuses.every(status => status === 'NOT_TESTED')) return 'NOT_TESTED';
  return 'PARTIAL';
}

function validateValidationReportSemantics(value, issues) {
  const valid = value.issues.length === 0;
  if (value.valid !== valid || value.status !== (valid ? 'PASS' : 'FAIL')) semanticIssue(issues, 'REPORT_STATUS_MISMATCH', '$', 'Validation status and valid flag must match the issue collection.', 'blocker');
  const errors = value.issues.filter(issue => issue.severity === 'error').length;
  const blockers = value.issues.filter(issue => issue.severity === 'blocker').length;
  if (value.summary.errorCount !== errors || value.summary.blockerCount !== blockers) semanticIssue(issues, 'REPORT_SUMMARY_MISMATCH', '$.summary', 'Validation summary counts must match issues.', 'blocker');
}

function validateQualityReportSemantics(value, issues) {
  const weight = value.components.reduce((total, component) => total + component.weight, 0);
  if (Math.abs(weight - 1) > 1e-9) semanticIssue(issues, 'QUALITY_WEIGHT_TOTAL', '$.components', `Quality component weights must total 1; received ${weight}.`, 'blocker');
  if (value.status === 'PASS' && value.score < value.threshold) semanticIssue(issues, 'QUALITY_STATUS_MISMATCH', '$.status', 'PASS requires a score at or above the threshold.', 'blocker');
}

function validateCompatibilityReportSemantics(value, issues) {
  const expected = expectedCompatibilityStatus(value.targets);
  if (value.status !== expected) semanticIssue(issues, 'COMPATIBILITY_STATUS_MISMATCH', '$.status', `Compatibility status must be ${expected} for the supplied target results.`, 'blocker');
  for (const [index, target] of value.targets.entries()) {
    if (target.verified !== (target.status !== 'NOT_TESTED')) semanticIssue(issues, 'VERIFICATION_FLAG_MISMATCH', `$.targets[${index}].verified`, 'verified must be false only for NOT_TESTED targets.', 'blocker');
  }
}

function validateImageManifestSemantics(value, issues) {
  addDuplicateIssues(issues, value.assets, item => item.id, '$.assets', 'Asset id');
  addDuplicateIssues(issues, value.assets, item => item.order, '$.assets', 'Asset order');
  addDuplicateIssues(issues, value.assets, item => item.filename.toLowerCase(), '$.assets', 'Asset filename');
  value.assets.forEach((asset, index) => {
    if (asset.status !== 'validated') return;
    if (!asset.sha256) semanticIssue(issues, 'ASSET_CHECKSUM_MISSING', `$.assets[${index}].sha256`, 'Validated assets require a SHA-256 checksum.', 'blocker');
  });
  if (value.extensions?.productionPolicy?.executionClaim === 'GENERATED_AND_VALIDATED_IMAGE_ASSETS') {
    const expectedPaths = [
      'listing/images/01-hero.png', 'listing/images/02-dashboard-overview.png', 'listing/images/03-monthly-budget.png',
      'listing/images/04-key-features.png', 'listing/images/05-light-dark-comparison.png', 'listing/images/06-whats-included.png',
      'listing/images/07-language-currency-options.png', 'listing/images/08-how-it-works.png', 'listing/images/09-workbook-previews.png',
      'listing/images/10-digital-download.png',
      'listing/images/11-excel-google-sheets.png', 'listing/images/12-paycheck-planning.png', 'listing/images/13-debt-payoff.png',
      'listing/images/14-savings-goals.png', 'listing/images/15-net-worth.png', 'listing/images/16-bill-subscriptions.png',
      'listing/images/17-privacy-no-account.png', 'listing/images/18-support-promise.png', 'listing/images/19-buyer-fit.png',
      'listing/images/20-value-stack.png',
    ];
    if (value.assets.length !== expectedPaths.length || value.assets.some((asset, index) => asset.status !== 'validated' || asset.packagePath !== expectedPaths[index])) {
      semanticIssue(issues, 'LISTING_IMAGE_SET_INCOMPLETE', '$.assets', 'Generated image manifests must contain the exact twenty validated listing image paths in order.', 'blocker');
    }
    value.assets.forEach((asset, index) => {
      if (!asset.packagePath || !asset.mediaType || !asset.bytes || !asset.locale || !asset.theme || !asset.tier || !asset.appearance || !asset.renderSource || !asset.altText?.trim()) {
        semanticIssue(issues, 'ASSET_EVIDENCE_MISSING', `$.assets[${index}]`, 'Generated assets require package, byte, locale, theme, tier, appearance, render-source and alt-text evidence.', 'blocker');
      }
      if (asset.format !== 'png' || asset.mediaType !== 'image/png') semanticIssue(issues, 'ASSET_FORMAT_INVALID', `$.assets[${index}].format`, 'Generated listing assets must be PNG images.', 'blocker');
      if (asset.width < 2000 || asset.width <= asset.height) semanticIssue(issues, 'ASSET_DIMENSIONS_INVALID', `$.assets[${index}]`, 'Generated listing assets must be landscape images at least 2000 pixels wide.', 'blocker');
      if (asset.packagePath && asset.packagePath !== `listing/images/${asset.filename}`) semanticIssue(issues, 'ASSET_PATH_MISMATCH', `$.assets[${index}].packagePath`, 'Generated asset packagePath must match its listing image filename.', 'blocker');
      if (asset.locale && asset.locale !== value.locale) semanticIssue(issues, 'ASSET_LOCALE_MISMATCH', `$.assets[${index}].locale`, 'Generated asset locale must match the image manifest.', 'blocker');
      if (asset.theme && asset.theme !== value.theme) semanticIssue(issues, 'ASSET_THEME_MISMATCH', `$.assets[${index}].theme`, 'Generated asset theme must match the image manifest.', 'blocker');
    });
    addDuplicateIssues(issues, value.assets, item => item.packagePath?.toLowerCase(), '$.assets', 'Asset package path');
    addDuplicateIssues(issues, value.assets, item => item.sha256?.toLowerCase(), '$.assets', 'Asset checksum');
  }
}

function validateReleaseManifestSemantics(value, issues) {
  if (value.generatedProduct.productId !== value.productId || value.generatedProduct.productVersion !== value.productVersion) semanticIssue(issues, 'PRODUCT_REFERENCE_MISMATCH', '$.generatedProduct', 'Generated product identity must match the release identity.', 'blocker');
  addDuplicateIssues(issues, value.approvals, item => item.role, '$.approvals', 'Approval role');
  if (value.status === 'RELEASED') {
    if (!value.releasedAt) semanticIssue(issues, 'RELEASE_TIMESTAMP_MISSING', '$.releasedAt', 'Released manifests require releasedAt.', 'blocker');
    if (!value.generatedProduct.validationReport.valid || value.generatedProduct.qualityReport.status !== 'PASS' || value.generatedProduct.compatibilityReport.status !== 'PASS') semanticIssue(issues, 'RELEASE_GATE_FAILED', '$.generatedProduct', 'Released products require passing validation, quality and compatibility reports.', 'blocker');
    if (!value.approvals.some(approval => approval.role === 'release' && approval.decision === 'APPROVED')) semanticIssue(issues, 'RELEASE_APPROVAL_MISSING', '$.approvals', 'Released products require release approval.', 'blocker');
  }
}

const semanticValidators = new Map([
  ['ProductDefinition', validateProductDefinitionSemantics],
  ['ProductConfiguration', (value, issues) => {
    if (!value.title.trim()) semanticIssue(issues, 'EMPTY_TRIMMED_STRING', '$.title', 'Title cannot contain whitespace only.', 'blocker');
  }],
  ['SheetDefinition', validateSheetSemantics],
  ['FormulaDefinition', validateFormulaSemantics],
  ['ValidationRule', validateRuleSemantics],
  ['ImageProductionManifest', validateImageManifestSemantics],
  ['GeneratedProductManifest', validateGeneratedManifestSemantics],
  ['ValidationReport', validateValidationReportSemantics],
  ['QualityReport', validateQualityReportSemantics],
  ['CompatibilityReport', validateCompatibilityReportSemantics],
  ['ReleaseManifest', validateReleaseManifestSemantics],
  ['DocumentTemplate', validateDocumentTemplateSemantics],
]);

function freezeReport(report) {
  Object.freeze(report.summary);
  report.issues.forEach(Object.freeze);
  Object.freeze(report.issues);
  return Object.freeze(report);
}

function buildReport(contract, issues) {
  const sorted = [...issues].sort((left, right) => left.path.localeCompare(right.path, 'en') || left.code.localeCompare(right.code, 'en'));
  const errorCount = sorted.filter(issue => issue.severity === 'error').length;
  const blockerCount = sorted.filter(issue => issue.severity === 'blocker').length;
  return freezeReport({
    schemaVersion: SCHEMA_VERSION,
    contract,
    status: sorted.length ? 'FAIL' : 'PASS',
    valid: sorted.length === 0,
    issues: sorted,
    summary: { errorCount, blockerCount },
    generatedAt: null,
  });
}

export function validateContract(contractName, value, options = {}) {
  const schema = getContractSchema(contractName);
  if (!schema) return buildReport(String(contractName), [{ code: 'UNKNOWN_CONTRACT', severity: 'blocker', path: '$', message: `Unknown contract '${contractName}'.` }]);

  const unknownFields = options.unknownFields ?? 'reject';
  if (!['reject', 'ignore'].includes(unknownFields)) return buildReport(contractName, [{ code: 'INVALID_VALIDATOR_OPTION', severity: 'blocker', path: '$options.unknownFields', message: "unknownFields must be 'reject' or 'ignore'." }]);
  const maxIssues = options.maxIssues ?? 100;
  if (!Number.isInteger(maxIssues) || maxIssues < 1 || maxIssues > 1000) return buildReport(contractName, [{ code: 'INVALID_VALIDATOR_OPTION', severity: 'blocker', path: '$options.maxIssues', message: 'maxIssues must be an integer from 1 through 1000.' }]);

  const context = { issues: [], maxIssues, unknownFields, visiting: new WeakSet() };
  validateJsonValue(value, '$', context);
  walkSchema(value, schema, '$', context);
  if (context.issues.length === 0) semanticValidators.get(contractName)?.(value, context.issues);
  return buildReport(contractName, context.issues);
}

export class ContractValidationError extends TypeError {
  constructor(report) {
    super(`${report.contract} validation failed with ${report.issues.length} issue(s)`);
    this.name = 'ContractValidationError';
    this.code = 'CONTRACT_VALIDATION_FAILED';
    this.report = report;
  }
}

export function assertContract(contractName, value, options) {
  const report = validateContract(contractName, value, options);
  if (!report.valid) throw new ContractValidationError(report);
  return value;
}

export const validateProductDefinition = (value, options) => validateContract('ProductDefinition', value, options);
export const validateProductConfiguration = (value, options) => validateContract('ProductConfiguration', value, options);
export const validateSheetDefinition = (value, options) => validateContract('SheetDefinition', value, options);
export const validateColumnDefinition = (value, options) => validateContract('ColumnDefinition', value, options);
export const validateFormulaDefinition = (value, options) => validateContract('FormulaDefinition', value, options);
export const validateValidationRule = (value, options) => validateContract('ValidationRule', value, options);
export const validateThemeDefinition = (value, options) => validateContract('ThemeDefinition', value, options);
export const validateLocalizationBundle = (value, options) => validateContract('LocalizationBundle', value, options);
export const validateCommercialMetadata = (value, options) => validateContract('CommercialMetadata', value, options);
export const validateImageProductionManifest = (value, options) => validateContract('ImageProductionManifest', value, options);
export const validateGeneratedProductManifest = (value, options) => validateContract('GeneratedProductManifest', value, options);
export const validateValidationReport = (value, options) => validateContract('ValidationReport', value, options);
export const validateQualityReport = (value, options) => validateContract('QualityReport', value, options);
export const validateCompatibilityReport = (value, options) => validateContract('CompatibilityReport', value, options);
export const validateReleaseManifest = (value, options) => validateContract('ReleaseManifest', value, options);
export const validateDocumentTemplate = (value, options) => validateContract('DocumentTemplate', value, options);
