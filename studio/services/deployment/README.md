# Deployment Layer

## Purpose

The Studio OS V2.4 Deployment Layer prepares deployment plans, approval reports and audit reports.

This sprint creates the deployment execution model only. It does not deploy to Vercel, GitHub Pages, static hosting or custom hosting. It does not run builds, GitHub Actions, publishing, workers, queues, schedulers or rollback execution.

## Consumed Inputs

- `config/project-templates.config.json`
- `config/portfolio.projects.json`
- `runtime/github-execution/github-execution.plan.json`
- `runtime/api-execution/api-execution.plan.json`

The Deployment Layer consumes these inputs for readiness context. It owns only deployment plans, deployment approvals and deployment audits.

## Runtime Outputs

- `runtime/deployment/deployment.plan.json`
- `runtime/deployment/deployment.audit.json`
- `runtime/deployment/deployment.approval.report.json`

## Boundary

The generator reads local JSON files and writes local JSON reports only. It does not read credential values or execute deployment commands.
