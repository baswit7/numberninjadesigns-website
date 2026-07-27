# ADR-002: Read-Only Dashboard

## Context

The visual dashboard renders operational state. It must not become a runtime controller.

## Decision

The dashboard can load and render JSON view models only. It cannot write runtime state, store credentials, call providers, deploy or execute commands.

## Alternatives Considered

- Add dashboard action buttons for remediation. Rejected because this creates execution authority.
- Store API keys in the dashboard. Rejected because Phase 5.1 forbids credentials and providers.

## Consequences

The dashboard remains safe for audit and inspection. Runtime Console remains the brain.

## Future Impact

Future command surfaces must be separated from the read-only dashboard or governed by a new approved boundary.

## Status

Accepted.

## Date

2026-05-29
