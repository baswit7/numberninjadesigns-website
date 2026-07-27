# Execution Governance

## Purpose

Phase 9 adds a pure non-executing governance layer above the Phase 8 AI Coordination Layer. It evaluates whether a future execution request is allowed, approved, safe, reversible and idempotent.

## Architecture

- `approval-engine/` models approval state.
- `risk-engine/` models execution risk.
- `rollback-engine/` models rollback readiness.
- `idempotency-engine/` models replay safety.
- `execution-policy-engine/` models the final governance decision.

## Boundary

This service is contract-first and advisory only. It must not execute workflows, execute agents, call providers, call OpenAI, call Anthropic, call GitHub APIs, deploy, create queues, create schedulers, create workers, create executors, read secrets or read credentials.

## Runtime Output

Validation scripts may write governance-only reports under `runtime/execution/`. Those files are local runtime evidence, not source code.
