# Idempotency Engine

The idempotency engine models repeat safety before future execution is possible.

## Inputs

- Execution request contract.
- Idempotency record contract.

## Outputs

- Idempotency key.
- Replay safety state.
- Conflict policy.
- Dedupe window.

## Non-Goals

- No distributed lock.
- No queue deduplication.
- No command dispatch.
- No runtime execution cache.

