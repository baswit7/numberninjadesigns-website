import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { imageProductionManifest } from '../src/commercial/package-engine.js';
import currencies from '../src/currencies/index.mjs';
import { createFactoryRuntime } from '../src/factory-runtime.js';
import locales from '../src/locales/index.mjs';
import { productDefinitions, productionProductDefinitions } from '../src/products/index.mjs';
import { renderExcelListingImages } from '../src/renderers/excel-workbook-renderer.mjs';
import themes, { resolveWorkbookTheme } from '../src/themes/index.mjs';
import { createTranslator, generateWorkbook } from '../src/engines/workbook-engine.js';
import { configurationForReleaseScenario, REQUIRED_RELEASE_SCENARIOS } from './validate-production-matrix.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'release-evidence/premium-rc-render-probe');
const generatedAt = '2026-07-16T00:00:00.000Z';
const runtime = createFactoryRuntime({ definitions: productDefinitions, locales, currencies, themes });
const scenario = REQUIRED_RELEASE_SCENARIOS.find(candidate => candidate.id === 'ultimate-nl-dark');
const definition = productionProductDefinitions.find(candidate => candidate.id === scenario.productId);
const configuration = configurationForReleaseScenario(runtime, scenario, { packageOutput: true, sampleDataEnabled: true });
const preflight = runtime.validate(configuration);
if (!preflight.valid) throw new Error('Premium render probe configuration failed preflight validation.');
const translate = createTranslator(preflight.localization);

await mkdir(output, { recursive: true });
const current = await generateWorkbook({
  definition,
  configuration,
  localization: preflight.localization,
  currencyProfile: preflight.currencyProfile,
  theme: preflight.theme,
  ExcelJS,
  JSZip,
  generatedAt,
});
const comparisonAppearance = configuration.extensions.productAppearance === 'dark' ? 'light' : 'dark';
const comparisonConfiguration = {
  ...configuration,
  filename: configuration.filename.replace(/-(?:light|dark)\.xlsx$/u, `-${comparisonAppearance}.xlsx`),
  extensions: { ...configuration.extensions, productAppearance: comparisonAppearance },
};
const comparison = await generateWorkbook({
  definition,
  configuration: comparisonConfiguration,
  localization: preflight.localization,
  currencyProfile: preflight.currencyProfile,
  theme: resolveWorkbookTheme(themes[configuration.themeId], comparisonAppearance),
  ExcelJS,
  JSZip,
  generatedAt,
});
const plannedManifest = imageProductionManifest(definition, configuration, preflight.theme, translate, generatedAt);
const rendered = await renderExcelListingImages({
  plannedManifest,
  definition,
  configuration,
  theme: preflight.theme,
  translate,
  workbookBytes: current.bytes,
  comparisonWorkbookBytes: comparison.bytes,
  outputDirectory: output,
});
await writeFile(resolve(output, configuration.filename), current.bytes);
await writeFile(resolve(output, 'probe-summary.json'), `${JSON.stringify({
  status: rendered.validation.status,
  renderMethod: rendered.manifest.extensions.renderMethod,
  workbookSha256: rendered.manifest.extensions.workbookSha256,
  images: rendered.manifest.assets.map(asset => ({ path: asset.packagePath, bytes: asset.bytes, sha256: asset.sha256 })),
  renderer: rendered.rendererResult,
}, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: rendered.validation.status, images: rendered.images.length, output }, null, 2));
