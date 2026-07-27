# Execution Request Boundaries

The Execution Request Packager is a packaging and audit layer only.

## Explicitly Forbidden

- execution engine
- automatic execution
- live GitHub action execution
- provider execution
- deployment execution
- merge execution
- approval mutation
- auto approval
- workers
- schedulers
- queues
- autonomous runner
- Software Factory
- self-healing systems
- secret or credential access
- repository settings mutation
- collaborator mutation
- protected branch writes

## Mutation Boundaries

The generator may write only execution request runtime evidence:

- `runtime/execution-request/execution-request.packages.json`
- `runtime/execution-request/execution-request.audit.json`
- `runtime/execution-request/execution-request.report.json`

It must not mutate branches, approvals, provider state, deployment state, repository settings, secrets, collaborators, or any runtime domain outside execution request reports.

## Review Path

`READY_FOR_REVIEW` means the package can be reviewed by a human or future governance layer. It does not mean execution is allowed.

Manual recovery remains external to this layer: reject the package, correct the source approval record through the Approval Gateway process, regenerate packages, and rerun validation.
