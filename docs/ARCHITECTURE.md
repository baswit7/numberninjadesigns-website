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

