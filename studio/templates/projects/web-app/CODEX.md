# Codex Working Rules

## Scope

Build only the web app capability described in `PROJECT_MASTER.md`.

## Delivery Rules

- Keep changes directly tied to the active user workflow.
- Prefer standalone files until modularization clearly improves maintainability.
- Keep mobile and desktop behavior verified.
- Do not add governance, approval, provider invocation, deployment automation, workers, queues, schedulers, or agent orchestration.

## Validation

- Check generated files for unresolved placeholders.
- Verify the app can run locally using the documented path.
- Record meaningful changes in `CHANGELOG.md`.
