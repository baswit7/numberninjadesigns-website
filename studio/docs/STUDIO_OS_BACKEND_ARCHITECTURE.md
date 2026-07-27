# Studio OS Backend Architecture

## Purpose
The Studio OS backend provides the executable backbone for projects, agents, events, scores, knowledge, releases and automations. It is designed as a modular control plane with clear service boundaries and event-first integration.

## Backend Boundary Map
| Backend Module | Owns | Critical Outputs |
| --- | --- | --- |
| Resource Registry | projects, agents, workflows, APIs, prompts, releases, experiments | canonical IDs and ownership |
| Event Bus | event envelope, validation, routing, correlation | normalized events and subscriptions |
| Telemetry Service | metrics, freshness, confidence, rollups, anomalies | operational signals |
| Scoring Service | score formulas, versions, thresholds, recommendations | score snapshots and escalations |
| Workflow Service | state machines, transitions, retries, approvals | executable workflow state |
| Agent Runtime Service | task routing, context packages, permissions, review pipeline | agent assignments and outcomes |
| Knowledge Service | memory objects, ranking, propagation, aging | reusable intelligence |
| Release Service | gates, approvals, rollback plans, incident links | release records |
| Automation Service | runbooks, schedules, dry-runs, retries, pause switches | auditable automation runs |
| API Gateway | auth boundary, rate limits, CORS, request routing, audit | controlled external/internal access |

## Runtime Separation
```text
frontend apps
  -> API gateway
  -> backend application services
  -> event bus
  -> projections/read models
  -> operational databases
  -> knowledge/vector indexes
  -> external providers
```

The first implementation should start as a modular backend, not as many distributed services. Service boundaries must be real in code and data contracts, even when deployed together.

## Data Stores
| Store | Purpose | First Implementation |
| --- | --- | --- |
| Operational DB | resources, workflows, releases, scores, policies | relational schema |
| Event Ledger | append-only operational events | append-only table with typed payload |
| Projection Store | dashboard-ready read models | materialized tables |
| Knowledge Index | memory retrieval and ranking | structured memory table first, vector index later |
| Audit Log | permissions, overrides, release decisions, automation runs | immutable append-only records |
| Cache | score snapshots, registry lookups, last good telemetry | bounded TTL cache |

## Backend Request Rules
- Writes go through application services, not directly into projections.
- Cross-domain reactions happen through events.
- Every write emits an audit-relevant event.
- Every external provider call has timeout, retry, rate-limit and fallback behavior.
- Every AI action stores token cost, context scope, confidence and result.
- Every API response includes request ID for traceability.

## Service Contracts
| Contract | Required Fields |
| --- | --- |
| Resource command | command_id, actor, resource_id, intent, payload, idempotency_key |
| Event envelope | event_id, type, source, resource_id, actor, timestamp, payload, correlation_id |
| Score snapshot | score_id, resource_id, score_type, value, confidence, formula_version, inputs_hash |
| Agent task | task_id, objective, agent_role, context_scope, permissions, budget, review_policy |
| Gate result | gate_id, release_id, status, severity, evidence, owner, override_policy |
| Automation run | run_id, recipe_id, mode, status, retries, started_by, audit_ref |

## Scaling Boundaries
| Pressure | Scaling Move |
| --- | --- |
| High dashboard read volume | add projections and cache; do not query raw events live |
| High event volume | partition event ledger by tenant/project/time |
| Slow scoring | compute asynchronously and cache snapshots |
| Expensive knowledge retrieval | pre-rank memories and use scoped retrieval |
| Agent workload growth | queue by project, priority, permissions and budget |
| Automation risk | isolate workers and require approval for write actions |
| External API instability | circuit breakers, fallback data and degraded mode |

## Observability
Every backend module must emit:
- request duration and status;
- command accepted/rejected;
- event validation failures;
- projection lag;
- queue age;
- retry count;
- provider latency and failure reason;
- token cost and context size for AI operations;
- gate override and policy violation.

## Security Model
- Role-based access starts with owner, operator, reviewer, agent and viewer.
- Permission checks happen at service boundaries.
- Secrets never enter events, logs, prompts or knowledge memory.
- Agent permissions are narrower than human operator permissions.
- High-impact actions require gate evidence and explicit actor identity.
- Overrides require owner, reason, expiry and audit record.

## Failure Recovery
| Failure | Recovery |
| --- | --- |
| Event processing failure | keep event in retry queue with dead-letter path |
| Projection corruption | rebuild projections from event ledger |
| Score formula bug | version formulas and recalculate affected snapshots |
| Agent failure | retry within budget, then escalate with context and evidence |
| Provider outage | circuit-break, show degraded state, use cached last-good data |
| Automation runaway | pause switch, max retry budget and runbook kill command |

## Implementation Sequence
1. Resource Registry and event envelope.
2. Event Ledger and audit log.
3. Manual command APIs for projects, scores, gates and releases.
4. Projection models for Command Center.
5. Agent task API and review pipeline.
6. Knowledge memory API and prompt vault API.
7. Automation runbook API.
8. Provider integrations behind API Gateway.
