# Execution Dispatch Registry

The Execution Dispatch Registry records dispatch eligibility from manual review records.

It reads only `runtime/execution-review/` evidence and writes only:

- `runtime/execution-dispatch/execution-dispatch.registry.json`
- `runtime/execution-dispatch/execution-dispatch.audit.json`
- `runtime/execution-dispatch/execution-dispatch.report.json`

It does not execute, dispatch, call providers, call GitHub, deploy, merge, schedule work, or access secrets.
