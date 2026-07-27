# API Center

## Purpose

The API Center is a read-only catalog of API integrations required by Studio OS and active projects.

## Input

- `config/api-center.config.json`

## Output

- `runtime/dashboard/api-center.view.json`

## Boundary

This service does not store secrets, expose tokens, read secret values, validate credentials, call providers, execute API requests, deploy systems, create approval systems, create agents, or create workers, queues, or schedulers.

## Refresh

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\api\generate-api-center.ps1
```
