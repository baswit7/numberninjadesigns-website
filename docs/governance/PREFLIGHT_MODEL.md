# Preflight Model

Preflight checks are readiness-only records that evaluate whether a future plan has the required non-executing evidence.

## Check Types

- `boundary`
- `schema`
- `risk`
- `rollback`
- `idempotency`
- `approval-chain`
- `dependency`

## Status Values

- `pass`
- `warning`
- `fail`
- `blocked`

Preflight checks record evidence and reasons. They do not run commands, contact providers, deploy, or mutate state.
