import { access, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { createFactoryRuntime, FACTORY_VERSION } from '../src/factory-runtime.js';
import currencies from '../src/currencies/index.mjs';
import locales from '../src/locales/index.mjs';
import { productDefinitions } from '../src/products/index.mjs';
import themes from '../src/themes/index.mjs';
import { sha256Hex } from '../src/engines/security.js';
import { validateEtsyDigitalUploadPlan } from '../src/commercial/etsy-dominance-engine.mjs';
import { buildPremiumEtsyListingImages } from '../src/commercial/etsy-premium-visual-engine.mjs';
import { buildEtsyRaceControlBundle } from '../src/commercial/etsy-race-control-engine.mjs';
import { buildEtsyListingVideos } from './build-etsy-listing-videos.mjs';

const root = resolve(import.meta.dirname, '..');
const runtime = createFactoryRuntime({ definitions: productDefinitions, locales, currencies, themes });

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}

const generatedAt = new Date(option('--generated-at', new Date().toISOString())).toISOString();
const outputRoot = resolve(root, option('--output', 'output/etsy-dominance/world-champion-v2'));
const replaceExisting = process.argv.includes('--replace');
const localeFilter = option('--locale', null);

const SCENARIOS = Object.freeze([
  Object.freeze({ id: 'en-US', locale: 'en-US', market: 'US', currency: 'USD' }),
  Object.freeze({ id: 'nl-NL', locale: 'nl-NL', market: 'NL', currency: 'EUR' }),
]);

async function write(path, value) {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, value);
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function configurationFor(scenario, appearance, packageEnabled) {
  return runtime.configuration('budget-planner-ultimate', {
    locale: scenario.locale,
    market: scenario.market,
    currency: scenario.currency,
    year: 2026,
    themeId: 'executive-navy',
    title: scenario.locale === 'nl-NL' ? 'Ultiem Budget Systeem' : 'Ultimate Budget OS',
    filename: `ultimate-budget-os-${scenario.locale}-${appearance}.xlsx`,
    inputCapacity: 10000,
    sampleDataEnabled: true,
    outputOptions: { workbook: true, package: packageEnabled, customerDocs: true, listing: true, imageManifests: true },
    extensions: { productAppearance: appearance, paletteId: 'executive-navy', platformProfile: 'excel-google-sheets', tier: 'ultimate' },
  });
}

async function buildWorkbook(scenario, appearance, packageEnabled) {
  return runtime.generate(configurationFor(scenario, appearance, packageEnabled), { ExcelJS, JSZip, generatedAt });
}

async function createLaunchKit(scenario) {
  const scenarioRoot = resolve(outputRoot, scenario.id);
  const imagesRoot = resolve(scenarioRoot, 'listing', 'images');
  const videosRoot = resolve(scenarioRoot, 'listing', 'videos');
  const [light, dark] = await Promise.all([
    buildWorkbook(scenario, 'light', false),
    buildWorkbook(scenario, 'dark', true),
  ]);
  if (!dark.package || dark.package.imageValidation.status !== 'PASS') throw new Error(`${scenario.id}: commercial package or listing-image validation failed.`);
  const productFiles = [
    { path: `products/excel/${light.configuration.filename}`, bytes: light.workbook.bytes },
    { path: `products/excel/${dark.configuration.filename}`, bytes: dark.workbook.bytes },
    { path: `products/google-sheets/${light.configuration.filename.replace(/\.xlsx$/i, '-google-sheets-import.xlsx')}`, bytes: light.workbook.bytes },
    { path: `products/google-sheets/${dark.configuration.filename.replace(/\.xlsx$/i, '-google-sheets-import.xlsx')}`, bytes: dark.workbook.bytes },
  ];
  for (const file of productFiles) await write(resolve(scenarioRoot, ...file.path.split('/')), file.bytes);
  for (const [path, file] of dark.package.files) {
    if (path.startsWith('listing/images/') || path.startsWith('images/') || path.startsWith('product/')) continue;
    await write(resolve(scenarioRoot, ...path.split('/')), file.bytes);
  }
  const premiumImages = await buildPremiumEtsyListingImages({
    workbookPath: resolve(scenarioRoot, productFiles[1].path),
    outputDirectory: imagesRoot,
    locale: scenario.locale,
    currency: scenario.currency,
    inputCapacity: 10000,
    generatedAt,
  });
  if (premiumImages.manifest.status !== 'PASS') throw new Error(`${scenario.id}: premium commercial image gate failed.`);
  const videoResult = await buildEtsyListingVideos({ imagesDirectory: imagesRoot, outputDirectory: videosRoot, generatedAt });
  if (videoResult.manifest.status !== 'PASS') throw new Error(`${scenario.id}: Etsy video gate failed.`);

  const zipDate = new Date(generatedAt);
  const guidesArchive = new JSZip();
  const guidePaths = [];
  for (const [path, file] of dark.package.files) {
    if (!path.startsWith('customer/') && path !== 'qa/compatibility-report.json' && path !== 'qa/google-sheets-readiness-report.json') continue;
    guidesArchive.file(path, file.bytes, { binary: true, createFolders: false, date: zipDate });
    guidePaths.push(path);
  }
  if (guidePaths.length < 6) throw new Error(`${scenario.id}: buyer guide archive is incomplete.`);
  const guidesBytes = await guidesArchive.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 9 }, platform: 'DOS', streamFiles: false });
  const verifiedGuides = await JSZip.loadAsync(guidesBytes);
  if (Object.values(verifiedGuides.files).filter(entry => !entry.dir).length !== guidePaths.length) throw new Error(`${scenario.id}: buyer guide ZIP verification failed.`);

  const localeSlug = scenario.locale.toLowerCase();
  const uploadDefinitions = [
    { filename: `budget-os-${localeSlug}-excel-light.xlsx`, bytes: light.workbook.bytes, purpose: 'Excel light edition' },
    { filename: `budget-os-${localeSlug}-excel-dark.xlsx`, bytes: dark.workbook.bytes, purpose: 'Excel dark edition' },
    { filename: `budget-os-${localeSlug}-sheets-light.xlsx`, bytes: light.workbook.bytes, purpose: 'Google Sheets import-ready light edition' },
    { filename: `budget-os-${localeSlug}-sheets-dark.xlsx`, bytes: dark.workbook.bytes, purpose: 'Google Sheets import-ready dark edition' },
    { filename: `budget-os-${localeSlug}-guides.zip`, bytes: guidesBytes, purpose: 'Quick start, support, license and compatibility evidence' },
  ];
  const uploadFiles = [];
  for (const file of uploadDefinitions) {
    const path = `etsy-upload/${file.filename}`;
    await write(resolve(scenarioRoot, ...path.split('/')), file.bytes);
    uploadFiles.push({ filename: file.filename, path, purpose: file.purpose, bytes: file.bytes.byteLength, sha256: await sha256Hex(file.bytes) });
  }
  const etsyUploadPlan = validateEtsyDigitalUploadPlan(uploadFiles);
  if (etsyUploadPlan.fileCount !== 5) throw new Error(`${scenario.id}: Etsy buyer upload plan must use the validated five-file layout.`);
  const etsyUploadPlanBytes = new TextEncoder().encode(`${JSON.stringify(etsyUploadPlan, null, 2)}\n`);
  await write(resolve(scenarioRoot, 'qa', 'etsy-upload-plan.json'), etsyUploadPlanBytes);
  const strategy = dark.package.listing.commercialStrategy;
  const raceControl = buildEtsyRaceControlBundle({ profile: strategy, locale: scenario.locale, currency: scenario.currency, generatedAt });

  const fileIndex = [];
  const archive = new JSZip();
  const add = async (path, bytes) => {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(await readFile(bytes));
    archive.file(path, data, { binary: true, createFolders: false, date: zipDate, ...(path.endsWith('.png') || path.endsWith('.mp4') ? { compression: 'STORE' } : {}) });
    fileIndex.push({ path, bytes: data.byteLength, sha256: await sha256Hex(data) });
  };
  for (const file of productFiles) await add(file.path, file.bytes);
  for (const image of premiumImages.images) await add(`listing/images/${image.filename}`, image.bytes);
  await add('qa/premium-listing-image-manifest.json', premiumImages.manifestPath);
  for (const video of videoResult.videos) await add(`listing/videos/${video.filename}`, video.path);
  await add('qa/etsy-upload-plan.json', etsyUploadPlanBytes);
  for (const [path, content] of raceControl.files) {
    const bytes = new TextEncoder().encode(content);
    await write(resolve(scenarioRoot, ...path.split('/')), bytes);
    await add(path, bytes);
  }
  for (const [path, file] of dark.package.files) {
    if (path.startsWith('listing/images/') || path.startsWith('images/') || path.startsWith('product/') || path === 'manifest.json') continue;
    await add(path, file.bytes);
  }
  const zipFilename = `ultimate-budget-os-${scenario.locale}-seller-launch-kit.zip`;
  const manifest = {
    schemaVersion: '1.0.0',
    status: 'READY_FOR_ETSY_REVIEW',
    generatedAt,
    factoryVersion: FACTORY_VERSION,
    locale: scenario.locale,
    currency: scenario.currency,
    productId: dark.definition.id,
    productVersion: dark.definition.version,
    deliverables: { workbooks: 4, buyerUploadFiles: etsyUploadPlan.fileCount, listingImages: premiumImages.images.length, listingVideos: videoResult.videos.length, sellerRaceControlFiles: raceControl.files.size, tags: strategy.tags.length },
    compatibility: { excel: 'WORKBOOK_VALIDATION_PASS', googleSheets: 'IMPORT_READY_STRUCTURAL_PASS', nativeGoogleImportVerified: false },
    etsyUploadPlan,
    sellerKit: { purpose: 'SELLER_INTERNAL_NOT_FOR_BUYER_UPLOAD', filename: zipFilename, includes: ['product source files', 'listing copy', '20 listing images', '2 listing videos', 'offline Etsy Race Control', 'commercial and technical QA evidence'] },
    commercialQa: { status: premiumImages.manifest.status, renderer: premiumImages.manifest.renderer, workbookSha256: premiumImages.manifest.sourceWorkbookSha256, bannedTokenCount: premiumImages.manifest.checks.reduce((sum, check) => sum + check.banned.length, 0), clippedElementCount: premiumImages.manifest.checks.reduce((sum, check) => sum + check.clipped.length, 0) },
    commercial: { title: strategy.title, priceExperiment: strategy.priceExperiment, bundleLadder: strategy.bundleLadder, supportPromise: strategy.supportPromise },
    raceControl: { status: raceControl.plan.status, version: raceControl.plan.raceControlVersion, experimentCount: raceControl.plan.experiments.length, dashboard: 'seller/race-control/race-control-dashboard.html', customerDataAllowed: raceControl.plan.privacy.customerDataAllowed },
    files: fileIndex,
  };
  const manifestBytes = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
  archive.file('launch-manifest.json', manifestBytes, { binary: true, createFolders: false, date: zipDate });
  const zipBytes = await archive.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 }, platform: 'DOS', streamFiles: false });
  const verified = await JSZip.loadAsync(zipBytes);
  const expectedCount = fileIndex.length + 1;
  if (Object.values(verified.files).filter(entry => !entry.dir).length !== expectedCount) throw new Error(`${scenario.id}: launch ZIP entry verification failed.`);
  await write(resolve(scenarioRoot, 'launch-manifest.json'), manifestBytes);
  await write(resolve(scenarioRoot, zipFilename), zipBytes);
  return { scenario: scenario.id, status: manifest.status, root: scenarioRoot, zipFilename, zipBytes: zipBytes.byteLength, deliverables: manifest.deliverables };
}

if (localeFilter && !SCENARIOS.some(scenario => scenario.id === localeFilter)) throw new Error(`Unsupported --locale value: ${localeFilter}.`);
if (replaceExisting) await rm(outputRoot, { recursive: true, force: true });
else if (await exists(outputRoot) && !localeFilter) throw new Error(`Output already exists: ${outputRoot}. Re-run with --replace to regenerate it.`);
await mkdir(outputRoot, { recursive: true });
const results = [];
for (const scenario of SCENARIOS) {
  if (!localeFilter || localeFilter === scenario.id) {
    results.push(await createLaunchKit(scenario));
    continue;
  }
  const existingManifestPath = resolve(outputRoot, scenario.id, 'launch-manifest.json');
  if (!await exists(existingManifestPath)) continue;
  const manifest = JSON.parse(await readFile(existingManifestPath, 'utf8'));
  const zipFilename = `ultimate-budget-os-${scenario.id}-seller-launch-kit.zip`;
  const zipInfo = await stat(resolve(outputRoot, scenario.id, zipFilename));
  results.push({ scenario: scenario.id, status: manifest.status, root: resolve(outputRoot, scenario.id), zipFilename, zipBytes: zipInfo.size, deliverables: manifest.deliverables });
}
const summaryStatus = results.length === SCENARIOS.length && results.every(item => item.status === 'READY_FOR_ETSY_REVIEW') ? 'PASS' : 'PARTIAL';
const summary = { schemaVersion: '1.0.0', status: summaryStatus, generatedAt, primaryLocale: 'en-US', secondaryLocale: 'nl-NL', results };
await write(resolve(outputRoot, 'release-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
