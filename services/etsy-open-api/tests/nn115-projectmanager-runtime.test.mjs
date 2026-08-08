import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OWNER_INTENT,
  ProjectManagerRuntime,
  dailyExecutionKey,
} from '../src/nn115/projectmanager-runtime.mjs';

const NOW = '2026-08-08T06:00:00.000Z';

function plan() {
  return {
    schemaVersion: '1.0.0',
    planId: `sha256:${'a'.repeat(64)}`,
    nextAction: {
      taskId: 'NN-115',
      title: OWNER_INTENT,
      eligible: true,
      terminal: false,
      status: 'Goedgekeurd',
      blockers: [],
      action: {
        kind: 'read-only',
        estimatedCostEur: 0,
        idempotencyKey: 'NN-115:etsy-intelligence:daily:v2',
      },
    },
    audit: {
      sourceTaskId: 'NN-115',
      sourceReadbackVerified: true,
      secretsIncluded: false,
    },
  };
}

class RuntimeStoreFixture {
  constructor() {
    this.executions = new Map();
    this.results = new Map();
    this.claimCount = 0;
    this.completeCount = 0;
    this.updates = [];
    this.snapshot = null;
  }

  async createExecution(seed) {
    const existing = this.executions.get(seed.executionId);
    if (existing) return { created: false, execution: existing };
    this.executions.set(seed.executionId, seed);
    return { created: true, execution: seed };
  }

  async readExecution(executionId) {
    return this.executions.get(executionId) ?? null;
  }

  async readLatestExecution() {
    return [...this.executions.values()].at(-1) ?? null;
  }

  async claimExecution(executionId, ownerId) {
    const current = this.executions.get(executionId);
    if (current.state === 'COMPLETED') return { claimed: false, reason: 'TERMINAL', execution: current };
    this.claimCount += 1;
    const execution = {
      ...current,
      state: 'RUNNING',
      updatedAt: NOW,
      lastHeartbeatAt: NOW,
      step: 'claimed',
      currentComponent: 'projectmanager-runtime',
      attempt: current.attempt + 1,
      leaseOwner: ownerId,
      fencingToken: current.fencingToken + 1,
      leaseExpiresAt: '2026-08-08T06:05:00.000Z',
    };
    this.executions.set(executionId, execution);
    return { claimed: true, execution, claim: { ownerId, fencingToken: execution.fencingToken } };
  }

  async updateExecution(executionId, _claim, patch) {
    const execution = { ...this.executions.get(executionId), ...patch };
    this.executions.set(executionId, execution);
    this.updates.push(patch);
    return execution;
  }

  async completeExecution(executionId, _claim, result, options) {
    this.completeCount += 1;
    this.results.set(result.resultId, result);
    const execution = {
      ...this.executions.get(executionId),
      state: 'COMPLETED',
      step: 'completed',
      currentComponent: 'projectmanager-runtime',
      resultId: result.resultId,
      resultHash: 'b'.repeat(64),
      providerReadbackState: options.providerReadbackState,
      nextEligibleRun: options.nextEligibleRun,
      retryEligible: false,
      blockingReason: null,
      lastErrorClass: null,
      leaseOwner: null,
      leaseExpiresAt: null,
    };
    this.executions.set(executionId, execution);
    return execution;
  }

  async readResult(resultId) {
    return this.results.get(resultId) ?? null;
  }

  async readLatestSnapshot() {
    return this.snapshot;
  }

  async health() {
    return { connected: true, keyCount: 7 };
  }
}

function worker(resultOverrides = {}) {
  const calls = [];
  return {
    calls,
    async run(input) {
      calls.push(input);
      return {
        resultId: `nn115-result-${'c'.repeat(32)}`,
        executionId: input.executionId,
        taskId: 'NN-115',
        specialistTaskId: 'NN-101',
        outcome: 'REFRESHED',
        snapshotId: 'etsy:daily:2026-08-08',
        snapshotHash: 'd'.repeat(64),
        capturedAt: NOW,
        providerCalls: 3,
        observations: 2,
        shops: 2,
        ownExclusions: 0,
        ownCatalogListings: 2,
        rankedOpportunities: [],
        recommendedOpportunity: null,
        publication: { allowed: false, approvalRequired: true, state: 'AWAITING_APPROVAL' },
        nextEligibleRun: '2026-08-09T06:00:00.000Z',
        secretValuesReported: false,
        ...resultOverrides,
      };
    },
  };
}

test('daily identity is deterministic within a UTC day and rotates on the next day', () => {
  assert.equal(OWNER_INTENT, 'Analyseer actuele Etsy-marktdata voor NumberNinjaDesigns en bepaal de slimste volgende listing opportunity. Gebruik alleen verse data; als de data te oud is, ververs deze automatisch. Controleer bestaande producten om duplicatie te voorkomen. Publiceer niets zonder vereiste approval.');
  assert.equal(dailyExecutionKey(new Date(NOW)), 'NN-115:etsy-intelligence:daily:v2:2026-08-08');
  assert.notEqual(dailyExecutionKey(new Date(NOW)), dailyExecutionKey(new Date('2026-08-09T06:00:00.000Z')));
});

test('runtime execution fails closed before durable or provider work when execution is disabled', async () => {
  const store = new RuntimeStoreFixture();
  const specialist = worker();
  const runtime = new ProjectManagerRuntime({
    store,
    worker: specialist,
    plan: plan(),
    clock: () => Date.parse(NOW),
    executionEnabled: false,
  });

  await assert.rejects(
    runtime.execute({
      ownerIntent: OWNER_INTENT,
      idempotencyKey: dailyExecutionKey(new Date(NOW)),
      invocationId: 'cloud-invocation-disabled',
    }),
    { code: 'ETSY_EXECUTION_DISABLED', statusCode: 503 },
  );
  assert.equal(store.executions.size, 0);
  assert.equal(specialist.calls.length, 0);
});

test('Projectmanager claims durable state, routes to NN-101, validates provider readback, and completes', async () => {
  const store = new RuntimeStoreFixture();
  const specialist = worker();
  const runtime = new ProjectManagerRuntime({ store, worker: specialist, plan: plan(), clock: () => Date.parse(NOW), executionEnabled: true });

  const output = await runtime.execute({
    ownerIntent: OWNER_INTENT,
    idempotencyKey: dailyExecutionKey(new Date(NOW)),
    invocationId: 'cloud-invocation-a',
  });

  assert.equal(output.accepted, true);
  assert.equal(output.replay, false);
  assert.equal(output.execution.state, 'COMPLETED');
  assert.equal(output.execution.providerReadbackState, 'REFRESHED');
  assert.equal(output.result.specialistTaskId, 'NN-101');
  assert.equal(output.route, 'OWNER_INTENT>PROJECTMANAGER>PLAN>NN-101>RESULT>VALIDATION');
  assert.equal(store.claimCount, 1);
  assert.equal(store.completeCount, 1);
  assert.equal(specialist.calls.length, 1);
  assert.equal(store.updates[0].step, 'routing-etsy-intelligence');
});

test('identical terminal replay reads the durable result without invoking Etsy again', async () => {
  const store = new RuntimeStoreFixture();
  const specialist = worker();
  const runtime = new ProjectManagerRuntime({ store, worker: specialist, plan: plan(), clock: () => Date.parse(NOW), executionEnabled: true });
  const input = { ownerIntent: OWNER_INTENT, idempotencyKey: dailyExecutionKey(new Date(NOW)), invocationId: 'cloud-invocation-a' };

  const first = await runtime.execute(input);
  const replay = await runtime.execute({ ...input, invocationId: 'cloud-invocation-b' });

  assert.equal(replay.accepted, true);
  assert.equal(replay.replay, true);
  assert.equal(replay.execution.executionId, first.execution.executionId);
  assert.equal(replay.result.resultId, first.result.resultId);
  assert.equal(specialist.calls.length, 1);
  assert.equal(store.completeCount, 1);
});

test('status is computed from durable execution, store health, snapshot, and result without hardcoded green', async () => {
  const store = new RuntimeStoreFixture();
  const specialist = worker();
  const runtime = new ProjectManagerRuntime({ store, worker: specialist, plan: plan(), clock: () => Date.parse(NOW), executionEnabled: true });
  await runtime.execute({ ownerIntent: OWNER_INTENT, idempotencyKey: dailyExecutionKey(new Date(NOW)), invocationId: 'cloud-invocation-a' });
  store.snapshot = {
    snapshotId: 'etsy:daily:2026-08-08',
    capturedAt: NOW,
    nextEligibleRun: '2026-08-09T06:00:00.000Z',
    evidence: { sampledObservations: 2, uniqueShops: 2, ownExcludedCount: 0 },
  };

  const status = await runtime.status();

  assert.equal(status.ok, true);
  assert.equal(status.projectmanager.status, 'COMPLETED');
  assert.equal(status.projectmanager.durableStore.connected, true);
  assert.equal(status.etsy.latestSnapshot.snapshotId, 'etsy:daily:2026-08-08');
  assert.equal(status.etsy.latestSnapshot.ageSeconds, 0);
  assert.equal(status.etsy.lastResult.outcome, 'REFRESHED');
  assert.deepEqual(status.blockers, []);
  assert.equal(status.secretValuesReported, false);
});
