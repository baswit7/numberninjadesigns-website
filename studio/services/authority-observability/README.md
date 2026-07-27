# Authority Evidence Observability

Phase 21 provides read-only observability over existing Authority and Evidence reports.

The generator consumes existing Phase 15 through Phase 20 runtime outputs and writes only:

- `runtime/authority/authority-observability.report.json`

It owns no authority truth, evidence truth, monitoring truth, projection truth, history truth or retention truth. It does not repair stale data, synchronize projections, invoke providers, execute workflows, deploy systems, access credentials, access secrets or mutate dashboard state.

Missing, unreadable, stale or incomplete source data is surfaced as `unknown`, never `pass`.
