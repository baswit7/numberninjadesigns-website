# AI Coordination Layer

## Purpose

Phase 8 adds the Studio OS AI Coordination Layer.

The layer transforms approved command and planning metadata into a declarative coordination graph. It coordinates future work, dependencies, agent roles, review gates and readiness boundaries.

It does not execute work.

## Position In Studio OS

```text
Governance & Release Control
-> Phase 7 Command Preparation Layer
-> Phase 8 AI Coordination Layer
-> future execution design, not implemented here
```

Phase 7 prepares command artifacts. Phase 8 coordinates those approved planning artifacts into a graph. Execution remains outside the current architecture.

## Components

| Component | Path | Responsibility |
| --- | --- | --- |
| Coordination contracts | `shared/contracts/coordination/` | JSON schemas for registries, requests, graph, summary and health. |
| Agent registry | `services/coordination/agent-registry.json` | Declarative list of Studio OS coordination agents. |
| Workflow registry | `services/coordination/workflow-registry.json` | Declarative workflow templates and stage dependencies. |
| Coordination generator | `services/coordination/generate-coordination-graph.ps1` | Deterministically maps an approved request to read-only runtime outputs. |
| Validators | `scripts/validation/validate-coordination-*.ps1`, `validate-agent-registry.ps1`, `validate-workflow-registry.ps1` | Dependency-free safety and structure checks. |
| Runtime outputs | `runtime/coordination/coordination-*.json` | Local generated graph, summary and health reports. |

## Runtime Outputs

Approved Phase 8 outputs:

```text
runtime/coordination/coordination-graph.json
runtime/coordination/coordination-summary.json
runtime/coordination/coordination-health.json
```

These files are generated local runtime evidence. They are ignored by Git like other runtime output.

## Dashboard Boundary

Dashboard integration is documentation-only in this phase.

The existing dashboard adapter writes view models and currently owns a broader runtime refresh pattern. Adding a Coordination Center UI before an explicit projection-only adapter contract would blur the Phase 8 boundary.

Future dashboard integration may consume `runtime/coordination/*.json` or adapter-generated read-only view models. It must not generate graphs, call services, call providers, trigger workflows or mutate runtime state.

## Non-Execution Boundary

Phase 8 may:

- read declarative registries
- read approved planning metadata
- validate known workflows and agents
- write approved coordination runtime reports
- expose read-only graph state for review

Phase 8 may not:

- execute commands
- call providers
- deploy
- trigger agents
- run generated plans
- schedule work
- start background services
- mutate existing runtime, dashboard, governance, provider, deployment or command-preparation layers

## Review Rule

A coordination graph is not approval to execute. It is a review artifact that makes future handoffs visible before any implementation branch or execution design is considered.
