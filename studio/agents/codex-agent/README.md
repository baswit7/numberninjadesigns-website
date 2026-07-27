# Codex Agent

## Purpose
Implementation engine for repository changes, local validation and technical documentation updates.

## Architecture
Registered in `shared/contracts/agents.contract.json`.

## Runtime Flow
Receive bounded work item, implement on feature branch, run validation and emit task events.

## Integration Points
Runtime Orchestrator, Workflow Engine, Documentation Engine and Health Monitor.

## Scaling Considerations
Keep changes modular and reviewable.

## Debugging Instructions
Use validation output and git diff as evidence.

## Validation Rules
No direct work on protected branches.

## Failure Scenarios
Blocked work emits missing evidence.

## Future Extensibility
Add context package format and runbook.
