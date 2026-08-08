import assert from 'node:assert/strict';
import test from 'node:test';

import { createProjectManagerCronHandler } from '../api/projectmanager-cron.mjs';
import { createProjectManagerExecutionsHandler } from '../api/projectmanager-executions.mjs';
import { createProjectManagerStatusHandler } from '../api/projectmanager-status.mjs';
import { OWNER_INTENT } from '../src/nn115/projectmanager-runtime.mjs';

const SECRETS = Object.freeze({
  CRON_SECRET: 'cron-secret-with-at-least-thirty-two-bytes-123456',
  ETSY_ADMIN_TOKEN: 'legacy-admin-token',
  PROJECTMANAGER_ADMIN_SECRET: 'projectmanager-admin-secret-with-thirty-two-bytes',
});
const NOW = Date.parse('2026-08-08T06:00:00.000Z');

function request({ method = 'GET', headers = {}, body, url = '/' } = {}) {
  return { method, headers, body, url };
}

async function invoke(handler, input) {
  const headers = new Map();
  let raw = '';
  const response = {
    statusCode: 0,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    end(value = '') {
      raw = value;
    },
  };
  await handler(input, response);
  return {
    statusCode: response.statusCode,
    headers,
    body: JSON.parse(raw),
  };
}

function runtimeFixture() {
  const executions = [];
  let statusCalls = 0;
  return {
    executions,
    get statusCalls() { return statusCalls; },
    async execute(input) {
      executions.push(input);
      return {
        schemaVersion: '1.0.0',
        accepted: true,
        replay: false,
        reason: null,
        execution: { executionId: 'nn115-exec-route', state: 'COMPLETED' },
        result: { outcome: 'NOOP_FRESH' },
        secretValuesReported: false,
      };
    },
    async status() {
      statusCalls += 1;
      return {
        schemaVersion: '1.0.0',
        ok: true,
        projectmanager: { status: 'COMPLETED' },
        etsy: { latestSnapshot: { snapshotId: 'etsy:daily:2026-08-08' } },
        blockers: [],
        secretValuesReported: false,
      };
    },
  };
}

test('cron route fails closed and an authorized Vercel bearer starts only the canonical daily intent', async () => {
  const runtime = runtimeFixture();
  const handler = createProjectManagerCronHandler({ env: SECRETS, runtimeFactory: async () => runtime, clock: () => NOW });

  const missing = await invoke(handler, request());
  const wrong = await invoke(handler, request({ headers: { authorization: 'Bearer wrong-secret-value-that-is-long-enough' } }));
  assert.equal(missing.statusCode, 401);
  assert.equal(wrong.statusCode, 401);
  assert.equal(runtime.executions.length, 0);

  const allowed = await invoke(handler, request({ headers: { authorization: `Bearer ${SECRETS.CRON_SECRET}` } }));
  assert.equal(allowed.statusCode, 200);
  assert.equal(runtime.executions.length, 1);
  assert.equal(runtime.executions[0].ownerIntent, OWNER_INTENT);
  assert.equal(runtime.executions[0].idempotencyKey, 'NN-115:etsy-intelligence:daily:v2:2026-08-08');
  assert.match(runtime.executions[0].invocationId, /^vercel-cron-/u);
  assert.equal(allowed.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(allowed.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.doesNotMatch(JSON.stringify(allowed.body), /cron-secret|admin-secret/u);
});

test('manual execution route rejects unauthorized, malformed, oversized, and out-of-scope requests', async () => {
  const runtime = runtimeFixture();
  const handler = createProjectManagerExecutionsHandler({ env: SECRETS, runtimeFactory: async () => runtime, clock: () => NOW });
  const authorization = `Bearer ${SECRETS.PROJECTMANAGER_ADMIN_SECRET}`;

  const unauthorized = await invoke(handler, request({ method: 'POST', headers: { 'content-type': 'application/json' }, body: { ownerIntent: OWNER_INTENT } }));
  const wrongType = await invoke(handler, request({ method: 'POST', headers: { authorization, 'content-type': 'text/plain' }, body: { ownerIntent: OWNER_INTENT } }));
  const malformed = await invoke(handler, request({ method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: '{not-json' }));
  const oversized = await invoke(handler, request({ method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify({ ownerIntent: 'x'.repeat(17_000) }) }));
  const outOfScope = await invoke(handler, request({ method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: { ownerIntent: 'Publish an Etsy listing.' } }));

  assert.equal(unauthorized.statusCode, 401);
  assert.equal(wrongType.statusCode, 415);
  assert.equal(malformed.statusCode, 400);
  assert.equal(oversized.statusCode, 413);
  assert.equal(outOfScope.statusCode, 400);
  assert.equal(runtime.executions.length, 0);
});

test('manual route accepts one exact owner intent and derives identity server-side', async () => {
  const runtime = runtimeFixture();
  const handler = createProjectManagerExecutionsHandler({ env: SECRETS, runtimeFactory: async () => runtime, clock: () => NOW });
  const result = await invoke(handler, request({
    method: 'POST',
    headers: { authorization: `Bearer ${SECRETS.PROJECTMANAGER_ADMIN_SECRET}`, 'content-type': 'application/json' },
    body: { ownerIntent: OWNER_INTENT },
  }));

  assert.equal(result.statusCode, 200);
  assert.equal(runtime.executions.length, 1);
  assert.equal(runtime.executions[0].idempotencyKey, 'NN-115:etsy-intelligence:daily:v2:2026-08-08');
  assert.match(runtime.executions[0].invocationId, /^owner-request-/u);
});

test('controlled interruption pilot requires explicit authenticated pilot headers and gets an isolated identity', async () => {
  const runtime = runtimeFixture();
  const handler = createProjectManagerExecutionsHandler({ env: SECRETS, runtimeFactory: async () => runtime, clock: () => NOW });
  const baseHeaders = {
    authorization: `Bearer ${SECRETS.PROJECTMANAGER_ADMIN_SECRET}`,
    'content-type': 'application/json',
  };
  const body = {
    ownerIntent: OWNER_INTENT,
    pilotMode: 'CONTROLLED_INTERRUPTION_V1',
    pilotId: 'nn115-live-pilot-d-20260808',
  };

  const missingGate = await invoke(handler, request({ method: 'POST', headers: baseHeaders, body }));
  assert.equal(missingGate.statusCode, 400);
  assert.equal(runtime.executions.length, 0);

  const allowed = await invoke(handler, request({
    method: 'POST',
    headers: { ...baseHeaders, 'x-nn115-pilot': 'CONTROLLED_INTERRUPTION_V1' },
    body,
  }));
  assert.equal(allowed.statusCode, 200);
  assert.equal(runtime.executions[0].idempotencyKey, 'NN-115:etsy-intelligence:interruption:v1:nn115-live-pilot-d-20260808');
  assert.equal(runtime.executions[0].control.controlledInterruption, true);
  assert.match(runtime.executions[0].invocationId, /^recovery-pilot-/u);
});

test('status route requires the admin boundary and reads actual runtime state', async () => {
  const runtime = runtimeFixture();
  const handler = createProjectManagerStatusHandler({ env: SECRETS, runtimeFactory: async () => runtime });
  const denied = await invoke(handler, request());
  const legacyDenied = await invoke(handler, request({ headers: { authorization: `Bearer ${SECRETS.ETSY_ADMIN_TOKEN}` } }));
  const allowed = await invoke(handler, request({ headers: { authorization: `Bearer ${SECRETS.PROJECTMANAGER_ADMIN_SECRET}` } }));

  assert.equal(denied.statusCode, 401);
  assert.equal(legacyDenied.statusCode, 401);
  assert.equal(allowed.statusCode, 200);
  assert.equal(runtime.statusCalls, 1);
  assert.equal(allowed.body.projectmanager.status, 'COMPLETED');
  assert.equal(allowed.body.etsy.latestSnapshot.snapshotId, 'etsy:daily:2026-08-08');
});

test('routes reject unsupported methods without initializing cloud dependencies', async () => {
  let factories = 0;
  const runtimeFactory = async () => { factories += 1; return runtimeFixture(); };
  const cron = createProjectManagerCronHandler({ env: SECRETS, runtimeFactory, clock: () => NOW });
  const executions = createProjectManagerExecutionsHandler({ env: SECRETS, runtimeFactory, clock: () => NOW });
  const status = createProjectManagerStatusHandler({ env: SECRETS, runtimeFactory });

  assert.equal((await invoke(cron, request({ method: 'POST' }))).statusCode, 405);
  assert.equal((await invoke(executions, request({ method: 'GET' }))).statusCode, 405);
  assert.equal((await invoke(status, request({ method: 'POST' }))).statusCode, 405);
  assert.equal(factories, 0);
});
