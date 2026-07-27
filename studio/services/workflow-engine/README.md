# Workflow Engine

## Purpose
Central owner for durable workflow states and autonomous execution contracts.

## Architecture
Workflow states are defined in `shared/contracts/workflow.contract.json`.

## Runtime Flow
Move work from intake through release only when required evidence exists.

## Integration Points
Coordinates with agents, runtime orchestrator, documentation engine and deployment controller.

## Scaling Considerations
State can later move into a database or queue-backed state machine.

## Debugging Instructions
Inspect workflow events and required evidence for blocked states.

## Validation Rules
Terminal states are explicit and retries are bounded.

## Failure Scenarios
Validation failure returns to implementation or blocks for review.

## Future Extensibility
Add state persistence, rehydration and replay.
