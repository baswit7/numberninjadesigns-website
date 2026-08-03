# NumberNinjaDesigns Etsy Open API service

Server-side Etsy Open API v3 integration core for the NumberNinjaDesigns owner's
single shop. The repository execution plane remains disabled by default. This
module performs no provider calls until `ETSY_EXECUTION_ENABLED=true` is supplied
in a private server environment after approval and go-live review.

## Security and behavior

- OAuth 2.0 Authorization Code with mandatory PKCE S256 and cryptographically
  random, single-use state.
- Exact HTTPS redirect URI validation; query strings, fragments and implicit URL
  normalization are rejected.
- API keystring and shared secret are read only from server environment values.
- OAuth tokens and pending PKCE flows are stored in an AES-256-GCM encrypted
  server-side file with integrity validation and restrictive file permissions.
- Access tokens refresh before expiry; rotated refresh tokens are persisted.
  Concurrent refresh attempts collapse into one request.
- Read requests retry only for network failures, `429`, `502`, `503` and `504`,
  with bounded exponential backoff and Etsy `Retry-After` support.
- Mutating requests are never automatically replayed after a rate-limit or
  ambiguous network outcome.
- Idempotent sync records hash the operation, local resource key and payload.
  Ambiguous write outcomes are quarantined for reconciliation.
- Audit events use an allowlist and remove keys that can contain credentials,
  OAuth material or personal data.
- Status is always one of `connected`, `reconnecting` or `error`; the status
  includes only a safe error code and reconnect requirement.
- `testConnection()` validates the application key with
  `/v3/application/openapi-ping` and the OAuth token with
  `/v3/application/scopes`. When Etsy enumerates scopes they are compared with
  the configured set; Etsy's current official response schema also permits an
  empty object, which is reported as `token-accepted-no-enumeration` rather than
  inventing grants.
- The owner dashboard has a green/orange/red indicator plus connect, test and
  disconnect actions. It uses a short-lived `HttpOnly`, `Secure`,
  `SameSite=Strict` session cookie and same-origin CSRF token. The admin access
  token is submitted once and is never put in localStorage or sessionStorage.
- Product Studio can preview and publish all eligible active listings. A
  publication run requires an exact confirmation, a matching catalog revision,
  owner approval and the complete `NND-VISUAL-QUALITY-2026.1` approval.
- Listing creation, each image upload, each digital-file upload and activation
  have separate idempotency records. Completed steps are not replayed; uncertain
  writes stop for reconciliation.

## Runtime boundary

This module is a server-side integration core, not browser code. Do not import it
from a static page or bundle it into public JavaScript. The public storefront
must call an authenticated same-origin server endpoint that delegates to this
module. API credentials, the token vault path and the encryption key must remain
in a deployment secret manager.

The encrypted file store supports one active service instance. A multi-instance
deployment must replace it with a transactional shared store or managed secret
vault that implements the same `get`, `set`, `delete`, atomic `take` and atomic
`createIfAbsent` operations. Do not share the encrypted file through a public or
eventually consistent filesystem.

## Vercel disabled shell

The separate production project `numberninjadesigns-etsy-api` currently exposes
only a hard-disabled serverless shell at `https://api.numberninjadesigns.com`.
`GET /healthz` and `GET /api/etsy/status` are safe, non-provider checks.
Connect, disconnect and test-connection actions return `503
EXECUTION_DISABLED`; the callback at
`https://api.numberninjadesigns.com/etsy/oauth/callback` also fails closed
without reading or echoing query values.

`GET /pinterest/oauth/callback` is a separate passive handoff endpoint for the
desktop Finance OS OAuth flow. It validates the presence of exactly one bounded
`code` and `state`, never exchanges or echoes them, never calls Pinterest and
returns a `no-store`, `no-referrer`, `noindex` page. The user can explicitly
copy the full callback URI to the local DPAPI-backed token manager; after a
successful copy the page removes the sensitive query from the address bar.

The Vercel deployment excludes the owner dashboard, active integration runtime,
tests and example configuration. It contains no Etsy credentials and cannot be
enabled through environment configuration. Before go-live, replace this shell
with an authenticated serverless adapter backed by a transactional shared store
or managed vault, complete the technical gate, and perform a separate reviewed
deployment.

## Owner dashboard

`npm start` launches the dependency-free Node server on `127.0.0.1:8787` by
default. Put it behind an authenticated, TLS-terminating reverse proxy at the
exact `ETSY_PUBLIC_ORIGIN`; do not expose the plain HTTP listener directly. The
dashboard is served at `/etsy-admin/`, and the Etsy callback is
`/etsy/oauth/callback`.

The reverse proxy must:

- forward only from the declared public origin;
- preserve HTTPS and the exact callback path;
- suppress callback query strings from access logs because they temporarily
  contain the Etsy authorization code and state;
- add no caching to `/api/etsy/*`, `/etsy/oauth/callback` or `/etsy-admin/`;
- restrict network access to the service listener;
- keep `ETSY_ADMIN_TOKEN` in the same server-side secret manager as the Etsy
  credentials.

The dashboard is intentionally owner-only. It cannot display or edit API
credentials, tokens, the encryption key or the token-store path.

## Configuration

The variable names are documented in `environment.example`. Generate the
32-byte encryption key in the deployment secret manager and never commit its
value. The token store path must be absolute, private, backed up according to the
retention policy and outside every public web root.

Recommended scopes for the stated internal listing workflow:

```text
listings_r listings_w shops_r
```

Do not add `transactions_r`, address, email, billing, profile, favorites or
write-shop scopes unless a separately reviewed product requirement proves they
are necessary and the owner reauthorizes the connection.

`ETSY_SHOP_ID` is the numeric owner shop ID. The recommended catalog source is
the pair `ETSY_PRODUCT_STUDIO_RELEASE_PATH` and
`ETSY_PRODUCT_STUDIO_LISTINGS_PATH`. Product Studio then joins each
`listing-package.json` to its release and image manifests, derives the complete
listing automatically and admits it only when the listing package, release,
visual-quality gate and owner publication authorization all pass.

`ETSY_LISTING_CATALOG_PATH` remains available as a manual alternative. Configure
either that file or the Product Studio path pair, never both. Every configured
path must be absolute and outside public web roots. Referenced assets must stay
inside the selected release or catalog directory tree. Product files are
checked against Etsy's five-file and 20 MB per-file limits before any provider
write starts.

The machine-readable catalog contract is
`listing-catalog.schema.json`. It requires stable local IDs, versioned listing
content, explicit publication approvals, complete Etsy fields and relative
asset paths. Duplicate IDs, path traversal and unsupported catalog versions
fail closed.

A listing may contain a numeric `taxonomyId` or a full `taxonomyPath`. For
Product Studio output the path is resolved once against Etsy's seller taxonomy
before the first write in a bulk run. Missing or ambiguous matches stop the
entire run before any draft is created.

Digital and hybrid listings require at least one buyer download. Physical and
hybrid listings additionally require existing Etsy shipping-profile,
return-policy and processing-readiness IDs; Product Studio never invents or
creates these shop policies during a bulk run.

Only `active` entries that pass every publication and asset check enter the
bulk run. A successful activation is recorded and is no longer eligible on the
next Product Studio refresh.

When `ETSY_SOCIAL_EVENT_ENDPOINT` equals the fixed local Product Factory route,
the publisher performs two read-only Etsy checks after activation: the exact
listing must be active at its canonical Etsy URL and at least three Etsy image
receipts must belong to that listing. It then enqueues one deterministic
five-channel campaign with pending preview approval. Only public Etsy CDN URLs
cross the service boundary; local paths, tokens and provider response bodies do
not. A timeout is reconciled against the Product Factory receipt before retry,
so an already accepted event is never blindly duplicated. When this sink is
enabled, fewer than three source images blocks the run before the first Etsy
write.

## Lifecycle contract

1. `beginAuthorization()` returns the Etsy authorization URL and stores the
   encrypted one-time PKCE/state record.
2. The HTTPS callback passes Etsy's `state`, `code`, `error` and
   `error_description` parameters to `completeAuthorization()`.
3. `testConnection()` is exposed through the authenticated owner dashboard as
   the **Test connection** action.
4. `getStatus()` drives the dashboard indicator:
   `connected` = green, `reconnecting` = orange, `error` = red.
5. `disconnect()` deletes the locally stored OAuth token. The owner should also
   revoke the application's Etsy authorization when access is no longer wanted.
6. Every write workflow uses `runIdempotentSync()` and performs a provider-side
   reconciliation before retrying an `uncertain` result.
7. Product Studio loads `/api/etsy/listings`, presents the exact eligible set,
   and posts the confirmed catalog revision to
   `/api/etsy/listings/publish-all`.
8. After Etsy activation and readback, the optional local social sink enqueues
   the Product Factory campaign. An incomplete handoff remains eligible for a
   safe social-only retry while Etsy create/upload/activate writes stay
   idempotently suppressed.

## Validation

Run from this directory:

```powershell
npm test
```

The tests use mocked Etsy responses and never read credentials or contact Etsy.

## Official Etsy references

- Authentication, PKCE, scopes, redirect matching and token refresh:
  https://developers.etsy.com/documentation/essentials/authentication/
- Request headers and TLS:
  https://developers.etsy.com/documentation/essentials/requests/
- Rate limits and `Retry-After`:
  https://developers.etsy.com/documentation/essentials/rate-limits/
- Open API v3 endpoint reference:
  https://developers.etsy.com/documentation/reference/
- Etsy API Terms of Use:
  https://www.etsy.com/legal/api/
