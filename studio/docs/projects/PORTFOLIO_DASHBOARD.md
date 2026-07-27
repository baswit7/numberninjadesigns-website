# Portfolio Dashboard

## Purpose

The Portfolio Dashboard gives Bas one read-only overview of active projects and next actions.

It answers:

- Which projects are active or planned?
- What is the priority?
- What is the current health?
- What is the next action?
- Which risks are visible?
- What is the readiness summary?

## Source Of Truth

The source document is:

```text
config/portfolio.projects.json
```

The dashboard output is:

```text
runtime/dashboard/portfolio.view.json
```

The runtime view is generated from the registry and must not become the source of truth.

## Initial Projects

- Studio OS
- NumberNinjaDesigns
- TOK Hub
- BoodschappenVergelijker

## Data Model

Each project includes:

- `projectId`
- `projectName`
- `projectType`
- `status`
- `priority`
- `health`
- `lastActivity`
- `nextAction`
- `repoReference`
- `activeBranch`
- `openRisks`
- `readinessSummary`

The generated dashboard cards expose the same data under `details`, plus normalized dashboard `status`, `severity`, `description`, `sourceFile`, `lastUpdated`, and `actionHint` fields.

## Generate

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dashboard\generate-portfolio-dashboard.ps1
```

## Validate

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-portfolio-dashboard.ps1
```

## Boundary

This capability is read-only and document-driven.

It does not:

- Call providers.
- Validate credentials.
- Store secrets.
- Execute workflows.
- Deploy anything.
- Create approval systems.
- Create agents.
- Create workers, queues, schedulers, or background services.
- Start later V1 catalog or request-example registry work.
