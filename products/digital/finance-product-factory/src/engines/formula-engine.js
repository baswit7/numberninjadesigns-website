const EXCEL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const CELL_REFERENCE = /^\$?[A-Z]{1,3}\$?[1-9][0-9]{0,6}$/;
const RANGE_REFERENCE = /^\$?[A-Z]{1,3}\$?[1-9][0-9]{0,6}:\$?[A-Z]{1,3}\$?[1-9][0-9]{0,6}$/;
const SUPPORTED = new Set(['SUM', 'SUMIF', 'SUMIFS', 'COUNTIF', 'COUNTIFS', 'AVERAGE', 'MIN', 'MAX', 'IF', 'IFERROR', 'ROUND']);

export function columnName(index) {
  if (!Number.isInteger(index) || index < 1 || index > 16_384) throw new RangeError('Column index must be between 1 and 16384.');
  let value = index;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

export function cellAddress(column, row, absolute = false) {
  const name = typeof column === 'number' ? columnName(column) : String(column).toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(name) || !Number.isInteger(row) || row < 1 || row > 1_048_576) {
    throw new RangeError(`Invalid cell address ${name}${row}.`);
  }
  return absolute ? `$${name}$${row}` : `${name}${row}`;
}

export function quoteSheetName(name) {
  const value = String(name ?? '');
  if (!value || value.length > 31 || /[\\/*?:\[\]]/.test(value)) throw new Error(`Invalid Excel sheet name: ${value || '(empty)'}.`);
  return `'${value.replaceAll("'", "''")}'`;
}

export function sheetRange(sheetName, column, firstRow, lastRow, absolute = true) {
  if (!Number.isInteger(firstRow) || !Number.isInteger(lastRow) || firstRow < 1 || lastRow < firstRow || lastRow > 1_048_576) {
    throw new RangeError(`Invalid row range ${firstRow}:${lastRow}.`);
  }
  const start = cellAddress(column, firstRow, absolute);
  const end = cellAddress(column, lastRow, absolute);
  return `${quoteSheetName(sheetName)}!${start}:${end}`;
}

export function sheetCell(sheetName, column, row, absolute = false) {
  return `${quoteSheetName(sheetName)}!${cellAddress(column, row, absolute)}`;
}

export function excelString(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function assertFormulaReference(value) {
  const reference = String(value);
  const local = reference.includes('!') ? reference.slice(reference.lastIndexOf('!') + 1) : reference;
  if (!CELL_REFERENCE.test(local) && !RANGE_REFERENCE.test(local)) throw new Error(`Unsafe formula reference: ${reference}.`);
  if (reference.includes('!') && !/^'(?:[^']|'')+'!/.test(reference)) throw new Error(`Sheet reference must be safely quoted: ${reference}.`);
  return reference;
}

function token(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Formula number must be finite.');
    return String(value);
  }
  if (typeof value !== 'string') throw new TypeError('Formula arguments must be strings or finite numbers.');
  if (/^"(?:[^"]|"")*"$/.test(value)) return value;
  if (/^(?:TRUE|FALSE)$/i.test(value)) return value.toUpperCase();
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return value;
  if (value.startsWith('=')) throw new Error('Unsafe nested raw formulas are not accepted as formula arguments.');
  return assertFormulaReference(value);
}

export function buildFormula(operation, args) {
  const name = String(operation ?? '').toUpperCase();
  if (!SUPPORTED.has(name)) throw new Error(`Unsupported formula operation: ${name}.`);
  if (!Array.isArray(args)) throw new TypeError('Formula args must be an array.');
  const arity = {
    SUM: [1, 255], SUMIF: [2, 3], SUMIFS: [3, 255], COUNTIF: [2, 2], COUNTIFS: [2, 255],
    AVERAGE: [1, 255], MIN: [1, 255], MAX: [1, 255], IF: [2, 3], IFERROR: [2, 2], ROUND: [2, 2],
  }[name];
  if (args.length < arity[0] || args.length > arity[1]) throw new Error(`${name} expects ${arity[0]}-${arity[1]} arguments.`);
  if ((name === 'SUMIFS' && args.length % 2 === 0) || (name === 'COUNTIFS' && args.length % 2 !== 0)) {
    throw new Error(`${name} has an invalid range/criteria argument count.`);
  }
  return `=${name}(${args.map(token).join(',')})`;
}

export function arithmetic(left, operator, right) {
  if (!['+', '-', '*', '/'].includes(operator)) throw new Error(`Unsupported arithmetic operator: ${operator}.`);
  return `=${token(left)}${operator}${token(right)}`;
}

export function formulaCount(workbook) {
  let count = 0;
  workbook.eachSheet(sheet => sheet.eachRow({ includeEmpty: false }, row => row.eachCell({ includeEmpty: false }, cell => {
    const mergedFollower = cell.isMerged && cell.master?.address !== cell.address;
    if (!mergedFollower && cell.value && typeof cell.value === 'object' && typeof cell.value.formula === 'string') count += 1;
  })));
  return count;
}

export const supportedFormulaOperations = Object.freeze([...SUPPORTED]);

export function assertSafeIdentifier(value, label = 'identifier') {
  if (!EXCEL_IDENTIFIER.test(String(value))) throw new Error(`Invalid ${label}: ${value}.`);
  return String(value);
}
