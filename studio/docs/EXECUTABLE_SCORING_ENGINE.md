# Executable Scoring Engine

## Doel
De Executable Scoring Engine vertaalt project-, product-, engineering-, revenue- en operationsdata naar live beslissingsscores. Scores sturen prioriteit, release readiness, escalaties en agent routing.

## Score Scale
| Score | Meaning | Action |
| ---: | --- | --- |
| 0-39 | Critical | Block release and create recovery task |
| 40-59 | Weak | Escalate owner review |
| 60-74 | Acceptable | Proceed with explicit risks |
| 75-89 | Strong | Eligible for launch or scaling |
| 90-100 | Excellent | Candidate for pattern extraction |

## Core Formula
```text
score = sum(metric_value * metric_weight) / sum(metric_weight)
confidence_adjusted_score = score * confidence_factor
```

Confidence factor:
| Evidence Quality | Factor |
| --- | ---: |
| Measured production data | 1.00 |
| Validated beta data | 0.90 |
| Manual review evidence | 0.80 |
| Strong documented assumption | 0.65 |
| Unvalidated assumption | 0.45 |

## Live Project Scores
| Score | Formula Inputs | Default Weights |
| --- | --- | --- |
| Revenue Potential | demand, willingness to pay, channel fit, margin, recurrence, saturation inverse | 25, 20, 15, 15, 15, 10 |
| Launch Readiness | quality gates, deployment plan, rollback, docs, analytics, support plan | 30, 20, 15, 15, 10, 10 |
| Technical Debt | duplication inverse, modularity, testability, docs accuracy, dependency risk inverse | 20, 25, 20, 20, 15 |
| UX Quality | mobile usability, task clarity, error states, accessibility, conversion flow | 25, 20, 20, 15, 20 |
| SEO Opportunity | search demand, ranking difficulty inverse, content fit, monetization fit, freshness | 25, 20, 20, 20, 15 |
| Automation Level | repeatability, runbook coverage, retry handling, observability, manual effort inverse | 20, 20, 20, 20, 20 |
| AI Maturity | prompt reuse, agent routing, context compactness, memory writes, review quality | 20, 20, 20, 20, 20 |
| Documentation Health | README, architecture, changelog, API registry, decision traceability | 20, 25, 15, 20, 20 |
| Scaling Readiness | architecture headroom, data model, observability, cost control, operational runbooks | 25, 20, 20, 20, 15 |
| Complexity Risk | integration count inverse, unknowns inverse, team load inverse, dependency risk inverse | 25, 25, 20, 30 |
| Commercial Validation | customer proof, experiment result, pricing proof, retention signal, competitor clarity | 25, 25, 20, 15, 15 |
| Operational Stability | incident rate inverse, recovery speed, monitoring, API health, release quality | 25, 20, 20, 20, 15 |
| Velocity Score | cycle time inverse, review latency inverse, reusable assets, blocked time inverse | 30, 20, 25, 25 |
| Conversion Potential | offer clarity, activation strength, friction inverse, trust signals, follow-up path | 25, 25, 20, 15, 15 |

## Telemetry Sources
| Source | Metrics |
| --- | --- |
| GitHub | branch age, PR size, review state, changelog updates, release tags |
| Docs | architecture coverage, API registry completeness, decision traceability |
| Quality Gates | pass/warning/blocker counts |
| Analytics Core | events, funnels, incidents, cost, token consumption |
| Revenue Engine | experiments, pricing, channel performance |
| API Registry | uptime, rate limits, auth state, cost, fallback state |
| Knowledge Graph | reuse count, recurring risks, resolved patterns |
| Vercel | deployment status, performance, runtime errors when enabled |

## Escalation Triggers
| Trigger | Action |
| --- | --- |
| Launch Readiness below 80 for planned release | Release blocked |
| Security blocker present | Release blocked and Security Agent owns recovery |
| Revenue Potential below 50 and build cost high | Product Strategy review |
| Technical Debt below 60 | Refactor Agent task before scaling |
| Documentation Health below 70 | Knowledge Agent task |
| Operational Stability below 70 | Infrastructure and Debug review |
| Token cost above budget | Token Dominance review |
| Complexity Risk below 50 | Architecture review required |

## Prioritization Logic
```text
priority =
  revenue_potential * 0.25 +
  commercial_validation * 0.20 +
  launch_readiness * 0.15 +
  velocity_score * 0.10 +
  automation_level * 0.10 +
  scaling_readiness * 0.10 +
  operational_stability * 0.10
  - complexity_penalty
```

Complexity penalty:
- 0 for low complexity;
- 5 for medium complexity;
- 15 for high complexity;
- 25 for severe unknowns or unmanaged external dependencies.

## AI Recommendations
The engine recommends:
- next best project to build;
- next blocker to remove;
- required agent assignment;
- reusable patterns to apply;
- release/no-release decision;
- experiment to run before engineering spend;
- token budget reduction opportunity.
