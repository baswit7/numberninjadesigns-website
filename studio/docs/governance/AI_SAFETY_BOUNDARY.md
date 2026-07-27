# AI Safety Boundary

## Permanent Rule

Operational Intelligence is a judgment layer. It may observe, measure, evaluate, recommend and report.

It may not execute authority-changing actions.

## Allowed

- observe runtime reports
- measure health, trend, risk, maturity, governance and confidence
- evaluate deterministic view models
- recommend next actions
- report summaries and explanations

## Forbidden

- deploy
- execute external systems
- approve changes
- merge changes
- modify source state outside generated runtime view models
- delete source files
- create credentials
- change runtime state directly
- call providers
- store secrets or tokens
- expose credentials
- send remote telemetry

## Enforcement

Architecture validation must treat a forbidden action in Operational Intelligence, dashboard adapter or dashboard UI as an architecture conflict and stop with:

`ARCHITECTURE CONFLICT DETECTED`
