import { readFile } from 'node:fs/promises';

import { projectDurableExecution } from '../vendor/projectmanager/durable-execution.mjs';
import { createDurableExecutionStore } from './durable-execution-store.mjs';
import {
  assertReadOnlyProjectManagerPlan,
  buildExecutionSeed,
} from './execution-contract.mjs';
import {
  ControlledInterruptionError,
  createEtsyIntelligenceWorker,
} from './etsy-intelligence-worker.mjs';

export const OWNER_INTENT = 'Analyseer actuele Etsy-marktdata en bepaal de slimste volgende listing opportunity.';
const DAILY_IDEMPOTENCY_PREFIX = 'NN-115:etsy-intelligence:daily:v1';
const INVOCATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/u;
const TERMINAL_STATES = new Set(['COMPLETED', 'FAILED_TERMINAL']);
const EXTERNAL_BLOCKERS = new Set([
  'ETSY_AUTHORITY_MISSING',
  'ETSY_CATALOG_AUTHORITY_REJECTED',
  'ETSY_CATALOG_SCHEMA_INVALID',
  'ETSY_MARKET_AUTHORITY_REJECTED',
]);
const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export class ProjectManagerRuntimeError extends Error {
  constructor(code, message, statusCode = 500, details = null) {
    super(message);
    this.name = 'ProjectManagerRuntimeError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function fail(code, message, statusCode, details) {
  throw new ProjectManagerRuntimeError(code, message, statusCode, details);
}

function instant(clock) {
  const now = new Date(clock());
  if (!Number.isFinite(now.getTime())) fail('CLOCK_INVALID', 'Runtime clock is invalid.', 500);
  return now;
}

export function dailyExecutionKey(now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('CLOCK_INVALID', 'Runtime clock is invalid.', 500);
  return `${DAILY_IDEMPOTENCY_PREFIX}:${now.toISOString().slice(0, 10)}`;
}

function safeErrorClass(error) {
  const candidate = String(error?.code ?? 'UNCLASSIFIED_RUNTIME_FAILURE').toLocaleUpperCase('en-US');
  const normalized = candidate.replace(/[^A-Z0-9_]/gu, '_').slice(0, 160);
  return normalized.length >= 3 ? normalized : 'UNCLASSIFIED_RUNTIME_FAILURE';
}

function classifyFailure(error, now) {
  const lastErrorClass = safeErrorClass(error);
  if (EXTERNAL_BLOCKERS.has(lastErrorClass) || error?.statusCode === 401 || error?.statusCode === 403) {
    return {
      state: 'BLOCKED_EXTERNAL',
      step: 'blocked-external',
      currentComponent: 'etsy-intelligence-worker',
      providerReadbackState: 'FAILED',
      retryEligible: false,
      blockingReason: 'Read-only Etsy authority or provider contract requires operator attention.',
      lastErrorClass,
      nextEligibleRun: null,
    };
  }
  if (TRANSIENT_STATUS.has(Number(error?.statusCode))) {
    return {
      state: 'RETRY_ELIGIBLE',
      step: 'retry-eligible',
      currentComponent: 'etsy-intelligence-worker',
      providerReadbackState: 'FAILED',
      retryEligible: true,
      blockingReason: 'A transient cloud or provider dependency interrupted the read-only run.',
      lastErrorClass,
      nextEligibleRun: new Date(now.getTime() + 5 * 60_000).toISOString(),
    };
  }
  return {
    state: 'BLOCKED_INTERNAL',
    step: 'blocked-internal',
    currentComponent: 'projectmanager-runtime',
    providerReadbackState: 'FAILED',
    retryEligible: false,
    blockingReason: 'The bounded runtime rejected an internal contract or state transition.',
    lastErrorClass,
    nextEligibleRun: null,
  };
}

function executionResponse({ execution, result = null, replay, accepted = true, reason = null }) {
  return Object.freeze({
    schemaVersion: '1.0.0',
    accepted,
    replay,
    reason,
    route: 'OWNER_INTENT>PROJECTMANAGER>PLAN>NN-101>RESULT>VALIDATION',
    execution: projectDurableExecution(execution),
    result,
    secretValuesReported: false,
  });
}

function latestSnapshotProjection(snapshot, now) {
  if (!snapshot) return null;
  const captured = Date.parse(snapshot.capturedAt ?? '');
  return Object.freeze({
    snapshotId: snapshot.snapshotId ?? null,
    capturedAt: Number.isFinite(captured) ? new Date(captured).toISOString() : null,
    ageSeconds: Number.isFinite(captured) && captured <= now.getTime()
      ? Math.floor((now.getTime() - captured) / 1_000)
      : null,
    observations: snapshot.evidence?.sampledObservations ?? null,
    shops: snapshot.evidence?.uniqueShops ?? null,
    ownExclusions: snapshot.evidence?.ownExcludedCount ?? null,
    nextEligibleRefresh: snapshot.nextEligibleRun ?? null,
  });
}

function resultProjection(result) {
  if (!result) return null;
  return Object.freeze({
    resultId: result.resultId ?? null,
    outcome: result.outcome ?? null,
    capturedAt: result.capturedAt ?? null,
    providerCalls: result.providerCalls ?? null,
    observations: result.observations ?? null,
    shops: result.shops ?? null,
    ownExclusions: result.ownExclusions ?? null,
    recommendedOpportunity: result.recommendedOpportunity ?? null,
    publication: result.publication ?? null,
  });
}

export class ProjectManagerRuntime {
  constructor({ store, worker, plan, clock = Date.now }) {
    if (!store || typeof store.createExecution !== 'function' || typeof store.health !== 'function') {
      fail('RUNTIME_CONFIG_INVALID', 'Durable execution store is required.', 500);
    }
    if (!worker || typeof worker.run !== 'function') fail('RUNTIME_CONFIG_INVALID', 'NN-101 specialist worker is required.', 500);
    if (typeof clock !== 'function') fail('RUNTIME_CONFIG_INVALID', 'Runtime clock is required.', 500);
    this.plan = assertReadOnlyProjectManagerPlan(plan, OWNER_INTENT);
    this.store = store;
    this.worker = worker;
    this.clock = clock;
  }

  async execute({ ownerIntent, idempotencyKey, invocationId, control = null }) {
    if (ownerIntent !== OWNER_INTENT) fail('OWNER_INTENT_REJECTED', 'Owner intent is outside the accepted NN-115 scope.', 400);
    if (typeof invocationId !== 'string' || !INVOCATION_ID.test(invocationId)) {
      fail('INVOCATION_ID_INVALID', 'Cloud invocation identity is invalid.', 400);
    }
    if (
      control !== null
      && (
        typeof control !== 'object'
        || Array.isArray(control)
        || Object.keys(control).length !== 1
        || control.controlledInterruption !== true
        || !idempotencyKey.startsWith('NN-115:etsy-intelligence:interruption:v1:')
      )
    ) fail('EXECUTION_CONTROL_REJECTED', 'Execution control is outside the recovery pilot contract.', 400);
    const now = instant(this.clock);
    const seed = buildExecutionSeed({ plan: this.plan, ownerIntent, idempotencyKey, now });
    const created = await this.store.createExecution(seed);
    if (created.execution.state === 'COMPLETED') {
      const result = await this.store.readResult(created.execution.resultId);
      if (!result) fail('DURABLE_RESULT_MISSING', 'Completed execution has no durable result.', 500);
      return executionResponse({ execution: created.execution, result, replay: true });
    }
    if (created.execution.state === 'FAILED_TERMINAL') {
      return executionResponse({ execution: created.execution, replay: true, accepted: false, reason: 'TERMINAL_FAILURE' });
    }

    const claimed = await this.store.claimExecution(seed.executionId, invocationId);
    if (!claimed.claimed) {
      if (claimed.reason === 'TERMINAL' && claimed.execution.state === 'COMPLETED') {
        const result = await this.store.readResult(claimed.execution.resultId);
        if (!result) fail('DURABLE_RESULT_MISSING', 'Completed execution has no durable result.', 500);
        return executionResponse({ execution: claimed.execution, result, replay: true });
      }
      return executionResponse({
        execution: claimed.execution,
        replay: !created.created,
        accepted: true,
        reason: claimed.reason,
      });
    }

    try {
      await this.store.updateExecution(seed.executionId, claimed.claim, {
        state: 'RUNNING',
        step: 'routing-etsy-intelligence',
        currentComponent: 'etsy-intelligence-worker',
        providerReadbackState: 'PENDING',
        retryEligible: false,
        blockingReason: null,
        lastErrorClass: null,
        nextEligibleRun: null,
      });
      const result = await this.worker.run({ executionId: seed.executionId, claim: claimed.claim, control });
      if (result?.executionId !== seed.executionId || result?.taskId !== 'NN-115' || result?.specialistTaskId !== 'NN-101') {
        fail('SPECIALIST_RESULT_INVALID', 'NN-101 returned an invalid execution binding.', 500);
      }
      const providerReadbackState = result.outcome === 'NOOP_FRESH' ? 'FRESH' : 'REFRESHED';
      const completed = await this.store.completeExecution(seed.executionId, claimed.claim, result, {
        providerReadbackState,
        nextEligibleRun: result.nextEligibleRun ?? null,
      });
      return executionResponse({ execution: completed, result, replay: !created.created });
    } catch (error) {
      if (error instanceof ControlledInterruptionError || error?.code === 'CONTROLLED_INTERRUPTION') throw error;
      const failure = classifyFailure(error, now);
      await this.store.updateExecution(seed.executionId, claimed.claim, failure).catch(() => {});
      throw error;
    }
  }

  async status() {
    const now = instant(this.clock);
    const [health, execution, snapshot] = await Promise.all([
      this.store.health(),
      this.store.readLatestExecution(),
      this.store.readLatestSnapshot(),
    ]);
    const result = execution?.resultId ? await this.store.readResult(execution.resultId) : null;
    const blockers = [];
    if (health.connected !== true) blockers.push('DURABLE_STORE_UNAVAILABLE');
    if (execution?.blockingReason) blockers.push(execution.blockingReason);
    if (execution?.state === 'FAILED_TERMINAL') blockers.push('LAST_EXECUTION_FAILED_TERMINAL');
    const workerState = execution === null
      ? 'IDLE'
      : execution.state === 'COMPLETED'
        ? 'HEALTHY'
        : TERMINAL_STATES.has(execution.state)
          ? 'ERROR'
          : execution.state;
    return Object.freeze({
      schemaVersion: '1.0.0',
      ok: health.connected === true && !blockers.length,
      checkedAt: now.toISOString(),
      projectmanager: Object.freeze({
        status: execution?.state ?? 'IDLE',
        lastCloudHeartbeat: execution?.lastHeartbeatAt ?? null,
        lastExecution: execution ? projectDurableExecution(execution) : null,
        durableStore: health,
        cloudWorker: Object.freeze({ state: workerState }),
      }),
      etsy: Object.freeze({
        latestSnapshot: latestSnapshotProjection(snapshot, now),
        lastResult: resultProjection(result),
      }),
      blockers: Object.freeze(blockers),
      secretValuesReported: false,
    });
  }
}

export async function loadProjectManagerPlan(url = new URL('../config/nn115-projectmanager-plan.json', import.meta.url)) {
  let value;
  try {
    value = JSON.parse(await readFile(url, 'utf8'));
  } catch {
    fail('PLAN_LOAD_FAILED', 'Projectmanager cloud plan is unavailable.', 500);
  }
  return assertReadOnlyProjectManagerPlan(value, OWNER_INTENT);
}

export async function createProjectManagerRuntime(env = process.env, dependencies = {}) {
  const store = dependencies.store ?? createDurableExecutionStore(env, dependencies.storeDependencies ?? {});
  const worker = dependencies.worker ?? await createEtsyIntelligenceWorker(env, { store, ...dependencies.workerDependencies });
  const plan = dependencies.plan ?? await loadProjectManagerPlan(dependencies.planUrl);
  return new ProjectManagerRuntime({ store, worker, plan, clock: dependencies.clock ?? Date.now });
}
