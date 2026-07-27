# ADR-003: Operational Intelligence Layer

## Context

Phase 5 created deterministic health, trend, risk, governance, maturity and executive summary outputs.

## Decision

Operational Intelligence remains the judgment layer. It consumes dashboard view models and snapshot history, then writes deterministic intelligence view models.

## Alternatives Considered

- Add AI inference. Rejected because trust requires deterministic and traceable output.
- Add provider-specific insight engines. Rejected because provider integration belongs to a future phase.

## Consequences

Every result can be traced to inputs, weights, thresholds and calculation paths.

## Future Impact

Future intelligence expansion must start with contracts and explainability before implementation.

## Status

Accepted.

## Date

2026-05-29
