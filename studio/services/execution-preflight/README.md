# Execution Preflight Gate

The Execution Preflight Gate inspects packaged execution requests and produces preflight decisions.

It reads only `runtime/execution-request/` reports and writes only:

- `runtime/execution-preflight/execution-preflight.decisions.json`
- `runtime/execution-preflight/execution-preflight.audit.json`
- `runtime/execution-preflight/execution-preflight.report.json`

It does not execute, dispatch, mutate approvals, mutate request packages, call providers, deploy, merge, or access secrets.
