# Studio OS Implementation Architecture

## Purpose
Studio OS is the executable control plane for the Autonomous AI Software Factory. It converts the existing documented intelligence system into a real platform architecture where projects, agents, telemetry, releases, revenue, knowledge and workflows operate through explicit runtime boundaries.

This phase does not introduce runtime code, deployments or dependencies. It defines the first implementation-ready application system.

## Product Definition
Studio OS is not a dashboard. It is an AI-native operating system with four responsibilities:

| Responsibility | Runtime Meaning |
| --- | --- |
| Orchestrate work | Convert goals, signals and blockers into executable workflow states |
| Coordinate agents | Route context, permissions, review requirements and outcomes across AI agents |
| Govern launches | Block or approve releases through quality, security, revenue and rollback gates |
| Compound intelligence | Convert outcomes, failures, prompts and patterns into reusable memory |

## Application Topology
```text
apps/
|-- studio-os/                 platform shell, identity, permissions, registry
|-- command-center/            portfolio cockpit and live operating view
|-- project-control/           project state, roadmaps, readiness, execution lanes
|-- agent-runtime/             agent lifecycle, task routing, handoffs, reviews
|-- revenue-intelligence/      revenue scoring, experiments, launch monetization
|-- telemetry/                 event intake, metrics, traces, operational signals
|-- prompt-vault/              reusable prompts, context blocks, token economics
|-- knowledge-graph/           compound memory, patterns, failures, recommendations
|-- automation-center/         approved runbooks, schedules, retries, recovery
`-- release-center/            gates, approvals, deployments, incidents, rollback

shared/
|-- ui/                        design system, cockpit components, tokens
|-- agents/                    agent contracts, permissions, task envelopes
|-- scoring/                   formulas, thresholds, confidence rules
|-- workflows/                 state machines, transitions, quality gates
|-- events/                    event envelope, schemas, routing contracts
|-- telemetry/                 metric definitions, retention, dashboards
|-- governance/                policies, authority, audit, overrides
|-- revenue/                   experiment models, commercial metrics
`-- knowledge/                 memory objects, ranking, promotion rules
```

Existing `apps/agent-orchestrator`, `apps/revenue-engine`, `apps/analytics-core` and `apps/api-registry` concepts remain valid as earlier names. The implementation naming standard for this phase is `agent-runtime`, `revenue-intelligence` and `telemetry`; API governance is part of `studio-os` plus `shared/governance` until runtime volume justifies a separate app.

Current implemented UI entrypoints:

| Path | Role |
| --- | --- |
| `apps/command-center/index.html` | Primary local production environment for Bas. |
| `apps/studio-dashboard/index.html` | Technical runtime and governance surface only. |
| `apps/public-site/index.html` | Public website surface, not the Studio OS control plane. |

Vercel routing remains unchanged until a dedicated route-binding task connects `/app` or root to `apps/command-center`.

## Runtime Boundaries
| Boundary | Owns | Must Not Own |
| --- | --- | --- |
| Studio OS shell | Navigation, identity, tenant/project registry, permissions, policy loading | Domain scoring, agent execution, deployment execution |
| Command Center | Aggregated operational view, alerts, command palette, drilldown entry | Source-of-truth records |
| Project Control | Project state, milestones, active work, readiness checklist | Agent memory, revenue experiment truth |
| Agent Runtime | Task queue, context routing, agent permissions, handoff and review state | Final business priorities |
| Telemetry | Event ingestion, normalization, metrics, anomaly signals | Policy decisions without governance input |
| Revenue Intelligence | Revenue scores, channel experiments, conversion opportunities | Engineering release approval |
| Release Center | Gate results, release approvals, rollback plans, incident linkage | Source control or hosting provider internals |
| Knowledge Graph | Memory ranking, pattern promotion, failure prevention, recommendations | Raw event retention |
| Prompt Vault | Prompt versions, context blocks, token budgets, success metrics | Agent execution authority |
| Automation Center | Approved recipes, schedules, retries, runbook execution records | Unapproved destructive actions |

## Control Plane Flow
```text
request/signal
  -> event envelope
  -> telemetry normalization
  -> scoring update
  -> workflow transition
  -> agent assignment
  -> review/gate result
  -> release/automation action
  -> knowledge extraction
  -> reusable memory promotion
```

## Implementation Principles
- Event contracts come before direct app-to-app calls.
- Every score stores formula version, input snapshot, confidence and timestamp.
- Every agent action has role, authority, context scope and review route.
- Every launch has release record, rollback plan, quality gate result and observation window.
- Every reusable memory item has evidence, source, age, reuse count and promotion status.
- Every API integration has owner, auth model, rate limit, retry policy, fallback and cost profile.
- Every automation has dry-run mode, bounded retries, audit record, pause switch and recovery path.

## First Build Phases
| Phase | Build Scope | Outcome |
| --- | --- | --- |
| 1. Static control plane | Studio OS shell, project registry, event schema, score definitions | Executable structure without external dependencies |
| 2. Manual telemetry | Event ledger, gate records, score snapshots, command center views | Operators can see and update operating state |
| 3. Agent runtime MVP | Task envelopes, context packages, handoffs, review state | AI work becomes traceable and routable |
| 4. Release governance | Release Center, quality gates, rollback ledger, incident links | Launch decisions become auditable |
| 5. Knowledge runtime | Memory objects, prompt vault, pattern extraction, recommendations | Intelligence compounds across projects |
| 6. Automation layer | Approved runbooks, retries, schedules, status indicators | Repeatable operations become executable |
| 7. Autonomous loops | Triggered workflows, confidence gates, escalation chains | System can act within strict permissions |

## Executable Scoring Engine
Scores are calculated from normalized telemetry, gate outcomes, project metadata and confidence-adjusted evidence. Every score is stored as a versioned snapshot.

| Score | Formula Inputs |
| --- | --- |
| Revenue Potential | demand signal 25%, conversion evidence 20%, margin 15%, channel reach 15%, speed to market 15%, confidence 10% |
| Launch Readiness | critical gates 30%, rollback readiness 15%, telemetry coverage 15%, docs health 15%, incident risk 15%, owner approval 10% |
| Technical Debt | duplication 20%, stale docs 15%, missing tests/checks 20%, dependency risk 15%, complexity 15%, recurring defects 15% |
| AI Maturity | agent traceability 20%, context reuse 20%, prompt quality 15%, review quality 15%, automation coverage 15%, memory writes 15% |
| Automation Coverage | runbook coverage 25%, retry success 20%, manual effort removed 20%, auditability 15%, pause/recovery readiness 20% |
| Documentation Health | architecture coverage 25%, decision traceability 20%, freshness 20%, onboarding value 15%, release linkage 20% |
| Scaling Readiness | latency headroom 20%, cost headroom 20%, data model resilience 20%, observability 20%, isolation boundaries 20% |
| Conversion Potential | offer clarity 20%, audience fit 20%, UX friction 20%, trust signals 15%, analytics coverage 15%, experiment velocity 10% |
| SEO Strength | intent match 25%, technical SEO 20%, content quality 20%, internal links 10%, freshness 10%, conversion alignment 15% |
| Deployment Stability | failed deploy rate 25%, rollback readiness 20%, incident rate 20%, monitoring 15%, change size risk 10%, dependency health 10% |
| Operational Risk | blocker severity 25%, incident likelihood 20%, security exposure 20%, automation risk 15%, stale telemetry 10%, ownership gaps 10% |

Thresholds:
- `0-49`: blocked or high risk;
- `50-69`: remediation required;
- `70-84`: usable with watch conditions;
- `85-100`: strong operating state.

## Token Intelligence System
Token efficiency is a strategic runtime capability, not a cost afterthought.

| Capability | Runtime Rule |
| --- | --- |
| Context segmentation | split mission, resource, contract, memory, evidence and exclusion context |
| Memory routing | retrieve only high-confidence, relevant memory blocks |
| Prompt caching | reuse stable prompt layers by agent role and task type |
| Context blocks | version reusable architecture, debugging, launch and API context |
| Agent memory isolation | agents receive scoped memory, not global repository history |
| Token telemetry | record input, output, retries, context reloads and cost per successful outcome |
| Token budgeting | every task has budget, breach threshold and compression rule |
| Context compression | summarize retained facts, uncertainty and source references |
| Long-term delegation | promote stable learnings to Knowledge Graph instead of reloading conversations |

Optimization triggers:
- task token cost exceeds budget by 30%;
- same context is loaded more than twice;
- agent correction rate increases after context change;
- prompt success rate drops below threshold;
- memory block reduces task cost without quality loss;
- repeated failures show missing context contract.

## Dependency Graph
```text
shared/events
  -> shared/telemetry
  -> shared/scoring
  -> apps/telemetry
  -> apps/command-center

shared/governance
  -> shared/workflows
  -> apps/project-control
  -> apps/release-center

shared/agents
  -> apps/agent-runtime
  -> apps/prompt-vault
  -> apps/knowledge-graph

shared/revenue
  -> apps/revenue-intelligence
  -> apps/command-center
```

## MVP Implementation Order
1. Define shared event envelope, resource IDs and correlation IDs.
2. Create project registry and static resource model.
3. Implement manual event ledger and score snapshot records.
4. Build Studio OS shell navigation and Command Center cockpit.
5. Add Project Control execution lanes and readiness gates.
6. Add Agent Runtime task envelope, context bundle and review pipeline.
7. Add Release Center approvals, rollback state and incident links.
8. Add Knowledge Graph memory objects and Prompt Vault promotion workflow.
9. Add Revenue Intelligence formulas and opportunity triggers.
10. Add Automation Center runbook registry with pause, retry and audit controls.

## Non-Negotiable MVP Constraints
- No autonomous write action without explicit permission level.
- No direct provider deployment before release governance exists.
- No score displayed without freshness and confidence.
- No hidden background automation.
- No agent receives full repository context by default.
- No operational decision depends on a single unverified signal.

## Success Criteria
Studio OS phase 1 is implementation-ready when:
- the app/module map is explicit;
- every app has a single owner boundary;
- every cross-app interaction has an event or contract;
- every score has a formula and source;
- every UI surface maps to operational decisions;
- every agent action can be audited;
- every launch can be blocked, approved, observed and learned from.
