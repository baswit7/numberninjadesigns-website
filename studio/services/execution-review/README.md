# Manual Execution Review Gate

The Manual Execution Review Gate converts preflight decisions into manual review records.

It reads only `runtime/execution-preflight/` evidence and writes only:

- `runtime/execution-review/execution-review.records.json`
- `runtime/execution-review/execution-review.audit.json`
- `runtime/execution-review/execution-review.report.json`

It does not execute, dispatch, approve automatically, mutate upstream records, call providers, deploy, merge, or access secrets.
