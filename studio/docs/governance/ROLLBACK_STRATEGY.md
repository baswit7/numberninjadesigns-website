# Rollback Strategy

## Purpose

Rollback governance validates whether a future execution request has a documented reversal strategy.

## Readiness States

- `ready`: reversal path is documented and checkable.
- `partial`: some rollback prerequisites exist but readiness is incomplete.
- `missing`: no rollback plan exists.
- `not-reversible`: the request cannot be safely reversed.

## Boundary

Phase 9 rollback plans do not perform rollback, inspect deployment state, restore data or mutate runtime state.
