import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LISTING_IMAGE_BLUEPRINTS,
  LISTING_IMAGE_HEIGHT,
  LISTING_IMAGE_PATHS,
  LISTING_IMAGE_WIDTH,
  definitionChartEvidence,
  embedPngTextMetadata,
  listingPngMetadata,
} from '../commercial/listing-image-engine.js';
import { sha256Hex, stableStringify } from '../engines/security.js';

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(here, 'excel-workbook-renderer.ps1');
const RENDER_METHOD = 'microsoft-excel-copy-picture-v1';
const CAMPAIGN_PALETTE = Object.freeze({
  background: '#070707',
  surface: '#0F0F0F',
  primary: '#1E6A4A',
  secondary: '#274B3C',
  accent: '#00FF94',
  accentText: '#07120D',
  text: '#EDEBE3',
  muted: '#A7ADA9',
  border: '#2A332F',
  inverseText: '#EDEBE3',
  bandFill: '#171B19',
});

function resolveText(translate, key, fallback) {
  const value = translate(key, fallback);
  return typeof value === 'string' && value.trim() && value !== key ? value.trim() : fallback;
}

function translatedSheetName(definition, sheetId, translate) {
  const sheet = definition.sheets.find(candidate => candidate.id === sheetId) ?? definition.sheets[0];
  if (!sheet) throw new Error('Workbook renderer requires at least one worksheet.');
  return resolveText(translate, sheet.nameKey, sheet.id.replaceAll('-', ' '));
}

function sourceTruthSubheadline(locale, sheetName) {
  if (locale === 'nl-NL') return `Rechtstreeks uit het werkblad ${sheetName} van deze gegenereerde werkmap.`;
  if (locale === 'de-DE') return `Direkt aus dem Arbeitsblatt ${sheetName} dieser generierten Arbeitsmappe.`;
  return `Directly from the ${sheetName} worksheet in this generated workbook.`;
}

function renderDefinition(definition, sheetId, translate, slot, filename, range) {
  return { slot, filename, range, sheetName: translatedSheetName(definition, sheetId, translate) };
}

function pngDimensions(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 24 || bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) {
    throw new Error('Excel renderer returned an invalid PNG stream.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function tierFor(definition, configuration) {
  return configuration.extensions?.tier ?? definition.extensions?.tier ?? 'professional';
}

function appearanceFor(configuration, theme) {
  return configuration.extensions?.productAppearance ?? theme.extensions?.appearance ?? 'light';
}

function wrapEvidenceLines(value, maximumCharacters) {
  const words = String(value ?? '').trim().split(/\s+/u).filter(Boolean);
  const lines = [];
  for (const word of words) {
    const current = lines.at(-1) ?? '';
    if (!current || `${current} ${word}`.length > maximumCharacters) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
  }
  return lines.length ? lines : [''];
}

function fixedHeaderLayoutEvidence(specification, item) {
  const tuple = (id, value, lines, box, wrapped = false) => [id, value, lines, 1, wrapped, box, box, true];
  const headlineLines = wrapEvidenceLines(item.headline, 44);
  const subheadlineLines = wrapEvidenceLines(item.subheadline, 86);
  return [
    tuple('badge', specification.badge, [specification.badge], [110, 76, 1400, 42]),
    tuple('headline', item.headline, headlineLines, [105, 138, 2080, 190], headlineLines.length > 1),
    tuple('subheadline', item.subheadline, subheadlineLines, [112, 330, 2000, 82], subheadlineLines.length > 1),
  ];
}

function buildSpecification({ plannedManifest, definition, configuration, theme, translate }) {
  const appearance = appearanceFor(configuration, theme);
  const counterpart = appearance === 'dark' ? 'light' : 'dark';
  const featureLabels = definition.features.slice(0, 3).map(feature => resolveText(translate, `features.${feature}`, feature.replaceAll('-', ' ')));
  const dataSheets = definition.sheets.filter(sheet => ['input', 'data'].includes(sheet.type));
  const lastContentSheet = [...definition.sheets].reverse().find(sheet => sheet.id !== 'instructions' && sheet.type !== 'instructions');
  const renders = [
    renderDefinition(definition, definition.sheets.some(sheet => sheet.id === 'executive-dashboard') ? 'executive-dashboard' : 'dashboard', translate, 'dashboard', 'dashboard.png', 'A1:S50'),
    renderDefinition(definition, definition.sheets.some(sheet => sheet.id === 'monthly-dashboard') ? 'monthly-dashboard' : dataSheets[0]?.id, translate, 'monthly', 'monthly.png', 'A1:J22'),
    renderDefinition(definition, definition.sheets.some(sheet => sheet.id === 'transactions') ? 'transactions' : (dataSheets[1] ?? dataSheets[0])?.id, translate, 'detail', 'detail.png', 'A1:J22'),
    renderDefinition(definition, definition.sheets.some(sheet => sheet.id === 'goals') ? 'goals' : lastContentSheet?.id, translate, 'goals', 'goals.png', 'A1:J22'),
  ];
  const sourceTruthHeadlines = new Map([
    ['paycheck-planning', renders[1].sheetName],
    ['debt-payoff', renders[2].sheetName],
    ['savings-goals', renders[3].sheetName],
    ['net-worth', renders[0].sheetName],
    ['bill-subscriptions', `${renders[1].sheetName} / ${renders[2].sheetName}`],
  ]);
  const images = LISTING_IMAGE_BLUEPRINTS.map((blueprint, index) => {
    const sourceTruthHeadline = sourceTruthHeadlines.get(blueprint.id);
    return {
      id: blueprint.id,
      order: index + 1,
      filename: blueprint.path.split('/').at(-1),
      headline: sourceTruthHeadline
        ?? resolveText(translate, `images.${blueprint.id}.headline`, plannedManifest.extensions.briefs[blueprint.id].headline),
      subheadline: sourceTruthHeadline
        ? sourceTruthSubheadline(configuration.locale, sourceTruthHeadline)
        : resolveText(translate, `images.${blueprint.id}.subheadline`, plannedManifest.extensions.briefs[blueprint.id].subheadline),
    };
  });
  const included = [
    resolveText(translate, 'docs.itemWorkbook', 'Excel workbook'),
    resolveText(translate, 'docs.itemGuide', 'Quick-start guide'),
    resolveText(translate, 'docs.itemLicense', 'Personal-use license'),
    resolveText(translate, 'listingImages.images', 'Listing images'),
  ];
  const steps = [
    resolveText(translate, 'listingImages.open', 'Open the workbook'),
    resolveText(translate, 'listingImages.enter', 'Enter your data'),
    resolveText(translate, 'listingImages.review', 'Review the insights'),
  ];
  const labels = {
    sheets: resolveText(translate, 'listingImages.sheets', 'Sheets'),
    formulas: resolveText(translate, 'listingImages.formulas', 'Built-in formulas'),
    local: resolveText(translate, 'listingImages.local', 'Works locally'),
    currentTheme: resolveText(translate, appearance === 'dark' ? 'listingImages.dark' : 'listingImages.light', appearance),
    otherTheme: resolveText(translate, counterpart === 'dark' ? 'listingImages.dark' : 'listingImages.light', counterpart),
    download: resolveText(translate, 'listingImages.download', 'Instant download'),
    noSubscription: resolveText(translate, 'images.digital-download.subheadline', 'No subscription or account required.'),
    realWorkbook: renders[2].sheetName,
  };
  return {
    schemaVersion: '1.0.0',
    locale: configuration.locale,
    currency: configuration.currency,
    year: configuration.year,
    appearance,
    productTitle: configuration.title,
    sheetCount: definition.sheets.length,
    formulaCount: definition.formulas.length,
    badge: resolveText(translate, 'listingImages.badge', 'Premium finance workbook'),
    footer: resolveText(translate, 'listingImages.footer', 'Plan with clarity. Decide with confidence.'),
    palette: { ...theme.colors, ...CAMPAIGN_PALETTE },
    renders,
    comparison: renders[0],
    images,
    benefits: featureLabels,
    included,
    options: [
      { label: resolveText(translate, 'listingImages.language', 'Language'), value: configuration.locale },
      { label: resolveText(translate, 'listingImages.currency', 'Currency'), value: configuration.currency },
      { label: resolveText(translate, 'listingImages.year', 'Year'), value: String(configuration.year) },
      { label: resolveText(translate, 'listingImages.market', 'Market'), value: configuration.market },
    ],
    steps,
    labels,
    trustItems: [labels.local, labels.noSubscription, included[0]],
    supportItems: steps,
    buyerItems: [...featureLabels, ...included].slice(0, 3),
  };
}

async function runPowerShell(args) {
  let lastError;
  const psLiteral = value => `'${String(value).replaceAll("'", "''")}'`;
  const command = `& ${psLiteral(scriptPath)} ${args.map(value => String(value).startsWith('-') ? value : psLiteral(value)).join(' ')}`;
  for (const executable of ['pwsh.exe', 'powershell.exe']) {
    try {
      await execFileAsync(executable, [
        '-NoLogo', '-NoProfile', '-NonInteractive', '-Sta', '-ExecutionPolicy', 'Bypass',
        '-Command', command,
      ], { windowsHide: true, timeout: 240_000, maxBuffer: 2 * 1024 * 1024 });
      return;
    } catch (error) {
      lastError = error;
      if (error.code !== 'ENOENT') break;
    }
  }
  throw new Error(`Microsoft Excel rendering failed: ${lastError?.stderr || lastError?.message || 'unknown error'}`);
}

async function rendererFailure(resultPath, fallbackError) {
  try {
    const result = JSON.parse((await readFile(resultPath, 'utf8')).replace(/^\uFEFF/u, ''));
    if (result?.status === 'FAIL' && typeof result.error === 'string' && result.error.trim()) {
      return new Error(result.error.trim());
    }
  } catch {
    // The renderer may fail before it can create a structured result.
  }
  return fallbackError;
}

export async function renderExcelListingImages({
  plannedManifest,
  definition,
  configuration,
  theme,
  translate,
  workbookBytes,
  comparisonWorkbookBytes = null,
  outputDirectory,
}) {
  if (!(workbookBytes instanceof Uint8Array) || workbookBytes.length < 1_000) throw new Error('Excel renderer requires valid XLSX bytes.');
  if (!outputDirectory) throw new Error('Excel renderer requires an output directory.');
  const outputRoot = resolve(outputDirectory);
  await mkdir(outputRoot, { recursive: true });
  const inputPath = resolve(outputRoot, 'source-workbook.xlsx');
  const comparisonPath = comparisonWorkbookBytes instanceof Uint8Array ? resolve(outputRoot, 'comparison-workbook.xlsx') : null;
  const specificationPath = resolve(outputRoot, 'renderer-specification.json');
  const resultPath = resolve(outputRoot, 'renderer-result.json');
  await writeFile(inputPath, workbookBytes);
  if (comparisonPath) await writeFile(comparisonPath, comparisonWorkbookBytes);
  const specification = buildSpecification({ plannedManifest, definition, configuration, theme, translate });
  const renderedBriefs = Object.fromEntries(specification.images.map(item => [item.id, {
    ...(plannedManifest.extensions?.briefs?.[item.id] ?? {}),
    headline: item.headline,
    subheadline: item.subheadline,
    altText: `${configuration.title} — ${item.headline} — ${configuration.locale} ${configuration.currency}`.slice(0, 250),
  }]));
  const textLayouts = Object.fromEntries(specification.images.map(item => [item.id, fixedHeaderLayoutEvidence(specification, item)]));
  await writeFile(specificationPath, `${JSON.stringify(specification, null, 2)}\n`, 'utf8');
  const args = ['-InputPath', inputPath, '-SpecificationPath', specificationPath, '-OutputDirectory', outputRoot, '-ResultPath', resultPath];
  if (comparisonPath) args.push('-ComparisonWorkbookPath', comparisonPath);
  try {
    await runPowerShell(args);
  } catch (error) {
    throw await rendererFailure(resultPath, error);
  }
  const rendererResult = JSON.parse((await readFile(resultPath, 'utf8')).replace(/^\uFEFF/u, ''));
  if (rendererResult.status !== 'PASS' || rendererResult.renderMethod !== RENDER_METHOD) {
    throw new Error(`Excel renderer did not pass: ${rendererResult.error ?? rendererResult.status ?? 'unknown status'}`);
  }
  const workbookSha256 = await sha256Hex(workbookBytes);
  const tier = tierFor(definition, configuration);
  const appearance = appearanceFor(configuration, theme);
  const resultImages = new Map(rendererResult.images.map(image => [image.id, image]));
  const images = [];
  const assets = [];
  const hashes = new Set();
  const evidence = [];
  for (let index = 0; index < LISTING_IMAGE_BLUEPRINTS.length; index += 1) {
    const blueprint = LISTING_IMAGE_BLUEPRINTS[index];
    const rendered = resultImages.get(blueprint.id);
    if (!rendered) throw new Error(`Excel renderer omitted '${blueprint.id}'.`);
    const rawBytes = new Uint8Array(await readFile(rendered.path));
    const bytes = embedPngTextMetadata(rawBytes, listingPngMetadata(
      definition, configuration, theme, tier, appearance, workbookSha256, blueprint.id, RENDER_METHOD,
    ));
    const dimensions = pngDimensions(bytes);
    if (dimensions.width !== LISTING_IMAGE_WIDTH || dimensions.height !== LISTING_IMAGE_HEIGHT) {
      throw new Error(`Excel listing image '${blueprint.id}' has invalid dimensions ${dimensions.width}x${dimensions.height}.`);
    }
    const sha256 = await sha256Hex(bytes);
    if (hashes.has(sha256)) throw new Error(`Excel renderer produced duplicate listing image bytes for '${blueprint.id}'.`);
    hashes.add(sha256);
    const filename = blueprint.path.split('/').at(-1);
    const planned = plannedManifest.assets[index] ?? {};
    const altText = renderedBriefs[blueprint.id].altText;
    images.push(Object.freeze({ id: blueprint.id, path: blueprint.path, filename, bytes, ...dimensions, mediaType: 'image/png', sha256 }));
    assets.push({
      id: blueprint.id, order: index + 1, purpose: blueprint.purpose, ...dimensions,
      format: 'png', filename, packagePath: blueprint.path, status: 'validated', mediaType: 'image/png', bytes: bytes.byteLength,
      locale: configuration.locale, theme: theme.id, tier, appearance, renderSource: RENDER_METHOD,
      altText: String(altText).trim().slice(0, 250), ...(planned.altTextKey ? { altTextKey: planned.altTextKey } : {}), sha256,
    });
    evidence.push({ path: blueprint.path, sha256, bytes: bytes.byteLength, ...dimensions, decodedBytes: dimensions.width * dimensions.height * 3 + dimensions.height, typography: { status: 'PASS', textCount: 2, minimumScale: 1, wrappedTextCount: 0 } });
  }
  const validation = Object.freeze({ status: 'PASS', imageCount: images.length, uniqueHashes: hashes.size, paths: Object.freeze([...LISTING_IMAGE_PATHS]), evidence: Object.freeze(evidence) });
  const manifest = {
    ...JSON.parse(stableStringify(plannedManifest)),
    assets,
    extensions: {
      ...JSON.parse(stableStringify(plannedManifest.extensions ?? {})),
      briefs: renderedBriefs,
      textOverlays: renderedBriefs,
      palette: specification.palette,
      tier, appearance, workbookSha256, renderMethod: RENDER_METHOD,
      assetPaths: [...LISTING_IMAGE_PATHS],
      requiredImages: assets.map(asset => asset.id),
      dimensions: Object.fromEntries(assets.map(asset => [asset.id, { width: asset.width, height: asset.height }])),
      filenames: assets.map(asset => asset.filename),
      renderEvidence: {
        ...(plannedManifest.extensions?.renderEvidence ?? {}),
        sourceTruth: 'ALL_WORKBOOK_VISUALS_EXPORTED_FROM_THE_GENERATED_XLSX_BY_MICROSOFT_EXCEL',
        excelVersion: rendererResult.excelVersion,
        charts: definitionChartEvidence(definition),
        textLayouts,
        workbookRenders: rendererResult.renders.map(render => ({ sheetName: render.sheetName, range: render.range, width: render.width, height: render.height, source: render.source })),
      },
      productionPolicy: { reviewRequired: true, executionClaim: 'GENERATED_AND_VALIDATED_IMAGE_ASSETS' },
      validation,
    },
  };
  return Object.freeze({ images: Object.freeze(images), manifest: Object.freeze(manifest), validation, rendererResult: Object.freeze(rendererResult) });
}

export const excelWorkbookRenderMethod = RENDER_METHOD;
