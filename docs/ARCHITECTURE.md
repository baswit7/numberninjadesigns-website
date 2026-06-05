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
