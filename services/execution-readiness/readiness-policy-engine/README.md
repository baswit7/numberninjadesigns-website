# Readiness Policy Engine

Combines readiness inputs into a readiness-only decision.

Decision values are limited to:

- `ready-for-future-review`
- `not-ready`
- `blocked`

No decision value enables execution, provider access, deployment, worker dispatch, scheduler registration, queueing, or secret access.
