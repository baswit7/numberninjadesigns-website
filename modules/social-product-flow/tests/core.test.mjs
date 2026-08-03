import test from "node:test";
import assert from "node:assert/strict";
import {
  FlowError,
  approvalIsCurrent,
  assertNoSecrets,
  classifyPublicationFailure,
  createApproval,
  createIdempotencyKey,
  fingerprintApproval,
  isSafeHttpsUrl,
  transitionState
} from "../lib/index.mjs";

const approvalInput = {
  revision: 1,
  video: { fileName: "master.mp4", sha256: "A".repeat(64) },
  cover: { instagram: { headline: "BUDGET PLANNER" } },
  text: { instagram: { caption: "A clear Excel workflow." } },
  link: null,
  platforms: ["instagram"],
  audience: "budget-conscious individuals"
};

test("approval fingerprint is deterministic and any governed change invalidates it", () => {
  const now = new Date("2026-07-28T10:00:00.000Z");
  const approval = createApproval(approvalInput, "Owner", now);

  assert.equal(approval.fingerprint, fingerprintApproval(approvalInput));
  assert.equal(approvalIsCurrent(approval, structuredClone(approvalInput)), true);
  assert.equal(
    approvalIsCurrent(approval, {
      ...structuredClone(approvalInput),
      link: "https://example.etsy.com/verified"
    }),
    false
  );
});

test("state machine allows only declared transitions", () => {
  const entity = { state: "DRAFT", updatedAt: null, history: [] };
  const rendering = transitionState(entity, "RENDERING", {
    now: new Date("2026-07-28T10:00:00.000Z")
  });
  assert.equal(rendering.state, "RENDERING");
  assert.equal(entity.state, "DRAFT");

  assert.throws(
    () => transitionState(entity, "PUBLISHED"),
    (error) => error instanceof FlowError && error.code === "TRANSITION_INVALID"
  );
});

test("retry policy honors Retry-After and reconciles ambiguous writes", () => {
  const now = new Date("2026-07-28T10:00:00.000Z");
  const limited = classifyPublicationFailure(
    { status: 429, headers: { "retry-after": "5" } },
    { attempt: 1, now, random: () => 0 }
  );
  assert.equal(limited.action, "RETRY");
  assert.equal(limited.delayMs, 5_000);
  assert.equal(limited.retryAt, "2026-07-28T10:00:05.000Z");

  const ambiguous = classifyPublicationFailure(
    { status: 503 },
    { attempt: 2, now, random: () => 0.5 }
  );
  assert.equal(ambiguous.action, "RECONCILE_THEN_RETRY");
  assert.equal(ambiguous.requiresReconcile, true);

  const auth = classifyPublicationFailure({ status: 403 }, { attempt: 1, now });
  assert.equal(auth.state, "BLOCKED");
  assert.equal(auth.retryable, false);
});

test("idempotency keys are stable and campaign persistence rejects secret fields", () => {
  const left = createIdempotencyKey(["product", "1.0.0", 1, "instagram"]);
  const right = createIdempotencyKey(["product", "1.0.0", 1, "instagram"]);
  assert.equal(left, right);
  assert.match(left, /^nnd-[a-f0-9]{40}$/);

  assert.throws(
    () => assertNoSecrets({ nested: { access_token: "must-not-persist" } }),
    (error) => error instanceof FlowError && error.code === "SECRET_FIELD_FORBIDDEN"
  );
  assert.throws(
    () => assertNoSecrets({ token: "must-not-persist" }),
    (error) => error instanceof FlowError && error.code === "SECRET_FIELD_FORBIDDEN"
  );
});

test("external evidence links accept only credential-free HTTPS URLs", () => {
  assert.equal(isSafeHttpsUrl("https://numberninjadesigns.etsy.com/listing/verified"), true);
  assert.equal(isSafeHttpsUrl("http://numberninjadesigns.etsy.com/listing/verified"), false);
  assert.equal(isSafeHttpsUrl("https://owner:password@example.com/post"), false);
  assert.equal(isSafeHttpsUrl("javascript:alert(1)"), false);
  assert.equal(isSafeHttpsUrl("https://example.com/post\njavascript:alert(1)"), false);
});
