import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildExecutionSeed,
  hashCanonical,
} from '../src/nn115/execution-contract.mjs';
import {
  DurableExecutionStore,
  DurableStoreError,
} from '../src/nn115/durable-execution-store.mjs';
import { RedisRestClient } from '../src/nn115/redis-rest-client.mjs';

const OWNER_INTENT = 'Analyseer actuele Etsy-marktdata voor NumberNinjaDesigns en bepaal de slimste volgende listing opportunity. Gebruik alleen verse data; als de data te oud is, ververs deze automatisch. Controleer bestaande producten om duplicatie te voorkomen. Publiceer niets zonder vereiste approval.';

function planFixture(overrides = {}) {
  const action = {
    actionId: 'nn115-etsy-intelligence-read',
    kind: 'read-only',
    repositoryId: 'numberninjadesigns-website',
    requiredCapabilities: ['etsy.market-intelligence.read'],
    requiredAgentTypes: ['finance-os-data-productflow-engineer'],
    estimatedCostEur: 0,
    credentialRef: 'etsy-open-api-read-only',
    idempotencyKey: 'NN-115:etsy-intelligence:daily:v2',
  };
  return {
    schemaVersion: '1.0.0',
    snapshotId: 'snapshot-nn115-cloud-v1',
    evaluatedAt: '2026-08-08T18:00:00.000Z',
    orderedTaskIds: ['NN-115'],
    nextAction: {
      taskId: 'NN-115',
      title: OWNER_INTENT,
      projectId: 'numberninja-projectmanager',
      status: 'Goedgekeurd',
      terminal: false,
      priorityScore: 490,
      priorityBreakdown: { impact: 5, urgency: 5, riskReduction: 5, effort: 1 },
      eligible: true,
      blockers: [],
      dependencies: [],
      action,
    },
    decisions: [],
    audit: {
      generatedAt: '2026-08-08T18:00:00.000Z',
      sourceTaskId: 'NN-115',
      sourceReadbackVerified: true,
      taskCount: 1,
      eligibleCount: 1,
      blockedCount: 0,
      terminalCount: 0,
      policyFingerprint: `sha256:${'c'.repeat(64)}`,
      secretsIncluded: false,
    },
    planId: `sha256:${'d'.repeat(64)}`,
    ...overrides,
  };
}

class AtomicRedisFixture {
  constructor({ dropNullsOnClaim = false } = {}) {
    this.values = new Map();
    this.dropNullsOnClaim = dropNullsOnClaim;
  }

  async command(command, ...args) {
    const name = command.toUpperCase();
    if (name === 'GET') return this.values.get(args[0]) ?? null;
    if (name === 'PING') return 'PONG';
    if (name === 'DBSIZE') return this.values.size;
    throw new Error(`unsupported test command ${name}`);
  }

  async eval(script, keys, args) {
    const operation = script.match(/^-- nn115:([a-z-]+)/u)?.[1];
    if (operation === 'create-execution') {
      const [identityKey, executionKey, latestKey] = keys;
      const candidate = JSON.parse(args[0]);
      const knownExecutionId = this.values.get(identityKey);
      if (knownExecutionId) {
        return ['existing', this.values.get(executionKey)];
      }
      this.values.set(identityKey, candidate.executionId);
      this.values.set(executionKey, args[0]);
      this.values.set(latestKey, candidate.executionId);
      return ['created', args[0]];
    }
    if (operation === 'claim-execution') {
      if (args.length === 2) {
        const current = this.values.get(keys[0]);
        if (current === undefined) return ['missing'];
        if (current !== args[0]) return ['changed', current];
        this.values.set(keys[0], args[1]);
        return ['claimed', args[1]];
      }
      const record = JSON.parse(this.values.get(keys[0]));
      const nowMs = Date.parse(args[0]);
      const owner = args[1];
      const leaseExpiresAt = args[2];
      if (['COMPLETED', 'FAILED_TERMINAL'].includes(record.state)) return ['terminal', JSON.stringify(record)];
      if (
        script.includes('record.nextEligibleRun')
        && record.nextEligibleRun
        && Date.parse(record.nextEligibleRun) > nowMs
      ) return ['not-eligible', JSON.stringify(record)];
      if (record.leaseOwner && Date.parse(record.leaseExpiresAt) > nowMs && record.leaseOwner !== owner) {
        return ['lease-held', JSON.stringify(record)];
      }
      record.state = 'RUNNING';
      record.updatedAt = new Date(nowMs).toISOString();
      record.lastHeartbeatAt = record.updatedAt;
      record.step = 'claimed';
      record.currentComponent = 'projectmanager-runtime';
      record.attempt += 1;
      record.retryEligible = false;
      record.leaseOwner = owner;
      record.fencingToken += 1;
      record.leaseExpiresAt = leaseExpiresAt;
      if (this.dropNullsOnClaim) {
        for (const [key, value] of Object.entries(record)) {
          if (value === null) delete record[key];
        }
      }
      this.values.set(keys[0], JSON.stringify(record));
      return ['claimed', JSON.stringify(record)];
    }
    if (operation === 'update-execution') {
      const current = JSON.parse(this.values.get(keys[0]));
      if (current.leaseOwner !== args[0] || current.fencingToken !== Number(args[1]) || current.leaseExpiresAt <= args[3]) return ['fence-rejected', JSON.stringify(current)];
      this.values.set(keys[0], args[2]);
      return ['updated', args[2]];
    }
    if (operation === 'renew-execution') {
      const current = this.values.get(keys[0]);
      if (current === undefined) return ['missing'];
      const record = JSON.parse(current);
      if (record.leaseOwner !== args[0] || record.fencingToken !== Number(args[1]) || record.leaseExpiresAt <= args[2]) {
        return ['fence-rejected', current];
      }
      if (current !== args[3]) return ['changed', current];
      this.values.set(keys[0], args[4]);
      return ['renewed', args[4]];
    }
    if (operation === 'write-checkpoint') {
      const current = JSON.parse(this.values.get(keys[0]));
      if (current.leaseOwner !== args[0] || current.fencingToken !== Number(args[1])) return ['fence-rejected'];
      this.values.set(keys[1], args[2]);
      return ['stored'];
    }
    if (operation === 'complete-execution') {
      const current = JSON.parse(this.values.get(keys[0]));
      if (current.leaseOwner !== args[0] || current.fencingToken !== Number(args[1])) return ['fence-rejected', JSON.stringify(current)];
      this.values.set(keys[0], args[2]);
      this.values.set(keys[1], args[3]);
      return ['completed', args[2]];
    }
    if (operation === 'publish-snapshot') {
      const execution = JSON.parse(this.values.get(keys[0]));
      if (execution.leaseOwner !== args[0] || execution.fencingToken !== Number(args[1]) || execution.leaseExpiresAt <= args[2]) {
        return ['fence-rejected'];
      }
      const existing = this.values.get(keys[1]);
      if (existing) {
        const existingSnapshot = JSON.parse(existing);
        const candidate = JSON.parse(args[3]);
        return existingSnapshot.snapshotHash === candidate.snapshotHash
          ? ['existing', existing]
          : ['conflict', existing];
      }
      this.values.set(keys[1], args[3]);
      this.values.set(keys[2], keys[1]);
      return ['created', args[3]];
    }
    throw new Error(`unsupported test script ${operation}`);
  }
}

test('execution seed binds the accepted Projectmanager plan, owner intent, zero cost, and read-only approval state', () => {
  const plan = planFixture();
  const record = buildExecutionSeed({
    plan,
    ownerIntent: OWNER_INTENT,
    idempotencyKey: 'nn115:etsy:daily:2026-08-08',
    now: new Date('2026-08-08T18:10:00.000Z'),
  });

  assert.equal(record.taskId, 'NN-115');
  assert.equal(record.planId, plan.planId);
  assert.equal(record.ownerIntentHash, hashCanonical(OWNER_INTENT));
  assert.equal(record.planContentHash, hashCanonical(plan));
  assert.equal(record.state, 'QUEUED');
  assert.equal(record.approvalState, 'NOT_REQUIRED_READ_ONLY');
  assert.equal(record.costState, 'ZERO_NEW_RECURRING_COMMITMENT');
  assert.equal(record.resultId, null);
  assert.equal(record.leaseOwner, null);

  assert.throws(
    () => buildExecutionSeed({
      plan: planFixture({ nextAction: { ...plan.nextAction, action: { ...plan.nextAction.action, kind: 'external' } } }),
      ownerIntent: OWNER_INTENT,
      idempotencyKey: 'nn115:etsy:daily:2026-08-08',
      now: new Date('2026-08-08T18:10:00.000Z'),
    }),
    { code: 'PLAN_NOT_READ_ONLY' },
  );

  const activePlan = planFixture({
    nextAction: { ...plan.nextAction, status: 'In uitvoering' },
  });
  assert.equal(buildExecutionSeed({
    plan: activePlan,
    ownerIntent: OWNER_INTENT,
    idempotencyKey: 'nn115:etsy:daily:active',
    now: new Date('2026-08-08T18:10:00.000Z'),
  }).state, 'QUEUED');
});

test('two store instances share execution state, coalesce identical replay, and reject identity conflicts', async () => {
  const client = new AtomicRedisFixture();
  const storeA = new DurableExecutionStore({ client, clock: () => Date.parse('2026-08-08T18:10:00.000Z') });
  const storeB = new DurableExecutionStore({ client, clock: () => Date.parse('2026-08-08T18:10:01.000Z') });
  const seed = buildExecutionSeed({
    plan: planFixture(),
    ownerIntent: OWNER_INTENT,
    idempotencyKey: 'nn115:etsy:daily:2026-08-08',
    now: new Date('2026-08-08T18:10:00.000Z'),
  });

  const created = await storeA.createExecution(seed);
  const replay = await storeB.createExecution(seed);
  const readback = await storeB.readExecution(seed.executionId);
  assert.equal(created.created, true);
  assert.equal(replay.created, false);
  assert.deepEqual(readback, created.execution);

  await assert.rejects(
    storeB.createExecution({ ...seed, ownerIntentHash: 'e'.repeat(64) }),
    { code: 'IDEMPOTENCY_CONFLICT' },
  );
});

test('expired leases are reclaimed with fencing while stale invocations cannot checkpoint or complete', async () => {
  let nowMs = Date.parse('2026-08-08T18:10:00.000Z');
  const client = new AtomicRedisFixture();
  const storeA = new DurableExecutionStore({ client, clock: () => nowMs, leaseMs: 1_000 });
  const storeB = new DurableExecutionStore({ client, clock: () => nowMs, leaseMs: 1_000 });
  const seed = buildExecutionSeed({
    plan: planFixture(),
    ownerIntent: OWNER_INTENT,
    idempotencyKey: 'nn115:pilot:interruption:2026-08-08',
    now: new Date(nowMs),
  });
  await storeA.createExecution(seed);
  const first = await storeA.claimExecution(seed.executionId, 'process-a');
  const held = await storeB.claimExecution(seed.executionId, 'process-b');
  assert.equal(first.claimed, true);
  assert.equal(held.claimed, false);
  assert.equal(held.reason, 'LEASE_HELD');

  nowMs += 1_001;
  const recovered = await storeB.claimExecution(seed.executionId, 'process-b');
  assert.equal(recovered.claimed, true);
  assert.equal(recovered.execution.attempt, 2);
  assert.equal(recovered.execution.fencingToken, first.execution.fencingToken + 1);
  await assert.rejects(
    storeA.writeCheckpoint(seed.executionId, first.claim, 'provider-page-1', { safe: true }),
    { code: 'FENCE_REJECTED' },
  );
  await storeB.writeCheckpoint(seed.executionId, recovered.claim, 'provider-page-1', { safe: true });
  assert.deepEqual(await storeA.readCheckpoint(seed.executionId, 'provider-page-1'), { safe: true });

  const result = { resultId: 'result-nn115-pilot', outcome: 'RECOVERED', providerCalls: 0 };
  const completed = await storeB.completeExecution(seed.executionId, recovered.claim, result, {
    providerReadbackState: 'NOT_CALLED',
    nextEligibleRun: '2026-08-09T06:00:00.000Z',
  });
  assert.equal(completed.state, 'COMPLETED');
  assert.equal(completed.resultHash, hashCanonical(result));
  await assert.rejects(
    storeA.completeExecution(seed.executionId, first.claim, result),
    { code: 'FENCE_REJECTED' },
  );
});

test('claim preserves closed-contract null fields when Redis Lua JSON omits null members', async () => {
  const nowMs = Date.parse('2026-08-08T18:10:00.000Z');
  const client = new AtomicRedisFixture({ dropNullsOnClaim: true });
  const store = new DurableExecutionStore({ client, clock: () => nowMs, leaseMs: 1_000 });
  const seed = buildExecutionSeed({
    plan: planFixture(),
    ownerIntent: OWNER_INTENT,
    idempotencyKey: 'nn115:pilot:null-preservation:2026-08-08',
    now: new Date(nowMs),
  });

  await store.createExecution(seed);
  const claimed = await store.claimExecution(seed.executionId, 'process-a');

  assert.equal(claimed.claimed, true);
  assert.equal(claimed.execution.blockingReason, null);
  assert.equal(claimed.execution.lastErrorClass, null);
  assert.equal(claimed.execution.nextEligibleRun, null);
  assert.equal(claimed.execution.resultId, null);
  assert.equal(claimed.execution.resultHash, null);
});

test('retry backoff prevents a claim until nextEligibleRun', async () => {
  let nowMs = Date.parse('2026-08-08T18:10:00.000Z');
  const client = new AtomicRedisFixture();
  const store = new DurableExecutionStore({ client, clock: () => nowMs, leaseMs: 1_000 });
  const seed = buildExecutionSeed({
    plan: planFixture(),
    ownerIntent: OWNER_INTENT,
    idempotencyKey: 'nn115:retry:2026-08-08',
    now: new Date(nowMs),
  });
  const waiting = {
    ...seed,
    state: 'RETRY_ELIGIBLE',
    retryEligible: true,
    nextEligibleRun: '2026-08-08T18:15:00.000Z',
  };
  await store.createExecution(waiting);

  const early = await store.claimExecution(seed.executionId, 'process-a');
  assert.equal(early.claimed, false);
  assert.equal(early.reason, 'NOT_ELIGIBLE');
  assert.equal(early.execution.attempt, 0);

  nowMs = Date.parse('2026-08-08T18:15:00.001Z');
  const eligible = await store.claimExecution(seed.executionId, 'process-b');
  assert.equal(eligible.claimed, true);
  assert.equal(eligible.execution.attempt, 1);
});

test('blocked non-retryable executions and the two-attempt contract cannot be claimed again', async () => {
  const nowMs = Date.parse('2026-08-08T18:10:00.000Z');
  const client = new AtomicRedisFixture();
  const store = new DurableExecutionStore({ client, clock: () => nowMs, leaseMs: 1_000 });
  const blockedSeed = buildExecutionSeed({
    plan: planFixture(),
    ownerIntent: OWNER_INTENT,
    idempotencyKey: 'nn115:blocked:2026-08-08',
    now: new Date(nowMs),
  });
  await store.createExecution({
    ...blockedSeed,
    state: 'BLOCKED_EXTERNAL',
    step: 'blocked-external',
    currentComponent: 'etsy-intelligence-worker',
    retryEligible: false,
    blockingReason: 'Operator attention required.',
    lastErrorClass: 'ETSY_AUTHORITY_MISSING',
    providerReadbackState: 'FAILED',
    attempt: 1,
  });

  const blocked = await store.claimExecution(blockedSeed.executionId, 'process-a');
  assert.equal(blocked.claimed, false);
  assert.equal(blocked.reason, 'RETRY_DISABLED');
  assert.equal(blocked.execution.attempt, 1);

  const exhaustedSeed = buildExecutionSeed({
    plan: planFixture(),
    ownerIntent: OWNER_INTENT,
    idempotencyKey: 'nn115:exhausted:2026-08-08',
    now: new Date(nowMs),
  });
  await store.createExecution({
    ...exhaustedSeed,
    state: 'RETRY_ELIGIBLE',
    retryEligible: true,
    attempt: 2,
  });

  const exhausted = await store.claimExecution(exhaustedSeed.executionId, 'process-b');
  assert.equal(exhausted.claimed, false);
  assert.equal(exhausted.reason, 'MAX_ATTEMPTS');
  assert.equal(exhausted.execution.attempt, 2);
});

test('lease heartbeat extends ownership while reclaimed workers remain fenced from snapshot publication', async () => {
  let nowMs = Date.parse('2026-08-08T18:10:00.000Z');
  const client = new AtomicRedisFixture();
  const storeA = new DurableExecutionStore({ client, clock: () => nowMs, leaseMs: 1_000 });
  const storeB = new DurableExecutionStore({ client, clock: () => nowMs, leaseMs: 1_000 });
  const seed = buildExecutionSeed({
    plan: planFixture(),
    ownerIntent: OWNER_INTENT,
    idempotencyKey: 'nn115:snapshot-fence:2026-08-08',
    now: new Date(nowMs),
  });
  await storeA.createExecution(seed);
  const first = await storeA.claimExecution(seed.executionId, 'process-a');

  nowMs += 900;
  const renewed = await storeA.renewExecutionLease(seed.executionId, first.claim);
  assert.equal(renewed.leaseExpiresAt, '2026-08-08T18:10:01.900Z');
  nowMs += 600;
  const stillHeld = await storeB.claimExecution(seed.executionId, 'process-b');
  assert.equal(stillHeld.claimed, false);
  assert.equal(stillHeld.reason, 'LEASE_HELD');

  nowMs += 401;
  const recovered = await storeB.claimExecution(seed.executionId, 'process-b');
  assert.equal(recovered.claimed, true);
  assert.equal(recovered.execution.attempt, 2);
  const snapshot = {
    schemaVersion: '1.0.0',
    snapshotId: 'etsy:daily:2026-08-08',
    capturedAt: '2026-08-08T18:00:00.000Z',
    snapshotHash: 'a'.repeat(64),
  };
  await assert.rejects(
    storeA.publishDailySnapshot(seed.executionId, first.claim, '2026-08-08', snapshot),
    { code: 'FENCE_REJECTED' },
  );
  const published = await storeB.publishDailySnapshot(seed.executionId, recovered.claim, '2026-08-08', snapshot);
  assert.equal(published.created, true);
});

test('default lease covers a bounded serverless provider-read window', () => {
  const store = new DurableExecutionStore({ client: new AtomicRedisFixture() });
  assert.equal(store.leaseMs, 300_000);
});

test('canonical daily snapshot publication is create-once and rejects conflicting content', async () => {
  const nowMs = Date.parse('2026-08-08T18:10:00.000Z');
  const store = new DurableExecutionStore({ client: new AtomicRedisFixture(), clock: () => nowMs });
  const seed = buildExecutionSeed({
    plan: planFixture(),
    ownerIntent: OWNER_INTENT,
    idempotencyKey: 'nn115:snapshot:2026-08-08',
    now: new Date(nowMs),
  });
  await store.createExecution(seed);
  const claimed = await store.claimExecution(seed.executionId, 'process-a');
  const snapshot = {
    schemaVersion: '1.0.0',
    snapshotId: 'etsy:daily:2026-08-08',
    capturedAt: '2026-08-08T18:00:00.000Z',
    snapshotHash: 'a'.repeat(64),
    projection: { keywords: 11, observations: 220 },
  };
  const first = await store.publishDailySnapshot(seed.executionId, claimed.claim, '2026-08-08', snapshot);
  const replay = await store.publishDailySnapshot(seed.executionId, claimed.claim, '2026-08-08', snapshot);
  assert.equal(first.created, true);
  assert.equal(replay.created, false);
  await assert.rejects(
    store.publishDailySnapshot(seed.executionId, claimed.claim, '2026-08-08', { ...snapshot, snapshotHash: 'b'.repeat(64) }),
    { code: 'SNAPSHOT_CONFLICT' },
  );
});

test('Redis REST client sends one authenticated EVAL command and redacts upstream errors', async () => {
  const requests = [];
  const client = new RedisRestClient({
    url: 'https://redis.example.test',
    token: 'sensitive-test-token',
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ result: ['ok'] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.deepEqual(await client.eval('-- nn115:test\nreturn ARGV[1]', ['key-a'], ['value-a']), ['ok']);
  const command = JSON.parse(requests[0].init.body);
  assert.deepEqual(command.slice(0, 4), ['EVAL', '-- nn115:test\nreturn ARGV[1]', 1, 'key-a']);
  assert.equal(requests[0].init.method, 'POST');
  assert.equal(Object.keys(requests[0].init.headers).map(key => key.toLowerCase()).includes('authorization'), true);

  const failing = new RedisRestClient({
    url: 'https://redis.example.test',
    token: 'sensitive-test-token',
    fetchImpl: async () => new Response(JSON.stringify({ error: 'WRONGPASS sensitive-test-token' }), { status: 401 }),
  });
  await assert.rejects(
    failing.command('PING'),
    error => error instanceof DurableStoreError && error.code === 'DURABLE_STORE_UNAVAILABLE'
      && !JSON.stringify(error).includes('sensitive-test-token'),
  );
});
