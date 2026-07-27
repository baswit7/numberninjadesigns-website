import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { requiredUiMessageKeys } from '../src/locales/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIRECTORY = path.join(ROOT, 'apps', 'product-factory');
const HTML_PATH = path.join(APP_DIRECTORY, 'index.html');
const JS_PATH = path.join(APP_DIRECTORY, 'app.js');
const CSS_PATH = path.join(APP_DIRECTORY, 'styles.css');
const html = readFileSync(HTML_PATH, 'utf8');
const javascript = readFileSync(JS_PATH, 'utf8');
const css = readFileSync(CSS_PATH, 'utf8');

const matches = (source, expression) => [...source.matchAll(expression)];

test('frontend JavaScript parses and every static import resolves locally', () => {
  const syntax = spawnSync(process.execPath, ['--check', JS_PATH], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

  const imports = matches(javascript, /\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]/g).map(match => match[1]);
  assert.ok(imports.length > 0);
  for (const specifier of imports) {
    assert.ok(existsSync(path.resolve(APP_DIRECTORY, specifier)), `missing import ${specifier}`);
  }
});

test('DOM ids are unique and cover every literal JavaScript lookup', () => {
  const ids = matches(html, /\bid="([^"]+)"/g).map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate HTML id');
  const referencedIds = new Set(matches(javascript, /\$\('([^']+)'\)/g).map(match => match[1]));
  for (const id of referencedIds) assert.ok(ids.includes(id), `missing DOM id ${id}`);

  for (const match of matches(html, /\baria-labelledby="([^"]+)"/g)) {
    for (const id of match[1].split(/\s+/)) assert.ok(ids.includes(id), `aria-labelledby references missing id ${id}`);
  }
});

test('static assets and navigation targets remain offline and repository-local', () => {
  const references = matches(html, /\b(?:src|href)="([^"]+)"/g).map(match => match[1]);
  for (const reference of references) {
    if (reference.startsWith('#')) continue;
    assert.doesNotMatch(reference, /^(?:https?:)?\/\//i, `external asset ${reference}`);
    assert.ok(existsSync(path.resolve(APP_DIRECTORY, reference)), `missing local asset ${reference}`);
  }
  assert.doesNotMatch(javascript, /\b(?:WebSocket|EventSource)\s*\(/, 'streaming network API in local app');
  assert.doesNotMatch(javascript, /fetch\s*\(\s*['"]https?:/i, 'external fetch in local app');
  assert.match(javascript, /new URL\('\/api\/output', window\.location\.origin\)/, 'missing same-origin output storage route');

  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1] ?? '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.doesNotMatch(csp, /'unsafe-(?:inline|eval)'|https?:/);
});

test('DOM updates avoid executable HTML sinks and inline event handlers', () => {
  assert.doesNotMatch(javascript, /\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval)\b|new\s+Function\b/);
  assert.doesNotMatch(html, /\son[a-z]+\s*=|javascript:/i);
});

test('static form controls are labelled and buttons declare their behavior', () => {
  const labelRanges = matches(html, /<label\b[^>]*>[\s\S]*?<\/label>/gi)
    .map(match => [match.index, match.index + match[0].length]);
  for (const control of matches(html, /<(?:input|select|textarea)\b[^>]*>/gi)) {
    const nested = labelRanges.some(([start, end]) => control.index > start && control.index < end);
    const id = control[0].match(/\bid="([^"]+)"/i)?.[1];
    const explicitlyLabelled = id && new RegExp(`<label\\b[^>]*\\bfor="${id}"`, 'i').test(html);
    assert.ok(nested || explicitlyLabelled || /\baria-label(?:ledby)?=/i.test(control[0]), `unlabelled control ${control[0]}`);
  }
  for (const button of matches(html, /<button\b[^>]*>/gi)) {
    assert.match(button[0], /\btype="(?:button|submit|reset)"/i, `implicit button type ${button[0]}`);
  }
});

test('keyboard composites, tabs, progress and stale-state resets are wired', () => {
  assert.match(html, /id="connectionStatus"[^>]*data-state="busy"/);
  assert.ok(matches(javascript, /moveCompositeFocus\(event, 'radio'\)/g).length >= 2, 'radio groups lack arrow-key wiring');
  assert.match(javascript, /moveCompositeFocus\(event, 'tab'\)/);
  assert.match(javascript, /role: 'tabpanel'/);
  assert.match(javascript, /heading\.scope = 'col'/);
  assert.match(html, /id="generationProgress"[^>]*role="progressbar"[^>]*aria-valuenow="0"/);
  assert.match(javascript, /dialog\.returnValue = ''/);
  assert.match(javascript, /input\[name="decision"\][^\n]+checked = false/);
  assert.match(javascript, /\$\('qualityOrb'\)\.setAttribute\('aria-label', translate\('ui\.a11y\.qualityNotCalculated'\)\)/);
});

test('generator UI is fixed to Dutch while product locale rerenders only product-dependent surfaces', () => {
  const required = new Set(requiredUiMessageKeys);
  const htmlKeys = matches(html, /\bdata-i18n(?:-placeholder|-aria-label)?="([^"]+)"/g).map(match => match[1]);
  const javascriptKeys = matches(javascript, /['"](ui\.[a-zA-Z0-9_.-]+)['"]/g).map(match => match[1]);
  assert.ok(htmlKeys.length >= 60, 'too few keyed static UI messages');
  for (const key of [...htmlKeys, ...javascriptKeys]) assert.ok(required.has(key), `missing UI catalog key ${key}`);

  assert.match(javascript, /const STEPS = Object\.freeze\(\[\s*\['ui\.step\.product', 'ui\.stepDescription\.product'\]/);
  assert.match(javascript, /const GENERATOR_LOCALE = 'nl-NL'/);
  assert.match(javascript, /document\.documentElement\.lang = GENERATOR_LOCALE/);
  assert.match(javascript, /function translate\([^)]*\) \{[\s\S]*?localeCatalog\[GENERATOR_LOCALE\]/);
  const localeChangeBlock = javascript.match(/if \(targetId === 'locale'\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(localeChangeBlock, 'locale change block missing');
  assert.doesNotMatch(localeChangeBlock, /applyStaticTranslations|renderProducts|renderThemes/);
  assert.match(localeChangeBlock, /syncDependentControls/);
  assert.match(javascript, /GENERATION_STAGE_KEYS\[event\.stage\]/);
  assert.doesNotMatch(javascript, /generationStatus'\)\.textContent = event\.message/);
});

test('generator appearance is light-first, persisted separately and never derived from product configuration', () => {
  assert.match(html, /<html[^>]*lang="nl-NL"[^>]*data-generator-appearance="light"/);
  assert.match(html, /name="color-scheme"\s+content="light dark"/);
  assert.match(html, /id="generatorAppearance"/);
  assert.match(html, /name="generatorAppearance"\s+value="light"\s+checked/);
  assert.match(html, /name="generatorAppearance"\s+value="dark"/);
  assert.match(javascript, /loadUiPreferences/);
  assert.match(javascript, /saveUiPreferences/);
  assert.match(javascript, /document\.documentElement\.dataset\.generatorAppearance = appearance/);
  assert.doesNotMatch(javascript, /generatorAppearance\s*=\s*state\.configuration\.(?:locale|themeId)/);
  assert.match(css, /^:root\s*\{[\s\S]*?color-scheme:\s*light/m);
  assert.match(css, /:root\[data-generator-appearance="dark"\]\s*\{[\s\S]*?color-scheme:\s*dark/);
  const lightBackground = css.match(/^:root\s*\{[\s\S]*?--bg:\s*([^;]+);/m)?.[1]?.trim();
  const darkBackground = css.match(/:root\[data-generator-appearance="dark"\]\s*\{[\s\S]*?--bg:\s*([^;]+);/)?.[1]?.trim();
  assert.ok(lightBackground && darkBackground, 'appearance backgrounds must be declared');
  assert.notEqual(lightBackground, darkBackground, 'light and dark appearances must render differently');
  assert.match(html, /data-generator-appearance-value="light"[^>]*aria-pressed="true"/);
  assert.match(html, /data-generator-appearance-value="dark"[^>]*aria-pressed="false"/);
  assert.match(javascript, /data-generator-appearance-value/);
});

test('workbook appearance is an independent product dimension with Basic fail-safe', () => {
  assert.match(html, /id="productAppearance"/);
  assert.match(html, /name="productAppearance"\s+value="light"\s+checked/);
  assert.match(html, /name="productAppearance"\s+value="dark"/);
  assert.match(javascript, /next\.extensions\s*=\s*\{\s*\.\.\.next\.extensions,\s*productAppearance:\s*event\.target\.value\s*\}/);
  assert.match(javascript, /supportedAppearances\.includes\(input\.value\)/);
  assert.match(javascript, /variantWorkbookFilename/);
  assert.doesNotMatch(javascript, /generatorAppearance\s*=\s*event\.target\.value[^\n]+productAppearance/);
});

test('export step presents semantic workbook and sales-package cards with stable download actions', () => {
  for (const id of ['workbookOutputCard', 'packageOutputCard', 'workbookOutputName', 'packageOutputName', 'downloadWorkbook', 'downloadPackage', 'packageContents', 'packageFileList', 'listingImages', 'listingImageGrid', 'listingImageCount', 'downloadImages']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(css, /\.output-grid\s*\{/);
  assert.match(css, /\.output-card\s*\{/);
  assert.match(css, /\.listing-image-grid\s*\{/);
  assert.match(css, /\.listing-image-card img\s*\{[^}]*width:\s*100%;[^}]*height:\s*auto;[^}]*max-width:\s*100%;[^}]*aspect-ratio:\s*3\s*\/\s*2;[^}]*object-fit:\s*contain;/s);
  assert.match(javascript, /\^listing\\\/images\\\/\[\^\/\]\+\\\.\(\?:png\|jpe\?g\)/);
  assert.match(javascript, /URL\.createObjectURL/);
  assert.match(javascript, /URL\.revokeObjectURL/);
  assert.match(javascript, /commercialPackage\.imageValidation\?\.status === 'PASS'/);
  assert.match(javascript, /commercialPackage\.packageValidation\?\.status === 'PASS'/);
  assert.match(javascript, /hasExactListingImagePaths/);
  assert.match(javascript, /LISTING_IMAGE_PATHS/);
  assert.match(javascript, /kind: 'images'/);
  assert.match(javascript, /kind: 'image'/);
  assert.match(javascript, /new URL\('\/api\/output', window\.location\.origin\)/);
  assert.doesNotMatch(html, /class="file-tree"/);
});

test('generated ZIP remains downloadable while release approval stays independently gated', () => {
  assert.match(javascript, /function packageDownloadReady\(commercialPackage\)/);
  assert.match(javascript, /const packageGenerated = packageDownloadReady\(commercialPackage\)/);
  assert.match(javascript, /\$\('downloadPackage'\)\.disabled = !packageGenerated/);
  assert.match(javascript, /\$\('packageContents'\)\.hidden = !packageGenerated/);
  assert.match(javascript, /async function downloadPackage\(\)\s*\{\s*const commercialPackage = state\.generation\?\.package;\s*if \(!packageDownloadReady\(commercialPackage\)\)/s);
  assert.match(javascript, /const packageReady = packageReleaseReady\(generation, commercialPackage\)/);
  assert.match(javascript, /packageReady \? 'ready' : packageGenerated \? 'review' : 'idle'/);
  assert.match(css, /\.output-card\[data-state="review"\]/);
});

test('managed generation automatically saves XLSX and ZIP to their deterministic project directory', () => {
  assert.match(javascript, /async function persistGeneratedPrimaryOutputs\(generation\)/);
  assert.match(javascript, /outputProfile !== 'repository-release'\) return true/);
  assert.match(javascript, /kind: 'workbook'[\s\S]+kind: 'package'[\s\S]+kind: 'images'/);
  assert.match(javascript, /allowBrowserFallback: false/);
  assert.match(javascript, /const primaryOutputsSaved = await persistGeneratedPrimaryOutputs\(state\.generation\)/);
  assert.match(javascript, /primaryOutputsSaved \? 'ready' : 'error'/);
  assert.match(javascript, /workbookSaved \? 'ui\.status\.saved'/);
  assert.match(javascript, /workbookSaved \? 'XLSX opnieuw opslaan'/);
  assert.match(javascript, /packageSaved \? translate\('ui\.output\.rebuildArchive'\)/);
  assert.match(javascript, /EXTRACTED_ZIP_KINDS = new Set\(\['package', 'images', 'batch'\]\)/);
  assert.match(javascript, /payload\.extracted\?\.status !== 'EXTRACTED'/);
  assert.match(javascript, /renderSavedOutputLocation/);
  assert.match(javascript, /ui\.output\.extractedAt/);
});

test('browser generation requires native source-truth listing images', () => {
  assert.doesNotMatch(javascript, /allowSyntheticListingImagesForReview:\s*true/);
  assert.match(
    javascript,
    /state\.generation = await factory\.generate\(state\.configuration,\s*\{[\s\S]*?listingImageProvider:\s*nativeListingImageProvider,[\s\S]*?onProgress:/,
  );
  assert.match(
    javascript,
    /return factory\.generate\(configuration,\s*\{[\s\S]*?listingImageProvider:\s*nativeListingImageProvider,[\s\S]*?\}\);/,
  );
  assert.match(javascript, /fetch\('\/api\/native-listing-images'/);
  assert.match(javascript, /REQUIRED_LISTING_IMAGE_PATHS = Object\.freeze\(\[\.\.\.LISTING_IMAGE_PATHS\]\)/);
});

test('creator dashboard exposes document generation, document preview, validated DOCX saving and full help', () => {
  for (const id of ['filenameExtension', 'documentContent', 'documentTemplateList', 'documentOutputs', 'documentOutputList', 'openManual', 'manualDialog']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /Word · Google Docs-import/);
  assert.match(javascript, /function localizedDocumentTemplates/);
  assert.match(javascript, /state\.preview\.type === 'document'/);
  assert.match(javascript, /kind: 'document'/);
  assert.match(javascript, /mediaType: artifact\.mediaType/);
  assert.match(javascript, /DOCUMENTS_GENERATED/);
  assert.match(javascript, /generation\.documents\?\.artifacts/);
  assert.match(javascript, /\.\.\.\(imageManifestsRequired \? \['listing\/alt-texts\.txt'\] : \[\]\)/);
  assert.match(html, /Complete bedieningshandleiding/);
  assert.match(html, /De 12 productiestappen/);
  assert.match(css, /\.document-output-row\s*\{/);
  assert.match(css, /\.manual-actions\s*\{/);
});

test('generator exposes platform, start-month and real output-destination controls', () => {
  for (const id of ['platformProfile', 'startMonth', 'outputProfile']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
    assert.match(javascript, new RegExp(`\\$\\('${id}'\\)`));
  }
  assert.match(html, /google-sheets-compatible/);
  assert.match(javascript, /outputProfile === 'browser-download'/);
});

test('rendered step-four defaults are committed to configuration state', () => {
  assert.match(javascript, /function commitRenderedConfigurationDefaults\(\)/);
  assert.match(javascript, /startMonth,\s*outputProfile,/s);
  assert.match(javascript, /\$\('outputProfile'\)\.value\s*=\s*state\.configuration\.extensions\?\.outputProfile\s*\?\?\s*'repository-release';\s*commitRenderedConfigurationDefaults\(\);/s);
});

test('responsive CSS preserves management access and visible focus', () => {
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
  assert.doesNotMatch(css, /#openSettings\s*\{[^}]*display\s*:\s*none/i);
  assert.match(css, /\.settings-panel\s*\{[^}]*overflow-y\s*:\s*auto/i);
  assert.match(css, /\.product-card:focus-visible/);
  assert.match(css, /\.theme-card:focus-visible/);
  assert.match(css, /\.preview-tabs button:focus-visible/);
  assert.match(css, /\.step-button \.step-label\s*\{[^}]*white-space\s*:\s*normal/i);
  assert.doesNotMatch(css, /\.step-button \.step-label\s*\{[^}]*display\s*:\s*none/i);
  assert.match(css, /\.step-actions\s*\{[^}]*position\s*:\s*sticky/i);
  assert.match(css, /@media\s*\(max-width:\s*420px\)/);
  assert.equal((css.match(/\{/g) ?? []).length, (css.match(/\}/g) ?? []).length, 'unbalanced CSS braces');
});
