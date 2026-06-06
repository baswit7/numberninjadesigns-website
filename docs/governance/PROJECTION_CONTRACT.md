# Projection Contract

## Purpose

Phase 13 creates the Studio OS projection contract layer. A projection is a derived, read-only artifact that lets a future dashboard display governance, readiness, validation, boundary, and health evidence without becoming a runtime participant.

## Ownership Model

| Boundary | Owner | Authority |
| --- | --- | --- |
| Runtime truth | `runtime/` evidence files | Source of truth |
| Projection production | `services/dashboard-adapter` | Derived output only |
| Projection contracts | `shared/contracts/projections/` | Allowed shape only |
| Validators | `scripts/validation/` | Structural and boundary inspection |
| Dashboard | Future UI | Passive visual consumer only |

## Projection Rules

Allowed projection content:

- Source identities and paths.
- Validation result summaries.
- Boundary status summaries.
- Staleness metadata.
- Display labels.
- Links back to source evidence.

Forbidden projection content:

- Commands or script paths.
- External endpoints.
- Provider invocation details.
- Deployment payloads.
- Approval write payloads.
- Credential material.
- Queue, worker, scheduler, executor, or agent configuration.
- Dashboard write instructions.

## No-Write Validator Interface

The no-write validator interface is diagnostic only. It inspects contracts, structure, and boundaries without modifying runtime truth or dashboard state.

Required semantics:

- `writesAllowed` is always `false`.
- `runtimeMutationAllowed` is always `false`.
- `projectionMutationAllowed` is always `false`.
- `dashboardMutationAllowed` is always `false`.
- `returnsInMemoryOnly` is always `true`.
- Business rules are not reimplemented in dashboard code.
- Validators inspect structure and boundaries only.

## Adapter Boundary

The dashboard adapter is the only future producer of dashboard projection JSON. A dashboard may read projection JSON but may not generate, refresh, patch, repair, or submit it.

## Authority Boundary

A projection never becomes authority. If a projection disagrees with runtime evidence, runtime evidence wins and the projection must be treated as stale or invalid.
