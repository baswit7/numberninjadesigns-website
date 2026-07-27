# Approval Protocol

## Purpose

The approval protocol models whether a future execution request has a human approval state.

## States

- `missing`: no valid approval exists.
- `pending`: review is not complete.
- `approved_for_review`: governance review permits further review only, not execution.
- `denied`: approval was denied.
- `expired`: approval is no longer valid.

## Rule

Approval is never execution authority in Phase 9. Approval records are advisory metadata used by the execution policy engine.
