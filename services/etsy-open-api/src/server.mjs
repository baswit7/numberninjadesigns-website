import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EtsyIntegrationError,
  createEtsyIntegration
} from './integration.mjs';
import { createListingPublisherFromEnv } from './listing-publisher.mjs';

const DEFAULT_PUBLIC_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public'
);
const STATIC_FILES = new Map([
  ['/etsy-admin/', ['index.html', 'text/html; charset=utf-8']],
  ['/etsy-admin/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/etsy-admin/styles.css', ['styles.css', 'text/css; charset=utf-8']]
]);

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookieValue(req, name) {
  for (const item of String(req.headers.cookie || '').split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) {
      throw new EtsyIntegrationError('REQUEST_TOO_LARGE', 'Request body is too large');
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new EtsyIntegrationError('REQUEST_INVALID', 'Request body must be valid JSON');
  }
}

function validateAdminOptions({ adminToken, publicOrigin, allowInsecureLoopback = false }) {
  if (typeof adminToken !== 'string' || adminToken.length < 32 || /[\r\n]/.test(adminToken)) {
    throw new EtsyIntegrationError(
      'CONFIG_INVALID',
      'ETSY_ADMIN_TOKEN must contain at least 32 characters'
    );
  }
  let origin;
  try {
    origin = new URL(publicOrigin).origin;
  } catch {
    throw new EtsyIntegrationError('CONFIG_INVALID', 'ETSY_PUBLIC_ORIGIN must be an HTTPS origin');
  }
  const parsed = new URL(origin);
  const loopbackAllowed = allowInsecureLoopback &&
    parsed.protocol === 'http:' &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
  if (origin !== publicOrigin || (!origin.startsWith('https://') && !loopbackAllowed)) {
    throw new EtsyIntegrationError('CONFIG_INVALID', 'ETSY_PUBLIC_ORIGIN must be an exact HTTPS origin');
  }
  return origin;
}

export function createAdminServer({
  integration,
  listingPublisher = null,
  adminToken,
  publicOrigin,
  publicDir = DEFAULT_PUBLIC_DIR,
  now = Date.now,
  sessionTtlMs = 60 * 60 * 1000,
  allowInsecureLoopback = false
}) {
  const allowedOrigin = validateAdminOptions({ adminToken, publicOrigin, allowInsecureLoopback });
  const secureCookie = allowInsecureLoopback ? '' : ' Secure;';
  const sessions = new Map();
  const loginAttempts = new Map();

  function sessionFor(req) {
    const id = cookieValue(req, 'nnd_etsy_admin');
    const session = id ? sessions.get(id) : null;
    if (!session || session.expiresAt <= now()) {
      if (id) sessions.delete(id);
      return null;
    }
    return session;
  }

  function requireSameOrigin(req) {
    return req.headers.origin === allowedOrigin;
  }

  function requireCsrf(req, session) {
    return requireSameOrigin(req) && safeEqual(req.headers['x-csrf-token'], session.csrf);
  }

  async function serveStatic(res, filename, contentType) {
    const body = await readFile(path.join(publicDir, filename));
    res.writeHead(200, {
      'content-type': contentType,
      'cache-control': 'no-store',
      'content-security-policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "connect-src 'self'",
        "img-src 'self'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'"
      ].join('; '),
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY'
    });
    res.end(body);
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, allowedOrigin);
    try {
      if (req.method === 'GET' && url.pathname === '/healthz') {
        return json(res, 200, { ok: true });
      }
      const staticFile = STATIC_FILES.get(url.pathname);
      if (req.method === 'GET' && staticFile) {
        return await serveStatic(res, ...staticFile);
      }
      if (req.method === 'POST' && url.pathname === '/etsy-admin/session') {
        if (!requireSameOrigin(req)) return json(res, 403, { errorCode: 'ORIGIN_REJECTED' });
        const attemptKey = req.socket.remoteAddress || 'unknown';
        const attempt = loginAttempts.get(attemptKey);
        if (attempt && attempt.resetAt > now() && attempt.count >= 5) {
          return json(res, 429, { errorCode: 'LOGIN_RATE_LIMITED' }, { 'retry-after': '300' });
        }
        const body = await readJson(req);
        if (!safeEqual(body.adminToken, adminToken)) {
          const activeAttempt = attempt && attempt.resetAt > now()
            ? attempt
            : { count: 0, resetAt: now() + 5 * 60 * 1000 };
          activeAttempt.count += 1;
          loginAttempts.set(attemptKey, activeAttempt);
          return json(res, 401, { errorCode: 'AUTHENTICATION_FAILED' });
        }
        loginAttempts.delete(attemptKey);
        for (const [id, session] of sessions) {
          if (session.expiresAt <= now()) sessions.delete(id);
        }
        while (sessions.size >= 64) sessions.delete(sessions.keys().next().value);
        const id = randomBytes(32).toString('base64url');
        const csrf = randomBytes(32).toString('base64url');
        sessions.set(id, { csrf, expiresAt: now() + sessionTtlMs });
        return json(res, 204, null, {
          'set-cookie': `nnd_etsy_admin=${id}; Path=/; HttpOnly;${secureCookie} SameSite=Strict; Max-Age=${Math.floor(sessionTtlMs / 1000)}`
        });
      }

      if (req.method === 'GET' && url.pathname === '/etsy/oauth/callback') {
        try {
          await integration.completeAuthorization({
            state: url.searchParams.get('state'),
            code: url.searchParams.get('code'),
            error: url.searchParams.get('error'),
            errorDescription: url.searchParams.get('error_description')
          });
          res.writeHead(303, { location: '/etsy-admin/?connected=1', 'cache-control': 'no-store' });
        } catch (error) {
          const safeCode = encodeURIComponent(error.code || 'OAUTH_CALLBACK_FAILED');
          res.writeHead(303, {
            location: `/etsy-admin/?error=${safeCode}`,
            'cache-control': 'no-store'
          });
        }
        return res.end();
      }

      const session = sessionFor(req);
      if (!session) return json(res, 401, { errorCode: 'AUTHENTICATION_REQUIRED' });

      if (req.method === 'GET' && url.pathname === '/api/etsy/status') {
        return json(res, 200, { ...integration.getStatus(), csrfToken: session.csrf });
      }
      if (req.method === 'GET' && url.pathname === '/api/etsy/listings') {
        if (!listingPublisher) {
          throw new EtsyIntegrationError(
            'EXECUTION_DISABLED',
            'Etsy listing publication is disabled'
          );
        }
        return json(res, 200, await listingPublisher.overview());
      }
      if (req.method === 'POST' && !requireCsrf(req, session)) {
        return json(res, 403, { errorCode: 'CSRF_REJECTED' });
      }
      if (req.method === 'POST' && url.pathname === '/api/etsy/test-connection') {
        const status = await integration.testConnection();
        return json(res, 200, status);
      }
      if (req.method === 'POST' && url.pathname === '/api/etsy/connect') {
        const authorizationUrl = await integration.beginAuthorization();
        return json(res, 200, { authorizationUrl });
      }
      if (req.method === 'POST' && url.pathname === '/api/etsy/disconnect') {
        await integration.disconnect();
        return json(res, 200, integration.getStatus());
      }
      if (req.method === 'POST' && url.pathname === '/api/etsy/listings/publish-all') {
        if (!listingPublisher) {
          throw new EtsyIntegrationError(
            'EXECUTION_DISABLED',
            'Etsy listing publication is disabled'
          );
        }
        const body = await readJson(req);
        if (body.confirmation !== 'PUBLISH_ALL_ACTIVE') {
          throw new EtsyIntegrationError(
            'CONFIRMATION_REQUIRED',
            'Exact bulk publication confirmation is required'
          );
        }
        if (typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision)) {
          throw new EtsyIntegrationError('REQUEST_INVALID', 'A valid catalog revision is required');
        }
        return json(res, 200, await listingPublisher.publishAllActive({ revision: body.revision }));
      }
      return json(res, 404, { errorCode: 'NOT_FOUND' });
    } catch (error) {
      const clientErrors = new Set([
        'CATALOG_CHANGED',
        'CONFIRMATION_REQUIRED',
        'NO_ELIGIBLE_LISTINGS',
        'REQUEST_INVALID',
        'TAXONOMY_AMBIGUOUS',
        'TAXONOMY_NOT_FOUND'
      ]);
      const status = error.code === 'EXECUTION_DISABLED'
        ? 503
        : clientErrors.has(error.code)
          ? 409
          : 502;
      return json(res, status, {
        errorCode: error.code || 'INTEGRATION_ERROR',
        message: 'The Etsy operation could not be completed safely.'
      });
    }
  });

  server.on('close', () => {
    sessions.clear();
    loginAttempts.clear();
  });
  return server;
}

function startFromEnvironment() {
  const integration = createEtsyIntegration(process.env);
  const listingPublisher = createListingPublisherFromEnv(process.env, integration);
  if (
    integration.config?.redirectUri &&
    integration.config.redirectUri !== `${process.env.ETSY_PUBLIC_ORIGIN}/etsy/oauth/callback`
  ) {
    throw new EtsyIntegrationError(
      'CONFIG_INVALID',
      'ETSY_REDIRECT_URI must equal ETSY_PUBLIC_ORIGIN plus /etsy/oauth/callback'
    );
  }
  const server = createAdminServer({
    integration,
    listingPublisher,
    adminToken: process.env.ETSY_ADMIN_TOKEN,
    publicOrigin: process.env.ETSY_PUBLIC_ORIGIN
  });
  const host = process.env.ETSY_BIND_HOST || '127.0.0.1';
  const port = Number(process.env.ETSY_PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EtsyIntegrationError('CONFIG_INVALID', 'ETSY_PORT must be a valid TCP port');
  }
  server.listen(port, host, () => {
    process.stdout.write(JSON.stringify({
      event: 'etsy.admin_server.started',
      host,
      port,
      executionEnabled: process.env.ETSY_EXECUTION_ENABLED === 'true'
    }) + '\n');
  });
}

if (
  typeof process !== 'undefined' &&
  process.argv?.[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  startFromEnvironment();
}
