import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProductFactorySocialEventSink,
  createSocialEventSinkFromEnv,
  productFactorySocialEventKey
} from '../src/social-event-sink.mjs';

function event() {
  return {
    schemaVersion: '1.0.0',
    mode: 'APPROVAL',
    channels: ['youtube', 'tiktok', 'instagram', 'facebook', 'pinterest'],
    etsyReceipt: {
      listingId: '4545099189',
      listingRevision: 'etsy-1785686400',
      productId: 'budget-planner'
    },
    approval: { status: 'PENDING' },
    assetUrls: [
      'https://i.etsystatic.com/1/image-1.jpg',
      'https://i.etsystatic.com/1/image-2.jpg',
      'https://i.etsystatic.com/1/image-3.jpg'
    ]
  };
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

test('social event sink is disabled by default and allows only the canonical loopback endpoint', () => {
  assert.equal(createSocialEventSinkFromEnv({}), null);
  assert.throws(
    () => new ProductFactorySocialEventSink({ endpoint: 'https://attacker.example/api/social/etsy-events' }),
    { code: 'CONFIG_INVALID' }
  );
});

test('social event sink posts a deterministic idempotency key and validates the receipt', async () => {
  const input = event();
  const key = productFactorySocialEventKey(input);
  const calls = [];
  const sink = new ProductFactorySocialEventSink({
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return jsonResponse(202, { ok: true, event: { eventKey: key, status: 'CAMPAIGN_STARTED' } });
    },
    sleep: async () => undefined
  });
  assert.deepEqual(await sink.enqueue(input), {
    externalResourceId: key,
    outcome: 'social-campaign-enqueued'
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(calls[0].options.headers['idempotency-key'], key);
});

test('an ambiguous POST is reconciled by read-only receipt before retry', async () => {
  const input = event();
  const key = productFactorySocialEventKey(input);
  const methods = [];
  const sink = new ProductFactorySocialEventSink({
    fetchImpl: async (url, options) => {
      methods.push(options.method);
      if (options.method === 'POST') throw new Error('socket closed after intake');
      return jsonResponse(200, { ok: true, event: { eventKey: key, status: 'QUEUED' } });
    },
    sleep: async () => undefined
  });
  assert.deepEqual(await sink.enqueue(input), {
    externalResourceId: key,
    outcome: 'social-campaign-enqueued'
  });
  assert.deepEqual(methods, ['POST', 'GET']);
});

test('three absent readbacks bound retries and leave an unknown outcome fail-closed', async () => {
  const input = event();
  const methods = [];
  const sink = new ProductFactorySocialEventSink({
    fetchImpl: async (url, options) => {
      methods.push(options.method);
      if (options.method === 'POST') throw new Error('local service unavailable');
      return jsonResponse(404, { ok: false });
    },
    sleep: async () => undefined
  });
  await assert.rejects(sink.enqueue(input), { code: 'SOCIAL_EVENT_OUTCOME_UNKNOWN' });
  assert.deepEqual(methods, ['POST', 'GET', 'POST', 'GET', 'POST', 'GET']);
});
