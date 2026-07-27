# Studio OS V2.7 Execution Dispatch Registry

The Execution Dispatch Registry is the authoritative non-executing registry of dispatch eligibility.

It consumes manual review records from `runtime/execution-review/` and writes dispatch registry evidence under `runtime/execution-dispatch/`.

## Dispatch States

- `UNKNOWN`
- `BLOCKED`
- `DISPATCH_ELIGIBLE`
- `DISPATCH_DENIED`
- `EXPIRED`

## Rules

- `UNKNOWN` never becomes `DISPATCH_ELIGIBLE`.
- `PENDING_REVIEW` never becomes `DISPATCH_ELIGIBLE`.
- `BLOCKED` remains `BLOCKED`.
- `APPROVED_FOR_DISPATCH` may become `DISPATCH_ELIGIBLE`.
- No state causes execution.
- No state triggers execution.
- No state triggers provider actions.
- No state triggers GitHub actions.

## Ownership

The registry owns dispatch eligibility, dispatch evidence and dispatch audit trail.

It does not own execution, provider truth, GitHub truth, deployment truth, or runtime truth.
