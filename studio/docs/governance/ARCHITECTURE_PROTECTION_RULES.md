# Architecture Protection Rules

## Context

Studio OS protects a sacred runtime pipeline:

Runtime Console -> runtime reports -> Dashboard Adapter -> dashboard view models -> Historical Snapshot Layer -> Operational Intelligence Layer -> Visual Dashboard.

Phase 5.1 hardens this pipeline. It does not add providers, deployments, orchestration or new intelligence domains.

## Protected Boundaries

| Boundary | Owner | Rule |
| --- | --- | --- |
| Runtime Console | `scripts/runtime/studio-console.ps1` | All runtime state refreshes must enter through console commands or console-owned scripts. |
| Dashboard Adapter | `apps/studio-dashboard/dashboard-adapter.ps1` | Dashboard JSON must be translated from runtime reports and config only. |
| Dashboard UI | `apps/studio-dashboard` | Read-only rendering only. No writes, remote calls, credentials or execution. |
| Operational Intelligence | `services/operational-intelligence` | Deterministic judgment layer only. No provider calls, deployment calls or runtime mutation beyond generated dashboard views. |
| Historical Snapshots | `scripts/runtime/export-dashboard-snapshot.ps1` | Snapshot history is append-only in the baseline. Future pruning requires guarded maintenance review and must stay under `runtime/history`. |

## Forbidden Actions

The following actions are architecture conflicts:

- bypass Runtime Console for runtime report generation
- bypass Dashboard Adapter for dashboard view generation
- duplicate health engines
- duplicate scoring engines
- duplicate trend engines
- duplicate risk engines
- duplicate governance engines
- direct provider dependencies from Operational Intelligence
- direct deployment execution from Operational Intelligence or the dashboard
- alternative state pipelines outside `runtime/reports`, `runtime/dashboard` and `runtime/history`
- remote requests, OAuth, credential creation or local credential storage in dashboard/intelligence code

## Runtime Enforcement

Architecture validation must stop on protected-boundary violations and return:

`ARCHITECTURE CONFLICT DETECTED`

The validation script must inspect protected implementation paths for:

- forbidden command use such as `Invoke-RestMethod`, `Invoke-WebRequest`, `Start-Process`, `git push`, `gh pr`, deploy commands or token writes
- duplicate intelligence engine directories outside the approved Phase 5 locations
- missing trust-layer artifacts required by Phase 5.1
- invalid or missing intelligence contracts

## Approved Extension Points

- Add new JSON contracts under `shared/contracts/intelligence` before implementation.
- Add read-only dashboard view models under `runtime/dashboard`.
- Add governance documents under `docs/governance` and ADRs under `docs/adr`.
- Add deterministic helper functions to `services/operational-intelligence/OperationalIntelligence.psm1`.

## Conflict Response

When a future implementation violates a protected boundary, validation must fail loudly with:

`ARCHITECTURE CONFLICT DETECTED`

The implementation must not silently continue, auto-correct or bypass the rule.
