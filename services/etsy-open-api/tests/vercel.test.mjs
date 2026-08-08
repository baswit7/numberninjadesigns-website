import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import health from '../api/health.mjs';
import status from '../api/status.mjs';
import disabledAction from '../api/disabled-action.mjs';
import oauthCallback from '../api/oauth-callback.mjs';
import pinterestOAuthCallback from '../api/pinterest-oauth-callback.mjs';

function invoke(handler, method = 'GET', url = '/') {
  const headers = new Map();
  let body = '';
  const response = {
    statusCode: 0,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    end(value = '') {
      body = value;
    }
  };
  handler({ method, url }, response);
  return {
    statusCode: response.statusCode,
    headers,
    body: JSON.parse(body)
  };
}

function invokeText(handler, method = 'GET', url = '/') {
  const headers = new Map();
  let body = '';
  const response = {
    statusCode: 0,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    end(value = '') {
      body = value;
    }
  };
  handler({ method, url }, response);
  return { statusCode: response.statusCode, headers, body };
}

test('Vercel health and status are safe and hard-disabled', () => {
  const healthResult = invoke(health);
  assert.equal(healthResult.statusCode, 200);
  assert.deepEqual(healthResult.body, {
    ok: true,
    service: 'numberninjadesigns-etsy-api',
    executionEnabled: false,
    providerCallsAllowed: false
  });
  assert.equal(healthResult.headers.get('cache-control'), 'no-store, max-age=0');

  const statusResult = invoke(status);
  assert.equal(statusResult.statusCode, 200);
  assert.equal(statusResult.body.state, 'error');
  assert.equal(statusResult.body.errorCode, 'EXECUTION_DISABLED');
  assert.equal(statusResult.body.executionEnabled, false);
  assert.equal(statusResult.body.providerCallsAllowed, false);
});

test('Vercel actions and OAuth callback fail closed without echoing query data', () => {
  const action = invoke(disabledAction, 'POST');
  assert.equal(action.statusCode, 503);
  assert.equal(action.body.errorCode, 'EXECUTION_DISABLED');

  const callback = invoke(
    oauthCallback,
    'GET',
    '/etsy/oauth/callback?code=sensitive-code&state=sensitive-state'
  );
  assert.equal(callback.statusCode, 503);
  assert.equal(callback.body.errorCode, 'EXECUTION_DISABLED');
  assert.doesNotMatch(JSON.stringify(callback.body), /sensitive-code|sensitive-state/);
});

test('Vercel endpoints reject unsupported methods', () => {
  const result = invoke(health, 'POST');
  assert.equal(result.statusCode, 405);
  assert.equal(result.headers.get('allow'), 'GET');
  assert.equal(result.body.errorCode, 'METHOD_NOT_ALLOWED');
});

test('Pinterest callback accepts one safe code/state pair without echoing it', () => {
  const result = invokeText(
    pinterestOAuthCallback,
    'GET',
    '/pinterest/oauth/callback?code=sensitive-code&state=sensitive-state'
  );

  assert.equal(result.statusCode, 200);
  assert.match(result.headers.get('content-type'), /^text\/html/);
  assert.equal(result.headers.get('cache-control'), 'no-store, max-age=0, must-revalidate');
  assert.equal(result.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(result.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.match(result.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(result.body, /Pinterest-toestemming ontvangen/);
  assert.doesNotMatch(result.body, /sensitive-code|sensitive-state/);
});

test('Pinterest callback rejects missing, duplicate and provider-error values', () => {
  const invalidUrls = [
    '/pinterest/oauth/callback?code=only-code',
    '/pinterest/oauth/callback?code=one&code=two&state=state',
    '/pinterest/oauth/callback?error=access_denied&state=state'
  ];

  for (const url of invalidUrls) {
    const result = invokeText(pinterestOAuthCallback, 'GET', url);
    assert.equal(result.statusCode, 400);
    assert.match(result.body, /Pinterest-koppeling niet voltooid/);
    assert.match(result.body, /history\.replaceState/);
    assert.doesNotMatch(result.body, /only-code|access_denied/);
  }
});

test('Pinterest callback rejects unsupported methods', () => {
  const result = invokeText(pinterestOAuthCallback, 'POST');
  assert.equal(result.statusCode, 405);
  assert.equal(result.headers.get('allow'), 'GET');
});

test('Pinterest callback UI uses only canonical brand colors', async () => {
  const [handlerSource, brandTokensSource] = await Promise.all([
    readFile(new URL('../api/pinterest-oauth-callback.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../../../config/brand.tokens.json', import.meta.url), 'utf8')
  ]);
  const brandTokens = JSON.parse(brandTokensSource);
  const allowedColors = new Set(
    Object.values(brandTokens.colors).map((value) => value.toUpperCase())
  );
  const usedColors = [...handlerSource.matchAll(/#[0-9a-f]{3,8}\b/gi)]
    .map((match) => match[0].toUpperCase());

  assert.ok(usedColors.length > 0);
  for (const color of usedColors) {
    assert.ok(allowedColors.has(color), `unapproved callback color: ${color}`);
  }
});

test('Vercel deployment excludes the owner dashboard and active integration', async () => {
  const ignored = await readFile(new URL('../.vercelignore', import.meta.url), 'utf8');
  assert.match(ignored, /^public\/$/m);
  assert.match(ignored, /^src\/integration\.mjs$/m);
  assert.match(ignored, /^src\/server\.mjs$/m);

  const config = JSON.parse(
    await readFile(new URL('../vercel.json', import.meta.url), 'utf8')
  );
  assert.equal(
    config.rewrites.some(({ source }) => source.startsWith('/etsy-admin')),
    false
  );
  assert.deepEqual(
    config.rewrites.find(({ source }) => source === '/pinterest/oauth/callback'),
    {
      source: '/pinterest/oauth/callback',
      destination: '/api/pinterest-oauth-callback'
    }
  );
});
