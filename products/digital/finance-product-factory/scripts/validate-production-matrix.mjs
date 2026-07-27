import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { inflateSync } from 'node:zlib';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { LISTING_IMAGE_PATHS, validateListingImageSet } from '../src/commercial/listing-image-engine.js';
import { createFactoryRuntime } from '../src/factory-runtime.js';
import { validateContract } from '../src/contracts/index.js';
import { currencyCatalog, currencyIds } from '../src/currencies/index.mjs';
import { expectedSheetNames } from '../src/engines/workbook-engine.js';
import { localeCatalog, productionLocaleIds } from '../src/locales/index.mjs';
import {
  betaProductDefinitions,
  defaultVisibleProductDefinitions,
  productDefinitions,
  productionProductDefinitions,
} from '../src/products/index.mjs';
import { themeCatalog, themeIds } from '../src/themes/index.mjs';

export const DEFAULT_GENERATED_AT = '2026-07-15T00:00:00.000Z';
export const ACTIVE_PRODUCT_IDS = Object.freeze(productionProductDefinitions.map(definition => definition.id));
export const BETA_PRODUCT_IDS = Object.freeze(betaProductDefinitions.map(definition => definition.id));
export const REQUIRED_PRODUCTION_LOCALE_IDS = Object.freeze(['nl-NL', 'en-US', 'en-GB', 'de-DE']);
export const REQUIRED_LISTING_IMAGE_FILENAMES = Object.freeze([
  '01-hero.png',
  '02-dashboard-overview.png',
  '03-monthly-budget.png',
  '04-key-features.png',
  '05-light-dark-comparison.png',
  '06-whats-included.png',
  '07-language-currency-options.png',
  '08-how-it-works.png',
  '09-workbook-previews.png',
  '10-digital-download.png',
  '11-excel-google-sheets.png',
  '12-paycheck-planning.png',
  '13-debt-payoff.png',
  '14-savings-goals.png',
  '15-net-worth.png',
  '16-bill-subscriptions.png',
  '17-privacy-no-account.png',
  '18-support-promise.png',
  '19-buyer-fit.png',
  '20-value-stack.png',
]);
export const REQUIRED_LISTING_IMAGE_PATHS = Object.freeze(REQUIRED_LISTING_IMAGE_FILENAMES.map(filename => `listing/images/${filename}`));
export const REQUIRED_RELEASE_SCENARIOS = Object.freeze([
  Object.freeze({ id: 'basic-nl-light', productId: 'budget-planner-basic', tier: 'basic', locale: 'nl-NL', market: 'NL', currency: 'EUR', themeId: 'sage-finance', appearance: 'light' }),
  Object.freeze({ id: 'professional-nl-light', productId: 'budget-planner-professional', tier: 'professional', locale: 'nl-NL', market: 'NL', currency: 'EUR', themeId: 'sage-finance', appearance: 'light' }),
  Object.freeze({ id: 'professional-nl-dark', productId: 'budget-planner-professional', tier: 'professional', locale: 'nl-NL', market: 'NL', currency: 'EUR', themeId: 'sage-finance', appearance: 'dark' }),
  Object.freeze({ id: 'ultimate-nl-light', productId: 'budget-planner-ultimate', tier: 'ultimate', locale: 'nl-NL', market: 'NL', currency: 'EUR', themeId: 'sage-finance', appearance: 'light' }),
  Object.freeze({ id: 'ultimate-nl-dark', productId: 'budget-planner-ultimate', tier: 'ultimate', locale: 'nl-NL', market: 'NL', currency: 'EUR', themeId: 'sage-finance', appearance: 'dark' }),
  Object.freeze({ id: 'ultimate-de-light', productId: 'budget-planner-ultimate', tier: 'ultimate', locale: 'de-DE', market: 'DE', currency: 'EUR', themeId: 'sage-finance', appearance: 'light' }),
  Object.freeze({ id: 'ultimate-de-dark', productId: 'budget-planner-ultimate', tier: 'ultimate', locale: 'de-DE', market: 'DE', currency: 'EUR', themeId: 'sage-finance', appearance: 'dark' }),
]);
export const REQUIRED_CORE_SALES_WORKBOOKS = Object.freeze([
  Object.freeze({ scenarioId: 'basic-nl-light', filename: 'basic-light.xlsx' }),
  Object.freeze({ scenarioId: 'professional-nl-light', filename: 'professional-light.xlsx' }),
  Object.freeze({ scenarioId: 'professional-nl-dark', filename: 'professional-dark.xlsx' }),
  Object.freeze({ scenarioId: 'ultimate-nl-light', filename: 'ultimate-light.xlsx' }),
  Object.freeze({ scenarioId: 'ultimate-nl-dark', filename: 'ultimate-dark.xlsx' }),
]);

function productAppearances(definition) {
  const supported = definition.extensions?.supportedAppearances;
  if (Array.isArray(supported) && supported.length > 0) return supported;
  return [definition.defaultConfiguration?.extensions?.productAppearance ?? 'light'];
}

export const MATRIX_CASE_COUNT = productionProductDefinitions.reduce(
  (total, definition) => total + (productAppearances(definition).length * productionLocaleIds.length * currencyIds.length * themeIds.length),
  0,
);
export const COVERING_GENERATION_CASE_COUNT = ACTIVE_PRODUCT_IDS.length * productionLocaleIds.length;

const XLSX_MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const REQUIRED_PACKAGE_PATHS = Object.freeze([
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
  ...REQUIRED_LISTING_IMAGE_PATHS,
  'images/image-production-manifest.json',
  'qa/validation-report.json',
  'qa/quality-report.json',
  'qa/compatibility-report.json',
  'qa/premium-release-report.json',
  'qa/generated-product-manifest.json',
  'qa/release-manifest.json',
  'manifest.json',
]);
const REQUIRED_XLSX_PATHS = Object.freeze([
  '[Content_Types].xml',
  '_rels/.rels',
  'docProps/core.xml',
  'xl/workbook.xml',
  'xl/_rels/workbook.xml.rels',
  'xl/styles.xml',
]);
const WINDOWS_DEVICE_NAME = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu;
const MANIFEST_ONLY_PATHS = Object.freeze([
  'qa/generated-product-manifest.json',
  'qa/release-manifest.json',
  'manifest.json',
]);
const CONTRACTS = Object.freeze([
  ['ProductDefinition', result => result.definition],
  ['ProductConfiguration', result => result.configuration],
  ['ValidationReport', result => result.validationReport],
  ['QualityReport', result => result.qualityReport],
  ['CompatibilityReport', result => result.compatibilityReport],
  ['ImageProductionManifest', result => result.package?.imageManifest],
  ['GeneratedProductManifest', result => result.package?.generatedManifest],
  ['ReleaseManifest', result => result.package?.releaseManifest],
]);

function invariant(condition, message, details = {}) {
  if (condition) return;
  const error = new Error(message);
  error.name = 'ProductionMatrixValidationError';
  error.details = details;
  throw error;
}

function normalizeTimestamp(value) {
  const date = new Date(value);
  invariant(Number.isFinite(date.getTime()), `Invalid generation timestamp '${value}'.`);
  return date.toISOString();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_CRC_TABLE = Object.freeze(Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
}));

function pngCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function inspectPngArtifact(value, { minimumWidth = 2000, requireLandscape = true } = {}) {
  const bytes = Buffer.from(value ?? []);
  invariant(bytes.byteLength >= 45 && bytes.subarray(0, 8).equals(PNG_SIGNATURE), 'Listing image is not a valid PNG byte stream.');
  let offset = 8;
  let ihdr = null;
  let seenIend = false;
  const compressed = [];
  const chunks = [];
  while (offset < bytes.byteLength) {
    invariant(offset + 12 <= bytes.byteLength, 'PNG has a truncated chunk header.');
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    invariant(/^[A-Za-z]{4}$/u.test(type) && crcOffset + 4 <= bytes.byteLength, 'PNG has an invalid or truncated chunk.');
    const expectedCrc = bytes.readUInt32BE(crcOffset);
    const actualCrc = pngCrc32(bytes.subarray(offset + 4, dataEnd));
    invariant(expectedCrc === actualCrc, `PNG chunk '${type}' failed CRC validation.`);
    invariant(!seenIend, 'PNG contains data after IEND.');
    chunks.push(type);
    if (type === 'IHDR') {
      invariant(offset === 8 && length === 13 && !ihdr, 'PNG IHDR is missing, duplicated, or malformed.');
      ihdr = {
        width: bytes.readUInt32BE(dataStart),
        height: bytes.readUInt32BE(dataStart + 4),
        bitDepth: bytes[dataStart + 8],
        colorType: bytes[dataStart + 9],
        compression: bytes[dataStart + 10],
        filter: bytes[dataStart + 11],
        interlace: bytes[dataStart + 12],
      };
    } else if (type === 'IDAT') {
      compressed.push(bytes.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      invariant(length === 0, 'PNG IEND chunk must be empty.');
      seenIend = true;
    }
    offset = crcOffset + 4;
  }
  invariant(ihdr && seenIend && offset === bytes.byteLength && compressed.length > 0, 'PNG structure is incomplete.');
  invariant(ihdr.width >= minimumWidth && ihdr.height > 0, `PNG dimensions ${ihdr.width}x${ihdr.height} do not meet the release minimum.`);
  invariant(!requireLandscape || ihdr.width > ihdr.height, `PNG dimensions ${ihdr.width}x${ihdr.height} are not landscape.`);
  invariant(ihdr.bitDepth === 8 && [2, 6].includes(ihdr.colorType), 'PNG must use supported 8-bit RGB or RGBA pixels.');
  invariant(ihdr.compression === 0 && ihdr.filter === 0 && ihdr.interlace === 0, 'PNG uses unsupported compression, filtering, or interlace metadata.');
  const channels = ihdr.colorType === 6 ? 4 : 3;
  let inflated;
  try {
    inflated = inflateSync(Buffer.concat(compressed));
  } catch (error) {
    invariant(false, `PNG pixel data cannot be decoded: ${error.message}`);
  }
  const rowBytes = ihdr.width * channels;
  invariant(inflated.byteLength === ihdr.height * (rowBytes + 1), 'PNG decoded pixel length differs from its dimensions.');
  for (let row = 0; row < ihdr.height; row += 1) invariant(inflated[row * (rowBytes + 1)] <= 4, `PNG row ${row + 1} has an invalid filter byte.`);
  return Object.freeze({
    mediaType: 'image/png',
    bytes: bytes.byteLength,
    width: ihdr.width,
    height: ihdr.height,
    bitDepth: ihdr.bitDepth,
    colorType: ihdr.colorType,
    sha256: sha256(bytes),
    pixelSha256: sha256(inflated),
    chunks: Object.freeze(chunks),
  });
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function plainJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalStringify(value) {
  const normalize = current => {
    if (current === null || typeof current !== 'object') return current;
    if (Array.isArray(current)) return current.map(normalize);
    return Object.fromEntries(Object.keys(current).sort().map(key => [key, normalize(current[key])]));
  };
  return JSON.stringify(normalize(value));
}

function slash(value) {
  return value.split(path.sep).join('/');
}

function assertSafePathSegment(value, label = 'Path segment') {
  invariant(typeof value === 'string' && value.length > 0 && value.length <= 180, `${label} has an invalid length.`);
  invariant(value !== '.' && value !== '..' && !/[\\/:\u0000-\u001f]/u.test(value), `${label} '${value}' is unsafe.`);
  invariant(!/[. ]$/u.test(value) && !WINDOWS_DEVICE_NAME.test(value), `${label} '${value}' is not portable to Windows.`);
  invariant(/^[A-Za-z0-9._-]+$/u.test(value), `${label} '${value}' contains unsupported characters.`);
  return value;
}

function safeResolveUnderRoot(root, ...segments) {
  const resolvedRoot = path.resolve(root);
  for (const segment of segments) assertSafePathSegment(segment);
  const candidate = path.resolve(resolvedRoot, ...segments);
  const relative = path.relative(resolvedRoot, candidate);
  invariant(relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative), `Output path escapes '${resolvedRoot}'.`);
  return candidate;
}

async function pathInfo(value) {
  try {
    return await lstat(value);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function assertNoSymlinkPath(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  invariant(relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)), `Symlink check escaped '${resolvedRoot}'.`);
  const parts = relative ? relative.split(path.sep) : [];
  let current = resolvedRoot;
  for (const part of ['', ...parts]) {
    if (part) current = path.join(current, part);
    const info = await pathInfo(current);
    if (!info) break;
    invariant(!info.isSymbolicLink(), `Symlinked output paths are not allowed: '${current}'.`);
  }
}

function assertCaseDistinct(values, label) {
  const normalized = values.map(value => value.normalize('NFKC').toLocaleLowerCase('en-US'));
  invariant(new Set(normalized).size === normalized.length, `${label} contains a case-insensitive path collision.`, { values });
}

async function removeManagedPath(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  invariant(relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative), `Refusing to remove unmanaged path '${candidate}'.`);
  await assertNoSymlinkPath(root, candidate);
  await rm(candidate, { recursive: true, force: true });
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

async function acquireOutputLock(outputRoot) {
  const lockPath = safeResolveUnderRoot(outputRoot, '.production-matrix.lock');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, 'wx');
      await handle.writeFile(`${JSON.stringify({ pid: process.pid })}\n`, 'utf8');
      await handle.close();
      return async () => {
        try {
          await unlink(lockPath);
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error;
        }
      };
    } catch (error) {
      if (error?.code !== 'EEXIST' || attempt > 0) throw error;
      let owner = null;
      try {
        owner = JSON.parse(await readFile(lockPath, 'utf8'));
      } catch {
        invariant(false, `Output lock '${lockPath}' is unreadable; remove it after confirming no generation is active.`);
      }
      invariant(!processIsAlive(owner?.pid), `Production generation is already active under PID ${owner.pid}.`);
      await unlink(lockPath);
    }
  }
  invariant(false, 'Unable to acquire the production output lock.');
}

function marketFor(locale) {
  const market = localeCatalog[locale]?.extensions?.market;
  invariant(typeof market === 'string' && market.length === 2, `Locale '${locale}' has no production market.`);
  return market;
}

function validateContractOrThrow(contract, value, context) {
  const report = validateContract(contract, value);
  invariant(report.valid, `${context} violates ${contract}.`, { issues: report.issues });
  return report;
}

function isSafeArchivePath(value) {
  if (typeof value !== 'string' || !value || /^[A-Za-z]:/.test(value) || /^[\\/]/.test(value)) return false;
  if (/[:\u0000-\u001f]/u.test(value)) return false;
  return !value.split(/[\\/]/).some(segment => !segment || segment === '.' || segment === '..');
}

function matrixFilename({ productId, locale, currency, themeId, appearance }) {
  return `${productId}_${locale}_${currency}_${themeId}_${appearance}.xlsx`;
}

export function createProductionFactory() {
  return createFactoryRuntime({
    definitions: productDefinitions,
    locales: localeCatalog,
    currencies: currencyCatalog,
    themes: themeCatalog,
  });
}

export function buildFullMatrixCases() {
  const cases = [];
  for (const definition of productionProductDefinitions) {
    for (const appearance of productAppearances(definition)) {
      for (const locale of productionLocaleIds) {
        for (const currency of currencyIds) {
          for (const themeId of themeIds) {
            cases.push(Object.freeze({
              id: `${definition.id}|${locale}|${currency}|${themeId}|${appearance}`,
              productId: definition.id,
              productVersion: definition.version,
              locale,
              market: marketFor(locale),
              currency,
              themeId,
              appearance,
            }));
          }
        }
      }
    }
  }
  return Object.freeze(cases);
}

export function buildCoveringGenerationCases() {
  const cases = [];
  productionProductDefinitions.forEach((definition, productIndex) => {
    productionLocaleIds.forEach((locale, localeIndex) => {
      const sequence = productIndex * productionLocaleIds.length + localeIndex;
      const currency = currencyIds[(sequence * 5 + productIndex) % currencyIds.length];
      const themeId = themeIds[(productIndex + localeIndex * 2) % themeIds.length];
      const appearances = productAppearances(definition);
      const appearance = appearances[(productIndex + localeIndex) % appearances.length];
      cases.push(Object.freeze({
        id: `${definition.id}|${locale}|${currency}|${themeId}|${appearance}`,
        productId: definition.id,
        productVersion: definition.version,
        locale,
        market: marketFor(locale),
        currency,
        themeId,
        appearance,
      }));
    });
  });
  return Object.freeze(cases);
}

export function configurationForMatrixCase(factory, matrixCase, { packageOutput = false, sampleDataEnabled = false } = {}) {
  const definition = factory.resolveProduct(matrixCase.productId);
  return factory.configuration(matrixCase.productId, {
    locale: matrixCase.locale,
    market: matrixCase.market,
    currency: matrixCase.currency,
    themeId: matrixCase.themeId,
    filename: matrixFilename(matrixCase),
    inputCapacity: 50,
    sampleDataEnabled,
    outputOptions: { package: packageOutput },
    extensions: {
      ...definition.defaultConfiguration.extensions,
      productAppearance: matrixCase.appearance,
      paletteId: matrixCase.themeId,
    },
  });
}

export function configurationForReleaseScenario(factory, scenario, { packageOutput = true, sampleDataEnabled = true } = {}) {
  invariant(REQUIRED_RELEASE_SCENARIOS.some(candidate => candidate.id === scenario?.id), `Unknown required release scenario '${scenario?.id ?? 'missing'}'.`);
  const definition = factory.resolveProduct(scenario.productId);
  invariant(definition.extensions?.tier === scenario.tier, `Release scenario '${scenario.id}' tier differs from its product definition.`);
  invariant(productAppearances(definition).includes(scenario.appearance), `Release scenario '${scenario.id}' uses unsupported appearance '${scenario.appearance}'.`);
  const year = definition.defaultConfiguration.year;
  return factory.configuration(scenario.productId, {
    ...definition.defaultConfiguration,
    locale: scenario.locale,
    market: scenario.market,
    currency: scenario.currency,
    themeId: scenario.themeId,
    filename: `${scenario.tier}-budget-planner-${scenario.locale}-${year}-${scenario.appearance}.xlsx`,
    inputCapacity: 100,
    sampleDataEnabled,
    outputOptions: {
      ...definition.defaultConfiguration.outputOptions,
      workbook: true,
      package: packageOutput,
      customerDocs: packageOutput,
      listing: packageOutput,
      imageManifests: packageOutput,
    },
    extensions: {
      ...definition.defaultConfiguration.extensions,
      productAppearance: scenario.appearance,
      paletteId: scenario.themeId,
    },
  });
}

export function verifyCatalogVisibility(factory = createProductionFactory()) {
  invariant(isDeepStrictEqual(productionLocaleIds, REQUIRED_PRODUCTION_LOCALE_IDS), 'Production locales differ from the release contract.', {
    expected: REQUIRED_PRODUCTION_LOCALE_IDS,
    actual: productionLocaleIds,
  });
  const visibleIds = defaultVisibleProductDefinitions.map(definition => definition.id);
  invariant(isDeepStrictEqual(visibleIds, [...ACTIVE_PRODUCT_IDS]), 'Default-visible products differ from the active production catalog.', { visibleIds });
  invariant(defaultVisibleProductDefinitions.every(definition => definition.status === 'active' && definition.extensions?.defaultVisible === true), 'A non-active product is default-visible.');
  invariant(betaProductDefinitions.every(definition => definition.status === 'beta' && definition.extensions?.defaultVisible === false), 'A beta product is marked default-visible.');

  const activeDescriptors = factory.listProducts({ status: 'active' }).map(definition => definition.id);
  const nonBetaDescriptors = factory.listProducts({ beta: false }).map(definition => definition.id);
  invariant(isDeepStrictEqual(activeDescriptors, [...ACTIVE_PRODUCT_IDS].sort()), 'Active registry filter exposes the wrong products.', { activeDescriptors });
  invariant(isDeepStrictEqual(nonBetaDescriptors, [...ACTIVE_PRODUCT_IDS].sort()), 'Non-beta registry filter exposes the wrong products.', { nonBetaDescriptors });

  for (const productId of BETA_PRODUCT_IDS) {
    let hidden = false;
    try {
      factory.resolveProduct(productId);
    } catch (error) {
      hidden = error?.code === 'PRODUCT_NOT_FOUND';
    }
    invariant(hidden, `Beta product '${productId}' resolves without an explicit beta opt-in.`);
  }

  return Object.freeze({
    activeProductIds: [...ACTIVE_PRODUCT_IDS],
    hiddenBetaProductIds: [...BETA_PRODUCT_IDS],
  });
}

export function validateFullPreflightMatrix(factory = createProductionFactory()) {
  const cases = buildFullMatrixCases();
  invariant(cases.length === MATRIX_CASE_COUNT, `Expected ${MATRIX_CASE_COUNT} matrix cases, received ${cases.length}.`);
  const dimensions = {
    products: new Set(),
    locales: new Set(),
    currencies: new Set(),
    themes: new Set(),
    appearances: new Set(),
  };
  const canonicalCases = [];

  for (const matrixCase of cases) {
    const configuration = configurationForMatrixCase(factory, matrixCase);
    const validation = factory.validate(configuration);
    invariant(validation.valid && validation.status === 'PASS', `Preflight failed for '${matrixCase.id}'.`, { findings: validation.findings });
    invariant(validation.reports.length === 6 && validation.reports.every(item => item.report.valid && item.report.status === 'PASS'), `Strict preflight report failed for '${matrixCase.id}'.`, { reports: validation.reports });
    const preview = factory.preview(configuration);
    invariant(preview.productId === matrixCase.productId, `Preview product mismatch for '${matrixCase.id}'.`);
    invariant(preview.locale === matrixCase.locale && preview.currency === matrixCase.currency && preview.themeId === matrixCase.themeId, `Preview dimensions mismatch for '${matrixCase.id}'.`);
    invariant(preview.sheets.length === validation.definition.sheets.length, `Preview sheet count mismatch for '${matrixCase.id}'.`);
    canonicalCases.push({ matrixCase, configuration });
    dimensions.products.add(matrixCase.productId);
    dimensions.locales.add(matrixCase.locale);
    dimensions.currencies.add(matrixCase.currency);
    dimensions.themes.add(matrixCase.themeId);
    dimensions.appearances.add(matrixCase.appearance);
  }

  invariant(dimensions.products.size === ACTIVE_PRODUCT_IDS.length, 'The preflight matrix does not cover every active product.');
  invariant(dimensions.locales.size === productionLocaleIds.length, 'The preflight matrix does not cover every production locale.');
  invariant(dimensions.currencies.size === currencyIds.length, 'The preflight matrix does not cover every currency.');
  invariant(dimensions.themes.size === themeIds.length, 'The preflight matrix does not cover every theme.');
  invariant(dimensions.appearances.has('light') && dimensions.appearances.has('dark'), 'The preflight matrix does not cover required Light and Dark appearances.');

  return Object.freeze({
    caseCount: cases.length,
    digest: sha256(Buffer.from(canonicalCases.map(item => JSON.stringify(item)).join('\n'), 'utf8')),
    dimensions: Object.freeze({
      products: dimensions.products.size,
      locales: dimensions.locales.size,
      currencies: dimensions.currencies.size,
      themes: dimensions.themes.size,
      appearances: dimensions.appearances.size,
    }),
  });
}

function workbookSemanticDigest(workbook, result) {
  const sheets = workbook.worksheets.map(worksheet => {
    const cells = [];
    worksheet.eachRow({ includeEmpty: false }, row => row.eachCell({ includeEmpty: false }, cell => {
      cells.push({
        address: cell.address,
        value: cell.value,
        numFmt: cell.numFmt,
        protection: cell.protection,
        dataValidation: cell.dataValidation?.type ? cell.dataValidation : null,
        font: cell.font,
        fill: cell.fill,
        border: cell.border,
        alignment: cell.alignment,
      });
    }));
    const { saltValue: _saltValue, hashValue: _hashValue, ...protectionPolicy } = worksheet.sheetProtection ?? {};
    return {
      name: worksheet.name,
      state: worksheet.state,
      properties: worksheet.properties,
      views: worksheet.views,
      pageSetup: worksheet.pageSetup,
      headerFooter: worksheet.headerFooter,
      autoFilter: worksheet.autoFilter,
      merges: worksheet.model.merges,
      tables: worksheet.model.tables,
      conditionalFormattings: worksheet.model.conditionalFormattings,
      dataValidations: worksheet.dataValidations?.model ?? {},
      protectionPolicy,
      cells,
    };
  });
  const projection = plainJson({
    productId: result.definition.id,
    productVersion: result.definition.version,
    configuration: result.configuration,
    metadata: {
      creator: workbook.creator,
      lastModifiedBy: workbook.lastModifiedBy,
      created: workbook.created,
      modified: workbook.modified,
      title: workbook.title,
      subject: workbook.subject,
      description: workbook.description,
      company: workbook.company,
      category: workbook.category,
      keywords: workbook.keywords,
      calcProperties: workbook.calcProperties,
    },
    metrics: result.workbook.metrics,
    sheets,
  });
  return sha256(Buffer.from(canonicalStringify(projection), 'utf8'));
}

export async function verifyWorkbookArtifact(result, factory = createProductionFactory()) {
  invariant(result?.workbook?.bytes instanceof Uint8Array, 'Generated workbook bytes are missing.');
  const validation = factory.validate(result.configuration);
  invariant(validation.valid, `Generated configuration for '${result.configuration?.productId}' no longer validates.`);
  const expectedNames = expectedSheetNames({
    definition: result.definition,
    configuration: result.configuration,
    localization: validation.localization,
    currencyProfile: validation.currencyProfile,
    theme: validation.theme,
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.workbook.bytes);
  const actualNames = workbook.worksheets.map(worksheet => worksheet.name);
  invariant(isDeepStrictEqual(actualNames, expectedNames), `Re-read sheet names differ for '${result.definition.id}'.`, { actualNames, expectedNames });
  invariant(new Set(actualNames).size === actualNames.length, `Workbook '${result.definition.id}' contains duplicate sheet names.`);
  invariant(workbook.creator === 'NumberNinjaDesigns Finance Product Factory', `Workbook '${result.definition.id}' has unexpected creator metadata.`);
  const expectedContext = `${result.configuration.locale} · ${result.configuration.currency} · ${result.configuration.year} · ${result.configuration.themeId}`;
  const expectedAccent = `FF${String(validation.theme.colors.accent).replace(/^#/u, '').toUpperCase()}`;
  for (const worksheet of workbook.worksheets) {
    invariant(worksheet.getCell('A3').value === expectedContext, `Workbook context row is stale in '${result.definition.id}/${worksheet.name}'.`);
    invariant(worksheet.properties?.tabColor?.argb === expectedAccent, `Workbook theme accent is stale in '${result.definition.id}/${worksheet.name}'.`);
  }

  let formulaCount = 0;
  let validationCount = 0;
  let unlockedInputCells = 0;
  let lockedFormulaCells = 0;
  const formulaSheets = new Set();
  for (const worksheet of workbook.worksheets) {
    worksheet.eachRow({ includeEmpty: true }, row => {
      row.eachCell({ includeEmpty: true }, cell => {
        const formula = cell.formula ?? cell.value?.formula;
        const mergedFollower = cell.isMerged && cell.master?.address !== cell.address;
        if (formula && !mergedFollower) {
          formulaCount += 1;
          formulaSheets.add(worksheet.name);
          invariant(!/#REF!/i.test(formula), `Workbook '${result.definition.id}' contains a broken formula reference.`);
          invariant(!/(?:WEBSERVICE|FILTERXML|HYPERLINK|EXEC|CALL|RTD)\s*\(|\bDDE\b|cmd\|/i.test(formula), `Workbook '${result.definition.id}' contains a disallowed executable formula.`);
          invariant(!/\[[^\]]+\.(?:xlsx|xlsm|xlsb|xls)\]/iu.test(formula), `Workbook '${result.definition.id}' contains an external workbook formula reference.`);
          if (cell.protection?.locked === true) lockedFormulaCells += 1;
        }
        if (cell.dataValidation?.type) validationCount += 1;
        if (cell.protection?.locked === false) unlockedInputCells += 1;
      });
    });
  }
  invariant(formulaCount === result.workbook.metrics.formulas && formulaCount > 0, `Formula count mismatch for '${result.definition.id}'.`, { formulaCount, expected: result.workbook.metrics.formulas });
  invariant(lockedFormulaCells === formulaCount, `Not every formula cell is locked for '${result.definition.id}'.`, { formulaCount, lockedFormulaCells });
  invariant(validationCount >= result.workbook.metrics.validations, `Validation count decreased after re-read for '${result.definition.id}'.`, { validationCount, expectedMinimum: result.workbook.metrics.validations });
  invariant(unlockedInputCells > 0, `Workbook '${result.definition.id}' has no unlocked input cells.`);
  invariant([...formulaSheets].every(name => workbook.getWorksheet(name)?.sheetProtection), `A formula sheet is unprotected for '${result.definition.id}'.`);

  const xlsxArchive = await JSZip.loadAsync(result.workbook.bytes);
  for (const requiredPath of REQUIRED_XLSX_PATHS) invariant(xlsxArchive.file(requiredPath), `XLSX '${result.definition.id}' is missing '${requiredPath}'.`);
  const worksheetXmlPaths = Object.keys(xlsxArchive.files).filter(entry => /^xl\/worksheets\/sheet\d+\.xml$/u.test(entry));
  invariant(worksheetXmlPaths.length === expectedNames.length, `XLSX worksheet XML count mismatch for '${result.definition.id}'.`);
  const xlsxPaths = Object.keys(xlsxArchive.files);
  invariant(xlsxPaths.every(entry => !entry.startsWith('xl/externalLinks/')), `XLSX '${result.definition.id}' contains external-link parts.`);
  for (const relationshipPath of xlsxPaths.filter(entry => /(?:^|\/)_rels\/(?:\.rels|[^/]+\.rels)$/iu.test(entry))) {
    const relationships = await xlsxArchive.file(relationshipPath).async('string');
    const unsafeExternal = [...relationships.matchAll(/<Relationship\b[^>]*>/giu)].some(match => {
      const tag = match[0];
      if (!/\bTargetMode=["']External["']/iu.test(tag)) return false;
      const target = /\bTarget=["']([^"']+)["']/iu.exec(tag)?.[1] ?? '';
      return !target.startsWith('#');
    });
    invariant(!unsafeExternal, `XLSX '${result.definition.id}' contains an external relationship.`);
  }

  return Object.freeze({
    bytes: result.workbook.bytes.byteLength,
    sha256: sha256(result.workbook.bytes),
    semanticSha256: workbookSemanticDigest(workbook, result),
    sheets: actualNames.length,
    formulas: formulaCount,
    validations: validationCount,
    unlockedInputCells,
    protectedFormulaSheets: formulaSheets.size,
  });
}

export async function verifyPackageArtifact(result, workbookEvidence, {
  compatibilityStatus = 'PARTIAL',
  releaseStatus = 'DRAFT',
} = {}) {
  invariant(result?.package?.zipBytes instanceof Uint8Array, `Package bytes are missing for '${result?.definition?.id ?? 'unknown'}'.`);
  invariant(workbookEvidence?.semanticSha256, `Semantic workbook evidence is missing for '${result?.definition?.id ?? 'unknown'}'.`);
  for (const [contract, selector] of CONTRACTS) validateContractOrThrow(contract, selector(result), `${result.definition.id} package`);
  invariant(result.validationReport.status === 'PASS', `Workbook validation is not PASS for '${result.definition.id}'.`);
  invariant(result.qualityReport.status === 'PASS' && result.qualityReport.score >= result.qualityReport.threshold, `Quality gate failed for '${result.definition.id}'.`);
  invariant(result.compatibilityReport.status === compatibilityStatus, `Compatibility status differs from the release policy for '${result.definition.id}'.`, {
    expected: compatibilityStatus,
    actual: result.compatibilityReport.status,
  });
  invariant(result.validationReport.generatedAt === result.generatedAt, `Validation timestamp is not deterministic for '${result.definition.id}'.`);
  invariant(result.qualityReport.generatedAt === result.generatedAt, `Quality timestamp is not deterministic for '${result.definition.id}'.`);
  invariant(result.compatibilityReport.generatedAt === result.generatedAt, `Compatibility timestamp is not deterministic for '${result.definition.id}'.`);
  invariant(result.package.generatedManifest.generatedAt === result.generatedAt, `Generated-manifest timestamp is not deterministic for '${result.definition.id}'.`);
  invariant(result.package.releaseManifest.createdAt === result.generatedAt, `Release-manifest timestamp is not deterministic for '${result.definition.id}'.`);
  invariant(result.package.generatedManifest.releaseStatus === releaseStatus && result.package.releaseManifest.status === releaseStatus, `Package release status differs from the release policy for '${result.definition.id}'.`, {
    expected: releaseStatus,
    generated: result.package.generatedManifest.releaseStatus,
    release: result.package.releaseManifest.status,
  });

  const archive = await JSZip.loadAsync(result.package.zipBytes);
  const archivePaths = Object.keys(archive.files);
  invariant(archivePaths.length > REQUIRED_PACKAGE_PATHS.length, `Package '${result.definition.id}' has too few payload files.`);
  invariant(archivePaths.every(entry => !archive.files[entry].dir && isSafeArchivePath(entry)), `Package '${result.definition.id}' contains an unsafe archive path.`, { archivePaths });
  for (const requiredPath of REQUIRED_PACKAGE_PATHS) invariant(archive.file(requiredPath), `Package '${result.definition.id}' is missing '${requiredPath}'.`);

  const workbookPath = `product/${result.package.workbookFilename}`;
  const packagedWorkbook = await archive.file(workbookPath)?.async('uint8array');
  invariant(packagedWorkbook && isDeepStrictEqual(packagedWorkbook, result.workbook.bytes), `Packaged workbook differs from generated bytes for '${result.definition.id}'.`);

  const generatedManifest = JSON.parse(await archive.file('qa/generated-product-manifest.json').async('string'));
  const releaseManifest = JSON.parse(await archive.file('qa/release-manifest.json').async('string'));
  const validationReport = JSON.parse(await archive.file('qa/validation-report.json').async('string'));
  const qualityReport = JSON.parse(await archive.file('qa/quality-report.json').async('string'));
  const compatibilityReport = JSON.parse(await archive.file('qa/compatibility-report.json').async('string'));
  const imageManifest = JSON.parse(await archive.file('images/image-production-manifest.json').async('string'));
  const rootManifest = JSON.parse(await archive.file('manifest.json').async('string'));
  invariant(isDeepStrictEqual(generatedManifest, result.package.generatedManifest), `Generated manifest differs after ZIP re-read for '${result.definition.id}'.`);
  invariant(isDeepStrictEqual(releaseManifest, result.package.releaseManifest), `Release manifest differs after ZIP re-read for '${result.definition.id}'.`);
  invariant(isDeepStrictEqual(validationReport, result.validationReport), `Validation report differs after ZIP re-read for '${result.definition.id}'.`);
  invariant(isDeepStrictEqual(qualityReport, result.qualityReport), `Quality report differs after ZIP re-read for '${result.definition.id}'.`);
  invariant(isDeepStrictEqual(compatibilityReport, result.compatibilityReport), `Compatibility report differs after ZIP re-read for '${result.definition.id}'.`);
  invariant(isDeepStrictEqual(imageManifest, result.package.imageManifest), `Image manifest differs after ZIP re-read for '${result.definition.id}'.`);
  if (result.package.rootManifest) invariant(isDeepStrictEqual(rootManifest, result.package.rootManifest), `Root manifest differs after ZIP re-read for '${result.definition.id}'.`);
  validateContractOrThrow('ValidationReport', validationReport, `${result.definition.id} ZIP`);
  validateContractOrThrow('QualityReport', qualityReport, `${result.definition.id} ZIP`);
  validateContractOrThrow('CompatibilityReport', compatibilityReport, `${result.definition.id} ZIP`);
  validateContractOrThrow('ImageProductionManifest', imageManifest, `${result.definition.id} ZIP`);

  invariant(isDeepStrictEqual(LISTING_IMAGE_PATHS, REQUIRED_LISTING_IMAGE_PATHS), 'Renderer listing-image paths differ from the release contract.', {
    renderer: LISTING_IMAGE_PATHS,
    release: REQUIRED_LISTING_IMAGE_PATHS,
  });
  const packageFilePaths = result.package.files instanceof Map ? [...result.package.files.keys()].sort() : [];
  invariant(isDeepStrictEqual(packageFilePaths, [...archivePaths].sort()), `Package file map differs from ZIP contents for '${result.definition.id}'.`, { packageFilePaths, archivePaths });
  const manifestImagePaths = imageManifest.assets.map(asset => asset.packagePath);
  invariant(isDeepStrictEqual(manifestImagePaths, REQUIRED_LISTING_IMAGE_PATHS), `Image manifest path set differs for '${result.definition.id}'.`, { manifestImagePaths });
  invariant(imageManifest.extensions?.productionPolicy?.executionClaim === 'GENERATED_AND_VALIDATED_IMAGE_ASSETS', `Image production claim is missing for '${result.definition.id}'.`);
  invariant(imageManifest.extensions?.validation?.status === 'PASS' && imageManifest.extensions.validation.imageCount === REQUIRED_LISTING_IMAGE_PATHS.length, `Image validation is not PASS for '${result.definition.id}'.`);
  invariant(imageManifest.extensions?.workbookSha256 === sha256(result.workbook.bytes), `Image manifest workbook checksum differs for '${result.definition.id}'.`);
  invariant(rootManifest.status === 'VALIDATED_PACKAGE_INDEX' && rootManifest.productId === result.definition.id, `Root package manifest status or product differs for '${result.definition.id}'.`);
  invariant(rootManifest.locale === result.configuration.locale && rootManifest.currency === result.configuration.currency && rootManifest.theme === result.configuration.themeId, `Root package manifest locale, currency, or theme differs for '${result.definition.id}'.`);
  invariant(rootManifest.tier === result.definition.extensions?.tier && rootManifest.appearance === result.configuration.extensions?.productAppearance, `Root package manifest tier or appearance differs for '${result.definition.id}'.`);
  invariant(rootManifest.workbook?.path === workbookPath, `Root package manifest workbook path differs for '${result.definition.id}'.`);
  invariant(rootManifest.workbook.bytes === result.workbook.bytes.byteLength && rootManifest.workbook.sha256 === sha256(result.workbook.bytes), `Root package manifest workbook evidence differs for '${result.definition.id}'.`);
  invariant(rootManifest.imageValidation?.status === 'PASS' && rootManifest.imageValidation.imageCount === REQUIRED_LISTING_IMAGE_PATHS.length, `Root package manifest image validation is not PASS for '${result.definition.id}'.`);
  invariant(isDeepStrictEqual(rootManifest.listingImages?.map(image => image.path), REQUIRED_LISTING_IMAGE_PATHS), `Root package manifest listing-image paths differ for '${result.definition.id}'.`);
  const requiredRootPaths = REQUIRED_PACKAGE_PATHS.filter(requiredPath => !['listing/listing-metadata.json', 'images/image-production-manifest.json'].includes(requiredPath));
  invariant(requiredRootPaths.every(requiredPath => rootManifest.requiredPaths?.includes(requiredPath)), `Root package manifest required-path index is incomplete for '${result.definition.id}'.`);
  const imageDigests = new Set();
  const imagePixelDigests = new Map();
  const dimensions = new Set();
  const listingImages = [];
  for (let index = 0; index < REQUIRED_LISTING_IMAGE_PATHS.length; index += 1) {
    const imagePath = REQUIRED_LISTING_IMAGE_PATHS[index];
    const entry = archive.file(imagePath);
    invariant(entry, `Package '${result.definition.id}' is missing physical listing image '${imagePath}'.`);
    const bytes = await entry.async('uint8array');
    const inspection = inspectPngArtifact(bytes);
    const asset = imageManifest.assets[index];
    const packageFile = result.package.files.get(imagePath);
    invariant(packageFile?.mediaType === 'image/png' && packageFile?.role === 'image', `Package file metadata is not image/png for '${imagePath}'.`);
    invariant(packageFile.size === bytes.byteLength && packageFile.sha256 === inspection.sha256, `Package file metadata differs from physical PNG '${imagePath}'.`);
    invariant(asset?.packagePath === imagePath && asset.mediaType === 'image/png' && asset.status === 'validated', `Image manifest asset is not validated for '${imagePath}'.`);
    invariant(asset.bytes === bytes.byteLength && asset.sha256 === inspection.sha256, `Image manifest checksum or byte count differs for '${imagePath}'.`);
    invariant(asset.width === inspection.width && asset.height === inspection.height, `Image manifest dimensions differ for '${imagePath}'.`);
    invariant(asset.locale === result.configuration.locale && asset.theme === result.configuration.themeId, `Image locale or theme metadata differs for '${imagePath}'.`);
    invariant(asset.tier === result.definition.extensions?.tier && asset.appearance === result.configuration.extensions?.productAppearance, `Image tier or appearance metadata differs for '${imagePath}'.`);
    invariant(typeof asset.renderSource === 'string' && asset.renderSource.length > 0, `Image render source is missing for '${imagePath}'.`);
    invariant(!imageDigests.has(inspection.sha256), `Package '${result.definition.id}' contains duplicate listing-image bytes.`, { imagePath });
    imageDigests.add(inspection.sha256);
    imagePixelDigests.set(imagePath, inspection.pixelSha256);
    dimensions.add(`${inspection.width}x${inspection.height}`);
    listingImages.push({
      id: asset.id,
      path: imagePath,
      filename: asset.filename,
      bytes,
      width: inspection.width,
      height: inspection.height,
      mediaType: 'image/png',
      sha256: inspection.sha256,
    });
  }
  invariant(dimensions.size === 1, `Listing images use inconsistent dimensions for '${result.definition.id}'.`, { dimensions: [...dimensions] });
  const independentImageValidation = await validateListingImageSet({
    images: listingImages,
    manifest: imageManifest,
    definition: result.definition,
    configuration: result.configuration,
    theme: themeCatalog[result.configuration.themeId],
    JSZip,
  });
  invariant(independentImageValidation.status === 'PASS', `Independent listing-image validation failed for '${result.definition.id}'.`, { independentImageValidation });
  invariant(result.package.imageValidation?.status === 'PASS' && result.package.packageValidation?.status === 'PASS', `Runtime package validation is not PASS for '${result.definition.id}'.`);

  const actualPayloadPaths = archivePaths.filter(entry => !MANIFEST_ONLY_PATHS.includes(entry)).sort();
  const manifestPaths = generatedManifest.files.map(record => record.path);
  invariant(new Set(manifestPaths).size === manifestPaths.length, `Generated manifest contains duplicate file records for '${result.definition.id}'.`);
  invariant(isDeepStrictEqual([...manifestPaths].sort(), actualPayloadPaths), `Manifest payload paths differ from ZIP contents for '${result.definition.id}'.`, { manifestPaths, actualPayloadPaths });
  invariant(isDeepStrictEqual(Object.keys(generatedManifest.checksums).sort(), actualPayloadPaths), `Manifest checksum keys differ from ZIP contents for '${result.definition.id}'.`);

  for (const record of generatedManifest.files) {
    invariant(isSafeArchivePath(record.path), `Generated manifest contains unsafe path '${record.path}'.`);
    const entry = archive.file(record.path);
    invariant(entry, `Generated manifest references missing ZIP entry '${record.path}'.`);
    const bytes = await entry.async('uint8array');
    invariant(bytes.byteLength === record.bytes, `Byte count mismatch for '${record.path}'.`);
    invariant(sha256(bytes) === record.sha256 && generatedManifest.checksums[record.path] === record.sha256, `Checksum mismatch for '${record.path}'.`);
  }
  const workbookRecord = generatedManifest.files.find(record => record.path === workbookPath);
  invariant(workbookRecord?.mediaType === XLSX_MEDIA_TYPE, `Workbook media type is invalid for '${result.definition.id}'.`);

  for (const entryPath of archivePaths.filter(entry => /\.(?:html|json|txt)$/iu.test(entry))) {
    const content = await archive.file(entryPath).async('string');
    invariant(!/(?:\b[A-Za-z]:[\\/][^\s"<>]+|\/(?:Users|home|tmp|var\/folders)\/)/iu.test(content), `Package text leaks a local filesystem path in '${entryPath}'.`);
    invariant(!/(?:\bsk-[A-Za-z0-9_-]{20,}|\bghp_[A-Za-z0-9]{20,}|\bAIza[A-Za-z0-9_-]{20,})/u.test(content), `Package text contains a credential-shaped value in '${entryPath}'.`);
    if (entryPath.endsWith('.html')) {
      invariant(/Content-Security-Policy/iu.test(content), `Offline HTML '${entryPath}' has no CSP.`);
      invariant(!/<script\b/iu.test(content), `Offline HTML '${entryPath}' contains executable script.`);
    }
  }

  const generatedSemantic = plainJson(generatedManifest);
  const validationSemantic = plainJson(validationReport);
  const withoutVolatileBinaryEvidence = value => {
    if (Array.isArray(value)) return value.map(withoutVolatileBinaryEvidence);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['sha256', 'workbookSha256', 'bytes'].includes(key))
      .map(([key, child]) => [key, withoutVolatileBinaryEvidence(child)]));
  };
  const imageManifestSemantic = withoutVolatileBinaryEvidence(plainJson(imageManifest));
  const rootManifestSemantic = withoutVolatileBinaryEvidence(plainJson(rootManifest));
  const imageValidationSemantic = withoutVolatileBinaryEvidence(plainJson(independentImageValidation));
  if (validationSemantic.extensions?.metrics) delete validationSemantic.extensions.metrics.bytes;
  delete generatedSemantic.checksums;
  generatedSemantic.files = generatedSemantic.files.map(({ path: filePath, role, mediaType }) => ({ path: filePath, role, mediaType }));
  generatedSemantic.validationReport = validationSemantic;
  if (generatedSemantic.extensions?.imageValidation) generatedSemantic.extensions.imageValidation = imageValidationSemantic;
  const releaseSemantic = plainJson(releaseManifest);
  releaseSemantic.generatedProduct = generatedSemantic;
  if (releaseSemantic.images) releaseSemantic.images = imageManifestSemantic;
  if (releaseSemantic.extensions?.imageValidation) releaseSemantic.extensions.imageValidation = imageValidationSemantic;
  const semanticFiles = [];
  for (const entryPath of [...archivePaths].sort()) {
    let digest;
    if (entryPath === workbookPath) digest = workbookEvidence.semanticSha256;
    else if (/^product\/google-sheets\/[^/]+\.xlsx$/u.test(entryPath)) {
      const googleSheetsBytes = await archive.file(entryPath).async('uint8array');
      invariant(sha256(googleSheetsBytes) === sha256(result.workbook.bytes), `Google Sheets import edition differs from the validated workbook bytes for '${result.definition.id}'.`);
      digest = workbookEvidence.semanticSha256;
    }
    else if (imagePixelDigests.has(entryPath)) digest = imagePixelDigests.get(entryPath);
    else if (entryPath === 'images/image-production-manifest.json') digest = sha256(Buffer.from(canonicalStringify(imageManifestSemantic), 'utf8'));
    else if (/^images\/[^/]+\.json$/u.test(entryPath)) {
      const imageSupportManifest = JSON.parse(await archive.file(entryPath).async('string'));
      digest = sha256(Buffer.from(canonicalStringify(withoutVolatileBinaryEvidence(imageSupportManifest)), 'utf8'));
    }
    else if (entryPath === 'manifest.json') digest = sha256(Buffer.from(canonicalStringify(rootManifestSemantic), 'utf8'));
    else if (entryPath === 'qa/validation-report.json') digest = sha256(Buffer.from(canonicalStringify(validationSemantic), 'utf8'));
    else if (entryPath === 'qa/generated-product-manifest.json') digest = sha256(Buffer.from(canonicalStringify(generatedSemantic), 'utf8'));
    else if (entryPath === 'qa/release-manifest.json') digest = sha256(Buffer.from(canonicalStringify(releaseSemantic), 'utf8'));
    else if (entryPath === 'qa/google-sheets-readiness-report.json') {
      const googleSheetsReport = JSON.parse(await archive.file(entryPath).async('string'));
      digest = sha256(Buffer.from(canonicalStringify(withoutVolatileBinaryEvidence(googleSheetsReport)), 'utf8'));
    }
    else digest = sha256(await archive.file(entryPath).async('uint8array'));
    semanticFiles.push({ path: entryPath, digest });
  }
  const semanticSha256 = sha256(Buffer.from(canonicalStringify({
    packageFilename: result.package.packageFilename,
    workbookFilename: result.package.workbookFilename,
    semanticFiles,
  }), 'utf8'));

  return Object.freeze({
    bytes: result.package.zipBytes.byteLength,
    sha256: sha256(result.package.zipBytes),
    semanticSha256,
    entries: archivePaths.length,
    manifestPayloadFiles: generatedManifest.files.length,
    releaseStatus: releaseManifest.status,
    semanticFiles: Object.freeze(semanticFiles),
    listingImages: Object.freeze({
      status: independentImageValidation.status,
      count: independentImageValidation.imageCount,
      width: imageManifest.assets[0].width,
      height: imageManifest.assets[0].height,
      uniqueHashes: imageDigests.size,
    }),
  });
}

function canonicalConfiguration(factory, scenario) {
  return configurationForReleaseScenario(factory, scenario, { packageOutput: true, sampleDataEnabled: true });
}

function artifactRecord(kind, relativePath, bytes) {
  return Object.freeze({
    kind,
    path: slash(relativePath),
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  });
}

const PERSISTED_JSON_ARTIFACTS = Object.freeze([
  ['configuration.json', 'ProductConfiguration', result => result.configuration],
  ['validation-report.json', 'ValidationReport', result => result.validationReport],
  ['quality-report.json', 'QualityReport', result => result.qualityReport],
  ['compatibility-report.json', 'CompatibilityReport', result => result.compatibilityReport],
  ['image-production-manifest.json', 'ImageProductionManifest', result => result.package.imageManifest],
  ['generated-product-manifest.json', 'GeneratedProductManifest', result => result.package.generatedManifest],
  ['release-manifest.json', 'ReleaseManifest', result => result.package.releaseManifest],
]);

async function writeArtifactSet(directory, outputValues) {
  const filenames = [...outputValues.keys()];
  assertCaseDistinct(filenames, `Artifact set '${directory}'`);
  await mkdir(directory, { recursive: false });
  for (const [filename, bytes] of outputValues) {
    invariant(isSafeArchivePath(filename), `Artifact path '${filename}' is unsafe.`);
    const segments = filename.split('/');
    segments.forEach(segment => assertSafePathSegment(segment, 'Artifact path segment'));
    const target = safeResolveUnderRoot(directory, ...segments);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: 'wx' });
  }
}

async function listArtifactFiles(directory, current = directory) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    assertSafePathSegment(entry.name, 'Persisted artifact path segment');
    const target = path.join(current, entry.name);
    const info = await lstat(target);
    invariant(!info.isSymbolicLink(), `Persisted artifact path '${target}' cannot be a symlink.`);
    if (info.isDirectory()) files.push(...await listArtifactFiles(directory, target));
    else {
      invariant(info.isFile(), `Persisted artifact '${target}' is not a regular file.`);
      files.push(slash(path.relative(directory, target)));
    }
  }
  return files;
}

async function verifyPersistedVariant({
  outputRoot,
  directory,
  outputValues,
  records,
  localEvidence,
  result,
  factory,
}) {
  await assertNoSymlinkPath(outputRoot, directory);
  const actualNames = (await listArtifactFiles(directory)).sort();
  const expectedNames = [...outputValues.keys()].sort();
  assertCaseDistinct(actualNames, `Persisted artifact set '${directory}'`);
  invariant(isDeepStrictEqual(actualNames, expectedNames), `Persisted artifact set is incomplete for '${result.definition.id}'.`, { actualNames, expectedNames });

  const persisted = new Map();
  for (const [filename, expectedBytes] of outputValues) {
    const filePath = safeResolveUnderRoot(directory, ...filename.split('/'));
    await assertNoSymlinkPath(outputRoot, filePath);
    const info = await pathInfo(filePath);
    invariant(info?.isFile(), `Persisted artifact '${filePath}' is not a regular file.`);
    const bytes = await readFile(filePath);
    invariant(bytes.byteLength === expectedBytes.byteLength && sha256(bytes) === sha256(expectedBytes), `Persisted artifact differs after write: '${filePath}'.`);
    persisted.set(filename, bytes);
  }

  for (const record of records) {
    const filename = [...outputValues.keys()].find(candidate => record.path === candidate || record.path.endsWith(`/${candidate}`));
    invariant(filename, `Persisted artifact record path '${record.path}' has no output value.`);
    const bytes = persisted.get(filename);
    invariant(bytes && bytes.byteLength === record.bytes && sha256(bytes) === record.sha256, `Persisted artifact record mismatch for '${record.path}'.`);
  }

  for (const [filename, contract, selector] of PERSISTED_JSON_ARTIFACTS) {
    let value;
    try {
      value = JSON.parse(persisted.get(filename).toString('utf8'));
    } catch (error) {
      invariant(false, `Persisted JSON '${filename}' cannot be parsed: ${error.message}`);
    }
    invariant(isDeepStrictEqual(value, selector(result)), `Persisted JSON '${filename}' differs from runtime evidence.`);
    validateContractOrThrow(contract, value, `${result.definition.id} persisted artifact`);
  }
  const localEvidenceFromDisk = JSON.parse(persisted.get('artifact-evidence.json').toString('utf8'));
  invariant(isDeepStrictEqual(localEvidenceFromDisk, localEvidence), `Persisted local evidence differs for '${result.definition.id}'.`);

  const persistedResult = {
    ...result,
    workbook: { ...result.workbook, bytes: new Uint8Array(persisted.get(result.package.workbookFilename)) },
    package: { ...result.package, zipBytes: new Uint8Array(persisted.get(result.package.packageFilename)) },
  };
  const persistedWorkbookEvidence = await verifyWorkbookArtifact(persistedResult, factory);
  await verifyPackageArtifact(persistedResult, persistedWorkbookEvidence);
}

async function promoteVariant({ outputRoot, directory, outputValues, records, localEvidence, result, factory }) {
  const parent = path.dirname(directory);
  await assertNoSymlinkPath(outputRoot, parent);
  await mkdir(parent, { recursive: true });
  await assertNoSymlinkPath(outputRoot, parent);
  const base = path.basename(directory);
  assertSafePathSegment(base, 'Variant directory');
  const staging = safeResolveUnderRoot(parent, `.${base}.staging`);
  const backup = safeResolveUnderRoot(parent, `.${base}.backup`);

  let targetInfo = await pathInfo(directory);
  let backupInfo = await pathInfo(backup);
  if (!targetInfo && backupInfo) {
    await assertNoSymlinkPath(outputRoot, backup);
    await rename(backup, directory);
    targetInfo = await pathInfo(directory);
    backupInfo = null;
  }
  if (targetInfo) invariant(targetInfo.isDirectory() && !targetInfo.isSymbolicLink(), `Variant target '${directory}' must be a regular directory.`);
  if (backupInfo) await removeManagedPath(outputRoot, backup);
  if (await pathInfo(staging)) await removeManagedPath(outputRoot, staging);

  await writeArtifactSet(staging, outputValues);
  await verifyPersistedVariant({ outputRoot, directory: staging, outputValues, records, localEvidence, result, factory });

  let previousMoved = false;
  if (await pathInfo(directory)) {
    await rename(directory, backup);
    previousMoved = true;
  }
  try {
    await rename(staging, directory);
    await verifyPersistedVariant({ outputRoot, directory, outputValues, records, localEvidence, result, factory });
  } catch (error) {
    if (await pathInfo(directory)) await removeManagedPath(outputRoot, directory);
    if (previousMoved && await pathInfo(backup)) await rename(backup, directory);
    throw error;
  }
  if (previousMoved && await pathInfo(backup)) await removeManagedPath(outputRoot, backup);
}

async function writeFileTransactionally(filename, bytes) {
  const directory = path.dirname(filename);
  const base = path.basename(filename);
  assertSafePathSegment(base, 'Evidence filename');
  const filesystemRoot = path.parse(directory).root;
  await assertNoSymlinkPath(filesystemRoot, directory);
  await mkdir(directory, { recursive: true });
  await assertNoSymlinkPath(filesystemRoot, directory);
  const directoryInfo = await pathInfo(directory);
  invariant(directoryInfo?.isDirectory() && !directoryInfo.isSymbolicLink(), `Evidence directory '${directory}' is not a regular directory.`);
  const staging = path.join(directory, `.${base}.staging`);
  const backup = path.join(directory, `.${base}.backup`);
  for (const managedPath of [staging, backup]) {
    const info = await pathInfo(managedPath);
    invariant(!info?.isSymbolicLink(), `Evidence transaction path '${managedPath}' cannot be a symlink.`);
  }
  if (await pathInfo(staging)) await rm(staging, { force: true });
  if (!(await pathInfo(filename)) && await pathInfo(backup)) await rename(backup, filename);
  if (await pathInfo(backup)) await rm(backup, { force: true });
  const targetInfo = await pathInfo(filename);
  invariant(!targetInfo?.isSymbolicLink() && (!targetInfo || targetInfo.isFile()), `Evidence target '${filename}' must be a regular file.`);
  await writeFile(staging, bytes, { flag: 'wx' });
  invariant(sha256(await readFile(staging)) === sha256(bytes), `Staged evidence write failed for '${filename}'.`);
  let previousMoved = false;
  if (targetInfo) {
    await rename(filename, backup);
    previousMoved = true;
  }
  try {
    await rename(staging, filename);
    invariant(sha256(await readFile(filename)) === sha256(bytes), `Persisted evidence write failed for '${filename}'.`);
  } catch (error) {
    if (await pathInfo(filename)) await rm(filename, { force: true });
    if (previousMoved && await pathInfo(backup)) await rename(backup, filename);
    throw error;
  }
  if (previousMoved && await pathInfo(backup)) await rm(backup, { force: true });
}

async function validateSalesSet(workbooks, zipBytes) {
  invariant(workbooks instanceof Map && workbooks.size === REQUIRED_CORE_SALES_WORKBOOKS.length, 'Core sales set does not contain exactly five physical workbook variants.');
  const expectedPaths = REQUIRED_CORE_SALES_WORKBOOKS.map(item => `products/${item.filename}`).sort();
  const archive = await JSZip.loadAsync(zipBytes);
  const archivePaths = Object.keys(archive.files).filter(entry => !archive.files[entry].dir).sort();
  invariant(isDeepStrictEqual(archivePaths, expectedPaths), 'Core sales-set ZIP path set is incomplete or unexpected.', { archivePaths, expectedPaths });
  const evidence = [];
  for (const requirement of REQUIRED_CORE_SALES_WORKBOOKS) {
    const item = workbooks.get(requirement.scenarioId);
    invariant(item?.bytes instanceof Uint8Array && item.bytes.byteLength > 1_000, `Core sales workbook '${requirement.filename}' is missing or empty.`);
    invariant(item.bytes[0] === 0x50 && item.bytes[1] === 0x4b, `Core sales workbook '${requirement.filename}' has no XLSX/ZIP signature.`);
    const packaged = await archive.file(`products/${requirement.filename}`)?.async('uint8array');
    invariant(packaged && isDeepStrictEqual(packaged, item.bytes), `Core sales workbook '${requirement.filename}' differs inside the ZIP.`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(packaged);
    invariant(workbook.worksheets.length === item.sheetCount && workbook.worksheets.length > 0, `Core sales workbook '${requirement.filename}' failed independent worksheet validation.`);
    evidence.push(Object.freeze({
      scenarioId: requirement.scenarioId,
      path: `products/${requirement.filename}`,
      sourceFilename: item.sourceFilename,
      bytes: packaged.byteLength,
      sha256: sha256(packaged),
      sheets: workbook.worksheets.length,
    }));
  }
  return Object.freeze({
    status: 'PASS',
    workbookCount: evidence.length,
    archiveFilename: 'finance-product-factory-master-sales-set.zip',
    archiveBytes: zipBytes.byteLength,
    archiveSha256: sha256(zipBytes),
    workbooks: Object.freeze(evidence),
  });
}

async function promoteSalesSet({ outputRoot, generatedAt, workbooks }) {
  const target = safeResolveUnderRoot(outputRoot, 'sales-set');
  const staging = safeResolveUnderRoot(outputRoot, '.sales-set.staging');
  const backup = safeResolveUnderRoot(outputRoot, '.sales-set.backup');
  if (!(await pathInfo(target)) && await pathInfo(backup)) await rename(backup, target);
  if (await pathInfo(staging)) await removeManagedPath(outputRoot, staging);
  if (await pathInfo(backup)) await removeManagedPath(outputRoot, backup);
  await mkdir(safeResolveUnderRoot(staging, 'products'), { recursive: true });
  const zip = new JSZip();
  const zipDate = new Date(generatedAt);
  for (const requirement of REQUIRED_CORE_SALES_WORKBOOKS) {
    const item = workbooks.get(requirement.scenarioId);
    invariant(item, `Core sales scenario '${requirement.scenarioId}' was not generated.`);
    const diskTarget = safeResolveUnderRoot(staging, 'products', requirement.filename);
    await writeFile(diskTarget, item.bytes, { flag: 'wx' });
    zip.file(`products/${requirement.filename}`, item.bytes, { binary: true, createFolders: false, date: zipDate });
  }
  const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE', platform: 'DOS', streamFiles: false });
  const salesSet = await validateSalesSet(workbooks, zipBytes);
  await writeFile(safeResolveUnderRoot(staging, salesSet.archiveFilename), zipBytes, { flag: 'wx' });
  await writeFile(safeResolveUnderRoot(staging, 'sales-set-evidence.json'), jsonBytes(salesSet), { flag: 'wx' });
  for (const requirement of REQUIRED_CORE_SALES_WORKBOOKS) {
    const item = workbooks.get(requirement.scenarioId);
    const persisted = await readFile(safeResolveUnderRoot(staging, 'products', requirement.filename));
    invariant(persisted.byteLength === item.bytes.byteLength && sha256(persisted) === sha256(item.bytes), `Staged core sales workbook '${requirement.filename}' differs after disk write.`);
  }
  const persistedZip = await readFile(safeResolveUnderRoot(staging, salesSet.archiveFilename));
  invariant(sha256(persistedZip) === salesSet.archiveSha256, 'Staged core sales-set ZIP differs after disk write.');

  let previousMoved = false;
  if (await pathInfo(target)) {
    await assertNoSymlinkPath(outputRoot, target);
    await rename(target, backup);
    previousMoved = true;
  }
  try {
    await rename(staging, target);
    const publishedZip = await readFile(safeResolveUnderRoot(target, salesSet.archiveFilename));
    invariant(sha256(publishedZip) === salesSet.archiveSha256, 'Published core sales-set ZIP differs after promotion.');
  } catch (error) {
    if (await pathInfo(target)) await removeManagedPath(outputRoot, target);
    if (previousMoved && await pathInfo(backup)) await rename(backup, target);
    throw error;
  }
  if (previousMoved && await pathInfo(backup)) await removeManagedPath(outputRoot, backup);
  return Object.freeze({ ...salesSet, relativeDirectory: 'sales-set' });
}

async function parkPreviousEvidence(filename) {
  const previous = `${filename}.previous`;
  await assertNoSymlinkPath(path.parse(filename).root, path.dirname(filename));
  const targetInfo = await pathInfo(filename);
  const previousInfo = await pathInfo(previous);
  invariant(!targetInfo?.isSymbolicLink() && !previousInfo?.isSymbolicLink(), 'Evidence files cannot be symlinks.');
  if (targetInfo) {
    invariant(targetInfo.isFile(), `Evidence target '${filename}' must be a regular file.`);
    if (previousInfo) await rm(previous, { force: true });
    await rename(filename, previous);
  }
  return previous;
}

export async function validateProductionMatrix(options = {}) {
  const outputRoot = path.resolve(options.outputRoot ?? path.join(process.cwd(), 'output', 'validation-matrix'));
  invariant(outputRoot !== path.parse(outputRoot).root, 'Refusing to write production artifacts directly to a filesystem root.');
  const generatedAt = normalizeTimestamp(options.generatedAt ?? DEFAULT_GENERATED_AT);
  const evidencePath = Object.hasOwn(options, 'evidencePath')
    ? (options.evidencePath === null ? null : path.resolve(options.evidencePath))
    : path.join(outputRoot, 'production-matrix-evidence.json');
  if (evidencePath) assertSafePathSegment(path.basename(evidencePath), 'Evidence filename');
  const filesystemRoot = path.parse(outputRoot).root;
  await assertNoSymlinkPath(filesystemRoot, outputRoot);
  await mkdir(outputRoot, { recursive: true });
  await assertNoSymlinkPath(filesystemRoot, outputRoot);
  const releaseLock = await acquireOutputLock(outputRoot);
  let parkedEvidence = null;
  try {
    const factory = createProductionFactory();
    const visibility = verifyCatalogVisibility(factory);
    const preflight = validateFullPreflightMatrix(factory);
    const productEvidence = [];
    const coreSalesWorkbooks = new Map();
    const configurations = REQUIRED_RELEASE_SCENARIOS.map(scenario => {
      const definition = factory.resolveProduct(scenario.productId);
      return { scenario, definition, configuration: canonicalConfiguration(factory, scenario) };
    });
    const relativeDirectories = configurations.map(({ scenario, definition, configuration }) => {
      const variant = `${configuration.locale}-${configuration.currency}-${configuration.themeId}-${configuration.extensions.productAppearance}`;
      [scenario.id, definition.version, variant].forEach(segment => assertSafePathSegment(segment, 'Canonical output segment'));
      return path.join(scenario.id, definition.version, variant);
    });
    assertCaseDistinct(relativeDirectories.map(slash), 'Canonical output hierarchy');
    if (evidencePath) {
      invariant(path.resolve(evidencePath) !== safeResolveUnderRoot(outputRoot, '.production-matrix.lock'), 'Evidence path collides with the output lock.');
      for (const relativeDirectory of relativeDirectories) {
        const directory = path.resolve(outputRoot, relativeDirectory);
        const relative = path.relative(directory, path.resolve(evidencePath));
        invariant(relative !== '' && (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)), `Evidence path cannot be inside variant directory '${directory}'.`);
      }
      const salesSetDirectory = safeResolveUnderRoot(outputRoot, 'sales-set');
      const salesSetEvidenceRelative = path.relative(salesSetDirectory, path.resolve(evidencePath));
      invariant(salesSetEvidenceRelative !== '' && (salesSetEvidenceRelative.startsWith(`..${path.sep}`) || salesSetEvidenceRelative === '..' || path.isAbsolute(salesSetEvidenceRelative)), `Evidence path cannot be inside sales-set directory '${salesSetDirectory}'.`);
    }

    for (let index = 0; index < configurations.length; index += 1) {
      const { scenario, definition, configuration } = configurations[index];
      const relativeDirectory = relativeDirectories[index];
      const directory = safeResolveUnderRoot(outputRoot, ...relativeDirectory.split(path.sep));
      const result = await factory.generate(configuration, {
        ExcelJS,
        JSZip,
        generatedAt,
        allowSyntheticListingImagesForReview: true,
      });
      const workbook = await verifyWorkbookArtifact(result, factory);
      const packageArtifact = await verifyPackageArtifact(result, workbook);
      if (REQUIRED_CORE_SALES_WORKBOOKS.some(requirement => requirement.scenarioId === scenario.id)) {
        coreSalesWorkbooks.set(scenario.id, Object.freeze({
          bytes: result.workbook.bytes,
          sourceFilename: configuration.filename,
          sheetCount: workbook.sheets,
        }));
      }
      const outputValues = new Map([
        [configuration.filename, result.workbook.bytes],
        [result.package.packageFilename, result.package.zipBytes],
        ['configuration.json', jsonBytes(configuration)],
        ['validation-report.json', jsonBytes(result.validationReport)],
        ['quality-report.json', jsonBytes(result.qualityReport)],
        ['compatibility-report.json', jsonBytes(result.compatibilityReport)],
        ['image-production-manifest.json', jsonBytes(result.package.imageManifest)],
        ['generated-product-manifest.json', jsonBytes(result.package.generatedManifest)],
        ['release-manifest.json', jsonBytes(result.package.releaseManifest)],
        ...REQUIRED_LISTING_IMAGE_PATHS.map(imagePath => {
          const imageFile = result.package.files.get(imagePath);
          invariant(imageFile?.mediaType === 'image/png' && imageFile.bytes instanceof Uint8Array, `Physical listing PNG '${imagePath}' is unavailable for persistence.`);
          return [imagePath, imageFile.bytes];
        }),
      ]);
      assertCaseDistinct([...outputValues.keys()], `${definition.id} artifact filenames`);
      const records = [...outputValues].map(([filename, bytes]) => artifactRecord(
        filename === configuration.filename ? 'workbook' : filename === result.package.packageFilename ? 'package' : filename.startsWith('listing/images/') ? 'image' : 'evidence',
        path.join(relativeDirectory, filename),
        bytes,
      ));
      const localEvidence = {
        schemaVersion: '1.0.0',
        generatedAt,
        scenarioId: scenario.id,
        productId: definition.id,
        productVersion: definition.version,
        configuration: {
          locale: configuration.locale,
          market: configuration.market,
          currency: configuration.currency,
          themeId: configuration.themeId,
          tier: scenario.tier,
          appearance: configuration.extensions.productAppearance,
          inputCapacity: configuration.inputCapacity,
        },
        gates: {
          validation: result.validationReport.status,
          quality: result.qualityReport.status,
          qualityScore: result.qualityReport.score,
          compatibility: result.compatibilityReport.status,
          release: result.package.releaseManifest.status,
        },
        workbook,
        package: packageArtifact,
        artifacts: records,
      };
      outputValues.set('artifact-evidence.json', jsonBytes(localEvidence));
      if (evidencePath && parkedEvidence === null) parkedEvidence = await parkPreviousEvidence(evidencePath);
      await promoteVariant({ outputRoot, directory, outputValues, records, localEvidence, result, factory });
      productEvidence.push(Object.freeze({ ...localEvidence, relativeDirectory: slash(relativeDirectory) }));
    }

    const salesSet = await promoteSalesSet({ outputRoot, generatedAt, workbooks: coreSalesWorkbooks });

    const evidence = {
      schemaVersion: '1.0.0',
      generatedAt,
      generator: 'scripts/validate-production-matrix.mjs',
      policy: {
        nativeExcelEvidence: false,
        browserEvidence: false,
        expectedCompatibilityStatus: 'PARTIAL',
        expectedReleaseStatus: 'DRAFT',
        determinism: 'SEMANTIC_CONTENT',
        protectionSalts: 'RANDOM_PER_GENERATION',
      },
      visibility,
      matrix: {
        ...preflight,
        coveringGenerationCasesDefined: COVERING_GENERATION_CASE_COUNT,
        coveringGenerationScope: 'product-locale plus global currency-theme smoke coverage',
        requiredReleaseScenarios: REQUIRED_RELEASE_SCENARIOS.length,
        canonicalPackages: productEvidence.length,
      },
      salesSet,
      products: productEvidence,
    };
    if (evidencePath) {
      await writeFileTransactionally(evidencePath, jsonBytes(evidence));
      const persistedEvidence = JSON.parse(await readFile(evidencePath, 'utf8'));
      invariant(isDeepStrictEqual(persistedEvidence, evidence), 'Aggregate evidence differs after disk re-read.');
      if (parkedEvidence && await pathInfo(parkedEvidence)) await rm(parkedEvidence, { force: true });
    }
    return Object.freeze({ outputRoot, evidencePath, evidence });
  } finally {
    await releaseLock();
  }
}

function usage() {
  return [
    'Usage: node scripts/validate-production-matrix.mjs [options]',
    '',
    'Options:',
    '  --output <directory>   Artifact root (default: output/validation-matrix)',
    `  --timestamp <ISO>     Deterministic timestamp (default: ${DEFAULT_GENERATED_AT})`,
    '  --evidence <file>      Evidence JSON path (default: <output>/production-matrix-evidence.json)',
    '  --no-evidence          Do not write the aggregate evidence JSON',
    '  --help                 Show this help',
  ].join('\n');
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help') return { help: true };
    if (argument === '--no-evidence') {
      options.evidencePath = null;
      continue;
    }
    if (['--output', '--timestamp', '--evidence'].includes(argument)) {
      const value = argv[index + 1];
      invariant(value && !value.startsWith('--'), `Option '${argument}' requires a value.`);
      index += 1;
      if (argument === '--output') options.outputRoot = value;
      if (argument === '--timestamp') options.generatedAt = value;
      if (argument === '--evidence') options.evidencePath = value;
      continue;
    }
    invariant(false, `Unknown option '${argument}'.`);
  }
  return options;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
    } else {
      const result = await validateProductionMatrix(options);
      console.log(JSON.stringify({
        status: 'PASS',
        outputRoot: result.outputRoot,
        evidencePath: result.evidencePath,
        matrixCases: result.evidence.matrix.caseCount,
        products: result.evidence.products.length,
      }, null, 2));
    }
  } catch (error) {
    console.error(JSON.stringify({
      status: 'FAIL',
      name: error?.name ?? 'Error',
      message: error?.message ?? String(error),
      details: error?.details ?? null,
    }, null, 2));
    process.exitCode = 1;
  }
}
