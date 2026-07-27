# API Connection Validation

Studio OS validates live API connectivity with a narrow, read-only PowerShell layer. The layer exists only to confirm whether approved providers are configured and reachable.

## Command

```powershell
.\scripts\validation\validate-api-connections.ps1
```

Console output is limited to provider status labels:

```text
notion: connected
openai: connected
github: connected
meta-user: failed
meta-facebook-page: failed
meta-instagram-business: failed
etsy: connected
printify: connected
vercel: connected
postman: connected
telegram: connected
exa: connected
pexels: connected
pixabay: connected
google-ai: connected
pinterest: oauth-readiness
```

Allowed labels are `connected`, `missing`, `failed`, `not-configured`, `oauth-readiness`, and `unknown`.

## Validation Modes

Every provider status includes an explicit `validationMode`:

- `live`: performs an approved read-only connectivity check.
- `presence-only`: checks required variable presence without provider calls.
- `oauth-readiness`: checks OAuth setup fields only; no token exchange.
- `webhook-secret-only`: checks webhook secret presence only.
- `disabled`: cataloged but not enabled for this validation phase.

## Credential Boundary

- Credentials are read only from repo-root `.env`.
- `.env` remains ignored by Git.
- `.env.example` contains variable names with empty placeholder values only.
- The validator does not read credentials from shell environment variables.
- The validator does not print, log, commit, or write credential values.
- Runtime reports store provider names, status labels, env variable names, timestamps, and safety boundaries only.

## Provider Health Boundary

`validate-api-connections.ps1` is the source of truth for live, configuration, and OAuth-readiness checks. It can call approved read-only provider endpoints when a provider validation mode allows it.

`provider-health.ps1` is a credential-presence health check only. It does not call providers. It uses the same safe credential source boundary as the API validation layer: repo-root `.env` first, then process environment as a fallback. Its report exposes only credential metadata (`envVarName`, `hasCredential`, `source`) and never credential values.

## Runtime Report

The validator writes the canonical sanitized report:

```text
runtime/api-connections/api-status.report.json
```

For dashboard auto-load it also writes:

```text
runtime/dashboard/api-connections.view.json
```

The report and dashboard projection contain no secret values, token fragments, OAuth codes, refresh tokens, bearer tokens, client secrets, API keys, or provider response bodies. The old `runtime/api-connections/api-connection-validation.report.json` path is maintained as a compatibility mirror with the same sanitized payload.

## Dashboard Auto-Load

`apps/studio-dashboard/index.html` loads `runtime/dashboard/api-connections.view.json` through the existing dashboard loader. The API section shows only:

- provider
- status
- validationMode
- lastChecked
- safeMessage
- requiredAction
- required environment variable names

The dashboard has no API-key input, no browser secret storage, and no provider execution authority.

## Provider Usage

| Provider | Env vars | Used for | Validation request |
| --- | --- | --- | --- |
| Notion | `NOTION_TOKEN` | Studio OS knowledge base, documentation context, and workspace memory checks. | Read-only current integration user lookup. |
| OpenAI | `OPENAI_API_KEY` | Studio OS generation, analysis, and model-backed workflows when explicitly activated. | Read-only model metadata lookup. |
| GitHub | `GITHUB_TOKEN` | Repository, pull request, issue, and CI visibility for development delivery. | Read-only authenticated user lookup. |
| Etsy | `ETSY_CLIENT_ID`, `ETSY_CLIENT_SECRET`; optional `ETSY_API_KEY`, `ETSY_ACCESS_TOKEN`, `ETSY_REFRESH_TOKEN`, `ETSY_REDIRECT_URI` | NumberNinjaDesigns shop/listing visibility and commerce workflow readiness. | Existing read-only Open API ping remains supported. If `ETSY_ACCESS_TOKEN`, `ETSY_REFRESH_TOKEN`, and `ETSY_REDIRECT_URI` are present, the validator performs only a read-only user endpoint check. |
| Printify | `PRINTIFY_API_KEY`, `PRINTIFY_SHOP_ID` | NumberNinjaDesigns print-on-demand shop visibility for Etsy sales channel readiness. | Read-only shop list lookup. |
| Vercel | `VERCEL_TOKEN`; optional `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Hosting account readiness and project context. | Read-only user endpoint; no deployments. |
| Postman | `POSTMAN_API_KEY` | API workspace readiness. | Read-only account endpoint. |
| Telegram | `TELEGRAM_BOT_TOKEN` | Bot credential readiness. | `getMe` only; never `sendMessage`. |
| Exa | `EXA_API_KEY` | Search provider readiness. | Minimal read-only search with one result. |
| Pexels | `PEXELS_API_KEY` | Media search readiness. | Minimal read-only search with one result. |
| Pixabay | `PIXABAY_API_KEY` | Media search readiness. | Minimal read-only search with safe search and three results. |
| Google AI / Gemini | `GOOGLE_AI_API_KEY` | Gemini API readiness. | Lightweight model list endpoint; no generate call. |
| Pinterest | `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET`; optional `PINTEREST_ACCESS_TOKEN` | OAuth readiness for future Pinterest workflows. | If app credentials exist without an access token, returns `oauth-readiness` without a provider call. If an access token exists, calls only the read-only user account endpoint; no pins, boards, publishing, posting, or scheduling. |

## Non-Goals

This layer does not start automation, publishing, deployment, queue processing, content generation, provider execution, product creation, product publishing, order creation, ad creation, messaging, posting, OAuth bridge flows, token minting, or provider settings changes.

Etsy token acquisition is handled separately by `scripts/integrations/etsy-oauth.ps1`, a local-only manual PKCE helper. It generates the Etsy authorization URL, validates callback state, exchanges the callback code for OAuth tokens, writes only to ignored `.env`, and performs a read-only user endpoint check without printing token values.
