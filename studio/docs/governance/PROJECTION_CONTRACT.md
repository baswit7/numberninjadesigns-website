# Projection Contract

## Purpose

Phase 13 adds a contract layer for dashboard projections and no-write validation interfaces. The layer strengthens the boundary between runtime truth, adapter-derived dashboard view models, passive dashboard consumption and structural validation.

## Ownership

| Boundary | Owner | Authority |
| --- | --- | --- |
| Runtime truth | `runtime/` reports and evidence | Source of truth |
| Projection producer | `apps/studio-dashboard/dashboard-adapter.ps1` | Derived dashboard view model producer |
| Projection contracts | `shared/contracts/projections/` | Allowed shape and boundary flags |
| Validators | `scripts/validation/` | Structural inspection only |
| Dashboard UI | `apps/studio-dashboard/` | Passive visual consumer |

## Projection Rules

Projection JSON may contain source identities, source paths, status summaries, boundary summaries, staleness indicators, display labels and links back to evidence.

Projection JSON must not contain commands, script paths, network endpoints, provider invocation details, deployment payloads, approval write payloads, runtime mutation payloads, browser storage authority, credential material, queue configuration, worker configuration, scheduler configuration or executor configuration.

## Runtime Truth

Runtime evidence remains authoritative. If a projection disagrees with source runtime evidence, the projection is stale or invalid. Dashboard view models are derived read models and cannot grant execution permission.

## No-Write Validator Interface

The no-write validator interface describes structural inspection results only. It does not run providers, deploy, call APIs, mutate runtime, mutate dashboard state, edit config, execute commands or evaluate business approval rules.

Required semantics:

- `writesAllowed` is `false`.
- `runtimeMutationAllowed` is `false`.
- `dashboardMutationAllowed` is `false`.
- `providerCallsAllowed` is `false`.
- `deploymentAllowed` is `false`.
- `credentialAccessAllowed` is `false`.
- Structure inspection is allowed.
- Business-rule reimplementation is not allowed.

## Dashboard Boundary

The dashboard remains a passive visual consumer. It may render existing projection fields, sort, filter and group already-derived data. It must not infer governance decisions, run validators, start refresh orchestration, mutate runtime state or persist browser state as authority.

## Phase 14 Fixture Validation

Phase 14 validates committed projection fixtures against this contract boundary. Fixture validation is deterministic and read-only:

- Fixture JSON must keep Phase 13 projection schema semantics.
- The fixture manifest supplies deterministic `sourceEvidenceObservedAt` values.
- Staleness is evaluated by comparing projection `generatedAt` with `sourceEvidenceObservedAt`.
- Machine-readable validation reports are committed evidence and are inspected by the validator.
- The validator does not write runtime reports, refresh dashboards, call providers, deploy, access credentials, use browser storage authority or execute UI commands.
