# Dashboard Adapter

## Role

`services/dashboard-adapter` is the only allowed producer boundary for future Studio OS dashboard projection JSON.

Phase 13 defines the adapter boundary only. It does not add an adapter implementation, dashboard UI, refresh controller, runtime writer, provider integration, deployment integration, queue, worker, scheduler, executor, agent, or background runner.

## Production Boundary

The adapter may derive display-safe projection data from existing governance documents, runtime validation reports, readiness evidence, and health outputs. Runtime files remain the source of truth. Projection output is read-only and cannot approve, execute, deploy, refresh, repair, or mutate anything.

## Consumer Boundary

A dashboard may consume projection JSON only as passive visual state. It may format, filter, group, sort, and render fields already present in the projection contract. It must not infer validation rules, write runtime files, mutate projections, or start validation work.

## Contract

- Projection schema: `shared/contracts/projections/dashboard-projection.schema.json`
- No-write validator interface: `shared/contracts/projections/no-write-validator.interface.schema.json`
- Contract manifest: `shared/contracts/projections/projection-contract.manifest.json`

## Validation

`scripts/validation/validate-projection-contracts.ps1` checks the projection contracts and adapter boundary for structural safety. It verifies strict schema objects, disabled mutation flags, adapter-only producer ownership, and absence of forbidden execution, write, deployment, provider, credential, queue, worker, scheduler, and storage capabilities.
