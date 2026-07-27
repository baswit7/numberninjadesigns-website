import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import health from '../api/health.mjs';
import status from '../api/status.mjs';
import disabledAction from '../api/disabled-action.mjs';
import oauthCallback from '../api/oauth-callback.mjs';

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
});
