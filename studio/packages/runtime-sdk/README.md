# Runtime SDK

## Purpose
Programmatic interface for Studio OS orchestration, workflows and health.

## Architecture
The SDK wraps service contracts without owning business logic.

## Runtime Flow
Submit work, inspect workflow state, read health and emit events.

## Integration Points
Runtime Orchestrator, Workflow Engine, Event Bus and Health Monitor.

## Scaling Considerations
Keep SDK calls deterministic and auditable.

## Debugging Instructions
Trace SDK calls by correlation ID.

## Validation Rules
No direct deployment or provider writes without service approval.

## Failure Scenarios
Blocked workflow states must expose required evidence.

## Future Extensibility
Add SDK implementation after service APIs exist.
