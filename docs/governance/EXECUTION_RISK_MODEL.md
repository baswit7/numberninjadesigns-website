# Execution Risk Model

## Purpose

The risk model classifies the risk of a future action before execution exists.

## Risk Levels

- `low`
- `medium`
- `high`
- `blocked`

## Scoring

Risk score ranges from 0 to 100. Any hard boundary violation is `blocked` with a score of 100.

## Blocking Conditions

Blocking conditions identify why a future action cannot proceed. In Phase 9, provider execution, deployment execution, secret access, missing approval, and missing rollback readiness are blocking conditions.

