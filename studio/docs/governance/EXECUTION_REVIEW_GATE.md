# Studio OS V2.6 Manual Execution Review Gate

The Manual Execution Review Gate converts preflight decisions into manual review records before any future dispatch layer can consume them.

This layer is non-executing. It consumes only `runtime/execution-preflight/` evidence and writes only `runtime/execution-review/` evidence.

## Review States

Allowed states:

- `UNKNOWN`
- `BLOCKED`
- `PENDING_REVIEW`
- `APPROVED_FOR_DISPATCH`
- `REJECTED`
- `EXPIRED`

## Decision Rules

- `UNKNOWN` never becomes `APPROVED_FOR_DISPATCH` automatically.
- Only `READY_FOR_MANUAL_REVIEW` preflight decisions may become `PENDING_REVIEW`.
- `BLOCKED` preflight decisions remain `BLOCKED`.
- `FAILED` preflight decisions become `REJECTED` or `BLOCKED`.
- `APPROVED_FOR_DISPATCH` requires explicit manual review evidence.
- `APPROVED_FOR_DISPATCH` does not execute anything.

## Evidence Model

Every record includes the source preflight id, request id, source approval id, preflight state, review state, requested action, target system, risk classification, manual evidence status, dispatch status, result and blockers.

## Ownership

The review gate owns manual review records, manual review audit records and manual review evidence.

It does not own preflight decisions, request packages, approval records, execution truth, provider truth, deployment truth, or GitHub truth.
