# GitHub Live Execution

## Purpose

Studio OS V2.2B adds the first tightly governed live GitHub execution proof beyond the sandbox-only V2.2A path.

V2.2B remains intentionally narrow: it can create or confirm one allowlisted branch through Git, then record report, audit and history evidence.

## Allowed Capability

- `BRANCH_CREATE`

## Allowed Targets

- `feature/studio-os-v2-live-github-execution`
- `test/github-live-execution-proof/*`
- `experiment/github-live-execution-proof/*`

## Execution Model

```text
APPROVED
  -> Execute allowlisted GitHub branch creation
  -> Audit
  -> Report
  -> History
```

`PLANNED`, `READY_FOR_APPROVAL`, `REJECTED` and unapproved actions cannot execute.

## Evidence Model

V2.2B writes machine-readable evidence to:

- `runtime/github-execution/github-live-execution.report.json`
- `runtime/github-execution/github-live-execution.audit.json`
- `runtime/github-execution/github-live-execution.history.json`

Each execution records timestamp, request ID, requester role, action type, target repository, source branch, target branch, result, GitHub reference, approval state and execution state.

## Approval Model

- Human approval is mandatory.
- No automatic approval.
- No approval bypass.
- No self-approval.

## Manual Recovery

If a live proof branch is wrong, recovery remains manual and out-of-band. V2.2B does not delete branches, force push, rebase, merge or mutate repository settings.

## Final Verdict

V2.2B proves controlled live GitHub branch execution while keeping irreversible actions, protected branch writes, deployments, broad provider execution and autonomous systems out of scope.
