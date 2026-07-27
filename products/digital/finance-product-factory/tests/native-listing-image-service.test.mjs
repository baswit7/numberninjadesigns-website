import assert from 'node:assert/strict';
import test from 'node:test';

import { LISTING_IMAGE_BLUEPRINTS, LISTING_IMAGE_PATHS } from '../src/commercial/listing-image-engine.js';
import {
  NativeListingImageError,
  assertManifestAlignment,
  decodeWorkbookBase64,
} from '../src/server/native-listing-image-service.mjs';

test('native listing service accepts bounded ZIP-based workbook bytes', () => {
  const source = new Uint8Array(1_024);
  source[0] = 0x50;
  source[1] = 0x4B;
  const decoded = decodeWorkbookBase64(Buffer.from(source).toString('base64'));
  assert.deepEqual(decoded, source);
});

test('native listing service rejects malformed or non-workbook input', () => {
  assert.throws(() => decodeWorkbookBase64('not-base64'), NativeListingImageError);
  assert.throws(() => decodeWorkbookBase64(Buffer.alloc(1_024).toString('base64')), /geen geldige XLSX-werkmap/);
});

test('native listing service binds the complete 20-image manifest to one product variant', () => {
  const definition = { id: 'product', version: '1.2.3' };
  const configuration = { locale: 'nl-NL' };
  const theme = { id: 'sage-finance' };
  const manifest = {
    productId: definition.id,
    productVersion: definition.version,
    locale: configuration.locale,
    theme: theme.id,
    assets: LISTING_IMAGE_BLUEPRINTS.map((blueprint, index) => ({
      id: blueprint.id,
      order: index + 1,
      filename: LISTING_IMAGE_PATHS[index].split('/').at(-1),
    })),
  };
  assert.equal(assertManifestAlignment(manifest, definition, configuration, theme), manifest);
  assert.throws(
    () => assertManifestAlignment({ ...manifest, locale: 'en-US' }, definition, configuration, theme),
    /hoort niet bij de geselecteerde productvariant/,
  );
});
