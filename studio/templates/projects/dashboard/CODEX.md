# Codex Working Rules

## Scope

Build only read-only dashboard capability described in `PROJECT_MASTER.md`.

## Delivery Rules

- Do not mutate source metadata.
- Keep visual density high and scan-friendly.
- Show stale or missing source data clearly.
- Do not add governance, approval, provider invocation, deployment automation, workers, queues, schedulers, or agent orchestration.

## Validation

- Verify each displayed field has a source.
- Verify no write path exists.
- Record meaningful changes in `CHANGELOG.md`.
