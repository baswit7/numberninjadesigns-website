import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminServer } from '../src/server.mjs';

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

test('owner dashboard requires a secure session and CSRF for actions', async (context) => {
  let testCalls = 0;
  let callbackCalls = 0;
  let publicationCalls = 0;
  const integration = {
    getStatus: () => ({
      provider: 'etsy',
      state: 'connected',
      lastCheckedAt: '2026-07-25T12:00:00.000Z',
      errorCode: null,
      reconnectRequired: false
    }),
    testConnection: async () => {
      testCalls += 1;
      return { provider: 'etsy', state: 'connected', errorCode: null };
    },
    beginAuthorization: async () => 'https://www.etsy.com/oauth/connect?state=safe',
    completeAuthorization: async () => {
      callbackCalls += 1;
    },
    disconnect: async () => {}
  };
  const listingPublisher = {
    overview: async () => ({
      revision: 'a'.repeat(64),
      total: 1,
      active: 1,
      eligible: 1,
      blocked: 0,
      listings: []
    }),
    publishAllActive: async ({ revision }) => {
      publicationCalls += 1;
      assert.equal(revision, 'a'.repeat(64));
      return { requested: 1, published: 1, failed: 0, results: [] };
    }
  };
  const origin = 'https://admin.example.test';
  const server = createAdminServer({
    integration,
    listingPublisher,
    adminToken: 'a-strong-admin-token-with-32-characters',
    publicOrigin: origin
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const base = await listen(server);

  const page = await fetch(`${base}/etsy-admin/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Verbinding testen/);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);

  const unauthorized = await fetch(`${base}/api/etsy/status`);
  assert.equal(unauthorized.status, 401);

  const wrong = await fetch(`${base}/etsy-admin/session`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ adminToken: 'wrong-token' })
  });
  assert.equal(wrong.status, 401);

  const login = await fetch(`${base}/etsy-admin/session`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ adminToken: 'a-strong-admin-token-with-32-characters' })
  });
  assert.equal(login.status, 204);
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Path=\//);
  const cookie = setCookie.split(';', 1)[0];

  const statusResponse = await fetch(`${base}/api/etsy/status`, {
    headers: { cookie }
  });
  assert.equal(statusResponse.status, 200);
  const status = await statusResponse.json();
  assert.equal(status.state, 'connected');
  assert.match(status.csrfToken, /^[A-Za-z0-9_-]{43}$/);

  const rejected = await fetch(`${base}/api/etsy/test-connection`, {
    method: 'POST',
    headers: { cookie, origin }
  });
  assert.equal(rejected.status, 403);
  assert.equal(testCalls, 0);

  const tested = await fetch(`${base}/api/etsy/test-connection`, {
    method: 'POST',
    headers: {
      cookie,
      origin,
      'x-csrf-token': status.csrfToken
    }
  });
  assert.equal(tested.status, 200);
  assert.equal(testCalls, 1);

  const listings = await fetch(`${base}/api/etsy/listings`, {
    headers: { cookie }
  });
  assert.equal(listings.status, 200);
  assert.equal((await listings.json()).eligible, 1);

  const missingConfirmation = await fetch(`${base}/api/etsy/listings/publish-all`, {
    method: 'POST',
    headers: {
      cookie,
      origin,
      'content-type': 'application/json',
      'x-csrf-token': status.csrfToken
    },
    body: JSON.stringify({ revision: 'a'.repeat(64) })
  });
  assert.equal(missingConfirmation.status, 409);
  assert.equal(publicationCalls, 0);

  const published = await fetch(`${base}/api/etsy/listings/publish-all`, {
    method: 'POST',
    headers: {
      cookie,
      origin,
      'content-type': 'application/json',
      'x-csrf-token': status.csrfToken
    },
    body: JSON.stringify({
      confirmation: 'PUBLISH_ALL_ACTIVE',
      revision: 'a'.repeat(64)
    })
  });
  assert.equal(published.status, 200);
  assert.equal((await published.json()).published, 1);
  assert.equal(publicationCalls, 1);

  const callback = await fetch(`${base}/etsy/oauth/callback?state=s&code=c`, {
    redirect: 'manual'
  });
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get('location'), '/etsy-admin/?connected=1');
  assert.equal(callbackCalls, 1);
});

test('admin server rejects weak credentials and non-HTTPS public origins', () => {
  const integration = { getStatus: () => ({ state: 'error' }) };
  assert.throws(
    () => createAdminServer({
      integration,
      adminToken: 'short',
      publicOrigin: 'https://admin.example.test'
    }),
    { code: 'CONFIG_INVALID' }
  );
  assert.throws(
    () => createAdminServer({
      integration,
      adminToken: 'a-strong-admin-token-with-32-characters',
      publicOrigin: 'http://admin.example.test'
    }),
    { code: 'CONFIG_INVALID' }
  );
  assert.doesNotThrow(() => {
    const server = createAdminServer({
      integration,
      adminToken: 'a-strong-admin-token-with-32-characters',
      publicOrigin: 'http://127.0.0.1:8787',
      allowInsecureLoopback: true
    });
    server.close();
  });
});
