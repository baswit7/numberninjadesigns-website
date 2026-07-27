# Health Monitor

## Purpose
Central owner for repository, provider, config, documentation and runtime integrity reports.

## Architecture
Health is currently produced by `scripts/health/studio-health.ps1`.

## Runtime Flow
Check governance docs, branch safety, provider credential presence and placeholder markers.

## Integration Points
Consumes Studio config and provider status. Produces `runtime/reports/health-report.json`.

## Scaling Considerations
Health reports can become deployment gates and dashboard inputs.

## Debugging Instructions
Run `scripts/health/studio-health.ps1` and inspect the generated report.

## Validation Rules
Health must write a machine-readable report even when checks fail.

## Failure Scenarios
Protected branches, missing docs or forbidden markers fail health.

## Future Extensibility
Add deployment, CI, docs reference and import checks.
