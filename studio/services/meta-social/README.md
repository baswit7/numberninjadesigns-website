# Meta Social Connector

This service gives NumberNinjaDesigns Studio OS read-only access to the configured Facebook Page and linked Instagram Business Account.

## Credential contract

The connector reads only the ignored repository-root `.env` (or process environment variables) and requires:

- `META_GRAPH_API_VERSION`
- `META_FACEBOOK_PAGE_ID`
- `META_FACEBOOK_PAGE_ACCESS_TOKEN`
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`

The access token is sent in the `Authorization` header. It is never added to a URL, report, dashboard file, log, browser store or source file.

## Commands

From the NumberNinjaDesigns repository root:

```powershell
npm --prefix studio/services/meta-social run dry-run
npm --prefix studio/services/meta-social test
```

`dry-run` validates names and formats only. It performs no provider call and writes no file.

After Page ownership, Instagram linkage, Graph API version and read scopes have been verified, an explicitly started read-only sync is:

```powershell
npm --prefix studio/services/meta-social run sync
```

The sync uses only Graph API `GET` requests. It writes normalized data to ignored `studio/runtime/meta-social/` and `studio/runtime/dashboard/meta-social.view.json`. A previous valid report remains available as an orange `reconnecting` cache fallback if Meta is temporarily unavailable.

## Hard boundaries

- No Facebook or Instagram publishing.
- No comments, messages, scheduling, advertising or account changes.
- No raw provider-response storage.
- No credential values in output.
- Retries are bounded to two attempts after the initial request and respect `Retry-After`.
