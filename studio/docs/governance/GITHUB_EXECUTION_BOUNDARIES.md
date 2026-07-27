# GitHub Execution Boundaries

## Purpose

This document defines the hard safety boundaries for the Studio OS V2.2 GitHub Execution Layer.

V2.2 is an offline planning, approval and audit layer. It is not a live GitHub executor.

## Allowed

- Define GitHub execution requests.
- Generate local execution plans.
- Generate local audit reports.
- Generate local approval-state reports.
- Model branch creation, commit creation, pull request creation, diff inspection, review generation and merge recommendation.
- Validate action types, execution states, approval requirements, protected branch rules, audit fields and forbidden capabilities.

## Forbidden

V2.2 must not add:

- OpenAI execution
- Telegram execution
- Notion execution
- Etsy execution
- TikTok execution
- Vercel deployment
- provider execution beyond GitHub planning
- actual deployment
- credential storage
- secret storage
- background jobs
- workers
- queues
- schedulers
- autonomous execution
- automatic merging
- automatic rebasing
- direct writes to protected branches
- AI Workforce runtime execution
- Software Factory

## Security Boundary

The layer must not store or read:

- tokens
- API keys
- client secrets
- refresh tokens
- cookies
- personal credentials

Only environment variable names may be referenced in future designs. V2.2 does not require or read any environment variable value.

## Protected Branch Boundary

Direct writes are forbidden for:

- `main`
- `master`
- `production`
- `release`

Any action with `directProtectedBranchWrite=true` and a protected `targetBranch` must have `executionState` or `approvalState` set to `FAILED` or `REJECTED`.

## Approval Boundary

Human approval is mandatory for:

- branch creation
- commit creation
- pull request creation
- merge recommendation execution

Read-only planning actions may be generated without human approval only when they do not call GitHub and do not mutate any repository.

## Audit Boundary

Every action must have an audit entry before it can be considered valid.

Required audit fields:

- timestamp
- requestId
- requesterRole
- action
- target repository
- target branch
- result
- approval status

The V2.2 implementation also records source branch, execution state, blockers, risk level and human approval requirement.

## Failure Handling

| Failure | Required State |
| --- | --- |
| Invalid action type | Validation failure |
| Invalid execution state | Validation failure |
| Missing audit entry | Validation failure |
| Required human approval missing | Validation failure |
| Direct protected branch write | `FAILED` or `REJECTED` |
| Secret-like value found | Validation failure |
| Forbidden provider or deployment capability found | Validation failure |

## Final Boundary Verdict

The V2.2 GitHub Execution Layer is safe only while it remains offline, deterministic, auditable and human-gated. Live GitHub mutation belongs to a later explicitly approved step, not this sprint.
