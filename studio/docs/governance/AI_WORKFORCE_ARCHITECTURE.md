# AI Workforce Architecture

## Purpose

Studio OS V2.1 transforms the platform direction from a Development Operating System toward an execution-capable AI Workforce Platform.

This phase defines the workforce architecture only. It does not implement workers, agents, queues, executors, provider calls, deployments, credential storage, autonomous behavior, background services, scheduled jobs or task runners.

## Repository Verification

Verification performed for:

- Repository: `C:\AI\Active\NumberNinjaDesigns Studio OS`
- Remote: `baswit7/professionele-ai-development-studio`
- Required baseline: `62df5c94c5663ece2971d50dd649907d20e2b165` or newer

Verified state:

- Local repository root resolved correctly.
- `origin` points to `https://github.com/baswit7/professionele-ai-development-studio.git`.
- Current branch is `main`.
- Local `main` equals `origin/main`.
- Local `main` is at `62df5c94c5663ece2971d50dd649907d20e2b165`.
- Required baseline is an ancestor of `main`.
- Studio OS V1 completion report states V1 is complete.
- The only untracked file is the known file `scripts/runtime/prune-dashboard-history.ps1`.

## Architecture Recommendation

The smallest architecture with maximum future value is a planning-only Workforce Control Plane made of:

1. A role catalog.
2. A task ownership model.
3. A workflow and handoff model.
4. A human approval model.
5. A boundary and prohibition model.
6. A risk and escalation model.

This creates execution readiness without execution machinery.

## Core Architecture

```text
Human Owner
  -> Workforce Request
  -> Orchestrator Agent
  -> Domain Agent Plan
  -> Cross-Agent Review
  -> Human Approval Decision
  -> Future Execution Layer
```

In V2.1 the flow stops before execution.

```text
V2.1 Boundary:
Human Owner
  -> Request
  -> Workforce architecture, roles, workflows, approvals and risks
  -> No execution
```

## Workforce Control Plane

The Workforce Control Plane is a governance concept, not a runtime service in V2.1.

| Component | Responsibility | V2.1 Artifact |
| --- | --- | --- |
| Role Catalog | Defines which agents exist and what they own | `AI_WORKFORCE_ROLES.md` |
| Boundary Model | Defines what agents may not do | `AI_WORKFORCE_BOUNDARIES.md` |
| Workflow Model | Defines valid and forbidden handoffs | This document |
| Approval Model | Defines human gates | This document and boundaries doc |
| Risk Model | Defines failure modes and escalation | This document and boundaries doc |
| Roadmap | Defines implementation sequence | This document |

## Agent Catalog

The minimum V2.1 workforce contains 11 roles:

| Agent | Reason It Exists |
| --- | --- |
| Orchestrator Agent | Prevents owner ambiguity and coordinates handoffs. |
| Product Agent | Keeps work tied to user value, scope and business outcome. |
| Architect Agent | Owns system design, boundaries and scalability. |
| Developer Agent | Plans future code generation and implementation work. |
| QA Agent | Owns acceptance, regression and test strategy. |
| Security Agent | Owns secrets, permissions, auth and irreversible action risk. |
| Documentation Agent | Keeps decisions, knowledge and operating docs traceable. |
| Research Agent | Separates evidence collection from assumptions. |
| Marketing Agent | Plans positioning, campaign direction and brand fit. |
| SEO Agent | Plans search intent, metadata and content architecture. |
| Deployment Planning Agent | Plans release path, rollout and rollback without deploying. |

## Ownership Model

| Domain | Owner | Human Approval Required For |
| --- | --- | --- |
| Task routing | Orchestrator Agent | Any transition into execution-capable layer. |
| Product scope | Product Agent | Scope commitment, commercial priority or client-facing promise. |
| Architecture | Architect Agent | Major architecture decision, cross-project pattern, irreversible dependency. |
| Code planning | Developer Agent | Repository mutation, code generation execution, merge decision. |
| Testing | QA Agent | Release acceptance, risk acceptance after failed or missing tests. |
| Security | Security Agent | Credential use, permission changes, accepted security risk. |
| Documentation | Documentation Agent | Source-of-truth replacement or governance document changes. |
| Research | Research Agent | Use of uncertain market or technical claims in high-impact decisions. |
| Marketing | Marketing Agent | Campaign publication, brand claim, paid campaign. |
| SEO | SEO Agent | Page publication, metadata deployment, SEO claim. |
| Deployment | Deployment Planning Agent | Deployment, rollback, promotion, environment mutation. |

## Workflow Model

### Standard Product-to-Delivery Planning Workflow

```text
Human Request
  -> Orchestrator
  -> Product
  -> Architect
  -> Developer
  -> QA
  -> Documentation
  -> Human Approval Decision
```

Use this for code generation planning, documentation generation planning, testing and review planning.

### Growth Planning Workflow

```text
Human Request
  -> Orchestrator
  -> Product
  -> Research
  -> Marketing
  -> SEO
  -> Documentation
  -> Human Approval Decision
```

Use this for NumberNinjaDesigns, TOK Hub, content planning, SEO planning and campaign planning.

### Deployment Planning Workflow

```text
Human Request
  -> Orchestrator
  -> Product
  -> Architect
  -> Developer
  -> QA
  -> Security
  -> Deployment Planning
  -> Human Approval Decision
```

Use this for future V2.4 release and rollout preparation. In V2.1 it produces plans only.

### Research-First Workflow

```text
Human Request
  -> Orchestrator
  -> Research
  -> Product or Architect or Marketing or SEO
  -> Documentation
  -> Human Decision
```

Use this when facts may be stale, external, market-dependent or provider-dependent.

## Workflow Rules

| Rule | Requirement |
| --- | --- |
| One active owner | Every task has exactly one active agent owner. |
| Evidence required | Every recommendation lists evidence or labels assumptions. |
| Handoff required | Every transfer includes completed work, open risks and next owner. |
| Domain gate respected | A blocker by Security, QA or Architect cannot be overridden by Orchestrator. |
| Human approval final | Execution, publication, deployment, paid spend and credential use require human approval. |
| No hidden execution | Plans must not trigger API calls, GitHub mutations, file mutations or deployments. |

## Forbidden Workflow Patterns

| Pattern | Reason |
| --- | --- |
| Plan -> execute without review | Removes quality and approval control. |
| Agent self-review | Creates blind spots and weak audit trail. |
| Orchestrator as super-admin | Routing ownership is not domain authority. |
| Security blocker override by non-security role | Weakens the highest-risk boundary. |
| Marketing/SEO direct publish | External brand impact needs human approval. |
| Research without citations for external facts | Weak evidence can corrupt strategy. |
| Background retry loops | Autonomy and retries belong to later runner design. |

## Approval Model

The approval model is intentionally simple:

| Approval Gate | Required Before |
| --- | --- |
| Human execution approval | Any future executable action. |
| Human repository approval | Any branch, commit, PR or file mutation by a future workforce layer. |
| Human provider approval | Any external API call, credential use or paid request. |
| Human deployment approval | Any deploy, promote, rollback or hosting mutation. |
| Human publication approval | Any social post, content publication or SEO metadata deployment. |
| Human accepted-risk approval | Any blocker override after domain review. |

## Execution Boundaries

| Boundary | V2.1 Position |
| --- | --- |
| Code generation | Designed as a future workflow; not executed. |
| Documentation generation | Designed as a future workflow; only V2.1 governance docs are created. |
| Testing | Test strategy only; no worker test execution. |
| Review | Review model only; no autonomous reviewer. |
| Deployment planning | Planning only; no deployment adapters. |
| Marketing planning | Planning only; no social platform calls. |
| SEO planning | Planning only; no crawlers, publishing or provider calls. |

## Risk Model

| Risk | Impact | Control |
| --- | --- | --- |
| Too many agents too early | Complexity grows faster than value | Start with 11 roles and add optional roles only after repeated need. |
| Blurred planning/execution line | Hidden automation risk | Keep V2.1 documentation-only and enforce forbidden capabilities. |
| Weak ownership | Conflicting outputs and stalled work | One active owner per task and explicit domain ownership. |
| Agent overreach | Wrong role makes high-risk decision | Domain gates and human approval model. |
| Stale external data | Bad SEO, marketing or provider choices | Research-first workflow for unstable facts. |
| Security bypass | Secret, auth or data exposure | Security blockers require mitigation or human accepted-risk approval. |
| QA bypass | Poor quality reaches execution | QA gate before release or repository mutation. |
| Deployment risk | Failed release or no rollback path | Deployment Planning Agent owns readiness only; human approves actual deployment later. |
| Cost and provider abuse | Rate limits, spend spikes, account issues | Provider calls deferred until V2.3 with explicit rate-limit and retry controls. |

## Escalation Model

| Trigger | Escalates To | Output |
| --- | --- | --- |
| Missing owner | Orchestrator and human owner | Owner assignment or task rejection. |
| Conflicting domain recommendations | Orchestrator, domain agents, human owner | Decision record with tradeoffs. |
| Security blocker | Security Agent and human owner | Mitigation, rejection or accepted-risk decision. |
| QA blocker | QA Agent, Developer Agent and human owner | Revised test plan or scope reduction. |
| Architecture blocker | Architect Agent and Product Agent | ADR recommendation or scope change. |
| Unsupported business claim | Research, Product, Marketing or SEO | Evidence update or claim removal. |
| Boundary breach | Architect, Security, human owner | Stop, document breach, repair boundary. |

## Project Fit

| Project | Workforce Value |
| --- | --- |
| NumberNinjaDesigns | Coordinates brand, Etsy, SEO, campaign, content, code and analytics planning without platform execution risk. |
| TOK Hub | Supports research-led content planning, SEO planning, documentation and future multi-platform workflow design. |
| BoodschappenVergelijker | Separates product scope, comparison architecture, data-source risk, SEO and deployment readiness. |
| Future client projects | Creates repeatable governance for project discovery, delivery planning, review and release readiness. |

## Recommended Implementation Roadmap

| Version | Capability | Scope |
| --- | --- | --- |
| V2.1 | Workforce Architecture | Roles, ownership, workflows, approvals, risks and boundaries. |
| V2.2 | GitHub Execution Layer | Human-approved branch, diff, commit and PR workflows with audit trail. |
| V2.3 | API Execution Layer | Human-approved provider calls with rate limits, retries, credential boundary and logging. |
| V2.4 | Deployment Layer | Human-approved deployment planning, environment readiness, health checks and rollback. |
| V2.5 | Autonomous Project Runner | Bounded task runner with kill switch, budget limits, pause/resume and no irreversible defaults. |
| V2.6 | Software Factory | Repeatable portfolio-level delivery system with templates, gates and measurable quality. |

## Recommended Next Step

After V2.1 is accepted, the next step is V2.2 GitHub Execution Layer design.

Do not implement GitHub execution immediately. First define:

- approval states
- branch isolation
- diff preview
- commit policy
- PR policy
- rollback notes
- audit log shape
- forbidden repository mutations

## Final Verdict

The smallest AI Workforce architecture that delivers maximum future value while minimizing complexity and risk is a planning-only workforce with 11 roles, one active owner per task, strict domain gates, mandatory human approval for execution, and no executable substrate in V2.1.

This gives Studio OS a clear path from development operating system to execution-capable AI workforce platform without crossing into hidden autonomy before the governance model is ready.
