import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { LISTING_IMAGE_BLUEPRINTS, LISTING_IMAGE_PATHS } from '../commercial/listing-image-engine.js';
import currencies from '../currencies/index.mjs';
import { generateWorkbook } from '../engines/workbook-engine.js';
import { createFactoryRuntime } from '../factory-runtime.js';
import locales from '../locales/index.mjs';
import { productDefinitions } from '../products/index.mjs';
import { renderExcelListingImages } from '../renderers/excel-workbook-renderer.mjs';
import themes, { resolveWorkbookTheme } from '../themes/index.mjs';

const MAX_WORKBOOK_BYTES = 50_000_000;
const runtime = createFactoryRuntime({ definitions: productDefinitions, locales, currencies, themes });
let renderQueue = Promise.resolve();

export class NativeListingImageError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'NativeListingImageError';
    this.statusCode = statusCode;
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NativeListingImageError(400, `${label} ontbreekt of is ongeldig.`);
  }
  return value;
}

export function decodeWorkbookBase64(value) {
  if (typeof value !== 'string' || value.length < 1_336) {
    throw new NativeListingImageError(400, 'De gegenereerde XLSX-inhoud ontbreekt.');
  }
  if (value.length > Math.ceil(MAX_WORKBOOK_BYTES / 3) * 4 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value) || value.length % 4 !== 0) {
    throw new NativeListingImageError(413, 'De gegenereerde XLSX-inhoud is te groot of ongeldig gecodeerd.');
  }
  const bytes = Buffer.from(value, 'base64');
  const normalizedInput = value.replace(/=+$/u, '');
  const normalizedOutput = bytes.toString('base64').replace(/=+$/u, '');
  if (
    normalizedInput !== normalizedOutput
    || bytes.byteLength < 1_000
    || bytes.byteLength > MAX_WORKBOOK_BYTES
    || bytes[0] !== 0x50
    || bytes[1] !== 0x4B
  ) {
    throw new NativeListingImageError(400, 'De aangeleverde inhoud is geen geldige XLSX-werkmap.');
  }
  return new Uint8Array(bytes);
}

export function assertManifestAlignment(plannedManifest, definition, configuration, theme) {
  const manifest = requireObject(plannedManifest, 'De afbeeldingsmanifestatie');
  if (
    manifest.productId !== definition.id
    || manifest.productVersion !== definition.version
    || manifest.locale !== configuration.locale
    || manifest.theme !== theme.id
  ) {
    throw new NativeListingImageError(409, 'De afbeeldingsmanifestatie hoort niet bij de geselecteerde productvariant.');
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length !== LISTING_IMAGE_BLUEPRINTS.length) {
    throw new NativeListingImageError(409, `De afbeeldingsmanifestatie moet exact ${LISTING_IMAGE_BLUEPRINTS.length} assets bevatten.`);
  }
  manifest.assets.forEach((asset, index) => {
    const blueprint = LISTING_IMAGE_BLUEPRINTS[index];
    const expectedFilename = LISTING_IMAGE_PATHS[index].split('/').at(-1);
    if (asset?.id !== blueprint.id || asset?.filename !== expectedFilename || asset?.order !== index + 1) {
      throw new NativeListingImageError(409, `Afbeeldingsasset ${index + 1} wijkt af van het productiecontract.`);
    }
  });
  return manifest;
}

function comparisonFilename(filename, appearance) {
  const stem = String(filename ?? 'workbook.xlsx')
    .replace(/\.xlsx$/iu, '')
    .replace(/-(?:light|dark)$/iu, '');
  return `${stem}-${appearance}.xlsx`;
}

async function comparisonWorkbook({ definition, configuration, localization, currencyProfile, generatedAt }) {
  const supported = definition.extensions?.supportedAppearances ?? [];
  if (!supported.includes('light') || !supported.includes('dark')) return null;
  const currentAppearance = configuration.extensions?.productAppearance === 'dark' ? 'dark' : 'light';
  const appearance = currentAppearance === 'dark' ? 'light' : 'dark';
  const comparisonConfiguration = runtime.configuration(definition.id, {
    ...configuration,
    filename: comparisonFilename(configuration.filename, appearance),
    extensions: { ...configuration.extensions, productAppearance: appearance },
  });
  const validation = runtime.validate(comparisonConfiguration);
  if (!validation.valid) throw new NativeListingImageError(409, 'De vergelijkingsvariant is niet geldig.');
  const comparisonTheme = resolveWorkbookTheme(themes[comparisonConfiguration.themeId], appearance);
  const generated = await generateWorkbook({
    definition,
    configuration: comparisonConfiguration,
    localization,
    currencyProfile,
    theme: comparisonTheme,
    ExcelJS,
    JSZip,
    generatedAt,
  });
  return generated.bytes;
}

function publicRendererResult(rendererResult) {
  return {
    schemaVersion: rendererResult.schemaVersion,
    status: rendererResult.status,
    renderMethod: rendererResult.renderMethod,
    excelVersion: rendererResult.excelVersion,
    renders: (rendererResult.renders ?? []).map(({ path, ...render }) => render),
    images: (rendererResult.images ?? []).map(({ path, ...image }) => image),
  };
}

async function renderRequest(payload) {
  const body = requireObject(payload, 'Het renderverzoek');
  const suppliedConfiguration = requireObject(body.configuration, 'De productconfiguratie');
  const configuration = runtime.configuration(suppliedConfiguration.productId, suppliedConfiguration);
  const validation = runtime.validate(configuration);
  if (!validation.valid) {
    throw new NativeListingImageError(409, 'De productconfiguratie is niet geldig voor native beeldgeneratie.');
  }
  const { definition, localization, currencyProfile, theme } = validation;
  const plannedManifest = assertManifestAlignment(body.plannedManifest, definition, configuration, theme);
  const workbookBytes = decodeWorkbookBase64(body.workbookBase64);
  const generatedAt = new Date(body.generatedAt ?? plannedManifest.generatedAt ?? Date.now()).toISOString();
  const comparisonWorkbookBytes = await comparisonWorkbook({
    definition,
    configuration,
    localization,
    currencyProfile,
    generatedAt,
  });
  const outputDirectory = await mkdtemp(join(tmpdir(), 'fpf-native-listing-'));
  try {
    const bundle = await renderExcelListingImages({
      plannedManifest,
      definition,
      configuration,
      theme,
      translate: runtime.translator(configuration.locale),
      workbookBytes,
      comparisonWorkbookBytes,
      outputDirectory,
    });
    return {
      ok: true,
      images: bundle.images.map(({ bytes, ...image }) => ({
        ...image,
        bytesBase64: Buffer.from(bytes).toString('base64'),
      })),
      manifest: bundle.manifest,
      validation: bundle.validation,
      rendererResult: publicRendererResult(bundle.rendererResult),
    };
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
}

export function renderNativeListingImages(payload) {
  const task = renderQueue.then(() => renderRequest(payload));
  renderQueue = task.catch(() => undefined);
  return task;
}
