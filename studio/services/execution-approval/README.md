# Execution Approval Gateway

## Purpose

The Studio OS Execution Approval Gateway receives execution intent, classifies it, produces approval records, emits evidence and writes an audit trail.

It does not execute actions. It does not own GitHub, provider, deployment, runtime or dashboard truth.

## Runtime Outputs

- `runtime/approval/execution-approval.report.json`
- `runtime/approval/execution-approval.audit.json`
- `runtime/approval/execution-approval.records.json`

## Boundary

The gateway is non-autonomous and approval-only. Approved records do not dispatch execution.
