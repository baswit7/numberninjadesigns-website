# NumberNinjaTees Master Architecture

## Mission

NumberNinjaTees is a dark tactical premium brand for data, Excel and
programming audiences. This repository currently serves the publicly reachable
static host required for website identity, integration privacy disclosure and
social-platform verification/OAuth redirect endpoints.

The architecture must support gradual expansion into SEO-focused content and
social media automation without exposing credentials in a public static site.

## Current Production Baseline

The checked-in runtime is intentionally small:

| Capability | Implementation | Constraint |
| --- | --- | --- |
| Root presence | `index.html` | Minimal static page; not yet a conversion landing page |
| Privacy disclosure | `privacy.html` | Public static text; integration completeness must be reviewed |
| TikTok redirect path | `tiktok/callback/index.html` | Public callback location; it does not exchange OAuth codes |
| TikTok ownership proof | Root verification text files | Filenames are externally referenced contracts |

There is no client application runtime, API layer, job runner, database,
authentication service or secrets store in this repository at the current
baseline.

## Architecture Boundaries

```text
Public GitHub Pages host
|
|-- Static public pages and metadata
|-- Public verification files
|-- Public OAuth redirect user experience
|
`-- Never contains server-side token exchange, secrets or private analytics data

Secure external automation service (future separate deployable)
|
|-- OAuth code exchange and encrypted token storage
|-- Rate-limited API integrations and retries
|-- Scheduling, content pipelines and audit logs
`-- Analytics ingestion and reporting
```

A static GitHub Pages repository cannot safely execute authenticated publishing
automation. Any API feature requiring a secret or a durable token belongs in a
secure service, not browser JavaScript or `localStorage`.

## Modular Repository Layout

| Path | Ownership and allowed contents |
| --- | --- |
| `core/` | Shared frontend configuration, logging facade, status modelling and storage adapters when a browser runtime is introduced |
| `modules/` | Isolated public-site or dashboard capabilities, each with a documented user outcome |
| `api/` | Browser-safe API interfaces only; secure provider clients must live in a private service repository or protected deployment |
| `automation/` | Architecture and non-secret automation assets; no production credentials or token exports |
| `assets/` | Optimized fonts, images, icons and styles used by public pages |
| `docs/` | Runbooks, provider setup decisions and release procedures |
| `archive/` | Retired assets with documented retirement reason; never loaded by production pages |

## Integration Architecture

For TikTok, Pinterest, Etsy or later platform integrations:

1. Public pages provide platform-verifiable URLs and user-facing policies.
2. An OAuth redirect may land on this domain for user status display only.
3. Authorization codes and tokens must be handled by a secure server endpoint.
4. The server must implement expiry handling, encrypted token storage, scoped
   access, bounded retries, rate-limit backoff, audit logging and revocation.
5. The UI exposes connection health with consistent states: connected (green),
   reconnecting (orange), and error (red).

## UX And Design Rules

- Mobile-first responsive interface with fast first render.
- Brand palette: background `#070707`, surface `#0F0F0F`, accent `#00FF94`,
  text `#EDEBE3`, muted `#777777`.
- Brand typography preference: Orbitron, JetBrains Mono and Bebas Neue,
  loaded with performance-conscious fallbacks or self-hosted optimized assets.
- Accessibility is mandatory: semantic HTML, keyboard interaction, visible
  focus states, sufficient contrast and reduced-motion support.
- Public integration and privacy pages prioritize clarity and trust above
  decorative motion.

## SEO And Public Metadata

Public marketing pages should include canonical URL policy, metadata, Open
Graph/social previews, structured data where factually justified, sitemap and
robots policy. OAuth callbacks and technical verification resources should not
be treated as acquisition landing pages.

## Performance Strategy

- Preserve static deployment for publicly cacheable pages where possible.
- Keep critical HTML/CSS small and avoid heavy client frameworks without a
  demonstrated application need.
- Optimize and dimension assets before publishing.
- Add automated HTML/link checks and performance budgets before the public site
  grows beyond the current small surface.
- Isolate automation processing from public page delivery.

## Scalability Strategy

- Introduce functionality as independently owned modules, not one expanding
  HTML file.
- Maintain stable public integration endpoints while services evolve behind
  them.
- Deploy private automation separately with explicit provider adapters and an
  auditable job model.
- Version provider contract changes and record operational decisions in docs.

## Primary Risks

| Risk | Impact | Control |
| --- | --- | --- |
| Secrets added to a public Pages repository | Credential compromise | Never store credentials here; use a protected service and secret store |
| Static callback mistaken for full OAuth backend | Broken or insecure integration | Define server-side flow before enabling authenticated automation |
| Provider verification paths removed casually | Platform disconnection | Treat filenames/routes as compatibility contracts |
| Marketing scope added without performance controls | Slow, weak-converting site | Introduce budgets, optimized assets and scoped modules |
| Policy text does not match data processing | Compliance/platform approval failure | Review privacy terms against each enabled integration before launch |

## Architectural Decision Baseline

The repository remains a static public host until a concrete product feature
requires application runtime. Authenticated automation will be designed as a
separate secure deployable; it will not be embedded in the GitHub Pages
frontend.
