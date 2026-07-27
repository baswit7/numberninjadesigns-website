# Phase 23 - Simulation Evidence Review Layer

## Objective

Phase 23 adds a read-only review layer above the Phase 22 Execution Governance Simulation Layer.

Phase 22 answers: what would happen if execution were attempted?

Phase 23 answers: why did the simulation produce `pass`, `warning` or `unknown`?

The layer explains simulation outcomes only. It does not decide, approve, execute, repair or synchronize anything.

## Inputs

The review generator consumes existing generated reports:

- `runtime/simulation/execution-simulation.report.json`
- `runtime/simulation/execution-simulation-validation.report.json`
- `runtime/authority/authority-projection-monitoring.report.json`
- `runtime/authority/authority-monitoring-evidence.report.json`
- `runtime/authority/authority-evidence-history.report.json`
- `runtime/authority/authority-observability.report.json`

These reports remain the upstream truth for their own domains. Phase 23 owns none of them.

## Outputs

Phase 23 owns only:

- `runtime/review/simulation-review.report.json`
- `runtime/review/simulation-review-validation.report.json`

The review report is derived, deterministic and sanitized. It contains outcome review, root cause classification, evidence attribution, confidence scoring, explainability and unknown propagation.

## Unknown Handling

Missing, unreadable, stale or incomplete input becomes `unknown`.

If Phase 22 reports unknown simulation inputs or unknown simulation items, Phase 23 remains `unknown`. The review may explain why the state is unknown, but it must never convert unknown evidence into pass.

## Dashboard

Phase 23 does not modify dashboard code or dashboard runtime projection data.

If a later phase exposes review data in the dashboard, that surface must remain passive and read-only with no buttons, controls, approvals, repair, synchronization, execution or provider invocation.

## Validation

`scripts/validation/validate-simulation-review.ps1` validates required artifacts, report shape, boundary flags, unknown propagation and forbidden implementation patterns.

`scripts/validation/validate-studio-os.ps1` invokes the Phase 23 validator as part of the Studio OS validation pipeline.
