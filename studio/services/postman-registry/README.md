# Postman Registry

## Purpose

The Postman Registry is a read-only catalog of sanitized request and response examples linked to API Center providers.

## Input

- `config/postman-registry.config.json`
- `config/api-center.config.json`

## Output

- `runtime/dashboard/postman-registry.view.json`

## Boundary

This service does not execute collections, call providers, run external collection tools, validate credentials, store secrets, expose tokens, read secret values, deploy systems, create approvals, create agents, or create workers, queues, or schedulers.

## Refresh

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\api\generate-postman-registry.ps1
```
