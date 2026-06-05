# Rollback Engine

The rollback engine validates whether a future action has a documented reversal strategy.

## Inputs

- Execution request contract.
- Rollback plan contract.

## Outputs

- Reversibility classification.
- Preconditions.
- Rollback steps.
- Validation checks.

## Non-Goals

- No rollback execution.
- No deployment state inspection.
- No data restore.
- No live system mutation.

