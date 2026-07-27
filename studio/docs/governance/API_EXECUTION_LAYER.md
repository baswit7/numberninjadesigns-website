# API Execution Layer

## Purpose

The Studio OS V2.3 API Execution Layer is a controlled planning, approval and audit layer for future provider/API execution.

V2.3 does not execute provider calls. It prepares API execution plans, enriches them from API Center metadata, records approval requirements and produces deterministic audit evidence.

## Architecture

```text
API Center Provider Catalog
  -> API Execution Contract
  -> API Execution Generator
  -> Plan Report
  -> Audit Report
  -> Approval Report
  -> Validator
  -> Human Decision
```

`config/api-center.config.json` remains the provider catalog source. The API Execution Layer does not duplicate provider truth.

## Supported Providers

- OpenAI
- GitHub
- Telegram
- Notion
- Etsy
- TikTok
- Pinterest
- Instagram
- Facebook
- Vercel

Every planned provider must exist in API Center before a plan is valid.

## Supported Action Types

| Action Type | Purpose |
| --- | --- |
| `API_REQUEST_PLAN` | Prepare a future API request shape without executing it. |
| `API_AUTH_REQUIREMENT_REVIEW` | Review future auth requirements by environment variable name only. |
| `API_SCOPE_REVIEW` | Review scopes required by API Center metadata. |
| `API_COST_RISK_REVIEW` | Identify future cost exposure before execution exists. |
| `API_RATE_LIMIT_REVIEW` | Identify rate-limit exposure before execution exists. |
| `API_RESPONSE_SHAPE_REVIEW` | Review expected response sensitivity and downstream shape. |
| `API_EXECUTION_RECOMMENDATION` | Recommend future execution subject to human approval. |

## Execution States

Only these states are valid:

- `PLANNED`
- `READY_FOR_APPROVAL`
- `APPROVED`
- `REJECTED`
- `EXECUTED`
- `FAILED`

For V2.3, runtime items may not be `EXECUTED` unless `dryRunOnly=true`. The shipped plan keeps all runtime items in `READY_FOR_APPROVAL`.

## Approval Model

Human approval is mandatory for:

- `API_EXECUTION_RECOMMENDATION`
- any future external provider call
- any request that could create cost
- any request that could publish content
- any request that could modify external state
- any request that could access user or project data

Rules:

- No action may bypass approval.
- No action may self-approve.
- No role may approve its own request.
- Security may block.
- QA may block.
- Human remains final authority.

## Audit Model

Every API execution plan item must include:

- timestamp
- requestId
- providerName
- actionType
- requesterRole
- usedByProject
- authType
- requiredEnvironmentVariables
- scopesRequired
- approvalState
- executionState
- riskLevel
- costRisk
- rateLimitRisk
- dataAccessRisk
- externalMutationRisk
- humanApprovalRequired
- result
- blockers

No API execution plan is valid without matching audit evidence.

## Runtime Outputs

- `runtime/api-execution/api-execution.plan.json`
- `runtime/api-execution/api-execution.audit.json`
- `runtime/api-execution/api-execution-approval.report.json`

These files are planning artifacts, not live provider logs.

## Final Verdict

V2.3 adds controlled API execution preparation without execution capability. It creates a strict bridge between API Center metadata and future provider execution while preserving human authority, auditability and secret safety.
