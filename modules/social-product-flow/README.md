# NumberNinjaDesigns Social Product Flow

Dependency-free Node.js 24 control plane for preparing, approving, publishing, and
measuring product campaigns without overstating provider readiness.

The default mode is `DRY_RUN`. The shipped adapters make no network calls. An
automatic adapter is usable only after all six contract methods are implemented,
the platform capability is explicitly promoted to `AUTOMATIC`, Studio OS enables
both the execution plane and provider calls, and the orchestrator is created in
`LIVE` mode.

## Flow

`DRAFT → RENDERING → RENDERED → AWAITING_APPROVAL → APPROVED`

After approval, each product/platform record becomes `QUEUED`,
`ASSISTED_READY`, `NEEDS_LINK`, or `BLOCKED` according to proven capability.
Automatic publication adds `PUBLISHING → PUBLISHED → METRICS_PENDING → COMPLETE`.

Any change to revision, video, cover, text, link, selected platforms, or audience
changes the SHA-256 approval fingerprint and invalidates approval.

## Dry-run the verified Budget Planner

From this module:

```powershell
npm test
npm run dry-run:budget
```

Write a full local handoff document only when needed:

```powershell
node scripts/dry-run.mjs `
  --product ../finance-product-factory/products/budget-planner-basic.json `
  --release-evidence ../../release-candidates/finance-launch-2026-07-24/budget-planner/social/social-release-evidence.json `
  --out C:\temp\nnd-budget-social-dry-run.json
```

`--release-evidence` verifies the declared social master, instruction master,
captions, voice-over, and round-trip transcript against their SHA-256 values and
rejects paths outside the repository. It never records human approval automatically.

Add `--share-link` only with the exact HTTPS Share & Save URL copied from Etsy.
The flow never generates or substitutes that URL.

Open `approval-console.html` by double-click, import the generated JSON, select the
matching local video for preview, inspect all content, and export an approval
decision. The console stores no credential and makes no network call.

An explicit user confirmation can instead be applied from release evidence that
binds the statement to both final artifact hashes:

```powershell
node scripts/apply-approval.mjs `
  --input ../../work/social-product-flow/budget-planner-release-candidate.json `
  --release-evidence ../../release-candidates/finance-launch-2026-07-24/budget-planner/social/social-release-evidence.json `
  --decision-out ../../work/social-product-flow/budget-planner-approval-decision.json `
  --out ../../work/social-product-flow/budget-planner-approved-campaign.json
```

This command only creates local assisted handoffs. It rejects non-`DRY_RUN`
input, requires zero provider calls, and never publishes externally.

## Adapter contract

Every automatic bridge must implement:

- `getCapabilities()`
- `validate(context)`
- `prepare(context)`
- `publish(context)`
- `reconcile(context)`
- `fetchMetrics(context)`

`publish` must use the supplied idempotency key. Timeouts, connection resets, HTTP
409, and server errors are reconciled before a retry. HTTP 400/401/403 and policy
errors are never retried blindly. HTTP 429 honors `Retry-After` with bounded
backoff.

## Video truth boundary

- Social master: 1080×1920, 9:16, H.264, `yuv420p`, exactly 30 fps,
  15 seconds ±0.1, optional AAC.
- Etsy silent master: 1920×960, exact 2:1, H.264, `yuv420p`, 30 fps,
  3–15 seconds, no audio.
- Instruction video: 1920×1080, H.264, `yuv420p`, 30 fps, AAC.

Set `NND_FFPROBE` to a trusted local `ffprobe` executable for file validation.
Technical validation never replaces the binding 100% human visual inspection.
Instruction packages remain `ASSISTED_RECORDING_READY` until a real recording of
the verified product, technical validation, and human approval are all proven;
after that they become `APPROVED`.

## Security and recovery

- No token, credential, or API key is accepted in persisted campaign data.
- State writes are lock-protected, optimistic-revision checked, and atomically
  renamed.
- Audit records contain only campaign IDs, revisions, events, actors, and times.
- No paid product file is attached to a social or YouTube publication package.
- `DRY_RUN` and disabled execution governance are independent hard stops.
