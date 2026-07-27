import { sha256Hex } from '../engines/security.js';

const SUPPORTED_FUNCTIONS = new Set([
  'ABS', 'AND', 'AVERAGE', 'COUNT', 'COUNTA', 'COUNTIF', 'COUNTIFS', 'DATE', 'DATEDIF', 'DAY', 'EDATE',
  'EOMONTH', 'IF', 'IFERROR', 'INDEX', 'INT', 'MATCH', 'MAX', 'MIN', 'MONTH', 'NPER', 'OR', 'ROUND',
  'RANK.EQ', 'ROUNDDOWN', 'ROUNDUP', 'SUM', 'SUMIF', 'SUMIFS', 'TODAY', 'VLOOKUP', 'WEEKDAY', 'YEAR', 'YEARFRAC',
]);

const BLOCKED_ENTRIES = Object.freeze([
  /^xl\/vbaProject\.bin$/i,
  /^xl\/externalLinks\//i,
  /^xl\/connections\.xml$/i,
  /^xl\/model\//i,
]);

function extractFormulaFunctions(formula) {
  const functions = [];
  for (const match of String(formula).toUpperCase().matchAll(/(?:^|[^A-Z0-9_.])([A-Z_][A-Z0-9_.]*)\s*\(/g)) functions.push(match[1]);
  return functions;
}

export async function analyzeGoogleSheetsReadiness({ workbookBytes, definition, JSZip: JSZipRuntime = globalThis.JSZip, generatedAt = new Date().toISOString() }) {
  if (typeof JSZipRuntime !== 'function') throw new Error('JSZip is required for Google Sheets readiness analysis.');
  if (!(workbookBytes instanceof Uint8Array) || workbookBytes.byteLength < 1_000) throw new Error('A valid XLSX byte stream is required.');
  const archive = await JSZipRuntime.loadAsync(workbookBytes);
  const paths = Object.keys(archive.files).filter(path => !archive.files[path].dir);
  const blockedEntries = paths.filter(path => BLOCKED_ENTRIES.some(pattern => pattern.test(path)));
  const functions = new Set();
  let formulaCount = 0;
  let formulaErrorLiteralCount = 0;
  for (const path of paths.filter(path => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path))) {
    const xml = await archive.file(path).async('string');
    formulaErrorLiteralCount += (xml.match(/#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!)/gi) ?? []).length;
    for (const match of xml.matchAll(/<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/gi)) {
      formulaCount += 1;
      extractFormulaFunctions(match[1]).forEach(value => functions.add(value));
    }
  }
  const normalizedFunctionName = name => name.replace(/^_(?:XLFN|XLUDF)\./, '');
  const unsupportedFunctions = [...functions].filter(name => !SUPPORTED_FUNCTIONS.has(normalizedFunctionName(name))).sort();
  const formulaOperations = [...new Set((definition?.formulas ?? []).map(formula => formula.operation).filter(Boolean))].sort();
  const issues = [
    ...blockedEntries.map(path => ({ code: 'BLOCKED_XLSX_FEATURE', severity: 'blocker', message: `Excel-only package entry detected: ${path}` })),
    ...unsupportedFunctions.map(name => ({ code: 'UNSUPPORTED_FORMULA_FUNCTION', severity: 'blocker', message: `Formula function is outside the cross-platform allowlist: ${name}` })),
    ...(formulaErrorLiteralCount ? [{ code: 'FORMULA_ERROR_LITERAL', severity: 'blocker', message: `${formulaErrorLiteralCount} cached formula error literals were detected.` }] : []),
  ];
  const status = issues.length ? 'FAIL' : 'PASS';
  return Object.freeze({
    schemaVersion: '1.0.0',
    productId: definition?.id ?? null,
    status,
    claim: status === 'PASS' ? 'GOOGLE_SHEETS_IMPORT_READY' : 'NOT_IMPORT_READY',
    workbookSha256: await sha256Hex(workbookBytes),
    generatedAt: new Date(generatedAt).toISOString(),
    checks: Object.freeze({
      validXlsxContainer: true,
      workbookPartPresent: paths.includes('xl/workbook.xml'),
      macroFree: !paths.some(path => /^xl\/vbaProject\.bin$/i.test(path)),
      externalLinksAbsent: !paths.some(path => /^xl\/externalLinks\//i.test(path)),
      connectionsAbsent: !paths.some(path => /^xl\/connections\.xml$/i.test(path)),
      formulaErrorLiteralsAbsent: formulaErrorLiteralCount === 0,
      formulaFunctionsAllowlisted: unsupportedFunctions.length === 0,
    }),
    metrics: Object.freeze({ formulaCount, worksheetXmlCount: paths.filter(path => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path)).length }),
    formulaFunctions: Object.freeze([...functions].sort()),
    formulaOperations: Object.freeze(formulaOperations),
    issues: Object.freeze(issues),
    nativeImportVerified: false,
    nativeImportGate: 'Import the supplied XLSX into Google Sheets, recalculate, inspect every sheet and export once before changing this field to true.',
  });
}

export function googleSheetsEditionFilename(filename) {
  const safe = String(filename || 'finance-workbook.xlsx').replace(/\.xlsx$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-');
  return `${safe}-google-sheets-import.xlsx`;
}
