# GitHub Sandbox Execution Boundaries

## Purpose

This document defines the safety boundary for Studio OS V2.2A GitHub Sandbox Execution.

## Allowed

- Create remote branches under `sandbox/*`, `test/*` or `experiment/*`.
- Use explicit human-approved execution only.
- Record execution report, audit and history evidence.

## Forbidden

V2.2A must not add:

- merge
- delete
- rebase
- protected branch writes
- repository settings changes
- collaborator changes
- secrets changes
- deployments
- API execution
- Software Factory
- Autonomous Project Runner

## Protected Branches

The executor must never write directly to:

- `main`
- `master`
- `production`
- `release`

Any attempt must fail and produce audit evidence.

## Final Boundary Verdict

GitHub sandbox execution is valid only while it remains branch-create-only, sandbox-target-only, human-approved and fully audited.
