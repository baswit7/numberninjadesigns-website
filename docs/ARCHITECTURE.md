# Architecture

## Current Repository Role

This repository hosts static NumberNinjaTees verification pages and Studio OS governance documentation.

## Phase 9 Addition

Phase 9 introduces a non-executing Execution Governance Layer:

- `services/execution-governance/`
- `shared/contracts/execution/`
- `runtime/execution/`
- `scripts/validation/`
- `scripts/health/`

The layer evaluates future action readiness through contracts and validation scripts only. It does not include execution dispatch, provider integrations, deployment automation, queues, schedulers, or background workers.

## Phase 10 Addition

Phase 10 introduces a non-executing Execution Readiness Layer:

- `services/execution-readiness/`
- `shared/contracts/readiness/`
- `runtime/readiness/`
- readiness validation scripts under `scripts/validation/`

The layer validates future execution plans, steps, dependency checks, preflight checks, approval-chain completeness, rollback coverage, idempotency coverage, and readiness decisions before any execution plane exists. A readiness decision does not grant execution permission and does not bypass Phase 9 governance.

## Phase 12 Design Addition

Phase 12 introduces dashboard/runtime boundary design documentation only:

- `docs/governance/DASHBOARD_RUNTIME_BOUNDARY.md`
- `docs/governance/PHASE_12_DASHBOARD_RUNTIME_BOUNDARY_DESIGN.md`
- `docs/governance/PHASE_READINESS_MATRIX.md`

The design separates read-only dashboard projection from composite refresh orchestration. It defines future no-write validation mode, prohibits dashboard-driven runtime mutation, and keeps validator and business-rule ownership outside dashboard code. Phase 12 does not add dashboard UI, execution dispatch, provider integrations, deployment automation, queues, schedulers, executors, agents, workers, or background runners.

## Phase 13 Contract Addition

Phase 13 introduces the Projection Contract and No-Write Validator Interface layer:

- `shared/contracts/projections/`
- `services/dashboard-adapter/`
- `docs/governance/PROJECTION_CONTRACT.md`
- `docs/governance/PHASE_13_PROJECTION_CONTRACT_REPORT.md`
- `scripts/validation/validate-projection-contracts.ps1`

The layer defines allowed read-only projection shape, adapter-only projection production, passive dashboard consumption, and structural no-write validation. Runtime evidence remains the source of truth. The projection contract layer does not add dashboard UI, dashboard writes, runtime mutation, execution dispatch, provider integrations, deployment automation, queues, schedulers, executors, agents, workers, background runners, browser storage, secrets, or credential handling.
