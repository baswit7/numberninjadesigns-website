# Authority Monitoring Evidence Center

Phase 19 adds a read-only evidence center around Phase 18 authority projection monitoring.

The service consumes existing reports only:

- `runtime/authority/authority-projection-monitoring.report.json`
- `runtime/authority/authority-read-model.report.json`
- `runtime/authority/authority-query-responses.report.json`
- `runtime/dashboard/authority.view.json`

It writes derived evidence only:

- `runtime/authority/authority-monitoring-evidence.report.json`

It owns no authority, owns no truth, repairs nothing, synchronizes nothing, executes nothing, invokes no providers, deploys nothing, reads no credentials, reads no secrets and creates no dashboard action path.

Missing or unreadable input is always reported as `unknown`, never as `pass`.
