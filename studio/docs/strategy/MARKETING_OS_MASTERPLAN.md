# NumberNinjaDesigns Ecosystem Masterplan

## Document Control

| Item | Value |
| --- | --- |
| Status | Canonical continuation plan |
| Baseline date | 2026-05-25 |
| Founder | Bas Wit |
| Brand | NumberNinjaDesigns |
| Public repository role | Brand presence, legal disclosure and provider verification endpoints |
| Strategic destination | Global AI-powered data culture ecosystem |
| Governing rule | Continue verified assets; do not silently replace or duplicate existing systems |

This document converts the audited current state into a controlled growth
program. It does not claim that planned integrations already exist, and it
does not move protected automation into this public GitHub Pages repository.

## Executive Direction

NumberNinjaDesigns is positioned as a tactical premium data-culture brand for
analysts, programmers, developers, Excel users and automation-minded buyers.
Its current commercial channel is Etsy; its next defensible advantage is an
owned audience and automation system built around searchable niche content,
repeatable product intelligence and secure channel integrations.

The operating objective is:

> Build an owned, measurable and automation-assisted ecosystem that converts
> data-culture identity into merchandise, digital products, content reach and
> future AI tools without compromising public trust or provider security.

The tactical design identity remains mandatory:

| Token | Value | Purpose |
| --- | --- | --- |
| Background | `#070707` | Primary dark surface |
| Surface | `#0F0F0F` | Navigation and panel surface |
| Card | `#141414` | Content and product cards |
| Text | `#EDEBE3` | Primary readable text |
| Muted | `#777777` | Supporting information |
| Accent | `#00FF94` | Positive action and connected state |
| Red | `#FF3B3B` | Error and high-risk state |
| Gold | `#C8A84C` | Premium highlights |

## 1. Verified Current Ecosystem

### 1.1 Canonical Public Repository

This repository is currently a static public integration and brand host. The
audited feature baseline contains:

| Capability | Implemented artifact | Status |
| --- | --- | --- |
| Business homepage | `index.html` | Implemented on Pinterest review feature baseline |
| Privacy disclosure | `privacy.html` | Implemented on Pinterest review feature baseline |
| Terms and contact | `terms.html`, `contact.html` | Implemented on Pinterest review feature baseline |
| Pinterest use case | `pinterest-api.html` | Implemented on Pinterest review feature baseline |
| Pinterest callback landing route | `pinterest/callback/index.html` | Implemented; public non-secret landing only |
| TikTok callback and verification | Existing callback and verification files | Preserved compatibility surface |
| Public architecture controls | `MASTER_ARCHITECTURE.md`, `BUGS.md`, `ROADMAP.md` | Implemented |

The repository does not currently contain a protected API runtime, database,
authentication service, job worker, secure token store or authenticated
publication engine.

### 1.2 Live Publication Status

The following was directly validated on 2026-05-25. It represents deployment
state on that date, not the full feature-branch file inventory.

| URL | Result | Consequence |
| --- | --- | --- |
| `https://numberninjadesigns.github.io/` | HTTP 404 | Must not be submitted as the active website URL |
| `https://baswit7.github.io/numberninjadesigns.github.io/` | HTTP 200 | Verified currently published project base URL |
| `/privacy.html` at the verified base URL | HTTP 200 | Existing public privacy route is reachable |
| `/terms.html` | HTTP 404 | Feature must be merged and deployed before review |
| `/contact.html` | HTTP 404 | Feature must be merged and deployed before review |
| `/pinterest-api.html` | HTTP 404 | Feature must be merged and deployed before review |
| `/pinterest/callback/` | HTTP 404 | Feature must be merged and deployed before OAuth configuration |
| `/artlist-assets.html` | HTTP 404 | Separate local branch capability; not public production |

Pinterest review submission remains gated on deployment and post-deployment
endpoint validation.

### 1.3 Audited Local Marketing Hub

A separate local NumberNinjaDesigns Marketing Intelligence Hub was audited as a
continuation input. It is modular and demonstrable, but it was not located in
the canonical GitHub repository during the audit.

| Capability | Observed implementation | Production interpretation |
| --- | --- | --- |
| Product catalog | Seed product data and filtering service | Reusable domain seed, not commerce synchronization |
| Content generation | Deterministic caption, hook, hashtag and SEO generation | Reusable workflow prototype, not live AI |
| Analytics | Mock or manually imported metrics with scoring | Reusable normalization concept, not channel analytics |
| Platform registry | Etsy, Printify, Canva, TikTok, Meta, YouTube, Pinterest, ElevenLabs, Artlist and OpenAI descriptions | Useful provider inventory and requirements reference |
| Settings/status UI | Browser-local settings and status blocks | Demo user experience only |
| API client naming | Connection test marks configured demo entries as connected | Must not be treated as real connection health |
| Proxy example | Partial Meta demonstration and unimplemented generic endpoints | Architecture input, not deployable backend |
| Verification tests | Static smoke, migration and local serve tests | All three passed during the audit |

### 1.4 Audited Artlist Work

Two non-conflicting but currently separate approaches were identified:

| Capability | Current form | Retention decision |
| --- | --- | --- |
| Asset metadata and campaign selection | Browser-local Artlist Asset Manager branch | Preserve as workflow/UI input |
| Local filesystem intake and indexing | PowerShell scanner branch | Preserve as desktop intake input |
| Existing licensed media library | Local media outside the repository | Never commit source media to the public repo |

No Artlist scraping, login automation, browser automation or provider API
work was observed or is permitted by this plan.

### 1.5 V15, V16 And V17 Status

The audited repository branches, identified NumberNinjaDesigns local sources and
available version references did not contain identifiable V15, V16 or V17
source trees, branches or tags.

These versions are therefore classified as **unverified source inputs** until
their repositories, folders or exported source files are supplied and
compared. No migration may claim compatibility with them before that review.

## 2. Current Strengths

| Strength | Business value | Continuation rule |
| --- | --- | --- |
| Distinct tactical visual identity | Differentiates the brand from generic apparel storefronts | Preserve tokens, tone and mobile-first style |
| Static public trust surface | Very fast, inexpensive and suitable for provider-review pages | Keep public/legal endpoints static and stable |
| Clear secret boundary in public architecture | Prevents unsafe OAuth implementation in GitHub Pages | Maintain as mandatory security contract |
| Seed product/content logic in the Hub | Accelerates content and catalog model design | Migrate deliberately into version control |
| Platform registry concept | Provides a structured integration backlog | Convert into server-side adapter contracts |
| Pinterest compliance work | Directly addresses immediate access rejection | Deploy and validate before expanding |
| Artlist safe intake principles | Protects licensing and credentials | Consolidate around one metadata contract |

## 3. Current Weaknesses And Risks

| Priority | Finding | Impact | Required response |
| --- | --- | --- | --- |
| Critical | Public Pinterest compliance pages are not deployed yet | Review submission remains invalid or incomplete | Merge, publish and validate the compliance feature |
| Critical | Functional Hub is outside canonical source control | Existing work can be lost, forked or rebuilt accidentally | Import audited source through a dedicated migration branch |
| High | Hub demo settings allow sensitive token-shaped values in `localStorage` | Unsafe if carried into production | Limit browser storage to non-secret preferences and drafts |
| High | Simulated connection status can appear connected without API validation | Misleading operations and review evidence | Implement real server-side health and authorization status |
| High | Artlist systems and media roots are split | Duplicate data and manual confusion | Adopt one local asset root and one index schema |
| Medium | Provider feature descriptions exceed implemented runtime | Roadmap may be mistaken for delivered capability | Maintain a delivered/planned status register |
| Medium | No automated endpoint, HTML or secret validation in the public repo | Regressions can break provider-review contracts | Add lightweight verification CI |
| Medium | GitHub project URL is not an owned branded domain | Weaker authority and portability | Introduce an owned domain in a controlled public-site phase |

## 4. Preserve, Migrate, Build Or Reject

Every existing or proposed capability must fall into one of these decisions.

| Area | Decision | Rationale |
| --- | --- | --- |
| Tactical design system | Preserve | Core brand asset |
| Static Pinterest/legal/public pages | Preserve and deploy | Necessary provider trust surface |
| TikTok verification endpoints | Preserve until verified externally | External compatibility contract |
| Marketing Hub product and content models | Migrate after source inventory | Useful existing domain work |
| Hub localStorage credential handling | Reject for production | Violates secure integration boundary |
| Hub simulated API connection health | Refactor before use | Demonstration behavior is not operational truth |
| Proxy example | Use only as design reference | Missing security, resilience and provider coverage |
| Artlist metadata UI | Migrate into asset operating model | Useful planning function |
| Artlist scanner | Migrate into local asset intake tooling | Useful filesystem function |
| Licensed media in GitHub Pages repo | Reject | Licensing, size and public exposure risk |
| Wholesale rebuild into a new stack | Reject | Loses verified work and violates continuation principle |

## 5. Target Operating Model

The ecosystem should be developed as separate deployable responsibilities,
not as a single oversized public application.

```text
NumberNinjaDesigns Ecosystem
|
|-- Public Brand And Compliance Surface
|   |-- Brand landing pages and product discovery
|   |-- Legal/privacy/contact pages
|   |-- Provider verification and redirect landing URLs
|   `-- SEO-indexable evergreen content
|
|-- Private Marketing OS
|   |-- Catalog and campaign workspace
|   |-- Content generation and review
|   |-- Asset selection and planning
|   |-- Analytics and decision dashboard
|   `-- Operator settings without exposed secrets
|
|-- Secure Integration And Automation Service
|   |-- OAuth/token lifecycle and encrypted storage
|   |-- Provider adapters and webhooks
|   |-- Scheduled jobs, retries and approval gates
|   `-- Audit logs and failure recovery
|
|-- Data And Measurement Layer
|   |-- Product and channel records
|   |-- Content, publication and asset metadata
|   |-- Metrics and conversion attribution
|   `-- Growth experiments and reporting
|
`-- Local Licensed Media Intake
    |-- Artlist files outside public Git
    |-- Scan/index metadata
    `-- Campaign asset selection and licensing notes
```

### Deployment Boundary

| Surface | Recommended delivery | Allowed data | Prohibited data |
| --- | --- | --- | --- |
| Public site | Static-first web delivery, initially existing GitHub Pages | Public brand, legal, SEO and verification content | Secrets, tokens, private metrics |
| Marketing OS UI | Authenticated application deployment | User-visible workspace data and approved content | Raw provider secrets in browser storage |
| Automation/API service | Protected server-side runtime | Encrypted provider credentials and controlled jobs | Public client access to durable tokens |
| Asset media library | Local or controlled private storage | Licensed media and license evidence | Public source-media commits |

## 6. Continuation Architecture

### 6.1 Current Public Repository

The existing repository remains the public trust and compatibility surface:

```text
/
|-- index.html
|-- privacy.html
|-- terms.html
|-- contact.html
|-- pinterest-api.html
|-- pinterest/callback/
|-- tiktok/callback/
|-- core/
|-- modules/
|-- api/
|-- automation/
|-- assets/
|-- docs/
`-- archive/
```

This repository may gain static content, optimized assets and verification
tests. It must not gain provider secrets or browser-based authenticated
publishing code.

### 6.2 Private Marketing OS Application Structure

After the existing Hub is imported and compared with any supplied V15/V16/V17
sources, the application layer should converge on:

```text
/core
/ui
/modules
/integrations
/analytics
/seo
/automation
/content-engine
/social-engine
/shopify
/gumroad
/reddit
/pinterest
/tiktok
/ai-tools
```

| Directory | Responsibility |
| --- | --- |
| `core/` | Domain contracts, configuration boundaries, validation, logging and shared state models |
| `ui/` | Tactical component system, accessible layouts, loading/error/reconnect states |
| `modules/` | Business capabilities such as catalog, campaigns, assets and approvals |
| `integrations/` | Common provider adapter contracts, OAuth status and error mapping |
| `analytics/` | Normalized metrics, attribution, reporting and experiment measurement |
| `seo/` | Keyword clusters, metadata, internal links and content indexing controls |
| `automation/` | Jobs, approvals, retries, schedules and audit events |
| `content-engine/` | Product-to-content generation, review and reusable content variants |
| `social-engine/` | Cross-channel publishing plans and platform transformations |
| `shopify/` | Owned storefront catalog, inventory and order-boundary integration |
| `gumroad/` | Digital product and bundle channel integration |
| `reddit/` | Authority content planning with explicit human-review policies |
| `pinterest/` | Boards, Pins, analytics and Pinterest SEO workflows |
| `tiktok/` | Short-form concepts, caption planning and supported API workflows |
| `ai-tools/` | Formula, KPI, SQL and spreadsheet product capabilities when validated |

The structure describes ownership, not permission to build every integration
at once. Each directory is introduced only with a shipped, tested capability.

### 6.3 Recommended Technology Allocation

| Need | Recommended technology direction | Introduction gate |
| --- | --- | --- |
| Public trust pages | Continue static delivery; later serve behind owned domain | Immediate deployment validation complete |
| Private application UI | Next.js, React, TypeScript and Tailwind | Canonical Hub migration completed |
| UI motion | Framer Motion only for measured, lightweight interactions | No Core Web Vitals regression |
| Operational database | Supabase with row-level access strategy | Domain schema and authentication reviewed |
| Secure runtime | Vercel server-side functions or equivalent protected service | OAuth and secrets design approved |
| AI generation | OpenAI API through protected server endpoints | Prompt/output contract and cost controls defined |
| Product commerce | Shopify API adapter and Etsy boundary | Catalog source-of-truth selected |
| Payments for owned products | Shopify/Stripe according to product channel | Legal/payment flow reviewed |
| Product analytics | PostHog and Google Analytics with consent policy | Public privacy policy accurately updated |

## 7. Core Domain Contracts

Automation cannot scale safely until shared records exist. The following
entities form the minimum system language:

| Entity | Required responsibility |
| --- | --- |
| Brand | Voice, design tokens, public identity and approved claims |
| Product | SKU, category, audience, channel mappings, price state and SEO attributes |
| DigitalProduct | File or access entitlement, channel, version and fulfillment rule |
| Asset | Media metadata, local/private storage reference, licensing status and permitted uses |
| Campaign | Objective, products, audiences, platforms, content set and success metric |
| ContentItem | Platform format, copy, creative inputs, approval state and publication state |
| Publication | Provider destination, idempotency key, API state, public URL and failure record |
| ProviderConnection | Authorization status, scopes, expiry state and reconnect requirement |
| MetricSnapshot | Platform, content/product relation, measured interval and normalized values |
| AutomationRun | Job input, approval state, attempts, result, errors and audit timestamps |

These contracts should be documented and versioned before production provider
adapters are enabled.

## 8. Integration Strategy

### 8.1 Channel Sequence

| Priority | Channel | Purpose | Readiness requirement |
| --- | --- | --- | --- |
| 1 | Etsy | Existing revenue channel | Preserve store links and establish catalog import boundary |
| 1 | Pinterest | Search-driven demand capture | Deploy review site and implement secure OAuth proof flow |
| 2 | Shopify | Owned conversion and catalog control | Single product source-of-truth and fulfillment decision |
| 2 | Gumroad or Whop | Digital product revenue | Digital fulfillment and license model |
| 3 | TikTok / Instagram / YouTube Shorts | Audience growth | Approved content workflow and analytics ingestion |
| 3 | Reddit / LinkedIn | Authority and niche trust | Human-reviewed content and disclosure policy |
| 4 | Amazon Merch / Redbubble / TeePublic / Spring | Reach expansion | Stable product synchronization and channel measurement |

### 8.2 Provider Adapter Contract

Every authenticated provider implementation must support:

- Authorization state, minimum scopes and disconnect behavior.
- Token expiry/refresh handling entirely server-side.
- Bounded retries with backoff for recoverable failures.
- Rate-limit handling and user-visible reconnect status.
- Normalized error mapping without exposing secrets.
- Idempotent create/publish actions where supported.
- Audit events for approvals, API mutations and failures.
- Test coverage for authorization loss, provider failure and duplicate jobs.

Connection colors remain:

| State | Color | Meaning |
| --- | --- | --- |
| Connected | Green `#00FF94` | Verified valid connection or successful recent request |
| Reconnecting | Orange/gold `#C8A84C` | Refresh, retry or operator action is underway |
| Error | Red `#FF3B3B` | Permission, API or operational failure requires resolution |

## 9. Automation And AI Engine

The existing local generation concepts are retained as workflow inputs. The
production automation model adds controls in this order:

| Stage | Capability | Control required |
| --- | --- | --- |
| Drafting | Product descriptions, hashtags, Pins, captions and scripts | Human review before publication |
| Planning | Content calendar, asset pairing and campaign prioritization | Versioned campaign record |
| Optimization | SEO variants and performance-based recommendations | Traceable metric source |
| Assisted publishing | Provider draft creation or scheduled approved posts | OAuth, retry, audit and idempotency |
| Measured automation | Repeat proven content patterns automatically | Explicit approval rules and rollback |

AI must never invent unsupported product claims, licensing rights, platform
results or conversion statistics. Generated output must preserve:

- Product facts from the catalog source of truth.
- NumberNinjaDesigns brand tone and design identity.
- Channel-specific restrictions and approval requirements.
- Prompt version, model identifier, input source and final human decision when
  content is published.

## 10. SEO And Owned Traffic Plan

### 10.1 Technical SEO Foundation

| Deliverable | Purpose | Gate |
| --- | --- | --- |
| Verified public canonical URL | Prevent authority fragmentation | Public-domain decision and deployment |
| Metadata and social previews | Improve discovery and sharing quality | Page-level content exists |
| `sitemap.xml` and `robots.txt` | Establish index controls | Public routes finalized |
| Structured data | Describe brand, products and content accurately | Real public catalog/content only |
| Internal linking model | Build niche authority clusters | Content taxonomy approved |
| Performance budgets | Protect mobile SEO and conversion | Automated validation configured |

### 10.2 Initial Keyword And Content Clusters

| Cluster | Product/content intent | Suitable channels |
| --- | --- | --- |
| Excel humor and spreadsheet culture | Apparel, gifts, templates | Google, Pinterest, TikTok |
| Data analyst gifts and dashboard culture | Apparel and digital packs | Pinterest, Google, LinkedIn |
| SQL and programmer humor | Apparel, cheat sheets, content | Google, Reddit, TikTok |
| Power BI and KPI workflows | Templates and future tools | Google, LinkedIn, Pinterest |
| Automation and AI workflows | Digital products and SaaS demand | Google, YouTube, LinkedIn |

Traffic ownership depends on sending discoverability channels to controlled
landing pages, email capture or owned product experiences rather than relying
solely on marketplace profiles.

## 11. Revenue Expansion Plan

| Layer | Products | Commercial objective |
| --- | --- | --- |
| Merchandise | Existing and expanded data/coding apparel | Preserve current revenue and test demand |
| Digital products | Excel templates, KPI packs, SQL sheets, prompts, Notion systems | Increase margin and repeat purchase potential |
| Workflow packs | Automation setups, reporting bundles and content systems | Establish professional buyer segment |
| AI tools | Formula, KPI, dashboard, SQL and spreadsheet assistants | Future recurring software revenue |
| Community/content | Newsletter and controlled community channels | Retention, authority and product feedback |

New revenue layers must be proven sequentially through traffic, conversion,
support burden and repeat purchase metrics. Marketplace expansion without
measurement is not scale.

## 12. UX And Design Rules

All customer- or operator-facing surfaces retain:

- Mobile-first layouts with clear primary calls to action.
- Tactical dark styling and neon accent hierarchy.
- Witty, direct copy without generic corporate phrasing.
- Fast loading and low dependency weight.
- Explicit loading, empty, offline, reconnecting and error states where the
  user initiates data work.
- Accessible navigation, focus states, labels and readable contrast.

The public brand site optimizes trust and conversion. The private Marketing OS
optimizes operational speed, approval confidence and recovery from provider
errors. They share identity but not security responsibility.

## 13. Security, Privacy And Compliance

### 13.1 Non-Negotiable Controls

- Never commit API keys, client secrets, access tokens or refresh tokens.
- Never store production provider tokens or OpenAI keys in browser
  `localStorage`.
- Never perform secret-based OAuth exchanges from public GitHub Pages code.
- Never expose private analytics, local file paths or licensing evidence on
  public pages.
- Never scrape or automate authenticated Artlist download behavior.
- Never publish AI-generated content without the configured approval rule.
- Keep provider verification paths stable until their external registrations
  are verified.

### 13.2 Pinterest Review Gate

Pinterest submission proceeds only when:

1. Public website, privacy, terms, contact, use-case and callback URLs return
   successful public responses.
2. The submitted URL is the verified publication URL, not the known 404 URL.
3. The app description matches implemented behavior and minimum required
   scopes.
4. A protected OAuth/API demonstration flow exists when Standard access
   requires it.
5. A review video can show authorization and permitted own-account activity
   without exposing credentials.

## 14. Performance And Reliability Plan

| Concern | Public site response | Marketing OS/service response |
| --- | --- | --- |
| Initial load | Static pages and optimized assets | Route-level loading and bounded bundles |
| API latency | No protected API calls in public pages | Cache reads where valid; retry only recoverable errors |
| Offline behavior | Static pages remain viewable after normal browser caching | Preserve drafts and non-secret work locally |
| Asset weight | No public licensed source media | Private/local media references and optimized outputs only |
| Failure recovery | Stable callback/policy endpoints | Job audit, reconnect flow and retry visibility |
| Measurement | Lighthouse/link endpoint checks | Application telemetry and provider-operation metrics |

Performance optimization must be measured against user-facing outcomes:
fast mobile rendering, stable navigation, reduced operator repetition and
lower failed-publication recovery cost.

## 15. Metrics And Decision Framework

| Objective | Primary metrics |
| --- | --- |
| Public trust and discovery | Indexed pages, organic impressions, page speed, provider review acceptance |
| Merch conversion | Product click-through, Etsy/Shopify conversion, revenue per product/content cluster |
| Owned audience | Email opt-ins, returning visitors, direct traffic and subscriber engagement |
| Content efficiency | Approved outputs per hour, publication success rate, content reuse rate |
| Pinterest growth | Pin saves, outbound clicks, own-content engagement and conversion contribution |
| Digital revenue | Product conversion, average order value, repeat purchases and refund/support rate |
| SaaS validation | Activated users, retained usage, cost per useful AI action and recurring revenue |
| Reliability | Authorization failures, retry recovery, incident count and time to resolution |

No channel or feature should scale from opinion alone. It must have an owned
metric, an accountable workflow and a clear stop/continue decision.

## 16. Phased Execution Program

### Phase 0 - Canonicalization And Public Review Release

**Objective:** secure the existing foundation before application expansion.

**Deliverables:**

- Identify and inventory any V15/V16/V17 sources supplied by the founder.
- Confirm the canonical repository and branch strategy for public site versus
  private application work.
- Merge and publish the Pinterest compliance feature after review.
- Validate all public Pinterest submission URLs after deployment.
- Decide whether to retain the GitHub project URL temporarily or introduce an
  owned branded domain.

**Exit gate:** one trusted public baseline is deployed, review URLs are live
and earlier sources are either imported or formally classified as unavailable.

### Phase 1 - Existing Hub Preservation And Secure Boundary Refactor

**Objective:** preserve useful existing product work without carrying forward
prototype security risks.

**Deliverables:**

- Import the audited Hub into tracked source control through a migration
  branch, retaining original provenance.
- Inventory product models, platform registry, content engines, analytics
  normalization and UI behavior.
- Retain non-secret settings and draft migration only.
- Remove production dependency on browser-stored provider credentials.
- Replace simulated connected states with explicit demo, disconnected and
  verified-server states.

**Exit gate:** the existing Hub capability is versioned, testable and clearly
separated from protected credentials and real API state.

### Phase 2 - Unified Asset And Content Operations

**Objective:** turn local asset work and deterministic content flows into a
repeatable production operating workflow.

**Deliverables:**

- Establish a single Artlist media root outside public Git.
- Adopt one shared asset metadata schema for filesystem scans and campaign UI.
- Link products, campaign drafts, approved assets and license notes.
- Add content approval state, export/backups and operational recovery.

**Exit gate:** one asset can be discovered, selected, licensed-noted and used
in an approved campaign without duplicate manual records.

### Phase 3 - Private Marketing OS Foundation

**Objective:** establish the deployable authenticated operating application.

**Deliverables:**

- Introduce the private application layout and tactical component system.
- Define Supabase data schema, access policy and audit model.
- Implement authenticated operator workspace and non-secret preferences.
- Establish Vercel deployment environments, protected configuration and
  observability baseline.

**Exit gate:** authenticated application handles catalog, campaigns, content
drafts and asset references without provider credentials in the browser.

### Phase 4 - Pinterest And Etsy Revenue Loop

**Objective:** automate the first measurable demand-to-sale loop.

**Deliverables:**

- Implement secure Pinterest OAuth and permitted boards/Pins operations.
- Build approval-controlled Pinterest content workflows from existing product
  and content-engine concepts.
- Establish Etsy product/link attribution or controlled catalog import where
  supported.
- Measure Pin reach, saves, outbound traffic and attributed conversion.

**Exit gate:** approved own-account Pinterest campaigns execute through secure
integrations and produce reliable performance reporting.

### Phase 5 - Owned Storefront And Digital Products

**Objective:** reduce marketplace dependency and introduce higher-margin
offers.

**Deliverables:**

- Create Shopify catalog/storefront integration around the selected product
  source of truth.
- Launch a controlled first set of digital products through Shopify, Gumroad
  or Whop according to fulfillment requirements.
- Introduce email capture and owned conversion reporting.

**Exit gate:** owned sales and digital product reporting are measurable and
operationally supportable.

### Phase 6 - Search And Content Scale

**Objective:** compound traffic through reusable content systems.

**Deliverables:**

- Build keyword clusters, internal linking and structured public content
  delivery.
- Add assisted blog, Pinterest, Reddit, LinkedIn and short-form workflows with
  human approval.
- Apply performance feedback to content prioritization.

**Exit gate:** evergreen content produces repeatable owned traffic and content
automation reduces repetitive operator work without lowering quality.

### Phase 7 - AI Tool And Recurring Revenue Validation

**Objective:** validate future software offerings from observed customer need.

**Deliverables:**

- Prioritize AI Formula, KPI, Dashboard, SQL or Spreadsheet functionality from
  measured audience demand.
- Build only the highest-evidence tool through secure AI endpoints.
- Define paid access, usage measurement, support model and cost controls.

**Exit gate:** a validated AI product delivers repeat usage and economically
sound recurring revenue.

## 17. Immediate Work Queue

The following is the controlled next sequence. Each item is a separate branch
or explicitly reviewed merge action.

| Order | Work item | Suggested branch | Completion proof |
| --- | --- | --- | --- |
| 1 | Merge and deploy Pinterest public trust pages | Existing Pinterest feature PR | All submission routes return HTTP 200 |
| 2 | Record V15/V16/V17 source inventory when supplied | `docs/legacy-source-inventory` | Compared source map and preserve/migrate decision |
| 3 | Consolidate Artlist approaches and asset-root contract | `feature/artlist-asset-pipeline` | One schema, one intake workflow, no media committed |
| 4 | Import audited Marketing Hub source | `feature/marketing-hub-migration` | Versioned source plus passing baseline tests |
| 5 | Remove unsafe credential persistence from production plan | `security/provider-token-boundary` | No production secret stored client-side |
| 6 | Specify private application domain/API contracts | `docs/marketing-os-contracts` | Reviewed entity and adapter contracts |
| 7 | Implement the first secure Pinterest/Etsy measurement loop | Subsequent scoped features | Approved live flow and reliable metrics |

## 18. Delivery And Governance Rules

- `main` represents a publishable baseline.
- One branch contains one business purpose.
- Commits use `type(scope): short summary`.
- Any public callback, verification file or legal URL change requires endpoint
  validation and provider-impact review.
- Any integration change requires a secret exposure review and explicit OAuth,
  retry, rate-limit and error-state behavior.
- Any growth claim requires measurable evidence from normalized metrics.
- Any existing-source migration records provenance and behavior changes before
  deleting or replacing legacy material.

## 19. Definition Of Successful Continuation

NumberNinjaDesigns is progressing correctly when:

1. Its public identity and provider-review pages are reliably available.
2. Existing useful Hub and Artlist work is preserved under controlled source
   management rather than rebuilt from memory.
3. Authenticated automation runs only through secure server-side boundaries.
4. Traffic acquisition increasingly lands on owned, measurable experiences.
5. New channels and products are introduced by evidence and shared contracts,
   not disconnected experiments.
6. The tactical brand identity remains recognizable across public pages,
   operator tools and future commercial products.

This masterplan governs expansion until a reviewed architecture decision
supersedes it. `MASTER_ARCHITECTURE.md` remains authoritative for the current
public repository runtime and security boundary; this document governs the
ecosystem continuation path beyond that public surface.
