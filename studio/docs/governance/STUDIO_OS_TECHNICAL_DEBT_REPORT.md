# Studio OS Technical Debt Report

## Executive Summary

Studio OS has a coherent phased architecture through Phase 8. The Phase 7 post-merge audit identified technical debt that was addressed or reclassified before Phase 8 was merged.

The main resolved debt was governance and validation drift: required architecture paths, required docs and public phase status were out of sync with the current repository model.

Overall debt posture after Phase 8 merge: GO with tracked residual risks.

## Debt Register

### TD-001 - Architecture validation fails after Phase 7

- Severity: HIGH
- Evidence: `scripts/validation/validate-architecture.ps1` reports missing `docs/providers` and `docs/workflows`.
- Affected files:
  - `scripts/validation/validate-architecture.ps1`
  - `docs/providers`
  - `docs/workflows`
- Impact: Resolved. The canonical architecture validator passes on the Phase 8 baseline.
- Recommended fix: Keep architecture validation requirements mapped to current canonical assets.

### TD-002 - Required governance docs are missing

- Severity: HIGH
- Evidence: `config/studio.config.json` requires `docs/WORKFLOW.md` and `docs/DEBUGGING.md`; both are absent.
- Affected files:
  - `config/studio.config.json`
  - `docs/WORKFLOW.md`
  - `docs/DEBUGGING.md`
- Impact: Resolved. Required governance docs now match current repository documentation.
- Recommended fix: Keep `governance.requiredDocs` current during phase closeout.

### TD-003 - README phase status is stale

- Severity: MEDIUM
- Evidence: `README.md` says Phase 7 is design-first and started, while the completion report says Phase 7 is closed.
- Affected files:
  - `README.md`
  - `docs/governance/PHASE_7_COMPLETION_REPORT.md`
- Impact: Resolved for Phase 8 baseline.
- Recommended fix: Update README current status during each phase closeout.

### TD-004 - Architecture overview still treats Phase 7 as planned

- Severity: MEDIUM
- Evidence: `docs/ARCHITECTURE.md` describes Phase 7 as planned.
- Affected files:
  - `docs/ARCHITECTURE.md`
- Impact: Resolved for Phase 8 baseline.
- Recommended fix: Keep `docs/ARCHITECTURE.md` aligned with delivered phase boundaries.

### TD-005 - Validation pipeline has runtime write side effects

- Severity: MEDIUM
- Evidence: `scripts/validation/validate-studio-os.ps1` calls `scripts/health/studio-health.ps1`, which writes a runtime health report.
- Affected files:
  - `scripts/validation/validate-studio-os.ps1`
  - `scripts/health/studio-health.ps1`
  - `scripts/lib/StudioRuntime.psm1`
- Impact: Validation is not purely read-only. This is manageable locally, but risky for future CI or automation without explicit write semantics.
- Recommended fix: Split read-only validation from report generation or add a no-write mode.

### TD-006 - Runtime console contract status omits command schemas

- Severity: MEDIUM
- Evidence: `Get-ContractStatusReport` in `scripts/runtime/studio-console.ps1` does not list `shared/contracts/command/*.schema.json`.
- Affected files:
  - `scripts/runtime/studio-console.ps1`
  - `shared/contracts/command/*.schema.json`
  - `scripts/validation/validate-command-contracts.ps1`
- Impact: `studio-console.ps1 -Command contracts` may under-report command contract readiness.
- Recommended fix: Either add command schema checks to contract status or document the command validator as the authoritative command-contract check.

### TD-007 - Dashboard command refreshes upstream layers

- Severity: MEDIUM
- Evidence: `Invoke-DashboardAdapter` in `scripts/runtime/studio-console.ps1` calls operational intelligence and governance generators after dashboard adapter execution.
- Affected files:
  - `scripts/runtime/studio-console.ps1`
  - `apps/studio-dashboard/dashboard-adapter.ps1`
  - `services/operational-intelligence/run-operational-intelligence.ps1`
  - `services/governance/run-governance.ps1`
- Impact: Dashboard ownership is blurred because a dashboard command refreshes upstream runtime/governance outputs.
- Recommended fix: Separate dashboard projection from upstream refresh orchestration or rename/document the command as a composite refresh.

### TD-008 - Command generator safety logic is duplicated

- Severity: LOW
- Evidence: each `scripts/command/generate-*.ps1` script defines its own recursive string scanner and unsafe-pattern checks.
- Affected files:
  - `scripts/command/generate-command-classification.ps1`
  - `scripts/command/generate-codex-prompt.ps1`
  - `scripts/command/generate-action-plan.ps1`
  - `scripts/command/generate-release-checklist.ps1`
- Impact: Future safety logic changes could drift across generators.
- Recommended fix: Extract shared safety helpers after Phase 7 close, without changing command behavior.

### TD-009 - Command validation is not full JSON Schema validation

- Severity: MEDIUM
- Evidence: `scripts/validation/validate-command-contracts.ps1` explicitly states it is not a complete JSON Schema draft 2020-12 engine.
- Affected files:
  - `scripts/validation/validate-command-contracts.ps1`
  - `shared/contracts/command/*.schema.json`
- Impact: Some nested schema violations may not be caught.
- Recommended fix: Add an approved full-schema validation strategy before command artifacts become release-critical or execution-adjacent.

### TD-010 - Persistent untracked prune script

- Severity: LOW
- Evidence: Git status reports `?? scripts/runtime/prune-dashboard-history.ps1`.
- Affected files:
  - `scripts/runtime/prune-dashboard-history.ps1`
- Impact: Repeated audit noise and risk of accidental inclusion.
- Recommended fix: Resolve separately through a guarded maintenance review. Do not treat it as part of Phase 7.

### TD-011 - Future execution controls are not designed yet

- Severity: MEDIUM
- Evidence: Phase 7 completion report lists future execution-layer design, approval audit trail and workflow handoff design as future work.
- Affected files:
  - `docs/governance/PHASE_7_COMPLETION_REPORT.md`
  - `docs/governance/PHASE_7_COMMAND_PREPARATION_DESIGN.md`
- Impact: Any Phase 8 execution scope would be premature without authority, approval, idempotency and audit models.
- Recommended fix: Keep Phase 8 non-executing unless a separate execution-readiness design is approved first.

## Debt By Architecture Area

| Area | Debt Items | Phase 8 Risk |
| --- | --- | --- |
| Architecture consistency | TD-001, TD-003, TD-004 | High |
| Governance ownership | TD-002 | High |
| Runtime ownership | TD-005 | Medium |
| Dashboard ownership | TD-007 | Medium |
| Contract consistency | TD-006, TD-009 | Medium |
| Command ownership | TD-008, TD-011 | Medium |
| Security boundary | TD-010, TD-011 | Medium |

## Recommended Fix Order

1. Restore or revise required architecture directories.
2. Resolve required governance docs.
3. Update README and architecture status for Phase 7 completion.
4. Decide whether contract status should include command schemas.
5. Split read-only validation from report-writing validation.
6. Clarify dashboard refresh vs projection ownership.
7. Extract shared command-generator safety helpers.
8. Design full schema validation strategy.
9. Resolve the unrelated prune script separately.

## Final Recommendation

GO for Phase 8 as a completed coordination-only phase.

Studio OS should not start Phase 9 or execution-layer work until a separate safety model, approval audit trail, idempotency strategy, rollback model and provider boundary design are approved.
