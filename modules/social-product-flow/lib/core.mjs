import { createHash, timingSafeEqual } from "node:crypto";

export const SCHEMA_VERSION = "1.0.0";

export const EXECUTION_MODES = Object.freeze({
  DRY_RUN: "DRY_RUN",
  LIVE: "LIVE"
});

export const ADAPTER_MODES = Object.freeze({
  AUTOMATIC: "AUTOMATIC",
  ASSISTED: "ASSISTED",
  BLOCKED: "BLOCKED",
  DISABLED: "DISABLED"
});

export const CAMPAIGN_STATES = Object.freeze([
  "DRAFT",
  "RENDERING",
  "RENDERED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "QUEUED",
  "PUBLISHING",
  "PUBLISHED",
  "NEEDS_LINK",
  "BLOCKED",
  "ASSISTED_READY",
  "RETRY_PENDING",
  "FAILED_FINAL",
  "METRICS_PENDING",
  "COMPLETE"
]);

const TRANSITIONS = Object.freeze({
  DRAFT: ["RENDERING", "BLOCKED", "FAILED_FINAL"],
  RENDERING: ["RENDERED", "RETRY_PENDING", "BLOCKED", "FAILED_FINAL"],
  RENDERED: ["AWAITING_APPROVAL", "BLOCKED"],
  AWAITING_APPROVAL: ["APPROVED", "DRAFT", "BLOCKED", "FAILED_FINAL"],
  APPROVED: ["QUEUED", "AWAITING_APPROVAL", "ASSISTED_READY", "NEEDS_LINK", "BLOCKED"],
  QUEUED: ["PUBLISHING", "ASSISTED_READY", "BLOCKED"],
  PUBLISHING: [
    "PUBLISHED",
    "NEEDS_LINK",
    "RETRY_PENDING",
    "FAILED_FINAL",
    "BLOCKED"
  ],
  PUBLISHED: ["METRICS_PENDING", "NEEDS_LINK", "COMPLETE"],
  NEEDS_LINK: ["AWAITING_APPROVAL", "PUBLISHED", "BLOCKED"],
  BLOCKED: ["DRAFT", "AWAITING_APPROVAL", "FAILED_FINAL"],
  ASSISTED_READY: ["PUBLISHED", "NEEDS_LINK", "COMPLETE", "AWAITING_APPROVAL", "BLOCKED"],
  RETRY_PENDING: ["PUBLISHING", "BLOCKED", "FAILED_FINAL"],
  FAILED_FINAL: ["DRAFT", "BLOCKED"],
  METRICS_PENDING: ["COMPLETE", "RETRY_PENDING", "FAILED_FINAL"],
  COMPLETE: ["AWAITING_APPROVAL"]
});

const APPROVAL_FIELDS = Object.freeze([
  "revision",
  "video",
  "cover",
  "text",
  "link",
  "platforms",
  "audience"
]);

const SECRET_KEY_PATTERN =
  /(^|[_-])(api[_-]?key|access[_-]?token|refresh[_-]?token|token|jwt|session|client[_-]?secret|password|authorization|cookie|credential|secret)s?($|[_-])/i;

export class FlowError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "FlowError";
    this.code = code;
    this.details = details;
  }
}

export function assert(condition, code, message, details = {}) {
  if (!condition) {
    throw new FlowError(code, message, details);
  }
}

export function stableStringify(value) {
  return JSON.stringify(sortForSerialization(value));
}

function sortForSerialization(value) {
  if (Array.isArray(value)) {
    return value.map(sortForSerialization);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortForSerialization(entry)])
    );
  }

  return value;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

export function createApprovalSnapshot(input) {
  assert(input && typeof input === "object", "APPROVAL_INPUT_INVALID", "Approval input is required.");

  const missing = APPROVAL_FIELDS.filter((field) => !(field in input));
  assert(
    missing.length === 0,
    "APPROVAL_FIELDS_MISSING",
    `Approval input is missing: ${missing.join(", ")}.`,
    { missing }
  );

  const snapshot = Object.fromEntries(
    APPROVAL_FIELDS.map((field) => [field, structuredClone(input[field])])
  );

  assert(
    Number.isInteger(snapshot.revision) && snapshot.revision > 0,
    "REVISION_INVALID",
    "Approval revision must be a positive integer."
  );
  assert(
    Array.isArray(snapshot.platforms) && snapshot.platforms.length > 0,
    "PLATFORMS_INVALID",
    "At least one platform must be present in the approval snapshot."
  );

  snapshot.platforms = [...new Set(snapshot.platforms)].sort();
  return snapshot;
}

export function fingerprintApproval(input) {
  return sha256(stableStringify(createApprovalSnapshot(input)));
}

export function createApproval(input, approvedBy, now = new Date()) {
  assert(
    typeof approvedBy === "string" && approvedBy.trim().length >= 2,
    "APPROVER_INVALID",
    "An identifiable approver is required."
  );

  const snapshot = createApprovalSnapshot(input);
  return {
    schemaVersion: SCHEMA_VERSION,
    fingerprint: fingerprintApproval(snapshot),
    approvedBy: approvedBy.trim(),
    approvedAt: now.toISOString(),
    snapshot
  };
}

export function approvalIsCurrent(approval, input) {
  if (!approval?.fingerprint) {
    return false;
  }

  const expected = Buffer.from(fingerprintApproval(input), "utf8");
  const actual = Buffer.from(String(approval.fingerprint), "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function transitionState(entity, targetState, context = {}) {
  assert(entity && typeof entity === "object", "ENTITY_INVALID", "State entity is required.");
  assert(
    CAMPAIGN_STATES.includes(entity.state),
    "STATE_INVALID",
    `Unknown current state: ${entity.state}.`
  );
  assert(
    CAMPAIGN_STATES.includes(targetState),
    "TARGET_STATE_INVALID",
    `Unknown target state: ${targetState}.`
  );
  assert(
    TRANSITIONS[entity.state].includes(targetState),
    "TRANSITION_INVALID",
    `Transition ${entity.state} -> ${targetState} is not allowed.`,
    { currentState: entity.state, targetState }
  );

  const now = context.now instanceof Date ? context.now : new Date();
  const next = structuredClone(entity);
  next.state = targetState;
  next.updatedAt = now.toISOString();
  next.history = Array.isArray(next.history) ? next.history : [];
  next.history.push({
    from: entity.state,
    to: targetState,
    at: next.updatedAt,
    reason: context.reason ?? null,
    actor: context.actor ?? "system"
  });
  return next;
}

export function assertNoSecrets(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSecrets(entry, `${path}[${index}]`));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    assert(
      !SECRET_KEY_PATTERN.test(key),
      "SECRET_FIELD_FORBIDDEN",
      `Secret-like field is forbidden in persisted flow data: ${path}.${key}.`
    );
    assertNoSecrets(entry, `${path}.${key}`);
  }
}

export function isSafeHttpsUrl(value) {
  if (typeof value !== "string" || value !== value.trim() || /\s/.test(value)) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      Boolean(parsed.hostname) &&
      parsed.username === "" &&
      parsed.password === ""
    );
  } catch {
    return false;
  }
}

function retryAfterMilliseconds(value, now) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }

  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now.getTime()) : null;
}

export function classifyPublicationFailure(error, options = {}) {
  const attempt = Number.isInteger(options.attempt) ? options.attempt : 1;
  const maxAttempts = Number.isInteger(options.maxAttempts) ? options.maxAttempts : 5;
  const maxDelayMs = Number.isFinite(options.maxDelayMs) ? options.maxDelayMs : 900_000;
  const now = options.now instanceof Date ? options.now : new Date();
  const random = typeof options.random === "function" ? options.random : Math.random;
  const status = Number(error?.status ?? error?.statusCode ?? 0);
  const code = String(error?.code ?? "");
  const timeout = /TIMEOUT|ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(code);
  const ambiguousWrite = timeout || status === 409 || status >= 500;

  if ([400, 404, 422].includes(status)) {
    return {
      action: "FAIL_FINAL",
      state: "FAILED_FINAL",
      retryable: false,
      reason: `Provider rejected the request with HTTP ${status}.`
    };
  }

  if ([401, 403].includes(status)) {
    return {
      action: "BLOCK",
      state: "BLOCKED",
      retryable: false,
      reason: `Provider authorization or policy rejected the request with HTTP ${status}.`
    };
  }

  if (attempt >= maxAttempts) {
    return {
      action: "FAIL_FINAL",
      state: "FAILED_FINAL",
      retryable: false,
      requiresReconcile: ambiguousWrite,
      reason: `Retry budget exhausted after ${attempt} attempts.`
    };
  }

  if (status === 429 || ambiguousWrite) {
    const headerValue =
      error?.retryAfter ??
      error?.headers?.["retry-after"] ??
      error?.headers?.get?.("retry-after");
    const headerDelay = retryAfterMilliseconds(headerValue, now);
    const exponential = Math.min(maxDelayMs, 1_000 * 2 ** Math.max(0, attempt - 1));
    const jittered = Math.round(exponential * (0.75 + random() * 0.5));
    const delayMs = Math.min(maxDelayMs, headerDelay ?? jittered);

    return {
      action: ambiguousWrite ? "RECONCILE_THEN_RETRY" : "RETRY",
      state: "RETRY_PENDING",
      retryable: true,
      requiresReconcile: ambiguousWrite,
      delayMs,
      retryAt: new Date(now.getTime() + delayMs).toISOString(),
      reason:
        status === 429
          ? "Provider rate limit reached."
          : "Write outcome is ambiguous; reconcile before retrying."
    };
  }

  return {
    action: "FAIL_FINAL",
    state: "FAILED_FINAL",
    retryable: false,
    reason: "Unclassified publication failure requires operator review."
  };
}

export function createIdempotencyKey(parts) {
  assert(Array.isArray(parts) && parts.length >= 2, "IDEMPOTENCY_INPUT_INVALID", "At least two key parts are required.");
  return `nnd-${sha256(stableStringify(parts)).slice(0, 40).toLowerCase()}`;
}
