import assert from 'node:assert/strict';
import test from 'node:test';

import { createPublisherHandler } from '../server/social-publisher/handler.mjs';
import { PublisherError } from '../server/social-publisher/core.mjs';

const origin = 'https://www.numberninjadesigns.com';
const session = { id: 'session-id', tenant_id: 'tenant-id', csrf_hash: 'hash' };

function fixture() {
  const calls = [];
  const service = {
    repository: { health: async () => true },
    openSession: async () => ({
      setCookie: 'opaque-session-placeholder',
      public: {
        csrfToken: 'csrf-placeholder',
        etsy: { connected: false, shopName: null },
        tiktok: { connected: false },
        mode: 'review',
      },
    }),
    resolveSession: async (cookie) => {
      if (cookie !== 'opaque-session-placeholder') throw new PublisherError(401, 'SESSION_REQUIRED', 'Session required.');
      return session;
    },
    verifyCsrf: (_session, csrf) => {
      if (csrf !== 'csrf-placeholder') throw new PublisherError(403, 'CSRF_REJECTED', 'CSRF rejected.');
    },
    oauthStart: async (_session, provider) => ({ provider, authorizationUrl: 'https://www.etsy.com/oauth/connect' }),
    oauthCallback: async (_session, body) => ({ provider: body.provider, connected: true }),
    listings: async () => [],
    listingImage: async () => ({ bytes: Buffer.from('image'), contentType: 'image/jpeg' }),
    creator: async () => ({ id: 'creator-context' }),
    publishInit: async () => ({ job: { id: 'job-id' }, uploadNonce: 'nonce-placeholder' }),
    upload: async (_session, jobId, nonce, bytes) => {
      calls.push({ jobId, nonce, bytes });
      return { id: jobId, state: 'PROCESSING' };
    },
    status: async (_session, jobId) => ({ id: jobId, state: 'COMPLETE' }),
    disconnect: async (_session, provider) => ({ provider, disconnected: true }),
    deleteData: async () => ({ deleted: true }),
  };
  const config = { origin, mode: 'review', secureCookies: true };
  return { calls, handler: createPublisherHandler({ service, config }) };
}

function request(action, options = {}) {
  const url = new URL('/api/social-publisher', origin);
  url.searchParams.set('action', action);
  Object.entries(options.query || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return new Request(url, {
    method: options.method || 'GET',
    headers: {
      ...(options.cookie === false ? {} : { Cookie: 'nnsp_session=opaque-session-placeholder' }),
      ...(options.origin === false ? {} : { Origin: options.origin || origin, 'Sec-Fetch-Site': 'same-origin' }),
      ...(options.csrf === false ? {} : { 'X-NN-CSRF': options.csrf || 'csrf-placeholder' }),
      ...(options.headers || {}),
    },
    body: options.body,
  });
}

test('session endpoint sets a secure opaque cookie and strict response headers', async () => {
  const { handler } = fixture();
  const response = await handler(request('session', { cookie: false, origin: false, csrf: false }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Max-Age=2592000; Secure/u);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('content-security-policy'), "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.session.csrfToken, 'csrf-placeholder');
});

test('mutations reject a missing or cross-origin CSRF request before service work', async () => {
  const { handler } = fixture();
  const missing = await handler(request('oauth-start', {
    method: 'POST',
    csrf: false,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'etsy' }),
  }));
  assert.equal(missing.status, 403);
  assert.equal((await missing.json()).error.code, 'CSRF_REJECTED');

  const crossOrigin = await handler(request('oauth-start', {
    method: 'POST',
    origin: 'https://attacker.invalid',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'etsy' }),
  }));
  assert.equal(crossOrigin.status, 403);
  assert.equal((await crossOrigin.json()).error.code, 'ORIGIN_REJECTED');
});

test('OAuth callback requires same origin but uses one-time state instead of CSRF', async () => {
  const { handler } = fixture();
  const response = await handler(request('oauth-callback', {
    method: 'POST',
    csrf: false,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'etsy', code: 'code', state: 'state' }),
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).connection.connected, true);
});

test('video upload enforces exact type, declared length and upload nonce forwarding', async () => {
  const { handler, calls } = fixture();
  const bytes = Buffer.from('verified-video-bytes');
  const response = await handler(request('upload', {
    method: 'POST',
    query: { jobId: 'job-id' },
    headers: {
      'Content-Type': 'video/webm; codecs=vp8',
      'Content-Length': String(bytes.byteLength),
      'X-NN-Upload': 'nonce-placeholder',
    },
    body: bytes,
  }));
  assert.equal(response.status, 202);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].bytes.equals(bytes), true);
  assert.equal(calls[0].nonce, 'nonce-placeholder');

  const invalid = await handler(request('upload', {
    method: 'POST',
    query: { jobId: 'job-id' },
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': '2', 'X-NN-Upload': 'nonce-placeholder' },
    body: Buffer.from('xx'),
  }));
  assert.equal(invalid.status, 415);
  assert.equal(calls.length, 1);
});

test('unknown failures are sanitized and never serialize exception details', async () => {
  const { handler } = fixture();
  const response = await handler(request('missing', { origin: false, csrf: false }));
  assert.equal(response.status, 404);
  const payload = await response.json();
  assert.deepEqual(Object.keys(payload.error).sort(), ['code', 'message', 'reconnect', 'retryable']);
  assert.equal(JSON.stringify(payload).includes('stack'), false);
});
