import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {
  ACTIVE_PRODUCT_IDS,
  BETA_PRODUCT_IDS,
  COVERING_GENERATION_CASE_COUNT,
  DEFAULT_GENERATED_AT,
  MATRIX_CASE_COUNT,
  REQUIRED_CORE_SALES_WORKBOOKS,
  REQUIRED_LISTING_IMAGE_PATHS,
  REQUIRED_PRODUCTION_LOCALE_IDS,
  REQUIRED_RELEASE_SCENARIOS,
  buildCoveringGenerationCases,
  configurationForMatrixCase,
  configurationForReleaseScenario,
  createProductionFactory,
  validateFullPreflightMatrix,
  validateProductionMatrix,
  verifyCatalogVisibility,
  verifyWorkbookArtifact,
  verifyPackageArtifact,
  inspectPngArtifact,
} from '../scripts/validate-production-matrix.mjs';
import { validateContract } from '../src/contracts/index.js';
import { currencyIds } from '../src/currencies/index.mjs';
import { productionLocaleIds } from '../src/locales/index.mjs';
import { themeIds } from '../src/themes/index.mjs';

const EXPECTED_ACTIVE_PRODUCTS = Object.freeze([
  'budget-planner-basic',
  'budget-planner-professional',
  'budget-planner-ultimate',
  'monthly-budget-planner',
  'debt-snowball-planner',
  'savings-goal-tracker',
  'subscription-tracker',
]);
const EXPECTED_HIDDEN_BETA_PRODUCTS = Object.freeze([
  'annual-budget-planner',
  'debt-avalanche-planner',
  'sinking-funds-planner',
  'bill-payment-calendar',
  'net-worth-tracker',
  'side-hustle-profit-tracker',
  'small-business-income-expense-tracker',
]);
const EXPECTED_MATRIX_DIGEST = '98be49d9319f098cc8e9b6220ccfff967efa09854f7ff5a15547041447b13de1';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertContract(contract, value, context) {
  const report = validateContract(contract, value);
  assert.equal(report.valid, true, `${context} ${contract}: ${JSON.stringify(report.issues)}`);
}

function diskPath(root, portablePath) {
  return path.join(root, ...portablePath.split('/'));
}

async function snapshotFiles(root, portablePaths) {
  const snapshot = new Map();
  for (const portablePath of portablePaths) {
    const bytes = await readFile(diskPath(root, portablePath));
    snapshot.set(portablePath, { bytes: bytes.byteLength, sha256: sha256(bytes) });
  }
  return snapshot;
}

function semanticEvidence(evidence) {
  return {
    schemaVersion: evidence.schemaVersion,
    generatedAt: evidence.generatedAt,
    generator: evidence.generator,
    policy: evidence.policy,
    visibility: evidence.visibility,
    matrix: evidence.matrix,
    salesSet: {
      status: evidence.salesSet.status,
      workbookCount: evidence.salesSet.workbookCount,
      archiveFilename: evidence.salesSet.archiveFilename,
      relativeDirectory: evidence.salesSet.relativeDirectory,
      workbooks: evidence.salesSet.workbooks.map(({ scenarioId, path: workbookPath, sourceFilename, sheets }) => ({ scenarioId, path: workbookPath, sourceFilename, sheets })),
    },
    products: evidence.products.map(product => {
      const { bytes: _workbookBytes, sha256: _workbookSha, ...workbook } = product.workbook;
      const { bytes: _packageBytes, sha256: _packageSha, ...packageArtifact } = product.package;
      return {
        scenarioId: product.scenarioId,
        productId: product.productId,
        productVersion: product.productVersion,
        relativeDirectory: product.relativeDirectory,
        configuration: product.configuration,
        gates: product.gates,
        workbook,
        package: packageArtifact,
        artifacts: product.artifacts.map(({ kind, path: artifactPath }) => ({ kind, path: artifactPath })),
      };
    }),
  };
}

test('active catalog visibility and all appearance-aware production preflight variants are deterministic', { timeout: 90_000 }, () => {
  assert.deepEqual(ACTIVE_PRODUCT_IDS, EXPECTED_ACTIVE_PRODUCTS);
  assert.deepEqual(BETA_PRODUCT_IDS, EXPECTED_HIDDEN_BETA_PRODUCTS);
  const factory = createProductionFactory();
  const visibility = verifyCatalogVisibility(factory);
  assert.deepEqual(visibility.activeProductIds, EXPECTED_ACTIVE_PRODUCTS);
  assert.deepEqual(visibility.hiddenBetaProductIds, EXPECTED_HIDDEN_BETA_PRODUCTS);

  const matrix = validateFullPreflightMatrix(factory);
  assert.equal(matrix.caseCount, MATRIX_CASE_COUNT);
  assert.equal(matrix.caseCount, 1440);
  assert.equal(matrix.digest, EXPECTED_MATRIX_DIGEST);
  assert.deepEqual(matrix.dimensions, { products: 7, locales: 4, currencies: 6, themes: 6, appearances: 2 });
  assert.deepEqual(productionLocaleIds, REQUIRED_PRODUCTION_LOCALE_IDS);
});

test('28 covering smoke variants generate contract-valid XLSX files that survive independent re-read', { timeout: 240_000 }, async () => {
  const factory = createProductionFactory();
  const cases = buildCoveringGenerationCases();
  assert.equal(cases.length, COVERING_GENERATION_CASE_COUNT);
  assert.equal(cases.length, 28);
  assert.equal(new Set(cases.map(item => `${item.productId}|${item.locale}`)).size, 28);
  assert.deepEqual(new Set(cases.map(item => item.productId)), new Set(ACTIVE_PRODUCT_IDS));
  assert.deepEqual(new Set(cases.map(item => item.locale)), new Set(productionLocaleIds));
  assert.deepEqual(new Set(cases.map(item => item.currency)), new Set(currencyIds));
  assert.deepEqual(new Set(cases.map(item => item.themeId)), new Set(themeIds));
  assert.deepEqual(new Set(cases.map(item => item.appearance)), new Set(['light', 'dark']));

  let deterministicFixture = null;
  for (const matrixCase of cases) {
    const configuration = configurationForMatrixCase(factory, matrixCase, { packageOutput: false, sampleDataEnabled: true });
    assertContract('ProductConfiguration', configuration, matrixCase.id);
    let result;
    try {
      result = await factory.generate(configuration, { ExcelJS, JSZip, generatedAt: DEFAULT_GENERATED_AT });
    } catch (error) {
      error.message = `${matrixCase.id}: ${error.message}`;
      throw error;
    }
    assert.equal(result.package, null, `${matrixCase.id} unexpectedly built a package.`);
    assert.equal(result.validationReport.status, 'PASS', `${matrixCase.id}: ${JSON.stringify(result.validationReport.issues)}`);
    assert.equal(result.qualityReport.status, 'PASS', `${matrixCase.id}: ${JSON.stringify(result.qualityReport.recommendations)}`);
    assert.equal(result.compatibilityReport.status, 'PARTIAL', `${matrixCase.id} must not claim native compatibility evidence.`);
    assertContract('ProductDefinition', result.definition, matrixCase.id);
    assertContract('ValidationReport', result.validationReport, matrixCase.id);
    assertContract('QualityReport', result.qualityReport, matrixCase.id);
    assertContract('CompatibilityReport', result.compatibilityReport, matrixCase.id);

    const workbookEvidence = await verifyWorkbookArtifact(result, factory);
    assert.ok(workbookEvidence.bytes > 10_000, `${matrixCase.id} produced an implausibly small workbook.`);
    assert.ok(workbookEvidence.formulas > 0, `${matrixCase.id} contains no formulas.`);
    assert.ok(workbookEvidence.validations > 0, `${matrixCase.id} contains no data validation.`);
    assert.ok(workbookEvidence.unlockedInputCells > 0, `${matrixCase.id} contains no unlocked input cells.`);
    assert.match(workbookEvidence.sha256, /^[a-f0-9]{64}$/u);
    if (!deterministicFixture) deterministicFixture = { matrixCase, configuration, semanticSha256: workbookEvidence.semanticSha256 };
  }

  const repeated = await factory.generate(deterministicFixture.configuration, { ExcelJS, JSZip, generatedAt: DEFAULT_GENERATED_AT });
  const repeatedEvidence = await verifyWorkbookArtifact(repeated, factory);
  assert.equal(repeatedEvidence.semanticSha256, deterministicFixture.semanticSha256, `${deterministicFixture.matrixCase.id} is not semantically deterministic.`);
});

test('release validation fails closed for a missing or tampered physical listing PNG', { timeout: 180_000 }, async () => {
  const factory = createProductionFactory();
  const scenario = REQUIRED_RELEASE_SCENARIOS[0];
  const configuration = configurationForReleaseScenario(factory, scenario, { packageOutput: true, sampleDataEnabled: true });
  const result = await factory.generate(configuration, {
    ExcelJS,
    JSZip,
    generatedAt: DEFAULT_GENERATED_AT,
    allowSyntheticListingImagesForReview: true,
  });
  const workbookEvidence = await verifyWorkbookArtifact(result, factory);
  const verified = await verifyPackageArtifact(result, workbookEvidence);
  assert.equal(verified.listingImages.status, 'PASS');
  assert.equal(verified.listingImages.count, REQUIRED_LISTING_IMAGE_PATHS.length);

  const imagePath = REQUIRED_LISTING_IMAGE_PATHS[0];
  const validArchive = await JSZip.loadAsync(result.package.zipBytes);
  const validImage = await validArchive.file(imagePath).async('uint8array');
  const validInspection = inspectPngArtifact(validImage);
  assert.ok(validInspection.width >= 2000 && validInspection.width > validInspection.height);

  const missingArchive = await JSZip.loadAsync(result.package.zipBytes);
  missingArchive.remove(imagePath);
  const missingBytes = await missingArchive.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 }, platform: 'DOS', streamFiles: false });
  await assert.rejects(
    verifyPackageArtifact({ ...result, package: { ...result.package, zipBytes: missingBytes } }, workbookEvidence),
    /missing.*(?:listing image|required entry|listing\/images)|file map differs/iu,
  );

  const tamperedArchive = await JSZip.loadAsync(result.package.zipBytes);
  const tamperedImage = Uint8Array.from(validImage);
  tamperedImage[Math.floor(tamperedImage.length / 2)] ^= 0x01;
  tamperedArchive.file(imagePath, tamperedImage, { binary: true, createFolders: false, date: new Date(DEFAULT_GENERATED_AT) });
  const tamperedBytes = await tamperedArchive.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 }, platform: 'DOS', streamFiles: false });
  await assert.rejects(
    verifyPackageArtifact({ ...result, package: { ...result.package, zipBytes: tamperedBytes } }, workbookEvidence),
    /PNG|CRC|checksum|file metadata/iu,
  );

  assert.throws(() => inspectPngArtifact(Buffer.from('not-a-png', 'utf8')), /valid PNG/iu);
});

test('production runner writes seven required tier, locale, and appearance packages with strict evidence hierarchy', { timeout: 900_000 }, async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'fpf-production-matrix-'));
  const normalizedTemp = `${path.resolve(os.tmpdir())}${path.sep}`.toLocaleLowerCase('en-US');
  assert.ok(`${path.resolve(outputRoot)}${path.sep}`.toLocaleLowerCase('en-US').startsWith(normalizedTemp), 'Temporary output escaped the OS temp directory.');
  try {
    const first = await validateProductionMatrix({ outputRoot, generatedAt: DEFAULT_GENERATED_AT });
    assert.equal(first.evidence.matrix.caseCount, MATRIX_CASE_COUNT);
    assert.equal(first.evidence.matrix.coveringGenerationCasesDefined, COVERING_GENERATION_CASE_COUNT);
    assert.equal(first.evidence.matrix.requiredReleaseScenarios, REQUIRED_RELEASE_SCENARIOS.length);
    assert.equal(first.evidence.matrix.canonicalPackages, REQUIRED_RELEASE_SCENARIOS.length);
    assert.equal(first.evidence.products.length, REQUIRED_RELEASE_SCENARIOS.length);
    assert.equal(first.evidence.salesSet.status, 'PASS');
    assert.equal(first.evidence.salesSet.workbookCount, REQUIRED_CORE_SALES_WORKBOOKS.length);
    assert.deepEqual(first.evidence.policy, {
      nativeExcelEvidence: false,
      browserEvidence: false,
      expectedCompatibilityStatus: 'PARTIAL',
      expectedReleaseStatus: 'DRAFT',
      determinism: 'SEMANTIC_CONTENT',
      protectionSalts: 'RANDOM_PER_GENERATION',
    });

    const rootEntries = await readdir(outputRoot, { withFileTypes: true });
    assert.ok(rootEntries.some(entry => entry.isDirectory() && entry.name === 'sales-set'), 'Core sales-set directory is missing.');
    const generatedProductDirectories = rootEntries.filter(entry => entry.isDirectory() && entry.name !== 'sales-set').map(entry => entry.name).sort();
    assert.deepEqual(generatedProductDirectories, REQUIRED_RELEASE_SCENARIOS.map(scenario => scenario.id).sort());
    assert.equal(generatedProductDirectories.some(productId => EXPECTED_HIDDEN_BETA_PRODUCTS.includes(productId)), false);

    const portableArtifactPaths = [
      'production-matrix-evidence.json',
      'sales-set/finance-product-factory-master-sales-set.zip',
      'sales-set/sales-set-evidence.json',
      ...REQUIRED_CORE_SALES_WORKBOOKS.map(requirement => `sales-set/products/${requirement.filename}`),
    ];
    const salesSetZipBytes = await readFile(diskPath(outputRoot, 'sales-set/finance-product-factory-master-sales-set.zip'));
    assert.equal(sha256(salesSetZipBytes), first.evidence.salesSet.archiveSha256);
    const salesSetArchive = await JSZip.loadAsync(salesSetZipBytes);
    const salesSetPaths = Object.keys(salesSetArchive.files).filter(entry => !salesSetArchive.files[entry].dir).sort();
    assert.deepEqual(salesSetPaths, REQUIRED_CORE_SALES_WORKBOOKS.map(requirement => `products/${requirement.filename}`).sort());
    for (const requirement of REQUIRED_CORE_SALES_WORKBOOKS) {
      const evidence = first.evidence.salesSet.workbooks.find(item => item.scenarioId === requirement.scenarioId);
      assert.ok(evidence, `Core sales-set evidence is missing '${requirement.scenarioId}'.`);
      const diskBytes = await readFile(diskPath(outputRoot, `sales-set/products/${requirement.filename}`));
      const zipBytes = await salesSetArchive.file(`products/${requirement.filename}`).async('uint8array');
      assert.equal(sha256(diskBytes), evidence.sha256);
      assert.equal(sha256(zipBytes), evidence.sha256);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(zipBytes);
      assert.equal(workbook.worksheets.length, evidence.sheets);
    }
    for (const product of first.evidence.products) {
      assert.equal(product.gates.validation, 'PASS');
      assert.equal(product.gates.quality, 'PASS');
      assert.equal(product.gates.compatibility, 'PARTIAL');
      assert.equal(product.gates.release, 'DRAFT');
      assert.equal(product.package.listingImages.status, 'PASS');
      assert.equal(product.package.listingImages.count, REQUIRED_LISTING_IMAGE_PATHS.length);
      assert.equal(product.package.listingImages.uniqueHashes, REQUIRED_LISTING_IMAGE_PATHS.length);
      const scenario = REQUIRED_RELEASE_SCENARIOS.find(item => item.id === product.scenarioId);
      assert.ok(scenario, `Unknown release scenario '${product.scenarioId}'.`);
      assert.equal(product.productId, scenario.productId);
      assert.equal(product.configuration.tier, scenario.tier);
      assert.equal(product.configuration.appearance, scenario.appearance);
      assert.match(product.relativeDirectory, new RegExp(`^${scenario.id}/${product.productVersion}/[a-z]{2}-[A-Z]{2}-[A-Z]{3}-[a-z-]+-(?:light|dark)$`, 'u'));

      const workbookRecord = product.artifacts.find(artifact => artifact.kind === 'workbook');
      const packageRecord = product.artifacts.find(artifact => artifact.kind === 'package');
      assert.ok(workbookRecord, `${product.productId} has no workbook artifact record.`);
      assert.ok(packageRecord, `${product.productId} has no package artifact record.`);
      portableArtifactPaths.push(...product.artifacts.map(artifact => artifact.path));
      portableArtifactPaths.push(`${product.relativeDirectory}/artifact-evidence.json`);

      const artifactBytes = new Map();
      for (const artifact of product.artifacts) {
        const bytes = await readFile(diskPath(outputRoot, artifact.path));
        assert.equal(bytes.byteLength, artifact.bytes, `${artifact.path} byte count differs from evidence.`);
        assert.equal(sha256(bytes), artifact.sha256, `${artifact.path} checksum differs from evidence.`);
        artifactBytes.set(path.posix.basename(artifact.path), bytes);
      }
      const localEvidenceBytes = await readFile(diskPath(outputRoot, `${product.relativeDirectory}/artifact-evidence.json`));
      const localEvidence = JSON.parse(localEvidenceBytes.toString('utf8'));
      const { relativeDirectory, ...expectedLocalEvidence } = product;
      assert.deepEqual(localEvidence, expectedLocalEvidence);

      const persistedContracts = [
        ['configuration.json', 'ProductConfiguration'],
        ['validation-report.json', 'ValidationReport'],
        ['quality-report.json', 'QualityReport'],
        ['compatibility-report.json', 'CompatibilityReport'],
        ['image-production-manifest.json', 'ImageProductionManifest'],
        ['generated-product-manifest.json', 'GeneratedProductManifest'],
        ['release-manifest.json', 'ReleaseManifest'],
      ];
      const persistedJson = new Map();
      for (const [filename, contract] of persistedContracts) {
        const value = JSON.parse(artifactBytes.get(filename).toString('utf8'));
        assertContract(contract, value, `${product.productId}/${filename}`);
        persistedJson.set(filename, value);
      }

      const workbookBytes = artifactBytes.get(path.posix.basename(workbookRecord.path));
      const packageBytes = artifactBytes.get(path.posix.basename(packageRecord.path));

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(workbookBytes);
      assert.equal(workbook.worksheets.length, product.workbook.sheets);
      let formulaCount = 0;
      let brokenFormulaCount = 0;
      for (const worksheet of workbook.worksheets) {
        worksheet.eachRow({ includeEmpty: false }, row => row.eachCell({ includeEmpty: false }, cell => {
          const formula = cell.formula ?? cell.value?.formula;
          const mergedFollower = cell.isMerged && cell.master?.address !== cell.address;
          if (!formula || mergedFollower) return;
          formulaCount += 1;
          if (/#REF!/iu.test(formula)) brokenFormulaCount += 1;
        }));
      }
      assert.equal(formulaCount, product.workbook.formulas);
      assert.equal(brokenFormulaCount, 0);

      const archive = await JSZip.loadAsync(packageBytes);
      const archivedImagePaths = Object.keys(archive.files).filter(entry => /^listing\/images\/[^/]+\.png$/u.test(entry)).sort();
      assert.deepEqual(archivedImagePaths, [...REQUIRED_LISTING_IMAGE_PATHS].sort());
      assert.ok(archive.file('manifest.json'), `${product.scenarioId} has no root manifest.json.`);
      const packagedWorkbook = await archive.file(`product/${path.basename(workbookRecord.path)}`).async('uint8array');
      assert.equal(packagedWorkbook.byteLength, workbookBytes.byteLength);
      assert.equal(sha256(packagedWorkbook), sha256(workbookBytes));
      const generatedManifest = JSON.parse(await archive.file('qa/generated-product-manifest.json').async('string'));
      const releaseManifest = JSON.parse(await archive.file('qa/release-manifest.json').async('string'));
      const imageManifest = JSON.parse(await archive.file('images/image-production-manifest.json').async('string'));
      const validationReport = JSON.parse(await archive.file('qa/validation-report.json').async('string'));
      const qualityReport = JSON.parse(await archive.file('qa/quality-report.json').async('string'));
      const compatibilityReport = JSON.parse(await archive.file('qa/compatibility-report.json').async('string'));
      assertContract('GeneratedProductManifest', generatedManifest, product.productId);
      assertContract('ReleaseManifest', releaseManifest, product.productId);
      assertContract('ImageProductionManifest', imageManifest, product.productId);
      assertContract('ValidationReport', validationReport, product.productId);
      assertContract('QualityReport', qualityReport, product.productId);
      assertContract('CompatibilityReport', compatibilityReport, product.productId);
      assert.deepEqual(generatedManifest, persistedJson.get('generated-product-manifest.json'));
      assert.deepEqual(releaseManifest, persistedJson.get('release-manifest.json'));
      assert.deepEqual(imageManifest, persistedJson.get('image-production-manifest.json'));
      assert.deepEqual(validationReport, persistedJson.get('validation-report.json'));
      assert.deepEqual(qualityReport, persistedJson.get('quality-report.json'));
      assert.deepEqual(compatibilityReport, persistedJson.get('compatibility-report.json'));
      assert.equal(generatedManifest.productId, product.productId);
      assert.equal(generatedManifest.releaseStatus, 'DRAFT');
      assert.equal(releaseManifest.status, 'DRAFT');
    }

    const firstEvidenceBytes = await readFile(first.evidencePath);
    const firstSnapshot = await snapshotFiles(outputRoot, portableArtifactPaths);

    const recoveryProduct = first.evidence.products[0];
    const recoveryTarget = diskPath(outputRoot, recoveryProduct.relativeDirectory);
    const recoveryParent = path.dirname(recoveryTarget);
    const recoveryBase = path.basename(recoveryTarget);
    const recoveryBackup = path.join(recoveryParent, `.${recoveryBase}.backup`);
    const recoveryStaging = path.join(recoveryParent, `.${recoveryBase}.staging`);
    await rename(recoveryTarget, recoveryBackup);
    await mkdir(recoveryStaging);
    await writeFile(path.join(recoveryStaging, 'interrupted-write.bin'), Buffer.from('incomplete'));

    const second = await validateProductionMatrix({ outputRoot, generatedAt: DEFAULT_GENERATED_AT });
    const secondEvidenceBytes = await readFile(second.evidencePath);
    const secondSnapshot = await snapshotFiles(outputRoot, portableArtifactPaths);
    const recoveryEntries = await readdir(recoveryParent);
    assert.equal(recoveryEntries.includes(path.basename(recoveryBackup)), false, 'Recovery backup was not cleaned.');
    assert.equal(recoveryEntries.includes(path.basename(recoveryStaging)), false, 'Interrupted staging directory was not cleaned.');
    assert.deepEqual(semanticEvidence(second.evidence), semanticEvidence(first.evidence), 'Canonical artifacts are not semantically deterministic.');
    assert.deepEqual(JSON.parse(secondEvidenceBytes.toString('utf8')), second.evidence, 'Second aggregate evidence does not match disk state.');
    assert.deepEqual(JSON.parse(firstEvidenceBytes.toString('utf8')), first.evidence, 'First aggregate evidence does not match disk state.');
    for (const product of second.evidence.products) {
      for (const artifact of product.artifacts) {
        assert.deepEqual(secondSnapshot.get(artifact.path), { bytes: artifact.bytes, sha256: artifact.sha256 }, `${artifact.path} does not match second-run evidence.`);
      }
    }
    const stableArtifactNames = new Set([
      'configuration.json',
      'quality-report.json',
      'compatibility-report.json',
    ]);
    for (const [artifactPath, snapshot] of firstSnapshot) {
      if (stableArtifactNames.has(path.posix.basename(artifactPath))) assert.deepEqual(secondSnapshot.get(artifactPath), snapshot, `${artifactPath} changed despite stable semantic inputs.`);
    }
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
