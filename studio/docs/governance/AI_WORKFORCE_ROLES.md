# AI Workforce Roles

## Purpose

This document defines the Studio OS V2.1 AI Workforce role catalog.

V2.1 is architecture only. It defines future worker responsibility, ownership, handoff and prohibition rules without creating workers, queues, executors, provider calls, deployments, credential storage, autonomous behavior or background services.

## Design Principle

The smallest high-value workforce is a small set of specialized planning roles with strict domain ownership and human-gated execution boundaries.

Studio OS should not start with many agents. It should start with enough roles to cover delivery planning, quality, growth and release readiness while keeping authority explicit.

## Minimum Agent Catalog

| Agent | Primary Responsibility | Owns | Produces | May Block | May Never Do |
| --- | --- | --- | --- | --- | --- |
| Orchestrator Agent | Routes work, creates task decomposition and coordinates handoffs | Workforce task graph design, routing policy, cross-agent dependency map | Workforce plan, handoff map, unresolved owner list | Ambiguous ownership, missing approval path | Execute tasks, call providers, approve its own plan, mutate repositories |
| Architect Agent | Defines system architecture, boundaries, data flow and scalability path | Architecture decisions, module boundaries, integration shape | Architecture brief, ADR recommendation, dependency and risk map | Unsafe architecture, unclear ownership, excessive complexity | Deploy, store credentials, approve security risk, publish marketing claims |
| Product Agent | Converts business goals into scoped product outcomes | User value, acceptance criteria, feature priority, project fit | Product brief, acceptance criteria, scope guardrails | Scope creep, unclear value, missing user outcome | Override architecture, approve release, make legal/commercial claims without evidence |
| Developer Agent | Plans implementation approach and future code changes | Implementation plan, code generation scope, technical task split | Build plan, file impact map, test target list | Incomplete technical spec, missing rollback path for code change | Commit, push, deploy, run provider calls, self-approve generated code |
| QA Agent | Defines test strategy, acceptance validation and regression risk | Test plan, quality gates, defect classification | Test matrix, acceptance checklist, defect risk report | Missing tests, high regression risk, failing acceptance criteria | Change production code without assignment, approve release alone, hide failed checks |
| Security Agent | Reviews secrets, data exposure, auth, permissions and irreversible actions | Security risk classification, secret boundary, permission model | Threat notes, security blockers, mitigation plan | Secret exposure, unsafe permissions, irreversible unsafe action | Accept its own high-risk exception, store secrets, weaken controls for speed |
| Documentation Agent | Maintains project knowledge, operating docs and decision traceability | Documentation structure, changelog inputs, runbook drafts | Docs plan, knowledge update proposal, decision summary | Missing source of truth, undocumented critical decision | Invent source facts, overwrite authority docs without evidence, approve product scope |
| Marketing Agent | Plans positioning, content themes and campaign direction | Messaging strategy, campaign backlog, channel fit | Marketing brief, campaign plan, content angle map | Unsupported claims, off-brand messaging | Publish content, call social APIs, change pricing, approve SEO facts without review |
| SEO Agent | Plans search visibility, information architecture and keyword intent | SEO strategy, metadata plan, content cluster map | SEO brief, keyword intent map, metadata recommendation | Keyword cannibalization, weak search intent, technical SEO risk | Publish pages, make unsupported traffic claims, execute crawls against paid APIs |
| Research Agent | Collects and synthesizes market, technical and competitor evidence | Evidence quality, uncertainty map, research citations | Research brief, confidence map, open questions | Low evidence quality, stale assumptions | Treat uncited claims as facts, execute purchases, scrape restricted sources |
| Deployment Planning Agent | Designs release path, rollout, rollback and operational readiness | Deployment plan, environment checklist, rollback strategy | Release plan, deployment readiness checklist, rollback plan | Missing rollback, unclear environment, missing owner approval | Deploy, mutate infrastructure, create credentials, approve release alone |

## Optional Later Agents

These roles should be introduced only after the minimum catalog is stable and recurring work proves the need.

| Agent | Add When | Why It Is Not First |
| --- | --- | --- |
| Analytics Agent | Product events and KPI contracts become frequent | Metrics planning can initially live under Product and QA handoffs |
| Finance Agent | Pricing, cost and margin decisions become recurring | Commercial decisions currently need human owner approval |
| Legal/Compliance Agent | Client projects require compliance review | Domain-specific risk should not be simulated as authority too early |
| Localization Agent | Multi-language delivery becomes recurring | Documentation and Marketing can plan localization until volume justifies a role |
| Customer Support Agent | Support workflows exist | No support execution layer exists in V2.1 |

## Project Coverage

| Project Type | Required Roles | Notes |
| --- | --- | --- |
| NumberNinjaDesigns | Product, Marketing, SEO, Research, Architect, Developer, QA, Documentation | Brand, search intent, content planning and conversion planning are first-class concerns. |
| TOK Hub | Product, Marketing, SEO, Research, Documentation, QA | Content planning and trend research matter more than deployment planning until execution exists. |
| BoodschappenVergelijker | Product, Architect, Developer, QA, Research, SEO, Deployment Planning | Data-source reliability, comparison logic, SEO and operational readiness must be separated. |
| Future client projects | Orchestrator, Product, Architect, Developer, QA, Documentation, Security | Client work needs clear ownership, evidence and approval traceability from the start. |

## Ownership Rules

| Ownership Type | Rule |
| --- | --- |
| One active owner | Every workforce task has exactly one active owner. |
| Domain owner | Each agent owns decisions only inside its domain. |
| Gate owner | Blocking gates belong to the agent whose domain is at risk. |
| Human owner | Execution, publication, deployment, spending, credential and external mutation approvals remain human-owned. |
| Source of truth | Existing Studio OS documents, registries and runtime reports remain source of truth until V2 implementation explicitly changes that. |
| Derived output | Agent outputs are recommendations or plans, not execution authority. |

## Responsibility Boundaries

| Boundary | Rule |
| --- | --- |
| Planning vs execution | Agents may design and recommend. They may not execute in V2.1. |
| Recommendation vs approval | Agents may recommend approval. They may not grant human approval. |
| Evidence vs assumption | Agents must label unsupported assumptions. Research must cite sources when external facts are used. |
| Ownership vs override | No agent may override another agent's blocker. Conflict escalates. |
| Code planning vs code mutation | Developer Agent may plan code changes. Actual generation or mutation belongs to later V2 phases. |
| Marketing planning vs publishing | Marketing and SEO may plan. Publication requires later execution layer plus human approval. |

## Role Interaction Matrix

| From | To | Relationship |
| --- | --- | --- |
| Orchestrator | All agents | Assigns task ownership and handoff sequence. |
| Product | Architect | Sends scoped outcome, users, constraints and acceptance criteria. |
| Product | Marketing / SEO | Sends positioning, audience and offer constraints. |
| Architect | Developer | Sends technical design, file impact and integration boundaries. |
| Architect | Security | Sends data flow, auth surface and integration risk. |
| Developer | QA | Sends implementation plan, change surface and test targets. |
| QA | Developer | Sends failed acceptance risks and regression focus. |
| Security | Architect / Developer / Deployment Planning | Sends blockers and mitigation requirements. |
| Research | Product / Marketing / SEO / Architect | Sends evidence, uncertainty and cited findings. |
| Documentation | All agents | Receives decisions, summaries and reusable knowledge. |
| Deployment Planning | Security / QA / Product | Requests readiness, rollback and approval inputs. |

## Recommended Implementation Order

1. Define static role catalog and boundaries. This is V2.1.
2. Add GitHub execution planning contracts without execution. This prepares V2.2.
3. Add API execution planning contracts without provider calls. This prepares V2.3.
4. Add deployment planning contracts without deployment. This prepares V2.4.
5. Add task runner design only after approvals, audit trail and boundaries exist.
6. Add autonomous project runner only after manual execution has proven safe and measurable.

## Final Role Verdict

The smallest useful AI Workforce is 11 roles:

- Orchestrator
- Product
- Architect
- Developer
- QA
- Security
- Documentation
- Research
- Marketing
- SEO
- Deployment Planning

This is small enough to govern and broad enough to support code generation, documentation generation, testing, review, deployment planning, marketing planning and SEO planning across Studio OS projects.
