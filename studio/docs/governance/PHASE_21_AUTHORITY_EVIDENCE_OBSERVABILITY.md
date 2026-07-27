# Phase 21 Authority/Evidence Observability Center

## Objective

Phase 21 adds a read-only Authority/Evidence Observability Center above the Phase 15 through Phase 20 authority stack.

The layer provides visibility only. It does not provide control, approval, repair, synchronization, execution, provider access, deployment, dashboard mutation or authority mutation.

## Consumed Sources

Phase 21 derives visibility from existing outputs:

- `runtime/authority/authority-read-model.report.json`
- `runtime/authority/authority-read-model-validation.report.json`
- `runtime/dashboard/authority.view.json`
- `runtime/dashboard/authority-dashboard-validation.report.json`
- `runtime/authority/authority-projection-monitoring.report.json`
- `runtime/authority/authority-monitoring-evidence.report.json`
- `runtime/authority/authority-evidence-history.report.json`

The source of truth remains upstream:

- Authority truth remains in the Constitution and Authority Registry.
- Evidence truth remains in Phase 19.
- Monitoring truth remains in Phase 18.
- Projection truth remains in Phase 17 generated projection outputs.
- History and retention truth remains in Phase 20.

## Generated Outputs

Phase 21 writes only generated machine-readable reports:

- `runtime/authority/authority-observability.report.json`
- `runtime/authority/authority-observability-validation.report.json`

These reports are observability artifacts, not authority records.

## Visibility Model

The Observability Center exposes:

- Freshness visibility: input freshness, stale-state visibility and age-derived status.
- Lineage visibility: authority source to read model, dashboard projection, monitoring, evidence and history chain.
- Coverage visibility: read model, projection, monitoring, evidence and input-set coverage.
- Trend visibility: current monitoring, evidence and history status evolution as reported by upstream layers.
- Retention visibility: Phase 20 retention policy and retained snapshot state.
- Health summaries: aggregated read-only observability status and safe/unsafe item flags.

## Unknown Handling

Missing, unreadable, stale or incomplete input is `unknown`, never `pass`.

Non-pass items are marked with `safe=false`. The observability report may have `status=unknown` while still being structurally valid when upstream data is intentionally incomplete or stale.

## Dashboard Decision

Phase 21 does not modify dashboard code or dashboard runtime views. Dashboard integration remains future scope and must stay passive if added in a later reviewed phase.

## Boundary

Phase 21 is:

- observability-only
- visibility-only
- read-only
- derived-only
- report-writing-only

Phase 21 owns no authority truth, evidence truth, monitoring truth, projection truth, history truth or retention truth.

Phase 21 cannot create decisions, create approvals, repair projections, synchronize projections, execute tasks, invoke providers, deploy systems, access credentials, access secrets, mutate dashboard state, mutate runtime truth, create background activity or self-heal.
