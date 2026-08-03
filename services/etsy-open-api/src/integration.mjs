import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual
} from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const AUTH_URL = 'https://www.etsy.com/oauth/connect';
const API_BASE_URL = 'https://api.etsy.com';
const TOKEN_PATH = '/v3/public/oauth/token';
const PING_PATH = '/v3/application/openapi-ping';
const SCOPES_PATH = '/v3/application/scopes';
const ALLOWED_SCOPES = new Set([
  'address_r', 'address_w', 'billing_r', 'cart_r', 'cart_w', 'email_r',
  'favorites_r', 'favorites_w', 'feedback_r', 'listings_d', 'listings_r',
  'listings_w', 'profile_r', 'profile_w', 'recommend_r', 'recommend_w',
  'shops_r', 'shops_w', 'transactions_r', 'transactions_w'
]);
const SENSITIVE_KEY = /token|secret|authorization|cookie|code|verifier|challenge|email|address|name/i;

export class EtsyIntegrationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'EtsyIntegrationError';
    this.code = code;
    this.details = details;
  }
}

function requireNonEmpty(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new EtsyIntegrationError('CONFIG_INVALID', `${name} is required`);
  }
  return value.trim();
}

function validateHeaderCredential(value, name) {
  const credential = requireNonEmpty(value, name);
  if (/[:\r\n]/.test(credential)) {
    throw new EtsyIntegrationError('CONFIG_INVALID', `${name} contains invalid header characters`);
  }
  return credential;
}

function parseBoolean(value) {
  return String(value).toLowerCase() === 'true';
}

function normalizeScopes(value) {
  const scopes = [...new Set(String(value || '').trim().split(/\s+/).filter(Boolean))];
  if (!scopes.length) {
    throw new EtsyIntegrationError('CONFIG_INVALID', 'ETSY_SCOPES must contain at least one scope');
  }
  const unknown = scopes.filter((scope) => !ALLOWED_SCOPES.has(scope));
  if (unknown.length) {
    throw new EtsyIntegrationError('CONFIG_INVALID', 'ETSY_SCOPES contains unsupported scopes');
  }
  return scopes.sort();
}

function validateRedirectUri(value) {
  const raw = requireNonEmpty(value, 'ETSY_REDIRECT_URI');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new EtsyIntegrationError('CONFIG_INVALID', 'ETSY_REDIRECT_URI must be an absolute URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new EtsyIntegrationError(
      'CONFIG_INVALID',
      'ETSY_REDIRECT_URI must use HTTPS and contain no credentials, query, or fragment'
    );
  }
  if (url.toString() !== raw) {
    throw new EtsyIntegrationError(
      'CONFIG_INVALID',
      'ETSY_REDIRECT_URI must use the exact registered spelling, including trailing slash'
    );
  }
  return raw;
}

function decodeEncryptionKey(value) {
  const raw = requireNonEmpty(value, 'ETSY_TOKEN_ENCRYPTION_KEY_BASE64');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32 || key.toString('base64').replace(/=+$/, '') !== raw.replace(/=+$/, '')) {
    throw new EtsyIntegrationError(
      'CONFIG_INVALID',
      'ETSY_TOKEN_ENCRYPTION_KEY_BASE64 must be a canonical base64-encoded 32-byte key'
    );
  }
  return key;
}

export function loadEtsyConfig(env = process.env) {
  const executionEnabled = parseBoolean(env.ETSY_EXECUTION_ENABLED);
  const base = {
    executionEnabled,
    apiBaseUrl: API_BASE_URL,
    authorizationUrl: AUTH_URL,
    refreshSkewMs: 5 * 60 * 1000,
    flowTtlMs: 10 * 60 * 1000,
    maxReadAttempts: 4
  };
  if (!executionEnabled) return Object.freeze(base);

  const tokenStorePath = path.resolve(requireNonEmpty(env.ETSY_TOKEN_STORE_PATH, 'ETSY_TOKEN_STORE_PATH'));
  if (!path.isAbsolute(env.ETSY_TOKEN_STORE_PATH) || /\.env(?:\.|$)/i.test(tokenStorePath)) {
    throw new EtsyIntegrationError(
      'CONFIG_INVALID',
      'ETSY_TOKEN_STORE_PATH must be an absolute private data path'
    );
  }
  return Object.freeze({
    ...base,
    keystring: validateHeaderCredential(env.ETSY_API_KEYSTRING, 'ETSY_API_KEYSTRING'),
    sharedSecret: validateHeaderCredential(env.ETSY_SHARED_SECRET, 'ETSY_SHARED_SECRET'),
    redirectUri: validateRedirectUri(env.ETSY_REDIRECT_URI),
    scopes: normalizeScopes(env.ETSY_SCOPES || 'listings_r listings_w shops_r'),
    tokenStorePath,
    encryptionKey: decodeEncryptionKey(env.ETSY_TOKEN_ENCRYPTION_KEY_BASE64)
  });
}

export function createTestConfig(overrides = {}) {
  return Object.freeze({
    executionEnabled: true,
    apiBaseUrl: API_BASE_URL,
    authorizationUrl: AUTH_URL,
    keystring: 'test-keystring',
    sharedSecret: 'test-shared-secret',
    redirectUri: 'https://api.example.test/etsy/oauth/callback',
    scopes: ['listings_r', 'listings_w', 'shops_r'],
    refreshSkewMs: 5 * 60 * 1000,
    flowTtlMs: 10 * 60 * 1000,
    maxReadAttempts: 4,
    ...overrides
  });
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sha256(value) {
  return createHash('sha256').update(value).digest();
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function safeAuditMetadata(metadata = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (!['string', 'number', 'boolean'].includes(typeof value)) continue;
    safe[key] = typeof value === 'string' ? value.slice(0, 160) : value;
  }
  return safe;
}

export class AuditLogger {
  constructor(write = (entry) => process.stdout.write(`${JSON.stringify(entry)}\n`), now = Date.now) {
    this.write = write;
    this.now = now;
  }

  log(event, metadata = {}) {
    this.write({
      at: new Date(this.now()).toISOString(),
      provider: 'etsy',
      event: String(event).replace(/[^a-z0-9_.-]/gi, '').slice(0, 80),
      ...safeAuditMetadata(metadata)
    });
  }
}

export class MemoryStore {
  constructor(initial = {}) {
    this.data = structuredClone(initial);
  }

  async get(key) {
    return structuredClone(this.data[key] ?? null);
  }

  async set(key, value) {
    this.data[key] = structuredClone(value);
  }

  async delete(key) {
    delete this.data[key];
  }

  async take(key) {
    const value = structuredClone(this.data[key] ?? null);
    delete this.data[key];
    return value;
  }

  async createIfAbsent(key, value) {
    if (Object.hasOwn(this.data, key)) {
      return { created: false, value: structuredClone(this.data[key]) };
    }
    this.data[key] = structuredClone(value);
    return { created: true, value: structuredClone(value) };
  }
}

export class EncryptedFileStore {
  constructor(filePath, encryptionKey) {
    if (!path.isAbsolute(filePath)) {
      throw new EtsyIntegrationError('CONFIG_INVALID', 'Encrypted store path must be absolute');
    }
    if (!Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32) {
      throw new EtsyIntegrationError('CONFIG_INVALID', 'Encrypted store requires a 32-byte key');
    }
    this.filePath = filePath;
    this.key = Buffer.from(encryptionKey);
    this.queue = Promise.resolve();
  }

  async _readAll() {
    let envelope;
    try {
      envelope = JSON.parse(await readFile(this.filePath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw new EtsyIntegrationError('VAULT_READ_FAILED', 'Encrypted Etsy vault could not be read');
    }
    try {
      if (envelope.v !== 1) throw new Error('unsupported envelope');
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(envelope.iv, 'base64url')
      );
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
      const clear = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
        decipher.final()
      ]);
      return JSON.parse(clear.toString('utf8'));
    } catch {
      throw new EtsyIntegrationError('VAULT_DECRYPT_FAILED', 'Encrypted Etsy vault failed integrity validation');
    }
  }

  async _writeAll(data) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
    const envelope = JSON.stringify({
      v: 1,
      iv: base64url(iv),
      tag: base64url(cipher.getAuthTag()),
      ciphertext: base64url(encrypted)
    });
    await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    const tempPath = `${this.filePath}.${process.pid}.${base64url(randomBytes(6))}.tmp`;
    await writeFile(tempPath, envelope, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await rename(tempPath, this.filePath);
  }

  _serialize(work) {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => {});
    return next;
  }

  async get(key) {
    return this._serialize(async () => structuredClone((await this._readAll())[key] ?? null));
  }

  async set(key, value) {
    return this._serialize(async () => {
      const data = await this._readAll();
      data[key] = structuredClone(value);
      await this._writeAll(data);
    });
  }

  async delete(key) {
    return this._serialize(async () => {
      const data = await this._readAll();
      delete data[key];
      await this._writeAll(data);
    });
  }

  async take(key) {
    return this._serialize(async () => {
      const data = await this._readAll();
      const value = structuredClone(data[key] ?? null);
      delete data[key];
      await this._writeAll(data);
      return value;
    });
  }

  async createIfAbsent(key, value) {
    return this._serialize(async () => {
      const data = await this._readAll();
      if (Object.hasOwn(data, key)) {
        return { created: false, value: structuredClone(data[key]) };
      }
      data[key] = structuredClone(value);
      await this._writeAll(data);
      return { created: true, value: structuredClone(value) };
    });
  }
}

function parseRetryAfter(response, now) {
  const value = response.headers.get('retry-after');
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now()) : null;
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  return null;
}

export class EtsyOpenApi {
  constructor({
    config,
    store,
    fetchImpl = globalThis.fetch,
    logger = new AuditLogger(),
    now = Date.now,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    random = Math.random
  }) {
    if (!config?.executionEnabled) {
      throw new EtsyIntegrationError('EXECUTION_DISABLED', 'Etsy execution plane is disabled');
    }
    this.config = config;
    this.store = store;
    this.fetch = fetchImpl;
    this.logger = logger;
    this.now = now;
    this.sleep = sleep;
    this.random = random;
    this.connectionState = 'error';
    this.lastErrorCode = 'NOT_CONNECTED';
    this.lastCheckedAt = null;
    this.refreshPromise = null;
    this.reconciliationLocks = new Set();
  }

  async beginAuthorization() {
    const state = base64url(randomBytes(32));
    const verifier = base64url(randomBytes(64));
    const challenge = base64url(sha256(verifier));
    await this.store.set(`oauth-flow:${sha256(state).toString('hex')}`, {
      state,
      verifier,
      expiresAt: this.now() + this.config.flowTtlMs
    });
    const url = new URL(this.config.authorizationUrl);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.keystring,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });
    this.logger.log('oauth.started');
    return url.toString();
  }

  async completeAuthorization({ state, code, error, errorDescription }) {
    const flowKey = `oauth-flow:${sha256(String(state || '')).toString('hex')}`;
    const flow = await this.store.take(flowKey);
    if (!flow || flow.expiresAt < this.now() || !safeEqual(flow.state, state)) {
      this.logger.log('oauth.rejected', { reason: 'invalid_state' });
      throw new EtsyIntegrationError('OAUTH_STATE_INVALID', 'OAuth state is invalid, expired, or already used');
    }
    if (error) {
      this.logger.log('oauth.denied', { reason: String(error).slice(0, 80) });
      throw new EtsyIntegrationError(
        'OAUTH_DENIED',
        errorDescription ? 'Etsy authorization was not granted' : 'Etsy authorization failed'
      );
    }
    requireNonEmpty(code, 'OAuth authorization code');
    const token = await this._tokenRequest({
      grant_type: 'authorization_code',
      client_id: this.config.keystring,
      redirect_uri: this.config.redirectUri,
      code,
      code_verifier: flow.verifier
    });
    await this._saveToken(token);
    this.connectionState = 'connected';
    this.lastErrorCode = null;
    this.lastCheckedAt = this.now();
    this.logger.log('oauth.connected');
    return this.getStatus();
  }

  async _tokenRequest(form) {
    let response;
    try {
      response = await this.fetch(`${this.config.apiBaseUrl}${TOKEN_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(form),
        signal: AbortSignal.timeout(15_000)
      });
    } catch {
      throw new EtsyIntegrationError('TOKEN_NETWORK_ERROR', 'Etsy token endpoint is temporarily unreachable');
    }
    const body = await parseResponseBody(response);
    if (!response.ok) {
      const invalidGrant = body?.error === 'invalid_grant';
      throw new EtsyIntegrationError(
        invalidGrant ? 'REAUTHORIZATION_REQUIRED' : 'TOKEN_EXCHANGE_FAILED',
        invalidGrant ? 'Etsy authorization must be renewed' : 'Etsy token exchange failed',
        { httpStatus: response.status }
      );
    }
    if (
      typeof body?.access_token !== 'string' ||
      typeof body?.refresh_token !== 'string' ||
      body?.token_type?.toLowerCase() !== 'bearer' ||
      !Number.isFinite(Number(body?.expires_in))
    ) {
      throw new EtsyIntegrationError('TOKEN_RESPONSE_INVALID', 'Etsy returned an invalid token response');
    }
    return body;
  }

  async _saveToken(token) {
    await this.store.set('oauth-token', {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenType: 'Bearer',
      expiresAt: this.now() + Number(token.expires_in) * 1000,
      refreshedAt: this.now()
    });
  }

  async _usableToken(forceRefresh = false) {
    const token = await this.store.get('oauth-token');
    if (!token) {
      this.connectionState = 'error';
      this.lastErrorCode = 'NOT_CONNECTED';
      throw new EtsyIntegrationError('NOT_CONNECTED', 'Etsy is not connected');
    }
    if (!forceRefresh && token.expiresAt - this.config.refreshSkewMs > this.now()) return token;
    return this._refreshToken(token);
  }

  async _refreshToken(currentToken) {
    if (this.refreshPromise) return this.refreshPromise;
    this.connectionState = 'reconnecting';
    this.lastErrorCode = null;
    this.logger.log('oauth.refresh_started');
    this.refreshPromise = (async () => {
      try {
        const refreshed = await this._tokenRequest({
          grant_type: 'refresh_token',
          client_id: this.config.keystring,
          refresh_token: currentToken.refreshToken
        });
        await this._saveToken(refreshed);
        const saved = await this.store.get('oauth-token');
        this.connectionState = 'connected';
        this.lastCheckedAt = this.now();
        this.logger.log('oauth.refresh_succeeded');
        return saved;
      } catch (error) {
        this.connectionState = 'error';
        this.lastErrorCode = error.code || 'REFRESH_FAILED';
        this.lastCheckedAt = this.now();
        this.logger.log('oauth.refresh_failed', { reason: this.lastErrorCode });
        throw error;
      } finally {
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }

  async request(resourcePath, {
    method = 'GET',
    body,
    headers = {},
    oauth = true
  } = {}) {
    if (!resourcePath.startsWith('/v3/')) {
      throw new EtsyIntegrationError('REQUEST_INVALID', 'Etsy resource path must start with /v3/');
    }
    if (Object.keys(headers).some((key) => /^(authorization|x-api-key|cookie)$/i.test(key))) {
      throw new EtsyIntegrationError(
        'REQUEST_INVALID',
        'Authentication headers are managed by the Etsy client'
      );
    }
    const normalizedMethod = method.toUpperCase();
    const retryableRead = normalizedMethod === 'GET' || normalizedMethod === 'HEAD';
    const maxAttempts = retryableRead ? this.config.maxReadAttempts : oauth ? 2 : 1;
    let token = oauth ? await this._usableToken() : null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let response;
      try {
        response = await this.fetch(`${this.config.apiBaseUrl}${resourcePath}`, {
          method: normalizedMethod,
          headers: {
            accept: 'application/json',
            ...headers,
            'x-api-key': `${this.config.keystring}:${this.config.sharedSecret}`,
            ...(token ? { authorization: `Bearer ${token.accessToken}` } : {})
          },
          body,
          signal: AbortSignal.timeout(20_000)
        });
      } catch {
        if (!retryableRead || attempt === maxAttempts) {
          throw new EtsyIntegrationError('API_NETWORK_ERROR', 'Etsy API is temporarily unreachable');
        }
        await this.sleep(Math.min(8_000, 250 * (2 ** (attempt - 1))) + Math.floor(this.random() * 200));
        continue;
      }

      if (response.status === 401 && oauth && attempt === 1) {
        token = await this._usableToken(true);
        continue;
      }
      const transient = response.status === 429 || [502, 503, 504].includes(response.status);
      if (transient && retryableRead && attempt < maxAttempts) {
        const waitMs = parseRetryAfter(response, this.now) ??
          Math.min(8_000, 250 * (2 ** (attempt - 1))) + Math.floor(this.random() * 200);
        this.logger.log('api.retry_scheduled', { httpStatus: response.status, attempt, waitMs });
        await this.sleep(waitMs);
        continue;
      }
      if (!response.ok) {
        this.logger.log('api.request_failed', {
          httpStatus: response.status,
          attempt,
          requestIdPresent: Boolean(response.headers.get('x-etsy-request-uuid'))
        });
        throw new EtsyIntegrationError('API_REQUEST_FAILED', 'Etsy API request failed', {
          httpStatus: response.status,
          retryAfterMs: parseRetryAfter(response, this.now)
        });
      }
      this.logger.log('api.request_succeeded', { httpStatus: response.status, attempt });
      return response;
    }
    throw new EtsyIntegrationError('API_REQUEST_FAILED', 'Etsy API request failed');
  }

  async testConnection() {
    this.lastCheckedAt = this.now();
    try {
      await this.request(PING_PATH, { oauth: false });
      const token = await this._usableToken();
      const response = await this.request(SCOPES_PATH, {
        method: 'POST',
        oauth: false,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: token.accessToken })
      });
      const body = await parseResponseBody(response);
      const granted = Array.isArray(body?.scopes)
        ? body.scopes
        : Array.isArray(body?.results)
          ? body.results
          : typeof body?.scope === 'string'
            ? body.scope.split(/\s+/).filter(Boolean)
            : body && typeof body === 'object'
              ? Object.entries(body)
                  .filter(([key, value]) => ALLOWED_SCOPES.has(key) && value === true)
                  .map(([key]) => key)
              : [];
      const missing = granted.length
        ? this.config.scopes.filter((scope) => !granted.includes(scope))
        : [];
      if (missing.length > 0) {
        throw new EtsyIntegrationError('SCOPE_MISMATCH', 'Granted Etsy scopes do not match configured scopes');
      }
      this.connectionState = 'connected';
      this.lastErrorCode = null;
      this.logger.log('connection.test_succeeded', { grantedScopeCount: granted.length });
      return {
        ...this.getStatus(),
        grantedScopes: granted.length ? [...granted].sort() : null,
        scopeVerification: granted.length ? 'enumerated-and-matched' : 'token-accepted-no-enumeration'
      };
    } catch (error) {
      this.connectionState = error.code === 'TOKEN_NETWORK_ERROR' ? 'reconnecting' : 'error';
      this.lastErrorCode = error.code || 'CONNECTION_TEST_FAILED';
      this.logger.log('connection.test_failed', { reason: this.lastErrorCode });
      throw error;
    }
  }

  getStatus() {
    return Object.freeze({
      provider: 'etsy',
      state: this.connectionState,
      lastCheckedAt: this.lastCheckedAt ? new Date(this.lastCheckedAt).toISOString() : null,
      errorCode: this.lastErrorCode,
      reconnectRequired: this.lastErrorCode === 'REAUTHORIZATION_REQUIRED'
    });
  }

  async disconnect() {
    await this.store.delete('oauth-token');
    this.connectionState = 'error';
    this.lastErrorCode = 'NOT_CONNECTED';
    this.lastCheckedAt = this.now();
    this.logger.log('oauth.disconnected');
  }

  async runIdempotentSync({ operation, resourceKey, payload, execute, reconcile = null }) {
    requireNonEmpty(operation, 'sync operation');
    requireNonEmpty(resourceKey, 'sync resource key');
    if (typeof execute !== 'function') {
      throw new EtsyIntegrationError('SYNC_INVALID', 'sync execute callback is required');
    }
    const payloadHash = sha256(stableJson(payload)).toString('hex');
    const resourceHash = sha256(`${operation}:${resourceKey}`).toString('hex');
    const key = `sync:${resourceHash}`;
    const started = {
      operation,
      resourceHash,
      payloadHash,
      status: 'started',
      startedAt: this.now()
    };
    const reservation = await this.store.createIfAbsent(key, started);
    const existing = reservation.created ? null : reservation.value;
    if (existing && existing.payloadHash !== payloadHash) {
      throw new EtsyIntegrationError(
        'IDEMPOTENCY_CONFLICT',
        'The same sync key was reused with different content'
      );
    }
    if (existing?.status === 'succeeded') return structuredClone(existing.result);
    if (['uncertain', 'reconciling'].includes(existing?.status)) {
      if (typeof reconcile !== 'function') {
        throw new EtsyIntegrationError(
          'SYNC_RECONCILIATION_REQUIRED',
          'Previous sync outcome is uncertain and must be reconciled before retry'
        );
      }
      if (this.reconciliationLocks.has(key)) {
        throw new EtsyIntegrationError('SYNC_IN_PROGRESS', 'The same sync operation is being reconciled');
      }
      this.reconciliationLocks.add(key);
      try {
        await this.store.set(key, { ...existing, status: 'reconciling' });
        const resolution = await reconcile();
        if (resolution?.status === 'succeeded') {
          const safeResult = {
            externalResourceId: String(resolution.result?.externalResourceId || ''),
            outcome: String(resolution.result?.outcome || 'completed')
          };
          await this.store.set(key, {
            operation,
            resourceHash,
            payloadHash,
            status: 'succeeded',
            finishedAt: this.now(),
            result: safeResult
          });
          this.logger.log('sync.reconciled', { operation, resourceHash });
          return safeResult;
        }
        if (resolution?.status !== 'absent') {
          await this.store.set(key, { ...existing, status: 'uncertain' });
          throw new EtsyIntegrationError(
            'SYNC_RECONCILIATION_REQUIRED',
            'Previous sync outcome could not be reconciled'
          );
        }
        await this.store.set(key, started);
        this.logger.log('sync.retry_authorized', { operation, resourceHash });
      } catch (error) {
        const current = await this.store.get(key).catch(() => null);
        if (current?.status === 'reconciling') {
          await this.store.set(key, { ...existing, status: 'uncertain' }).catch(() => undefined);
        }
        throw error;
      } finally {
        this.reconciliationLocks.delete(key);
      }
    }
    if (existing?.status === 'started') {
      throw new EtsyIntegrationError(
        'SYNC_IN_PROGRESS',
        'The same sync operation is already in progress'
      );
    }
    try {
      const result = await execute();
      const safeResult = {
        externalResourceId: String(result?.externalResourceId || ''),
        outcome: String(result?.outcome || 'completed')
      };
      await this.store.set(key, {
        operation,
        resourceHash,
        payloadHash,
        status: 'succeeded',
        finishedAt: this.now(),
        result: safeResult
      });
      this.logger.log('sync.succeeded', { operation, resourceHash });
      return safeResult;
    } catch (error) {
      await this.store.set(key, {
        operation,
        resourceHash,
        payloadHash,
        status: 'uncertain',
        finishedAt: this.now(),
        errorCode: error.code || 'SYNC_FAILED'
      });
      this.logger.log('sync.uncertain', {
        operation,
        resourceHash,
        reason: error.code || 'SYNC_FAILED'
      });
      throw error;
    }
  }

  async getSyncStatus({ operation, resourceKey }) {
    requireNonEmpty(operation, 'sync operation');
    requireNonEmpty(resourceKey, 'sync resource key');
    const resourceHash = sha256(`${operation}:${resourceKey}`).toString('hex');
    const record = await this.store.get(`sync:${resourceHash}`);
    if (!record) return null;
    return Object.freeze({
      status: String(record.status || 'unknown'),
      errorCode: record.errorCode ? String(record.errorCode) : null,
      result: record.status === 'succeeded' && record.result
        ? Object.freeze({
            externalResourceId: String(record.result.externalResourceId || ''),
            outcome: String(record.result.outcome || 'completed')
          })
        : null
    });
  }
}

export function createEtsyIntegration(env = process.env, dependencies = {}) {
  const config = loadEtsyConfig(env);
  if (!config.executionEnabled) {
    const disabled = async () => {
      throw new EtsyIntegrationError('EXECUTION_DISABLED', 'Etsy execution plane is disabled');
    };
    return Object.freeze({
      getStatus: () => ({
        provider: 'etsy',
        state: 'error',
        lastCheckedAt: null,
        errorCode: 'EXECUTION_DISABLED',
        reconnectRequired: false
      }),
      beginAuthorization: disabled,
      completeAuthorization: disabled,
      testConnection: disabled,
      disconnect: disabled,
      runIdempotentSync: disabled,
      getSyncStatus: disabled
    });
  }
  const store = dependencies.store || new EncryptedFileStore(
    config.tokenStorePath,
    config.encryptionKey
  );
  return new EtsyOpenApi({ config, store, ...dependencies });
}
