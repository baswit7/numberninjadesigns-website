# Preflight Engine

Models preflight checks for future execution plans.

Allowed outputs:

- Boundary readiness.
- Schema readiness.
- Risk readiness.
- Rollback readiness.
- Idempotency readiness.
- Approval-chain readiness.
- Dependency readiness.

This module does not call providers, run commands, deploy, enqueue work, read secrets, or mutate external state.
