import { access, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import currencies from '../src/currencies/index.mjs';
import { createFactoryRuntime } from '../src/factory-runtime.js';
import locales from '../src/locales/index.mjs';
import { careerProductDefinitions, productDefinitions } from '../src/products/index.mjs';
import { saveOutputBytes } from '../src/server/output-storage.mjs';
import themes from '../src/themes/index.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedAt = '2026-07-22T12:00:00.000Z';
const themeId = 'modern-minimal';
const appearance = 'light';
const runtime = createFactoryRuntime({ definitions: productDefinitions, locales, currencies, themes });
const variants = Object.freeze([
  { locale: 'nl-NL', market: 'NL', currency: 'EUR' },
  { locale: 'en-US', market: 'US', currency: 'USD' },
]);

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function outputUrl({ kind, filename, definition, variant }) {
  const url = new URL('http://localhost/api/output');
  const parameters = {
    kind,
    filename,
    productId: definition.id,
    locale: variant.locale,
    currency: variant.currency,
    themeId,
    version: definition.version,
    appearance,
  };
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url;
}

const expectedDirectories = careerProductDefinitions.flatMap(definition => variants.map(variant => resolve(
  projectRoot,
  'output/generated-products',
  definition.id,
  variant.locale,
  variant.currency,
  themeId,
  appearance,
  `v${definition.version}`,
)));
for (const directory of expectedDirectories) {
  if (await exists(directory)) throw new Error(`Career release destination already exists and will not be overwritten: ${directory}`);
}

const summaries = [];
for (const definition of careerProductDefinitions) {
  for (const variant of variants) {
    const workbookFilename = `${definition.id}-${variant.locale}.xlsx`;
    const result = await runtime.generate({
      productId: definition.id,
      locale: variant.locale,
      market: variant.market,
      currency: variant.currency,
      themeId,
      filename: definition.outputTypes.includes('xlsx') ? workbookFilename : `${definition.id}-${variant.locale}.docx`,
    }, { ExcelJS, JSZip, generatedAt });

    if (result.validationReport.status !== 'PASS' || result.qualityReport.status !== 'PASS' || result.package.packageValidation.status !== 'PASS') {
      throw new Error(`${definition.id}:${variant.locale} did not pass all release-generation gates.`);
    }

    const files = [];
    for (const artifact of result.documents.artifacts) {
      files.push(await saveOutputBytes(projectRoot, outputUrl({ kind: 'document', filename: artifact.filename, definition, variant }), artifact.bytes));
    }
    if (result.workbook) files.push(await saveOutputBytes(projectRoot, outputUrl({ kind: 'workbook', filename: workbookFilename, definition, variant }), result.workbook.bytes));
    const packageFilename = `${definition.id}-${variant.locale}-v${definition.version}.zip`;
    files.push(await saveOutputBytes(projectRoot, outputUrl({ kind: 'package', filename: packageFilename, definition, variant }), result.package.zipBytes));

    summaries.push({
      productId: definition.id,
      version: definition.version,
      locale: variant.locale,
      currency: variant.currency,
      outputTypes: definition.outputTypes,
      validation: result.validationReport.status,
      quality: result.qualityReport.status,
      qualityScore: result.qualityReport.score,
      compatibility: result.compatibilityReport.status,
      packageValidation: result.package.packageValidation.status,
      documents: result.summary.documents,
      workbookSheets: result.summary.sheets,
      workbookFormulas: result.summary.formulas,
      files: files.map(file => ({ kind: file.kind, path: file.relativePath, bytes: file.bytes, sha256: file.sha256 })),
    });
  }
}

const releaseReport = {
  schemaVersion: '1.0.0',
  generatedAt,
  status: summaries.every(summary => summary.validation === 'PASS' && summary.quality === 'PASS' && summary.packageValidation === 'PASS') ? 'PASS' : 'FAIL',
  products: careerProductDefinitions.length,
  variants: summaries.length,
  documents: summaries.reduce((total, summary) => total + summary.documents, 0),
  pdfExport: 'NOT_IMPLEMENTED',
  googleDocsExport: 'NOT_IMPLEMENTED',
  summaries,
};
const reportPath = resolve(projectRoot, 'output/generated-products/career-release-2026-07-22.json');
await writeFile(reportPath, `${JSON.stringify(releaseReport, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({ status: releaseReport.status, reportPath, products: releaseReport.products, variants: releaseReport.variants, documents: releaseReport.documents }, null, 2)}\n`);
