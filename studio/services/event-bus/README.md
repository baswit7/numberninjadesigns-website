# Event Bus

## Purpose
Central owner for runtime events, event taxonomy and future replay or queue integration.

## Architecture
Events are currently appended as JSON lines through `scripts/events/emit-event.ps1`.

## Runtime Flow
Validate prefix, assign correlation ID, append event, expose machine-readable output.

## Integration Points
Uses `shared/schemas/event.schema.json` and `shared/contracts/events.contract.json`.

## Scaling Considerations
JSONL can be replaced by a queue or event store while preserving event fields.

## Debugging Instructions
Emit a test event with a known correlation ID and inspect `runtime/events/events.ndjson`.

## Validation Rules
Event prefixes must be registered and service-owned.

## Failure Scenarios
Invalid payload JSON or unsupported prefix fails before writing.

## Future Extensibility
Add replay, retention, subscribers and dead-letter handling.
