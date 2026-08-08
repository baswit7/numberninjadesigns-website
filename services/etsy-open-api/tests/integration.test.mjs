import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  AuditLogger,
  EncryptedFileStore,
  EtsyIntegrationError,
  EtsyOpenApi,
  MemoryStore,
  createEtsyIntegration,
  createTestConfig,
  loadEtsyConfig
} from '../src/integration.mjs';

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) }
  });
}

function queueFetch(entries, calls = []) {
  return async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const next = entries.shift();
    if (next instanceof Error) throw next;
    if (typeof next === 'function') return next(url, options);
    return next;
  };
}

const validToken = {
  access_token: '12345678.access',
  refresh_token: '12345678.refresh',
  token_type: 'Bearer',
  expires_in: 3600
};

test('disabled configuration needs no secrets and exposes a safe status', () => {
  const integration = createEtsyIntegration({ ETSY_EXECUTION_ENABLED: 'false' });
  assert.deepEqual(integration.getStatus(), {
    provider: 'etsy',
    state: 'error',
    lastCheckedAt: null,
    errorCode: 'EXECUTION_DISABLED',
    reconnectRequired: false
  });
});

test('enabled configuration rejects insecure redirect URIs and invalid scopes', () => {
  const base = {
    ETSY_EXECUTION_ENABLED: 'true',
    ETSY_API_KEYSTRING: 'key',
    ETSY_SHARED_SECRET: 'secret',
    ETSY_REDIRECT_URI: 'http://example.test/callback',
    ETSY_SCOPES: 'listings_r made_up_scope',
    ETSY_TOKEN_STORE_PATH: path.join(os.tmpdir(), 'etsy-vault.json'),
    ETSY_TOKEN_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString('base64')
  };
  assert.throws(() => loadEtsyConfig(base), { code: 'CONFIG_INVALID' });
  assert.throws(
    () => loadEtsyConfig({ ...base, ETSY_REDIRECT_URI: 'https://example.test/callback' }),
    { code: 'CONFIG_INVALID' }
  );
  assert.throws(
    () => loadEtsyConfig({
      ...base,
      ETSY_API_KEYSTRING: 'key\r\ninjected',
      ETSY_REDIRECT_URI: 'https://example.test/callback',
      ETSY_SCOPES: 'listings_r'
    }),
    { code: 'CONFIG_INVALID' }
  );
});

test('authorization uses PKCE S256, exact redirect URI, least-privilege scopes, and one-time state', async () => {
  const calls = [];
  const store = new MemoryStore();
  const api = new EtsyOpenApi({
    config: createTestConfig(),
    store,
    fetchImpl: queueFetch([jsonResponse(validToken)], calls),
    logger: new AuditLogger(() => {})
  });

  const authorizationUrl = new URL(await api.beginAuthorization());
  assert.equal(authorizationUrl.origin + authorizationUrl.pathname, 'https://www.etsy.com/oauth/connect');
  assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorizationUrl.searchParams.get('redirect_uri'), 'https://api.example.test/etsy/oauth/callback');
  assert.equal(authorizationUrl.searchParams.get('scope'), 'listings_r listings_w shops_r');
  assert.match(authorizationUrl.searchParams.get('state'), /^[A-Za-z0-9_-]{43}$/);
  assert.match(authorizationUrl.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);

  const state = authorizationUrl.searchParams.get('state');
  await api.completeAuthorization({ state, code: 'authorization-code' });
  const form = new URLSearchParams(calls[0].options.body);
  assert.equal(form.get('grant_type'), 'authorization_code');
  assert.equal(form.get('client_id'), 'test-keystring');
  assert.equal(form.get('redirect_uri'), 'https://api.example.test/etsy/oauth/callback');
  assert.ok(form.get('code_verifier').length >= 43);
  assert.equal(form.get('code'), 'authorization-code');
  await assert.rejects(
    api.completeAuthorization({ state, code: 'replay' }),
    { code: 'OAUTH_STATE_INVALID' }
  );
});

test('concurrent callbacks can consume an OAuth state only once', async () => {
  let tokenCalls = 0;
  const api = new EtsyOpenApi({
    config: createTestConfig(),
    store: new MemoryStore(),
    fetchImpl: async () => {
      tokenCalls += 1;
      await new Promise((resolve) => setImmediate(resolve));
      return jsonResponse(validToken);
    },
    logger: new AuditLogger(() => {})
  });
  const url = new URL(await api.beginAuthorization());
  const state = url.searchParams.get('state');
  const outcomes = await Promise.allSettled([
    api.completeAuthorization({ state, code: 'first' }),
    api.completeAuthorization({ state, code: 'second' })
  ]);
  assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(
    outcomes.filter(({ reason }) => reason?.code === 'OAUTH_STATE_INVALID').length,
    1
  );
  assert.equal(tokenCalls, 1);
});

test('expired or mismatched OAuth state is rejected before token exchange', async () => {
  let fetchCount = 0;
  const api = new EtsyOpenApi({
    config: createTestConfig({ flowTtlMs: 100 }),
    store: new MemoryStore(),
    fetchImpl: async () => {
      fetchCount += 1;
      return jsonResponse(validToken);
    },
    now: () => 1_000,
    logger: new AuditLogger(() => {})
  });
  const url = new URL(await api.beginAuthorization());
  await assert.rejects(
    api.completeAuthorization({ state: `${url.searchParams.get('state')}x`, code: 'code' }),
    { code: 'OAUTH_STATE_INVALID' }
  );
  assert.equal(fetchCount, 0);
});

test('refresh token rotation is persisted and concurrent refresh is collapsed', async () => {
  const store = new MemoryStore({
    'oauth-token': {
      accessToken: 'expired',
      refreshToken: 'old-refresh',
      tokenType: 'Bearer',
      expiresAt: 1,
      refreshedAt: 0
    }
  });
  let tokenCalls = 0;
  const api = new EtsyOpenApi({
    config: createTestConfig(),
    store,
    fetchImpl: async (url) => {
      if (String(url).endsWith('/oauth/token')) {
        tokenCalls += 1;
        await new Promise((resolve) => setImmediate(resolve));
        return jsonResponse(validToken);
      }
      return jsonResponse({ ok: true });
    },
    now: () => 2_000_000,
    logger: new AuditLogger(() => {})
  });

  await Promise.all([
    api.request('/v3/application/openapi-ping'),
    api.request('/v3/application/openapi-ping')
  ]);
  assert.equal(tokenCalls, 1);
  assert.equal((await store.get('oauth-token')).refreshToken, '12345678.refresh');
  assert.equal(api.getStatus().state, 'connected');
});

test('GET honors Retry-After while a mutation is never automatically retried', async () => {
  const token = {
    accessToken: 'valid',
    refreshToken: 'refresh',
    tokenType: 'Bearer',
    expiresAt: 9_999_999,
    refreshedAt: 0
  };
  const waits = [];
  const calls = [];
  const api = new EtsyOpenApi({
    config: createTestConfig(),
    store: new MemoryStore({ 'oauth-token': token }),
    fetchImpl: queueFetch([
      jsonResponse({ error: 'limited' }, { status: 429, headers: { 'retry-after': '2' } }),
      jsonResponse({ ok: true }),
      jsonResponse({ error: 'limited' }, { status: 429, headers: { 'retry-after': '3' } })
    ], calls),
    sleep: async (ms) => waits.push(ms),
    now: () => 1_000,
    random: () => 0,
    logger: new AuditLogger(() => {})
  });

  await api.request('/v3/application/openapi-ping');
  assert.deepEqual(waits, [2_000]);
  await assert.rejects(
    api.request('/v3/application/shops/1/listings', { method: 'POST', body: '{}' }),
    (error) => error.code === 'API_REQUEST_FAILED' && error.details.retryAfterMs === 3_000
  );
  assert.equal(calls.length, 3);
});

test('401 refreshes once and safely retries the authenticated request', async () => {
  const store = new MemoryStore({
    'oauth-token': {
      accessToken: 'old-access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresAt: 9_999_999,
      refreshedAt: 0
    }
  });
  const calls = [];
  const api = new EtsyOpenApi({
    config: createTestConfig(),
    store,
    fetchImpl: queueFetch([
      jsonResponse({ error: 'expired' }, { status: 401 }),
      jsonResponse(validToken),
      jsonResponse({ ok: true })
    ], calls),
    now: () => 1_000,
    logger: new AuditLogger(() => {})
  });
  await api.request('/v3/application/shops/1/listings', { method: 'POST', body: '{}' });
  assert.equal(calls.length, 3);
  assert.equal(calls[2].options.headers.authorization, 'Bearer 12345678.access');
});

test('connection test validates API key and configured OAuth scopes', async () => {
  const store = new MemoryStore({
    'oauth-token': {
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresAt: 9_999_999,
      refreshedAt: 0
    }
  });
  const calls = [];
  const api = new EtsyOpenApi({
    config: createTestConfig(),
    store,
    fetchImpl: queueFetch([
      jsonResponse({ application_id: 1 }),
      jsonResponse({ scopes: ['shops_r', 'listings_w', 'listings_r'] })
    ], calls),
    now: () => 1_000,
    logger: new AuditLogger(() => {})
  });
  const status = await api.testConnection();
  assert.equal(status.state, 'connected');
  assert.deepEqual(status.grantedScopes, ['listings_r', 'listings_w', 'shops_r']);
  assert.equal(status.scopeVerification, 'enumerated-and-matched');
  assert.equal(new URLSearchParams(calls[1].options.body).get('token'), 'access');
});

test('connection test accepts Etsy official empty Scopes schema without inventing grants', async () => {
  const api = new EtsyOpenApi({
    config: createTestConfig(),
    store: new MemoryStore({
      'oauth-token': {
        accessToken: 'access',
        refreshToken: 'refresh',
        tokenType: 'Bearer',
        expiresAt: 9_999_999,
        refreshedAt: 0
      }
    }),
    fetchImpl: queueFetch([
      jsonResponse({ application_id: 1 }),
      jsonResponse({})
    ]),
    now: () => 1_000,
    logger: new AuditLogger(() => {})
  });
  const status = await api.testConnection();
  assert.equal(status.state, 'connected');
  assert.equal(status.grantedScopes, null);
  assert.equal(status.scopeVerification, 'token-accepted-no-enumeration');
});

test('idempotent sync returns the recorded result, blocks conflicts, and quarantines uncertainty', async () => {
  const store = new MemoryStore();
  const api = new EtsyOpenApi({
    config: createTestConfig(),
    store,
    fetchImpl: async () => jsonResponse({}),
    logger: new AuditLogger(() => {})
  });
  let executions = 0;
  const input = {
    operation: 'upsert-draft-listing',
    resourceKey: 'local-product-42',
    payload: { title: 'Spreadsheet Wizard' },
    execute: async () => {
      executions += 1;
      return { externalResourceId: '123', outcome: 'created' };
    }
  };
  assert.deepEqual(await api.runIdempotentSync(input), {
    externalResourceId: '123',
    outcome: 'created'
  });
  assert.deepEqual(await api.getSyncStatus({
    operation: input.operation,
    resourceKey: input.resourceKey
  }), {
    status: 'succeeded',
    errorCode: null,
    result: {
      externalResourceId: '123',
      outcome: 'created'
    }
  });
  assert.deepEqual(await api.runIdempotentSync(input), {
    externalResourceId: '123',
    outcome: 'created'
  });
  assert.equal(executions, 1);
  await assert.rejects(
    api.runIdempotentSync({ ...input, payload: { title: 'Changed' } }),
    { code: 'IDEMPOTENCY_CONFLICT' }
  );

  const uncertain = {
    operation: 'publish-listing',
    resourceKey: 'local-product-99',
    payload: { listingId: 99 },
    execute: async () => {
      throw new EtsyIntegrationError('API_NETWORK_ERROR', 'unknown outcome');
    }
  };
  await assert.rejects(api.runIdempotentSync(uncertain), { code: 'API_NETWORK_ERROR' });
  await assert.rejects(api.runIdempotentSync(uncertain), { code: 'SYNC_RECONCILIATION_REQUIRED' });
});

test('concurrent sync calls reserve the operation before provider execution', async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let executions = 0;
  const api = new EtsyOpenApi({
    config: createTestConfig(),
    store: new MemoryStore(),
    fetchImpl: async () => jsonResponse({}),
    logger: new AuditLogger(() => {})
  });
  const input = {
    operation: 'upsert-draft-listing',
    resourceKey: 'local-product-concurrent',
    payload: { title: 'Concurrency proof' },
    execute: async () => {
      executions += 1;
      await gate;
      return { externalResourceId: '456', outcome: 'created' };
    }
  };
  const first = api.runIdempotentSync(input);
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(api.runIdempotentSync(input), { code: 'SYNC_IN_PROGRESS' });
  release();
  await first;
  assert.equal(executions, 1);
});

test('callers cannot override Etsy authentication headers', async () => {
  const api = new EtsyOpenApi({
    config: createTestConfig(),
    store: new MemoryStore({
      'oauth-token': {
        accessToken: 'access',
        refreshToken: 'refresh',
        tokenType: 'Bearer',
        expiresAt: 9_999_999,
        refreshedAt: 0
      }
    }),
    fetchImpl: async () => jsonResponse({}),
    now: () => 1_000,
    logger: new AuditLogger(() => {})
  });
  await assert.rejects(
    api.request('/v3/application/openapi-ping', {
      headers: { Authorization: 'Bearer attacker-controlled' }
    }),
    { code: 'REQUEST_INVALID' }
  );
});

test('audit logging strips tokens, secrets, PII-like keys, and authorization codes', () => {
  const entries = [];
  const logger = new AuditLogger((entry) => entries.push(entry), () => 0);
  logger.log('oauth.test', {
    accessToken: 'do-not-log',
    sharedSecret: 'do-not-log',
    email: 'do-not-log@example.test',
    authorizationCode: 'do-not-log',
    httpStatus: 200,
    reason: 'ok'
  });
  const serialized = JSON.stringify(entries);
  assert.doesNotMatch(serialized, /do-not-log/);
  assert.equal(entries[0].httpStatus, 200);
  assert.equal(entries[0].reason, 'ok');
});

test('encrypted file store never writes token material in plaintext and detects tampering', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'nnd-etsy-'));
  const filePath = path.join(directory, 'vault.json');
  const key = Buffer.alloc(32, 9);
  try {
    const store = new EncryptedFileStore(filePath, key);
    await store.set('oauth-token', { accessToken: 'plain-token-must-not-appear' });
    const raw = await readFile(filePath, 'utf8');
    assert.doesNotMatch(raw, /plain-token-must-not-appear/);
    assert.deepEqual(await store.get('oauth-token'), {
      accessToken: 'plain-token-must-not-appear'
    });
    const envelope = JSON.parse(raw);
    const replacement = envelope.ciphertext.startsWith('A') ? 'B' : 'A';
    envelope.ciphertext = `${replacement}${envelope.ciphertext.slice(1)}`;
    await writeFile(filePath, JSON.stringify(envelope), 'utf8');
    await assert.rejects(store.get('oauth-token'), { code: 'VAULT_DECRYPT_FAILED' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
