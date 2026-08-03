# Etsy Promo Publisher — production architecture

Task: NN-73
Product: NumberNinjaDesigns Etsy Promo Publisher
Production URL: `https://www.numberninjadesigns.com/social-publisher/`

## Product boundary

This is a public, multi-user product for Etsy sellers. A seller authenticates with Etsy, selects a listing from the authenticated shop, generates an original vertical promo in the browser, connects the intended TikTok creator, reviews every publication setting and explicitly consents before the Content Posting API is invoked.

The app never accepts an arbitrary listing URL or arbitrary remote media URL. Listing ownership is derived from Etsy `users/me` and `shops/{shop_id}/listings`. The existing private Finance Product Factory remains the all-channel orchestration owner; this public surface is the compliant TikTok user-consent boundary required by NN-73.

## Runtime topology

```text
Browser
  static HTML/CSS/JS
  Canvas + MediaRecorder (720x1280, 24 fps, WebM/VP8, 10 seconds)
  deterministic WebM duration metadata finalization before hashing
  IndexedDB resume cache for the locally generated video
          |
          | same-origin HTTPS + HttpOnly session cookie + CSRF header
          v
Vercel Node function /api/social-publisher?action=...
  validation, OAuth state, token refresh, tenant checks, rate limits,
  TikTok creator context, publish idempotency and sanitized audit
          |
          +--> Neon Postgres (metadata and encrypted credentials only)
          +--> Etsy Open API v3
          +--> TikTok Login Kit / Content Posting API
```

No rendered video is persisted by the server. The browser submits at most 4,000,000 bytes to the upload action; the function forwards those exact bytes to the one-time TikTok upload URL. The cap stays below Vercel Functions' 4.5 MB request limit. TikTok supports WebM with VP8 and requires 23–60 fps; the generated master uses 24 fps.

The dependency-free browser renderer vendors the MIT-licensed `fix-webm-duration` 1.0.6 asset with its license. It adds the missing finite WebM duration metadata produced by browser `MediaRecorder` before SHA-256 is calculated; the previewed, cached and uploaded bytes therefore remain identical.

## Trust and tenancy

- `nnsp_session` is an opaque 256-bit random value. Only its SHA-256 hash is stored.
- Cookie flags: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`.
- Every session has exactly one random `tenant_id`. An Etsy callback binds that tenant to the authenticated `user_id` and `shop_id`.
- Every query that reads or mutates tenant data includes `tenant_id`.
- OAuth `state` values are 256-bit, hashed, expire after ten minutes and are consumed exactly once.
- Etsy authorization uses S256 PKCE. The verifier is encrypted while the request is pending.
- TikTok web authorization uses state; its client secret and token exchange stay server-side.
- Provider access tokens, refresh tokens, pending Etsy PKCE verifiers and TikTok upload URLs use AES-256-GCM with tenant/provider-bound additional authenticated data.
- The encryption key is supplied by the deployment secret store and never appears in source, browser storage, logs, Notion or evidence.
- State-changing cookie-authenticated actions require a per-session CSRF token plus exact same-origin validation. OAuth callbacks use their single-use state instead.

## Server actions

| Action | Method | Purpose | Main gate |
| --- | --- | --- | --- |
| `session` | GET | Create/read session and return bounded connection state + CSRF token | no-store |
| `oauth-start` | POST | Start Etsy or TikTok OAuth | origin, CSRF, rate limit |
| `oauth-callback` | POST | Exchange provider code and bind tenant | single-use state, exact provider |
| `listings` | GET | Read active listings owned by the authenticated Etsy shop | Etsy token refresh, tenant |
| `image` | GET | Proxy only an image URL attached to that owned listing | Etsy CDN allowlist, 3.5 MB cap |
| `creator` | POST | Fetch fresh TikTok creator identity and publication capabilities | TikTok auth, 20/min upstream cap |
| `publish-init` | POST | Validate exact preview hash/settings/consent and initialize Direct Post | 6/min, idempotency, review gate |
| `upload` | POST | Forward exact WebM bytes to the stored one-time upload URL | one-time nonce, hash, size, tenant |
| `status` | GET | Poll TikTok status and reconcile the existing publish ID | 20/min, no re-init |
| `disconnect` | POST | Revoke one provider grant and delete its token | origin, CSRF, tenant |
| `delete-data` | POST | Best-effort revoke, delete tenant data and expire cookie | origin, CSRF, tenant |

Responses contain no provider token, OAuth code, upload URL, raw provider response or stack trace. Provider log IDs may be stored only as bounded opaque correlation identifiers.

## Publication contract

1. The user selects a listing returned for the bound Etsy shop.
2. The browser renders and displays the exact video to be uploaded.
3. SHA-256, byte size, duration, MIME type and listing revision are registered with the publish request.
4. The review screen fetches current TikTok creator info and displays nickname, account identity, available privacy options and disabled interaction capabilities.
5. Privacy has no default. Comments, Duet and Stitch are unchecked by default and cannot be enabled when creator info disables them.
6. Caption remains editable and is limited to 2,200 Unicode code points.
7. The seller explicitly selects own-brand or paid-partnership disclosure.
8. Consent is bound to the media hash, creator-context hash and publication-settings hash.
9. Review mode requires `SELF_ONLY`. Production mode remains closed until TikTok approves `video.publish` and deployment readback proves the environment gate.
10. `tenant_id + media_sha256 + settings_sha256` is unique. An uncertain or accepted provider call is reconciled by `publish_id`; it is never repeated blindly.

## Database schema and lifecycle

- `publisher_tenants`: Etsy identity and shop binding.
- `publisher_sessions`: hashed session and CSRF values, tenant, expiry and last-seen time.
- `publisher_oauth_requests`: hashed state, provider, encrypted PKCE verifier, single-use timestamps.
- `publisher_provider_tokens`: encrypted token material, scopes, expiry and provider identity.
- `publisher_listing_cache`: bounded listing fields and Etsy image URLs; 15-minute cache.
- `publisher_creator_contexts`: bounded TikTok creator capabilities; five-minute validity.
- `publisher_publish_jobs`: media/settings hashes, consent timestamp, state, publish ID and sanitized failure code.
- `publisher_rate_limits`: atomic fixed-window counters.
- `publisher_audit_events`: allowlisted event names and sanitized JSON details only.

Expired OAuth requests and sessions are deleted opportunistically. Listing and creator caches expire automatically. Terminal publish records and sanitized audit evidence are retained for 90 days. A workspace without a valid session is removed after 31 days of inactivity; tenant deletion cascades through its encrypted tokens and tenant-linked audit evidence. The browser-only rendered video remains until self-service deletion or browser-data removal.

## Required deployment variables

- `DATABASE_URL`
- `SOCIAL_PUBLISHER_ENCRYPTION_KEY`
- `SOCIAL_PUBLISHER_ORIGIN`
- `SOCIAL_PUBLISHER_TIKTOK_MODE` (`review` or `production`)
- `ETSY_CLIENT_ID`
- `ETSY_SHARED_SECRET`
- `ETSY_REDIRECT_URI`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`

The deployment validator must reject missing, blank or structurally invalid values without printing them.

## Release gates

- Database migration applied and read back.
- Unit/security tests, API contract tests and browser QA pass.
- No secrets in Git, client bundles, logs or review artifacts.
- Etsy callback URL and TikTok callback URL match the deployment exactly.
- Review deployment is limited to TikTok `SELF_ONLY`; no public provider write occurs.
- A complete review recording shows Etsy connection, owned listing selection, exact video preview, TikTok creator context, editable caption, explicit privacy/disclosure/consent and processing status.
- Production mode is enabled only after TikTok approval, exact scope readback and one authorized controlled publication/readback.
