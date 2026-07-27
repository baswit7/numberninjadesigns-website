# Postman Registry

## Purpose

The Postman Registry is a read-only catalog of sanitized API request examples, response examples, and collection references for providers already listed in the API Center.

It is documentation only. It does not execute requests, run collection tools, validate credentials, read private values, or call providers.

## Source Of Truth

The source document is:

```text
config/postman-registry.config.json
```

The linked API catalog is:

```text
config/api-center.config.json
```

The generated dashboard output is:

```text
runtime/dashboard/postman-registry.view.json
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

Each provider entry includes:

- `providerName`
- `collectionName`
- `collectionReference`
- `purpose`
- `linkedApiCenterProvider`
- `authType`
- `environmentVariablesUsed`
- `requestExamples`
- `responseExamples`
- `knownRisks`
- `nextAction`

## Sanitization Rules

- Only environment variable names may appear.
- Request examples use placeholder paths, shape-only bodies, and explicit notes that credential values are omitted.
- Response examples use shape-only objects and sanitized identifiers.
- Private client credentials, session material, cookies, refresh credentials, and personal credentials are not allowed.

## Generate

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\api\generate-postman-registry.ps1
```

## Validate

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-postman-registry.ps1
```

## Boundary

This capability is read-only and document-driven.

It does not:

- Execute API requests.
- Call providers.
- Validate credentials.
- Add OAuth flows.
- Run external collection tools.
- Add deployments.
- Add approval systems.
- Add agents.
- Add workers, queues, schedulers, or background services.
- Start deferred workforce or factory work.
- Create a next numbered phase.
