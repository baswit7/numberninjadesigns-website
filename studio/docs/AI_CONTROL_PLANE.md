# AI Control Plane

## Doel
Het AI Control Plane is de centrale besturingslaag van de AI Software Factory. Het bestuurt projecten, agents, workflows, signalen, telemetry, governance, scoring, releases, revenue-intelligence en herbruikbare kennis als een meetbaar operationeel systeem.

Het Control Plane vervangt losse documentatie en handmatige coordinatie door een uitvoerbaar operating model:
- projecten worden bestuurbare resources;
- agents worden routeerbare execution units;
- workflows worden stateful pipelines;
- telemetry wordt beslissingsinput;
- governance wordt afdwingbaar;
- intelligence wordt herbruikbaar en compounding.

## Architectuurprincipe
Het Control Plane is geen monolithische app. Het is een set van duidelijke control loops, contracts en state machines die later door tools, dashboards en automations uitgevoerd kunnen worden.

```text
signals -> telemetry -> scoring -> decision engine -> execution graph
   ^                                                       |
   |                                                       v
knowledge graph <- learn loops <- governance <- pipelines <- agents
```

## Control Plane Layers
| Layer | Verantwoordelijkheid | Primaire documenten |
| --- | --- | --- |
| Resource Registry | Projecten, agents, APIs, prompts, pipelines, releases en experiments als bestuurbare objecten | `ARCHITECTURE.md`, `PROJECT_GOVERNANCE.md` |
| Execution Graph | Dynamische afhankelijkheden, triggers, retries, rollbacks en escalaties | `AI_EXECUTION_GRAPH.md` |
| Telemetry System | Live metrics, event intake, anomaly detection en operational health | `AI_TELEMETRY_SYSTEM.md` |
| Signal Routing | Prioriteit, ownership en response orchestration voor operationele signalen | `AI_SIGNAL_ROUTING.md` |
| Decision Engine | Prioritering, scoring, confidence en trade-off beslissingen | `AI_DECISION_ENGINE.md` |
| Pipeline Orchestration | Executable lifecycle pipelines voor build, release, launch, SEO, debug en learning | `AI_PIPELINE_ORCHESTRATION.md` |
| Runtime Governance | Release-, branch-, API-, security-, deployment- en tokenregels | `AI_RUNTIME_GOVERNANCE.md` |
| Coordination Protocol | Agent contracts, handoffs, authority, conflict resolution en memory writes | `AI_COORDINATION_PROTOCOL.md` |
| Operational Intelligence | KPI model, excellence standards, optimization cycles en operating cadence | `AI_OPERATIONAL_INTELLIGENCE.md` |
| Cross-Project Intelligence | Pattern extraction, reuse promotion, anti-patterns en portfolio learning | `CROSS_PROJECT_INTELLIGENCE.md` |

## Resource Model
| Resource | Key Fields | Control Plane Gebruik |
| --- | --- | --- |
| Project | id, owner, status, scores, launch stage, revenue thesis, active risks | Prioriteit, release readiness, agent routing |
| Agent | role, authority, input contract, output contract, confidence, cost profile | Task assignment, review, escalation |
| Workflow | state, owner, inputs, gates, retries, rollback, learn output | Pipeline execution |
| Signal | type, severity, source, evidence, impacted resources, expiry | Routing and intervention |
| Metric | definition, owner, source, freshness, confidence | Scoring and anomaly detection |
| Gate | condition, threshold, blocker level, override rule, evidence | Governance enforcement |
| Decision | context, options, score, owner, confidence, impact | Traceability and memory |
| Pattern | trigger, solution, evidence, reuse count, constraints | Cross-project reuse |
| Incident | severity, timeline, root cause, fix, prevention rule | Learning and reliability |
| Release | scope, gate result, rollback, deployment state, outcome metrics | Release discipline |

## Operating Loops
### 1. Execution Loop
1. Signal or request enters intake.
2. Decision Engine scores urgency, value, risk and confidence.
3. Execution Graph creates or updates dependent nodes.
4. Agent Coordinator assigns work.
5. Quality gates evaluate outputs.
6. Pipeline moves to release, observe or remediation.

### 2. Telemetry Loop
1. Projects, agents, APIs, deployments and docs emit events.
2. Telemetry System normalizes metrics.
3. Signal Router creates alerts when thresholds or anomalies trigger.
4. Decision Engine updates priorities.
5. Operational Intelligence records trend and bottleneck movement.

### 3. Governance Loop
1. Policies define required gates and authority.
2. Runtime Governance evaluates branch, release, API, security and token rules.
3. Violations create blocking signals.
4. Overrides require owner, reason, expiry and audit record.
5. Incidents update prevention rules.

### 4. Learning Loop
1. Releases, incidents, experiments and agent outcomes create learnable artifacts.
2. Cross-Project Intelligence extracts patterns and anti-patterns.
3. Reusable prompts, architectures and workflows are promoted.
4. Future graph executions receive better defaults.

## Control Plane Topology
| Component | Input | Output |
| --- | --- | --- |
| Project Control | project docs, roadmap, gates, scores | project state, risk state, next actions |
| Agent Orchestrator | task record, available agents, constraints | assigned agent, handoff plan, review route |
| Analytics Core | events, metrics, traces | normalized telemetry and trend records |
| Scoring Engine | telemetry, gates, revenue data, docs | project score, priority, recommendation |
| Decision Engine | scores, signals, constraints, confidence | ranked decision, escalation, hold/continue |
| Workflow Engine | requested outcome, resource state | state transition, retry, rollback, learning task |
| Release Center | gate results, deployment plan, changelog | approve/block, release record, rollback readiness |
| Knowledge Graph | decisions, releases, incidents, prompts | reusable intelligence, prevention rules |

## Control States
| State | Meaning | Allowed Actions |
| --- | --- | --- |
| Observing | System is collecting telemetry only | score, alert, summarize |
| Advising | System recommends action but does not enforce | prioritize, recommend, assign draft |
| Enforcing | Gates can block workflow transitions | block, escalate, require evidence |
| Optimizing | System proposes improvements from data | prompt rewrite, workflow update, reuse pattern |
| Autonomous | Approved workflows can execute without manual trigger | route, retry, pause, escalate |

Initial implementation should operate in `Advising` for strategy and `Enforcing` for release, security, secrets, branch discipline and documentation gates.

## Non-Negotiable Controls
- No production release without release record, rollback plan and gate result.
- No external API without registry entry covering owner, auth, rate limits, cost, retries and fallback.
- No reusable pattern promotion without evidence.
- No autonomous destructive action.
- No hidden agent authority; every agent action must map to role, scope and output contract.
- No score without source, timestamp and confidence.
- No override without owner, reason, expiry and audit trail.

## Success Criteria
The Control Plane succeeds when:
- every active project has a live state, priority, owner and score;
- every workflow has a current state and next transition;
- every signal has severity, owner and response path;
- every release is gated and auditable;
- every repeated failure creates a prevention rule;
- every strong pattern becomes reusable intelligence;
- token, cost, quality, launch and revenue signals influence planning automatically.
