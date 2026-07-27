# Project Cockpit

## Purpose

The Project Cockpit gives each supported project one read-only delivery view.

It shows:

- project status
- next task
- why this task is next
- priority score
- ROI score
- release readiness
- blockers
- highest-risk task
- review-needed count
- task counts by status
- Codex prompt path

## Cockpit Files

```text
runtime/dashboard/project-delivery.view.json
runtime/dashboard/project-cockpit.studio-os.view.json
runtime/dashboard/project-cockpit.numberninjadesigns.view.json
runtime/dashboard/project-cockpit.tok-hub.view.json
runtime/dashboard/project-cockpit.boodschappenvergelijker.view.json
```

## Why This Task

The generator produces a short reason such as:

- Highest ROI
- Blocks one or more tasks
- Required before release
- High business impact
- Quick win
- Best current priority score

## Boundary

The cockpit is visualization only. It does not approve, dispatch, execute, deploy, publish, call GitHub or call providers.
