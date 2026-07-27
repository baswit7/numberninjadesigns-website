# Provider Manager

## Purpose
Central owner for provider registry, token lifecycle, permission checks, health and rate-limit behavior.

## Architecture
The current implementation is registry-driven through `config/providers.config.json` and health scripts. No provider-specific code is duplicated in apps or projects.

## Runtime Flow
Validate provider config, inspect credential presence and publish unified provider status.

## Integration Points
Uses `shared/schemas/provider.schema.json` and emits `provider.*` events.

## Scaling Considerations
Add OAuth refresh, permission probes and rate-limit ledgers here before any app uses provider writes.

## Debugging Instructions
Run `scripts/health/provider-health.ps1` and inspect missing env-var names.

## Validation Rules
Providers must have unique IDs, declared permissions and bounded retry policy.

## Failure Scenarios
Missing credentials leave a provider inactive. Required provider failures block health.

## Future Extensibility
Add provider adapters under `packages/provider-sdk` and keep lifecycle orchestration centralized.
