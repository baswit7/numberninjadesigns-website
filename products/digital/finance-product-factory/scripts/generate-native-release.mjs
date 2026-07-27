import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { inspectWorkbook } from '../src/engines/validation-engine.js';
import { sha256Hex, validateZipPath } from '../src/engines/security.js';
import { expectedSheetNames, generateWorkbook } from '../src/engines/workbook-engine.js';
import { FACTORY_VERSION, createFactoryRuntime } from '../src/factory-runtime.js';
import currencies from '../src/currencies/index.mjs';
import locales from '../src/locales/index.mjs';
import { productDefinitions, productionProductDefinitions } from '../src/products/index.mjs';
import themes, { resolveWorkbookTheme } from '../src/themes/index.mjs';
import { renderExcelListingImages } from '../src/renderers/excel-workbook-renderer.mjs';
import { LISTING_IMAGE_PATHS } from '../src/commercial/listing-image-engine.js';
import {
  REQUIRED_CORE_SALES_WORKBOOKS,
  REQUIRED_RELEASE_SCENARIOS,
  configurationForReleaseScenario,
  verifyPackageArtifact,
} from './validate-production-matrix.mjs';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = createFactoryRuntime({ definitions: productDefinitions, locales, currencies, themes });

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}

const generatedAt = new Date(option('--generated-at', new Date().toISOString())).toISOString();
const runId = generatedAt.replace(/[:.]/g, '-');
const outputRoot = resolve(root, option('--output', 'output/generated-products'));
const evidenceRoot = resolve(root, option('--evidence', `release-evidence/production-expansion/native-excel/${runId}`));
const replaceExisting = process.argv.includes('--replace');
const stageRoot = resolve(outputRoot, `.native-release-stage-${runId}`);

function within(parent, child) {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

function assertScoped(path, label) {
  if (!within(root, path)) throw new Error(`${label} must remain inside the repository.`);
  return path;
}

assertScoped(outputRoot, 'Output root');
assertScoped(evidenceRoot, 'Evidence root');
assertScoped(stageRoot, 'Release staging root');

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function assertNoSymlink(path) {
  const scoped = assertScoped(resolve(path), 'Filesystem path');
  const parts = relative(root, scoped).split(sep).filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = join(current, part);
    if (!await exists(current)) break;
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in release paths: ${relative(root, current)}.`);
  }
}

async function writeAtomic(path, bytes) {
  const target = assertScoped(resolve(path), 'Output file');
  await assertNoSymlink(dirname(target));
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, target);
  } catch (error) {
    if (await exists(temporary)) await rm(temporary, { force: true });
    throw error;
  }
}

function displayPath(path) {
  return relative(root, path).split(sep).join('/');
}

async function runExcelSmoke(inputPath, outputPath, resultPath) {
  const script = resolve(root, 'scripts/excel-open-save-smoke.ps1');
  const psLiteral = value => `'${String(value).replaceAll("'", "''")}'`;
  // `pwsh -File` can wait indefinitely when spawned through Node's piped
  // stdio on Windows. Invoke the same script through a non-interactive STA
  // command so Excel COM receives a stable apartment and the child exits.
  const command = `& ${psLiteral(script)} -InputPath ${psLiteral(inputPath)} -OutputPath ${psLiteral(outputPath)} -ResultPath ${psLiteral(resultPath)}`;
  const args = [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-Sta',
    '-ExecutionPolicy', 'Bypass', '-Command', command,
  ];
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
  throw new Error(`Native Excel smoke failed: ${lastError?.stderr || lastError?.message || 'unknown error'}`);
}

function requiredPackagePaths(result) {
  const workbookFilename = result.package.workbookFilename;
  return [
    `product/${workbookFilename}`,
    'customer/README.html',
    'customer/QUICK_START.html',
    'customer/LICENSE.txt',
    'listing/listing-metadata.json',
    'listing/title.txt',
    'listing/description.txt',
    'listing/tags.txt',
    'listing/features.txt',
    'listing/faq.txt',
    'listing/alt-texts.txt',
    ...LISTING_IMAGE_PATHS,
    'images/image-production-manifest.json',
    'images/photoshop-batch-manifest.json',
    'images/copy-overlay-plan.json',
    'images/mockup-shot-list.json',
    'qa/validation-report.json',
    'qa/quality-report.json',
    'qa/compatibility-report.json',
    'qa/premium-release-report.json',
    'qa/generated-product-manifest.json',
    'qa/release-manifest.json',
    'manifest.json',
    ...(result.package.rootManifest.extensions?.googleSheetsEdition?.path ? [result.package.rootManifest.extensions.googleSheetsEdition.path, 'qa/google-sheets-readiness-report.json'] : []),
    ...(result.definition.id === 'budget-planner-ultimate' && /^(?:en|nl)(?:-|$)/i.test(result.configuration.locale) ? ['customer/SUPPORT.html', 'listing/offer-strategy.json'] : []),
  ].sort();
}

async function verifyCommercialPackage(result, testedWorkbookSha256) {
  if (!result.package) throw new Error(`${result.definition.id} produced no commercial package.`);
  const filePaths = [...result.package.files.keys()].sort();
  const expectedPaths = requiredPackagePaths(result);
  if (JSON.stringify(filePaths) !== JSON.stringify(expectedPaths)) throw new Error(`${result.definition.id} package path set is incomplete or unexpected.`);

  const workbookFile = result.package.files.get(`product/${result.package.workbookFilename}`);
  if (!workbookFile || await sha256Hex(workbookFile.bytes) !== testedWorkbookSha256) {
    throw new Error(`${result.definition.id} packaged workbook is not the exact native-tested byte sequence.`);
  }

  const archive = await JSZip.loadAsync(result.package.zipBytes);
  const archivePaths = Object.keys(archive.files).filter(path => !archive.files[path].dir).sort();
  if (JSON.stringify(archivePaths) !== JSON.stringify(filePaths)) throw new Error(`${result.definition.id} ZIP entries differ from the package file map.`);
  for (const [path, file] of result.package.files) {
    const entry = archive.file(path);
    if (!entry) throw new Error(`${result.definition.id} ZIP is missing ${path}.`);
    const bytes = await entry.async('uint8array');
    if (await sha256Hex(bytes) !== file.sha256) throw new Error(`${result.definition.id} ZIP checksum mismatch for ${path}.`);
  }
  await verifyPackageArtifact(result, { semanticSha256: testedWorkbookSha256 }, {
    compatibilityStatus: 'PASS',
    releaseStatus: 'READY_FOR_REVIEW',
  });
}

async function stageVariant(result) {
  const variantRoot = resolve(
    stageRoot,
    result.definition.id,
    result.configuration.locale,
    result.configuration.currency,
    result.configuration.themeId,
    result.configuration.extensions.productAppearance,
    result.definition.version,
  );
  assertScoped(variantRoot, 'Variant staging path');
  for (const [path, file] of result.package.files) {
    const safePath = validateZipPath(path);
    await writeAtomic(resolve(variantRoot, ...safePath.split('/')), file.bytes);
  }
  await writeAtomic(resolve(variantRoot, 'package', result.package.packageFilename), result.package.zipBytes);
  return variantRoot;
}

async function stageCoreSalesSet(workbooks) {
  if (!(workbooks instanceof Map) || workbooks.size !== REQUIRED_CORE_SALES_WORKBOOKS.length) {
    throw new Error('Core sales set requires exactly five native-tested workbook variants.');
  }
  const salesSetRoot = resolve(stageRoot, 'sales-set');
  const productsRoot = resolve(salesSetRoot, 'products');
  assertScoped(productsRoot, 'Core sales-set staging path');
  await mkdir(productsRoot, { recursive: true });
  const zip = new JSZip();
  const zipDate = new Date(generatedAt);
  const evidence = [];
  for (const requirement of REQUIRED_CORE_SALES_WORKBOOKS) {
    const item = workbooks.get(requirement.scenarioId);
    if (!item?.bytes || item.bytes.byteLength < 1_000 || item.bytes[0] !== 0x50 || item.bytes[1] !== 0x4b) {
      throw new Error(`Core sales workbook '${requirement.filename}' is missing or invalid.`);
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(item.bytes);
    if (workbook.worksheets.length !== item.sheets || workbook.worksheets.length === 0) {
      throw new Error(`Core sales workbook '${requirement.filename}' failed independent worksheet validation.`);
    }
    await writeAtomic(resolve(productsRoot, requirement.filename), item.bytes);
    zip.file(`products/${requirement.filename}`, item.bytes, { binary: true, createFolders: false, date: zipDate });
    evidence.push({
      scenarioId: requirement.scenarioId,
      path: `products/${requirement.filename}`,
      sourceFilename: item.sourceFilename,
      bytes: item.bytes.byteLength,
      sha256: await sha256Hex(item.bytes),
      sheets: item.sheets,
    });
  }
  const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE', platform: 'DOS', streamFiles: false });
  const archive = await JSZip.loadAsync(zipBytes);
  const paths = Object.keys(archive.files).filter(path => !archive.files[path].dir).sort();
  const expectedPaths = REQUIRED_CORE_SALES_WORKBOOKS.map(requirement => `products/${requirement.filename}`).sort();
  if (JSON.stringify(paths) !== JSON.stringify(expectedPaths)) throw new Error('Core sales-set ZIP path set is incomplete or unexpected.');
  for (const item of evidence) {
    const archived = await archive.file(item.path).async('uint8array');
    if (await sha256Hex(archived) !== item.sha256) throw new Error(`Core sales-set ZIP checksum mismatch for '${item.path}'.`);
  }
  const archiveFilename = 'finance-product-factory-master-sales-set.zip';
  await writeAtomic(resolve(salesSetRoot, archiveFilename), zipBytes);
  const summary = {
    status: 'PASS',
    workbookCount: evidence.length,
    archiveFilename,
    archiveBytes: zipBytes.byteLength,
    archiveSha256: await sha256Hex(zipBytes),
    workbooks: evidence,
  };
  await writeAtomic(resolve(salesSetRoot, 'sales-set-evidence.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return { staged: salesSetRoot, summary };
}

async function publishVariants(publications) {
  const completed = [];
  try {
    for (const publication of publications) {
      const { staged, target } = publication;
      await assertNoSymlink(dirname(target));
      await mkdir(dirname(target), { recursive: true });
      const backup = `${target}.native-release-backup-${runId}`;
      if (await exists(target)) {
        if (!replaceExisting) throw new Error(`Release target already exists: ${displayPath(target)}. Re-run with --replace to replace generated output.`);
        await assertNoSymlink(target);
        if (await exists(backup)) throw new Error(`Release backup path already exists: ${displayPath(backup)}.`);
        await rename(target, backup);
        publication.backup = backup;
      }
      await rename(staged, target);
      completed.push(publication);
    }
  } catch (error) {
    for (const publication of [...publications].reverse()) {
      if (completed.includes(publication) && await exists(publication.target)) await rm(publication.target, { recursive: true, force: true });
      if (publication.backup && await exists(publication.backup)) {
        if (await exists(publication.target)) await rm(publication.target, { recursive: true, force: true });
        await rename(publication.backup, publication.target);
      }
    }
    throw error;
  }
  for (const publication of completed) {
    if (publication.backup && await exists(publication.backup)) await rm(publication.backup, { recursive: true, force: true });
  }
}

await assertNoSymlink(outputRoot);
await assertNoSymlink(evidenceRoot);
await mkdir(outputRoot, { recursive: true });
await mkdir(evidenceRoot, { recursive: true });
if (await exists(stageRoot)) throw new Error(`Release staging path already exists: ${displayPath(stageRoot)}.`);
await mkdir(stageRoot, { recursive: true });

const summaries = [];
const publications = [];
const coreSalesWorkbooks = new Map();
let coreSalesSet = null;
try {
  for (const scenario of REQUIRED_RELEASE_SCENARIOS) {
    const definition = productionProductDefinitions.find(candidate => candidate.id === scenario.productId);
    if (!definition) throw new Error(`Required release scenario '${scenario.id}' references an inactive product.`);
    const configuration = configurationForReleaseScenario(runtime, scenario, { packageOutput: true, sampleDataEnabled: true });
    const productEvidenceRoot = resolve(evidenceRoot, scenario.id);
    await mkdir(productEvidenceRoot, { recursive: true });
    let nativeEvidence;

    const listingImageProvider = async options => {
      let comparisonWorkbookBytes = null;
      if (definition.extensions?.supportedAppearances?.includes('light') && definition.extensions?.supportedAppearances?.includes('dark')) {
        const currentAppearance = configuration.extensions.productAppearance;
        const comparisonAppearance = currentAppearance === 'dark' ? 'light' : 'dark';
        const comparisonConfiguration = {
          ...configuration,
          filename: configuration.filename.replace(/-(?:light|dark)\.xlsx$/u, `-${comparisonAppearance}.xlsx`),
          extensions: { ...configuration.extensions, productAppearance: comparisonAppearance },
        };
        const comparisonTheme = resolveWorkbookTheme(themes[configuration.themeId], comparisonAppearance);
        const comparison = await generateWorkbook({
          definition,
          configuration: comparisonConfiguration,
          localization: locales[configuration.locale],
          currencyProfile: currencies[configuration.currency],
          theme: comparisonTheme,
          ExcelJS,
          JSZip,
          generatedAt,
        });
        comparisonWorkbookBytes = comparison.bytes;
      }
      return renderExcelListingImages({
        ...options,
        comparisonWorkbookBytes,
        outputDirectory: resolve(productEvidenceRoot, 'excel-listing-render'),
      });
    };

    const result = await runtime.generate(configuration, {
      ExcelJS,
      JSZip,
      generatedAt,
      compatibilityProbe: async ({ definition: probedDefinition, configuration: probedConfiguration, workbookBytes, validationReport }) => {
        const sourcePath = resolve(productEvidenceRoot, `${probedDefinition.id}-generated.xlsx`);
        const savedPath = resolve(productEvidenceRoot, `${probedDefinition.id}-saved-by-excel.xlsx`);
        const resultPath = resolve(productEvidenceRoot, 'excel-smoke.json');
        await writeAtomic(sourcePath, workbookBytes);
        const workbookSha256 = await sha256Hex(workbookBytes);
        await runExcelSmoke(sourcePath, savedPath, resultPath);
        const smoke = JSON.parse((await readFile(resultPath, 'utf8')).replace(/^\uFEFF/, ''));
        if (smoke.status !== 'PASS') throw new Error(`${probedDefinition.id} native Excel status is ${smoke.status}: ${smoke.error ?? 'unknown error'}.`);
        if (smoke.formulaCells !== validationReport.extensions.metrics.formulas) {
          throw new Error(`${probedDefinition.id} native formula count ${smoke.formulaCells} differs from structural count ${validationReport.extensions.metrics.formulas}.`);
        }
        if (smoke.formulaErrorCells.length || smoke.externalLinks.length || smoke.circularReference) {
          throw new Error(`${probedDefinition.id} native Excel reported formula errors, external links, or a circular reference.`);
        }
        const savedBytes = new Uint8Array(await readFile(savedPath));
        const savedValidation = await inspectWorkbook(savedBytes, {
          definition: probedDefinition,
          configuration: probedConfiguration,
          expectedSheetNames: expectedSheetNames({
            definition: probedDefinition,
            configuration: probedConfiguration,
            localization: locales[probedConfiguration.locale],
            currencyProfile: currencies[probedConfiguration.currency],
            theme: themes[probedConfiguration.themeId],
          }),
          ExcelJS,
          JSZip,
          generatedAt,
        });
        if (!savedValidation.valid) throw new Error(`${probedDefinition.id} Excel-saved copy failed structural re-read.`);
        nativeEvidence = {
          workbookSha256,
          excelSavedSha256: await sha256Hex(savedBytes),
          smoke,
          savedValidation,
          sourcePath: displayPath(sourcePath),
          savedPath: displayPath(savedPath),
        };
        return {
          'excel-desktop': {
            version: smoke.excelVersion,
            status: 'PASS',
            checks: [...smoke.checks, 'The Excel-saved copy passed ExcelJS re-read and OOXML structural validation.'],
            limitations: smoke.limitations,
          },
        };
      },
      listingImageProvider,
    });

    if (!nativeEvidence) throw new Error(`${definition.id} did not produce native evidence.`);
    if (result.validationReport.status !== 'PASS' || result.qualityReport.status !== 'PASS' || result.compatibilityReport.status !== 'PASS') {
      throw new Error(`${definition.id} failed a release gate.`);
    }
    if (result.qualityReport.score < 90
      || result.package.generatedManifest.releaseStatus !== 'READY_FOR_REVIEW'
      || result.package.releaseManifest.status !== 'READY_FOR_REVIEW'
      || result.package.releaseManifest.extensions?.humanVisualApprovalValidation?.status !== 'MISSING') {
      const failedPremiumChecks = result.package.premiumReleaseReport?.checks?.filter(check => check.status !== 'PASS') ?? [];
      throw new Error(`${definition.id} did not reach the required hash-bound human-review state${failedPremiumChecks.length ? `; failed premium checks: ${failedPremiumChecks.map(check => `${check.id}=${JSON.stringify(check.evidence)}`).join(', ')}` : ''}.`);
    }
    if (await sha256Hex(result.workbook.bytes) !== nativeEvidence.workbookSha256) throw new Error(`${definition.id} runtime bytes changed after the compatibility probe.`);
    await verifyCommercialPackage(result, nativeEvidence.workbookSha256);
    if (REQUIRED_CORE_SALES_WORKBOOKS.some(requirement => requirement.scenarioId === scenario.id)) {
      coreSalesWorkbooks.set(scenario.id, {
        bytes: result.workbook.bytes,
        sourceFilename: configuration.filename,
        sheets: result.summary.sheets,
      });
    }
    const staged = await stageVariant(result);
    const target = resolve(
      outputRoot,
      definition.id,
      configuration.locale,
      configuration.currency,
      configuration.themeId,
      configuration.extensions.productAppearance,
      definition.version,
    );
    publications.push({ staged, target });
    summaries.push({
      scenarioId: scenario.id,
      productId: definition.id,
      tier: scenario.tier,
      productVersion: definition.version,
      locale: configuration.locale,
      currency: configuration.currency,
      themeId: configuration.themeId,
      appearance: configuration.extensions.productAppearance,
      inputCapacity: configuration.inputCapacity,
      sheets: result.summary.sheets,
      formulas: result.summary.formulas,
      validations: result.summary.validations,
      workbookBytes: result.summary.workbookBytes,
      packageBytes: result.summary.packageBytes,
      workbookSha256: nativeEvidence.workbookSha256,
      excelSavedSha256: nativeEvidence.excelSavedSha256,
      validationStatus: result.validationReport.status,
      qualityScore: result.qualityReport.score,
      compatibilityStatus: result.compatibilityReport.status,
      releaseStatus: result.package.generatedManifest.releaseStatus,
      outputPath: displayPath(target),
      evidencePath: displayPath(productEvidenceRoot),
    });
  }

  coreSalesSet = await stageCoreSalesSet(coreSalesWorkbooks);
  publications.push({ staged: coreSalesSet.staged, target: resolve(outputRoot, 'sales-set') });
  await publishVariants(publications);
  const report = {
    schemaVersion: '1.0.0',
    generatedAt,
    status: summaries.length === REQUIRED_RELEASE_SCENARIOS.length
      && summaries.every(item => item.releaseStatus === 'READY_FOR_REVIEW')
      && coreSalesSet.summary.status === 'PASS'
      && coreSalesSet.summary.workbookCount === REQUIRED_CORE_SALES_WORKBOOKS.length
      ? 'PASS'
      : 'FAIL',
    factoryVersion: FACTORY_VERSION,
    products: summaries,
    salesSet: { ...coreSalesSet.summary, outputPath: displayPath(resolve(outputRoot, 'sales-set')) },
    publication: {
      outputRoot: displayPath(outputRoot),
      replacedExisting: replaceExisting,
      atomicPolicy: 'ALL_VARIANTS_VALIDATED_BEFORE_PUBLICATION_WITH_PER_VARIANT_ROLLBACK',
      state: 'AWAITING_HASH_BOUND_HUMAN_VISUAL_APPROVAL',
    },
    limitations: ['Excel desktop 2019 or later is the verified target; Excel web, LibreOffice and Google Sheets are not release-certified.'],
  };
  await writeAtomic(resolve(evidenceRoot, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
} catch (error) {
  const failure = { schemaVersion: '1.0.0', generatedAt, status: 'FAIL', error: String(error?.message ?? error).slice(0, 2_000), products: summaries };
  await writeAtomic(resolve(evidenceRoot, 'failure.json'), `${JSON.stringify(failure, null, 2)}\n`);
  throw error;
} finally {
  if (await exists(stageRoot)) await rm(stageRoot, { recursive: true, force: true });
}
