# Idempotency Model

## Purpose

The idempotency model evaluates whether repeating a future request is safe.

## Strategies

- `request-hash`: derive identity from normalized request content.
- `business-key`: use a stable domain key.
- `manual-review`: require a human to resolve repeat safety.

## Conflict Policies

- `deny-conflict`: reject conflicting repeats.
- `require-review`: require explicit human review.
- `allow-identical-only`: allow repeats only when the request is identical.

## Phase 9 Boundary

Idempotency records do not create locks, queues, distributed state, or execution cache entries.

