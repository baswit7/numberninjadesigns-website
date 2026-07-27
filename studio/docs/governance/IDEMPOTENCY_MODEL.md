# Idempotency Model

## Purpose

The idempotency model evaluates replay safety before future execution can be considered.

## Strategies

- `request-hash`: identify repeats by normalized request content.
- `business-key`: identify repeats by a stable domain key.
- `manual-review`: require human review for replay safety.

## Conflict Policies

- `deny-conflict`
- `require-review`
- `allow-identical-only`

## Boundary

Phase 9 does not create queues, locks, workers, schedulers, executors or execution caches.
