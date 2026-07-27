import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { buildExpansionReleasePackage } from '../src/commercial/expansion-release-engine.mjs';
import currencies from '../src/currencies/index.mjs';
import { sha256Hex } from '../src/engines/security.js';
import { createFactoryRuntime } from '../src/factory-runtime.js';
import locales from '../src/locales/index.mjs';
import { productDefinitions } from '../src/products/index.mjs';
import themes from '../src/themes/index.mjs';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceReportPath = resolve(root, 'generated/market-intelligence/2026-07-20/market-report.json');
const outputRoot = resolve(root, 'output/expansion-release-2026-07-20');
const evidenceRoot = resolve(root, 'release-evidence/production-expansion/2026-07-20-final');
const stageRoot = resolve(root, 'output/.expansion-release-2026-07-20-stage');
const generatedAt = '2026-07-20T12:00:00.000Z';
const runtime = createFactoryRuntime({ definitions: productDefinitions, locales, currencies, themes });

const scenarios = Object.freeze([
  { id: 'phase-2-simple-monthly-budget', productId: 'monthly-budget-planner', themeId: 'modern-minimal' },
  { id: 'phase-2-annual-budget', productId: 'annual-budget-spreadsheet', themeId: 'sage-finance' },
  { id: 'phase-2-ultimate-finance-dashboard', productId: 'budget-planner-ultimate', themeId: 'executive-navy' },
  { id: 'phase-2-paycheck-budget', productId: 'paycheck-budget-planner', themeId: 'sage-finance' },
  { id: 'phase-2-debt-savings-bundle', productId: 'debt-savings-bundle', themeId: 'warm-neutral' },
  { id: 'phase-3-project-management', productId: 'project-management-spreadsheet', themeId: 'executive-navy' },
  { id: 'phase-4-small-business-bookkeeping', productId: 'small-business-bookkeeping', themeId: 'modern-minimal' },
  { id: 'phase-5-wedding-planner-candidate', productId: 'wedding-planner-release-candidate', themeId: 'warm-neutral' },
]);

function within(parent, child) {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

function scoped(path) {
  const target = resolve(path);
  if (!within(root, target)) throw new Error(`Output path escapes the repository: ${target}`);
  return target;
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function write(path, value) {
  const target = scoped(path);
  await mkdir(dirname(target), { recursive: true });
  const bytes = typeof value === 'string' || value instanceof Uint8Array ? value : new Uint8Array(value);
  await writeFile(target, bytes, { flag: 'wx' });
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function display(path) {
  return relative(root, path).split(sep).join('/');
}

async function runExcelSmoke(inputPath, outputPath, resultPath) {
  const script = resolve(root, 'scripts/excel-open-save-smoke.ps1');
  const literal = value => `'${String(value).replaceAll("'", "''")}'`;
  const command = `& ${literal(script)} -InputPath ${literal(inputPath)} -OutputPath ${literal(outputPath)} -ResultPath ${literal(resultPath)}`;
  const args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-Sta', '-ExecutionPolicy', 'Bypass', '-Command', command];
  let lastError;
  for (const executable of ['pwsh.exe', 'powershell.exe']) {
    try {
      await execFileAsync(executable, args, { cwd: root, windowsHide: true, timeout: 180_000, maxBuffer: 2 * 1024 * 1024 });
      return;
    } catch (error) {
      lastError = error;
      if (error.code !== 'ENOENT') break;
    }
  }
  throw new Error(`Native Excel smoke test failed: ${lastError?.stderr || lastError?.message || 'unknown error'}`);
}

async function releaseScenario(scenario, marketReport) {
  const definition = runtime.resolveProduct(scenario.productId, { allowBeta: true });
  const productRoot = resolve(stageRoot, scenario.id);
  const workbookRoot = resolve(productRoot, 'workbook');
  const evidenceProductRoot = resolve(evidenceRoot, scenario.id);
  await mkdir(workbookRoot, { recursive: true });
  await mkdir(evidenceProductRoot, { recursive: true });

  const configuration = runtime.configuration(scenario.productId, {
    locale: 'en-US',
    market: 'US',
    currency: 'USD',
    year: 2026,
    themeId: scenario.themeId,
    inputCapacity: definition.extensions?.tier === 'ultimate' ? 500 : 250,
    sampleDataEnabled: true,
    filename: `${scenario.productId}-en-US-USD-2026.xlsx`,
    outputOptions: { package: false },
    extensions: {
      productAppearance: 'light',
      startMonth: 1,
      platformProfile: 'excel',
      outputProfile: 'repository-release',
    },
  });

  let nativeEvidence;
  const result = await runtime.generate(configuration, {
    ExcelJS,
    JSZip,
    generatedAt,
    compatibilityProbe: async ({ workbookBytes, validationReport }) => {
      const sourcePath = resolve(workbookRoot, configuration.filename);
      const savedPath = resolve(workbookRoot, configuration.filename.replace(/\.xlsx$/iu, '-excel-saved.xlsx'));
      const resultPath = resolve(evidenceProductRoot, 'excel-open-save-smoke.json');
      await write(sourcePath, workbookBytes);
      await runExcelSmoke(sourcePath, savedPath, resultPath);
      const smoke = JSON.parse((await readFile(resultPath, 'utf8')).replace(/^\uFEFF/u, ''));
      if (smoke.status !== 'PASS') throw new Error(`${scenario.id}: Excel smoke status ${smoke.status}: ${smoke.error ?? 'unknown error'}`);
      if (smoke.formulaErrorCells?.length || smoke.externalLinks?.length || smoke.circularReference) throw new Error(`${scenario.id}: Excel reported formula errors, external links or a circular reference.`);
      if (smoke.formulaCells !== validationReport.extensions.metrics.formulas) throw new Error(`${scenario.id}: formula count changed during native inspection.`);
      nativeEvidence = {
        status: smoke.status,
        excelVersion: smoke.excelVersion,
        checks: smoke.checks,
        limitations: smoke.limitations,
        generatedWorkbook: display(sourcePath),
        excelSavedWorkbook: display(savedPath),
      };
      return {
        'excel-desktop': {
          version: smoke.excelVersion,
          status: 'PASS',
          checks: [...smoke.checks, 'The exact generated workbook completed the native Excel open/save smoke test.'],
          limitations: smoke.limitations,
        },
      };
    },
  });

  if (!nativeEvidence || result.validationReport.status !== 'PASS' || result.compatibilityReport.status !== 'PASS') throw new Error(`${scenario.id}: release gates did not pass.`);
  const workbookSha256 = await sha256Hex(result.workbook.bytes);
  const release = buildExpansionReleasePackage({ definition, result, marketReport, workbookSha256 });
  if (release.validation.status !== 'PASS') throw new Error(`${scenario.id}: commercial release package validation failed: ${json(release.validation.errors)}`);

  for (const [path, content] of release.files) await write(resolve(productRoot, path), content);
  const zip = new JSZip();
  zip.file(`product/${configuration.filename}`, result.workbook.bytes);
  for (const [path, content] of release.files) zip.file(path, content);
  const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 9 }, platform: 'DOS' });
  await write(resolve(productRoot, `${scenario.productId}-etsy-release.zip`), zipBytes);
  const summary = {
    scenarioId: scenario.id,
    productId: scenario.productId,
    status: 'PASS',
    releaseStatus: release.manifest.releaseStatus,
    workbookSha256,
    workbookBytes: result.workbook.bytes.byteLength,
    packageBytes: zipBytes.byteLength,
    sheets: result.summary.sheets,
    formulas: result.summary.formulas,
    validations: result.summary.validations,
    qualityScore: result.qualityReport.score,
    excel: nativeEvidence,
    googleSheets: 'PROVISIONAL',
    etsyTags: release.listing.tags.length,
    releasePackageValidation: release.validation.status,
  };
  await write(resolve(evidenceProductRoot, 'release-summary.json'), json(summary));
  return summary;
}

if (!await exists(sourceReportPath)) throw new Error(`Market report is missing: ${sourceReportPath}`);
if (await exists(outputRoot) || await exists(stageRoot) || await exists(evidenceRoot)) throw new Error('Expansion release output already exists; remove or archive the exact release directories before rerunning.');

const marketReport = JSON.parse(await readFile(sourceReportPath, 'utf8'));
await mkdir(stageRoot, { recursive: true });
await mkdir(evidenceRoot, { recursive: true });

try {
  const summaries = [];
  for (const scenario of scenarios) {
    process.stdout.write(`Generating ${scenario.id}...\n`);
    summaries.push(await releaseScenario(scenario, marketReport));
  }
  const report = {
    schemaVersion: '1.0.0',
    generatedAt,
    status: summaries.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    scenarioCount: summaries.length,
    summaries,
  };
  await write(resolve(stageRoot, 'release-index.json'), json(report));
  await write(resolve(evidenceRoot, 'release-validation-summary.json'), json(report));
  await rename(stageRoot, outputRoot);
  process.stdout.write(`${json({ status: report.status, outputRoot: display(outputRoot), evidenceRoot: display(evidenceRoot), scenarios: summaries.map(item => ({ id: item.scenarioId, status: item.status, sheets: item.sheets, formulas: item.formulas, tags: item.etsyTags })) })}`);
} catch (error) {
  if (await exists(stageRoot)) await rm(stageRoot, { recursive: true, force: true });
  throw error;
}
