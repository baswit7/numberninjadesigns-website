# Project Delivery System

Sprint 1 turns Studio OS delivery planning into a practical local system.

It reads:

- `config/delivery.tasks.json`
- `config/delivery.scoring.json`
- `config/portfolio.projects.json`

It writes generated planning output only:

- `runtime/delivery/tasks/`
- `runtime/delivery/prompts/`
- `runtime/delivery/checklists/`
- `runtime/delivery/project-delivery.report.json`
- `runtime/delivery/project-priorities.report.json`
- `runtime/delivery/delivery-board.report.json`
- `runtime/dashboard/project-delivery.view.json`
- `runtime/dashboard/project-cockpit.*.view.json`

The task registry remains the source of truth. Runtime and dashboard files are derived views.

## Boundary

This service does not execute tasks, call providers, call GitHub, deploy, run agents, access credentials, store secrets, approve work, dispatch work, create queues, create workers, or create schedulers.
