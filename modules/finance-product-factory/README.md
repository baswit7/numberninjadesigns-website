# Finance product factory

This tracked, offline-first module is the canonical contract for the three
NumberNinjaDesigns finance workbooks. The JSON records retain source facts and
fail-closed governance. `data/products.js` is a deterministic public projection,
not a second source of truth.

Generate the public catalog:

```text
node modules/finance-product-factory/scripts/build-catalog.mjs
```

Detect drift without writing:

```text
node modules/finance-product-factory/scripts/build-catalog.mjs --check
```

The projection uses an explicit allow-list. It never publishes provenance,
delivery filenames, provider state, credentials, or launch-governance fields.
Owner prices are labeled hypotheses and are not marketplace benchmarks.

## Google Drive and Sheets readiness

The optional Google adapter imports one canonical XLSX workbook into a
pre-authorized Drive folder, converts it to Google Sheets, and verifies the
exact tab contract. It is dependency-free, resumable, rate-limit aware,
idempotent by source SHA-256, and uses the least-privilege `drive.file` scope.
Credentials are accepted only through the process environment. The adapter is
dormant unless `--execute` is supplied; the repository-wide provider and
execution gates remain fail-closed.

Create a private, non-mutating readiness report:

```text
node modules/finance-product-factory/scripts/sync-google-sheets.mjs --product budget-planner-basic --output C:\private\google-factory-readiness.json
```

Test the configured Drive folder without creating a file:

```text
$env:GOOGLE_FACTORY_ACCESS_TOKEN="<short-lived OAuth access token>"
$env:GOOGLE_FACTORY_FOLDER_ID="<pre-authorized Drive folder ID>"
node modules/finance-product-factory/scripts/sync-google-sheets.mjs --check-connection --product budget-planner-basic --output C:\private\google-factory-connection.json
```

Execute an idempotent import:

```text
node modules/finance-product-factory/scripts/sync-google-sheets.mjs --execute --product budget-planner-basic --output C:\private\google-factory-import.json
```

GitHub Actions uses Workload Identity Federation and requires repository
variables `GCP_WIF_PROVIDER`, `GCP_FACTORY_SERVICE_ACCOUNT`, and
`GOOGLE_FACTORY_FOLDER_ID`. The target folder must be shared with the service
account and Drive API plus Sheets API must be enabled in the Google Cloud
project.

Structural import success is not proof that formulas, charts, formatting, or
interactive workflows behave identically in Google Sheets. The adapter
therefore keeps `compatibilityClaimAllowed` false until a separate product-level
compatibility audit is approved.
