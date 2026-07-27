# Execution Preflight Boundaries

The Execution Preflight Gate is a validation and audit layer only.

## Explicitly Forbidden

- execution engine
- automatic execution
- dispatch execution
- live GitHub execution
- provider execution
- deployment execution
- merge execution
- approval mutation
- request package mutation
- auto approval
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

The gate reads only execution request evidence from:

- `runtime/execution-request/execution-request.packages.json`
- `runtime/execution-request/execution-request.report.json`

## Output Boundary

The gate writes only:

- `runtime/execution-preflight/execution-preflight.decisions.json`
- `runtime/execution-preflight/execution-preflight.audit.json`
- `runtime/execution-preflight/execution-preflight.report.json`

Manual recovery remains external to this layer: fix the source approval or package through its owning layer, regenerate packages, rerun preflight, then rerun validation.
