# Execution Control Dashboard Boundaries

## Allowed

The V2.9 dashboard projection may:

- read existing execution governance reports
- count request states
- count approval states
- count preflight states
- count review states
- count dispatch states
- count audit states
- display manual evidence status
- display unknown states
- write `runtime/dashboard/execution-control.view.json`

## Forbidden

The dashboard must not add or perform:

- execution engine
- dispatch engine
- provider execution
- GitHub execution
- deployment execution
- approval mutation
- dispatch mutation
- runtime mutation
- queues
- workers
- schedulers
- background jobs
- agent execution
- credential access
- secret access
- branch writes
- repository settings mutation
- collaborator mutation
- localStorage authority
- sessionStorage authority
- action endpoints
- action controls

## Write Boundary

The only V2.9 runtime write target is:

- `runtime/dashboard/execution-control.view.json`

The projection must not mutate:

- execution request packages
- approval records
- preflight decisions
- review records
- dispatch registry entries
- audit reports
- contracts
- configuration
- branches
- repositories
- credentials
- secrets

## Control Boundary

The dashboard renders state. It does not control state.

It may show that something is pending, blocked, unknown or denied. It must not provide a way to approve, reject, dispatch, execute or rewrite the underlying governance chain.

## Authority Boundary

The dashboard owns no truth.

Truth remains in the source layers:

- Execution Request owns request packages.
- Execution Approval owns approval records.
- Execution Preflight owns preflight decisions.
- Execution Review owns manual review records.
- Execution Dispatch owns dispatch eligibility.
- Execution Audit owns audit reports.

The dashboard is a projection only.
