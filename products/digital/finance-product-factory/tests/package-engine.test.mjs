import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import JSZip from 'jszip';
import { buildCommercialPackage } from '../src/commercial/package-engine.js';
import { LISTING_IMAGE_PATHS, inspectListingPng } from '../src/commercial/listing-image-engine.js';
import { validateContract } from '../src/contracts/index.js';
import { localeCatalog } from '../src/locales/index.mjs';
import { themeCatalog } from '../src/themes/index.mjs';

const TIMESTAMP = '2026-07-15T10:30:00.000Z';
const XLSX_MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const REQUIRED_MOCKUP_SHOTS = ['laptop', 'desktop', 'tablet', 'dashboard-close-up', 'data-sheet-close-up', 'workbook-tabs', 'quick-start-guide', 'product-bundle'];

function workbookFixture() {
  const bytes = new Uint8Array(4_096);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (index * 31 + 17) % 256;
  bytes.set([0x50, 0x4b, 0x03, 0x04], 0);
  return bytes;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function makeFixture() {
  const configuration = {
    schemaVersion: '1.0.0',
    productId: 'budget-planner-basic',
    productVersion: '1.0.0',
    locale: 'en-US',
    market: 'US',
    currency: 'USD',
    year: 2026,
    themeId: 'executive-navy',
    title: 'Configured Workbook Title',
    filename: 'Budget_Planner_Basic.xlsx',
    categoryOverrides: [],
    featureFlags: { sampleDashboard: true },
    branding: { enabled: true, brandName: 'NumberNinjaDesigns', colors: { accent: '#00FF94' } },
    sampleDataEnabled: true,
    inputCapacity: 100,
    outputOptions: { workbook: true, package: true, customerDocs: true, listing: true, imageManifests: true },
  };
  const validationRule = {
    schemaVersion: '1.0.0',
    id: 'date-valid',
    sheetId: 'income',
    columnId: 'date',
    type: 'date',
    required: true,
    severity: 'error',
  };
  const formula = {
    schemaVersion: '1.0.0',
    id: 'income-total',
    sheetId: 'income',
    target: 'D2',
    operation: 'SUM',
    parameters: { columnId: 'amount', startRow: 2 },
    fillDirection: 'down',
    inputRowsBound: true,
  };
  const sheet = {
    schemaVersion: '1.0.0',
    id: 'income',
    nameKey: 'sheets.income',
    type: 'input',
    order: 1,
    hidden: false,
    columns: [{
      schemaVersion: '1.0.0',
      id: 'date',
      labelKey: 'columns.date',
      type: 'date',
      width: 14,
      role: 'input',
      format: 'yyyy-mm-dd',
      validationId: 'date-valid',
      required: true,
    }],
    inputRows: 100,
    freeze: { rows: 1, columns: 0 },
    autoFilter: true,
    print: { orientation: 'landscape', paperSize: 'A4', fitToWidth: 1, fitToHeight: 0 },
    formulas: [formula],
    validations: [validationRule],
  };
  const definition = {
    schemaVersion: '1.0.0',
    id: configuration.productId,
    version: configuration.productVersion,
    status: 'active',
    productFamily: 'budgeting',
    category: 'personal-finance',
    nameKey: 'products.monthlyBudgetPlanner.name',
    descriptionKey: 'products.monthlyBudgetPlanner.description',
    saleType: 'spreadsheet',
    difficulty: 'beginner',
    tags: ['budget', 'monthly', 'household'],
    recommended: true,
    features: ['budget-vs-actual', 'category-analysis', 'monthly-totals'],
    supportedLocales: ['en-US'],
    supportedCurrencies: ['USD'],
    supportedThemes: ['executive-navy'],
    defaultConfiguration: structuredClone(configuration),
    configurableFields: [{
      id: 'input-capacity',
      type: 'integer',
      labelKey: 'configuration.inputCapacity',
      configurationPath: 'inputCapacity',
      defaultValue: 100,
      minimum: 10,
      maximum: 10_000,
      required: true,
    }],
    sheets: [sheet],
    formulas: [formula],
    validations: [validationRule],
    qualityRules: [
      { id: 'workbook-integrity', metric: 'workbook-integrity', weight: 0.6, threshold: 100, severity: 'blocker' },
      { id: 'commercial-readiness', metric: 'commercial-readiness', weight: 0.4, threshold: 85, severity: 'error' },
    ],
    commercialMetadata: {
      schemaVersion: '1.0.0',
      titleKey: 'products.budgetPlannerBasic.name',
      descriptionKey: 'products.budgetPlannerBasic.description',
      category: 'Finance & Money Management',
      targetAudience: ['households', 'budget beginners'],
      keywords: ['budget planner', 'expense tracker'],
      marketplaces: ['etsy', 'direct'],
      licenseKey: 'commercial.personalLicense',
      disclaimerKeys: ['commercial.digitalDownload', 'commercial.noFinancialAdvice'],
      listingAttributes: { digital: true, renewal: null },
    },
    imageSpecifications: [
      { id: 'primary-image', purpose: 'thumbnail', width: 2_000, height: 2_000, format: 'png', required: true, altTextKey: 'images.primary.alt' },
      { id: 'workflow-image', purpose: 'workflow', width: 3_000, height: 2_400, format: 'webp', required: false },
    ],
    compatibility: {
      targets: ['excel-desktop', 'excel-web'],
      minimumExcelVersion: '2019',
      requiresFormulaRecalculation: false,
      googleSheetsSupported: false,
      limitations: ['Google Sheets has not been verified.'],
    },
    exportProfile: {
      workbookFilenameTemplate: '{title}_{locale}_{currency}.xlsx',
      packageFilenameTemplate: '{productId}_{version}.zip',
      include: ['workbook', 'readme', 'license', 'manifest', 'listing', 'images', 'reports', 'source-manifests'],
    },
    generatorId: 'document-workbook',
  };
  const validationReport = {
    schemaVersion: '1.0.0',
    contract: 'WorkbookArtifact',
    status: 'PASS',
    valid: true,
    issues: [],
    summary: { errorCount: 0, blockerCount: 0 },
    generatedAt: TIMESTAMP,
    extensions: { stage: 'workbook', productId: definition.id, warnings: [], metrics: {}, details: [] },
  };
  const qualityReport = {
    schemaVersion: '1.0.0',
    productId: definition.id,
    productVersion: definition.version,
    status: 'PASS',
    score: 96,
    threshold: 85,
    components: [
      { id: 'integrity', score: 100, weight: 0.6, evidence: ['Workbook re-read passed.'] },
      { id: 'commercial', score: 90, weight: 0.4, evidence: ['Commercial assets are present.'] },
    ],
    recommendations: [],
    generatedAt: TIMESTAMP,
  };
  const compatibilityReport = {
    schemaVersion: '1.0.0',
    productId: definition.id,
    productVersion: definition.version,
    status: 'PASS',
    targets: [
      { target: 'excel-desktop', version: '2021', status: 'PASS', verified: true, checks: ['Workbook opened and recalculated.'], limitations: [] },
      { target: 'excel-web', version: null, status: 'PASS', verified: true, checks: ['Workbook opened.'], limitations: [] },
    ],
    generatedAt: TIMESTAMP,
  };

  return {
    definition,
    configuration,
    validationReport,
    qualityReport,
    compatibilityReport,
    theme: themeCatalog['executive-navy'],
    workbookBytes: workbookFixture(),
  };
}

function translate(key) {
  return localeCatalog['en-US'].messages[key] ?? key;
}

async function build(fixture = makeFixture()) {
  return buildCommercialPackage({
    ...fixture,
    translate,
    JSZip,
    factoryVersion: '2.4.1',
    generatedAt: TIMESTAMP,
    allowSyntheticListingImagesForReview: true,
  });
}

test('blocks synthetic listing images unless review-only generation is explicit', async () => {
  await assert.rejects(() => buildCommercialPackage({
    ...makeFixture(),
    translate,
    JSZip,
    factoryVersion: '2.4.1',
    generatedAt: TIMESTAMP,
  }), /source-truth listingImageProvider/);
});

test('builds contract-valid commercial manifests from current catalog shapes', async () => {
  const fixture = makeFixture();
  const result = await build(fixture);

  assert.equal(result.packageFilename, 'budget-planner-basic_1.0.0.zip');
  assert.equal(result.workbookFilename, 'Budget_Planner_Basic.xlsx');
  assert.equal(result.listing.primaryTitle, 'Budget Planner Basic');
  assert.equal(result.listing.descriptionKey, fixture.definition.commercialMetadata.descriptionKey);
  assert.deepEqual(result.listing.targetAudience, ['Households', 'Budget Beginners']);
  assert.deepEqual(result.listing.listingAttributes, { digital: true, renewal: null });
  assert.equal(result.listing.faq.length, 4);
  assert.deepEqual(result.listing.includedFiles, ['Budget_Planner_Basic.xlsx', 'README.html', 'QUICK_START.html', 'LICENSE.txt']);
  assert.equal(result.listing.pricePositioning.status, 'REVIEW_REQUIRED');
  assert.equal(result.listing.pricePositioning.suggestedAmount, null);
  assert.equal(result.listing.marketVariant, 'US');
  assert.equal(result.listing.localeVariant, 'en-US');
  assert.equal(result.listing.bundleSuggestions.length, 1);
  assert.equal(result.listing.upsellSuggestions.length, 1);
  assert.deepEqual(
    result.listing.features,
    fixture.definition.features.map(featureId => localeCatalog['en-US'].messages[`features.${featureId}`]),
  );
  assert.ok(result.listing.features.every((feature, index) => feature !== fixture.definition.features[index]));

  assert.deepEqual(result.imageManifest.extensions.themeDefinition.colors, fixture.theme.colors);
  assert.deepEqual(result.imageManifest.extensions.themeDefinition.fonts, fixture.theme.fonts);
  assert.deepEqual(result.imageManifest.extensions.themeDefinition.workbookStyles, fixture.theme.workbookStyles);
  assert.equal(result.imageManifest.assets.length, 20);
  assert.ok(result.imageManifest.assets.every(asset => asset.status === 'validated'));
  assert.deepEqual(result.imageManifest.assets.map(asset => asset.packagePath), LISTING_IMAGE_PATHS);
  assert.ok(result.imageManifest.assets.every(asset => asset.altText && asset.mediaType === 'image/png' && asset.bytes > 0));
  assert.deepEqual(result.imageManifest.extensions.requiredImages, result.imageManifest.assets.map(asset => asset.id));
  assert.deepEqual(result.imageManifest.extensions.exportFormats, ['png']);
  assert.equal(result.imageManifest.extensions.productionPolicy.executionClaim, 'GENERATED_AND_VALIDATED_IMAGE_ASSETS');
  assert.equal(result.imageValidation.status, 'PASS');
  assert.equal(result.imageValidation.imageCount, 20);
  assert.equal(result.rootManifest.status, 'VALIDATED_PACKAGE_INDEX');
  assert.ok(result.imageManifest.extensions.qualityRules.length >= 4);
  assert.equal(result.photoshopManifest.sourceAsset, null);
  assert.equal(result.photoshopManifest.sourceAssetRequired, true);
  assert.equal(result.photoshopManifest.executionClaim, 'PHOTOSHOP_PROCESSING_REQUIRED');
  assert.equal(result.releaseManifest.status, 'READY_FOR_REVIEW');
  assert.equal(result.releaseManifest.approvals.length, 0);

  for (const [contract, value] of [
    ['ImageProductionManifest', result.imageManifest],
    ['GeneratedProductManifest', result.generatedManifest],
    ['ReleaseManifest', result.releaseManifest],
  ]) {
    const report = validateContract(contract, value);
    assert.equal(report.valid, true, `${contract}: ${JSON.stringify(report.issues)}`);
  }

  assert.equal(result.generatedManifest.factoryVersion, '2.4.1');
  assert.deepEqual(result.generatedManifest.configuration, fixture.configuration);
  assert.match(result.generatedManifest.configurationHash, /^[a-f0-9]{64}$/);
  assert.equal(result.generatedManifest.releaseStatus, 'READY_FOR_REVIEW');
  assert.equal(result.generatedManifest.extensions.imageValidation.status, 'PASS');
  assert.equal(result.releaseManifest.status, 'READY_FOR_REVIEW');
  assert.equal(result.releaseManifest.extensions.imageValidation.status, 'PASS');
  assert.deepEqual(
    result.generatedManifest.sourceDefinitions.map(source => source.type),
    ['product-definition', 'product-configuration', 'theme-definition', 'commercial-metadata'],
  );
  assert.ok(result.generatedManifest.warnings.includes('Google Sheets has not been verified.'));
});

test('writes an offline, path-safe ZIP with verified payload checksums', async () => {
  const fixture = makeFixture();
  const result = await build(fixture);
  const archive = await JSZip.loadAsync(result.zipBytes);
  const archivePaths = Object.keys(archive.files).sort();
  const requiredPaths = [
    `product/${result.workbookFilename}`,
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
  ].sort();

  assert.equal(archivePaths.some(path => archive.files[path].dir), false);
  assert.equal(archivePaths.some(path => /^(?:[A-Za-z]:|[\\/])|(?:^|[\\/])\.\.(?:[\\/]|$)/.test(path)), false);
  assert.deepEqual(archivePaths, requiredPaths);
  assert.ok(archive.file('qa/generated-product-manifest.json'));
  assert.ok(archive.file('qa/release-manifest.json'));

  const workbookPath = `product/${result.workbookFilename}`;
  const packagedWorkbook = await archive.file(workbookPath).async('uint8array');
  assert.deepEqual(packagedWorkbook, fixture.workbookBytes);

  const manifestFromZip = JSON.parse(await archive.file('qa/generated-product-manifest.json').async('string'));
  const releaseFromZip = JSON.parse(await archive.file('qa/release-manifest.json').async('string'));
  const listingFromZip = JSON.parse(await archive.file('listing/listing-metadata.json').async('string'));
  const imageFromZip = JSON.parse(await archive.file('images/image-production-manifest.json').async('string'));
  const overlayFromZip = JSON.parse(await archive.file('images/copy-overlay-plan.json').async('string'));
  const shotsFromZip = JSON.parse(await archive.file('images/mockup-shot-list.json').async('string'));
  const rootFromZip = JSON.parse(await archive.file('manifest.json').async('string'));
  assert.deepEqual(manifestFromZip, result.generatedManifest);
  assert.deepEqual(releaseFromZip, result.releaseManifest);
  assert.deepEqual(listingFromZip, result.listing);
  assert.deepEqual(imageFromZip, result.imageManifest);
  assert.deepEqual(rootFromZip, result.rootManifest);
  assert.ok(overlayFromZip.images.every(image => image.bullets.length >= 1));
  assert.deepEqual(shotsFromZip.shots.map(shot => shot.shotType), REQUIRED_MOCKUP_SHOTS);
  assert.match(await archive.file('listing/faq.txt').async('string'), /physical product/i);
  assert.equal(manifestFromZip.files.length, archivePaths.length - 3);
  assert.deepEqual(manifestFromZip.files.map(file => file.path).sort(), requiredPaths.filter(path => !path.endsWith('generated-product-manifest.json') && !path.endsWith('release-manifest.json') && path !== 'manifest.json'));

  for (const path of LISTING_IMAGE_PATHS) {
    const bytes = await archive.file(path).async('uint8array');
    const inspection = await inspectListingPng(bytes, { JSZip });
    assert.equal(inspection.width, 2400);
    assert.equal(inspection.height, 1600);
    assert.equal(inspection.bitDepth, 8);
    assert.equal(inspection.colorType, 2);
  }
  assert.deepEqual((await archive.file('listing/alt-texts.txt').async('string')).trim().split('\n'), result.imageManifest.assets.map(asset => asset.altText));
  assert.deepEqual(
    (await archive.file('listing/features.txt').async('string')).trim().split('\n'),
    result.listing.features,
  );

  for (const [contract, path] of [
    ['ValidationReport', 'qa/validation-report.json'],
    ['QualityReport', 'qa/quality-report.json'],
    ['CompatibilityReport', 'qa/compatibility-report.json'],
    ['ImageProductionManifest', 'images/image-production-manifest.json'],
    ['GeneratedProductManifest', 'qa/generated-product-manifest.json'],
    ['ReleaseManifest', 'qa/release-manifest.json'],
  ]) {
    const value = JSON.parse(await archive.file(path).async('string'));
    const report = validateContract(contract, value);
    assert.equal(report.valid, true, `${contract} in ${path}: ${JSON.stringify(report.issues)}`);
  }

  for (const record of manifestFromZip.files) {
    const entry = archive.file(record.path);
    assert.ok(entry, `Missing ZIP payload ${record.path}`);
    const bytes = await entry.async('uint8array');
    assert.equal(bytes.byteLength, record.bytes);
    assert.equal(sha256(bytes), record.sha256);
    assert.equal(manifestFromZip.checksums[record.path], record.sha256);
  }
  assert.equal(manifestFromZip.files.find(file => file.path === workbookPath).mediaType, XLSX_MEDIA_TYPE);

  const unsafeLocation = /(?:https?|ftp|file):\/\/|[A-Za-z]:[\\/]|\\\\[^\\\s]+\\[^\\\s]+|(?:^|[\s"'=:])\/\/[A-Za-z0-9._-]+\/|\/(?:Users|home|root|tmp|var|etc|opt)(?:\/|\b)|\.\.[\\/]/i;
  for (const path of archivePaths.filter(path => !path.endsWith('.xlsx') && !path.endsWith('.png'))) {
    const content = await archive.file(path).async('string');
    assert.equal(unsafeLocation.test(content), false, `Unsafe location leaked through ${path}`);
  }
  const readme = await archive.file('customer/README.html').async('string');
  assert.match(readme, /Content-Security-Policy/);
  assert.doesNotMatch(readme, /<(?:script|link|iframe)\b/i);
});

test('generates byte-identical ZIP output for identical fixed inputs', async () => {
  const first = await build();
  const second = await build();

  assert.deepEqual(first.generatedManifest, second.generatedManifest);
  assert.deepEqual(first.zipBytes, second.zipBytes);
});

test('fails closed before images or ZIP output when a production gate fails', async () => {
  const fixture = makeFixture();
  fixture.validationReport = {
    ...fixture.validationReport,
    status: 'FAIL',
    valid: false,
    issues: [{
      code: 'WORKBOOK_INVALID',
      severity: 'blocker',
      path: '$.workbook',
      message: 'Workbook integrity verification failed.',
    }],
    summary: { errorCount: 0, blockerCount: 1 },
    extensions: {
      ...fixture.validationReport.extensions,
      warnings: ['Formula cache requires review.'],
    },
  };

  await assert.rejects(() => build(fixture), /requires passing validation, quality and compatibility gates/);
});

test('rejects unsafe locations, unsafe package templates and mismatched themes', async () => {
  const leakedConfiguration = makeFixture();
  leakedConfiguration.configuration.extensions = { sourcePath: 'C:\\Users\\operator\\private.xlsx' };
  await assert.rejects(() => build(leakedConfiguration), /external URL or unsafe filesystem location/);

  const unsafeTemplate = makeFixture();
  unsafeTemplate.definition.exportProfile.packageFilenameTemplate = 'exports/{productId}.zip';
  await assert.rejects(() => build(unsafeTemplate), /cannot contain path separators/);

  const mismatchedTheme = makeFixture();
  mismatchedTheme.theme = themeCatalog['modern-minimal'];
  await assert.rejects(() => build(mismatchedTheme), /does not match the configured theme/);
});
