import { createHash } from 'node:crypto';

import { validateDurableExecution } from '../vendor/projectmanager/durable-execution.mjs';

const PLAN_ID = /^sha256:[a-f0-9]{64}$/u;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/u;

export class ExecutionContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ExecutionContractError';
    this.code = code;
    this.statusCode = 400;
  }
}

function fail(code, message) {
  throw new ExecutionContractError(code, message);
}

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

export function hashCanonical(value) {
  return createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
}

export function assertReadOnlyProjectManagerPlan(plan, ownerIntent) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) fail('PLAN_INVALID', 'Projectmanager plan is missing.');
  if (plan.schemaVersion !== '1.0.0' || !PLAN_ID.test(plan.planId ?? '')) fail('PLAN_INVALID', 'Projectmanager plan identity is invalid.');
  if (plan.audit?.sourceTaskId !== 'NN-115' || plan.audit?.sourceReadbackVerified !== true || plan.audit?.secretsIncluded !== false) {
    fail('PLAN_AUTHORITY_INVALID', 'Projectmanager plan lacks live NN-115 authority evidence.');
  }
  const next = plan.nextAction;
  if (
    !next
    || next.taskId !== 'NN-115'
    || next.eligible !== true
    || next.terminal !== false
    || !['Goedgekeurd', 'In uitvoering'].includes(next.status)
  ) {
    fail('PLAN_NOT_ELIGIBLE', 'Projectmanager plan has no eligible NN-115 action.');
  }
  if (next.title !== ownerIntent) fail('PLAN_INTENT_MISMATCH', 'Projectmanager plan is not bound to the owner intent.');
  if (next.blockers?.length !== 0 || next.action?.kind !== 'read-only') {
    fail('PLAN_NOT_READ_ONLY', 'Projectmanager plan is blocked or not read-only.');
  }
  if (next.action?.estimatedCostEur !== 0) fail('PLAN_COST_BLOCKED', 'Projectmanager plan is not proven at zero new cost.');
  if (next.action?.idempotencyKey !== 'NN-115:etsy-intelligence:daily:v2') {
    fail('PLAN_IDEMPOTENCY_INVALID', 'Projectmanager plan idempotency contract is invalid.');
  }
  return plan;
}

export function buildExecutionSeed({ plan, ownerIntent, idempotencyKey, now = new Date() }) {
  if (typeof ownerIntent !== 'string' || ownerIntent.length < 20 || ownerIntent.length > 2_000) {
    fail('OWNER_INTENT_INVALID', 'Owner intent is missing or too large.');
  }
  if (!IDEMPOTENCY_KEY.test(idempotencyKey ?? '')) fail('IDEMPOTENCY_KEY_INVALID', 'Idempotency key is invalid.');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('CLOCK_INVALID', 'Execution clock is invalid.');
  assertReadOnlyProjectManagerPlan(plan, ownerIntent);
  const timestamp = now.toISOString();
  const executionId = `nn115-exec-${hashCanonical(idempotencyKey).slice(0, 32)}`;
  return validateDurableExecution({
    schemaVersion: '1.0.0',
    executionId,
    taskId: 'NN-115',
    ownerIntentHash: hashCanonical(ownerIntent),
    planId: plan.planId,
    planContentHash: hashCanonical(plan),
    state: 'QUEUED',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastHeartbeatAt: null,
    step: 'queued',
    currentComponent: 'projectmanager-runtime',
    attempt: 0,
    idempotencyKey,
    approvalState: 'NOT_REQUIRED_READ_ONLY',
    costState: 'ZERO_NEW_RECURRING_COMMITMENT',
    blockingReason: null,
    resultId: null,
    resultHash: null,
    providerReadbackState: 'PENDING',
    retryEligible: false,
    lastErrorClass: null,
    nextEligibleRun: null,
    leaseOwner: null,
    fencingToken: 0,
    leaseExpiresAt: null,
  });
}
