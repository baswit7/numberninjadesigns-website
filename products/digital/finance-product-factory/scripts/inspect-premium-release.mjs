import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`${name} is required.`);
  return resolve(process.argv[index + 1]);
}

const modulesRoot = process.env.CODEX_NODE_MODULES;
if (!modulesRoot) throw new Error('CODEX_NODE_MODULES must point to the bundled Codex node_modules directory.');
const artifactModule = pathToFileURL(resolve(modulesRoot, '@oai/artifact-tool/dist/artifact_tool.mjs')).href;
const { FileBlob, SpreadsheetFile } = await import(artifactModule);

const inputPath = option('--input');
const outputDirectory = option('--output');
const skipRender = process.argv.includes('--skip-render');
await mkdir(outputDirectory, { recursive: true });

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const structure = await workbook.inspect({ kind: 'workbook,sheet,table', maxChars: 12_000, tableMaxRows: 8, tableMaxCols: 10, tableMaxCellChars: 100 });
const formulas = await workbook.inspect({ kind: 'formula', maxChars: 16_000, options: { maxResults: 250 } });
const formulaErrors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 300 },
  summary: 'premium release formula error scan',
});
const dashboard = await workbook.inspect({ kind: 'region', sheetId: 'Directieoverzicht', range: 'A1:S50', maxChars: 12_000 });

const renders = [];
for (const sheetName of ['Directieoverzicht', 'Transacties']) {
  const target = resolve(outputDirectory, `${sheetName.toLowerCase()}.png`);
  if (!skipRender) {
    const image = await workbook.render({ sheetName, autoCrop: 'all', scale: 1, format: 'png' });
    await writeFile(target, new Uint8Array(await image.arrayBuffer()));
  }
  renders.push({ sheetName, target });
}

const errorText = String(formulaErrors.ndjson ?? '');
const report = {
  schemaVersion: '1.0.0',
  status: /#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A)/u.test(errorText) ? 'FAIL' : 'PASS',
  inputPath,
  structure: structure.ndjson,
  formulas: formulas.ndjson,
  formulaErrors: errorText,
  dashboard: dashboard.ndjson,
  renders,
};
const reportPath = resolve(outputDirectory, 'artifact-tool-report.json');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: report.status, inputPath, reportPath, renderedSheets: skipRender ? 0 : renders.length, verifiedExistingRenders: skipRender ? renders.length : 0 }, null, 2));
// The bundled Windows canvas runtime can fault during native finalizer teardown
// after all files have been flushed. Exit explicitly after the verified report
// is persisted so CI receives the actual inspection status.
process.exit(report.status === 'PASS' ? 0 : 1);
