# Studio OS Event System

## Purpose
Studio OS operates through events, signals and telemetry. Events are immutable facts; signals are interpreted operational prompts; telemetry is measured trend data; workflows are state transitions triggered by these inputs.

## Event Bus Topology
```text
event producers
  -> event gateway
  -> schema validation
  -> event ledger
  -> routing rules
  -> subscribers
  -> projections
  -> signals
  -> workflow triggers
  -> knowledge writes
```

## Event Envelope
| Field | Required | Meaning |
| --- | --- | --- |
| event_id | yes | unique `evt_` identifier |
| event_type | yes | taxonomy name |
| source_app | yes | producing app or integration |
| source_actor | yes | user, agent, automation or provider |
| resource_type | yes | project, task, release, API, score, gate |
| resource_id | yes | impacted resource |
| correlation_id | yes | links related events |
| causation_id | no | event that caused this event |
| severity | yes | info, warning, degraded, critical, emergency |
| confidence | yes | measured, inferred, manual, assumed |
| occurred_at | yes | event time |
| received_at | yes | ingestion time |
| payload | yes | typed event data |
| evidence | no | docs, logs, diff, provider reference |

## Event Taxonomy
| Domain | Event Examples |
| --- | --- |
| Project | `project.created`, `project.priority.changed`, `project.risk.changed` |
| Workflow | `workflow.started`, `workflow.transitioned`, `workflow.blocked`, `workflow.completed` |
| Agent | `agent.task.assigned`, `agent.task.started`, `agent.task.completed`, `agent.task.failed` |
| Context | `context.package.created`, `context.compressed`, `context.budget.exceeded` |
| Telemetry | `metric.recorded`, `telemetry.stale`, `anomaly.detected` |
| Score | `score.calculated`, `score.threshold_breached`, `score.recommendation.created` |
| Gate | `gate.passed`, `gate.warning`, `gate.failed`, `gate.overridden` |
| Release | `release.created`, `release.approved`, `release.blocked`, `release.observing`, `release.rolled_back` |
| Incident | `incident.detected`, `incident.mitigated`, `incident.resolved`, `incident.postmortem.completed` |
| Revenue | `experiment.started`, `experiment.result.recorded`, `revenue.opportunity.detected` |
| Knowledge | `memory.created`, `memory.promoted`, `memory.deprecated`, `pattern.reused` |
| API | `api.rate_limited`, `api.auth_failed`, `api.fallback_used`, `api.health.restored` |
| Automation | `automation.dry_run.completed`, `automation.run.started`, `automation.run.failed`, `automation.paused` |

## Signal Propagation
Signals are created from events when action may be required.

```text
event -> rule evaluation -> signal -> owner route -> workflow trigger -> score update
```

| Signal Type | Trigger | Route |
| --- | --- | --- |
| Release blocker | critical gate failure | Release Center and project owner |
| Agent escalation | low confidence or budget breach | Agent Runtime and reviewer |
| Revenue opportunity | validated lift or demand signal | Revenue Intelligence |
| Token waste | repeated context reload or high retry cost | Prompt Vault and Token Dashboard |
| API instability | rate limit, timeout, auth failure | API Control and Incident Center |
| Scaling pressure | latency, volume or cost growth | Scaling Monitor |
| Knowledge candidate | repeated solution or failure | Knowledge Graph |

## Orchestration Triggers
| Trigger | Workflow Action |
| --- | --- |
| `project.created` | initialize project control workflow |
| `agent.task.failed` | retry if budget remains, otherwise escalate |
| `gate.failed` | block release or transition |
| `score.threshold_breached` | create remediation task |
| `incident.detected` | open incident workflow and freeze risky release |
| `release.approved` | start observation window |
| `experiment.result.recorded` | recalculate revenue potential |
| `memory.promoted` | update recommendation projections |

## Telemetry Pipeline
Events become telemetry through deterministic materialization:

1. Validate schema and permission.
2. Store raw event in append-only ledger.
3. Enrich with resource, owner, project and stage.
4. Aggregate into metric buckets.
5. Calculate freshness and confidence.
6. Detect threshold breaches and anomalies.
7. Emit scores and signals.
8. Update projections for frontend cockpit.

## Quality Gate Events
Quality gates must emit structured evidence:
- gate type;
- pass/warn/fail;
- blocker level;
- evidence references;
- owner;
- remediation action;
- override availability;
- expiry date if temporary.

## Rollback Events
Rollback is a first-class event chain:

```text
incident.detected
  -> release.rollback.recommended
  -> release.rollback.approved
  -> release.rollback.started
  -> release.rollback.completed
  -> incident.mitigated
  -> memory.created
```

## Reliability Rules
- Event ingestion is idempotent by `event_id`.
- Commands use idempotency keys to prevent duplicate writes.
- Subscribers must tolerate replay.
- Projections must be rebuildable from the event ledger.
- Failed event processing goes to retry queue and then dead-letter.
- Emergency events bypass normal aggregation and create immediate signals.

## Observability
Track:
- event ingestion latency;
- validation failure rate;
- projection lag;
- subscriber failure rate;
- dead-letter count;
- signal creation count;
- stale telemetry count;
- workflow trigger success rate.
