import { performance } from 'node:perf_hooks';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { createBatchPlan, runBatch } from '../src/engines/batch-engine.js';
import { inspectWorkbook } from '../src/engines/validation-engine.js';
import { expectedSheetNames, generateWorkbook } from '../src/engines/workbook-engine.js';
import { createFactoryRuntime } from '../src/factory-runtime.js';
import currencies from '../src/currencies/index.mjs';
import locales from '../src/locales/index.mjs';
import { productDefinitions, productionProductDefinitions } from '../src/products/index.mjs';
import themes from '../src/themes/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, process.argv[2] ?? 'release-evidence/production-expansion/performance/measurements.json');
const fixedTimestamp = '2026-07-15T12:00:00.000Z';
const capacities = Object.freeze([50, 100, 250, 500, 1_000]);
const runtime = createFactoryRuntime({ definitions: productDefinitions, locales, currencies, themes });

const round = value => Number(value.toFixed(2));
const memory = () => {
  const value = process.memoryUsage();
  return { heapUsedBytes: value.heapUsed, rssBytes: value.rss };
};
const difference = (after, before) => ({
  heapUsedBytes: after.heapUsedBytes - before.heapUsedBytes,
  rssBytes: after.rssBytes - before.rssBytes,
});

async function fileSizes(paths) {
  return Promise.all(paths.map(async path => ({ path, bytes: (await stat(resolve(root, path))).size })));
}

async function measureCapacity(inputCapacity) {
  globalThis.gc?.();
  const configuration = runtime.configuration('budget-planner-basic', {
    inputCapacity,
    sampleDataEnabled: true,
    outputOptions: { workbook: true, package: false, customerDocs: false, listing: false, imageManifests: false },
  });
  const validated = runtime.validate(configuration);
  if (!validated.valid) throw new Error(`Configuration validation failed at capacity ${inputCapacity}.`);
  const before = memory();

  const previewStarted = performance.now();
  const preview = runtime.preview(configuration);
  const previewMs = performance.now() - previewStarted;

  const workbookStarted = performance.now();
  const workbook = await generateWorkbook({
    definition: validated.definition,
    configuration,
    localization: validated.localization,
    currencyProfile: validated.currencyProfile,
    theme: validated.theme,
    ExcelJS,
    JSZip,
    generatedAt: fixedTimestamp,
  });
  const workbookGenerationMs = performance.now() - workbookStarted;

  const validationStarted = performance.now();
  const validation = await inspectWorkbook(workbook.bytes, {
    definition: validated.definition,
    configuration,
    expectedSheetNames: expectedSheetNames({
      definition: validated.definition,
      configuration,
      localization: validated.localization,
      currencyProfile: validated.currencyProfile,
      theme: validated.theme,
    }),
    ExcelJS,
    JSZip,
  });
  const validationMs = performance.now() - validationStarted;
  if (!validation.valid) throw new Error(`Workbook validation failed at capacity ${inputCapacity}.`);
  const after = memory();

  return {
    inputCapacity,
    previewMs: round(previewMs),
    workbookGenerationMs: round(workbookGenerationMs),
    validationMs: round(validationMs),
    totalMs: round(previewMs + workbookGenerationMs + validationMs),
    workbookBytes: workbook.byteLength,
    sheets: workbook.metrics.sheets,
    formulas: workbook.metrics.formulas,
    validations: workbook.metrics.validations,
    previewSheets: preview.sheets.length,
    memoryDelta: difference(after, before),
    status: 'PASS',
  };
}

// Warm the module and ZIP paths so capacity measurements represent steady-state generation.
await measureCapacity(50);
const capacityMeasurements = [];
for (const capacity of capacities) capacityMeasurements.push(await measureCapacity(capacity));

globalThis.gc?.();
const batchBefore = memory();
const batchPlan = createBatchPlan({
  productIds: productionProductDefinitions.map(definition => definition.id),
  locales: ['nl-NL'],
  currencies: ['EUR'],
  themeIds: ['executive-navy'],
  capacities: [100],
  sampleDataEnabled: true,
  outputs: ['workbook'],
});
const batchStarted = performance.now();
const batch = await runBatch(batchPlan, variant => runtime.generate(runtime.configuration(variant.productId, {
  locale: variant.locale,
  currency: variant.currency,
  themeId: variant.themeId,
  inputCapacity: variant.inputCapacity,
  sampleDataEnabled: variant.sampleDataEnabled,
  outputOptions: { workbook: true, package: false, customerDocs: false, listing: false, imageManifests: false },
}), { ExcelJS, JSZip, generatedAt: fixedTimestamp }));
const batchMs = performance.now() - batchStarted;
const batchAfter = memory();
if (batch.status !== 'PASS') throw new Error(`Production batch performance run ended with ${batch.status}.`);

const largest = capacityMeasurements.at(-1);
const evidence = {
  schemaVersion: '1.0.0',
  capturedAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, architecture: process.arch, gcExposed: typeof globalThis.gc === 'function' },
  baseline: {
    source: 'release-evidence/production-expansion/baseline/browser-smoke.json',
    inputRows: 60,
    formulaCount: 27,
    externalRequests: 6,
    timingAvailable: false,
  },
  scriptSizes: await fileSizes([
    'apps/product-factory/index.html',
    'apps/product-factory/app.js',
    'apps/product-factory/styles.css',
    'vendor/exceljs/4.4.0/exceljs.min.js',
    'vendor/jszip/3.10.1/jszip.min.js',
  ]),
  capacityMeasurements,
  batch: {
    variants: batchPlan.count,
    durationMs: round(batchMs),
    averageMsPerVariant: round(batchMs / batchPlan.count),
    passed: batch.passed,
    failed: batch.failed,
    memoryDelta: difference(batchAfter, batchBefore),
    status: batch.status,
  },
  thresholds: {
    maximumCapacityTotalMs: 15_000,
    maximumCapacityRssIncreaseBytes: 512 * 1024 * 1024,
    batchFailureCount: 0,
  },
  status: largest.totalMs <= 15_000 && largest.memoryDelta.rssBytes <= 512 * 1024 * 1024 && batch.failed === 0 ? 'PASS' : 'FAIL',
  limitations: [
    'Endpoint memory deltas are process-level indicators, not sampled peak-memory measurements.',
    'The preserved baseline did not capture generation timing, so no before/after speed claim is made.',
    'Browser responsiveness and navigation timings are measured separately by the E2E gate.',
  ],
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(evidence, null, 2));
if (evidence.status !== 'PASS') process.exitCode = 1;
