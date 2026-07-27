# Portfolio Dashboard

## Purpose

The Portfolio Dashboard gives Bas one read-only overview of active projects, health, priority, next action, risks, and readiness.

## Inputs

- `config/portfolio.projects.json`

## Output

- `runtime/dashboard/portfolio.view.json`

## Boundary

This service is document-driven and local-only. It does not call providers, validate credentials, execute workflows, deploy, create approvals, create agents, start workers, create queues, or register schedulers.

## Refresh

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dashboard\generate-portfolio-dashboard.ps1
```
