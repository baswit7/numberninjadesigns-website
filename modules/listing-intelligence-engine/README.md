# Listing Intelligence Engine

Isolated, dependency-free Node.js module that converts a validated `NumberNinjaDesigns` Digital Production manifest plus optional Etsy Intelligence market evidence into a reproducible Etsy listing package. It never creates products, changes opportunity calculations, publishes to Etsy, scrapes ListingView.io, or calls undocumented endpoints.

## Run

Requires Node.js 22 or later.

```powershell
cd modules/listing-intelligence-engine
npm test
npm run generate -- fixtures/budget-planner.product.json fixtures/budget-planner.market.json output/listings
```

Open `dashboard/index.html` directly for the local, responsive dashboard and CSV preview. Browser state is stored only in `localStorage`; production normalization happens through the tested Node adapter.

## Architecture

- `schemas/`: versioned ProductManifest, MarketOpportunityInput and ListingPackageManifest contracts.
- `config/`: field limits, locales, currencies, weights, pricing and glossary data.
- `src/validate.js`: fail-fast manifest boundary.
- `src/seo.js`: deterministic keyword, tag and three-title generation.
- `src/locale.js`: locale profile, controlled terminology and localized mandatory copy.
- `src/pricing.js`: evidence-only price positioning; missing evidence yields null prices.
- `src/compliance.js`: severity-based claims and compatibility gates.
- `src/visuals.js`: ten-image and ten-scene production briefs without fabricated assets.
- `src/listingview.js`: content-detected CSV adapter, raw preservation, mappings, estimation flags and quality report.
- `src/engine.js`: orchestration, explainable quality score, transfer package and manual audit contract.
- `src/export.js`: stable, reproducible package tree.
- `dashboard/`: isolated double-click dashboard; no direct Etsy mutation.

Business logic is stateless. IDs derive from input content. `generated_at` comes from the source manifest so identical inputs remain byte-stable.

## Contracts and integration

The v1 JSON Schemas define required boundary fields while permitting forward-compatible source properties. The engine consumes, but does not modify, Digital Production manifests and Etsy Intelligence Engine evidence. Integrators should call `generateListingPackage(product, market)` and `exportPackage(package, root)`.

ListingView.io uses `ListingViewAdapter`. CSV is `AVAILABLE`; API and MCP are truthfully `NOT_CONFIGURED`; writes, uploads and publishing are `DISABLED`. `raw_record`, source file/row, mapping, parser version, export/import timestamps, timeframe and estimated-field flags survive normalization. Unknown columns remain in `raw_record` and are reported. A blocker prevents adapter persistence.

Official future API/MCP connectors may implement the same read operations and explicitly gated `pullResearchData`, `pullListingData`, `pullShopData`, `pullTagData`, `pushListingDraft`, `updateListingDraft`, `attachAssets`, and `submitForReview` operations. Enabling these requires public vendor documentation, authentication method, credentials supplied outside source control, scopes, rate limits, response schemas, and sandbox evidence. No such access is claimed now.

## Configuration and localization

Edit JSON config, never engine constants, for Etsy limits, supported locales/currencies, quality weights, pricing margins, stale-export age and A/B duration. Glossary entries are keyed by language and term; expand them with preferred translation, forbidden alternatives, context, source and review status before enabling a locale for final human approval. Current mandatory copy is curated for English, Dutch, German and French. Other configured locales safely fall back to English and therefore require language review before publication.

Regional profiles cover currency, date/number separators and paper size. Compatibility always comes from the manifest. Google Sheets, PDF and Excel are never inferred from a filename.

## Compliance and quality

`BLOCKER` prevents publication. Checks cover missing digital notice/disclaimer, physical shipping, unproven Excel/Google Sheets compatibility, financial guarantees, medical claims, legal/tax/investment advice and unsupported superlatives. Human review remains required for trademarks, local consumer law, Etsy policy changes, image-to-copy consistency and category attributes.

The 0–100 quality report exposes every component score, weight, evidence, errors and improvement. Pricing evidence and SEO evidence are deliberately penalized when absent; no volume, conversion, sales or revenue is invented.

## ListingView.io workflow

1. Import one or more CSV exports.
2. Detect type from normalized headers, not filename.
3. Review mapping, unknown/missing fields, preview and quality issues.
4. Reject blockers; preserve accepted imports as immutable adapter snapshots.
5. Normalize records and use supplied metrics as attributed market indications.
6. Export `listingview-transfer-package.json` for controlled review.
7. Export `listingview-audit-input.json`, run the audit manually in ListingView.io, and import a vendor-exported result when available.

Supported observed fixtures correspond to the repository exports: listings (`keyword`, `search_volume`, competition and estimated metrics), top listings (`title`, `volume`, `listing_count`) and similar keywords (`search_term`, `searches`, `results`). Aliases tolerate order/case/punctuation drift and partial exports. Definitions such as total versus estimated values are kept separate.

## Testing

`npm test` covers valid/invalid manifests, missing evidence/assets, tags/titles, compliance blockers, compatibility claims, Dutch/German/French copy, pricing, quality, deterministic export, schema versions, all three ListingView schemas, partial/drifted CSV, unknown fields, decimal formats, estimates, duplicates, invalid/empty/BOM/quoted/multiline CSV, manual audit, transfer package and honest capabilities.

## Migration and versioning

Schema and parser versions use semantic versioning. Additive optional fields increment minor versions; changed meaning or required fields create a new schema file and migration function. Never mutate archived source imports or generated v1 packages. Re-run from source manifests into a new output-version directory and retain both audit trails.

## Known limitations and extensions

- No official ListingView.io API/MCP documentation or credentials were present, so live reads/writes are not implemented.
- The dashboard provides safe browser previews; authoritative import uses Node to retain complete provenance.
- No image generator is connected; briefs reference required source assets.
- Automated trademark databases, Etsy live limits, tax/legal policy and statistically powered A/B sample sizing require external reviewed services.
- Bundle recommendations are conservative until a product-catalog manifest is supplied for overlap analysis.

Recommended next integrations are a read-only Product Manifest directory adapter, normalized MarketOpportunity handoff, reviewed product catalog for bundles, official ListingView API/MCP adapter if documented, and an approval-gated Etsy publisher as a separate module.
