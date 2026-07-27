# AI Decision Engine

## Doel
De AI Decision Engine is het strategische brein van de factory. Het zet telemetry, scoring, revenue signals, engineering risk, governance gates en cross-project intelligence om in prioriteiten en aanbevelingen.

## Decision Principles
- Decisions must optimize portfolio value, not local activity.
- Confidence is part of the score, not a footnote.
- Revenue opportunity never bypasses security, release or data safety.
- Reuse is preferred when evidence shows it reduces cost or risk.
- Technical debt is prioritized when it blocks velocity, quality, scale or revenue.
- Decisions must be traceable to signals, metrics or owner judgement.

## Core Decision Model
```text
decision_score =
  business_impact * 0.25 +
  revenue_potential * 0.20 +
  launch_readiness * 0.15 +
  engineering_impact * 0.15 +
  strategic_reuse * 0.10 +
  urgency * 0.10 +
  learning_value * 0.05
  - risk_penalty
  - complexity_penalty

confidence_adjusted_decision_score = decision_score * confidence_factor
```

## Decision Inputs
| Input | Source | Use |
| --- | --- | --- |
| Project scores | Scoring Engine | Readiness and priority |
| Revenue signals | Revenue Engine, experiments, analytics | Commercial priority |
| Quality gates | Quality Gates | Release and risk control |
| Telemetry | Analytics Core | Operational truth |
| Knowledge patterns | Knowledge Graph | Reuse and prevention |
| API health | API Registry | Integration risk |
| Token cost | Token Optimization | AI efficiency |
| Branch/release state | GitHub and Release Center | Execution readiness |
| Human owner judgement | Project owner | Context and constraints |

## Prioritization Matrices
### Project Priority
| Dimension | Weight | High Score Means |
| --- | ---: | --- |
| Revenue potential | 25 | Clear monetization path |
| Commercial validation | 20 | Evidence exists |
| Launch readiness | 15 | Can ship soon |
| Strategic fit | 15 | Supports factory direction |
| Reuse leverage | 10 | Creates reusable system |
| Operational stability | 10 | Low execution risk |
| Learning value | 5 | Produces valuable insight |

### Bug Priority
| Dimension | Weight |
| --- | ---: |
| User/revenue impact | 30 |
| Severity | 25 |
| Recurrence | 20 |
| Blast radius | 15 |
| Fix confidence | 10 |

### Automation Priority
| Dimension | Weight |
| --- | ---: |
| Manual effort saved | 25 |
| Repeat frequency | 20 |
| Failure reduction | 20 |
| Governance enforceability | 15 |
| Implementation complexity inverse | 10 |
| Cross-project reuse | 10 |

### Technical Debt Priority
| Dimension | Weight |
| --- | ---: |
| Blocks velocity | 25 |
| Causes incidents | 25 |
| Blocks scaling | 20 |
| Increases token/context cost | 10 |
| Affects multiple projects | 10 |
| Refactor confidence | 10 |

## Recommendation Types
| Recommendation | Output |
| --- | --- |
| Build next | project, scope, required agents, first gate |
| Launch next | release candidate, gaps, observation plan |
| Fix first | bug, owner, RCA path, regression gate |
| Automate next | workflow, risk class, approval model |
| Refactor next | module or docs area, impact, blast radius |
| Extract reuse | pattern, candidate projects, promotion criteria |
| Pause | reason, unblock condition, owner |
| Escalate | severity, target owner, required decision |

## Confidence Scoring
| Evidence | Factor |
| --- | ---: |
| Production telemetry | 1.00 |
| Validated experiment | 0.90 |
| Repeated cross-project evidence | 0.85 |
| Manual expert review | 0.75 |
| Strong documented assumption | 0.65 |
| Weak or stale assumption | 0.40 |

## Escalation Rules
| Condition | Action |
| --- | --- |
| High score and low confidence | Research or validation task before execution |
| High revenue and high security risk | Security review before prioritization |
| High urgency and low readiness | Create blocker removal graph |
| High recurrence bug | Debug and Knowledge prevention |
| High token waste | Prompt optimization before more execution |
| Conflicting top priorities | Owner decision with DecisionNode |

## Business Impact Model
Business impact combines:
- revenue potential;
- customer pain intensity;
- conversion or activation lift;
- market timing;
- margin and cost profile;
- retention or recurrence;
- strategic portfolio value.

## Engineering Impact Model
Engineering impact combines:
- velocity improvement;
- reliability improvement;
- reduced complexity;
- reduced token/context cost;
- improved deployment safety;
- improved reuse;
- lowered operational burden.

## Decision Output Format
Every major recommendation should contain:
- ranked option;
- score and confidence;
- evidence used;
- expected business impact;
- expected engineering impact;
- risks and mitigations;
- required agents;
- gate requirements;
- next graph nodes.
