# Consolidation source audit — 2026-07-27

## Window and evidence

The audited work window is 20 May through 27 July 2026. Evidence came from local Git references, clean and dirty worktrees, repository maps, tracked configuration, production manifests and file inventories. Secret values and provider responses were excluded.

## Findings

| Source | Evidence | Integrated result |
|---|---|---|
| Canonical website repository | `origin/main` at `b89b341` | Base storefront, guides, physical catalog, digital previews, support pages and initial Studio OS governance |
| Legacy website worktree | 58 top-level status entries plus ignored production collections | Branding, Etsy shop media, current release candidates, newer intelligence modules and Etsy API service |
| Standalone Studio OS | 623 non-runtime source files plus 125 tracked runtime docs/baseline artifacts | Imported below `studio/`; project identity normalized to NumberNinjaDesigns; sanitized runtime seeds separated from ignored local output |
| Finance Product Factory | 1,271 non-generated/evidence files in the audited source inventory | Source imported below `products/digital/finance-product-factory`; large evidence preserved locally below `artifacts/` |
| Finance OS | 40 source and manifest files | Preserved as provenance; active Monthly Budget Planner and Subscription Tracker remain factory products |
| Printify mockup archive | 324 files | Preserved below `artifacts/legacy/physical/printify-mockups` |
| Marketing OS and Pinterest work | May 2026 strategy, review and callback artifacts | Imported into Studio strategy/integrations and public compatibility endpoints |
| Automated market intelligence branch | 24 source/report UI files, 3,395 added lines | Source dashboard and scoring pipeline integrated without generated runtime reports |
| LeersystemenVerkoop scaffold | Project master, architecture, API status, roadmap and empty implementation scaffold | Integrated as a NumberNinjaDesigns initiative with its privacy boundary intact |

## Important conflicts resolved

1. The old repository name was still present in project IDs, package metadata, workbook metadata, market-scoring fields and Studio dashboards. Active copies were normalized to NumberNinjaDesigns.
2. Studio OS and Finance Product Factory referenced a sibling `.env`. The unified architecture replaces that coupling with the repository-root environment contract.
3. Multiple Meta credential names described the same connection. The canonical contract uses the existing `META_*` Page credentials and retains explicit Instagram account identifiers.
4. Generated outputs, release binaries and licensed/historical media were mixed with source. They now have explicit ignored artifact boundaries.
5. The older Studio OS project treated NumberNinjaTees and several idea scaffolds as separate portfolio projects. They are now governed by the NumberNinjaDesigns master project; their initiative names remain descriptive labels.

## Preserved but not promoted

- Historical Printify filenames and manifests remain evidence, not active brand metadata.
- Old domain names remain only as redirects and migration evidence.
- Generated runtime projections remain ignored; only sanitized baseline seeds required to initialize and validate Studio OS are versioned under `studio/fixtures/runtime-baseline/`.
- FIELD FLOW AI was not imported because its existing repository contract explicitly defines it as a separate product.

## Validation comparison criteria

The consolidation passes only when:

- `.env` exists locally, is ignored and is not tracked;
- `.env.example` contains names only;
- required physical, digital and Studio roots exist;
- active source has no retired identity outside allowlisted migration/redirect/test paths;
- JSON files parse;
- Finance Product Factory and intelligence-module tests pass;
- root website identity, links and product tests pass;
- no source repository was deleted or modified.
