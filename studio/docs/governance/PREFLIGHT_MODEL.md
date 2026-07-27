# Preflight Model

Preflight checks are declarative readiness checks. A check has an id, type, severity, expected evidence and readiness status.

Supported check types are contract, boundary, dependency, approval-chain, rollback, idempotency and documentation. The model does not execute target commands, inspect live providers or mutate runtime state.
