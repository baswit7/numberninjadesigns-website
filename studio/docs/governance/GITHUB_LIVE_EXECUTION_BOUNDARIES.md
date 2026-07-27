# GitHub Live Execution Boundaries

## Purpose

This document defines the hard boundary for Studio OS V2.2B GitHub Live Execution.

## Allowed

- Create or confirm an allowlisted GitHub branch.
- Execute only after explicit human approval.
- Record report, audit and history evidence.
- Validate protected branch and action boundaries.

## Forbidden

V2.2B must not add:

- autonomous project runner
- Software Factory
- background workers
- schedulers
- queues
- auto-merge
- branch deletion
- rebase
- force push
- protected branch writes
- deployment execution
- provider execution beyond the governed GitHub branch proof
- secret reading or writing
- repository settings mutation
- collaborator changes
- broad API executor framework

## Protected Branches

The executor must never write directly to:

- `main`
- `master`
- `production`
- `release`

Any attempt must fail and produce audit evidence.

## Manual Recovery Path

Recovery is intentionally manual. A human repository owner may inspect the proof branch and decide whether to keep it, close related review work or remove it outside Studio OS. The V2.2B layer does not automate cleanup.

## Final Boundary Verdict

V2.2B is safe only while it remains branch-create-only, allowlist-driven, human-approved and fully audited.
