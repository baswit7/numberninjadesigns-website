# Etsy Intelligence Layer

## Purpose

The Etsy Intelligence Layer is a contract-first, read-only Studio OS reporting layer above the existing Etsy OAuth integration. It turns approved Etsy Open API v3 read data into local, derived intelligence reports for NumberNinjaDesigns shop visibility, listing performance, conversion health, and SEO opportunity review.

## Data Sources

The generator uses only read endpoints:

- `GET /v3/application/users/me`
- `GET /v3/application/users/{user_id}/shops`
- `GET /v3/application/shops/{shop_id}/listings/active`
- `GET /v3/application/shops/{shop_id}/receipts`

Credential values are read from repo-root `.env` and are never written to reports, docs, dashboard projections, logs, or Git.

## Architecture

Source contracts live in `shared/contracts/etsy-intelligence/`:

- `etsy-intelligence-contract.json`
- `etsy-listing-metrics-contract.json`
- `etsy-shop-health-contract.json`
- `etsy-seo-opportunity-contract.json`

The service lives in `services/etsy-intelligence/` and writes generated, disposable reports under `runtime/etsy-intelligence/` plus one dashboard projection at `runtime/dashboard/etsy-intelligence.view.json`.

The validator lives at `scripts/validation/validate-etsy-intelligence.ps1` and checks contract presence, report presence, dashboard shape, read-only boundaries, forbidden write scopes, forbidden write methods, and secret safety.

## Ownership Of Truth

The layer does not own truth. Etsy remains the provider source for shop, listing, and receipt data. Studio OS runtime reports are local generated projections only and can be regenerated at any time.

`ownsTruth = false`

## Read-only Guarantees

Every report and projection repeats these mandatory boundaries:

- `ownsTruth = false`
- `createsListings = false`
- `updatesListings = false`
- `publishesListings = false`
- `updatesInventory = false`
- `updatesOrders = false`
- `respondsToReviews = false`
- `providerExecution = false`
- `automationExecution = false`

The layer does not create drafts, publish listings, edit SEO, change inventory, modify orders, answer reviews, schedule jobs, deploy systems, trigger GitHub actions, start agents, or run automation.

## Known Limitations

Etsy metrics depend on granted OAuth read scopes and Etsy endpoint availability. Receipt-derived order attribution is sampled from accessible read data and may be incomplete. SEO opportunities are review prompts only; they do not modify Etsy titles, tags, descriptions, drafts, or listings.
