import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';

const root = resolve(import.meta.dirname, '..');
const modulesRoot = process.env.CODEX_NODE_MODULES;
if (!modulesRoot) throw new Error('CODEX_NODE_MODULES must point to the bundled Codex node_modules directory.');
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL(resolve(modulesRoot, '@oai/artifact-tool/dist/artifact_tool.mjs')).href);
const releaseRoot = resolve(root, 'output/etsy-dominance/world-champion-v1');
const evidenceRoot = resolve(releaseRoot, 'artifact-tool-qa');
await mkdir(evidenceRoot, { recursive: true });

const workbooks = [
  { locale: 'en-US', path: resolve(releaseRoot, 'en-US/products/excel/ultimate-budget-os-en-US-dark.xlsx') },
  { locale: 'nl-NL', path: resolve(releaseRoot, 'nl-NL/products/excel/ultimate-budget-os-nl-NL-dark.xlsx') },
];

const results = [];
for (const item of workbooks) {
  const excel = new ExcelJS.Workbook();
  await excel.xlsx.load(await readFile(item.path));
  const sheetNames = excel.worksheets.map(sheet => sheet.name);
  if (sheetNames.length !== 24) throw new Error(`${item.locale}: expected 24 sheets, received ${sheetNames.length}.`);
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(item.path));
  const formulaErrors = await workbook.inspect({
    kind: 'match',
    searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
    options: { useRegex: true, maxResults: 500 },
    summary: `${item.locale} dominance formula error scan`,
  });
  const errorText = String(formulaErrors.ndjson ?? '');
  const renderRoot = resolve(evidenceRoot, item.locale);
  await mkdir(renderRoot, { recursive: true });
  const renders = [];
  for (let index = 0; index < sheetNames.length; index += 1) {
    const sheetName = sheetNames[index];
    const image = await workbook.render({ sheetName, autoCrop: 'all', scale: 0.55, format: 'png' });
    const target = resolve(renderRoot, `${String(index + 1).padStart(2, '0')}-${sheetName.replace(/[^A-Za-z0-9-]+/g, '-').toLowerCase()}.png`);
    await writeFile(target, new Uint8Array(await image.arrayBuffer()));
    const info = await stat(target);
    if (info.size < 1_000) throw new Error(`${item.locale}:${sheetName} produced an invalid visual render.`);
    renders.push({ sheetName, bytes: info.size, path: target });
  }
  results.push({
    locale: item.locale,
    workbook: item.path,
    status: /#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A)/u.test(errorText) ? 'FAIL' : 'PASS',
    sheetCount: sheetNames.length,
    renderedSheetCount: renders.length,
    formulaErrors: errorText,
    renders,
  });
}

const report = {
  schemaVersion: '1.0.0',
  tool: '@oai/artifact-tool',
  status: results.every(result => result.status === 'PASS' && result.renderedSheetCount === 24) ? 'PASS' : 'FAIL',
  workbooks: results.length,
  renderedSheets: results.reduce((sum, result) => sum + result.renderedSheetCount, 0),
  results,
};
await writeFile(resolve(evidenceRoot, 'artifact-tool-dominance-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ status: report.status, workbooks: report.workbooks, renderedSheets: report.renderedSheets }, null, 2)}\n`);
process.exit(report.status === 'PASS' ? 0 : 1);
