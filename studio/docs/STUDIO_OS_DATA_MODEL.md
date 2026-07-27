# Studio OS Data Model

## Purpose
The data model makes Studio OS executable. It defines the resources, relationships, events, scores and memory objects required to operate the AI Software Factory as a live system.

## Core Resource Model
| Entity | Description | Key Relationships |
| --- | --- | --- |
| Project | Commercial or internal product under factory control | workflows, releases, scores, experiments, incidents |
| Agent | AI execution role with authority and output contract | tasks, reviews, memory writes |
| Workflow | Stateful process for intake, build, review, release and learn | tasks, gates, events |
| Task | Unit of work assigned to human or AI actor | project, agent, context package, review |
| Event | Immutable fact from app, agent, workflow, API or release | resource, correlation, telemetry |
| Signal | Interpreted event requiring attention or action | owner, severity, workflow trigger |
| Score | Calculated intelligence snapshot | metric inputs, formula version, confidence |
| Release | Versioned launch or deployment decision | gates, incidents, rollback, outcomes |
| Gate | Quality, security, revenue, docs or launch condition | release, workflow transition |
| Incident | Operational failure or severe degradation | timeline, root cause, prevention memory |
| Experiment | Revenue, UX, SEO or channel test | metrics, score impact, learnings |
| PromptBlock | Reusable prompt or context layer | agent role, success metrics, token cost |
| MemoryItem | Reusable knowledge unit | source, evidence, ranking, aging |
| APIResource | External or internal API dependency | owner, auth, limits, health, fallback |
| AutomationRecipe | Approved executable runbook | permissions, triggers, retries, audit |

## Canonical IDs
Use stable prefixed IDs:

| Prefix | Resource |
| --- | --- |
| `prj_` | project |
| `agt_` | agent |
| `wrk_` | workflow |
| `tsk_` | task |
| `evt_` | event |
| `sig_` | signal |
| `scr_` | score |
| `rel_` | release |
| `gat_` | gate |
| `inc_` | incident |
| `exp_` | experiment |
| `pmt_` | prompt block |
| `mem_` | memory item |
| `api_` | API resource |
| `run_` | automation run |

## Entity Fields
### Project
| Field | Meaning |
| --- | --- |
| id | stable `prj_` ID |
| name | display name |
| domain | ecommerce, content intelligence, SaaS, automation, internal |
| owner | accountable human owner |
| lifecycle_stage | idea, discovery, build, validation, launch, scale, maintain |
| priority | numeric operating priority |
| active_branch | current implementation branch if applicable |
| launch_target | planned launch date or stage |
| revenue_thesis | commercial hypothesis |
| risk_state | normal, watch, degraded, blocked |

### Agent Task
| Field | Meaning |
| --- | --- |
| id | stable `tsk_` ID |
| objective | concrete outcome |
| agent_role | architect, builder, reviewer, revenue, security, docs, telemetry |
| project_id | scoped project |
| context_scope | allowed context package |
| permissions | read, propose, write, execute, approve |
| token_budget | maximum context and completion budget |
| confidence_required | minimum confidence before execution |
| review_policy | none, peer, human, security, release |
| status | queued, running, waiting, review, completed, failed, escalated |

### Memory Item
| Field | Meaning |
| --- | --- |
| id | stable `mem_` ID |
| memory_type | decision, pattern, failure, prompt, architecture, launch, revenue |
| source_resource | project, release, incident, task or experiment |
| summary | compact reusable intelligence |
| evidence | references to docs, events, metrics or artifacts |
| confidence | measured, validated, inferred, draft |
| reuse_count | number of successful reuses |
| aging_score | freshness and relevance decay |
| promotion_state | draft, candidate, approved, deprecated |

## Relationships
```text
Project -> Workflow -> Task -> Agent
Project -> Release -> Gate -> GateResult
Project -> Experiment -> RevenueScore
Project -> Incident -> PreventionMemory
Event -> Signal -> WorkflowTrigger
PromptBlock -> AgentTask -> OutcomeMetric
MemoryItem -> Recommendation -> Project
APIResource -> Incident -> RiskScore
```

## Event-Derived Read Models
| Projection | Source Events | Used By |
| --- | --- | --- |
| ProjectHealthView | project, gate, incident, score, workflow events | Command Center |
| AgentWorkloadView | task, review, token, failure events | Agent Console |
| ReleaseReadinessView | gate, docs, test, incident, rollback events | Release Center |
| RevenueOpportunityView | experiment, analytics, SEO, conversion events | Revenue Intelligence |
| TokenEfficiencyView | token, prompt, retry, context events | Token Dashboard |
| KnowledgeRecommendationView | memory, reuse, failure, score events | Knowledge Graph |

## Score Model
Every score snapshot stores:
- resource ID;
- score type;
- value from 0 to 100;
- confidence from 0 to 1;
- formula version;
- input event IDs or input hash;
- freshness timestamp;
- recommendation;
- escalation level.

## Retention
| Data | Retention Rule |
| --- | --- |
| Audit events | permanent |
| Release records | permanent |
| Score snapshots | retain history by formula version |
| Raw telemetry | time-box by volume and compliance need |
| Projections | rebuildable from event ledger |
| Prompt versions | permanent until explicitly deprecated |
| Memory items | permanent with aging and deprecation |

## Data Quality Rules
- No orphan resource records.
- No score without source and formula version.
- No event without resource or correlation context.
- No agent task without objective and permission scope.
- No memory promotion without evidence and confidence.
- No release without gate records and rollback state.
