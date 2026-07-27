# GitHub Execution Service

The GitHub Execution Service is the Studio OS V2.2 offline planning layer for GitHub actions.

It generates local execution plans, audit reports and approval-state reports from the GitHub execution contract.

## Scope

Allowed:

- define GitHub execution requests
- generate execution plans
- generate audit reports
- generate approval-state reports
- model branch, commit, pull request, diff inspection, review generation and merge recommendation actions

Forbidden:

- GitHub API calls
- provider calls beyond offline GitHub planning
- credential or secret storage
- background jobs
- workers
- queues
- schedulers
- autonomous execution
- automatic merging
- automatic rebasing
- direct writes to protected branches

## Runtime Outputs

The generator writes deterministic local JSON files:

- `runtime/github-execution/github-execution.plan.json`
- `runtime/github-execution/github-execution.audit.json`
- `runtime/github-execution/github-execution-approval.report.json`

These files are planning and evidence artifacts only. They do not execute GitHub mutations.
