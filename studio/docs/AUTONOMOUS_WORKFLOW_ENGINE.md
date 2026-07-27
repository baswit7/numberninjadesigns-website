# Autonomous Workflow Engine

## Doel
De Autonomous Workflow Engine bestuurt hoe werk door de factory beweegt. Het systeem routeert taken automatisch, bewaakt gates, beheert releases, detecteert incidenten en zet learnings om in herbruikbare kennis.

## Workflow State Machine
| State | Entry Criteria | Exit Criteria | Owner |
| --- | --- | --- | --- |
| Intake | Request or opportunity captured | Scope and constraints clear | Product Strategy |
| Triage | Intake complete | Priority, risk and agent route selected | Scoring Engine |
| Plan | Task accepted | Architecture, acceptance criteria and checks defined | Architect |
| Build | Plan approved | Diff or artifact produced | Codex / assigned agent |
| Review | Artifact ready | Gates pass or blockers created | Quality Gates |
| Release | Gates passed | Deployment or documented non-runtime release complete | Release Agent |
| Observe | Release complete | Metrics collected and incident window closed | Analytics Agent |
| Learn | Observation complete | Knowledge, prompts and postmortem updated | Knowledge Agent |

## Automatic Task Routing
| Task Signal | Route |
| --- | --- |
| New product idea | Product Strategy, Market Intelligence, Revenue |
| Architecture or shared system | Architect, Security if data/auth is involved |
| UI or frontend flow | UI/UX, Conversion, Analytics |
| API integration | Architect, API Registry, Security, Debug |
| Release preparation | Release, Quality Gates, Infrastructure |
| Bug or incident | Debug, Infrastructure, Knowledge |
| Repeated manual process | Automation, Workflow, Knowledge |
| Token/cost issue | Token Dominance, Prompt Vault, Knowledge |

## AI Review Pipeline
1. Diff or artifact is summarized.
2. Relevant gates are selected.
3. Agents review only their domain.
4. Blockers create recovery tasks.
5. Warnings require explicit owner acceptance.
6. Pass results flow to Release Center.
7. Learnings flow to Knowledge Graph.

## Release Approval Flow
| Step | Requirement |
| --- | --- |
| Scope freeze | Release contents listed and linked |
| Gate review | No blockers; warnings accepted |
| Deployment plan | Environment, secrets and rollback described |
| Changelog | User-visible and technical impact recorded |
| Monitoring | Success and failure signals defined |
| Approval | Release owner records decision |

## Bug Escalation
| Severity | Definition | Response |
| --- | --- | --- |
| P0 | Security, data loss, revenue-blocking outage | Immediate stop, owner escalation, postmortem |
| P1 | Core workflow broken | Debug task, release hold |
| P2 | Important degradation | Planned fix with regression check |
| P3 | Minor issue | Backlog with reproduction |

## Prompt Optimization
- Promote prompts with repeated successful outcomes.
- Rewrite prompts with low confidence, high token cost or repeated correction.
- Split prompts that mix strategy, implementation and review.
- Attach prompt blocks to task types.
- Track prompt version, average token cost and success rate.

## Quality Enforcement
| Enforcement Point | Control |
| --- | --- |
| Intake | Scope and constraints required |
| Plan | Architecture and acceptance criteria required |
| Build | Branch scope and file ownership checked |
| Review | Gate results required |
| Release | Rollback and changelog required |
| Learn | Knowledge update required for meaningful work |

## Deployment Safety
- No deployment without release record.
- No production write action without rollback plan.
- No new external API without registry record.
- No secret stored in Git.
- No automated release during active P0/P1 incident.

## Incident Detection
Signals:
- failed deployment;
- elevated error rate;
- API outage or rate-limit spike;
- cost anomaly;
- score drop;
- repeated failed automation;
- customer-impacting conversion drop.

## Postmortem Generation
Every significant incident records:
- timeline;
- detection source;
- impact;
- root cause;
- fix;
- missed signal;
- prevention rule;
- owner;
- follow-up deadline.
