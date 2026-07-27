# AI Workforce Boundaries

## Purpose

This document defines the V2.1 execution boundaries for the future Studio OS AI Workforce.

V2.1 creates no execution capability. It only defines what future agents may plan, what they must not do, what requires human approval, and which failure modes must be handled before execution layers are introduced.

## Non-Execution Rule

In V2.1, every AI Workforce output is one of:

- architecture recommendation
- role definition
- ownership model
- workflow model
- approval model
- risk model
- escalation model
- implementation roadmap

No V2.1 output may be treated as execution authority.

## Forbidden Capabilities

The AI Workforce architecture must not introduce:

- workers
- queues
- executors
- provider calls
- GitHub mutations
- deployments
- API execution
- credential storage
- secret storage
- autonomous actions
- background services
- scheduled jobs
- task runners
- AI execution

## Execution Boundary Model

| Boundary | V2.1 Allowed | V2.1 Forbidden | Future Gate Before Execution |
| --- | --- | --- | --- |
| Filesystem | Document architecture only | Mutating code, config, runtime, generated reports outside requested docs | Explicit human-approved implementation task |
| GitHub | Describe future GitHub layer | Commit, push, branch, PR, issue mutation through workforce | V2.2 GitHub Execution Layer with approval and audit |
| APIs | Catalog and plan API use | Call providers, test credentials, refresh tokens, store keys | V2.3 API Execution Layer with rate limits, retries and credential boundary |
| Deployment | Plan environments and rollback | Deploy, promote, rollback, mutate hosting | V2.4 Deployment Layer with release approval |
| Scheduling | Describe workflow order | Background jobs, recurring tasks, autonomous loops | V2.5 runner with pause, audit and kill switch |
| Secrets | Reference required env var names | Read, print, store or generate secrets | Dedicated secret manager integration, never repo storage |
| Social publishing | Plan content and SEO | Publish, schedule posts, interact with platforms | Human approval plus platform-specific execution adapter |
| Code generation | Define intended code-generation workflow | Generate or apply agent-produced code automatically | Human-selected task plus review and QA gates |

## Approval Model

| Action Type | Required Human Approval | Required Agent Review Before Approval |
| --- | --- | --- |
| Any repository mutation | Yes | Architect for architecture changes, Developer for implementation plan, QA for test impact |
| Any GitHub mutation | Yes | Orchestrator, Developer, QA when code-related |
| Any provider/API call | Yes | Security, Research or Product depending on domain |
| Any credential use | Yes | Security |
| Any deployment action | Yes | Deployment Planning, QA, Security, Product |
| Any paid API or spend action | Yes | Product plus human business owner |
| Any social publish action | Yes | Marketing, SEO, Product |
| Any irreversible action | Yes, explicit and separate | Security plus responsible domain owner |
| Any blocker override | Yes, with accepted-risk note | Blocking agent plus Orchestrator |

## Approval States

| State | Meaning |
| --- | --- |
| proposed | Agent recommends a plan or action. |
| reviewed | Relevant domain agents reviewed the proposal. |
| blocked | One or more domain owners identify a blocking risk. |
| approved_by_human | Human owner explicitly approves execution in a later capable layer. |
| rejected_by_human | Human owner rejects or sends the proposal back for redesign. |
| accepted_risk | Human owner accepts a known risk after Security or domain review. |

## Forbidden Workflows

| Workflow | Why Forbidden |
| --- | --- |
| Agent plans and executes in the same step | Removes review, approval and audit separation. |
| Developer Agent self-approves generated code | Creates unchecked implementation risk. |
| Deployment Planning Agent deploys its own release plan | Confuses readiness planning with production authority. |
| Marketing or SEO Agent publishes directly | External brand and platform risk requires human approval. |
| Research Agent treats uncited external claims as facts | Stale or false evidence can pollute product and marketing decisions. |
| Orchestrator overrides Security or QA blocker | Routing authority is not domain risk authority. |
| Any agent stores credentials in repo or local docs | Secret storage must be handled by a dedicated secure layer, not workforce docs. |
| Any agent calls APIs to verify ideas in V2.1 | Provider execution is explicitly deferred to V2.3. |
| Any background process retries failed tasks autonomously | Retry and autonomy require runner design, idempotency and kill switch. |

## Allowed Workflows

| Workflow | Allowed Output |
| --- | --- |
| Product discovery planning | Product brief and acceptance criteria. |
| Architecture planning | Architecture brief, ownership map and ADR recommendation. |
| Implementation planning | Build plan, file impact map and test target list. |
| QA planning | Test matrix and acceptance checklist. |
| Documentation planning | Documentation map and update proposal. |
| Marketing planning | Positioning brief and campaign backlog. |
| SEO planning | Keyword intent map and metadata plan. |
| Deployment planning | Environment readiness checklist and rollback plan. |
| Research planning | Evidence map, uncertainty list and research questions. |

## Failure Modes

| Failure Mode | Risk | Required Response |
| --- | --- | --- |
| Ownership ambiguity | Work stalls or wrong agent decides | Orchestrator assigns one active owner or escalates to human. |
| Agent overreach | Planning layer becomes hidden execution layer | Stop workflow, document boundary breach, require architecture review. |
| Conflicting recommendations | Human receives contradictory direction | Create decision record with evidence, confidence and tradeoffs. |
| Missing evidence | Decisions built on assumptions | Research task or explicit assumption label. |
| Stale evidence | Outdated business, API or SEO decisions | Research refresh before high-impact planning. |
| Security blocker | Unsafe future execution path | Security block remains until mitigation or accepted risk. |
| QA blocker | Poor reliability or acceptance risk | QA block remains until test strategy or scope is corrected. |
| Approval bypass | Unauthorized mutation or publication | Incident record, rollback planning where relevant, boundary repair. |
| Scope creep | Platform becomes too complex before execution readiness | Product and Architect must reduce scope to minimum viable workflow. |
| Hidden autonomy | Background behavior appears before governance | Remove behavior and require V2.5 design review. |

## Escalation Model

| Trigger | Escalates To | Required Outcome |
| --- | --- | --- |
| Security blocker | Human owner, Security Agent, Orchestrator | Mitigation, rejection or accepted-risk note. |
| QA blocker | Human owner, QA Agent, Developer Agent | Test plan update, scope reduction or rejection. |
| Architecture conflict | Architect Agent, Product Agent, human owner | ADR recommendation or scope decision. |
| Business claim uncertainty | Research Agent, Marketing Agent, Product Agent | Cited evidence or claim removal. |
| Deployment readiness gap | Deployment Planning, QA, Security, Product | Readiness checklist update and no deployment approval. |
| Repeated workflow failure | Orchestrator, Documentation Agent | Workflow rewrite and knowledge update proposal. |
| Missing human approval | Orchestrator and human owner | Stop; no execution path is valid. |

## Risk Controls Required Before Later Execution

| Future Layer | Required Control |
| --- | --- |
| V2.2 GitHub Execution Layer | Human approval, diff preview, branch isolation, rollback note, audit trail. |
| V2.3 API Execution Layer | Credential boundary, rate limits, retries, timeout handling, dry-run mode, request logging without secrets. |
| V2.4 Deployment Layer | Environment map, deployment approval, rollback plan, health checks, incident path. |
| V2.5 Autonomous Project Runner | Kill switch, max budget, task lease, idempotency, pause/resume, no irreversible default actions. |
| V2.6 Software Factory | Portfolio-level policy, quality score gates, repeatable templates, human commercial approval. |

## Boundary Verdict

The safest V2.1 boundary is strict planning-only architecture with human-owned approval and no executable substrate.

Studio OS should earn execution capability in layers. The Workforce may become execution-capable only after role ownership, approval states, auditability, credential boundaries, rollback paths and failure handling are already documented and validated.
