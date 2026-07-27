# Codex Working Rules

## Scope

Build only the automation project described in `PROJECT_MASTER.md`.

## Delivery Rules

- Document the manual workflow before scripting.
- Keep writes explicit and reversible.
- Add local validation for generated outputs.
- Do not add governance, approval, provider invocation, deployment automation, workers, queues, schedulers, or agent orchestration.

## Validation

- Verify inputs, outputs, and recovery notes are documented.
- Verify no secrets are committed.
- Record meaningful changes in `CHANGELOG.md`.
