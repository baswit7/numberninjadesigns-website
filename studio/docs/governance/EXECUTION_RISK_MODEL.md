# Execution Risk Model

## Purpose

The execution risk model classifies future execution requests without running them.

## Risk Levels

- `low`
- `medium`
- `high`
- `blocked`

## Blocking Conditions

Provider calls, deployments, secret access, credential access, agent execution, workflow execution, missing approval, missing rollback readiness and unsafe idempotency remain blocking conditions unless a future phase explicitly designs safe execution authority.
