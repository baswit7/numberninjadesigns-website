# Etsy Intelligence Service

Contract-first, read-only Etsy Intelligence service for Studio OS.

## Scope

`generate-etsy-intelligence.ps1` reads repo-root `.env`, calls only Etsy Open API v3 read endpoints, and writes derived local reports under `runtime/etsy-intelligence/` plus `runtime/dashboard/etsy-intelligence.view.json`.

## Read-only guarantees

The service does not create, update, publish, delete, schedule, deploy, or automate any Etsy resource. It does not own runtime truth and does not write provider response bodies or credential values.

Boundary flags are repeated in every generated report:

- `ownsTruth = false`
- `createsListings = false`
- `updatesListings = false`
- `publishesListings = false`
- `updatesInventory = false`
- `updatesOrders = false`
- `respondsToReviews = false`
- `providerExecution = false`
- `automationExecution = false`

## Outputs

- `runtime/etsy-intelligence/shop-overview.report.json`
- `runtime/etsy-intelligence/listing-performance.report.json`
- `runtime/etsy-intelligence/seo-opportunities.report.json`
- `runtime/etsy-intelligence/conversion-health.report.json`
- `runtime/etsy-intelligence/top-products.report.json`
- `runtime/dashboard/etsy-intelligence.view.json`
