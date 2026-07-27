# Execution Approval Gateway

## Purpose

The Studio OS Execution Approval Gateway formalizes the checkpoint between requested action, approved action and executed action.

It receives execution intent, classifies intent, creates approval records, writes approval evidence and produces an audit trail.

## State Model

Valid machine-readable approval states:

- `UNKNOWN`
- `REQUESTED`
- `PENDING_APPROVAL`
- `APPROVED`
- `REJECTED`
- `EXPIRED`
- `EXECUTED`

`UNKNOWN` never becomes `APPROVED` automatically.

## Ownership

The Approval Gateway owns:

- approval status
- approval evidence
- approval audit trail

The Approval Gateway does not own:

- execution truth
- provider truth
- deployment truth
- GitHub truth
- runtime truth
- dashboard truth

## Execution Boundary

The gateway does not execute anything. An `APPROVED` record is approval evidence only. It does not dispatch GitHub, provider, deployment or runtime actions.

## Runtime Evidence

- `runtime/approval/execution-approval.report.json`
- `runtime/approval/execution-approval.audit.json`
- `runtime/approval/execution-approval.records.json`

## Final Verdict

The gateway adds a formal non-autonomous approval checkpoint. Execution remains owned by separate explicitly governed execution layers.
