# Studio OS API Gateway

## Purpose
The API Gateway is the controlled boundary between Studio OS frontends, backend services, external providers and future agent tools. It centralizes authentication, authorization, request validation, rate limits, CORS, retries, audit records and provider fallback behavior.

## Gateway Responsibilities
| Responsibility | Requirement |
| --- | --- |
| Authentication | identify user, agent, automation or provider |
| Authorization | enforce role, resource and action permissions |
| Validation | reject malformed commands before service execution |
| Rate limiting | protect services, providers and budgets |
| CORS | allow only approved origins and methods |
| Audit | record high-impact commands and permission failures |
| Idempotency | prevent duplicate writes and repeated automation effects |
| Provider control | enforce timeout, retry, circuit breaker and fallback |
| Response consistency | standard errors, request IDs, degraded states |

## Request Flow
```text
client/agent
  -> gateway auth
  -> rate limit
  -> schema validation
  -> permission check
  -> idempotency check
  -> service route
  -> event/audit emission
  -> normalized response
```

## API Surfaces
| Surface | Consumer | Examples |
| --- | --- | --- |
| Operator API | frontend apps | projects, scores, gates, releases, incidents |
| Agent API | AI runtime | task assignment, context package, memory retrieval |
| Automation API | approved runbooks | dry-run, execute, pause, retry, rollback |
| Provider API | external systems | GitHub, Vercel, Notion, analytics, email |
| Webhook API | provider events | deployment, issue, pull request, monitoring events |
| Internal Event API | backend services | event append, projection update, signal creation |

## Route Groups
| Route Group | Purpose |
| --- | --- |
| `/v1/projects` | project registry and state |
| `/v1/workflows` | workflow state and transitions |
| `/v1/agents` | tasks, context packages, reviews |
| `/v1/events` | event ingestion and event lookup |
| `/v1/scores` | score snapshots and recommendations |
| `/v1/releases` | gates, approvals, rollback state |
| `/v1/incidents` | incident lifecycle and postmortems |
| `/v1/knowledge` | memory retrieval, promotion, deprecation |
| `/v1/prompts` | prompt blocks, versions, metrics |
| `/v1/automations` | runbooks, schedules, runs |
| `/v1/integrations` | API records, health, auth status |

## Standard Response
| Field | Meaning |
| --- | --- |
| request_id | trace ID |
| status | success, accepted, rejected, degraded, error |
| data | response payload |
| warnings | stale data, partial result, degraded provider |
| errors | structured error objects |
| freshness | source timestamp where relevant |
| confidence | measured, inferred, manual, assumed |

## Error Model
| Code | Meaning |
| --- | --- |
| `AUTH_REQUIRED` | missing identity |
| `PERMISSION_DENIED` | actor lacks required authority |
| `VALIDATION_FAILED` | invalid request payload |
| `RATE_LIMITED` | actor or route exceeded allowed rate |
| `IDEMPOTENCY_CONFLICT` | duplicate command mismatch |
| `PROVIDER_DEGRADED` | external dependency is unstable |
| `GATE_BLOCKED` | requested action blocked by governance |
| `BUDGET_EXCEEDED` | token, cost or automation budget breached |
| `STALE_TELEMETRY` | data is too old for action |

## Rate Limit Strategy
| Actor | Limit Type |
| --- | --- |
| Human operator | generous interactive limits |
| Agent | per-task and per-resource budget |
| Automation | per-recipe execution budget |
| Webhook | provider-specific burst protection |
| External API route | provider quota-aware throttling |

## Retry And Fallback
| Failure | Behavior |
| --- | --- |
| transient provider timeout | bounded exponential retry |
| provider rate limit | pause route and emit `api.rate_limited` |
| auth failure | stop retries and require credential action |
| stale cached data | return degraded response with freshness warning |
| repeated provider failure | open incident or degraded signal |

## Security Controls
- No secrets in logs, events, prompts or frontend responses.
- API keys and tokens are stored only in approved secret storage.
- Agent routes use narrower scopes than human routes.
- Write endpoints require idempotency keys.
- Release, automation and integration changes require audit events.
- Webhooks require signature validation where provider supports it.
- CORS is deny-by-default.

## Observability
Track:
- request count by route and actor;
- latency percentiles;
- permission denials;
- validation failures;
- rate limit events;
- provider failures;
- retry count;
- degraded responses;
- idempotency conflicts;
- audit event creation.

## Implementation Readiness
The gateway should be implemented after the resource registry and event envelope exist, because every API command must produce traceable events and use stable resource IDs.
