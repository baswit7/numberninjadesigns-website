# Telemetry Package

## Purpose
Shared telemetry emitters, redaction and metric contracts.

## Architecture
Telemetry follows `config/telemetry.config.json`.

## Runtime Flow
Emit metrics and traces with correlation IDs and safe dimensions.

## Integration Points
Telemetry Core, services and apps.

## Scaling Considerations
Allow local JSONL, Vercel logs and future analytics backends.

## Debugging Instructions
Use `scripts/telemetry/write-telemetry.ps1` as the executable baseline.

## Validation Rules
Dimensions must be machine-readable and sanitized.

## Failure Scenarios
Telemetry failure must not break primary execution.

## Future Extensibility
Add OpenTelemetry adapters.
