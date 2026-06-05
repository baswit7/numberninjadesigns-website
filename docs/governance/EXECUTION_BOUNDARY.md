# Execution Boundary

## Hard Boundary

Phase 9 may only create governance models, contracts, reports, and validation outputs.

## Prohibited Behavior

- Workflow execution.
- Agent execution.
- Provider calls.
- OpenAI calls.
- Anthropic calls.
- GitHub API calls.
- Deployments.
- Queues.
- Schedulers.
- Background workers.
- Secret or credential reads.
- Runtime mutation outside `runtime/execution/` governance outputs.

## Required Contract Flags

Execution boundary objects must explicitly set:

- `executionEnabled`: `false`
- `providerCallsAllowed`: `false`
- `deploymentAllowed`: `false`
- `secretAccessAllowed`: `false`

Any contract or output that sets one of these to `true` fails validation.

