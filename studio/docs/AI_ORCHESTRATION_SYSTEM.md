# AI Orchestration System

## Doel
Het AI Orchestration System organiseert AI-agents als gespecialiseerde departments. Agents werken niet als losse chats, maar via taken, contracts, gates, memory rules, handoffs en escalaties.

## Organization Model
| Agent | Responsibilities | Authority Boundaries | Primary Outputs |
| --- | --- | --- | --- |
| Architect Agent | System design, boundaries, dependencies, scaling | May block architecture; cannot approve revenue assumptions alone | Architecture plan, ADR, scaling risks |
| Product Strategy Agent | Problem framing, roadmap, user value, scope | Cannot approve release without gates | Product brief, acceptance criteria |
| UI/UX Agent | UX flows, responsive behavior, interaction quality | Cannot bypass accessibility or conversion evidence | UX spec, wireflow, usability risks |
| Conversion Agent | Funnel, offer clarity, activation and CTA logic | Cannot change pricing without Revenue Agent | Conversion hypotheses and test plan |
| SEO/Growth Agent | Search intent, content architecture, channel growth | Cannot publish claims without validation | SEO brief, growth backlog |
| Revenue Agent | Pricing, monetization, demand and validation | Cannot ship payment flow without security/release gates | Revenue score, experiment plan |
| Security Agent | Secrets, auth, permissions, threat review | May hard-block release on severe risk | Security review, mitigation list |
| Debug Agent | Root cause analysis, reproduction, fix direction | Cannot deploy fixes without Release Agent | RCA, reproduction, debug plan |
| Refactor Agent | Debt reduction, modularity, duplication control | Cannot refactor outside scope without approval | Refactor plan, risk assessment |
| Release Agent | Release readiness, approvals, rollback | Owns release gate state | Release notes, rollback plan |
| Analytics Agent | Event design, KPI integrity, dashboards | Cannot define business priority alone | Metric contracts, dashboard inputs |
| Automation Agent | Repeatable workflows, runbooks, retries | Cannot automate irreversible actions without approval | Automation recipe, failure modes |
| Infrastructure Agent | Hosting, deployment, observability, cost | Cannot store secrets in repo | Infra plan, environment matrix |
| Knowledge Agent | Memory curation, pattern promotion, docs health | Cannot overwrite source of truth without evidence | Knowledge graph updates, summaries |
| Research Agent | Technical and market research synthesis | Must cite sources when external data is used | Research brief, uncertainty map |
| Market Intelligence Agent | Competitors, demand, saturation, positioning | Cannot claim validation without evidence | Market map, opportunity score |

## Input Contract
Every agent task receives:
- objective;
- project or portfolio scope;
- relevant files or documents;
- constraints and forbidden actions;
- required output format;
- current score and gate state;
- known risks;
- budget for time, tokens and tools.

## Output Contract
Every agent returns:
- decision or deliverable;
- evidence used;
- confidence level;
- risks and unresolved assumptions;
- downstream handoff target;
- recommended gate updates;
- memory items to persist;
- token and cost estimate where available.

## Communication Rules
- Agents communicate through structured task records, not free-form hidden chat.
- Agents do not rewrite another agent's decision without citing evidence.
- Conflicts escalate to Studio OS policy or human owner.
- High-risk changes require Security, Release and Architecture review.
- Commercial prioritization requires Revenue plus Product Strategy agreement.

## Handoff Protocols
| From | To | Handoff Payload |
| --- | --- | --- |
| Product Strategy | Architect | Scope, users, constraints, acceptance criteria |
| Architect | UI/UX | System boundaries, data availability, interaction constraints |
| UI/UX | Conversion | User journey, friction points, intended actions |
| Architect | Security | Data flow, auth model, integrations, threat surface |
| Build/Codex | Debug | Diff, failing checks, logs, reproduction |
| Debug | Refactor | Root cause, fragile modules, regression risks |
| Revenue | Analytics | Experiment hypothesis, funnel events, success thresholds |
| Release | Knowledge | Release result, incidents, learnings, reusable patterns |

## Escalation Logic
| Trigger | Escalates To | Required Action |
| --- | --- | --- |
| Security blocker | Security Agent and Release Agent | Stop release until mitigation or accepted risk |
| Score below threshold | Scoring Engine owner | Create recovery task and re-score |
| Repeated workflow failure | Automation Agent and Knowledge Agent | Convert into prevention rule or deprecated recipe |
| Cost spike | Infrastructure Agent and Token system | Analyze cause and reduce waste |
| Market contradiction | Revenue and Market Intelligence | Revalidate assumptions before build continues |
| Architecture conflict | Architect Agent | ADR required before implementation |

## Memory Usage
| Memory Type | Used For | Owner |
| --- | --- | --- |
| Working context | Current task execution | Active agent |
| Project docs | Product and architecture state | Project Control |
| Prompt Vault | Reusable instructions | Knowledge Agent |
| Knowledge Graph | Patterns, decisions, postmortems | Knowledge Agent |
| Changelog | Release-visible changes | Release Agent |

## Failure Handling
- Low-confidence output becomes a review task.
- Missing evidence becomes a research task.
- Broken automation becomes paused and logged.
- Conflicting agent outputs require an ADR or owner decision.
- Repeated agent failure becomes a Prompt Vault improvement issue.
