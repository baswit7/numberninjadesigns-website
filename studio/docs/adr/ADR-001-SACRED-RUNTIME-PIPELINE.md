# ADR-001: Sacred Runtime Pipeline

## Context

Studio OS separates runtime control, dashboard translation, history and intelligence. Future phases must not blur these responsibilities.

## Decision

The protected pipeline is Runtime Console -> runtime reports -> Dashboard Adapter -> dashboard view models -> Historical Snapshot Layer -> Operational Intelligence Layer -> Visual Dashboard.

## Alternatives Considered

- Let services write dashboard UI state directly. Rejected because it bypasses the adapter.
- Let the dashboard calculate intelligence directly. Rejected because the dashboard must remain read-only.

## Consequences

All runtime state refreshes stay console-owned. Intelligence remains deterministic and auditable.

## Future Impact

Future governance, orchestration and provider phases must extend the pipeline through contracts, not bypass it.

## Status

Accepted.

## Date

2026-05-29
