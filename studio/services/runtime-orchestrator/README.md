# Runtime Orchestrator

## Purpose
Central owner for task routing, execution state and control-plane coordination.

## Architecture
The current foundation defines orchestration through workflow and event contracts.

## Runtime Flow
Future orchestration must publish state changes, retry events and blocked states with correlation IDs.

## Integration Points
Consumes `shared/contracts/workflow.contract.json` and emits `runtime.*` events.

## Scaling Considerations
Add durable state and queue-backed execution only after state transitions are stable.

## Debugging Instructions
Trace by correlation ID across runtime, workflow and agent events.

## Validation Rules
Retries are bounded and require diagnostic evidence.

## Failure Scenarios
Missing evidence blocks transition instead of silently continuing.

## Future Extensibility
Add scheduler, lock manager and workflow runner.
