# numberninjatees.github.io
NumberNinjaTees website and verification host

## Studio OS Phase 9

This repository now includes a non-executing Execution Governance Layer for Studio OS Phase 9. It models approval, risk, rollback readiness, idempotency, and execution policy without adding provider calls, deployments, workers, queues, schedulers, or secret access.

## Studio OS Phase 10

Phase 10 adds a non-executing Execution Readiness Layer on top of Phase 9. It models future execution plans, steps, dependency checks, preflight checks, approval-chain completeness, rollback coverage, idempotency coverage, and readiness decisions. It does not execute workflows, agents, providers, deployments, queues, schedulers, workers, or external mutations.

Run validation locally:

```powershell
.\scripts\validation\validate-studio-os.ps1
.\scripts\validation\validate-execution-contracts.ps1
.\scripts\validation\validate-readiness-contracts.ps1
.\scripts\validation\validate-execution-plans.ps1
.\scripts\validation\validate-preflight-checks.ps1
.\scripts\validation\validate-approval-chains.ps1
.\scripts\validation\validate-readiness-boundaries.ps1
```
