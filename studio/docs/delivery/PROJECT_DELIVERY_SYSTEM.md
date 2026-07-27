# Project Delivery System

## Purpose

Studio OS Sprint 1 adds a practical delivery layer.

It answers:

- what should Bas build next?
- why is that task next?
- what exact Codex prompt should be used?
- what acceptance criteria, review checklist and release checklist apply?

This is not V2.10 and not a governance phase.

## Source Of Truth

Task truth lives only in:

```text
config/delivery.tasks.json
```

Generated runtime files and dashboard projections are derived output only.

## Capabilities

- Project Task Intake
- Project Prioritization
- Delivery Board
- Task Generator
- Project Cockpit

## Supported Projects

| Project | Project type |
| --- | --- |
| Studio OS | platform |
| NumberNinjaDesigns | ecommerce |
| TOK Hub | content |
| BoodschappenVergelijker | product |

## Generated Output

```text
runtime/delivery/tasks/
runtime/delivery/prompts/
runtime/delivery/checklists/
runtime/delivery/project-delivery.report.json
runtime/delivery/project-priorities.report.json
runtime/delivery/delivery-board.report.json
runtime/dashboard/project-delivery.view.json
runtime/dashboard/project-cockpit.studio-os.view.json
runtime/dashboard/project-cockpit.numberninjadesigns.view.json
runtime/dashboard/project-cockpit.tok-hub.view.json
runtime/dashboard/project-cockpit.boodschappenvergelijker.view.json
```

## Practical Use

Bas opens `runtime/dashboard/project-delivery.view.json`, finds the next task for each project, checks why it is next, then opens the linked Codex prompt.

The system generates planning artifacts only. It does not execute the task.

## Validation

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-project-delivery.ps1
```

The validator regenerates delivery output and verifies registry fields, scoring, generated artifacts, dashboards and boundaries.
