# Studio OS V2.5 Execution Preflight Gate

The Execution Preflight Gate inspects execution request packages and produces machine-readable preflight decisions.

This layer is non-executing. It consumes only `runtime/execution-request/` evidence and writes only `runtime/execution-preflight/` evidence.

## What It Can Do

- Inspect execution request packages.
- Verify dispatch is disabled.
- Verify required validators are present.
- Verify required evidence labels are present.
- Verify the requested action is not denied by the package.
- Produce preflight decisions, audit entries and a summary report.

## Preflight States

Allowed states:

- `UNKNOWN`
- `BLOCKED`
- `FAILED`
- `PASSED`
- `READY_FOR_MANUAL_REVIEW`

## Decision Rules

- `UNKNOWN` never becomes `PASSED` automatically.
- `BLOCKED` request packages remain `BLOCKED`.
- Packages with `executionDispatchAllowed != false` fail.
- Packages without required validators fail.
- Packages without required evidence fail.
- Packages whose requested action appears in denied action types fail.
- Only `READY_FOR_REVIEW` packages may become `READY_FOR_MANUAL_REVIEW`.
- `PASSED` does not mean executed.
- `READY_FOR_MANUAL_REVIEW` does not mean executed.

## Ownership

The preflight gate owns preflight decisions, preflight audit records and preflight evidence.

It does not own execution request packages, approval status, execution truth, provider truth, deployment truth, or GitHub truth.
