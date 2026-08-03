import assert from 'node:assert/strict';
import test from 'node:test';

import {
  openText,
  parseCookies,
  PublisherError,
  sealText,
  sessionCookie,
  sha256,
  stableJson,
} from '../server/social-publisher/core.mjs';
import { loadPublisherConfig, publicConfig } from '../server/social-publisher/config.mjs';
import {
  etsyAuthorizationUrl,
  isEtsyImageUrl,
  ProviderTransport,
  tiktokAuthorizationUrl,
} from '../server/social-publisher/providers.mjs';

const encryptionKey = Buffer.alloc(32, 7).toString('base64');

function environment(overrides = {}) {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://test.invalid/database',
    SOCIAL_PUBLISHER_ENCRYPTION_KEY: encryptionKey,
    SOCIAL_PUBLISHER_ORIGIN: 'https://www.numberninjadesigns.com',
    SOCIAL_PUBLISHER_TIKTOK_MODE: 'review',
    ETSY_CLIENT_ID: 'etsy-client',
    ETSY_SHARED_SECRET: 'etsy-secret-placeholder',
    ETSY_REDIRECT_URI: 'https://www.numberninjadesigns.com/etsy/callback/',
    TIKTOK_CLIENT_KEY: 'tiktok-client',
    TIKTOK_CLIENT_SECRET: 'tiktok-secret-placeholder',
    TIKTOK_REDIRECT_URI: 'https://www.numberninjadesigns.com/tiktok/callback/',
    ...overrides,
  };
}

test('AES-GCM values are authenticated and tenant-bound by AAD', () => {
  const sealed = sealText('provider-token-placeholder', encryptionKey, 'tenant-a|etsy|access|v1');
  assert.match(sealed, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
  assert.equal(openText(sealed, encryptionKey, 'tenant-a|etsy|access|v1'), 'provider-token-placeholder');
  assert.throws(
    () => openText(sealed, encryptionKey, 'tenant-b|etsy|access|v1'),
    (error) => error instanceof PublisherError && error.code === 'ENCRYPTED_DATA_INVALID',
  );
});

test('stable hashing, cookie parsing and secure session flags are deterministic', () => {
  assert.equal(stableJson({ z: 1, a: ['b', 2] }), '{"a":["b",2],"z":1}');
  assert.equal(sha256('same'), sha256('same'));
  assert.deepEqual([...parseCookies('a=1; nnsp_session=opaque; a=2')], [['a', '1'], ['nnsp_session', 'opaque']]);
  assert.equal(sessionCookie('opaque', true), 'nnsp_session=opaque; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure');
});

test('production configuration fails closed and requires exact HTTPS callbacks', () => {
  const config = loadPublisherConfig(environment());
  assert.deepEqual(publicConfig(config), {
    mode: 'review',
    origin: 'https://www.numberninjadesigns.com',
    maximumVideoBytes: 4_000_000,
    videoSeconds: 10,
    videoFps: 24,
  });
  assert.throws(() => loadPublisherConfig(environment({ DATABASE_URL: '' })), /serverconfiguratie/u);
  assert.throws(() => loadPublisherConfig(environment({ SOCIAL_PUBLISHER_ORIGIN: 'http://www.numberninjadesigns.com' })), /HTTPS/u);
  assert.throws(() => loadPublisherConfig(environment({ ETSY_REDIRECT_URI: 'https://www.numberninjadesigns.com/etsy/callback/?unexpected=1' })), /redirect URI/u);
  assert.throws(() => loadPublisherConfig(environment({ TIKTOK_REDIRECT_URI: 'https://attacker.invalid/tiktok/callback/' })), /redirect URI/u);
});

test('OAuth URLs bind state and use only provider-supported PKCE behavior', () => {
  const config = loadPublisherConfig(environment());
  const etsy = new URL(etsyAuthorizationUrl(config.etsy, 'state-placeholder', 'challenge-placeholder'));
  assert.equal(etsy.origin, 'https://www.etsy.com');
  assert.equal(etsy.searchParams.get('state'), 'state-placeholder');
  assert.equal(etsy.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(etsy.searchParams.get('scope'), 'listings_r shops_r');

  const tiktok = new URL(tiktokAuthorizationUrl(config.tiktok, 'state-placeholder'));
  assert.equal(tiktok.origin, 'https://www.tiktok.com');
  assert.equal(tiktok.searchParams.get('state'), 'state-placeholder');
  assert.equal(tiktok.searchParams.get('scope'), 'user.info.basic,video.publish');
  assert.equal(tiktok.searchParams.has('code_challenge'), false);
  assert.equal(tiktok.searchParams.get('disable_auto_auth'), '1');
});

test('Etsy image allowlist rejects lookalike and credential-bearing URLs', () => {
  assert.equal(isEtsyImageUrl('https://i.etsystatic.com/123/example.jpg'), true);
  assert.equal(isEtsyImageUrl('https://etsystatic.com/example.webp'), true);
  assert.equal(isEtsyImageUrl('https://etsystatic.com.attacker.invalid/example.jpg'), false);
  assert.equal(isEtsyImageUrl('https://user:pass@i.etsystatic.com/example.jpg'), false);
  assert.equal(isEtsyImageUrl('http://i.etsystatic.com/example.jpg'), false);
});

test('provider transport retries safe reads but never blind-retries writes', async () => {
  let safeCalls = 0;
  const safe = new ProviderTransport({
    fetchImpl: async () => {
      safeCalls += 1;
      return safeCalls === 1 ? new Response('{}', { status: 503 }) : new Response('{}', { status: 200 });
    },
    sleep: async () => {},
  });
  const safeResponse = await safe.request('test provider', 'https://provider.invalid/read', {}, { attempts: 2, safeToRetry: true });
  assert.equal(safeResponse.status, 200);
  assert.equal(safeCalls, 2);

  let writeCalls = 0;
  const write = new ProviderTransport({
    fetchImpl: async () => {
      writeCalls += 1;
      return new Response('{}', { status: 503 });
    },
    sleep: async () => {},
  });
  await assert.rejects(
    write.request('test provider', 'https://provider.invalid/write', { method: 'POST' }, { attempts: 3 }),
    (error) => error instanceof PublisherError && error.code === 'PROVIDER_REQUEST_REJECTED',
  );
  assert.equal(writeCalls, 1);
});
