# Telemetry And Observability Foundation

## Purpose
Studio OS needs low-noise, machine-readable diagnostics before autonomous execution is safe. This foundation creates structured event, metric and health outputs without adding a monitoring vendor.

## Architecture
- Events are JSON lines in `runtime/events/events.ndjson`.
- Metrics are JSON lines in `runtime/telemetry/telemetry.ndjson`.
- Health reports are JSON files in `runtime/reports/health-report.json`.
- Telemetry behavior is configured in `config/telemetry.config.json`.

## Runtime Flow
1. Runtime scripts generate correlation IDs when none are supplied.
2. Event and metric records are appended, not overwritten.
3. Health checks produce a current report for dashboards and deployment gates.
4. Future dashboards can read the same JSON contracts directly.

## Integration Points
- Event Bus emits operational state.
- Provider Manager emits provider diagnostics.
- Health Monitor emits repository and config status.
- Deployment Controller consumes health status before release.

## Scaling Considerations
JSONL is sufficient for local deterministic validation. The same records can later stream to Vercel logs, OpenTelemetry, a queue or analytics storage.

## Debugging Instructions
Use one correlation ID across event, telemetry and health commands to trace a workflow. Do not include secrets or personal data in payloads or dimensions.

## Validation Rules
- Event type prefixes must match `shared/schemas/event.schema.json`.
- Severity must be one of the approved values.
- Telemetry dimensions must be valid JSON.
- Redaction keys in telemetry config are reserved for future log scrubbing.

## Failure Scenarios
- Invalid event prefix: event write fails.
- Invalid JSON payload or dimensions: script fails before writing.
- Health failure: report is still written with errors for dashboard consumption.

## Future Extensibility
Add dashboards, trace spans, provider latency metrics, deployment health signals, anomaly detection and retention policies after runtime usage generates real data.
