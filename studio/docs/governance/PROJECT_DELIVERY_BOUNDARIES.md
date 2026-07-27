# Project Delivery Boundaries

## Allowed

The Project Delivery System may:

- read `config/delivery.tasks.json`
- read `config/delivery.scoring.json`
- read portfolio metadata
- calculate deterministic priority scores
- calculate deterministic ROI scores
- generate task delivery packages
- generate Codex prompts
- generate review checklists
- generate release checklists
- generate risk summaries
- generate validation plans
- generate read-only dashboard projections

## Source Of Truth

Only this file owns task truth:

```text
config/delivery.tasks.json
```

Generated files must never become task truth.

## Forbidden

The Project Delivery System must not add or perform:

- execution engine
- provider execution
- GitHub execution
- deployment execution
- agent execution
- credential access
- secret access
- automatic approval
- automatic dispatch
- branch creation
- commits
- pull requests
- merges
- publishing
- API calls
- localStorage authority
- sessionStorage authority
- queues
- workers
- schedulers
- background jobs

## Write Boundary

Generated writes are limited to:

```text
runtime/delivery/
runtime/dashboard/project-delivery.view.json
runtime/dashboard/project-cockpit.*.view.json
```

The generator must not mutate project source code, repositories, provider state, GitHub state, deployment state or credentials.

## Sprint Boundary

Sprint 1 is a practical delivery-value sprint. It is not V2.10 and not a governance phase.
