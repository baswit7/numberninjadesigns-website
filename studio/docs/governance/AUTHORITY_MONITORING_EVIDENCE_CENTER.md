# Authority Monitoring Evidence Center

Phase 19 adds a read-only evidence layer above Phase 18 authority projection monitoring.

Pipeline position:

```text
Constitution
Authority Registry
Authority Read Model
Authority Projection Monitoring
Authority Monitoring Evidence Center
Dashboard Projection Layer
Dashboard
```

## Architecture Decisions

- Evidence Center consumes Phase 18 monitoring reports and related authority/dashboard reports.
- Evidence Center owns no authority and owns no truth.
- Phase 18 remains the monitoring source; Phase 19 explains the evidence.
- Evidence output is derived report data only.
- Missing or unreadable input produces `unknown`, never `pass`.
- Dashboard rendering remains passive and exposes no repair, synchronization, execution, approval or authority-editing controls.

## Evidence Coverage

Source file evidence:

- Constitution source contract
- Authority Registry source contract
- Authority read model report
- Authority query responses report
- Phase 18 monitoring report

Projection file evidence:

- Authority dashboard projection
- Phase 18 monitoring dashboard view

Lineage evidence:

- Source marker checks
- Read model to dashboard source-contract checks

Verdict evidence:

- Phase 18 status
- Phase 18 findings

Freshness evidence:

- Read-model last modified timestamp
- Dashboard projection last modified timestamp
- Projection older-than-source result

Completeness evidence:

- Expected authority dashboard cards
- Missing or duplicated projection evidence from Phase 18

Mismatch evidence:

- Summary count parity
- Authority field parity
- Structural mismatch findings from Phase 18

Safety evidence:

- Can repair = no
- Can synchronize = no
- Can execute = no
- Can mutate = no
- Provider, deployment, credential and secret paths remain unavailable

Unknown evidence:

- Missing or unreadable inputs remain `unknown`.
- The generated report includes `unknownStateProof` so validation can prove missing evidence cannot become a pass verdict.

## Produced Reports

- `runtime/authority/authority-monitoring-evidence.report.json`
- `runtime/authority/authority-monitoring-evidence-validation.report.json`
- `runtime/dashboard/authority-monitoring-evidence.view.json`

## Boundary

The Evidence Center cannot:

- execute
- deploy
- invoke providers
- repair projections
- synchronize projections
- access credentials
- access secrets
- mutate runtime state outside generated reports
- mutate dashboard state
- mutate authority state
- automate approvals
- create dashboard actions
