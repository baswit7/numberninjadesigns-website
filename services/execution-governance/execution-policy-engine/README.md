# Execution Policy Engine

The execution policy engine combines approval, risk, rollback, and idempotency records into a non-executing policy decision.

## Decision States

- `allow-for-future-execution-review`: governance prerequisites are modeled, but Phase 9 still does not execute.
- `deny`: policy denies the request.
- `blocked`: hard boundary or missing prerequisite blocks the request.

## Non-Goals

- No executors.
- No provider calls.
- No deployments.
- No queues.
- No schedulers.
- No background workers.

