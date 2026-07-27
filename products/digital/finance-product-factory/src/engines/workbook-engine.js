import {
  cellAddress,
  columnName,
  excelString,
  quoteSheetName,
  sheetCell,
  sheetRange,
} from './formula-engine.js';
import { injectWorkbookCharts } from './chart-engine.js';
import { resolveConfiguredCategoryRows } from './category-engine.js';
import { safeSpreadsheetText } from './security.js';

export const WORKBOOK_ENGINE_VERSION = '1.1.0';
export const WORKBOOK_LAYOUT = Object.freeze({ titleRow: 1, instructionRow: 2, contextRow: 3, headerRow: 4, dataStartRow: 5 });

const PAPER_SIZES = Object.freeze({ Letter: 1, Legal: 5, A4: 9 });
const DEFAULT_COLORS = Object.freeze({
  background: '#070707', surface: '#0F0F0F', accent: '#00FF94', text: '#EDEBE3',
  muted: '#777777', input: '#FFF4CC', formula: '#E8F1FF', success: '#DDF8E8', warning: '#FFF0D5', danger: '#FFE0E0',
});
const EXCEL_FORMULA = /^=[^=].*/;
const CELL_REFERENCE = /^[A-Z]{1,3}[1-9][0-9]{0,6}$/;
const COLUMN_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

export class WorkbookGenerationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'WorkbookGenerationError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new WorkbookGenerationError(code, message, details);
}

function argb(value, fallback = '#000000') {
  const color = /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : fallback;
  return `FF${color.slice(1).toUpperCase()}`;
}

function palette(theme) {
  const supplied = theme?.colors ?? {};
  const colors = {
    ...DEFAULT_COLORS,
    ...supplied,
    input: supplied.inputFill ?? supplied.input ?? DEFAULT_COLORS.input,
    formula: supplied.formulaFill ?? supplied.formula ?? DEFAULT_COLORS.formula,
    success: supplied.successFill ?? supplied.success ?? DEFAULT_COLORS.success,
    warning: supplied.warningFill ?? supplied.warning ?? DEFAULT_COLORS.warning,
    danger: supplied.errorFill ?? supplied.danger ?? DEFAULT_COLORS.danger,
  };
  return Object.fromEntries(Object.entries(colors).map(([key, value]) => [key, argb(value, DEFAULT_COLORS[key] ?? '#000000')]));
}

export function createTranslator(localization) {
  const messages = localization?.messages ?? {};
  return (key, fallback = key) => safeSpreadsheetText(messages[key] ?? fallback);
}

function excelSheetName(name, usedNames) {
  const value = String(name ?? '').trim();
  try {
    quoteSheetName(value);
  } catch (error) {
    fail('INVALID_SHEET_NAME', error.message, { name: value });
  }
  const normalized = value.toLocaleLowerCase('en-US');
  if (usedNames.has(normalized)) fail('DUPLICATE_SHEET_NAME', `Duplicate translated sheet name: ${value}.`);
  usedNames.add(normalized);
  return value;
}

function tableName(definition, sheet) {
  const compact = `T_${definition.id}_${sheet.id}`.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 200);
  return /^[A-Za-z_]/.test(compact) ? compact : `T_${compact}`;
}

function currencyNumberFormat(profile, code) {
  const explicit = profile?.workbookNumberFormats?.accounting ?? profile?.workbookNumberFormats?.standard ?? profile?.formats?.accounting ?? profile?.formats?.currency ?? profile?.excelFormat ?? profile?.numberFormat;
  if (typeof explicit === 'string' && explicit.length <= 120) return suppressZeroSection(explicit);
  const formats = {
    EUR: '[$€-nl-NL] #,##0.00;[Red]-[$€-nl-NL] #,##0.00',
    USD: '[$$-en-US] #,##0.00;[Red]-[$$-en-US] #,##0.00',
    GBP: '[$£-en-GB] #,##0.00;[Red]-[$£-en-GB] #,##0.00',
    CHF: '[$CHF-de-CH] #,##0.00;[Red]-[$CHF-de-CH] #,##0.00',
  };
  return suppressZeroSection(formats[code] ?? `[$${code}] #,##0.00;[Red]-[$${code}] #,##0.00`);
}

function suppressZeroSection(format) {
  const sections = String(format).split(';');
  if (sections.length === 1) return `${sections[0]};-${sections[0]};;@`;
  if (sections.length === 2) return `${sections[0]};${sections[1]};;@`;
  sections[2] = '';
  if (sections.length === 3) sections.push('@');
  return sections.join(';');
}

function numberFormat(column, localization, currencyProfile, configuration) {
  if (column.format === 'currency' || column.type === 'currency') return currencyNumberFormat(currencyProfile, configuration.currency);
  if (column.format === 'percentage' || column.type === 'percentage') return suppressZeroSection(currencyProfile?.workbookNumberFormats?.percentage ?? currencyProfile?.formats?.percentage ?? '0.0%');
  if (column.format === 'locale-date' || column.type === 'date') return localization?.formats?.date ?? 'yyyy-mm-dd';
  if (column.format === 'text') return '@';
  if (column.format === 'integer') return '0;-0;;@';
  if (column.format === 'number') return '#,##0.00;[Red]-#,##0.00;;@';
  if (column.format && /[#0@]/.test(column.format) && !/[<>{}=]/.test(column.format)) return column.format;
  if (column.format) fail('INVALID_NUMBER_FORMAT', `Column ${column.id} uses unsupported number format ${column.format}.`);
  if (column.type === 'integer') return '0;-0;;@';
  if (column.type === 'number' || column.type === 'formula') return '#,##0.00;[Red]-#,##0.00;;@';
  return 'General';
}

function finiteNumber(value, fallback = null) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function dateValue(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return new Date(value.getTime());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00.000Z`);
    if (Number.isFinite(date.getTime())) return date;
  }
  return null;
}

function sampleCellValue(column, value, context) {
  if (value === null || value === undefined || value === '') return null;
  if (value && typeof value === 'object' && !Array.isArray(value) && value.messageKey) {
    value = context.translate(value.messageKey, value.fallback ?? value.messageKey);
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && value.configurationPath) {
    value = String(value.configurationPath).split('.').reduce((current, key) => current?.[key], context.configuration);
  }
  if (column.type === 'date') return dateValue(value);
  if (['integer', 'number', 'currency', 'percentage'].includes(column.type)) return finiteNumber(value);
  if (column.type === 'boolean') return Boolean(value);
  if (column.type === 'formula') return null;
  return safeSpreadsheetText(value);
}

function sheetCapacity(sheet, configuration) {
  if (sheet.type === 'dashboard') return Math.max(sheet.inputRows, sheet.formulas.length, sheet.sampleRows?.length ?? 0);
  const configured = ['input', 'data'].includes(sheet.type) || sheet.extensions?.capacityMode === 'configuration';
  const count = configured ? configuration.inputCapacity : sheet.inputRows;
  if (!Number.isInteger(count) || count < 0 || count > 10_000) fail('INVALID_ROW_CAPACITY', `Invalid row capacity for sheet ${sheet.id}.`, { count });
  return Math.max(count, sheet.sampleRows?.length ?? 0);
}

function sheetContext(definition, configuration, localization, currencyProfile, theme) {
  const translate = createTranslator(localization);
  const usedNames = new Set();
  const ordered = [...definition.sheets].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id, 'en'));
  const sheets = ordered.map(sheet => ({
    definition: sheet,
    name: excelSheetName(translate(sheet.nameKey, sheet.id.replaceAll('-', ' ')), usedNames),
    capacity: sheetCapacity(sheet, configuration),
    columns: new Map(sheet.columns.map((column, index) => [column.id, { definition: column, index: index + 1 }])),
  }));
  return {
    definition, configuration, localization, currencyProfile, theme, translate,
    sheets,
    byId: new Map(sheets.map(sheet => [sheet.definition.id, sheet])),
    formulasById: new Map(definition.formulas.map(formula => [formula.id, formula])),
  };
}

function resolveSheet(context, sheetId) {
  const sheet = context.byId.get(sheetId);
  if (!sheet) fail('UNKNOWN_FORMULA_SHEET', `Unknown sheet reference ${sheetId}.`);
  return sheet;
}

function resolveColumn(sheet, columnId) {
  const column = sheet.columns.get(columnId);
  if (!column) fail('UNKNOWN_FORMULA_COLUMN', `Unknown column ${columnId} on sheet ${sheet.definition.id}.`);
  return column;
}

function rangeReference(context, reference, defaultSheetId) {
  if (!reference || typeof reference !== 'object') fail('INVALID_RANGE_REFERENCE', 'Formula range references must be objects.');
  const sheet = resolveSheet(context, reference.sheetId ?? defaultSheetId);
  const column = resolveColumn(sheet, reference.columnId);
  const firstRow = Number.isInteger(reference.firstRow) ? reference.firstRow : WORKBOOK_LAYOUT.dataStartRow;
  const lastRow = Number.isInteger(reference.lastRow) ? reference.lastRow : WORKBOOK_LAYOUT.dataStartRow + sheet.capacity - 1;
  return sheetRange(sheet.name, column.index, firstRow, Math.max(firstRow, lastRow));
}

function cellReference(context, reference, defaultSheetId, row) {
  if (!reference || typeof reference !== 'object') fail('INVALID_CELL_REFERENCE', 'Formula cell references must be objects.');
  const sheet = resolveSheet(context, reference.sheetId ?? defaultSheetId);
  const column = resolveColumn(sheet, reference.columnId);
  const targetRow = reference.row === 'current' || reference.row === undefined ? row : Number(reference.row);
  if (!Number.isInteger(targetRow) || targetRow < 1) fail('INVALID_CELL_ROW', `Invalid formula row ${reference.row}.`);
  return sheetCell(sheet.name, column.index, targetRow);
}

function scalarToken(context, value, defaultSheetId, row) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('INVALID_FORMULA_NUMBER', 'Formula numbers must be finite.');
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value === null) return excelString('');
  if (value && typeof value === 'object') {
    if (Object.hasOwn(value, 'literal')) return scalarToken(context, value.literal, defaultSheetId, row);
    if (value.configuration) {
      const configured = context.configuration[value.configuration];
      if (!['string', 'number', 'boolean'].includes(typeof configured)) fail('INVALID_CONFIGURATION_REFERENCE', `Configuration field ${value.configuration} is not scalar.`);
      return scalarToken(context, configured, defaultSheetId, row);
    }
    if (value.cell) return cellReference(context, value.cell, defaultSheetId, row);
    fail('INVALID_FORMULA_TOKEN', 'Unsupported structured formula token.');
  }
  const text = String(value ?? '');
  if (text === 'CURRENT_MONTH_CELL') {
    const sheet = resolveSheet(context, defaultSheetId);
    const monthColumn = sheet.columns.get('month') ?? sheet.columns.values().next().value;
    return sheetCell(sheet.name, monthColumn.index, row);
  }
  if (text.startsWith('CONFIG.')) return scalarToken(context, { configuration: text.slice(7) }, defaultSheetId, row);
  return excelString(text);
}

function structuredCriteria(context, criteria, defaultSheetId, row, formula = { sheetId: defaultSheetId }) {
  const result = [];
  for (const criterion of criteria ?? []) {
    if (!criterion || typeof criterion !== 'object') fail('INVALID_FORMULA_CRITERION', 'Formula criteria must be objects.');
    const range = rangeReference(context, criterion.range ?? { sheetId: criterion.sheetId, columnId: criterion.columnId }, defaultSheetId);
    if (criterion.operator === 'MONTH_EQUALS') {
      const year = context.configuration.year;
      let month = '1';
      if (criterion.rowValue) {
        const monthCell = localCell(context, formula.sheetId, criterion.rowValue, row);
        const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthValues = monthKeys.map((key, index) => excelString(context.translate(`values.month.${key}`, ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][index])));
        month = `MATCH(${monthCell},{${monthValues.join(',')}},0)`;
      } else if (Number.isInteger(criterion.value)) month = String(criterion.value);
      const start = `DATE(${year},${month},1)`;
      result.push(range, `">="&${start}`, range, `"<"&EDATE(${start},1)`);
      continue;
    }
    const criterionValue = criterion.rowValue
      ? { columnId: criterion.rowValue }
      : criterion.runtimeValue === 'TODAY'
        ? { runtimeValue: 'TODAY' }
        : criterion.value;
    const token = expressionToken(context, criterionValue, formula, row);
    const operator = criterion.operator ?? 'equal';
    const operators = {
      equal: '', notEqual: '<>', greaterThan: '>', lessThan: '<', greaterThanOrEqual: '>=', lessThanOrEqual: '<=',
      EQUAL: '', NOT_EQUAL: '<>', GREATER_THAN: '>', LESS_THAN: '<', GREATER_THAN_OR_EQUAL: '>=', LESS_THAN_OR_EQUAL: '<=',
    };
    if (!Object.hasOwn(operators, operator)) fail('UNSUPPORTED_CRITERION_OPERATOR', `Unsupported criterion operator ${operator}.`);
    result.push(range, operators[operator] ? `"${operators[operator]}"&${token}` : token);
  }
  return result;
}

function localCell(context, sheetId, columnId, row) {
  const sheet = resolveSheet(context, sheetId);
  return cellAddress(resolveColumn(sheet, columnId).index, row);
}

function formulaLocation(context, formula, row) {
  const sheet = resolveSheet(context, formula.sheetId);
  if (CELL_REFERENCE.test(formula.target)) return { sheet, row: worksheetRow(formula.target), column: worksheetColumn(formula.target), address: formula.target };
  if (sheet.columns.has(formula.target)) {
    const column = sheet.columns.get(formula.target);
    const targetRow = formula.fillDirection === 'down' ? row : WORKBOOK_LAYOUT.dataStartRow;
    return { sheet, row: targetRow, column: column.index, address: cellAddress(column.index, targetRow) };
  }
  if (sheet.definition.type === 'dashboard') {
    const index = sheet.definition.formulas.findIndex(item => item.id === formula.id);
    if (index < 0) fail('UNKNOWN_DASHBOARD_FORMULA', `Dashboard formula ${formula.id} is not registered on its sheet.`);
    const valueColumn = sheet.columns.get('value') ?? [...sheet.columns.values()][1] ?? [...sheet.columns.values()][0];
    const targetRow = WORKBOOK_LAYOUT.dataStartRow + index;
    return { sheet, row: targetRow, column: valueColumn.index, address: cellAddress(valueColumn.index, targetRow), metric: formula.target };
  }
  const configured = formula.parameters?.targetColumnId;
  if (configured && sheet.columns.has(configured)) {
    const column = sheet.columns.get(configured);
    return { sheet, row, column: column.index, address: cellAddress(column.index, row) };
  }
  const configuredCell = formula.extensions?.targetCell;
  if (CELL_REFERENCE.test(String(configuredCell ?? ''))) return { sheet, row: worksheetRow(configuredCell), column: worksheetColumn(configuredCell), address: configuredCell };
  fail('UNKNOWN_FORMULA_TARGET', `Unknown formula target ${formula.target} on sheet ${formula.sheetId}.`, { formulaId: formula.id });
}

function worksheetRow(address) {
  return Number(/\d+$/.exec(address)?.[0]);
}

function worksheetColumn(address) {
  const letters = /^[A-Z]+/.exec(address)?.[0] ?? '';
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return result;
}

function aggregateExpression(context, aggregateId) {
  if (aggregateId === 'paid-principal') return '0';
  const aliases = { 'opening-balance': 'debts' };
  const sheet = context.byId.get(aliases[aggregateId] ?? aggregateId);
  if (!sheet) fail('UNKNOWN_FORMULA_AGGREGATE', `Unknown aggregate ${aggregateId}.`);
  const preferred = ['amount', 'value', 'balance', 'actual', 'target', 'payment', 'progress-value'];
  const columnId = preferred.find(id => sheet.columns.has(id)) ?? [...sheet.columns.entries()].find(([, entry]) => ['currency', 'number', 'integer', 'formula'].includes(entry.definition.type))?.[0];
  if (!columnId) fail('UNKNOWN_AGGREGATE_COLUMN', `Aggregate ${aggregateId} has no numeric column.`);
  return `SUM(${rangeReference(context, { sheetId: sheet.definition.id, columnId }, sheet.definition.id)})`;
}

function expressionToken(context, value, formula, row) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('INVALID_FORMULA_NUMBER', 'Formula numbers must be finite.');
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value === null || value === undefined) return excelString('');
  if (typeof value === 'string') {
    if (value === 'TODAY') return 'TODAY()';
    return excelString(value);
  }
  if (typeof value !== 'object' || Array.isArray(value)) fail('INVALID_FORMULA_EXPRESSION', 'Formula expressions must be JSON scalar values or objects.');
  if (value.messageKey) return excelString(context.translate(value.messageKey, value.fallback ?? value.messageKey));
  if (Object.hasOwn(value, 'constant')) return expressionToken(context, value.constant, formula, row);
  if (value.formulaId) {
    const referenced = context.formulasById.get(value.formulaId);
    if (!referenced) fail('UNKNOWN_FORMULA_REFERENCE', `Unknown formula reference ${value.formulaId}.`);
    const location = formulaLocation(context, referenced, row);
    return sheetCell(location.sheet.name, location.column, location.row);
  }
  if (value.aggregateId) return aggregateExpression(context, value.aggregateId);
  if (value.sourceSheetId && value.columnId) return rangeReference(context, { sheetId: value.sourceSheetId, columnId: value.columnId }, formula.sheetId);
  if (value.columnId) {
    const targetRow = row + Number(value.rowOffset ?? 0);
    if (!Number.isInteger(targetRow)) fail('INVALID_FORMULA_ROW_OFFSET', `Invalid row offset for ${value.columnId}.`);
    if (targetRow < WORKBOOK_LAYOUT.dataStartRow) {
      if (formula.sheetId === 'payment-plan' && value.columnId === 'remaining') return aggregateExpression(context, 'debts');
      return '0';
    }
    return localCell(context, formula.sheetId, value.columnId, targetRow);
  }
  if (value.runtimeValue === 'TODAY') return 'TODAY()';
  if (value.operation && Array.isArray(value.operands)) {
    const tokens = value.operands.map(operand => expressionToken(context, operand, formula, row));
    const operators = { SUBTRACT: '-', ADD: '+', MULTIPLY: '*', DIVIDE: '/' };
    const operator = operators[value.operation];
    if (!operator || tokens.length < 2) fail('UNSUPPORTED_NESTED_OPERATION', `Unsupported nested formula operation ${value.operation}.`);
    return `(${tokens.join(operator)})`;
  }
  fail('INVALID_FORMULA_EXPRESSION', 'Unsupported formula expression object.');
}

function conditionToken(context, condition, formula, row) {
  if (!condition || typeof condition !== 'object') fail('INVALID_FORMULA_CONDITION', 'IF condition must be an object.');
  if (condition.operation === 'AND' || condition.operation === 'OR') {
    const operands = condition.operands ?? [];
    if (!operands.length) fail('INVALID_FORMULA_CONDITION', `${condition.operation} requires operands.`);
    return `${condition.operation}(${operands.map(item => conditionToken(context, item, formula, row)).join(',')})`;
  }
  const left = condition.left ?? (condition.columnId ? { columnId: condition.columnId } : null);
  const right = condition.right ?? (condition.runtimeValue ? { runtimeValue: condition.runtimeValue } : Object.hasOwn(condition, 'value') ? condition.value : null);
  const operators = {
    EQUAL: '=', NOT_EQUAL: '<>', LESS_THAN: '<', LESS_THAN_OR_EQUAL: '<=', GREATER_THAN: '>', GREATER_THAN_OR_EQUAL: '>=',
  };
  const operator = operators[condition.operator];
  if (!left || !operator) fail('INVALID_FORMULA_CONDITION', `Unsupported condition operator ${condition.operator}.`);
  return `${expressionToken(context, left, formula, row)}${operator}${expressionToken(context, right, formula, row)}`;
}

function operationBuilders() {
  const builders = {
    SUM: ({ context, formula }) => {
      const p = formula.parameters ?? {};
      const ranges = p.ranges ?? [p.range ?? p.sumRange];
      return `=SUM(${ranges.map(range => rangeReference(context, range, formula.sheetId)).join(',')})`;
    },
    SUMIF: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const sum = rangeReference(context, p.sumRange, formula.sheetId);
      const criteriaRange = rangeReference(context, p.criteriaRange ?? p.criterion?.range, p.sumRange?.sheetId ?? formula.sheetId);
      let criterion;
      if (p.criteriaColumnId) criterion = localCell(context, formula.sheetId, p.criteriaColumnId, row);
      else if (p.criteriaSource) {
        const sourceSheet = resolveSheet(context, p.criteriaSource.sheetId);
        const sourceColumn = resolveColumn(sourceSheet, p.criteriaSource.columnId);
        criterion = sheetCell(sourceSheet.name, sourceColumn.index, WORKBOOK_LAYOUT.dataStartRow);
      } else criterion = expressionToken(context, p.criteria ?? p.criterion?.value, formula, row);
      return `=SUMIF(${criteriaRange},${criterion},${sum})`;
    },
    SUMIFS: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      return `=SUMIFS(${rangeReference(context, p.sumRange, formula.sheetId)},${structuredCriteria(context, p.criteria, p.sumRange?.sheetId ?? formula.sheetId, row, formula).join(',')})`;
    },
    COUNTIF: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      if (p.range && Object.hasOwn(p, 'criteria')) return `=COUNTIF(${rangeReference(context, p.range, formula.sheetId)},${expressionToken(context, p.criteria, formula, row)})`;
      const criteria = structuredCriteria(context, [p.criterion ?? p.criteria?.[0]], formula.sheetId, row, formula);
      return `=COUNTIF(${criteria.join(',')})`;
    },
    COUNTIFS: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      return `=COUNTIFS(${structuredCriteria(context, p.criteria, formula.sheetId, row, formula).join(',')})`;
    },
    SUBTRACT: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      return `=${expressionToken(context, p.minuend, formula, row)}-${expressionToken(context, p.subtrahend, formula, row)}`;
    },
    IFERROR: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const numerator = expressionToken(context, p.numerator ?? p.value, formula, row);
      const expression = p.denominator === undefined ? numerator : `${numerator}/${expressionToken(context, p.denominator, formula, row)}`;
      return `=IFERROR(${expression},${expressionToken(context, p.fallback ?? 0, formula, row)})`;
    },
    IF: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      return `=IF(${conditionToken(context, p.condition, formula, row)},${expressionToken(context, p.whenTrue, formula, row)},${expressionToken(context, p.whenFalse, formula, row)})`;
    },
    MAX: ({ context, formula, row }) => {
      const values = formula.parameters?.values ?? [];
      return `=MAX(${values.map(value => expressionToken(context, value, formula, row)).join(',')})`;
    },
    MIN: ({ context, formula, row }) => {
      const values = formula.parameters?.values ?? [];
      return `=MIN(${values.map(value => expressionToken(context, value, formula, row)).join(',')})`;
    },
    ROUND: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      return `=ROUND(${expressionToken(context, p.value, formula, row)},${Number.isInteger(p.decimals) ? p.decimals : 2})`;
    },
    FREQUENCY_TO_ANNUAL: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const amount = localCell(context, formula.sheetId, p.amountColumnId, row);
      const frequency = localCell(context, formula.sheetId, p.frequencyColumnId, row);
      const translated = key => excelString(context.translate(`values.frequency.${key}`, ({ weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly', quarterly: 'Quarterly', semiAnnual: 'Semi-annual', annual: 'Annual' })[key]));
      const matches = (key, legacy) => `OR(${frequency}=${translated(key)},${frequency}=${excelString(legacy)})`;
      return `=IF(${amount}="","",${amount}*IF(${matches('weekly', 'WEEKLY')},52,IF(${matches('biweekly', 'BIWEEKLY')},26,IF(${matches('quarterly', 'QUARTERLY')},4,IF(${matches('semiAnnual', 'SEMI_ANNUAL')},2,IF(${matches('annual', 'ANNUAL')},1,12))))))`;
    },
    RANK_ASCENDING: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const value = localCell(context, formula.sheetId, p.valueColumnId, row);
      const range = rangeReference(context, { sheetId: formula.sheetId, columnId: p.valueColumnId }, formula.sheetId);
      return p.ignoreZero ? `=IF(OR(${value}="",${value}=0),"",RANK.EQ(${value},${range},1))` : `=IF(${value}="","",RANK.EQ(${value},${range},1))`;
    },
    RANK_DESCENDING: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const value = localCell(context, formula.sheetId, p.valueColumnId, row);
      const range = rangeReference(context, { sheetId: formula.sheetId, columnId: p.valueColumnId }, formula.sheetId);
      return `=IF(${value}="","",RANK.EQ(${value},${range},0))`;
    },
    PROJECTED_PAYOFF_DATE: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const balance = localCell(context, formula.sheetId, p.balanceColumnId, row);
      const rate = localCell(context, formula.sheetId, p.rateColumnId, row);
      const payment = localCell(context, formula.sheetId, p.paymentColumnId, row);
      return `=IFERROR(EDATE(TODAY(),ROUNDUP(IF(${rate}=0,${balance}/${payment},NPER(${rate}/12,-${payment},${balance})),0)),"")`;
    },
    ROW_SUM: ({ context, formula, row }) => {
      const columns = formula.parameters?.columns ?? [];
      return `=SUM(${columns.map(id => localCell(context, formula.sheetId, id, row)).join(',')})`;
    },
    ROW_DIFFERENCE: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      return `=IFERROR(${localCell(context, formula.sheetId, p.leftColumnId, row)}-${localCell(context, formula.sheetId, p.rightColumnId, row)},0)`;
    },
    ROW_PRODUCT: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      return `=IFERROR(${localCell(context, formula.sheetId, p.leftColumnId, row)}*${localCell(context, formula.sheetId, p.rightColumnId, row)},0)`;
    },
    ROW_RATIO: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const numerator = localCell(context, formula.sheetId, p.numeratorColumnId, row);
      const denominator = localCell(context, formula.sheetId, p.denominatorColumnId, row);
      return `=IFERROR(${numerator}/${denominator},0)`;
    },
    RUNNING_SUM: ({ context, formula, row }) => {
      const source = localCell(context, formula.sheetId, formula.parameters?.sourceColumnId, row);
      const first = localCell(context, formula.sheetId, formula.parameters?.sourceColumnId, WORKBOOK_LAYOUT.dataStartRow);
      return `=SUM(${first}:${source})`;
    },
    PERCENT_SCORE: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const numerator = expressionToken(context, p.numerator, formula, row);
      const denominator = expressionToken(context, p.denominator, formula, row);
      return `=MAX(0,MIN(100,ROUND(IFERROR(${numerator}/${denominator},0)*100,0)))`;
    },
    REMAINING_AMOUNT: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const target = localCell(context, formula.sheetId, p.targetColumnId, row);
      const start = localCell(context, formula.sheetId, p.startColumnId, row);
      const contributed = localCell(context, formula.sheetId, p.contributionColumnId, row);
      return `=MAX(${target}-${start}-${contributed},0)`;
    },
    PROGRESS_PERCENT: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const target = localCell(context, formula.sheetId, p.targetColumnId, row);
      const start = localCell(context, formula.sheetId, p.startColumnId, row);
      const contributed = localCell(context, formula.sheetId, p.contributionColumnId, row);
      return `=IFERROR(MIN((${start}+${contributed})/${target},1),0)`;
    },
    ANNUALIZED_AMOUNT: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const amount = localCell(context, formula.sheetId, p.amountColumnId, row);
      const frequency = localCell(context, formula.sheetId, p.frequencyColumnId, row);
      return `=IF(${amount}="","",${amount}*IF(${frequency}="Weekly",52,IF(${frequency}="Biweekly",26,IF(${frequency}="Quarterly",4,IF(${frequency}="Yearly",1,12)))))`;
    },
    POTENTIAL_SAVINGS: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const annual = localCell(context, formula.sheetId, p.annualCostColumnId, row);
      const status = localCell(context, formula.sheetId, p.statusColumnId, row);
      return `=IF(OR(${status}="Cancel",${status}="Review"),${annual},0)`;
    },
    DEBT_PRIORITY: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const balance = localCell(context, formula.sheetId, p.balanceColumnId, row);
      const range = rangeReference(context, { sheetId: formula.sheetId, columnId: p.balanceColumnId }, formula.sheetId);
      return `=IF(${balance}="","",RANK.EQ(${balance},${range},1))`;
    },
    ESTIMATED_PAYOFF_DATE: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const balance = localCell(context, formula.sheetId, p.balanceColumnId, row);
      const rate = localCell(context, formula.sheetId, p.rateColumnId, row);
      const minimum = localCell(context, formula.sheetId, p.minimumPaymentColumnId, row);
      const extra = localCell(context, formula.sheetId, p.extraPaymentColumnId, row);
      return `=IFERROR(EDATE(TODAY(),ROUNDUP(NPER(${rate}/12,-(${minimum}+${extra}),${balance}),0)),"")`;
    },
    TOTAL_INTEREST_ESTIMATE: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const balance = localCell(context, formula.sheetId, p.balanceColumnId, row);
      const rate = localCell(context, formula.sheetId, p.rateColumnId, row);
      const minimum = localCell(context, formula.sheetId, p.minimumPaymentColumnId, row);
      const extra = localCell(context, formula.sheetId, p.extraPaymentColumnId, row);
      return `=IFERROR(ROUND((${minimum}+${extra})*NPER(${rate}/12,-(${minimum}+${extra}),${balance})-${balance},2),0)`;
    },
    PROJECTED_GOAL_DATE: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const remaining = localCell(context, formula.sheetId, p.remainingColumnId, row);
      const monthly = p.monthlyContributionColumnId
        ? localCell(context, formula.sheetId, p.monthlyContributionColumnId, row)
        : `MAX(SUM(${rangeReference(context, { sheetId: p.contributionsSheetId, columnId: 'amount' }, formula.sheetId)})/12,0.01)`;
      return `=IFERROR(EDATE(TODAY(),ROUNDUP(${remaining}/${monthly},0)),"")`;
    },
    REQUIRED_MONTHLY_CONTRIBUTION: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const target = localCell(context, formula.sheetId, p.targetColumnId, row);
      const current = localCell(context, formula.sheetId, p.currentColumnId, row);
      const deadline = localCell(context, formula.sheetId, p.deadlineColumnId, row);
      return `=IFERROR(MAX((${target}-${current})/MAX(ROUNDUP(YEARFRAC(TODAY(),${deadline})*12,0),1),0),0)`;
    },
    MONTH_STATUS: ({ context, formula, row }) => {
      const p = formula.parameters ?? {};
      const remaining = localCell(context, formula.sheetId, p.remainingColumnId, row);
      const overBudget = excelString(context.translate('values.status.overBudget', 'Over budget'));
      const onBudget = excelString(context.translate('values.status.onBudget', 'On budget'));
      const available = excelString(context.translate('values.status.available', 'Available'));
      return `=IF(${remaining}<0,${overBudget},IF(${remaining}=0,${onBudget},${available}))`;
    },
    COPY: ({ context, formula, row }) => `=${cellReference(context, formula.parameters?.source, formula.sheetId, row)}`,
  };
  return Object.freeze(builders);
}

export const FORMULA_OPERATIONS = operationBuilders();

function compileFormula(context, formula, row) {
  const builder = FORMULA_OPERATIONS[formula.operation];
  if (!builder) fail('UNSUPPORTED_FORMULA_OPERATION', `Unsupported formula operation ${formula.operation}.`, { formulaId: formula.id });
  const value = builder({ context, formula, row });
  if (!EXCEL_FORMULA.test(value) || /#REF!/i.test(value)) fail('UNSAFE_FORMULA_OUTPUT', `Formula ${formula.id} produced invalid output.`, { value });
  return value.slice(1);
}

function guardEmptyInputRow(context, sheet, formula, row, compiled) {
  if (formula.fillDirection !== 'down' || !['input', 'data'].includes(sheet.definition.type)) return compiled;
  const inputColumns = [...sheet.columns.values()]
    .filter(({ definition }) => definition.role === 'input' && definition.type !== 'formula')
    .map(({ index }) => index)
    .sort((left, right) => left - right);
  if (!inputColumns.length) return compiled;

  const inputRanges = [];
  let rangeStart = inputColumns[0];
  let rangeEnd = inputColumns[0];
  for (const columnIndex of inputColumns.slice(1)) {
    if (columnIndex === rangeEnd + 1) {
      rangeEnd = columnIndex;
      continue;
    }
    inputRanges.push(rangeStart === rangeEnd
      ? cellAddress(rangeStart, row)
      : `${cellAddress(rangeStart, row)}:${cellAddress(rangeEnd, row)}`);
    rangeStart = columnIndex;
    rangeEnd = columnIndex;
  }
  inputRanges.push(rangeStart === rangeEnd
    ? cellAddress(rangeStart, row)
    : `${cellAddress(rangeStart, row)}:${cellAddress(rangeEnd, row)}`);

  return `IF(COUNTA(${inputRanges.join(',')})=0,"",${compiled})`;
}

function applyFormula(worksheet, context, sheet, formula) {
  const rows = formula.fillDirection === 'down'
    ? Array.from({ length: sheet.capacity }, (_, index) => WORKBOOK_LAYOUT.dataStartRow + index)
    : [formulaLocation(context, formula, WORKBOOK_LAYOUT.dataStartRow).row];
  for (const row of rows) {
    const target = formulaLocation(context, formula, row);
    const cell = worksheet.getCell(target.row, target.column);
    const compiled = compileFormula(context, formula, row);
    // Excel desktop can discard formula cells that have no cached value at all.
    // A numeric cache keeps formulas durable; zero-hidden views and four-section
    // number formats keep that cache invisible until Excel recalculates.
    cell.value = { formula: guardEmptyInputRow(context, sheet, formula, row, compiled), result: 0 };
    cell.protection = { locked: true, hidden: true };
    if (formula.extensions?.numberFormat === 'percentage') cell.numFmt = suppressZeroSection(context.currencyProfile?.workbookNumberFormats?.percentage ?? '0.0%');
    else if (formula.extensions?.numberFormat === 'integer') cell.numFmt = '0;-0;;@';
    else if (formula.extensions?.numberFormat === 'date') cell.numFmt = context.localization?.formats?.date ?? 'yyyy-mm-dd';
    if (target.metric) {
      const metricColumn = sheet.columns.get('metric') ?? [...sheet.columns.values()][0];
      const metricCell = worksheet.getCell(target.row, metricColumn.index);
      metricCell.value = context.translate(`metrics.${target.metric}`, target.metric.replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase()));
      metricCell.protection = { locked: true, hidden: false };
    }
  }
  return rows.length;
}

function validationSource(context, source, defaultSheetId) {
  if (typeof source !== 'string') return null;
  const normalized = source.split('#', 1)[0];
  const match = /^(?<sheet>[a-z][a-z0-9._-]*)\.(?<column>[a-z][a-z0-9._-]*)$/.exec(normalized);
  if (!match) fail('INVALID_VALIDATION_SOURCE', `Validation source must be sheetId.columnId, received ${source}.`);
  return rangeReference(context, { sheetId: match.groups.sheet, columnId: match.groups.column }, defaultSheetId);
}

function applyValidation(worksheet, context, sheet, rule) {
  if (!rule.columnId) return 0;
  const column = resolveColumn(sheet, rule.columnId);
  const from = WORKBOOK_LAYOUT.dataStartRow;
  const to = from + sheet.capacity - 1;
  if (to < from) return 0;
  const base = {
    allowBlank: !rule.required,
    showErrorMessage: true,
    errorStyle: rule.severity === 'warning' ? 'warning' : 'stop',
    errorTitle: context.translate('validation.title', 'Invalid value'),
    error: context.translate(rule.messageKey, 'Enter a valid value for this field.'),
    showInputMessage: true,
    promptTitle: context.translate('validation.promptTitle', 'Input guidance'),
    prompt: context.translate(rule.messageKey, 'Use the requested format.'),
  };
  const formulae = [];
  let type = rule.type;
  if (type === 'required') {
    type = 'custom';
    formulae.push(`LEN(TRIM(${columnName(column.index)}${from}))>0`);
  } else if (type === 'list') {
    if (rule.source) formulae.push(validationSource(context, rule.source, rule.sheetId));
    else if (rule.values?.length) {
      const resolvedValues = rule.extensions?.translateValues
        ? rule.values.map(value => context.translate(String(value), String(value)))
        : rule.values;
      const joined = resolvedValues.map(value => String(value).replaceAll('"', '""')).join(',');
      if (joined.length > 240) fail('VALIDATION_LIST_TOO_LONG', `Inline validation list ${rule.id} exceeds the reliable Excel limit.`);
      formulae.push(`"${joined}"`);
    } else fail('VALIDATION_SOURCE_MISSING', `List validation ${rule.id} has no source.`);
  } else if (type === 'date') {
    if (rule.minimum !== undefined || rule.maximum !== undefined) {
      if (rule.minimum !== undefined) formulae.push(rule.minimum);
      if (rule.maximum !== undefined) formulae.push(rule.maximum);
    } else if (rule.source === 'today-or-later') {
      base.operator = 'greaterThanOrEqual';
      formulae.push('TODAY()');
    } else {
      base.operator = 'between';
      formulae.push(new Date(Date.UTC(context.configuration.year, 0, 1, 12)), new Date(Date.UTC(context.configuration.year, 11, 31, 12)));
    }
  } else if (['decimal', 'whole', 'textLength'].includes(type)) {
    if (rule.minimum !== undefined) formulae.push(rule.minimum);
    if (rule.maximum !== undefined) formulae.push(rule.maximum);
    if (!formulae.length) fail('VALIDATION_BOUNDS_MISSING', `Validation ${rule.id} requires numeric bounds.`);
  } else if (type === 'range') {
    type = 'decimal';
    formulae.push(rule.minimum, rule.maximum);
  } else if (type === 'custom') {
    if (!rule.source || !/^[A-Z0-9(),.$<>=+\-*/" ]+$/i.test(rule.source)) fail('UNSAFE_CUSTOM_VALIDATION', `Custom validation ${rule.id} is unsafe.`);
    formulae.push(rule.source);
  }
  const validation = { ...base, type, operator: base.operator ?? rule.operator, formulae: formulae.filter(value => value !== undefined) };
  for (let row = from; row <= to; row += 1) worksheet.getCell(row, column.index).dataValidation = validation;
  return to - from + 1;
}

function applyConditionalFormatting(worksheet, sheet, colors) {
  if (!sheet.capacity) return 0;
  const start = WORKBOOK_LAYOUT.dataStartRow;
  const end = start + sheet.capacity - 1;
  let count = 0;
  for (const { definition: column, index } of sheet.columns.values()) {
    const ref = `${columnName(index)}${start}:${columnName(index)}${end}`;
    if (column.type === 'percentage') {
      worksheet.addConditionalFormatting({
        ref,
        rules: [{ type: 'colorScale', cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }], color: [{ argb: colors.danger }, { argb: colors.warning }, { argb: colors.success }] }],
      });
      count += 1;
    } else if (['currency', 'number', 'formula'].includes(column.type) && ['variance', 'remaining', 'balance', 'savings'].some(token => `${column.id}-${column.styleRole ?? ''}`.includes(token))) {
      worksheet.addConditionalFormatting({
        ref,
        rules: [
          { type: 'cellIs', operator: 'lessThan', formulae: [0], style: { font: { color: { argb: 'FF991B1B' } }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: colors.danger }, fgColor: { argb: colors.danger } } } },
          { type: 'cellIs', operator: 'greaterThanOrEqual', formulae: [0], style: { font: { color: { argb: 'FF116149' } }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: colors.success }, fgColor: { argb: colors.success } } } },
        ],
      });
      count += 1;
    }
  }
  return count;
}

function headerLabels(sheet, translate) {
  const used = new Set();
  return sheet.definition.columns.map(column => {
    const base = translate(column.labelKey, column.id.replaceAll('-', ' '));
    let label = base;
    let suffix = 2;
    while (used.has(label.toLocaleLowerCase('en-US'))) label = `${base} ${suffix++}`;
    used.add(label.toLocaleLowerCase('en-US'));
    return label;
  });
}

function sampleRowsFor(sheet, context) {
  const configuration = context.configuration;
  const source = sheet.definition.id === 'categories'
    ? resolveConfiguredCategoryRows({ productDefinition: context.definition, configuration, translate: context.translate })
    : (configuration.sampleDataEnabled || sheet.definition.type === 'lookup' ? [...(sheet.definition.sampleRows ?? [])] : []);
  return source.slice(0, sheet.capacity);
}

function internalHyperlink(sheetName) {
  return `#${quoteSheetName(sheetName)}!A1`;
}

function setWorkbookNavigation(worksheet, context, sheet, colors, columnCount) {
  const index = context.sheets.findIndex(candidate => candidate.definition.id === sheet.definition.id);
  const home = context.sheets[0];
  const previous = context.sheets[Math.max(0, index - 1)];
  const next = context.sheets[Math.min(context.sheets.length - 1, index + 1)];
  const items = [
    { column: columnCount - 2, text: context.translate('workbook.navigation.previous', '← Previous'), target: previous },
    { column: columnCount - 1, text: context.translate('workbook.navigation.home', '⌂ Home'), target: home },
    { column: columnCount, text: context.translate('workbook.navigation.next', 'Next →'), target: next },
  ];
  for (const item of items) {
    const cell = worksheet.getCell(1, item.column);
    cell.value = { text: item.text, hyperlink: internalHyperlink(item.target.name), tooltip: item.target.name };
    cell.font = { name: context.theme.fonts.body, size: 9, bold: true, color: { argb: colors.inverseText ?? colors.text }, underline: false };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.background } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', shrinkToFit: true };
    cell.border = { left: { style: 'thin', color: { argb: colors.border ?? colors.muted } } };
  }
  worksheet.getCell('A1').name = `NNT_${sheet.definition.id.replace(/[^A-Za-z0-9_]/g, '_')}_TOP`;
  return items.length;
}

function stylePremiumDashboard(worksheet, context, sheet, colors) {
  if (sheet.definition.type !== 'dashboard') return;
  const chartColumnCount = (sheet.definition.extensions?.charts ?? []).reduce((maximum, chart) => Math.max(maximum, Number(chart.anchor?.to?.column ?? 0)), 0);
  const chartRowCount = (sheet.definition.extensions?.charts ?? []).reduce((maximum, chart) => Math.max(maximum, Number(chart.anchor?.to?.row ?? 0)), 0);
  const canvasColumnCount = Math.max(19, sheet.definition.columns.length, chartColumnCount);
  const canvasRowCount = Math.max(50, WORKBOOK_LAYOUT.dataStartRow + sheet.definition.formulas.length - 1, chartRowCount);
  for (let row = WORKBOOK_LAYOUT.headerRow; row <= canvasRowCount; row += 1) {
    for (let column = 1; column <= canvasColumnCount; column += 1) {
      worksheet.getCell(row, column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.background } };
    }
  }
  const lastMetricRow = WORKBOOK_LAYOUT.dataStartRow + sheet.definition.formulas.length - 1;
  worksheet.mergeCells('A4:C4');
  const section = worksheet.getCell('A4');
  section.value = context.translate('workbook.dashboard.keyMetrics', 'Key metrics');
  section.font = { name: context.theme.fonts.heading, bold: true, size: 11, color: { argb: colors.accentText ?? colors.inverseText ?? colors.background } };
  section.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.accent } };
  section.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(4).height = 28;
  worksheet.getColumn(1).width = 28;
  worksheet.getColumn(2).width = 18;
  worksheet.getColumn(3).width = 4;
  for (let row = WORKBOOK_LAYOUT.dataStartRow; row <= lastMetricRow; row += 1) {
    worksheet.mergeCells(row, 2, row, 3);
    worksheet.getRow(row).height = 48;
    const label = worksheet.getCell(row, 1);
    const value = worksheet.getCell(row, 2);
    for (const cell of [label, value]) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.surface } };
      cell.border = {
        top: { style: 'thin', color: { argb: colors.border ?? colors.muted } },
        bottom: { style: 'thin', color: { argb: colors.border ?? colors.muted } },
      };
      cell.alignment = { vertical: 'middle', horizontal: cell === value ? 'right' : 'left', shrinkToFit: true };
    }
    label.font = { name: context.theme.fonts.body, size: 10, bold: true, color: { argb: colors.muted } };
    value.font = { name: context.theme.fonts.heading, size: 16, bold: true, color: { argb: colors.text } };
    label.border = { ...label.border, left: { style: 'medium', color: { argb: colors.accent } } };
    value.border = { ...value.border, right: { style: 'thin', color: { argb: colors.border ?? colors.muted } } };
  }
}

function setSheetPresentation(worksheet, context, sheet, colors) {
  const { definition } = sheet;
  const chartColumnCount = (definition.extensions?.charts ?? []).reduce((maximum, chart) => Math.max(maximum, Number(chart.anchor?.to?.column ?? 0)), 0);
  const chartRowCount = (definition.extensions?.charts ?? []).reduce((maximum, chart) => Math.max(maximum, Number(chart.anchor?.to?.row ?? 0)), 0);
  const columnCount = Math.max(8, definition.columns.length, chartColumnCount);
  const lastColumn = columnName(columnCount);
  const titleLastColumn = columnName(columnCount - 3);
  worksheet.mergeCells(`A1:${titleLastColumn}1`);
  worksheet.mergeCells(`A2:${lastColumn}2`);
  worksheet.mergeCells(`A3:${lastColumn}3`);
  worksheet.getCell('A1').value = context.configuration.title;
  worksheet.getCell('A2').value = context.translate(definition.extensions?.instructionKey, context.translate(context.definition.descriptionKey, 'Enter data in the highlighted cells; calculated cells update automatically.'));
  worksheet.getCell('A3').value = `${context.configuration.locale} · ${context.configuration.currency} · ${context.configuration.year} · ${context.configuration.themeId}`;
  worksheet.getRow(1).height = 34;
  worksheet.getRow(2).height = 30;
  worksheet.getRow(3).height = 22;
  worksheet.getRow(4).height = 26;
  worksheet.getCell('A1').font = { name: context.theme.fonts.heading, bold: true, size: 20, color: { argb: context.theme.extensions?.appearance === 'dark' ? colors.inverseText : colors.text } };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.background } };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).eachCell({ includeEmpty: true }, cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.background } };
  });
  setWorkbookNavigation(worksheet, context, sheet, colors, columnCount);
  worksheet.getCell('A2').font = { name: context.theme.fonts.body, size: 10, color: { argb: colors.text } };
  worksheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.surface } };
  worksheet.getCell('A2').alignment = { vertical: 'middle', wrapText: true };
  worksheet.getCell('A3').font = { name: context.theme.fonts.mono, size: 9, color: { argb: colors.muted } };
  worksheet.getCell('A3').alignment = { vertical: 'middle' };
  const headers = headerLabels(sheet, context.translate);
  headers.forEach((label, index) => {
    const cell = worksheet.getCell(WORKBOOK_LAYOUT.headerRow, index + 1);
    cell.value = label;
    cell.font = { name: context.theme.fonts.body, bold: true, color: { argb: colors.accentText ?? colors.inverseText ?? colors.background } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.accent } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: colors.background } } };
  });
  for (const { definition: column, index } of sheet.columns.values()) {
    const excelColumn = worksheet.getColumn(index);
    excelColumn.width = column.width;
    excelColumn.hidden = Boolean(column.hidden);
    excelColumn.numFmt = numberFormat(column, context.localization, context.currencyProfile, context.configuration);
  }
  worksheet.properties.defaultRowHeight = 20;
  worksheet.properties.tabColor = { argb: colors.accent };
  worksheet.state = definition.hidden ? 'hidden' : 'visible';
  const xSplit = definition.freeze.columns;
  const ySplit = ['input', 'data', 'lookup'].includes(definition.type) ? Math.max(definition.freeze.rows, WORKBOOK_LAYOUT.headerRow) : definition.freeze.rows;
  worksheet.views = xSplit || ySplit ? [{ state: 'frozen', xSplit, ySplit, topLeftCell: cellAddress(xSplit + 1, ySplit + 1), activeCell: cellAddress(xSplit + 1, ySplit + 1), showGridLines: false, showZeros: false }] : [{ showGridLines: false, showZeros: false }];
  worksheet.pageSetup = {
    orientation: definition.print.orientation,
    paperSize: PAPER_SIZES[definition.print.paperSize],
    fitToPage: true,
    fitToWidth: definition.print.fitToWidth,
    fitToHeight: definition.print.fitToHeight,
    horizontalCentered: true,
    margins: { left: 0.35, right: 0.35, top: 0.55, bottom: 0.55, header: 0.2, footer: 0.2 },
    printTitlesRow: '1:4',
    printArea: `A1:${lastColumn}${Math.max(WORKBOOK_LAYOUT.headerRow, WORKBOOK_LAYOUT.dataStartRow + sheet.capacity - 1, chartRowCount)}`,
  };
  worksheet.headerFooter.oddFooter = `&LNumberNinjaDesigns&C&F&R${context.translate('workbook.footer.page', 'Page')} &P ${context.translate('workbook.footer.of', 'of')} &N`;
  worksheet.autoFilter = definition.autoFilter === true && definition.columns.length
    ? { from: { row: WORKBOOK_LAYOUT.headerRow, column: 1 }, to: { row: WORKBOOK_LAYOUT.headerRow, column: definition.columns.length } }
    : typeof definition.autoFilter === 'string' ? definition.autoFilter : null;
}

function addDataTable(worksheet, context, sheet, colors) {
  if (!sheet.definition.columns.length || !['input', 'data', 'lookup'].includes(sheet.definition.type)) return false;
  const samples = sampleRowsFor(sheet, context);
  const rows = Array.from({ length: sheet.capacity }, (_, rowIndex) => sheet.definition.columns.map(column => sampleCellValue(column, samples[rowIndex]?.[column.id], context)));
  worksheet.addTable({
    name: tableName(context.definition, sheet.definition),
    ref: `A${WORKBOOK_LAYOUT.headerRow}`,
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium2', showFirstColumn: false, showLastColumn: false, showRowStripes: true, showColumnStripes: false },
    columns: headerLabels(sheet, context.translate).map(name => ({ name, filterButton: true })),
    rows,
  });
  // A table already owns an auto-filter over its full data range. Writing a
  // second, overlapping worksheet-level filter makes native Excel reject the
  // package even though ExcelJS can re-read it.
  worksheet.autoFilter = null;
  for (let row = WORKBOOK_LAYOUT.dataStartRow; row < WORKBOOK_LAYOUT.dataStartRow + sheet.capacity; row += 1) {
    worksheet.getRow(row).height = 20;
    for (const { definition: column, index } of sheet.columns.values()) {
      const cell = worksheet.getCell(row, index);
      cell.font = { name: context.theme.fonts.body, size: 10, color: { argb: colors.text } };
      cell.numFmt = numberFormat(column, context.localization, context.currencyProfile, context.configuration);
      cell.alignment = { vertical: 'middle', horizontal: ['currency', 'percentage', 'integer', 'number', 'formula'].includes(column.type) ? 'right' : 'left' };
      const isInput = column.role === 'input' && column.type !== 'formula' && column.locked !== true;
      cell.protection = { locked: !isInput, hidden: column.type === 'formula' || column.role === 'calculated' };
      if (isInput) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.input } };
      else if (column.type === 'formula' || column.role === 'calculated') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.formula } };
    }
  }
  return true;
}

function addDisplayRows(worksheet, context, sheet, colors) {
  if (['dashboard', 'input', 'data', 'lookup'].includes(sheet.definition.type)) return 0;
  const samples = sampleRowsFor(sheet, context);
  if (!samples.length) return 0;
  for (let rowIndex = 0; rowIndex < samples.length; rowIndex += 1) {
    const rowNumber = WORKBOOK_LAYOUT.dataStartRow + rowIndex;
    const row = samples[rowIndex];
    worksheet.getRow(rowNumber).height = 22;
    for (const { definition: column, index } of sheet.columns.values()) {
      const cell = worksheet.getCell(rowNumber, index);
      cell.value = sampleCellValue(column, row?.[column.id], context);
      cell.font = { name: context.theme.fonts.body, size: 10, color: { argb: colors.text } };
      cell.numFmt = numberFormat(column, context.localization, context.currencyProfile, context.configuration);
      cell.alignment = { vertical: 'middle', horizontal: ['currency', 'percentage', 'integer', 'number', 'formula'].includes(column.type) ? 'right' : 'left', wrapText: column.type === 'string' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowIndex % 2 ? colors.bandFill : colors.surface } };
      cell.protection = { locked: true, hidden: column.type === 'formula' || column.role === 'calculated' };
    }
  }
  return samples.length;
}

async function protectCalculatedSheets(workbook, context, sheetReports) {
  for (const report of sheetReports) {
    if (!report.formulaCount || report.sheet.definition.extensions?.protectFormulas === false) continue;
    const worksheet = workbook.getWorksheet(report.sheet.name);
    await worksheet.protect('nnt-input-safe', {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertRows: false,
      deleteRows: false,
      sort: false,
      autoFilter: true,
      spinCount: 1_000,
    });
    report.protected = true;
  }
}

export async function buildWorkbook({
  definition,
  configuration,
  localization,
  currencyProfile,
  theme,
  ExcelJS: ExcelJSRuntime = globalThis.ExcelJS,
  generatedAt = new Date(),
} = {}) {
  if (!ExcelJSRuntime?.Workbook) fail('EXCELJS_RUNTIME_MISSING', 'The local ExcelJS runtime is unavailable.');
  if (!definition || !configuration || !localization || !currencyProfile || !theme) fail('GENERATION_INPUT_MISSING', 'Definition, configuration, localization, currency profile and theme are required.');
  const context = sheetContext(definition, configuration, localization, currencyProfile, theme);
  const colors = palette(theme);
  const workbook = new ExcelJSRuntime.Workbook();
  workbook.creator = 'NumberNinjaDesigns Finance Product Factory';
  workbook.lastModifiedBy = 'NumberNinjaDesigns Finance Product Factory';
  workbook.created = new Date(generatedAt);
  workbook.modified = new Date(generatedAt);
  workbook.lastPrinted = new Date(generatedAt);
  workbook.title = configuration.title;
  workbook.subject = context.translate(definition.descriptionKey, definition.productFamily);
  workbook.description = `${definition.id} ${definition.version}; ${configuration.locale}; ${configuration.currency}; generated locally.`;
  workbook.company = 'NumberNinjaDesigns';
  workbook.category = definition.category;
  workbook.keywords = [...(definition.tags ?? []), configuration.locale, configuration.currency].join(', ');
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.calcProperties.forceFullCalc = true;
  workbook.calcProperties.calcMode = 'auto';
  const sheetReports = [];
  let totalFormulas = 0;
  let totalValidations = 0;
  let totalConditionalFormats = 0;

  for (const sheet of context.sheets) {
    const worksheet = workbook.addWorksheet(sheet.name, { properties: { defaultRowHeight: 20 }, views: [{ showGridLines: false }] });
    setSheetPresentation(worksheet, context, sheet, colors);
    const table = addDataTable(worksheet, context, sheet, colors);
    const displayRows = addDisplayRows(worksheet, context, sheet, colors);
    let formulaCount = 0;
    for (const formula of sheet.definition.formulas) formulaCount += applyFormula(worksheet, context, sheet, formula);
    for (const formula of definition.formulas.filter(item => item.sheetId === sheet.definition.id && !sheet.definition.formulas.some(local => local.id === item.id))) formulaCount += applyFormula(worksheet, context, sheet, formula);
    stylePremiumDashboard(worksheet, context, sheet, colors);
    let validationCount = 0;
    for (const rule of sheet.definition.validations) validationCount += applyValidation(worksheet, context, sheet, rule);
    for (const rule of definition.validations.filter(item => item.sheetId === sheet.definition.id && !sheet.definition.validations.some(local => local.id === item.id))) validationCount += applyValidation(worksheet, context, sheet, rule);
    const conditionalFormatCount = applyConditionalFormatting(worksheet, sheet, colors);
    totalFormulas += formulaCount;
    totalValidations += validationCount;
    totalConditionalFormats += conditionalFormatCount;
    sheetReports.push({ sheet, name: sheet.name, rows: sheet.capacity, columns: sheet.definition.columns.length, table, displayRows, formulaCount, validationCount, conditionalFormatCount, protected: false });
  }
  await protectCalculatedSheets(workbook, context, sheetReports);
  return {
    workbook,
    context,
    metrics: {
      sheets: sheetReports.length,
      rows: sheetReports.reduce((sum, report) => sum + report.rows, 0),
      columns: sheetReports.reduce((sum, report) => sum + report.columns, 0),
      tables: sheetReports.filter(report => report.table).length,
      formulas: totalFormulas,
      validations: totalValidations,
      conditionalFormats: totalConditionalFormats,
      protectedSheets: sheetReports.filter(report => report.protected).length,
    },
    sheets: sheetReports.map(({ sheet, ...report }) => ({ ...report, id: sheet.definition.id })),
  };
}

export async function generateWorkbook(options = {}) {
  const built = await buildWorkbook(options);
  const buffer = await built.workbook.xlsx.writeBuffer({ useStyles: true, useSharedStrings: true });
  const baseBytes = buffer instanceof Uint8Array ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer ?? buffer);
  const charted = await injectWorkbookCharts({
    bytes: baseBytes,
    context: built.context,
    JSZip: options.JSZip ?? globalThis.JSZip,
    generatedAt: options.generatedAt,
  });
  const bytes = charted.bytes;
  if (bytes.byteLength < 1_000 || bytes[0] !== 0x50 || bytes[1] !== 0x4B) fail('INVALID_XLSX_OUTPUT', 'ExcelJS did not produce a valid ZIP-based XLSX buffer.');
  return {
    ...built,
    bytes,
    byteLength: bytes.byteLength,
    metrics: charted.chartCount ? { ...built.metrics, charts: charted.chartCount } : built.metrics,
    charts: charted.charts,
  };
}

export function expectedSheetNames({ definition, configuration, localization, currencyProfile, theme }) {
  return sheetContext(definition, configuration, localization, currencyProfile, theme).sheets.map(sheet => sheet.name);
}
