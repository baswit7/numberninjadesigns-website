# Execution Audit Boundaries

## Allowed

The V2.8 audit layer may:

- read existing execution request runtime reports
- read existing approval runtime reports
- read existing preflight runtime reports
- read existing manual review runtime reports
- read existing dispatch registry runtime reports
- generate audit reports under `runtime/execution-audit/`
- generate manual evidence gate proof
- generate boundary proof
- validate that no uncontrolled execution path exists

## Forbidden

The V2.8 audit layer must not add or perform:

- execution engine
- dispatch engine
- provider execution
- GitHub execution
- deployment execution
- automatic approval
- automatic dispatch
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

## Write Boundary

The only runtime write target is:

- `runtime/execution-audit/`

The layer must not mutate:

- approval records
- execution request packages
- preflight decisions
- review records
- dispatch registry entries
- branches
- repository settings
- credentials
- secrets
- deployments

## Evidence Boundary

Evidence is referenced, not redefined.

The audit layer may report:

- evidence present
- manual evidence present
- manual evidence verified
- authority source
- review source
- decision trace

It must not fabricate upstream approval, review or dispatch truth.

## Dispatch Boundary

`DISPATCH_ELIGIBLE` can only be reported as already present in the dispatch registry and must be blocked by the manual evidence gate unless verified manual evidence exists.

V2.8 does not dispatch. It does not prepare a dispatcher. It does not create an execution consumer.
