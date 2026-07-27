# AI Command Center

## Doel
Het AI Command Center is de centrale cockpit voor portfolio governance. Het geeft per project inzicht in technische status, business status, branch discipline, deployments, bugs, releases, API health, revenue status, launch readiness, AI task orchestration, prompt systems, reusable modules, token usage, automation status en scaling status.

## Cockpit Datamodel
Elke projectstatus gebruikt hetzelfde compacte schema.

| Veld | Betekenis |
| --- | --- |
| Project | Unieke projectnaam onder `projects/` |
| Stage | idea, validation, build, beta, launch, growth, maintain |
| Owner | Verantwoordelijke rol of agent |
| Active branch | Huidige feature branch of release branch |
| Release target | Eerstvolgende releaseversie of launchdoel |
| Deployment status | none, preview, production, degraded, rollback |
| API health | healthy, partial, degraded, blocked, not_applicable |
| Revenue status | unvalidated, validating, converting, scaling |
| Quality gate status | pass, warning, blocker |
| Token budget | low, normal, high, over_budget |
| Automation status | manual, assisted, automated, self-improving |

## Scoremodel
Alle scores lopen van 0 tot 100. `0-49` is blocker, `50-69` is warning, `70-84` is acceptable, `85-100` is launch-grade.

### 1. Project Health Score
Meet algemene projectgezondheid.

| Component | Gewicht |
| --- | ---: |
| Architecture clarity | 20 |
| Open bugs severity | 20 |
| Test/check coverage | 15 |
| Documentation freshness | 15 |
| Branch/release hygiene | 15 |
| API/dependency stability | 15 |

### 2. Launch Readiness Score
Meet of een project professioneel kan releasen.

| Component | Gewicht |
| --- | ---: |
| Quality gates passed | 25 |
| UX acceptance | 15 |
| Performance baseline | 15 |
| Security and secrets readiness | 15 |
| Rollback plan | 10 |
| Analytics baseline | 10 |
| Commercial validation | 10 |

### 3. Revenue Potential Score
Meet commerciele aantrekkelijkheid.

| Component | Gewicht |
| --- | ---: |
| Market size | 15 |
| Problem urgency | 15 |
| Willingness to pay | 15 |
| Recurring revenue potential | 15 |
| Distribution advantage | 10 |
| SEO/growth opportunity | 10 |
| AI leverage | 10 |
| Operational simplicity | 10 |

### 4. Technical Debt Score
Meet technische schuld. Een hoge score betekent lage schuld.

| Component | Gewicht |
| --- | ---: |
| Modular boundaries | 20 |
| Duplication control | 15 |
| Dependency discipline | 15 |
| Complexity containment | 15 |
| Testability | 15 |
| Documentation alignment | 10 |
| Refactor backlog clarity | 10 |

### 5. Automation Level Score
Meet hoeveel werk betrouwbaar geautomatiseerd is.

| Component | Gewicht |
| --- | ---: |
| Repeatable setup | 15 |
| Structure checks | 15 |
| Release checklist automation | 15 |
| API health monitoring | 15 |
| Analytics capture | 10 |
| Knowledge sync | 10 |
| Error recovery workflows | 10 |
| Agent handoff quality | 10 |

### 6. Documentation Health Score
Meet AI-readability en onderhoudbaarheid.

| Component | Gewicht |
| --- | ---: |
| Project master completeness | 20 |
| Architecture freshness | 15 |
| API registry accuracy | 15 |
| Prompt library quality | 10 |
| Decision log quality | 10 |
| Release notes quality | 10 |
| Lessons learned quality | 10 |
| Cross-linking | 10 |

### 7. AI Maturity Score
Meet hoe goed AI-agents veilig en efficient kunnen werken.

| Component | Gewicht |
| --- | ---: |
| Clear task boundaries | 15 |
| Reusable prompt blocks | 15 |
| Knowledge graph coverage | 15 |
| Quality gate integration | 15 |
| Token budget discipline | 10 |
| Agent role clarity | 10 |
| Escalation rules | 10 |
| Self-improvement loops | 10 |

## Command Center Views
| View | Gebruik |
| --- | --- |
| Portfolio Board | Alle projecten met stage, owner, scores en blockers |
| Release Board | Releases, branches, gate status en rollback readiness |
| Revenue Board | Validatie, offers, pricing, conversion en feedback |
| API Board | Integraties, rate limits, auth, secrets en health |
| Automation Board | Herhaalbare workflows, monitors en handmatige bottlenecks |
| Knowledge Board | Decisions, lessons, reusable prompts en anti-patterns |

## Escalatie
- Score onder 50: release geblokkeerd, owner moet herstelplan documenteren.
- Score 50 tot 69: release alleen als risico expliciet is geaccepteerd.
- Score 70 tot 84: release toegestaan na normale review.
- Score 85 of hoger: launch-grade, geschikt voor opschaling.

## Updatefrequentie
- Tijdens actieve bouw: na elke betekenisvolle feature branch.
- Voor release: verplicht bij release candidate.
- Na launch: binnen 48 uur met analytics en lessons learned.
- Bij incident: direct na root cause analyse.
