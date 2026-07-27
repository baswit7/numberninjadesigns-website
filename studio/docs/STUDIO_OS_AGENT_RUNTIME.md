# Studio OS Agent Runtime

## Purpose
The Agent Runtime turns AI agents from static roles into orchestrated execution units with lifecycle state, scoped context, permissions, memory retrieval, handoffs, reviews, failure recovery and telemetry.

## Runtime Lifecycle
```text
intake
  -> task creation
  -> context package build
  -> agent selection
  -> permission check
  -> execution
  -> self-check
  -> review
  -> artifact write
  -> telemetry event
  -> memory extraction
```

## Agent Classes
| Agent Class | Role |
| --- | --- |
| Strategy Agent | objectives, prioritization, tradeoffs, portfolio logic |
| Architect Agent | system boundaries, data contracts, scalability, governance |
| Codex Implementation Agent | code, tests, docs, local verification |
| UX Agent | cockpit ergonomics, flows, visual hierarchy, accessibility |
| Revenue Agent | monetization, experiments, channel opportunities |
| Telemetry Agent | events, metrics, score inputs, anomaly rules |
| Security Agent | auth, secrets, permissions, audit, threat review |
| Release Agent | gates, changelog, deployment readiness, rollback |
| Knowledge Agent | memory extraction, pattern ranking, prompt promotion |
| Debug Agent | root cause, reproduction, recovery and prevention |

## Task Assignment
Every task requires:
- objective;
- resource scope;
- accepted inputs;
- expected outputs;
- permission level;
- token budget;
- deadline or priority;
- required confidence;
- review route;
- failure policy.

## Context Routing
Agents never receive unlimited context by default.

| Context Layer | Contents | Used When |
| --- | --- | --- |
| Mission Context | objective, success criteria, constraints | every task |
| Resource Context | project, release, API or workflow state | scoped execution |
| Contract Context | schemas, event contracts, gate rules | integration work |
| Memory Context | relevant patterns, failures, prompts | repeatable decisions |
| Evidence Context | logs, diffs, metrics, docs | debugging and review |
| Exclusion Context | forbidden actions, blocked paths | high-risk work |

## Agent Communication
Handoffs use a structured envelope:

| Field | Meaning |
| --- | --- |
| handoff_id | stable record ID |
| from_agent | source role |
| to_agent | target role |
| objective | remaining outcome |
| current_state | what is true now |
| completed_work | evidence-backed summary |
| risks | active risks and blockers |
| context_refs | relevant docs, events, files, scores |
| next_action | proposed action |
| confidence | confidence and reason |

## Execution Permissions
| Permission | Allowed |
| --- | --- |
| Read | inspect docs, state and telemetry |
| Propose | create plan, recommendation or draft |
| Write Docs | edit documentation and memory artifacts |
| Write Code | edit code within scoped project |
| Run Local Checks | execute local non-destructive validation |
| Manage Release | update release records and gate state |
| Execute Automation | run approved runbooks within limits |
| Approve | human-only unless explicitly delegated |

Destructive actions, production deploys, secret changes and external billing changes require human approval.

## Review Pipelines
| Work Type | Required Review |
| --- | --- |
| Documentation-only architecture | architect self-check plus changelog |
| Runtime code | tests, lint/build where available, code review |
| Security-sensitive change | security review and audit note |
| Release change | release gate review and rollback state |
| Automation action | dry-run result and owner approval |
| Revenue experiment | metric source and observation window |

## Failure Recovery
| Failure | Recovery |
| --- | --- |
| Low confidence | ask reviewer or split task |
| Token budget breach | compress context, route memory, retry once |
| Tool failure | record diagnostic, fallback path, escalate if repeated |
| Gate failure | create remediation task and block transition |
| Agent conflict | route to Strategy or Architect Agent |
| Repeated defect | create Knowledge Graph prevention memory |
| External dependency failure | degrade, retry with backoff, open incident if critical |

## Multi-Model Routing
The runtime must support:
- ChatGPT for strategic routing, analysis, review and synthesis;
- Codex for repository implementation, local validation and technical edits;
- future specialized models for retrieval, reasoning, vision, code review, security and analytics.

Routing decisions use:
- task type;
- required tools;
- context size;
- risk level;
- latency sensitivity;
- token cost;
- historical success rate;
- required output format.

## Intelligent Context Compression
Compression happens before model execution when:
- task has high token load;
- context repeats known project state;
- historical memory is available;
- agent only needs a contract subset;
- execution can be isolated by resource.

Compression output must include:
- retained facts;
- dropped context categories;
- uncertainty;
- source references;
- maximum safe use.

## Agent Telemetry
Record:
- task duration;
- token input/output;
- retry count;
- confidence;
- review corrections;
- failure reason;
- context package size;
- memory items used;
- artifacts produced;
- downstream gate outcome.

## Runtime Success Criteria
The Agent Runtime is ready when every AI task can be answered by:
- who assigned it;
- why this agent received it;
- what context it saw;
- what permissions it had;
- what it changed;
- what review happened;
- what it cost;
- what memory it produced.
