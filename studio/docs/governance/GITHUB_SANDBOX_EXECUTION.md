# GitHub Sandbox Execution

## Purpose

Studio OS V2.2A activates the first controlled real execution capability: sandbox-only GitHub branch creation.

The existing V2.2 GitHub planning model remains intact. V2.2A adds a separate execution path that only runs after explicit human approval and only targets sandbox-safe branch prefixes.

## Execution Flow

```text
PLANNED
  -> READY_FOR_APPROVAL
  -> APPROVED
  -> EXECUTE
  -> AUDIT
  -> REPORT
```

Only `APPROVED` requests may execute.

## Allowed Live Action

- `BRANCH_CREATE`

## Allowed Branch Targets

- `sandbox/*`
- `test/*`
- `experiment/*`

## Runtime Evidence

- `runtime/github-execution/github-sandbox-execution.report.json`
- `runtime/github-execution/github-sandbox-execution.audit.json`
- `runtime/github-execution/github-sandbox-execution.history.json`

## Approval Model

- Human approval is mandatory.
- No automatic approval.
- No approval bypass.
- No self-approval.
- Human remains final authority.

## Audit Model

Every execution records:

- timestamp
- requestId
- requesterRole
- actionType
- targetRepository
- sourceBranch
- targetBranch
- result
- githubReference
- approvalState
- executionState

## Final Verdict

V2.2A enables one reversible, sandbox-scoped live action and records evidence for every execution. It does not add pull request creation, commits, merge, delete, rebase, deployments or autonomous execution.
