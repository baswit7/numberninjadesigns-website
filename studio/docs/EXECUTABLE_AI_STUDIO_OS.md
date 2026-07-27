# Executable AI Studio OS

## Doel
Executable AI Studio OS beschrijft de echte platformarchitectuur achter de software factory. Dit document definieert de apps, verantwoordelijkheden, dataflows, permissions, AI interaction models, scaling strategy, dependencies, reusable systems, integration points en telemetry requirements.

## System Topology
```text
apps/studio-os
|-- command-center
|-- agent-orchestrator
|-- project-control
|-- revenue-engine
|-- release-center
|-- knowledge-graph
|-- prompt-vault
|-- analytics-core
|-- api-registry
|-- quality-gates
|-- workflow-engine
|-- automation-center
`-- scoring-engine
```

## App Contracts
| App | Purpose | Architecture | Data Flow | Permissions |
| --- | --- | --- | --- | --- |
| `/apps/studio-os` | Platform shell, identity, policy and navigation kernel | Thin core with registry, permissions, settings and policy loader | Reads registry and policy state; publishes platform events | Admin for policy changes; read for agents |
| `/apps/command-center` | Executive cockpit for portfolio state | Dashboard app backed by Analytics Core and Scoring Engine | Consumes project, score, release, incident, revenue and token events | Read for all operators; admin can acknowledge alerts |
| `/apps/agent-orchestrator` | Routes work across AI departments | Queue, router, handoff tracker and escalation engine | Takes tasks, context summaries and gates; emits assignments and results | Agents write own tasks; leads approve cross-domain actions |
| `/apps/project-control` | Controls project execution | Project registry, roadmap state, branch view, readiness checklist | Syncs GitHub, Notion summaries and quality status | Project owner writes; agents propose changes |
| `/apps/revenue-engine` | Commercial intelligence and prioritization | Experiment registry, funnel model, pricing hypotheses, channel planner | Pulls analytics, SEO, market and conversion data; emits revenue scores | Revenue and strategy agents write experiments |
| `/apps/release-center` | Release governance and rollback control | Approval board, deployment ledger, incident hooks | Consumes quality gates, deployment state and incidents; emits release records | Release owner approves; agents can recommend |
| `/apps/knowledge-graph` | Compound intelligence memory | Typed graph of projects, decisions, patterns, failures and wins | Ingests postmortems, decisions, prompts, incidents and experiments | Knowledge agent curates; all agents read |
| `/apps/prompt-vault` | Reusable prompt and task intelligence | Versioned prompt blocks with scope, cost and outcome metadata | Receives promoted prompts; serves task-specific prompt layers | Prompt maintainer writes; agents consume |
| `/apps/analytics-core` | Event backbone and metric definitions | Event contracts, ingestion, metric materialization and retention rules | Receives events from apps and deployments; exposes clean metrics | Instrumentation owners write schemas |
| `/apps/api-registry` | API governance and integration truth | Registry of APIs, auth, limits, owners, cost, stability and fallbacks | Receives API changes, failures and incidents; emits risk state | API owner writes; security reviews auth |
| `/apps/quality-gates` | Enforces release quality | Gate definitions, thresholds, checklist engine and blocker state | Consumes diff, tests, docs, security, UX and release inputs | Gate owners maintain; release can override with record |
| `/apps/workflow-engine` | Autonomous process automation | State machine for intake, plan, build, verify, release and learn | Routes tasks and transitions; emits workflow telemetry | Workflow owner changes transitions |
| `/apps/automation-center` | Reusable operational automations | Runbook catalog, schedules, retry policies and observability | Executes approved recipes; emits success/failure and cost | Automation owner approves write actions |
| `/apps/scoring-engine` | Live intelligence and prioritization | Weighted score calculator with rules, thresholds and recommendations | Consumes telemetry and project metadata; emits scores and escalations | Score owner changes formulas |

## AI Interaction Model
| Interaction | Rule |
| --- | --- |
| Context load | Agents receive project summary, relevant contracts, current task and gate state only. |
| Tool use | Agents may only use tools matching their authority and task scope. |
| Memory write | Agents write compact structured outcomes to docs, Notion or Knowledge Graph. |
| Handoff | Every handoff includes objective, state, evidence, risks and next action. |
| Escalation | Low confidence, high cost, security risk, release blocker or revenue conflict escalates. |

## Scaling Strategy
- Start as a documentation-first control plane.
- Add executable registries only after the document contracts stabilize.
- Keep apps independently deployable when runtime implementation starts.
- Use event contracts before direct app-to-app coupling.
- Materialize dashboards from Analytics Core instead of querying every source live.
- Shard by project portfolio only when event volume or permissions require it.

## Shared Reusable Systems
| System | Reuse target |
| --- | --- |
| Project registry schema | All project dashboards and score calculations |
| Event envelope | Analytics, alerts, audit and scoring |
| Gate result format | Release Center, Command Center and postmortems |
| Agent task contract | Orchestrator, Workflow Engine and Knowledge Graph |
| API record contract | API Registry, Security Agent and Debug Agent |
| Experiment contract | Revenue Engine, Analytics Agent and Command Center |

## Telemetry Requirements
Every app must emit:
- `app_event.created` with app, entity, action, actor, timestamp and correlation id.
- `gate.result` for every quality or governance decision.
- `agent.task.completed` with cost, tokens, duration, confidence and artifacts.
- `score.updated` with input snapshot and formula version.
- `incident.detected` and `incident.resolved` when operational state changes.
- `experiment.updated` when commercial validation changes.
