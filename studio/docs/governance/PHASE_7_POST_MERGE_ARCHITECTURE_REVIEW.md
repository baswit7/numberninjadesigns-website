# Phase 7 Post-Merge Architecture Review

## Executive Summary

This review audits Studio OS after the Phase 7 command preparation layer was merged.

Phase 7 is architecturally complete as a non-executing command preparation layer. It delivered command schemas, safe examples, input examples, a dependency-free validator, validator integration and four preparation generators without adding an executor, automation runner, provider calls, runtime mutation, deployment logic or dashboard mutation.

The recommendation for starting Phase 8 is HOLD. The main blocker is not Phase 7 delivery quality; it is broader architecture readiness. The current architecture validator fails because required architecture directories are missing, and several top-level status documents still describe Phase 7 as planned or not implemented. These should be resolved before Phase 8 begins so the next phase starts from a coherent baseline.

## Review Scope

Reviewed phases:

- Phase 1 Foundation
- Phase 2 Runtime Foundation
- Phase 3 Runtime Control Layer
- Phase 4 Visual Dashboard
- Phase 5 Operational Intelligence
- Phase 5.1 Intelligence Hardening
- Phase 6 Governance & Release Control
- Phase 7 Command Preparation Layer

Reviewed areas:

- architecture consistency
- layer separation
- dependency boundaries
- contract consistency
- runtime ownership
- dashboard ownership
- governance ownership
- command ownership
- security boundaries
- future execution readiness

## Validation Evidence

Commands run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\validation\validate-command-contracts.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\validation\validate-config.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\validation\validate-architecture.ps1"
```

Observed results:

```text
Phase 7 command contract examples passed deterministic invariant checks.
Checked 4 schemas and 4 examples.
```

```text
Config validation passed.
```

```text
Architecture validation failed with 2 error(s):
  - Required architecture directory missing: docs/providers
  - Required architecture directory missing: docs/workflows
```

Known unrelated workspace state:

```text
?? scripts/runtime/prune-dashboard-history.ps1
```

The untracked prune script remains unrelated and untouched.

## Architecture Summary By Phase

| Phase | Architecture State | Notes |
| --- | --- | --- |
| Phase 1 Foundation | Mostly sound | Repo structure, config, agents, contracts and baseline docs exist, but required docs in config drift from actual files. |
| Phase 2 Runtime Foundation | Functional but write-heavy | Runtime console owns local reports and runtime index. Validation flow overlaps with report generation. |
| Phase 3 Runtime Control Layer | Functional | Console commands are centralized, but some commands trigger downstream generators and runtime writes. |
| Phase 4 Visual Dashboard | Mostly separated | Dashboard is read-only in the browser, but adapter writes view models and invokes intelligence/governance generation through console flow. |
| Phase 5 Operational Intelligence | Functional | Intelligence generation is isolated under services and writes local dashboard/report outputs. |
| Phase 5.1 Intelligence Hardening | Strong boundary | Architecture validator protects intelligence/governance files and scans for provider/deployment actions. |
| Phase 6 Governance & Release Control | Functional | Governance layer is advisory and contract-backed, but full schema validation remains limited. |
| Phase 7 Command Preparation Layer | Complete | Non-executing contracts, examples, validator and generators are present and aligned. |

## Findings

### Finding A1 - Architecture validator fails on missing architecture directories

- Severity: HIGH
- Area: architecture consistency
- Evidence: `scripts/validation/validate-architecture.ps1` reports missing `docs/providers` and `docs/workflows`.
- Affected files:
  - `scripts/validation/validate-architecture.ps1`
  - `docs/providers`
  - `docs/workflows`
- Impact: Phase 8 would start from a baseline where the canonical architecture validator fails. This weakens release confidence and makes future validation output noisy.
- Recommended fix: Create the missing architecture directories with scoped README files or update the validator if those directories are no longer required.

### Finding A2 - Governance required docs drift from repository contents

- Severity: HIGH
- Area: governance ownership
- Evidence: `config/studio.config.json` lists `docs/WORKFLOW.md` and `docs/DEBUGGING.md` under `governance.requiredDocs`, but both files are absent.
- Affected files:
  - `config/studio.config.json`
  - `docs/WORKFLOW.md`
  - `docs/DEBUGGING.md`
- Impact: Documentation health can fail or become inconsistent depending on which validation path is used. Phase 8 would inherit unclear governance documentation requirements.
- Recommended fix: Add the required docs or revise `governance.requiredDocs` to match the current documentation model.

### Finding A3 - README status is stale after Phase 7 closure

- Severity: MEDIUM
- Area: architecture consistency
- Evidence: `README.md` still says Phase 7 is design-first and started, while `docs/governance/PHASE_7_COMPLETION_REPORT.md` says Phase 7 is closed with GO.
- Affected files:
  - `README.md`
  - `docs/governance/PHASE_7_COMPLETION_REPORT.md`
- Impact: Operators can get conflicting signals about whether Phase 7 is complete and whether Phase 8 may be planned.
- Recommended fix: Update README status to say Phase 7 is closed and Phase 8 is not started.

### Finding A4 - Architecture docs still describe Phase 7 as planned

- Severity: MEDIUM
- Area: architecture consistency
- Evidence: `docs/ARCHITECTURE.md` describes Phase 7 as planned, while Phase 7 has been completed.
- Affected files:
  - `docs/ARCHITECTURE.md`
  - `docs/governance/PHASE_7_COMPLETION_REPORT.md`
- Impact: The architecture overview no longer matches the implemented command preparation layer.
- Recommended fix: Update architecture overview language to distinguish delivered non-executing preparation from future execution or workflow handoff.

### Finding A5 - Runtime validation path writes runtime state

- Severity: MEDIUM
- Area: runtime ownership
- Evidence: `scripts/validation/validate-studio-os.ps1` calls `scripts/health/studio-health.ps1`; `studio-health.ps1` writes the health report through `Write-StudioJson`.
- Affected files:
  - `scripts/validation/validate-studio-os.ps1`
  - `scripts/health/studio-health.ps1`
  - `scripts/lib/StudioRuntime.psm1`
- Impact: A command named validation has side effects. This is acceptable for the current local runtime model, but it is not a pure validation path and can surprise future CI or Phase 8 workflows.
- Recommended fix: Split pure validation from report-producing health generation or add an explicit `-NoWrite` mode before using it in automated gates.

### Finding A6 - Runtime console contract report does not explicitly include command schemas

- Severity: MEDIUM
- Area: contract consistency
- Evidence: `Get-ContractStatusReport` in `scripts/runtime/studio-console.ps1` lists agents, events, workflow, intelligence, governance and shared schemas, but not `shared/contracts/command/*.schema.json`.
- Affected files:
  - `scripts/runtime/studio-console.ps1`
  - `shared/contracts/command/*.schema.json`
  - `scripts/validation/validate-command-contracts.ps1`
- Impact: Command contracts are validated by the Phase 7 validator, but the runtime console's contract status can under-report command contract health.
- Recommended fix: Add command contract status to the console contract report or explicitly document that command contracts are owned only by the command validator.

### Finding A7 - Dashboard adapter invokes intelligence and governance generation

- Severity: MEDIUM
- Area: dashboard ownership
- Evidence: `Invoke-DashboardAdapter` in `scripts/runtime/studio-console.ps1` runs the dashboard adapter, then calls `Invoke-OperationalIntelligence` and `Invoke-Governance`.
- Affected files:
  - `scripts/runtime/studio-console.ps1`
  - `apps/studio-dashboard/dashboard-adapter.ps1`
  - `services/operational-intelligence/run-operational-intelligence.ps1`
  - `services/governance/run-governance.ps1`
- Impact: The dashboard command is more than read-only view-model projection. It refreshes upstream intelligence and governance outputs, which blurs ownership boundaries.
- Recommended fix: Split `dashboard` into a projection-only command and an explicit refresh pipeline, or document the command as a composite generation flow.

### Finding A8 - Command generator safety scanning is duplicated

- Severity: LOW
- Area: command ownership
- Evidence: all four scripts under `scripts/command/generate-*.ps1` duplicate string traversal, secret detection, local path detection and unsafe intent detection logic.
- Affected files:
  - `scripts/command/generate-command-classification.ps1`
  - `scripts/command/generate-codex-prompt.ps1`
  - `scripts/command/generate-action-plan.ps1`
  - `scripts/command/generate-release-checklist.ps1`
- Impact: Future safety-rule updates may drift across generators.
- Recommended fix: Move shared read-only safety helpers into a small command-preparation utility module after a dedicated refactor review.

### Finding A9 - Command contract validator is deterministic but not full JSON Schema validation

- Severity: MEDIUM
- Area: contract consistency
- Evidence: `scripts/validation/validate-command-contracts.ps1` states it is not a complete JSON Schema draft 2020-12 engine.
- Affected files:
  - `scripts/validation/validate-command-contracts.ps1`
  - `shared/contracts/command/*.schema.json`
- Impact: Nested schema violations could pass deterministic invariant checks even when they would fail full JSON Schema validation.
- Recommended fix: Add a governed full-schema validation strategy before using command artifacts as release or execution gates.

### Finding A10 - Untracked prune script remains present in workspace

- Severity: LOW
- Area: security boundaries
- Evidence: `git status --short --branch` reports `?? scripts/runtime/prune-dashboard-history.ps1`.
- Affected files:
  - `scripts/runtime/prune-dashboard-history.ps1`
- Impact: The file is unrelated and untouched, but its persistent presence can confuse audits and creates an attractive path for accidental staging.
- Recommended fix: Decide separately whether to remove, ignore, or formalize the script through a guarded maintenance review. Do not include it in this audit.

### Finding A11 - Future execution readiness is intentionally incomplete

- Severity: MEDIUM
- Area: future execution readiness
- Evidence: Phase 7 completion report lists future execution-layer design, approval audit trail and workflow handoff design as remaining future work.
- Affected files:
  - `docs/governance/PHASE_7_COMPLETION_REPORT.md`
  - `docs/governance/PHASE_7_COMMAND_PREPARATION_DESIGN.md`
- Impact: Phase 8 must not assume execution authority exists. A future execution phase would need approval state, audit trail, idempotency, rollback and provider boundary design.
- Recommended fix: Treat Phase 8 as planning/design unless these execution-readiness controls are explicitly designed first.

## Layer Ownership Assessment

| Layer | Owner | Current State | Risk |
| --- | --- | --- | --- |
| Foundation | repo docs/config/contracts | Mostly consistent | Missing required docs/directories |
| Runtime | `scripts/runtime`, `scripts/lib`, `runtime/` output | Functional | Validation/reporting side effects need clearer naming |
| Dashboard | `apps/studio-dashboard`, `runtime/dashboard` output | Functional | Console dashboard command refreshes upstream services |
| Intelligence | `services/operational-intelligence` | Functional | No direct provider calls observed |
| Governance | `services/governance`, `shared/contracts/governance` | Functional | Advisory boundaries preserved |
| Command | `scripts/command`, `shared/contracts/command` | Complete for preparation | Safety helper duplication |

## Security Boundary Assessment

No direct provider calls, deployment commands, Git pushes, automation runners or command executors were found in the Phase 7 command preparation scripts. The execution-related strings in command scripts and validator are denylist patterns used to reject unsafe inputs.

The strongest security boundary is the explicit non-execution posture in Phase 7. The weakest current security-adjacent issue is that validation, runtime health and dashboard refresh commands can write local runtime output, which must be understood before any future automation uses them.

## Phase 8 Recommendation

Final recommendation: HOLD.

Do not start Phase 8 until the HIGH findings are addressed:

1. Fix the failing architecture validator by restoring or revising required architecture directories.
2. Resolve governance required-doc drift for `docs/WORKFLOW.md` and `docs/DEBUGGING.md`.

After those are fixed, Phase 8 may start only if its scope remains explicit about whether it is design-only, read-only visualization, approval workflow, or execution-layer design. No execution work should begin without a separate approval and audit model.
