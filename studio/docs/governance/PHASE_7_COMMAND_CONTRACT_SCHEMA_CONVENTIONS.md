# Phase 7: Command Contract Schema Conventions

## 1. Purpose

This note defines shared conventions for the Phase 7 command-layer JSON schemas before any schemas are created.

The goal is to make the upcoming contracts consistent, safe, reviewable and documentation-first. The schemas must describe command intent, command planning, Codex handoffs and release readiness without introducing execution behavior.

## 2. Scope

These conventions apply to the planned Phase 7 command-layer contracts:

- `shared/contracts/command/action-plan.schema.json`
- `shared/contracts/command/command-classification.schema.json`
- `shared/contracts/command/codex-prompt.schema.json`
- `shared/contracts/command/release-checklist.schema.json`

The contracts should align with the existing Phase 7 Studio Command & Automation Layer design and preserve the non-executing command boundary.

## 3. JSON Schema Conventions

Future schema files should follow these conventions:

- `$schema`: use the same JSON Schema draft across all Phase 7 command contracts. The draft should be selected once and kept stable for the full command contract set.
- `$id`: use a stable, repository-scoped identifier that maps predictably to the contract path. The identifier must not depend on local machine paths.
- `title`: use a concise human-readable contract name. Titles should be stable and not include implementation details.
- `description`: explain what the contract validates, what it does not do and which Phase 7 boundary it supports.
- `type`: top-level schemas should use `object` unless a narrower structure is explicitly justified.
- `required`: mark safety-critical and identity fields as required. Optional fields should remain optional only when the contract is still valid without them.
- `additionalProperties`: default to `false` for top-level objects and safety-sensitive nested objects. Allow unknown fields only where explicitly documented and reviewable.
- `version`: include a required contract version field so producers and validators can detect incompatible changes.
- `status` or lifecycle field: include a stable lifecycle indicator where useful, such as `draft`, `reviewed`, `approved`, `deprecated` or `blocked`.
- Stable enum naming: enum names and values must be stable, boring, documented and consistent. JSON schema wire values may use lowercase words or lowercase snake case when explicitly defined by the contract, such as `low`, `requires_approval` or `blocked`. Uppercase snake case labels such as `SAFE_READ`, `REQUIRES_APPROVAL` and `BLOCKED` are design or legacy classification labels, not a mandatory wire-format convention. Each schema must keep one consistent enum casing style per field.
- Predictable object nesting: keep nested objects shallow, named by purpose and consistent across contracts. Avoid polymorphic shapes unless validation clarity requires them.
- Safe string constraints: apply `minLength`, `maxLength`, `pattern` or `format` where they reduce ambiguity, unsafe input, oversized payloads or invalid identifiers.
- Deterministic validation expectations: validation results must not depend on runtime state, provider availability, environment variables, current time or dashboard state.

## 4. Safety-First Contract Fields

Future schemas should reuse common safety fields where relevant:

- `riskLevel`: normalized risk level for the command intent, plan, handoff or release readiness item.
- `executionClass`: normalized execution boundary classification, aligned with the Phase 7 command classification model.
- `requiresHumanApproval`: explicit boolean indicating whether human approval is required before any downstream action.
- `allowedActions`: explicit list of actions the contract permits within the documented boundary.
- `forbiddenActions`: explicit list of actions the contract prohibits.
- `blockedStates`: explicit list of states that prevent the command intent, plan, handoff or release checklist from advancing.
- `safetyNotes`: short review notes explaining relevant safety constraints and approval context.
- `nonExecutableMetadata`: metadata that helps review, traceability or routing, but must not be interpreted as executable instructions.

Safety fields should be boring, explicit and machine-readable. They should favor clear blocking states over implicit permission.

## 5. Execution Boundary

The Phase 7 command-layer schemas describe and validate command intent, action plans, Codex handoffs and release readiness.

They must not:

- execute commands
- call providers
- mutate runtime state
- trigger deployments
- replace human approval
- authorize Git operations
- prune runtime or dashboard history
- duplicate runtime, dashboard or provider logic

A valid contract instance is not approval to execute. It is only structured evidence for review.

## 6. Validation Expectations

Later validation should follow these expectations:

- Schema files must be machine-readable JSON Schema files.
- Invalid unknown fields should fail validation unless a schema explicitly allows them.
- High-risk execution classes must require approval fields and clear blocked-state handling.
- Release checklists must include documentation coverage, safety review, rollback notes and test expectations.
- Validation should be deterministic and independent from provider calls, deployments, builds, installs or runtime console execution.
- Validation scripts may be added later, but no validation scripts are introduced by this task.

## 7. Compatibility

These conventions are compatible with existing Studio OS principles:

- documentation-first design before implementation
- schema-first contracts before services
- no direct work on `main`
- small feature branches with narrow scope
- separation between runtime, dashboard, provider and command-preparation layers
- read-only visual and dashboard layers must not duplicate command logic
- command preparation must remain separate from command execution

## 8. Non-Goals

This task does not:

- create the actual JSON schemas
- add runtime execution
- add command executor services
- add dashboard panels
- add provider integrations
- add deployment automation
- alter existing runtime reports
- touch `scripts/runtime/prune-dashboard-history.ps1`
- change generated runtime or dashboard output
- introduce build, install, deployment or provider workflows

## 9. Acceptance Criteria

This task is successful only if:

- exactly one new documentation file is added, unless the repository changelog convention requires documenting the addition
- no schema files are created
- no runtime, code or dashboard files are modified
- no provider, deployment, build or install commands are run
- `scripts/runtime/prune-dashboard-history.ps1` remains untracked and untouched
- Git status is reported at the end
- no commit or push is performed
