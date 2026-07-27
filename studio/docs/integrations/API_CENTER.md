# API Center

## Purpose

The API Center gives Studio OS one central read-only overview of API integrations required by Studio OS and active projects.

It is a catalog only. It does not execute requests, validate credentials, read secrets, or call providers.

## Source Of Truth

The source document is:

```text
config/api-center.config.json
```

The generated dashboard output is:

```text
runtime/dashboard/api-center.view.json
```

The runtime view is derived from the registry and must not become the source of truth.

## Initial Providers

- OpenAI
- GitHub
- Telegram
- Notion
- Etsy
- TikTok
- Pinterest
- Instagram
- Facebook
- Vercel

## Data Model

Each provider includes:

- `providerName`
- `purpose`
- `usedByProjects`
- `status`
- `health`
- `docsReference`
- `requiredEnvironmentVariables`
- `authType`
- `scopesRequired`
- `knownLimitations`
- `nextAction`

Only environment variable names are listed. Values, tokens, credentials, and secrets are not stored.

## Generate

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\api\generate-api-center.ps1
```

## Validate

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-api-center.ps1
```

## Boundary

This capability is read-only and document-driven.

It does not:

- Store secrets.
- Expose tokens.
- Read secret values.
- Validate credentials.
- Perform API calls.
- Call providers.
- Add request execution.
- Add OAuth flows.
- Add provider health calls.
- Add deployments.
- Add approval systems.
- Add agents.
- Add workers, queues, schedulers, or background services.
- Start request-example registry work.
