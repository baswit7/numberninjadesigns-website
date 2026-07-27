# Phase 24 - Execution Readiness Decision Layer

## Objective

Phase 24 adds a read-only derived Execution Readiness Decision Layer.

It answers:

Would execution theoretically be allowed if execution existed?

The layer evaluates existing governance evidence only. It does not add execution, approvals, workflow starts, provider invocation, deployment, repair, synchronization or dashboard mutation.

## Architecture Position

The decision layer sits after the existing chain:

Authority -> Monitoring -> Evidence -> History -> Observability -> Simulation -> Review -> Decision

Decision consumes truth. Decision owns no upstream truth.

## Inputs

The decision generator reads:

- `runtime/authority/authority-read-model.report.json`
- `runtime/authority/authority-projection-monitoring.report.json`
- `runtime/authority/authority-monitoring-evidence.report.json`
- `runtime/authority/authority-evidence-history.report.json`
- `runtime/authority/authority-observability.report.json`
- `runtime/simulation/execution-simulation.report.json`
- `runtime/review/simulation-review.report.json`

## Outputs

Phase 24 owns only:

- `runtime/decision/execution-readiness-decision.report.json`
- `runtime/decision/execution-readiness-decision-summary.json`
- `runtime/decision/execution-readiness-decision-validation.report.json`

These are derived reports, not authority, approval, execution or runtime truth.

## Decision States

Allowed decision states are exactly:

- `PASS`
- `FAIL`
- `BLOCKED`
- `UNKNOWN`

No other state is valid.

## Unknown Propagation

UNKNOWN has precedence over PASS.

If simulation is UNKNOWN, decision is UNKNOWN.

If review is UNKNOWN, decision is UNKNOWN.

If required evidence is missing, unreadable, stale or incomplete, decision is UNKNOWN.

The validator checks that UNKNOWN cannot become PASS.

## Boundary

Phase 24 may generate decision reports and summaries only.

It does not support manual overrides, approvals, exception editing, execution, provider invocation, deployment, workflow starts, queues, workers, schedulers, repair, auto-remediation, credential access, secret handling, localStorage authority, sessionStorage authority or background execution.
