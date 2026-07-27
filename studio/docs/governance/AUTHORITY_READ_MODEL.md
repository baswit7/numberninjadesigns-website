# Authority Read Model

## Purpose

The Authority Read Model is the Phase 16 read-only projection layer over the Phase 15 Constitution & Authority Control Plane.

It allows Studio OS to answer authority questions from existing contracts:

- Who owns this authority?
- Which layer may consume it?
- Which layer is forbidden from consuming it?
- Which authorities are denied?
- Which decision is attached to this authority?
- Which constitutional rule governs this authority?
- Which contracts are used to answer this authority question?

## Architectural Position

```text
Constitution
Authority Registry
Authority Read Model
Read-only Queries
Reports / Dashboard Consumption
```

The read model is not a policy engine, execution engine, provider connector, deployment controller, scheduler, queue, worker or approval system.

## Sources Of Truth

- Constitution: `shared/contracts/authority/constitution.rules.json`
- Authority ownership: `shared/contracts/authority/authority-registry.json`
- Classification model: `shared/contracts/authority/authority-classifications.json`
- Decision model: `shared/contracts/authority/authority-decisions.json`

Phase 16 reads these contracts and generates derived reports only.

## Outputs

- `runtime/authority/authority-read-model.report.json`
- `runtime/authority/authority-query-responses.report.json`
- `runtime/authority/authority-read-model-validation.report.json`

These outputs are derived read projections. They own no authority and cannot grant permission.

## Supported Query Shapes

- `owners-by-authority`
- `consumers-by-authority`
- `denied-authorities`
- `decisions-by-authority`
- `rules-by-authority`
- `contracts-by-authority`

## Boundary

Phase 16 explicitly does not add:

- execution capability
- provider calls
- provider activation
- deployment capability
- credential access
- secret access
- approval automation
- workflow execution
- runtime mutation
- browser authority storage
- GitHub write automation
