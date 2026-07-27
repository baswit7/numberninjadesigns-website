# ADR-005: No Provider Dependencies

## Context

Operational Intelligence must remain trusted before provider integrations arrive.

## Decision

Operational Intelligence and the dashboard cannot call providers, import provider SDKs or depend on provider credentials.

## Alternatives Considered

- Query providers directly for richer intelligence. Rejected because it violates Phase 5.1 security requirements.
- Cache provider credentials locally. Rejected because credentials are forbidden.

## Consequences

Provider state is represented only as read-only config/report status. No tokens or secrets enter intelligence output.

## Future Impact

Phase 8 provider integration must use governed provider boundaries and contracts without leaking authority into Operational Intelligence.

## Status

Accepted.

## Date

2026-05-29
