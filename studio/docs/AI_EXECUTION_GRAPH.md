# AI Execution Graph

## Doel
Het AI Execution Graph is een dynamisch besturingsmodel voor AI-native operations. Het beschrijft niet alleen taken, maar ook triggers, dependencies, priority propagation, rollback, retries, escalaties, telemetry en learning flows.

Het graph model maakt de factory uitvoerbaar: elke node heeft state, inputs, outputs, gates, owner, confidence en downstream impact.

## Phase 4 Visual Dashboard Node
Phase 4 introduceert een visual-only consumer node in de execution graph:

```text
Runtime Console -> Dashboard Adapter -> runtime/dashboard/*.json -> Visual Runtime Dashboard
```

De Visual Runtime Dashboard-node heeft geen execution authority. Hij mag runtime state, event state, telemetry state, provider state en deployment profile readiness tonen, maar mag geen graph edges maken, validaties triggeren, providers pollen of deployment state muteren.

## Graph Principles
- Work is represented as typed nodes, not free-form task notes.
- Edges carry intent: dependency, escalation, rollback, evidence, learning or priority.
- Nodes can be created by humans, agents, telemetry, signals or pipelines.
- State transitions are explicit and auditable.
- Failures generate new nodes instead of disappearing into chat history.
- Revenue, quality, risk and token signals propagate through the graph.

## Node Types
| Node Type | Purpose | Required Fields |
| --- | --- | --- |
| ProjectNode | Product or initiative under control | owner, stage, scores, risks, active pipelines |
| ObjectiveNode | Business or operational outcome | target metric, deadline, priority, confidence |
| AgentTaskNode | Work assigned to an AI or human agent | agent role, input contract, output contract, budget |
| WorkflowNode | Stateful process execution | state, transition rules, gates, retries |
| GateNode | Quality, security, release or governance control | condition, threshold, blocker level |
| SignalNode | Event requiring routing | severity, source, evidence, response SLA |
| MetricNode | Measured telemetry value | definition, source, timestamp, confidence |
| DecisionNode | Strategic or technical choice | options, chosen path, score, owner |
| IncidentNode | Failure requiring recovery and learning | severity, impact, RCA, prevention |
| PatternNode | Reusable intelligence | evidence, constraints, reuse count |
| ReleaseNode | Release package and outcome | scope, gate status, rollback, observation window |
| ExperimentNode | Revenue, UX, SEO or product test | hypothesis, metric, result, confidence |

## Edge Types
| Edge | Meaning | Propagation |
| --- | --- | --- |
| `DEPENDS_ON` | Node cannot complete before upstream node | blocker and schedule |
| `TRIGGERS` | Completion or signal creates downstream node | execution |
| `ESCALATES_TO` | Risk or failure requires higher authority | severity and SLA |
| `ROLLS_BACK` | Failure path returns system to previous state | rollback scope |
| `PROVIDES_EVIDENCE_FOR` | Output supports decision, gate or score | confidence |
| `UPDATES_SCORE` | Telemetry changes scoring model | priority |
| `PROMOTES_PATTERN` | Successful outcome becomes reusable intelligence | reuse |
| `CREATES_PREVENTION_RULE` | Incident produces gate or runbook update | governance |
| `REPRIORITIZES` | Revenue, launch or risk signal changes queue order | priority |

## Execution States
| State | Meaning | Exit Condition |
| --- | --- | --- |
| Proposed | Node exists but is not accepted | triage score and owner assigned |
| Ready | Inputs and dependencies are available | execution started |
| Running | Agent or automation is executing | output produced or failure raised |
| Waiting | Blocked by dependency, owner, API, review or telemetry | blocker resolved |
| Review | Output is ready for gate evaluation | pass, warning or blocker |
| Blocked | Gate or critical dependency failed | recovery node complete |
| Replanning | Scope, priority or architecture changed | new plan accepted |
| RollingBack | Runtime or release state is being restored | rollback verified |
| Observing | Completed output is monitored | observation window closed |
| Learned | Learning artifacts were persisted | pattern or prevention evaluated |
| Closed | No further action required | audit record complete |

## Priority Propagation
Priority is not static. It flows through dependencies and signals.

```text
effective_priority =
  base_priority
  + revenue_signal_boost
  + launch_blocker_boost
  + security_boost
  + dependency_fanout_boost
  - confidence_penalty
  - complexity_penalty
```

Propagation rules:
- A blocked launch raises priority of its blocking nodes.
- A high-revenue experiment raises priority of required analytics and release tasks.
- A repeated bug raises priority of root cause and prevention nodes.
- A severe security signal overrides revenue priority.
- A low-confidence recommendation cannot auto-propagate beyond advisory state.

## Escalation Propagation
| Trigger | Propagation Path |
| --- | --- |
| P0 security or data risk | Security Agent -> Release Agent -> Project Owner -> Factory Owner |
| Launch blocker | GateNode -> ReleaseNode -> ProjectNode -> Decision Engine |
| API instability | MetricNode -> SignalNode -> API Registry -> Debug/Infrastructure |
| Excessive token cost | MetricNode -> Token Optimization -> Prompt Vault -> Agent Coordinator |
| Repeated bug | IncidentNode -> Debug Agent -> Knowledge Graph -> Quality Gate |
| Revenue opportunity | SignalNode -> Revenue Agent -> Product Strategy -> Execution Graph |

## Rollback Propagation
Rollback is modeled as a graph path, not a panic action.

| Rollback Scope | Required Nodes |
| --- | --- |
| Documentation-only | revert decision, changelog note, owner review |
| Static frontend | previous artifact, deploy record, smoke check |
| API integration | feature flag or disabled integration, fallback mode, API owner review |
| Data change | backup point, migration reversal, integrity verification |
| Automation | pause automation, replay safety check, manual recovery route |

## Retry Logic
| Failure Class | Retry Policy | Escalation |
| --- | --- | --- |
| Temporary API failure | bounded exponential retry with jitter | API instability signal after threshold |
| Rate limit | pause until reset, lower concurrency | API Registry owner |
| Agent low confidence | reroute to review agent | Prompt Vault improvement task |
| Gate failure | no blind retry; create recovery task | responsible gate owner |
| Deployment failure | rollback first, then debug | Release and Infrastructure |
| Missing context | request compact source context | Knowledge Agent |

## Intelligence Propagation
Successful nodes update reusable intelligence when evidence is strong:
- launch success promotes launch playbook updates;
- low-cost high-success prompt promotes Prompt Vault version;
- recurring bug promotes prevention gate;
- proven SEO structure promotes reusable content pattern;
- stable architecture across projects promotes shared reference architecture.

## Example Execution Graph
```text
Revenue signal: SEO opportunity detected
  -> ObjectiveNode: increase organic acquisition
  -> AgentTaskNode: SEO/Growth analysis
  -> AgentTaskNode: Product Strategy scope
  -> WorkflowNode: SEO optimization pipeline
  -> GateNode: content quality and analytics events
  -> ReleaseNode: publish optimized asset
  -> MetricNode: ranking and conversion telemetry
  -> PatternNode: reusable SEO structure if validated
```

## Runtime Dashboard Adapter Node
Phase 3 introduces a read-only dashboard adapter node in the execution graph:

```text
Runtime Console reports and config
  -> RuntimeDashboardAdapter
  -> DashboardViewModel nodes
  -> Future CLI/Web/Notion/GitHub/Vercel/AI review surfaces
```

The adapter node is observation-only. It may transform existing runtime state into view models, but it cannot validate providers, call APIs, deploy, write secrets or create success states that are not present in the source reports.

## Operational Intelligence Node
Phase 5 adds an observation-only judgment path:

```text
DashboardViewModel nodes
  -> HistoricalSnapshotNode
  -> OperationalHealthScoreNode
  -> TrendIntelligenceNode
  -> ChangeIntelligenceNode
  -> RiskIntelligenceNode
  -> MaturityGovernanceNode
  -> ExecutiveSummaryNode
  -> VisualDashboardOperationalIntelligencePanel
```

These nodes are deterministic. They read generated dashboard state and historical snapshot summaries only. They cannot execute runtime logic, validate providers, mutate deployment state, call APIs, create credentials or expose secret values.

## Governance and Release Control Node
Phase 6 adds an advisory governance path after Operational Intelligence:

```text
Operational Intelligence outputs
  -> GovernanceScoreNode
  -> ComplianceNode
  -> ExceptionsNode
  -> ReleaseReadinessNode
  -> QualityGatesNode
  -> GovernanceDriftNode
  -> VisualDashboardGovernancePanels
```

These nodes evaluate eligibility only. They cannot approve automatically, commit, push, merge, deploy, call providers, read secrets or mutate repositories.

## Planned Studio Command Node
Phase 7 is planned as a command-preparation layer:

```text
Governance outputs
  -> ActionClassificationNode
  -> CodexPromptNode
  -> ReleaseChecklistNode
  -> HumanApprovalBoundary
```

This layer may prepare safe prompts, checklists and risk-based action plans. It remains non-executing by default; unknown or dangerous actions must classify as `BLOCKED` or `REQUIRES_APPROVAL`.

Phase 7 classifications:

| Classification | Graph Meaning |
| --- | --- |
| `SAFE_READ` | Read-only evidence gathering from allowed existing inputs |
| `SAFE_WRITE_DOCS` | Documentation-only proposal or scoped documentation update |
| `SAFE_GENERATE_PROMPT` | Prompt, checklist or handoff generation without execution |
| `REQUIRES_APPROVAL` | Useful action that needs explicit human approval before execution |
| `BLOCKED` | Unsafe, unknown or forbidden action |

## Operating Standard
No significant work should exist only as a chat instruction. It should map to a graph node with owner, state, evidence, score impact and learning path.

## Phase 9 Execution Governance Node
Phase 9 adds a governance-only review path after the AI Coordination Layer:

```text
AI Coordination Layer
  -> ExecutionRequestReviewNode
  -> ApprovalReviewNode
  -> RiskAssessmentNode
  -> RollbackReadinessNode
  -> IdempotencyReviewNode
  -> ExecutionPolicyDecisionNode
  -> HumanExecutionAuthorityBoundary
```

These nodes evaluate future execution readiness only. They cannot execute workflows, invoke agents, call providers, call OpenAI, call Anthropic, call GitHub APIs, deploy, create queues, create schedulers, create workers, create executors, read secrets or read credentials.

## Phase 10 Execution Readiness Node

Phase 10 adds a readiness-only review path after the Phase 9 Execution Governance Layer:

```text
Execution Governance Layer
  -> ExecutionPlanReadinessNode
  -> ExecutionStepReadinessNode
  -> DependencyReadinessNode
  -> PreflightReadinessNode
  -> ApprovalChainReadinessNode
  -> RollbackReadinessEvidenceNode
  -> IdempotencyReadinessEvidenceNode
  -> ReadinessDecisionNode
  -> HumanExecutionAuthorityBoundary
```

These nodes prepare structured evidence for human review only. Readiness cannot approve, start or imply execution.

## Phase 11 Readiness Dashboard Node

Phase 11 adds a visual read-only consumer after Phase 9 and Phase 10 outputs:

```text
Execution Governance Reports
Execution Readiness Reports
  -> DashboardAdapterReadModel
  -> ExecutionReadinessDashboardCenter
  -> HumanReviewSurface
```

This node displays blocked versus not-allowed state, approval visibility, rollback readiness, idempotency visibility and preflight/readiness status. It cannot execute workflows, invoke agents, call providers, deploy, mutate config, run validators or grant permission.

## Phase 12 Dashboard Runtime Boundary Node

Phase 12 adds a boundary definition around the existing Phase 11 dashboard path:

```text
RuntimeTruth
  -> DashboardAdapterProjection
  -> DashboardViewModelJson
  -> PassiveDashboardView
  -> HumanReviewSurface
```

Validators and composite refresh orchestration stay outside dashboard UI:

```text
ValidationScripts
  -> RuntimeEvidence
  -> DashboardAdapterProjection

CompositeRefreshController
  -> future approved phase only
```

This boundary has no executable edge. The dashboard may render existing view model JSON, but it cannot call providers, deploy, run validators, mutate runtime state, write dashboard-originated decisions, create queues, start workers, schedule work, read secrets, use browser storage as authority or grant execution permission.

## Phase 13 Projection Contract Boundary Node

Phase 13 adds contract and structural validation boundaries around dashboard projections:

```text
RuntimeTruth
  -> DashboardAdapterProjection
  -> ProjectionContract
  -> DashboardViewModelJson
  -> PassiveDashboardView
```

No-write validation inspects structure only:

```text
ProjectionContract
  -> NoWriteValidatorInterface
  -> BoundaryVerdict
```

This graph has no execution edge. Projection contracts cannot contain command payloads, deployment payloads, provider invocation details, credential material, browser-storage authority, queue configuration, worker configuration, scheduler configuration or executor configuration.

## Phase 14 Projection Fixture Validation Node

Phase 14 adds deterministic fixture validation and stale-projection detection:

```text
ProjectionContract
  -> ProjectionFixtureManifest
  -> FreshProjectionFixture
  -> StaleProjectionFixture
  -> ReadOnlyFixtureValidator
  -> MachineReadableValidationReports
```

The stale detection edge is timestamp-only:

```text
Fixture.generatedAt
  compared with
Manifest.sourceEvidenceObservedAt
  -> fresh | stale
```

This graph has no execution edge. The validator reads committed fixture JSON and report JSON only. It cannot call providers, deploy, mutate runtime state, write dashboard-originated decisions, create queues, start workers, schedule work, read secrets, use browser storage as authority or grant execution permission.
