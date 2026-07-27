# Phase 8 Safety Boundary

## Boundary

Phase 8 is coordination-only. It creates declarative graph artifacts for human review.

Execution is future scope and is not implemented.

## Explicitly Forbidden

Phase 8 forbids:

- provider execution
- API calls
- deployments
- runtime mutation outside `runtime/coordination/coordination-*.json`
- shell execution
- command execution
- code generation execution
- agent execution
- task runners
- schedulers
- background services
- business features
- executable hooks in JSON registries
- provider credentials or credential references in coordination registries

## Allowed

Phase 8 allows:

- static JSON contracts
- declarative agent registry metadata
- declarative workflow registry metadata
- dependency-free validation
- deterministic graph generation from approved planning metadata
- local runtime output under `runtime/coordination/`

## Safety Controls

| Control | Evidence |
| --- | --- |
| Agent execution disabled | Every agent has `executionAllowed: false`. |
| Workflow execution disabled | Every workflow, stage and gate has `executionAllowed: false`. |
| Graph execution disabled | Every graph, node, edge and gate has `executionAllowed: false`. |
| Strict Boolean enforcement | Validators require `executionAllowed` to exist, be Boolean and be exactly `false`; `0`, `1`, `"false"`, `null` and `true` fail negative tests. |
| Unknown property rejection | Validators enforce approved object shapes for registries, requests, graphs, summaries and health reports. |
| Executable hooks blocked | Registry validators reject executable property names such as hooks, commands, endpoints, runners and schedulers. |
| Provider target coupling blocked | Validators reject provider/API/callback/webhook/agent/service target properties such as `providerUrl`, `apiBaseUrl`, `callbackUrl`, `httpTarget`, `serviceEndpoint`, `endpointUrl`, `webhookUrl`, `agentEndpoint` and related variants. |
| URL and URI targets blocked | Validators reject recursive string values containing `http://`, `https://`, `ws://`, `wss://` or URI-like execution targets. |
| Provider calls blocked | Registries require `provider_execution` and `api_calls` in `forbiddenCapabilities`. |
| Deployment calls blocked | Registries require `deployments` in `forbiddenCapabilities`. |
| Runtime mutation constrained | Generator writes only three approved files under `runtime/coordination/`. |
| Request path containment | Generator rejects coordination request paths outside the repository using a normalized repository-boundary check, including sibling-prefix paths. |
| Dashboard mutation avoided | No dashboard UI or adapter mutation is introduced in Phase 8. |

## Safety Verification Commands

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/validation/validate-coordination-contracts.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/validation/validate-agent-registry.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/validation/validate-workflow-registry.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "services/coordination/generate-coordination-graph.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/validation/validate-coordination-graph.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/validation/validate-coordination-negative-tests.ps1"
```

## Hostile Negative Tests

`scripts/validation/validate-coordination-negative-tests.ps1` proves these unsafe cases fail:

- `executionAllowed: 0`
- `executionAllowed: 1`
- `executionAllowed: "false"`
- `executionAllowed: null`
- `executionAllowed: true`
- unknown provider target property such as `providerUrl`
- workflow target property such as `providerEndpoint`
- recursive URL value such as `https://...`
- sibling path request outside the repository

## Final Safety Statement

Phase 8 coordinates future work. It does not execute future work.
