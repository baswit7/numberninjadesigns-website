# Execution Request Packager

The Execution Request Packager converts existing approval records into machine-readable request packages for human review.

It reads `runtime/approval/execution-approval.records.json` and writes only:

- `runtime/execution-request/execution-request.packages.json`
- `runtime/execution-request/execution-request.audit.json`
- `runtime/execution-request/execution-request.report.json`

It does not execute actions, call providers, mutate approvals, write branches, deploy, merge, or access secrets.
