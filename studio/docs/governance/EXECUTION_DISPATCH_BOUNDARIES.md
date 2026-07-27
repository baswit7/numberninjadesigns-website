# Execution Dispatch Boundaries

The Execution Dispatch Registry is a registry and audit layer only.

## Explicitly Forbidden

- execution engine
- dispatch engine
- provider execution
- GitHub execution
- deployment execution
- merge execution
- automatic execution
- automatic dispatch
- workers
- schedulers
- queues
- autonomous runner
- Software Factory
- secret access
- credential access
- protected branch writes
- repository settings mutation
- collaborator mutation

## Input Boundary

The registry reads only:

- `runtime/execution-review/execution-review.records.json`
- `runtime/execution-review/execution-review.report.json`

## Output Boundary

The registry writes only:

- `runtime/execution-dispatch/execution-dispatch.registry.json`
- `runtime/execution-dispatch/execution-dispatch.audit.json`
- `runtime/execution-dispatch/execution-dispatch.report.json`

Manual recovery remains external to this layer: correct upstream review evidence through its owning gate, regenerate the dispatch registry, then rerun validation.
