import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';

import { inspectPhysicalPng } from '../src/media/physical-png-validator.mjs';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, payload) {
  const typeBytes = Buffer.from(type, 'ascii');
  const output = Buffer.alloc(payload.length + 12);
  output.writeUInt32BE(payload.length, 0);
  typeBytes.copy(output, 4);
  payload.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBytes, payload])), output.length - 4);
  return output;
}

function png(width, height, pixel) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      const value = pixel(x, y);
      rows.set(value, offset);
    }
  }
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0)),
  ]));
}

test('validates a physical non-uniform RGB PNG', () => {
  const bytes = png(24, 16, (x, y) => [x * 10, y * 14, (x + y) * 5]);
  const evidence = inspectPhysicalPng(bytes, { expectedWidth: 24, expectedHeight: 16 });
  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.decodeable, true);
  assert.ok(evidence.sampledColors >= 4);
});

test('rejects wrong signatures and uniform images', () => {
  assert.throws(() => inspectPhysicalPng(new Uint8Array(100), { expectedWidth: 1, expectedHeight: 1 }), /magic bytes/u);
  const uniform = png(24, 16, () => [7, 7, 7]);
  assert.throws(() => inspectPhysicalPng(uniform, { expectedWidth: 24, expectedHeight: 16 }), /uniform/u);
});
