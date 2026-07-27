# Authority Evidence History

Phase 20 adds read-only historical trend and retention visibility for authority monitoring and evidence outputs.

The service consumes existing generated reports only:

- `runtime/authority/authority-projection-monitoring.report.json`
- `runtime/authority/authority-monitoring-evidence.report.json`
- `runtime/dashboard/authority.view.json`
- `runtime/dashboard/authority-monitoring-evidence.view.json`

It writes derived history reports only:

- `runtime/authority/authority-evidence-history.report.json`

It does not own authority truth, own evidence truth, repair stale projections, synchronize reports, run providers, deploy, read credentials, read secrets, mutate dashboard state, or create background activity.

Missing or unreadable inputs are classified as `unknown`, never `pass`.
