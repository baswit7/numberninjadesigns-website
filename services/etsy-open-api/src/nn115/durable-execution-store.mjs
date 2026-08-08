import { hashCanonical } from './execution-contract.mjs';
import {
  DurableStoreError,
  createRedisRestClient,
} from './redis-rest-client.mjs';
import { validateDurableExecution } from '../vendor/projectmanager/durable-execution.mjs';

export { DurableStoreError } from './redis-rest-client.mjs';

const PREFIX = /^[a-z0-9][a-z0-9:_-]{2,63}$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/u;
const CHECKPOINT = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const TERMINAL_STATES = new Set(['COMPLETED', 'FAILED_TERMINAL']);
const SECRET_KEY = /(?:authorization|bearer|credential|password|secret|token|api[ _-]?key)/iu;
const SECRET_VALUE = /(?:bearer\s+[a-z0-9._~+/-]{12,}|(?:password|secret|token)\s*[:=])/iu;
const SAFE_CONTRACT_KEYS = new Set(['fencingToken']);

const CREATE_EXECUTION = `-- nn115:create-execution
local known = redis.call('GET', KEYS[1])
if known then
  local current = redis.call('GET', KEYS[2])
  return {'existing', current}
end
local current = redis.call('GET', KEYS[2])
if current then
  redis.call('SET', KEYS[1], ARGV[2])
  redis.call('SET', KEYS[3], ARGV[2])
  return {'existing', current}
end
redis.call('SET', KEYS[2], ARGV[1])
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[3], ARGV[2])
return {'created', ARGV[1]}`;

const CLAIM_EXECUTION = `-- nn115:claim-execution
local raw = redis.call('GET', KEYS[1])
if not raw then return {'missing'} end
local record = cjson.decode(raw)
if record.state == 'COMPLETED' or record.state == 'FAILED_TERMINAL' then return {'terminal', raw} end
if record.nextEligibleRun ~= cjson.null and record.nextEligibleRun > ARGV[1] then
  return {'not-eligible', raw}
end
if record.leaseOwner ~= cjson.null and record.leaseExpiresAt ~= cjson.null and record.leaseExpiresAt > ARGV[1] then
  return {'lease-held', raw}
end
record.state = 'RUNNING'
record.updatedAt = ARGV[1]
record.lastHeartbeatAt = ARGV[1]
record.step = 'claimed'
record.currentComponent = 'projectmanager-runtime'
record.attempt = record.attempt + 1
record.retryEligible = false
record.leaseOwner = ARGV[2]
record.fencingToken = record.fencingToken + 1
record.leaseExpiresAt = ARGV[3]
local updated = cjson.encode(record)
redis.call('SET', KEYS[1], updated)
return {'claimed', updated}`;

const UPDATE_EXECUTION = `-- nn115:update-execution
local raw = redis.call('GET', KEYS[1])
if not raw then return {'missing'} end
local record = cjson.decode(raw)
if record.leaseOwner ~= ARGV[1] or tonumber(record.fencingToken) ~= tonumber(ARGV[2]) or record.leaseExpiresAt <= ARGV[4] then
  return {'fence-rejected', raw}
end
redis.call('SET', KEYS[1], ARGV[3])
return {'updated', ARGV[3]}`;

const WRITE_CHECKPOINT = `-- nn115:write-checkpoint
local raw = redis.call('GET', KEYS[1])
if not raw then return {'missing'} end
local record = cjson.decode(raw)
if record.leaseOwner ~= ARGV[1] or tonumber(record.fencingToken) ~= tonumber(ARGV[2]) or record.leaseExpiresAt <= ARGV[5] then
  return {'fence-rejected'}
end
redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[4])
return {'stored'}`;

const COMPLETE_EXECUTION = `-- nn115:complete-execution
local raw = redis.call('GET', KEYS[1])
if not raw then return {'missing'} end
local record = cjson.decode(raw)
if record.leaseOwner ~= ARGV[1] or tonumber(record.fencingToken) ~= tonumber(ARGV[2]) or record.leaseExpiresAt <= ARGV[5] then
  return {'fence-rejected', raw}
end
redis.call('SET', KEYS[2], ARGV[4])
redis.call('SET', KEYS[1], ARGV[3])
return {'completed', ARGV[3]}`;

const PUBLISH_SNAPSHOT = `-- nn115:publish-snapshot
local current = redis.call('GET', KEYS[1])
if current then
  local existing = cjson.decode(current)
  local candidate = cjson.decode(ARGV[1])
  if existing.snapshotHash == candidate.snapshotHash then return {'existing', current} end
  return {'conflict', current}
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
redis.call('SET', KEYS[2], KEYS[1])
return {'created', ARGV[1]}`;

function fail(code, message, statusCode = 409) {
  throw new DurableStoreError(code, message, statusCode);
}

function parseJson(raw, code = 'DURABLE_STATE_CORRUPT') {
  if (typeof raw !== 'string') fail(code, 'Durable state is missing or corrupt.', 500);
  try {
    return JSON.parse(raw);
  } catch {
    fail(code, 'Durable state is missing or corrupt.', 500);
  }
}

function assertIdentifier(value, label) {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) fail('DURABLE_KEY_INVALID', `${label} is invalid.`, 400);
  return value;
}

function assertSecretFree(value, path = 'result') {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    if (value.length > 50_000 || SECRET_VALUE.test(value)) fail('SECRET_SHAPED_RESULT', `${path} is not safe to persist.`, 400);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 5_000) fail('RESULT_TOO_LARGE', `${path} is too large.`, 400);
    value.forEach((entry, index) => assertSecretFree(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') fail('RESULT_INVALID', `${path} is invalid.`, 400);
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'secretValuesReported' && entry === false) continue;
    if (!SAFE_CONTRACT_KEYS.has(key) && SECRET_KEY.test(key)) fail('SECRET_SHAPED_RESULT', `${path} contains a forbidden key.`, 400);
    assertSecretFree(entry, `${path}.${key}`);
  }
}

function serialized(value, maximumBytes = 900_000) {
  assertSecretFree(value);
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json, 'utf8') > maximumBytes) fail('RESULT_TOO_LARGE', 'Durable payload exceeds the bounded size.', 413);
  return json;
}

export class DurableExecutionStore {
  constructor({
    client,
    prefix = 'nn115:v1',
    clock = Date.now,
    leaseMs = 300_000,
    checkpointTtlSeconds = 45 * 24 * 60 * 60,
    snapshotTtlSeconds = 400 * 24 * 60 * 60,
  } = {}) {
    if (!client || typeof client.command !== 'function' || typeof client.eval !== 'function') fail('DURABLE_STORE_CONFIG_INVALID', 'Atomic Redis client is required.', 500);
    if (!PREFIX.test(prefix)) fail('DURABLE_STORE_CONFIG_INVALID', 'Redis key prefix is invalid.', 500);
    if (typeof clock !== 'function' || !Number.isSafeInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 300_000) {
      fail('DURABLE_STORE_CONFIG_INVALID', 'Lease configuration is invalid.', 500);
    }
    this.client = client;
    this.prefix = prefix;
    this.clock = clock;
    this.leaseMs = leaseMs;
    this.checkpointTtlSeconds = checkpointTtlSeconds;
    this.snapshotTtlSeconds = snapshotTtlSeconds;
  }

  executionKey(executionId) {
    return `${this.prefix}:execution:${assertIdentifier(executionId, 'executionId')}`;
  }

  identityKey(idempotencyKey) {
    return `${this.prefix}:identity:${hashCanonical(assertIdentifier(idempotencyKey, 'idempotencyKey'))}`;
  }

  checkpointKey(executionId, name) {
    if (typeof name !== 'string' || !CHECKPOINT.test(name)) fail('CHECKPOINT_INVALID', 'Checkpoint name is invalid.', 400);
    return `${this.prefix}:checkpoint:${assertIdentifier(executionId, 'executionId')}:${hashCanonical(name).slice(0, 32)}`;
  }

  async createExecution(seed) {
    const candidate = validateDurableExecution(seed);
    const reply = await this.client.eval(CREATE_EXECUTION, [
      this.identityKey(candidate.idempotencyKey),
      this.executionKey(candidate.executionId),
      `${this.prefix}:latest-execution`,
    ], [serialized(candidate), candidate.executionId]);
    const status = reply?.[0];
    const execution = validateDurableExecution(parseJson(reply?.[1]));
    if (
      execution.idempotencyKey !== candidate.idempotencyKey
      || execution.ownerIntentHash !== candidate.ownerIntentHash
      || execution.planContentHash !== candidate.planContentHash
      || execution.planId !== candidate.planId
    ) {
      fail('IDEMPOTENCY_CONFLICT', 'Execution identity already exists with different content.');
    }
    return Object.freeze({ created: status === 'created', execution });
  }

  async readExecution(executionId) {
    const raw = await this.client.command('GET', this.executionKey(executionId));
    return raw === null ? null : validateDurableExecution(parseJson(raw));
  }

  async readLatestExecution() {
    const executionId = await this.client.command('GET', `${this.prefix}:latest-execution`);
    return executionId ? this.readExecution(executionId) : null;
  }

  async claimExecution(executionId, ownerId) {
    assertIdentifier(ownerId, 'ownerId');
    const now = new Date(this.clock());
    const leaseExpiresAt = new Date(now.getTime() + this.leaseMs).toISOString();
    const reply = await this.client.eval(CLAIM_EXECUTION, [this.executionKey(executionId)], [
      now.toISOString(),
      ownerId,
      leaseExpiresAt,
    ]);
    const status = reply?.[0];
    if (status === 'missing') fail('EXECUTION_NOT_FOUND', 'Execution does not exist.', 404);
    const execution = validateDurableExecution(parseJson(reply?.[1]));
    if (status === 'lease-held') return Object.freeze({ claimed: false, reason: 'LEASE_HELD', execution });
    if (status === 'not-eligible') return Object.freeze({ claimed: false, reason: 'NOT_ELIGIBLE', execution });
    if (status === 'terminal') return Object.freeze({ claimed: false, reason: 'TERMINAL', execution });
    if (status !== 'claimed') fail('DURABLE_STATE_CORRUPT', 'Unexpected claim result.', 500);
    return Object.freeze({
      claimed: true,
      execution,
      claim: Object.freeze({ ownerId, fencingToken: execution.fencingToken }),
    });
  }

  async updateExecution(executionId, claim, patch = {}) {
    const current = await this.readExecution(executionId);
    if (!current) fail('EXECUTION_NOT_FOUND', 'Execution does not exist.', 404);
    if (TERMINAL_STATES.has(current.state)) fail('EXECUTION_TERMINAL', 'Execution is already terminal.');
    const allowed = new Set(['state', 'step', 'currentComponent', 'providerReadbackState', 'retryEligible', 'blockingReason', 'lastErrorClass', 'nextEligibleRun']);
    if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !allowed.has(key))) {
      fail('EXECUTION_PATCH_INVALID', 'Execution patch contains unsupported fields.', 400);
    }
    const now = new Date(this.clock());
    const next = validateDurableExecution({
      ...current,
      ...patch,
      updatedAt: now.toISOString(),
      lastHeartbeatAt: now.toISOString(),
      leaseExpiresAt: new Date(now.getTime() + this.leaseMs).toISOString(),
    });
    const reply = await this.client.eval(UPDATE_EXECUTION, [this.executionKey(executionId)], [
      claim.ownerId,
      claim.fencingToken,
      serialized(next),
      now.toISOString(),
    ]);
    if (reply?.[0] === 'fence-rejected') fail('FENCE_REJECTED', 'Execution lease is stale.');
    if (reply?.[0] === 'missing') fail('EXECUTION_NOT_FOUND', 'Execution does not exist.', 404);
    return validateDurableExecution(parseJson(reply?.[1]));
  }

  async writeCheckpoint(executionId, claim, name, value) {
    const now = new Date(this.clock()).toISOString();
    const reply = await this.client.eval(WRITE_CHECKPOINT, [
      this.executionKey(executionId),
      this.checkpointKey(executionId, name),
    ], [claim.ownerId, claim.fencingToken, serialized(value), this.checkpointTtlSeconds, now]);
    if (reply?.[0] === 'fence-rejected') fail('FENCE_REJECTED', 'Execution lease is stale.');
    if (reply?.[0] === 'missing') fail('EXECUTION_NOT_FOUND', 'Execution does not exist.', 404);
    if (reply?.[0] !== 'stored') fail('DURABLE_STATE_CORRUPT', 'Checkpoint was not stored.', 500);
  }

  async readCheckpoint(executionId, name) {
    const raw = await this.client.command('GET', this.checkpointKey(executionId, name));
    return raw === null ? null : parseJson(raw, 'CHECKPOINT_CORRUPT');
  }

  async completeExecution(executionId, claim, result, { providerReadbackState = 'REFRESHED', nextEligibleRun = null } = {}) {
    assertSecretFree(result);
    if (!result || typeof result.resultId !== 'string' || !IDENTIFIER.test(result.resultId)) {
      fail('RESULT_INVALID', 'Execution resultId is invalid.', 400);
    }
    const current = await this.readExecution(executionId);
    if (!current) fail('EXECUTION_NOT_FOUND', 'Execution does not exist.', 404);
    const now = new Date(this.clock());
    const resultHash = hashCanonical(result);
    const completed = validateDurableExecution({
      ...current,
      state: 'COMPLETED',
      updatedAt: now.toISOString(),
      lastHeartbeatAt: now.toISOString(),
      step: 'completed',
      currentComponent: 'projectmanager-runtime',
      blockingReason: null,
      resultId: result.resultId,
      resultHash,
      providerReadbackState,
      retryEligible: false,
      lastErrorClass: null,
      nextEligibleRun,
      leaseOwner: null,
      leaseExpiresAt: null,
    });
    const reply = await this.client.eval(COMPLETE_EXECUTION, [
      this.executionKey(executionId),
      `${this.prefix}:result:${result.resultId}`,
    ], [claim.ownerId, claim.fencingToken, serialized(completed), serialized(result), now.toISOString()]);
    if (reply?.[0] === 'fence-rejected') fail('FENCE_REJECTED', 'Execution lease is stale.');
    if (reply?.[0] === 'missing') fail('EXECUTION_NOT_FOUND', 'Execution does not exist.', 404);
    return validateDurableExecution(parseJson(reply?.[1]));
  }

  async readResult(resultId) {
    const raw = await this.client.command('GET', `${this.prefix}:result:${assertIdentifier(resultId, 'resultId')}`);
    return raw === null ? null : parseJson(raw, 'RESULT_CORRUPT');
  }

  async publishDailySnapshot(date, snapshot) {
    if (typeof date !== 'string' || !DATE.test(date)) fail('SNAPSHOT_DATE_INVALID', 'Snapshot date is invalid.', 400);
    if (!snapshot || typeof snapshot !== 'object' || !/^[a-f0-9]{64}$/u.test(snapshot.snapshotHash ?? '')) {
      fail('SNAPSHOT_INVALID', 'Snapshot contract is invalid.', 400);
    }
    const payload = serialized(snapshot);
    const reply = await this.client.eval(PUBLISH_SNAPSHOT, [
      `${this.prefix}:snapshot:etsy:daily:${date}`,
      `${this.prefix}:latest-snapshot`,
    ], [payload, this.snapshotTtlSeconds]);
    if (reply?.[0] === 'conflict') fail('SNAPSHOT_CONFLICT', 'Canonical daily snapshot already has different content.');
    if (!['created', 'existing'].includes(reply?.[0])) fail('DURABLE_STATE_CORRUPT', 'Unexpected snapshot result.', 500);
    return Object.freeze({ created: reply[0] === 'created', snapshot: parseJson(reply[1], 'SNAPSHOT_CORRUPT') });
  }

  async readLatestSnapshot() {
    const key = await this.client.command('GET', `${this.prefix}:latest-snapshot`);
    if (!key) return null;
    const raw = await this.client.command('GET', key);
    return raw === null ? null : parseJson(raw, 'SNAPSHOT_CORRUPT');
  }

  async health() {
    const [ping, keyCount] = await Promise.all([
      this.client.command('PING'),
      this.client.command('DBSIZE'),
    ]);
    return Object.freeze({ connected: ping === 'PONG', keyCount: Number.isSafeInteger(keyCount) ? keyCount : null });
  }
}

export function createDurableExecutionStore(env = process.env, dependencies = {}) {
  const client = dependencies.client ?? createRedisRestClient(env, dependencies.redis ?? {});
  return new DurableExecutionStore({ client, ...dependencies.store });
}
