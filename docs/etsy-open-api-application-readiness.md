# Etsy Open API application and go-live readiness

**Owner:** NumberNinjaDesigns
**Use case:** internal management of the owner's single Etsy shop
**Current verdict:** locally implementation-ready; external submission and
go-live remain blocked until the unresolved owner/deployment checks below pass.

## Evidence found

No historical Etsy rejection email, portal error, rejection reason, OAuth
response or prior Etsy API implementation is present in the task-scoped
repository history. The only prior reviewer copy was a generic one-paragraph
Etsy statement under the old NumberNinjaDesigns identity. It did not name the exact
user population, scopes, OAuth/PKCE controls, redirect URI, retention behavior or
technical evidence. The four rejection causes therefore cannot be stated as
fact; treating the generic and inconsistent application evidence as the most
likely preventable weakness is an explicit inference.

## Recommended application details

Use these details consistently in the Etsy developer form and public reviewer
pages. Do not submit broader claims than the implemented workflow.

**Application name**
NumberNinjaDesigns Studio — Etsy Shop Operations

**Organization / owner**
NumberNinjaDesigns, independent design studio operated from the Netherlands.

**Website**
https://www.numberninjadesigns.com/

The domain currently differs from the NumberNinjaDesigns brand. Before
submission, the owner must verify that the live site clearly presents
NumberNinjaDesigns as the sole identity and that the domain is controlled by the
app owner. If the live identity does not match, fix that external inconsistency
before applying.

**Application description**
NumberNinjaDesigns Studio is an internal, single-shop operations tool used only
by the NumberNinjaDesigns Etsy shop owner. It uses Etsy Open API v3 to read shop
and listing metadata and to create or update owner-approved draft listings. It
does not serve third-party sellers or buyers, scrape Etsy, collect Etsy
passwords, resell API data, build advertising profiles or automate buyer
activity. Public listing activation and shop-sensitive decisions remain under
human control.

**Why API access is needed**
To replace error-prone manual re-entry of approved NumberNinjaDesigns product
metadata and maintain consistent draft listing information through Etsy's
official API.

**Requested scopes**

- `listings_r` — read the owner's inactive and expired listings for comparison
  and reconciliation.
- `listings_w` — create and update the owner's approved draft listings.
- `shops_r` — verify and read the authorized owner's shop metadata.

Do not request `listings_d`, `shops_w`, `transactions_r`, address, email,
billing, profile, favorites or buyer-related scopes for this use case.

**OAuth and security statement**
The service uses OAuth 2.0 Authorization Code with PKCE S256, cryptographically
random single-use state and an exact registered HTTPS callback. The Etsy
keystring, shared secret and OAuth tokens remain server-side. Tokens and pending
PKCE records are encrypted at rest; tokens, credentials, listing content and
personal data are excluded from audit logs. Access-token refresh, rotated
refresh-token persistence, explicit reconnect handling and owner disconnect are
implemented.

**Data use and retention statement**
Only shop and listing metadata required for the owner's internal listing
workflow is processed. OAuth tokens are deleted when the owner disconnects the
integration or access is no longer required. Cached shop/listing metadata is
minimized and deleted after a verified deletion request unless retention is
legally required. Data is not sold, shared for advertising or exposed to other
sellers.

**Support and privacy**

- Developer contact: api@numberninjadesigns.com
- Privacy contact: privacy@numberninjadesigns.com
- Privacy: https://www.numberninjadesigns.com/privacy.html
- Data deletion: https://www.numberninjadesigns.com/data-deletion.html
- API use case: https://www.numberninjadesigns.com/developer.html

The owner must verify that every address works and every URL is publicly
reachable over HTTPS before submission.

## Pre-application gate

- [ ] The live homepage, Etsy shop, developer page and developer-form owner all
  use the same NumberNinjaDesigns identity.
- [ ] The four prior Etsy rejection messages have been collected outside this
  repository and each stated reason is mapped to a concrete correction. Do not
  guess or omit a prior reason if Etsy supplied one.
- [ ] The application is described as internal/single-shop, not as a commercial
  multi-seller service.
- [ ] The description above is pasted without adding speculative future
  features, AI claims, scraping, cross-platform automation or buyer data.
- [ ] Only `listings_r listings_w shops_r` are requested.
- [ ] Privacy, deletion, terms, contact and developer URLs return `200` over
  HTTPS without login, redirect loops or certificate warnings.
- [x] The exact production callback URI is
  `https://api.numberninjadesigns.com/etsy/oauth/callback`.
- [ ] The callback uses HTTPS and matches the Etsy portal value byte for byte,
  including case, hostname, path and trailing slash.
- [ ] Reviewer evidence shows the owner-only workflow, human approval boundary,
  green/orange/red connection states, **Test connection**, disconnect and safe
  error recovery.
- [ ] Screenshots contain no keystring, shared secret, access token, refresh
  token, authorization code, PKCE verifier, personal data or internal filesystem
  path.
- [ ] Etsy's current API Terms and applicable Etsy policies have been reviewed
  by the owner immediately before submission.

## Technical go-live gate after approval

- [ ] Etsy marks the API key active in **Manage Your Apps**.
- [x] A separate hard-disabled HTTPS shell is deployed as the Vercel project
  `numberninjadesigns-etsy-api`; health and status cannot call Etsy.
- [ ] A separate authenticated HTTPS execution service is deployed; the static
  storefront never receives credentials or tokens. The current shell is not the
  active execution adapter.
- [ ] The owner dashboard is served behind TLS at `/etsy-admin/`; its plain Node
  listener is private and not internet-accessible.
- [ ] Reverse-proxy access logs suppress query strings for
  `/etsy/oauth/callback` so temporary authorization codes and state values are
  not logged.
- [x] The deployed shell is hard-coded with execution and provider calls
  disabled; no environment value can enable it.
- [ ] Keystring, shared secret, 32-byte encryption key and owner-dashboard
  authentication values are injected through the production secret manager.
- [ ] No real secret is present in Git history, build artifacts, browser code,
  localStorage, analytics, logs, screenshots or support tickets.
- [ ] The Vercel execution adapter uses a transactional shared store or managed
  vault with atomic take/create-if-absent semantics. The local encrypted
  single-instance file store must not be used on Vercel Functions.
- [ ] The production redirect URI equals the Etsy portal value exactly.
- [ ] OAuth denial, invalid/expired state, state replay and authorization-code
  replay produce safe errors and no token is stored.
- [ ] The requested scopes displayed by Etsy are exactly
  `listings_r listings_w shops_r`.
- [ ] The **Test connection** action passes both `openapi-ping` and Etsy's
  token-scope endpoint. If Etsy returns enumerated scopes they match exactly; if
  Etsy returns the officially permitted empty object, the dashboard reports
  `token accepted; scope enumeration unavailable` and the consent screen is
  manually checked against `listings_r listings_w shops_r`.
- [ ] The dashboard displays green `connected`, orange `reconnecting` and red
  `error`, with an actionable reconnect message that exposes no provider body or
  token.
- [ ] Access-token refresh and rotated refresh-token persistence pass in the
  production-like staging environment.
- [ ] A revoked/expired refresh token changes status to `error`, marks reconnect
  required and does not loop.
- [ ] `429` handling honors `Retry-After`; QPS/QPD headers are monitored without
  logging request bodies or credentials.
- [ ] GET/HEAD retries are bounded. POST writes are not automatically replayed
  after rate limits, timeouts or unknown outcomes.
- [ ] Every listing write uses a stable local operation/resource key and payload
  hash. An uncertain result is reconciled with Etsy before a retry.
- [ ] Public activation remains a separate human-approved action; no background
  process can silently publish a draft.
- [ ] Disconnect deletes the server-side token and documents how the owner can
  revoke Etsy authorization.
- [ ] Audit samples contain event time, safe status, operation and technical
  error code only—no OAuth material, listing content, buyer data or email.
- [ ] Alerts exist for repeated refresh failures, authorization revocation,
  sustained `429` responses and unresolved idempotency records.
- [ ] Rollback is tested: set `ETSY_EXECUTION_ENABLED=false`, stop sync workers,
  preserve safe audit evidence, and require manual review before resuming.

## Local verification evidence

The test suite covers disabled-by-default behavior, secure configuration,
PKCE/state, state replay, token refresh rotation, concurrent refresh collapse,
`Retry-After`, non-retried mutations, single 401 refresh, token-scope response
handling (including Etsy's empty response schema), idempotent sync,
uncertain-outcome quarantine, audit redaction, encrypted vault integrity,
owner-session protection, CSRF enforcement and the status/test dashboard. It uses
mocked provider responses and makes no Etsy calls.

The disabled production shell is available at
`https://api.numberninjadesigns.com`. Its verified callback URL is
`https://api.numberninjadesigns.com/etsy/oauth/callback`; it currently returns
`503 EXECUTION_DISABLED` by design. No Etsy secret or live provider call was
used for deployment validation.

Run:

```powershell
npm test --prefix services/etsy-open-api
```

## Official source baseline

- Authentication, exact redirect matching, PKCE/state, scopes, one-hour access
  tokens and refresh grants:
  https://developers.etsy.com/documentation/essentials/authentication/
- TLS plus required `x-api-key` and OAuth headers:
  https://developers.etsy.com/documentation/essentials/requests/
- QPS/QPD limits, `429`, `Retry-After`, caching and exponential backoff:
  https://developers.etsy.com/documentation/essentials/rate-limits/
- Ping, scope validation and endpoint permissions:
  https://developers.etsy.com/documentation/reference/
- Approval prerequisite and active-key check:
  https://developers.etsy.com/documentation/tutorials/quickstart/
- Etsy API Terms of Use:
  https://www.etsy.com/legal/api/

Recheck these official pages on the submission date; scopes, policies and API
behavior can change.
