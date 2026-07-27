# AI Signal Routing

## Doel
AI Signal Routing is het air-traffic-control systeem voor AI operations. Het classificeert signalen, bepaalt prioriteit, routeert naar agents of pipelines en bewaakt escalaties tot de response is afgerond.

## Signal Taxonomy
| Signal | Meaning | Primary Route |
| --- | --- | --- |
| `launch.blocked` | Release cannot continue | Release and gate owner |
| `revenue.opportunity` | New or stronger commercial signal | Revenue and Product Strategy |
| `api.instability` | API timeout, rate limit, auth or provider issue | API Registry, Debug, Infrastructure |
| `scaling.risk` | Cost, latency, complexity or volume pressure | Architect and Infrastructure |
| `bug.repeated` | Same root cause or symptom class recurring | Debug and Knowledge |
| `conversion.low` | Funnel performance below target | Conversion and Analytics |
| `seo.opportunity` | Search demand or ranking opening | SEO/Growth |
| `prompt.degradation` | Higher correction, lower success or higher token cost | Prompt Vault and Knowledge |
| `deployment.instability` | Failed deploy, rollback or error spike | Release and Infrastructure |
| `token.excessive` | Token use exceeds budget or value | Token Optimization |
| `docs.drift` | Docs no longer match system state | Knowledge and Project Owner |
| `security.blocker` | Secrets, auth, permission or data risk | Security and Release |
| `automation.failure` | Workflow failed, retried out or unsafe state | Automation and Workflow |

## Priority Levels
| Level | Definition | Response |
| --- | --- | --- |
| P0 | Stop-the-line safety, data, security or destructive automation risk | pause affected workflow immediately |
| P1 | Release, revenue or core workflow blocked | owner response before next transition |
| P2 | Important degradation or recurring risk | prioritized recovery task |
| P3 | Early warning or optimization opportunity | backlog with owner |
| P4 | Informational learning event | aggregate and index |

## Routing Logic
```text
route =
  classify(signal_type)
  + severity
  + impacted_resource
  + current_pipeline_state
  + confidence
  + owner availability
  + governance rules
```

Routing rules:
- Security blockers override all business priority.
- Launch blockers route to Release plus the failing gate owner.
- Revenue opportunities route to Revenue first, not directly to Build.
- API instability routes to API Registry before feature expansion.
- Repeated bugs route to Debug and Knowledge for prevention.
- Token excess routes to Prompt Vault when caused by prompts and Infrastructure when caused by runtime/tooling.

## Escalation Paths
| Signal | Escalation Path |
| --- | --- |
| `security.blocker` | Security -> Release -> Project Owner -> Factory Owner |
| `launch.blocked` | Gate Owner -> Release -> Project Owner |
| `api.instability` | API Registry -> Debug -> Infrastructure -> Product |
| `deployment.instability` | Release -> Infrastructure -> Debug |
| `bug.repeated` | Debug -> Knowledge -> Quality Gates |
| `revenue.opportunity` | Revenue -> Product Strategy -> Decision Engine |
| `token.excessive` | Token Optimization -> Prompt Vault -> Agent Coordinator |
| `conversion.low` | Conversion -> Analytics -> Product Strategy |

## Automation Triggers
| Signal | Automation |
| --- | --- |
| launch blocked | create blocker removal graph |
| repeated bug | create prevention rule draft |
| API rate limited | pause dependent automation and mark degraded |
| token excessive | start prompt/context review |
| deployment failed | require rollback verification |
| docs drift | create documentation update task |
| SEO opportunity | create SEO analysis pipeline |
| revenue opportunity | create experiment scoring task |

## Response Orchestration
Every signal follows this lifecycle:
1. Created.
2. Classified.
3. Routed.
4. Acknowledged by owner.
5. Converted to graph node or dismissed with evidence.
6. Resolved or escalated.
7. Recorded for learning if meaningful.

## Deduplication
Signals should merge when they share:
- same resource;
- same failure class;
- overlapping time window;
- same root cause evidence.

Merged signals keep highest severity and preserve all evidence links.

## Signal Quality
Signals must not become noise. A signal requires:
- actionable route;
- resource reference;
- severity;
- evidence or confidence marker;
- expiry or review window.
