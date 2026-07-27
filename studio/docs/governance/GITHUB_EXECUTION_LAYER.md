# GitHub Execution Layer

## Purpose

The Studio OS V2.2 GitHub Execution Layer is the first controlled execution-capability design inside Studio OS.

This sprint implements offline planning, approval-state reporting and audit reporting only. It does not call the GitHub API, mutate GitHub, deploy, store credentials, create workers, create queues, schedule background jobs or perform autonomous execution.

## Smallest Valuable Capability

The smallest GitHub execution capability with maximum value is:

1. A contract that defines allowed GitHub action requests.
2. A deterministic generator that turns the contract into local planning reports.
3. An audit report with mandatory fields for every action.
4. An approval report that separates read-only planning from human-approved mutation-capable actions.
5. A validator that enforces action types, execution states, approvals, protected branch rules, audit fields and forbidden capability boundaries.

This gives Studio OS execution readiness without hidden GitHub mutation.

## Supported Action Types

| Action Type | Purpose | Human Approval |
| --- | --- | --- |
| `BRANCH_CREATE` | Prepare a future isolated branch creation action. | Required |
| `COMMIT_CREATE` | Prepare a future commit creation action. | Required |
| `PULL_REQUEST_CREATE` | Prepare a future pull request creation action. | Required |
| `DIFF_INSPECT` | Prepare local read-only diff inspection output. | Not required |
| `REVIEW_GENERATE` | Prepare local read-only review output. | Not required |
| `MERGE_RECOMMENDATION` | Prepare an advisory merge recommendation. | Required |

## Execution States

Only these states are valid:

- `PLANNED`
- `READY_FOR_APPROVAL`
- `APPROVED`
- `REJECTED`
- `EXECUTED`
- `FAILED`

No other execution or approval states are allowed in V2.2.

## Execution Model

```text
Contract
  -> Generator
  -> Plan Report
  -> Audit Report
  -> Approval Report
  -> Validator
  -> Human Decision
```

V2.2 stops at local reports and validation. It does not perform the planned GitHub actions.

## Workforce Integration

| Role | Permission |
| --- | --- |
| Orchestrator | May coordinate GitHub execution requests. |
| Architect | May request architecture-related review or planning. |
| Developer | May prepare branch, commit and pull request actions. |
| QA | May request diff inspection and block execution. |
| Security | May block execution. |
| Human | Final approval authority. |

No other AI Workforce role may request GitHub execution in V2.2.

## Approval Model

Mandatory human approval is required for:

- `BRANCH_CREATE`
- `COMMIT_CREATE`
- `PULL_REQUEST_CREATE`
- `MERGE_RECOMMENDATION`

Rules:

- No action may bypass approval.
- No action may self-approve.
- No role may approve its own request.
- QA may block execution.
- Security may block execution.
- Human remains final authority.

## Audit Model

Every action must produce audit data containing:

- timestamp
- requestId
- requesterRole
- action
- actionType
- targetRepository
- targetBranch
- sourceBranch
- result
- approvalStatus
- approvalState
- executionState
- blockers
- riskLevel
- humanApprovalRequired

No action is valid without an audit record.

## Protected Branch Handling

The layer never allows direct writes to:

- `main`
- `master`
- `production`
- `release`

Actions that would directly write to a protected branch must be `FAILED` or `REJECTED`. Pull request creation and merge recommendation may target `main` as planning or review targets only when `directProtectedBranchWrite` is false and human approval is required.

## Runtime Outputs

- `runtime/github-execution/github-execution.plan.json`
- `runtime/github-execution/github-execution.audit.json`
- `runtime/github-execution/github-execution-approval.report.json`

These are local planning artifacts. They are not GitHub execution logs from a live provider.

## Final Verdict

V2.2 creates the first execution-shaped layer while keeping execution explainable and human-controlled. The layer prepares GitHub actions, approval state and audit evidence, but does not yet mutate GitHub.
