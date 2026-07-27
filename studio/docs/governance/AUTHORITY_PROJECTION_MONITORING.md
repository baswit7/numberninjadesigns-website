# Authority Projection Monitoring

Phase 18 adds a read-only monitoring layer between the Authority Read Model and the Dashboard Projection Layer.

Pipeline position:

```text
Constitution
Authority Registry
Authority Read Model
Authority Projection Monitoring
Dashboard Projection Layer
Dashboard
```

## Architecture Decisions

- Monitoring consumes authority sources and dashboard projections; it owns no truth.
- Monitoring writes derived reports only under `runtime/authority`.
- Monitoring detects missing, stale, mismatched, incomplete and lineage-broken authority projections.
- Monitoring does not repair projections, synchronize runtime state, approve actions, execute workflows, invoke providers, deploy, read credentials, read secrets, or mutate authority contracts.
- The dashboard consumes the monitoring report as passive visibility through `runtime/dashboard/authority-projection-monitoring.view.json`.

## Consumed Sources

- `shared/contracts/authority/constitution.rules.json`
- `shared/contracts/authority/authority-registry.json`
- `runtime/authority/authority-read-model.report.json`
- `runtime/authority/authority-query-responses.report.json`
- `runtime/dashboard/authority.view.json`

## Produced Reports

- `runtime/authority/authority-projection-monitoring.report.json`
- `runtime/authority/authority-projection-monitoring-validation.report.json`
- `runtime/dashboard/authority-projection-monitoring.view.json`

## Detection Scope

Missing projection detection:

- Detects unreadable or absent `runtime/dashboard/authority.view.json`.
- Detects missing or duplicated authority summary, classification and denied-authority cards.

Stale projection detection:

- Compares authority read-model last modified time with authority dashboard projection last modified time.
- Reports `stale-projection` when the dashboard projection is older than the read model.

Structural mismatch detection:

- Compares summary counts against the read model.
- Compares denied authority card fields against read model authorities.
- Verifies card boundary details do not expose `canExecute=true` or `canMutate=true`.

Lineage verification:

- Verifies `studio-dashboard:authority` source marker.
- Verifies summary `sourceContracts` match the read model lineage.
- Verifies cards source from `runtime/authority/*.json`.

Completeness verification:

- Verifies expected classification cards exist.
- Verifies every denied authority in the read model has a corresponding dashboard projection card.

## Boundary

The monitoring layer is report-only.

It cannot:

- execute
- deploy
- invoke providers
- repair projections
- synchronize projections
- access credentials
- access secrets
- mutate runtime state outside its generated reports
- automate approvals
- add dashboard actions
