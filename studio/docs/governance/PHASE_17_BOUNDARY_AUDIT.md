# Phase 17 Boundary Audit

## Scope

This audit covers Authority Dashboard Projection Integration.

## Boundary Findings

- Constitution remains the source of truth for constitutional boundaries.
- Authority Registry remains the source of truth for ownership.
- Authority Read Model remains the source of authority intelligence.
- Dashboard Adapter consumes only `runtime/authority/*.json` authority inputs.
- Dashboard Adapter writes only `runtime/dashboard/*.json` dashboard projections.
- Dashboard output owns no authority.
- Dashboard UI renders authority projection cards only.
- Dashboard UI cannot edit authority data.
- Dashboard UI cannot approve authority decisions.
- Dashboard UI cannot trigger services.

## Explicit Non-Capabilities

Phase 17 introduced no:

- execution capability
- provider invocation
- provider activation
- deployment capability
- workflow execution
- command execution
- runtime mutation
- approval automation
- scheduler
- queue
- worker
- orchestration
- background service
- browser authority storage
- browser authority persistence
- credential access
- secret access
- GitHub write automation
- dashboard approval button
- dashboard authority editing

## Source Integrity

Phase 17 does not modify or replace:

- Phase 15 authority contracts
- Phase 16 read-model contracts
- projection contracts
- readiness contracts
- execution governance contracts

The dashboard projection depends on them only through committed runtime report files.

## Residual Risks

- Operators could overread dashboard visibility as permission. The dashboard cards therefore expose `canExecute=false` and `canMutate=false`.
- Missing authority reports could hide visibility. The adapter uses safe unknown state and the validator requires the committed projection.
- Future UI controls could weaken the boundary. Phase 17 intentionally adds no authority actions or edit controls.
