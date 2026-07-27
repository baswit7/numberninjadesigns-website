import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import JSZip from 'jszip';
import {
  LISTING_IMAGE_BLUEPRINTS,
  LISTING_IMAGE_PATHS,
  generateListingImages,
  inspectListingPng,
  layoutListingText,
  measureListingText,
  validateListingImageSet,
} from '../src/commercial/listing-image-engine.js';
import { localeCatalog } from '../src/locales/index.mjs';
import { productDefinitionById } from '../src/products/index.mjs';
import { resolveWorkbookTheme, themeCatalog } from '../src/themes/index.mjs';
import { stableStringify } from '../src/engines/security.js';

const definition = productDefinitionById['budget-planner-basic'];
const configuration = structuredClone(definition.defaultConfiguration);
const theme = themeCatalog[configuration.themeId];
const workbookBytes = new Uint8Array(4_096);
for (let index = 0; index < workbookBytes.length; index += 1) workbookBytes[index] = (index * 37 + 19) % 256;
workbookBytes.set([0x50, 0x4b, 0x03, 0x04], 0);

function translate(key) {
  return localeCatalog[configuration.locale].messages[key] ?? key;
}

function createTranslate(locale) {
  return key => localeCatalog[locale].messages[key] ?? key;
}

function plannedManifestFor(productDefinition = definition, productConfiguration = configuration, productTheme = theme, translateCopy = translate) {
  const briefs = Object.fromEntries(LISTING_IMAGE_BLUEPRINTS.map((blueprint, index) => [blueprint.id, {
    headline: productConfiguration.title,
    subheadline: translateCopy(productDefinition.descriptionKey),
    altText: `${productConfiguration.title} — ${translateCopy(`listingImages.${blueprint.id === 'dashboard-overview' ? 'dashboard' : 'previews'}`)} — ${index + 1}`,
  }]));
  return {
    schemaVersion: '1.0.0',
    productId: productDefinition.id,
    productVersion: productDefinition.version,
    locale: productConfiguration.locale,
    theme: productTheme.id,
    generatedAt: '2026-07-15T10:30:00.000Z',
    assets: LISTING_IMAGE_BLUEPRINTS.map((blueprint, index) => ({
      id: blueprint.id,
      order: index + 1,
      purpose: blueprint.purpose,
      width: 2400,
      height: 1600,
      format: 'png',
      filename: blueprint.path.split('/').at(-1),
      status: 'required',
      sha256: null,
    })),
    extensions: {
      briefs,
      requiredImages: LISTING_IMAGE_BLUEPRINTS.map(item => item.id),
      dimensions: Object.fromEntries(LISTING_IMAGE_BLUEPRINTS.map(item => [item.id, { width: 2400, height: 1600 }])),
      filenames: LISTING_IMAGE_PATHS.map(path => path.split('/').at(-1)),
      exportFormats: ['png'],
      productionPolicy: { reviewRequired: true, executionClaim: 'GENERATION_REQUIRED_BEFORE_PACKAGE_COMPLETION' },
    },
  };
}

function plannedManifest() {
  return plannedManifestFor();
}

const generationArguments = {
  plannedManifest: plannedManifest(),
  definition,
  configuration,
  theme,
  translate,
  workbookBytes,
  validationReport: { status: 'PASS' },
  JSZip,
};

let generatedPromise;
function generated() {
  generatedPromise ??= generateListingImages(generationArguments);
  return generatedPromise;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function flattenedText(image) {
  return image.layoutEvidence.map(entry => entry.text).join('\n');
}

test('measures the exact 5x7 glyph geometry and fails closed when copy cannot fit', () => {
  assert.deepEqual(measureListingText('AB', 2), { text: 'AB', width: 22, height: 14 });
  assert.equal(measureListingText('Für financiële €').text, 'FÜR FINANCIËLE €');
  const fitted = layoutListingText('Geselecteerde configuratie', { maxWidth: 420, maxHeight: 42, maxScale: 5, minScale: 1 });
  assert.equal(fitted.text, 'GESELECTEERDE CONFIGURATIE');
  assert.ok(fitted.width <= 420);
  assert.ok(fitted.height <= 42);
  assert.doesNotMatch(fitted.lines.join(''), /\.\.\./);
  const wrapped = layoutListingText('ultimate-budgetplaner-de-DE-2026-dark.xlsx', { maxWidth: 300, maxHeight: 100, maxScale: 4, minScale: 1, maxLines: 4, wrap: true });
  assert.equal(wrapped.lines.join('').replaceAll(' ', ''), wrapped.text.replaceAll(' ', ''));
  const compound = layoutListingText('Budgetplanner Basis', { maxWidth: 600, maxHeight: 225, maxScale: 10, minScale: 3, maxLines: 3, wrap: true });
  assert.deepEqual(compound.lines, ['BUDGETPLANNER', 'BASIS']);
  assert.throws(() => layoutListingText('DIT KAN NIET PASSEN', { maxWidth: 10, maxHeight: 7, maxScale: 1, minScale: 1 }), /cannot fit/);
});

test('generates and independently decodes the exact twenty deterministic Etsy PNGs', async () => {
  const bundle = await generated();
  assert.deepEqual(bundle.images.map(image => image.path), LISTING_IMAGE_PATHS);
  assert.equal(bundle.validation.status, 'PASS');
  assert.equal(bundle.validation.uniqueHashes, 20);
  assert.doesNotThrow(() => stableStringify(bundle.manifest), 'trusted image manifest must remain within the production JSON key budget');
  assert.deepEqual(bundle.manifest.assets.map(asset => asset.packagePath), LISTING_IMAGE_PATHS);
  assert.ok(bundle.manifest.assets.every(asset => asset.altText && asset.status === 'validated'));

  for (const image of bundle.images) {
    assert.equal(image.layoutValidation.status, 'PASS');
    assert.ok(image.layoutEvidence.length > 0);
    assert.ok(image.layoutEvidence.every(entry => entry.withinBounds));
    assert.ok(image.layoutEvidence.every(entry => entry.bounds.x >= entry.box.x && entry.bounds.y >= entry.box.y));
    assert.ok(image.layoutEvidence.every(entry => entry.bounds.x + entry.bounds.width <= entry.box.x + entry.box.width));
    assert.ok(image.layoutEvidence.every(entry => entry.bounds.y + entry.bounds.height <= entry.box.y + entry.box.height));
    assert.ok(image.layoutEvidence.every(entry => entry.lines.join('').replace(/\s+/g, '') === entry.text.replace(/\s+/g, '')));
    const inspection = await inspectListingPng(image.bytes, { JSZip });
    assert.equal(inspection.width, 2400);
    assert.equal(inspection.height, 1600);
    assert.equal(inspection.bitDepth, 8);
    assert.equal(inspection.colorType, 2);
    assert.equal(inspection.metadata.ProductId, definition.id);
    assert.equal(inspection.metadata.Locale, configuration.locale);
    assert.equal(inspection.metadata.Theme, theme.id);
    assert.equal(inspection.metadata.Appearance, configuration.extensions.productAppearance);
    assert.equal(inspection.metadata.SourceWorkbookSHA256, sha256(workbookBytes));
    assert.equal(inspection.decoded.decodedBytes, 1600 * (1 + 2400 * 3));
  }
});

test('keeps every Basic NL sale-image label complete, bounded and language-consistent', async () => {
  const bundle = await generated();
  const byId = Object.fromEntries(bundle.images.map(image => [image.id, image]));
  const requiredCompleteText = [
    ['hero', 'hero-title', configuration.title],
    ['hero', 'hero-cta', translate('listingImages.ready')],
    ['key-features', 'header-title', translate('listingImages.features')],
    ['light-dark-comparison', 'comparison-second-label', translate('listingImages.dark')],
    ['digital-download', 'download-verified', translate('listingImages.verified')],
  ];
  for (const [imageId, layoutId, expected] of requiredCompleteText) {
    const layout = byId[imageId].layoutEvidence.find(entry => entry.id === layoutId);
    assert.ok(layout, `${imageId}/${layoutId} layout evidence`);
    assert.equal(layout.text, measureListingText(expected).text);
    assert.doesNotMatch(layout.lines.join(''), /\.\.\./);
    assert.equal(layout.withinBounds, true);
  }
  for (const image of bundle.images) {
    const cellText = image.layoutEvidence.filter(entry => /-row-\d+-cell-\d+$/.test(entry.id)).map(entry => entry.text).join('\n');
    assert.doesNotMatch(cellText, /\bDESCRIPTION\b|\bCATEGORY\b/, `${image.id} must not expose generic English preview tokens`);
    const footer = image.layoutEvidence.find(entry => entry.id === 'footer-slogan');
    assert.equal(footer.text, measureListingText(translate('listingImages.footer')).text);
    assert.doesNotMatch(footer.lines.join(''), /\.\.\./);
  }
  const previewColumns = byId['workbook-previews'].layoutEvidence.filter(entry => /^preview-\d-column-\d+$/.test(entry.id));
  for (const groupId of ['preview-1', 'preview-2', 'preview-3']) {
    const columns = previewColumns.filter(entry => entry.id.startsWith(`${groupId}-`)).sort((left, right) => left.box.x - right.box.x);
    for (let index = 1; index < columns.length; index += 1) assert.ok(columns[index - 1].box.x + columns[index - 1].box.width <= columns[index].box.x);
  }
});

test('renders Ultimate DE Dark with complete bounded German typography and a real dark canvas', async () => {
  const ultimate = productDefinitionById['budget-planner-ultimate'];
  const ultimateConfiguration = {
    ...structuredClone(ultimate.defaultConfiguration),
    locale: 'de-DE',
    market: 'DE',
    currency: 'EUR',
    title: localeCatalog['de-DE'].messages[ultimate.nameKey],
    filename: 'ultimate-budgetplaner-de-DE-2026-dark.xlsx',
    extensions: { ...structuredClone(ultimate.defaultConfiguration.extensions), productAppearance: 'dark' },
  };
  const ultimateTranslate = createTranslate('de-DE');
  const ultimateTheme = resolveWorkbookTheme(themeCatalog[ultimateConfiguration.themeId], 'dark');
  const bundle = await generateListingImages({
    plannedManifest: plannedManifestFor(ultimate, ultimateConfiguration, ultimateTheme, ultimateTranslate),
    definition: ultimate,
    configuration: ultimateConfiguration,
    theme: ultimateTheme,
    translate: ultimateTranslate,
    workbookBytes,
    validationReport: { status: 'PASS' },
    JSZip,
  });
  assert.equal(bundle.validation.status, 'PASS');
  assert.equal(bundle.images.length, 20);
  assert.ok(bundle.images.every(image => image.layoutValidation.status === 'PASS'));
  const visibleCopy = bundle.images.map(flattenedText).join('\n');
  assert.match(visibleCopy, /GEPRÜFTE PRODUKTIONSVERSION/);
  assert.match(visibleCopy, /FÜR SIE KONFIGURIERT/);
  assert.match(visibleCopy, /QUALITÄTSPRÜFUNGEN/);
  assert.match(visibleCopy, /ARBEITSMAPPE ÖFFNEN/);
  const cellCopy = bundle.images.flatMap(image => image.layoutEvidence.filter(entry => /-row-\d+-cell-\d+$/.test(entry.id)).map(entry => entry.text)).join('\n');
  assert.doesNotMatch(cellCopy, /\bDESCRIPTION\b|\bCATEGORY\b|\bOMSCHRIJVING\b|\bCATEGORIE\b/);
  assert.match(cellCopy, /BESCHREIBUNG|KATEGORIE/);
  const hero = await inspectListingPng(bundle.images[0].bytes, { JSZip });
  assert.equal(hero.metadata.Appearance, 'dark');
  assert.equal(hero.metadata.Locale, 'de-DE');
});

test('renders byte-identical PNGs for identical source inputs', async () => {
  const first = await generated();
  const second = await generateListingImages(generationArguments);
  assert.deepEqual(second.images.map(image => image.sha256), first.images.map(image => image.sha256));
  for (let index = 0; index < first.images.length; index += 1) assert.deepEqual(second.images[index].bytes, first.images[index].bytes);
});

test('fails closed on missing, zero-byte, tampered, duplicate and mixed-metadata assets', async () => {
  const bundle = await generated();
  const base = { manifest: bundle.manifest, definition, configuration, theme, JSZip };
  await assert.rejects(() => validateListingImageSet({ ...base, images: bundle.images.slice(0, 19) }), /Exactly 20/);

  const zero = [...bundle.images];
  zero[0] = { ...zero[0], bytes: new Uint8Array(), sha256: sha256(new Uint8Array()) };
  await assert.rejects(() => validateListingImageSet({ ...base, images: zero }), /bytes are missing/);

  const invalidSignatureBytes = Uint8Array.from(bundle.images[0].bytes);
  invalidSignatureBytes[0] = 0;
  const invalidSignatureHash = sha256(invalidSignatureBytes);
  const invalidSignatureImages = [...bundle.images];
  invalidSignatureImages[0] = { ...invalidSignatureImages[0], bytes: invalidSignatureBytes, sha256: invalidSignatureHash };
  const invalidSignatureManifest = structuredClone(bundle.manifest);
  invalidSignatureManifest.assets[0].sha256 = invalidSignatureHash;
  invalidSignatureManifest.assets[0].bytes = invalidSignatureBytes.length;
  await assert.rejects(() => validateListingImageSet({ ...base, images: invalidSignatureImages, manifest: invalidSignatureManifest }), /Invalid PNG signature/);

  const duplicateImages = [...bundle.images];
  duplicateImages[1] = { ...duplicateImages[1], bytes: bundle.images[0].bytes, sha256: bundle.images[0].sha256 };
  const duplicateManifest = structuredClone(bundle.manifest);
  duplicateManifest.assets[1].sha256 = bundle.images[0].sha256;
  duplicateManifest.assets[1].bytes = bundle.images[0].bytes.length;
  await assert.rejects(() => validateListingImageSet({ ...base, images: duplicateImages, manifest: duplicateManifest }), /Duplicate PNG bytes/);

  const mixedManifest = structuredClone(bundle.manifest);
  mixedManifest.assets[0].locale = 'en-US';
  await assert.rejects(() => validateListingImageSet({ ...base, images: bundle.images, manifest: mixedManifest }), /locale\/theme\/tier\/appearance mismatch/);

  const wrongProductManifest = structuredClone(bundle.manifest);
  wrongProductManifest.productId = 'different-product';
  await assert.rejects(() => validateListingImageSet({ ...base, images: bundle.images, manifest: wrongProductManifest }), /manifest\/product identity mismatch/);

  const overflowManifest = structuredClone(bundle.manifest);
  overflowManifest.extensions.renderEvidence.textLayouts.hero[0][7] = false;
  await assert.rejects(() => validateListingImageSet({ ...base, images: bundle.images, manifest: overflowManifest }), /typography bounds failed/);
});
