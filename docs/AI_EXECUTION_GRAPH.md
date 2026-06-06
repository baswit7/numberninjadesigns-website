# AI Execution Graph

## Phase 9 State

Phase 9 does not add executable graph edges.

```mermaid
flowchart LR
  Request["Execution Request Model"] --> Approval["Approval Record"]
  Request --> Risk["Risk Assessment"]
  Request --> Rollback["Rollback Plan"]
  Request --> Idempotency["Idempotency Record"]
  Approval --> Policy["Execution Policy Decision"]
  Risk --> Policy
  Rollback --> Policy
  Idempotency --> Policy
  Policy --> Boundary["Non-Executing Boundary"]
```

## Boundary

The graph is evaluative only. There is no node that dispatches work, calls providers, deploys code, reads secrets, or mutates external systems.

## Phase 10 Readiness State

Phase 10 adds readiness evaluation nodes only.

```mermaid
flowchart LR
  Plan["Execution Plan Model"] --> Step["Execution Step Models"]
  Step --> Dependency["Dependency Checks"]
  Step --> Preflight["Preflight Checks"]
  Step --> ApprovalChain["Approval Chain Readiness"]
  Step --> RollbackReady["Rollback Readiness"]
  Step --> IdempotencyReady["Idempotency Readiness"]
  Dependency --> ReadinessPolicy["Readiness Policy Decision"]
  Preflight --> ReadinessPolicy
  ApprovalChain --> ReadinessPolicy
  RollbackReady --> ReadinessPolicy
  IdempotencyReady --> ReadinessPolicy
  ReadinessPolicy --> Report["Readiness Report"]
  Report --> Boundary["Non-Executing Readiness Boundary"]
```

The readiness graph has no executable edge. A `ready-for-future-review` decision is not execution permission.

## Phase 12 Dashboard Boundary State

Phase 12 adds design-only dashboard projection boundaries. It does not add dashboard UI or runtime refresh execution.

```mermaid
flowchart LR
  GovernanceEvidence["Governance Evidence"] --> Projection["Read-Only Dashboard Projection"]
  ReadinessEvidence["Readiness Evidence"] --> Projection
  ValidationReports["Validation Reports"] --> Projection
  Projection --> View["Future Dashboard View"]
  Refresh["Composite Refresh Orchestration"] -. "separate future boundary" .-> ValidationReports
  View --> Boundary["No Runtime Mutation"]
```

The dashboard boundary graph is projection-only. A future dashboard view may display evidence and staleness, but it must not refresh, execute, deploy, call providers, read secrets, or mutate runtime state.

## Phase 13 Projection Contract State

Phase 13 adds contract and validation-interface nodes only.

```mermaid
flowchart LR
  RuntimeTruth["Runtime Truth"] --> AdapterBoundary["Dashboard Adapter Producer Boundary"]
  GovernanceDocs["Governance Documents"] --> AdapterBoundary
  ValidationReports["Validation Reports"] --> AdapterBoundary
  AdapterBoundary --> ProjectionContract["Read-Only Projection Contract"]
  ProjectionContract --> NoWriteValidator["No-Write Structural Validator Interface"]
  ProjectionContract --> PassiveDashboard["Passive Dashboard Consumption"]
  PassiveDashboard --> Boundary["No Runtime Mutation"]
```

The Phase 13 graph has no executable edge. The adapter boundary defines producer ownership for future projection JSON only; it does not implement refresh, execution, deployment, provider access, credential access, queueing, scheduling, workers, agents, or dashboard mutation.

## Phase 14 Projection Fixture Validation State

Phase 14 adds static fixture validation and timestamp-based stale-projection detection only.

```mermaid
flowchart LR
  ProjectionContract["Read-Only Projection Contract"] --> FreshFixture["Fresh Projection Fixture"]
  ProjectionContract --> StaleFixture["Stale Projection Fixture"]
  FreshFixture --> FixtureValidator["Read-Only Fixture Validator"]
  StaleFixture --> FixtureValidator
  FixtureValidator --> Boundary["No Runtime Mutation"]
```

The Phase 14 graph has no executable edge. Fixture validation reads committed JSON evidence and validates non-authoritative projection state; it does not refresh projections, write dashboard state, mutate runtime evidence, call providers, deploy, access credentials, queue work, schedule work, start workers, or run background agents.
