# Execution Review Boundaries

The Manual Execution Review Gate is a review and audit layer only.

## Explicitly Forbidden

- execution engine
- execution dispatch
- automatic execution
- live GitHub execution
- provider execution
- deployment execution
- merge execution
- approval mutation
- request package mutation
- preflight mutation
- auto approval
- auto review approval
- auto merge
- workers
- schedulers
- queues
- autonomous runner
- Software Factory
- secret or credential access
- protected branch writes
- repository settings mutation
- collaborator mutation
- deployment mutation

## Input Boundary

The gate reads only:

- `runtime/execution-preflight/execution-preflight.decisions.json`
- `runtime/execution-preflight/execution-preflight.report.json`

## Output Boundary

The gate writes only:

- `runtime/execution-review/execution-review.records.json`
- `runtime/execution-review/execution-review.audit.json`
- `runtime/execution-review/execution-review.report.json`

Manual recovery remains external to this layer: correct the upstream approval, request package, or preflight evidence through its owning layer, regenerate review records, then rerun validation.
