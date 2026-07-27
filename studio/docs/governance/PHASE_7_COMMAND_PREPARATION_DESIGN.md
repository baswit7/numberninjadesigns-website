# Phase 7: Command Preparation Design

## 1. Purpose

The Phase 7 command preparation layer is a non-executing design layer that converts user intent into structured, reviewable artifacts.

Its purpose is to make command intent explicit before any future implementation can act on it. The layer may classify intent, prepare handoff prompts, draft action plans and assemble release checklists, but it must not execute commands or mutate repository, runtime, provider, deployment or dashboard state.

The output of this layer is advisory evidence for human review. It is not approval, automation or execution authority.

## 2. Inputs

The preparation layer accepts only bounded, reviewable context:

| Input | Purpose |
| --- | --- |
| `userObjective` | Captures the requested outcome in plain language. |
| `repositoryContext` | Summarizes relevant repository files, docs, contracts, current known state and evidence references. |
| `currentBranch` | Records the active Git branch so branch safety can be reviewed. |
| `knownUntrackedFiles` | Lists untracked files that must be preserved, ignored or explicitly excluded from scope. |
| `phaseConstraints` | Carries phase-specific limits such as documentation-only, design-only or schema-only boundaries. |
| `allowedActions` | Defines what preparation behavior is permitted for the current request. |
| `forbiddenActions` | Defines actions that must not be prepared as executable steps or performed by the layer. |
| `requiredApprovalState` | Records whether human approval is absent, required, granted externally or blocked. |

Inputs must be treated as context for classification and planning only. Missing context must produce a blocked or needs-review preparation result, not runtime probing, provider calls or shell execution.

## 3. Outputs

The layer may prepare, but not execute, these review artifacts:

| Output | Description | Execution status |
| --- | --- | --- |
| Command-classification records | Structured records that classify user intent, risk, approval needs, allowed actions and forbidden actions. | Non-executing |
| Codex-prompt handoffs | Reviewable prompts for a future Codex task, including scope, safety boundaries and expected outputs. | Non-executing |
| Action-plan records | Ordered, reviewable plan records with evidence, blockers, risk level and approval requirements. | Non-executing |
| Release-checklist records | Release preparation checklists with gates, manual signoff requirements, blockers and safety notes. | Non-executing |

These outputs are records for review. They must not contain hidden execution triggers, provider payloads, credentials, shell commands intended for automatic execution or implicit approval.

## 4. Contract Alignment

The command preparation layer aligns to the Phase 7 command contracts already defined under `shared/contracts/command/`.

| Prepared output | Contract path | Alignment |
| --- | --- | --- |
| Command-classification records | `shared/contracts/command/command-classification.schema.json` | Captures command intent, execution class, risk level, allowed actions, forbidden actions and approval requirements. |
| Codex-prompt handoffs | `shared/contracts/command/codex-prompt.schema.json` | Captures non-executing prompt packages, expected outputs, scope limits, safety boundaries and approval gates. |
| Action-plan records | `shared/contracts/command/action-plan.schema.json` | Captures recommended non-executing plan steps, blockers, evidence, traceability and required approval state. |
| Release-checklist records | `shared/contracts/command/release-checklist.schema.json` | Captures release readiness checks, manual signoff, blockers, rollback notes and non-execution release preparation. |

Contract alignment does not imply that validators, generators, services or runners exist. This document only defines the preparation design boundary.

## 5. Safety Boundary

The command preparation layer has a strict non-execution boundary.

It must not:

- execute commands
- execute shell commands
- call providers
- mutate runtime state
- deploy
- push, merge or delete Git state
- grant automatic approval
- handle secrets
- read, store, transform or expose credentials
- create runtime mutation logic
- create command executor logic
- create provider integration logic

Prepared artifacts may describe that an action is blocked, requires approval or should be handled by a future system. They must not perform the action.

## 6. Human Approval Model

Human approval is required before any future downstream system may proceed when the prepared intent includes or may include:

- high or critical risk
- provider-sensitive action
- runtime mutation
- deployment
- Git push, merge or delete
- destructive file operations
- unknown scope

Approval must be explicit, human, traceable and separate from the prepared artifact. A generated classification, prompt, action plan or checklist must never be interpreted as approval by itself.

When approval state is missing or ambiguous, the preparation result must mark the action as requiring approval or blocked. Unknown scope defaults to blocked until clarified by a human.

## 7. Future Implementation Phases

Future phases may add implementation around this design, but only as separate, explicitly scoped tasks:

| Future phase | Description | Boundary |
| --- | --- | --- |
| Schema examples | Add sample JSON documents for each command contract. | Examples only, no execution. |
| Schema-only validator | Validate prepared records against existing schemas. | Deterministic validation only, no providers or runtime mutation. |
| Prompt template generator | Generate Codex-prompt handoff records from bounded inputs. | Prompt preparation only. |
| Action-plan generator | Generate action-plan records from user objective and repository context. | Plan preparation only. |
| Release checklist generator | Generate release-checklist records for review. | Checklist preparation only. |
| Optional dashboard read-only visualization | Display prepared records in a read-only dashboard view. | Visualization only, no dashboard mutation or execution. |

Each future phase must preserve the non-executing preparation boundary unless a later governance document explicitly defines, approves and tests a separate execution layer.

## 8. Non-Goals

This design explicitly excludes:

- executor
- automation runner
- provider orchestrator
- deployment controller
- dashboard mutation
- branch cleanup
- pruning
- runtime console execution
- runtime report generation
- provider calls
- build, install or deployment workflows
- validators, scripts or services for this task

## 9. Acceptance Criteria

This design task succeeds only if:

- the new branch is created from updated `main`
- exactly one new design document is added
- `CHANGELOG.md` is the only modified existing file if repository convention requires a changelog entry
- no code, runtime, dashboard, provider, deployment, validator or service files are changed
- `scripts/runtime/prune-dashboard-history.ps1` remains untracked and untouched
- no commit is performed
- no push is performed
