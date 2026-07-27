# ADR-004: Historical Snapshot Strategy

## Context

Trend, change and confidence calculations need historical dashboard state without storing secrets or provider responses.

## Decision

Snapshots store sanitized dashboard-derived summaries under `runtime/history`. History pruning is a future guarded maintenance command and is not active in the baseline until a separate safety review approves it.

## Alternatives Considered

- Store raw runtime files in each snapshot. Rejected because it increases storage and audit surface.
- Use external telemetry storage. Rejected because Phase 5.1 forbids remote telemetry.

## Consequences

History stays local and deterministic. Retention enforcement must be added only through guarded maintenance behavior after explicit safety review.

## Future Impact

Future phases can expand snapshot contracts only after governance approval.

## Status

Accepted.

## Date

2026-05-29
