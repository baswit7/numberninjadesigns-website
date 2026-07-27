# Execution Governance Simulation

Phase 22 provides non-executing governance simulation for hypothetical execution plans.

The generator consumes existing governance, readiness, authority and observability reports and writes only:

- `runtime/simulation/execution-simulation.report.json`

It answers what governance consequences would occur if a workflow, command, provider request, deployment request or execution plan were attempted. It never performs the action.

Phase 22 owns only simulation reports. It owns no authority truth, governance truth, evidence truth, monitoring truth, history truth or observability truth.

Missing, unreadable, stale or incomplete input is surfaced as `unknown`, never `pass`.
