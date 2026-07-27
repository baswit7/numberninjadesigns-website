# Autonomous Software Factory

## Doel
De Autonomous Software Factory is het overkoepelende besturingssysteem voor AI-native productontwikkeling. Het verbindt strategie, engineering, agents, kennis, revenue, kwaliteit en governance tot een herhaalbare fabriek die na elk project slimmer wordt.

## Operating Principles
| Principe | Productieregel |
| --- | --- |
| GitHub is immutable truth | Code, docs, decisions en releases worden versioned in Git. |
| Notion is long-term memory | Planning, klantinzichten en besluitnotities worden samengevat en gelinkt. |
| Codex is engineering labor | Codex voert scoped engineering- en documentatietaken uit met verificatie. |
| ChatGPT is strategic intelligence | ChatGPT helpt met analyse, prioritering en review van beslissingen. |
| Vercel is runtime infrastructure | Deployments volgen alleen na gates, secretsbeleid en rollbackplan. |
| Agents zijn departments | Gespecialiseerde agents werken via duidelijke contracts en escalation rules. |
| Revenue stuurt prioriteit | Commercial intelligence weegt mee in roadmap, release en experimenten. |
| Learning is mandatory | Iedere release, bug, prompt en experiment voedt de knowledge graph. |

## Platform Blueprint
| Laag | Rol | Belangrijkste outputs |
| --- | --- | --- |
| Studio OS | Centrale platformkernel | Project registry, policies, telemetry contracts |
| Command Center | Portfolio cockpit | Health, cost, launch, incidents, revenue |
| Agent Orchestrator | AI task routing | Agent assignments, handoffs, escalations |
| Project Control | Project execution | Roadmaps, gates, branch state, release status |
| Revenue Engine | Commercial prioritization | Revenue scores, experiments, launch strategy |
| Release Center | Controlled delivery | Approval records, deployment notes, rollback plans |
| Knowledge Graph | Compound intelligence | Decisions, patterns, lessons, anti-patterns |
| Prompt Vault | Reusable intelligence | Prompts, task templates, evaluation notes |
| Analytics Core | Feedback backbone | Events, metrics, funnels, score inputs |
| API Registry | Integration governance | Rate limits, auth, ownership, risk state |
| Quality Gates | Release enforcement | Pass/warning/blocker decisions |
| Workflow Engine | Autonomous process | Intake, routing, review, postmortem |
| Automation Center | Repeatable operations | Recipes, runbooks, monitoring rules |
| Scoring Engine | Decision intelligence | Live weighted scores and recommendations |

## Factory Lifecycle
1. Intake: capture product goal, buyer, problem, constraints and expected outcome.
2. Triage: score revenue potential, complexity, risk and strategic fit.
3. Architecture: define system boundaries, data flow, dependencies and quality gates.
4. Build: route work to agents or Codex tasks with scoped branch ownership.
5. Verify: run architecture, UX, performance, security, API and docs gates.
6. Launch: release through controlled deployment, monitoring and rollback rules.
7. Learn: write decisions, postmortems, reusable prompts and pattern updates.
8. Compound: promote reusable systems into shared libraries, templates or gates.

## Core Data Model
| Entity | Purpose | System of record |
| --- | --- | --- |
| Project | Product, market and execution container | GitHub docs plus Notion planning |
| Agent Task | Scoped unit of autonomous work | Workflow Engine |
| Decision | Architecture or product choice | GitHub ADR or Notion decision summary |
| Experiment | Commercial or UX validation | Revenue Engine and Analytics Core |
| Release | Approved deployment/change event | Git tag, changelog and Release Center |
| Pattern | Reusable solution or anti-pattern | Knowledge Graph |
| Prompt Block | Reusable AI instruction | Prompt Vault |
| Score | Live decision signal | Scoring Engine |
| Incident | Operational issue | Release Center and Knowledge Graph |

## Non-Negotiable Controls
- No production release without documented gate result.
- No new API without owner, auth model, limits, failure mode and cost profile.
- No reusable shared component without contract, tests or documented validation.
- No prompt promotion without outcome evidence.
- No revenue prioritization without measurable commercial signal.
- No hidden secrets, unmanaged dependencies or undocumented architectural decisions.

## Success Metrics
| Metric | Target behavior |
| --- | --- |
| Time to validated MVP | Decreases per comparable project type |
| Token cost per shipped outcome | Decreases through prompt reuse and summaries |
| Reuse ratio | Increases via shared systems and Prompt Vault |
| Release defect rate | Decreases through gates and postmortems |
| Revenue learning speed | Increases through structured experiments |
| Documentation health | Stays above release threshold |
| Automation coverage | Increases for repeated workflows |
