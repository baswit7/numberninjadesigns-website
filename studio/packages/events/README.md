# Events Package

## Purpose
Shared event builders, validators and subscriber contracts.

## Architecture
Event fields follow `shared/schemas/event.schema.json`.

## Runtime Flow
Create, validate and publish events through the Event Bus.

## Integration Points
Runtime Orchestrator, Provider Manager, Telemetry Core and agents.

## Scaling Considerations
Keep event schemas backward compatible.

## Debugging Instructions
Use `scripts/events/emit-event.ps1` as the executable baseline.

## Validation Rules
Every event type must have a registered prefix and owner.

## Failure Scenarios
Invalid events fail before publication.

## Future Extensibility
Add replay and queue adapters.
