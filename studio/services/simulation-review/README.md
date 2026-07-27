# Simulation Evidence Review Service

Phase 23 provides an explanation-only review layer for Phase 22 execution governance simulation output.

The service answers why the simulation produced `pass`, `warning` or `unknown`. It consumes generated reports from Phase 18 through Phase 22 and writes only `runtime/review/simulation-review.report.json`.

## Boundary

- Does not execute commands, workflows, providers or deployments.
- Does not approve, deny, repair, synchronize or mutate state.
- Does not own authority, evidence, monitoring, history, observability or simulation truth.
- Missing, unreadable, stale or incomplete inputs become `unknown`, never `pass`.
- Dashboard integration is intentionally absent in Phase 23.

## Outputs

- `runtime/review/simulation-review.report.json`
- `runtime/review/simulation-review-validation.report.json`

The validation report is written by `scripts/validation/validate-simulation-review.ps1`.
