# Phase 20 Authority Evidence History

Phase 20 adds a read-only Authority/Evidence Historical Trend and Retention Layer.

Pipeline position:

```text
Constitution
Authority Registry
Authority Read Model
Authority Projection Monitoring
Authority Monitoring Evidence Center
Authority Evidence History
Dashboard Projection Layer
Dashboard
```

## Architecture Decisions

- Phase 20 consumes Phase 18 monitoring and Phase 19 evidence outputs.
- Phase 20 owns no authority truth and no evidence truth.
- Phase 20 writes generated history and validation reports only under `runtime/authority`.
- Phase 20 keeps a bounded current-snapshot history report for visibility.
- Missing or unreadable input becomes `unknown`, never `pass`.
- Stale or incomplete history remains visible and is not repaired.
- No dashboard changes are required for Phase 20.

## Consumed Inputs

- `runtime/authority/authority-projection-monitoring.report.json`
- `runtime/authority/authority-monitoring-evidence.report.json`
- `runtime/dashboard/authority.view.json`
- `runtime/dashboard/authority-monitoring-evidence.view.json`

## Produced Reports

- `runtime/authority/authority-evidence-history.report.json`
- `runtime/authority/authority-evidence-history-validation.report.json`

## Retention Policy

Policy ID: `authority-evidence-history-retention`

- Retained generated snapshot count: `1`
- Pruning allowed: `false`
- Repair allowed: `false`
- Synchronization allowed: `false`

The report is intentionally bounded. Prior history absence is surfaced as `unknown` trend direction, not success.

## Trend Visibility

Phase 20 exposes:

- current Phase 18 monitoring status
- current Phase 19 evidence status
- current finding count
- current unknown count
- lineage from monitoring and evidence reports
- freshness/staleness visibility
- regression direction as `unknown` when no prior retained snapshot exists

## Boundary

Phase 20 cannot:

- execute
- invoke providers
- deploy
- repair projections
- synchronize reports
- access credentials
- access secrets
- mutate dashboard state
- mutate runtime truth
- mutate authority truth
- mutate evidence truth
- mutate approvals
- create workers
- create schedulers
- create queues
- create automation
- self-heal
