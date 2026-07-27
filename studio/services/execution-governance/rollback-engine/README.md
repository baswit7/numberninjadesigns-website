# Rollback Engine

The rollback engine validates whether a future execution request has a documented reversal strategy.

It does not perform rollback, inspect deployment state, restore data, run commands or mutate runtime state. It only evaluates readiness records.
