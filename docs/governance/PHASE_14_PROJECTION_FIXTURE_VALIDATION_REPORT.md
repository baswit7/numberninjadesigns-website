# Phase 14 Projection Fixture Validation Report

## Objective

Add read-only projection fixture validation and stale-projection detection without introducing execution capability.

## Delivered

- Added fresh and stale dashboard projection fixtures under `shared/contracts/projections/fixtures/`.
- Extended `validate-projection-contracts.ps1` to validate fixture authority, disabled boundary flags, prohibited capability patterns, and staleness consistency.
- Required both fresh and stale fixture coverage so stale detection cannot silently regress.
- Kept dashboard projections derived, adapter-produced, and non-authoritative.

## Stale-Projection Detection

Staleness is detected by comparing `generatedAt` with the latest `sourceEvidence[].observedAt`.

| Condition | Required state |
| --- | --- |
| Latest source evidence is newer than the projection | `stale` with a non-empty reason |
| Projection is generated at or after the latest source evidence | `fresh` with an empty reason |

## Boundary Verdict

Phase 14 remains non-executing and read-only by design.

| Boundary | Verdict |
| --- | --- |
| Provider calls | Not added |
| Deployment calls | Not added |
| Execution engine | Not added |
| Dashboard mutation | Not added |
| Runtime mutation | Not added |
| Secrets or credentials | Not added |
| Runtime writes from dashboard | Not added |
| Queues, workers, schedulers | Not added |
| Browser storage | Not added |
| Projection fixtures | Read-only validation evidence |

## Files

- `shared/contracts/projections/fixtures/fresh-dashboard.projection.json`
- `shared/contracts/projections/fixtures/stale-dashboard.projection.json`
- `scripts/validation/validate-projection-contracts.ps1`

## Phase 15 Recommendation

Phase 15 may add a read-only adapter contract test harness only if it remains deterministic, local, non-mutating, and free of provider, deployment, credential, scheduler, queue, worker, runtime-write, dashboard-write, and browser-storage authority.
