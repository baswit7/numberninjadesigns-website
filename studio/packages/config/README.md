# Config Package

## Purpose
Typed configuration loader and validator for Studio OS runtime settings.

## Architecture
Current source is `config/*.config.json`; future code must preserve schema compatibility.

## Runtime Flow
Load environment, provider, feature flag, telemetry and deployment profiles.

## Integration Points
All services and apps.

## Scaling Considerations
Add secret-manager compatibility without putting secrets in config files.

## Debugging Instructions
Run `scripts/validation/validate-config.ps1`.

## Validation Rules
Fail fast on invalid JSON, duplicate IDs and unknown references.

## Failure Scenarios
Invalid config blocks runtime startup.

## Future Extensibility
Add typed SDK exports after runtime language selection.
