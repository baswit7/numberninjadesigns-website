# AI Coordination Protocol

## Doel
Het AI Coordination Protocol bepaalt hoe agents samenwerken binnen het Control Plane. Agents werken via contracts, graph nodes, gates, handoffs, confidence scores en memory writes. Dit voorkomt losse chat-uitvoering zonder traceerbaarheid.

## Coordination Principles
- One active owner per task node.
- Every handoff has input, output, evidence and next owner.
- Agents can recommend outside their domain but cannot approve outside their authority.
- Low confidence escalates to review or research.
- Repeated correction triggers prompt or contract improvement.
- Major decisions become auditable DecisionNodes.

## Agent Operating Contract
| Contract Part | Requirement |
| --- | --- |
| Objective | Concrete outcome, not vague activity |
| Scope | Project, files, docs, systems and forbidden actions |
| Inputs | Required context, telemetry, scores and constraints |
| Authority | What the agent may decide or block |
| Budget | Token, time, tool and risk budget |
| Output | Deliverable format, evidence, confidence and next action |
| Gates | Required checks before completion |
| Memory | What must be persisted to docs, graph or prompt vault |

## Coordination Roles
| Role | Control Plane Responsibility |
| --- | --- |
| Product Strategy | Converts opportunities into scoped objectives |
| Architect | Defines system boundaries, dependencies and scaling path |
| UI/UX | Designs task flows, responsive behavior and usability quality |
| Conversion | Optimizes activation, offers, funnels and trust |
| SEO/Growth | Routes search, channel and content opportunities |
| Revenue | Scores commercialization and experiment priority |
| Analytics | Defines metrics, event contracts and measurement quality |
| Security | Blocks unsafe secrets, auth, data or permission decisions |
| Debug | Finds root cause and regression prevention |
| Infrastructure | Owns deployment, observability, cost and runtime reliability |
| Release | Owns release readiness, approval and rollback state |
| Knowledge | Promotes patterns, decisions, prompts and postmortems |
| Automation | Converts repeated work into safe workflows |
| Scoring | Converts evidence into weighted priority and readiness |

## Handoff Protocol
Each handoff must include:
- source agent;
- target agent;
- objective;
- completed work;
- evidence references;
- unresolved risks;
- confidence level;
- recommended next state;
- gate updates;
- memory updates required.

## Conflict Resolution
| Conflict | Resolution |
| --- | --- |
| Revenue wants speed, Security blocks | Security block wins until mitigation or explicit accepted risk |
| Product wants scope expansion, Architect flags complexity | Decision Engine compares value, risk, capacity and confidence |
| Agent outputs contradict | Create DecisionNode with evidence and owner |
| Gate warning disputed | Release owner can accept warning; blocker requires fix or formal override |
| Automation wants irreversible action | Human approval required |

## Escalation Rules
| Trigger | Escalates To | SLA |
| --- | --- | --- |
| S0 emergency | Factory owner and responsible domain owner | immediate |
| Release blocked | Release, gate owner and Project owner | before next transition |
| Low-confidence high-impact decision | Research, Architect or Revenue based on domain | before commitment |
| Repeated agent failure | Knowledge and Prompt Vault | before reuse |
| Cost spike | Token Optimization and Infrastructure | same operating cycle |
| Missing owner | Project Control | triage before execution |

## Memory Protocol
| Outcome | Memory Target |
| --- | --- |
| Architecture decision | ADR or architecture document |
| Reusable prompt | Prompt Vault |
| Repeated bug | Knowledge Graph anti-pattern and prevention rule |
| Successful launch pattern | Cross-project pattern index |
| Revenue experiment | Revenue Engine and experiment history |
| API behavior | API Registry |
| Release result | Changelog, Release Center and Knowledge Graph |

## Agent Performance Metrics
| Metric | Use |
| --- | --- |
| Success rate | Assignment confidence |
| Correction rate | Prompt improvement trigger |
| Token per accepted output | Cost optimization |
| Handoff clarity | Coordination quality |
| Gate failure after agent output | Review requirement |
| Reuse contribution | Knowledge value |

## Minimum Coordination Standard
No agent work is considered complete unless it has:
- a clear output;
- confidence level;
- evidence;
- downstream recommendation;
- risk statement;
- memory instruction where relevant.
