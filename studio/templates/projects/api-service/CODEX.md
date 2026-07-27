# Codex Working Rules

## Scope

Build only the API service capability described in `PROJECT_MASTER.md`.

## Delivery Rules

- Document contracts before implementation.
- Keep environment variable names visible and values absent.
- Add local tests when handlers are created.
- Do not add governance, approval, provider invocation, deployment automation, workers, queues, schedulers, or agent orchestration.

## Validation

- Check contracts for request, response, and error states.
- Verify no secrets are committed.
- Record meaningful changes in `CHANGELOG.md`.
