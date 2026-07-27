# API Keys Environment Setup

Studio OS keeps provider credentials outside Git. The repository contains only `.env.example` with variable names and empty values.

## Local Setup

1. Copy `.env.example` to `.env` in the repository root.
2. Fill only the keys required for the workflow you are running.
3. Keep `.env` and `.env.local` local. Both are ignored by Git.
4. Prefer shell environment variables for CI and automation. The NumberNinja launch generator reads `process.env` first and falls back to repo-root `.env`.

## Supported Variables

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI generation workflows. |
| `GITHUB_TOKEN` | GitHub repository and PR workflows. |
| `META_APP_ID` | Meta app identifier for read-only Graph API readiness context. |
| `META_APP_SECRET` | Meta app secret presence check for validated local setup. |
| `META_USER_ACCESS_TOKEN` | Meta user access token for read-only Graph API user-token validation. |
| `META_FACEBOOK_PAGE_ID` | Facebook Page identifier used for read-only Page visibility checks. |
| `META_FACEBOOK_PAGE_ACCESS_TOKEN` | Facebook Page access token for read-only Page and Instagram Business checks. |
| `META_GRAPH_API_VERSION` | Explicit Graph API version, for example the version approved for the configured Meta app. |
| `INSTAGRAM_APP_ID` | Instagram app identifier for read-only Instagram readiness context. |
| `INSTAGRAM_APP_SECRET` | Instagram app secret presence check for validated local setup. |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Instagram Business Account identifier used for read-only visibility checks. |
| `ETSY_CLIENT_ID` | Etsy OAuth client identifier. |
| `ETSY_CLIENT_SECRET` | Etsy OAuth client secret. |
| `ETSY_API_KEY` | Etsy API key used for OAuth alignment checks when available. |
| `ETSY_ACCESS_TOKEN` | Etsy OAuth access token used only for read-only user/shop readiness checks. |
| `ETSY_REFRESH_TOKEN` | Etsy OAuth refresh token stored locally after the authorization-code PKCE flow. |
| `ETSY_REDIRECT_URI` | Etsy OAuth redirect URI. |
| `TIKTOK_CLIENT_KEY` | TikTok app client key. |
| `TIKTOK_CLIENT_SECRET` | TikTok app client secret. |
| `TIKTOK_REDIRECT_URI` | TikTok OAuth redirect URI. |
| `PINTEREST_CLIENT_ID` | Pinterest app client identifier. |
| `PINTEREST_CLIENT_SECRET` | Pinterest app client secret. |
| `PINTEREST_ACCESS_TOKEN` | Pinterest OAuth access token used only for the read-only user account readiness check. |
| `PRINTIFY_API_KEY` | Printify API token for read-only shop connectivity checks. |
| `PRINTIFY_SHOP_ID` | Printify shop identifier used to verify the expected shop is visible. |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token used only for the read-only `getMe` connectivity check. |
| `EXA_API_KEY` | Exa API key used for a minimal read-only search connectivity check. |
| `PEXELS_API_KEY` | Pexels API key used for a minimal read-only media search check. |
| `PIXABAY_API_KEY` | Pixabay API key used for a minimal read-only safe-search check. |
| `GOOGLE_AI_API_KEY` | Google AI / Gemini API key used for a lightweight model list check. |
| `ARTLIST_API_KEY` | Artlist Enterprise API key for read-only catalog connectivity checks. |
| `ARTLIST_CLIENT_ID` | Artlist Enterprise client identifier for credential readiness checks. |
| `ARTLIST_CLIENT_SECRET` | Artlist Enterprise client secret presence check for validated local setup. |
| `ARTLIST_ACCESS_TOKEN` | Artlist Enterprise bearer token for read-only catalog reachability checks. |
| `VERCEL_TOKEN` | Vercel API access token. |
| `VERCEL_ORG_ID` | Vercel team or organization identifier. |
| `VERCEL_PROJECT_ID` | Vercel project identifier. |
| `POSTMAN_API_KEY` | Postman API access key. |
| `NOTION_TOKEN` | Notion integration token. |

## Safety Rules

- Never commit `.env` or `.env.local`.
- Never paste credential values into docs, runtime reports, dashboard JSON, browser storage, prompts, or logs.
- Scripts may report missing variable names, but must not print values.
- `provider-health.ps1` checks credential presence only. It reads repo-root `.env` first and process environment second, and reports only `envVarName`, `hasCredential`, and `source`.
- Browser `localStorage` and `sessionStorage` are not approved secret stores.
- Run `.\scripts\validation\validate-env-secret-safety.ps1` before committing env-flow changes.
- Run `.\scripts\validation\validate-api-connections.ps1` to verify OpenAI, GitHub, Notion, Etsy, Printify, Vercel, Postman, Telegram, Exa, Pexels, Pixabay, Google AI, Pinterest OAuth readiness, Facebook and Instagram without printing credential values.
- The API validator writes sanitized status only to `runtime/api-connections/api-status.report.json` and `runtime/dashboard/api-connections.view.json`.
- Run `.\scripts\validation\validate-env-secret-safety.ps1` after generating runtime output; it fails if local `.env` values or token patterns appear in `runtime`, `runtime/dashboard`, `runtime/api-connections`, or `docs`.
- Telegram validation is limited to `getMe`; it never sends messages.
- Vercel validation is limited to read-only user/project context and never deploys.
- Google AI validation uses model listing only; it does not run generation.
- Pinterest validation is OAuth-readiness only unless `PINTEREST_ACCESS_TOKEN` exists; with a token it calls only the read-only user account endpoint and never creates pins, changes boards, publishes, posts, or schedules.
- Meta Social uses `META_FACEBOOK_PAGE_ACCESS_TOKEN` for both the Facebook Page and linked Instagram Business Account. It performs only Graph API `GET` requests and never posts, comments, publishes, schedules, advertises, or changes account settings.
- Etsy OAuth alignment preserves the existing client-id/client-secret ping. If `ETSY_ACCESS_TOKEN`, `ETSY_REFRESH_TOKEN`, and `ETSY_REDIRECT_URI` exist, it calls only a read-only Etsy user endpoint and never creates listings, changes listings, publishes, or mutates shop data.

## Etsy OAuth PKCE

Use the local helper only from the repository root. It reads `.env`, creates a one-time PKCE verifier under ignored `.tmp`, and never prints token values.

1. Generate the manual authorization URL:

```powershell
.\scripts\integrations\etsy-oauth.ps1 -Start
```

2. Open the printed Etsy authorization URL manually and approve the requested read-only scopes.
3. Copy the full redirected callback URL from the browser address bar.
4. Exchange the callback code for tokens and write them to ignored `.env`:

```powershell
.\scripts\integrations\etsy-oauth.ps1 -Complete -CallbackUrl "<full callback URL>"
```

5. Validate token presence and the read-only Etsy user endpoint:

```powershell
.\scripts\integrations\etsy-oauth.ps1 -Validate
.\scripts\validation\validate-api-connections.ps1
```

The helper does not create webhooks, endpoints, listings, deployments, browser storage, or public pages.
