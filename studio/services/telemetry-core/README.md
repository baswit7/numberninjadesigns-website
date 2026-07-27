# Telemetry Core

## Purpose
Central owner for structured metrics, traces and low-noise operational diagnostics.

## Architecture
Telemetry records are currently JSON lines written by `scripts/telemetry/write-telemetry.ps1`.

## Runtime Flow
Accept metric, source, value, unit, dimensions and correlation ID; append to local telemetry store.

## Integration Points
Consumes `config/telemetry.config.json` and feeds health dashboards.

## Scaling Considerations
JSONL output can stream into OpenTelemetry or analytics storage later.

## Debugging Instructions
Write a metric with a known correlation ID and inspect `runtime/telemetry/telemetry.ndjson`.

## Validation Rules
Dimensions must be valid JSON.

## Failure Scenarios
Invalid dimensions fail before writing.

## Future Extensibility
Add redaction, span modeling and retention policy.
