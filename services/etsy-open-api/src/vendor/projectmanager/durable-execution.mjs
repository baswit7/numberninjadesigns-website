const HASH = /^[a-f0-9]{64}$/u;
const EXECUTION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/u;
const TASK_ID = /^[A-Z0-9][A-Z0-9._-]{2,159}$/u;
const COMPONENT = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const SENSITIVE_TEXT = /(?:authorization|bearer|password|secret|token|api[ _-]?key)\s*[:=]?/iu;

export const DURABLE_EXECUTION_STATES = Object.freeze([
  'PLANNED',
  'QUEUED',
  'RUNNING',
  'AWAITING_APPROVAL',
  'BLOCKED_EXTERNAL',
  'BLOCKED_INTERNAL',
  'RETRY_ELIGIBLE',
  'COMPLETED',
  'FAILED_TERMINAL',
]);

const REQUIRED_FIELDS = Object.freeze([
  'schemaVersion',
  'executionId',
  'taskId',
  'ownerIntentHash',
  'planId',
  'planContentHash',
  'state',
  'createdAt',
  'updatedAt',
  'lastHeartbeatAt',
  'step',
  'currentComponent',
  'attempt',
  'idempotencyKey',
  'approvalState',
  'costState',
  'blockingReason',
  'resultId',
  'resultHash',
  'providerReadbackState',
  'retryEligible',
  'lastErrorClass',
  'nextEligibleRun',
  'leaseOwner',
  'fencingToken',
  'leaseExpiresAt',
]);

const APPROVAL_STATES = Object.freeze([
  'NOT_REQUIRED_READ_ONLY',
  'PENDING',
  'GRANTED',
  'DENIED',
]);

const COST_STATES = Object.freeze([
  'ZERO_NEW_RECURRING_COMMITMENT',
  'UNKNOWN',
  'BLOCKED',
]);

const PROVIDER_READBACK_STATES = Object.freeze([
  'PENDING',
  'NOT_CALLED',
  'FRESH',
  'REFRESHED',
  'FAILED',
]);

export class DurableExecutionContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DurableExecutionContractError';
    this.code = 'EXECUTION_CONTRACT_INVALID';
  }
}

function fail(message) {
  throw new DurableExecutionContractError(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactFields(value) {
  if (!isObject(value)) fail('Durable execution must be an object.');
  const keys = Object.keys(value).sort();
  const expected = [...REQUIRED_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    fail('Durable execution contains missing or unknown fields.');
  }
}

function text(value, field, { pattern, maximum = 500 } = {}) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum) {
    fail(`${field} must be a bounded non-empty string.`);
  }
  if (pattern && !pattern.test(value)) fail(`${field} has an invalid format.`);
  return value;
}

function nullableText(value, field, maximum = 2_000) {
  if (value === null) return null;
  return text(value, field, { maximum });
}

function timestamp(value, field, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  text(value, field, { maximum: 64 });
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    fail(`${field} must be a canonical RFC 3339 timestamp.`);
  }
  return value;
}

function oneOf(value, field, allowed) {
  if (!allowed.includes(value)) fail(`${field} is outside the closed contract.`);
  return value;
}

function sanitizeOperationalText(value) {
  if (value === null) return null;
  if (SENSITIVE_TEXT.test(value)) return 'Sensitive detail removed.';
  return value.replace(/\s+/gu, ' ').trim().slice(0, 500);
}

export function validateDurableExecution(value) {
  exactFields(value);
  if (value.schemaVersion !== '1.0.0') fail('schemaVersion is unsupported.');
  text(value.executionId, 'executionId', { pattern: EXECUTION_ID, maximum: 160 });
  text(value.taskId, 'taskId', { pattern: TASK_ID, maximum: 160 });
  text(value.ownerIntentHash, 'ownerIntentHash', { pattern: HASH, maximum: 64 });
  text(value.planId, 'planId', { pattern: EXECUTION_ID, maximum: 160 });
  text(value.planContentHash, 'planContentHash', { pattern: HASH, maximum: 64 });
  oneOf(value.state, 'state', DURABLE_EXECUTION_STATES);
  timestamp(value.createdAt, 'createdAt');
  timestamp(value.updatedAt, 'updatedAt');
  timestamp(value.lastHeartbeatAt, 'lastHeartbeatAt', { nullable: true });
  text(value.step, 'step', { pattern: COMPONENT, maximum: 120 });
  text(value.currentComponent, 'currentComponent', { pattern: COMPONENT, maximum: 160 });
  if (!Number.isSafeInteger(value.attempt) || value.attempt < 0 || value.attempt > 100) {
    fail('attempt must be an integer between 0 and 100.');
  }
  text(value.idempotencyKey, 'idempotencyKey', { pattern: EXECUTION_ID, maximum: 160 });
  oneOf(value.approvalState, 'approvalState', APPROVAL_STATES);
  oneOf(value.costState, 'costState', COST_STATES);
  nullableText(value.blockingReason, 'blockingReason');
  nullableText(value.resultId, 'resultId', 160);
  if (value.resultHash !== null) text(value.resultHash, 'resultHash', { pattern: HASH, maximum: 64 });
  oneOf(value.providerReadbackState, 'providerReadbackState', PROVIDER_READBACK_STATES);
  if (typeof value.retryEligible !== 'boolean') fail('retryEligible must be boolean.');
  if (value.lastErrorClass !== null) {
    text(value.lastErrorClass, 'lastErrorClass', { pattern: /^[A-Z0-9_]{3,160}$/u, maximum: 160 });
  }
  timestamp(value.nextEligibleRun, 'nextEligibleRun', { nullable: true });
  nullableText(value.leaseOwner, 'leaseOwner', 160);
  if (!Number.isSafeInteger(value.fencingToken) || value.fencingToken < 0) {
    fail('fencingToken must be a non-negative integer.');
  }
  timestamp(value.leaseExpiresAt, 'leaseExpiresAt', { nullable: true });

  if ((value.resultId === null) !== (value.resultHash === null)) {
    fail('resultId and resultHash must both be null or both be present.');
  }
  if (Date.parse(value.updatedAt) < Date.parse(value.createdAt)) {
    fail('updatedAt cannot precede createdAt.');
  }
  if (value.lastHeartbeatAt !== null && Date.parse(value.lastHeartbeatAt) < Date.parse(value.createdAt)) {
    fail('lastHeartbeatAt cannot precede createdAt.');
  }
  if ((value.leaseOwner === null) !== (value.leaseExpiresAt === null)) {
    fail('leaseOwner and leaseExpiresAt must both be null or both be present.');
  }
  return Object.freeze(structuredClone(value));
}

export function projectDurableExecution(value) {
  const execution = validateDurableExecution(value);
  return Object.freeze({
    schemaVersion: execution.schemaVersion,
    executionId: execution.executionId,
    taskId: execution.taskId,
    planId: execution.planId,
    state: execution.state,
    createdAt: execution.createdAt,
    updatedAt: execution.updatedAt,
    lastHeartbeatAt: execution.lastHeartbeatAt,
    step: execution.step,
    currentComponent: execution.currentComponent,
    attempt: execution.attempt,
    idempotencyKey: execution.idempotencyKey,
    approvalState: execution.approvalState,
    costState: execution.costState,
    blockingReason: sanitizeOperationalText(execution.blockingReason),
    resultId: execution.resultId,
    providerReadbackState: execution.providerReadbackState,
    retryEligible: execution.retryEligible,
    lastErrorClass: execution.lastErrorClass,
    nextEligibleRun: execution.nextEligibleRun,
  });
}
