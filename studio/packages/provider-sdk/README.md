# Provider SDK

## Purpose
Central SDK for provider lifecycle, auth, permissions, rate limits and health.

## Architecture
Provider-specific adapters live here; orchestration remains in Provider Manager.

## Runtime Flow
Adapters expose standardized connect, verify, refresh, health and call contracts.

## Integration Points
Provider Manager, Gateway and future Admin Panel.

## Scaling Considerations
Adding a provider must not require app changes.

## Debugging Instructions
Start with credential-presence health before adding external probes.

## Validation Rules
No token logging and no duplicated provider clients.

## Failure Scenarios
Rate limits, expired tokens and permission denial must be separate statuses.

## Future Extensibility
Add OAuth-compatible adapters per provider.
