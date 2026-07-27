# Logging Package

## Purpose
Structured logging utilities with redaction and correlation support.

## Architecture
Logging follows `config/telemetry.config.json` and emits machine-readable records.

## Runtime Flow
Accept level, source, correlation ID and sanitized payload.

## Integration Points
Services, agents and future apps.

## Scaling Considerations
Keep log noise low and redaction centralized.

## Debugging Instructions
Trace by correlation ID across event and telemetry records.

## Validation Rules
Secrets and personal data must be redacted before output.

## Failure Scenarios
Logging failure must not hide primary runtime failure.

## Future Extensibility
Add adapters for Vercel logs or OpenTelemetry.
