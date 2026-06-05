# Rollback Strategy

## Purpose

Rollback governance determines whether a future action has a documented path back to a known safe state.

## Readiness States

- `ready`: reversible with documented preconditions, steps, and validation checks.
- `partial`: some rollback details are present but not complete.
- `missing`: rollback strategy is absent.
- `not-reversible`: action cannot be reliably reversed.

## Phase 9 Boundary

Rollback plans do not perform rollback. They only document readiness.

