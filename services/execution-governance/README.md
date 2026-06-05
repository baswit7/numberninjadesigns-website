# Execution Governance Service

Phase 9 adds a pure governance layer for evaluating future execution requests. It does not execute workflows, agents, provider calls, deployments, queues, schedulers, or background workers.

## Modules

- `approval-engine`: models whether human approval is present, missing, denied, expired, or constrained.
- `risk-engine`: classifies request risk and blocking conditions.
- `rollback-engine`: validates rollback readiness before future execution could be considered.
- `idempotency-engine`: models replay safety and conflict handling.
- `execution-policy-engine`: combines governance inputs into a non-executing policy decision.

## Boundary

Every Phase 9 artifact is a governance model, schema, document, or validation output. No file in this service may read credentials, call external APIs, perform deployments, mutate provider state, run agents, enqueue work, or invoke execution logic.

