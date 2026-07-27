import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';

import {
  OutputStorageError,
  assertKnownOutputMetadata,
  resolveOutputDestination,
  saveOutputBytes,
} from '../src/server/output-storage.mjs';

function requestUrl(parameters) {
  const url = new URL('http://localhost:4173/api/output');
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

const productParameters = Object.freeze({
  kind: 'package',
  filename: 'budget-planner-professional-nl-NL.zip',
  productId: 'budget-planner-professional',
  locale: 'nl-NL',
  currency: 'EUR',
  themeId: 'executive-navy',
  version: '2.0.0',
  appearance: 'dark',
});

async function createZip(entries) {
  const zip = new JSZip();
  for (const [path, contents] of Object.entries(entries)) zip.file(path, contents);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

test('product output resolves to the structured generated-products directory', () => {
  const destination = resolveOutputDestination('C:\\factory', requestUrl(productParameters));
  assert.equal(
    destination.relativePath,
    'output/generated-products/budget-planner-professional/nl-NL/EUR/executive-navy/dark/v2.0.0/budget-planner-professional-nl-NL.zip',
  );
});

test('individual listing images resolve below the product variant image directory', () => {
  const destination = resolveOutputDestination('C:\\factory', requestUrl({
    ...productParameters,
    kind: 'image',
    filename: '01-hero.png',
  }));
  assert.equal(
    destination.relativePath,
    'output/generated-products/budget-planner-professional/nl-NL/EUR/executive-navy/dark/v2.0.0/listing/images/01-hero.png',
  );
});

test('listing image archives resolve beside the workbook and sales package', () => {
  const destination = resolveOutputDestination('/factory', requestUrl({
    ...productParameters,
    kind: 'images',
    filename: 'budget-planner-professional-etsy-images.zip',
  }));
  assert.match(destination.relativePath, /\/v2\.0\.0\/budget-planner-professional-etsy-images\.zip$/);
});

test('legacy product output without appearance resolves deterministically to light', () => {
  const { appearance, ...legacyParameters } = productParameters;
  const destination = resolveOutputDestination('/factory', requestUrl(legacyParameters));
  assert.match(destination.relativePath, /\/executive-navy\/light\/v2\.0\.0\//);
});

test('batch output resolves below a dedicated run directory', () => {
  const destination = resolveOutputDestination('/factory', requestUrl({
    kind: 'batch',
    filename: 'finance-product-factory-batch.zip',
    runId: '20260715T153000Z',
  }));
  assert.equal(
    destination.relativePath,
    'output/generated-products/batches/20260715T153000Z/finance-product-factory-batch.zip',
  );
});

test('output storage rejects traversal, unsafe identifiers and extension confusion', () => {
  const invalid = [
    { ...productParameters, filename: '../escape.zip' },
    { ...productParameters, productId: '..' },
    { ...productParameters, themeId: 'executive/../../escape' },
    { ...productParameters, filename: 'workbook.xlsx' },
    { ...productParameters, kind: 'image', filename: 'image.jpg' },
    { kind: 'batch', filename: 'batch.zip', runId: '../escape' },
  ];
  for (const parameters of invalid) {
    assert.throws(
      () => resolveOutputDestination('/factory', requestUrl(parameters)),
      error => error instanceof OutputStorageError && [400, 403].includes(error.statusCode),
    );
  }
});

test('output bytes are written exactly and return verifiable metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fpf-output-'));
  try {
    const bytes = await createZip({
      'product/workbook.xlsx': 'verified workbook',
      'listing/images/01-hero.png': 'verified image',
    });
    const saved = await saveOutputBytes(root, requestUrl(productParameters), bytes);
    assert.deepEqual(new Uint8Array(await readFile(saved.absolutePath)), bytes);
    assert.equal(saved.bytes, bytes.byteLength);
    assert.match(saved.sha256, /^[a-f0-9]{64}$/);
    assert.equal(saved.relativePath, 'output/generated-products/budget-planner-professional/nl-NL/EUR/executive-navy/dark/v2.0.0/budget-planner-professional-nl-NL.zip');
    assert.equal(saved.extracted.status, 'EXTRACTED');
    assert.equal(saved.extracted.fileCount, 2);
    assert.equal(saved.extracted.relativePath, 'output/generated-products/budget-planner-professional/nl-NL/EUR/executive-navy/dark/v2.0.0/budget-planner-professional-nl-NL');
    assert.equal(await readFile(join(saved.extracted.absolutePath, 'product', 'workbook.xlsx'), 'utf8'), 'verified workbook');
    assert.equal(await readFile(join(saved.extracted.absolutePath, 'listing', 'images', '01-hero.png'), 'utf8'), 'verified image');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('saving a new ZIP atomically replaces the extracted folder without stale files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fpf-output-'));
  try {
    await saveOutputBytes(root, requestUrl(productParameters), await createZip({
      'product/stale.txt': 'old',
      'product/shared.txt': 'old shared',
    }));
    const saved = await saveOutputBytes(root, requestUrl(productParameters), await createZip({
      'product/current.txt': 'new',
      'product/shared.txt': 'new shared',
    }));
    await assert.rejects(readFile(join(saved.extracted.absolutePath, 'product', 'stale.txt')), error => error?.code === 'ENOENT');
    assert.equal(await readFile(join(saved.extracted.absolutePath, 'product', 'current.txt'), 'utf8'), 'new');
    assert.equal(await readFile(join(saved.extracted.absolutePath, 'product', 'shared.txt'), 'utf8'), 'new shared');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ZIP extraction rejects traversal paths before an archive is installed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fpf-output-'));
  try {
    const bytes = await createZip({ '../escape.txt': 'blocked' });
    await assert.rejects(
      saveOutputBytes(root, requestUrl(productParameters), bytes),
      error => error instanceof OutputStorageError && error.statusCode === 400,
    );
    const destination = resolveOutputDestination(root, requestUrl(productParameters));
    await assert.rejects(readFile(destination.absolutePath), error => error?.code === 'ENOENT');
    await assert.rejects(readFile(join(root, 'escape.txt')), error => error?.code === 'ENOENT');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('output storage rejects payloads that are not ZIP/XLSX containers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fpf-output-'));
  try {
    await assert.rejects(
      saveOutputBytes(root, requestUrl(productParameters), new TextEncoder().encode('not-a-zip')),
      error => error instanceof OutputStorageError && error.statusCode === 400,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('output storage accepts only signed PNG bytes for individual images', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fpf-output-'));
  const url = requestUrl({ ...productParameters, kind: 'image', filename: '01-hero.png' });
  try {
    await assert.rejects(
      saveOutputBytes(root, url, new TextEncoder().encode('not-a-png')),
      error => error instanceof OutputStorageError && error.statusCode === 400,
    );
    const pngHeader = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x09, 0x60, 0x00, 0x00, 0x06, 0x40,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const saved = await saveOutputBytes(root, url, pngHeader);
    assert.match(saved.relativePath, /listing\/images\/01-hero\.png$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('server catalog boundary rejects unknown or mismatched product metadata', () => {
  const catalogs = {
    products: {
      'budget-planner-professional': {
        version: '2.0.0',
        supportedLocales: ['nl-NL'],
        supportedCurrencies: ['EUR'],
        supportedThemes: ['executive-navy'],
      },
    },
    locales: { 'nl-NL': {} },
    currencies: { EUR: {} },
    themes: { 'executive-navy': {} },
  };
  assert.equal(assertKnownOutputMetadata(requestUrl(productParameters), catalogs), true);
  for (const parameters of [
    { ...productParameters, productId: 'unknown-product' },
    { ...productParameters, version: '9.0.0' },
    { ...productParameters, locale: 'de-DE' },
    { ...productParameters, currency: 'USD' },
    { ...productParameters, themeId: 'unknown-theme' },
  ]) {
    assert.throws(() => assertKnownOutputMetadata(requestUrl(parameters), catalogs), OutputStorageError);
  }
});
