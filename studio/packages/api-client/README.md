# API Client Package

## Purpose
Shared client patterns for Studio OS service APIs.

## Architecture
Clients call Gateway or owned services, not external providers directly.

## Runtime Flow
Attach correlation IDs, handle errors and report telemetry.

## Integration Points
Apps, Gateway and service APIs.

## Scaling Considerations
Centralize retries and rate limit behavior.

## Debugging Instructions
Trace request failures through gateway logs and event records.

## Validation Rules
No duplicated provider-specific clients.

## Failure Scenarios
Network, auth and rate-limit failures must be distinct.

## Future Extensibility
Generate typed clients from route contracts.
