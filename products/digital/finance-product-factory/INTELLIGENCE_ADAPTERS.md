# Intelligence adapters

## Purpose

`src/adapters/intelligence-adapters.js` provides a narrow read-only bridge for selected outputs from the preserved intelligence modules. Adapters normalize external field naming, retain the original source fields, and attach provenance without changing workbook definitions or generation integrity.

The Product Factory runtime does not currently invoke these adapters. Adapter output is informational draft data until a separately validated consumer is implemented.

## Public adapters

| Function | Accepted source shape | Required identity | Normalized status |
| --- | --- | --- | --- |
| `adaptMarketOpportunity()` | `MarketOpportunity` | non-empty keyword/niche | `PASS` or `INCOMPATIBLE` |
| `adaptProductManifest()` | `ProductManifest` | non-empty product ID | `PASS` or `INCOMPATIBLE` |
| `adaptListingPackage()` | `ListingPackage` | non-empty title | value status `IMPORTED_DRAFT` on adapter `PASS` |

Each adapter accepts source schema version `1.0.0` or `1`. Other or missing versions are rejected. A successful result has `status`, logical contract name, source version, normalized `value`, provenance, and an empty error list. Failure returns `INCOMPATIBLE`, `value: null`, no provenance, and one `ADAPTER_REJECTED` error.

The logical names above are adapter contracts, not entries in the fifteen-schema strict contract registry under `src/contracts/`.

## Provenance and safety

Before normalization, the adapter:

1. validates a bounded plain JSON-compatible structure;
2. rejects prototype-pollution keys and unsafe object shapes;
3. serializes the source deterministically;
4. calculates a SHA-256 digest;
5. deep-copies the complete input into `sourceFields`;
6. records source module/type/version/ID, import time, and `READ_ONLY_COPY` mutation policy.

The default source modules are `etsy-intelligence-engine` for market opportunities and `listing-intelligence-engine` for product/listing data. Callers may provide provenance metadata and a fixed `importedAt` value for reproducible tests.

## Capability boundary

`INTELLIGENCE_ADAPTER_CAPABILITIES` states:

- read-only: true;
- affects workbook integrity: false;
- live publication: false;
- fixed external paths: false;
- supported logical contracts: MarketOpportunity, ProductManifest, ListingPackage.

Adapters do not call APIs, read external files, mutate source objects, select a product definition, alter formulas, generate a workbook, approve a release, or publish a listing.

## Integration requirements

Before adapter data can influence a product or commercial package, add a separate strict consumer contract and validate:

- supported source and consumer versions;
- deterministic mapping and provenance retention;
- null, number, locale, currency, and array semantics;
- clear conflict resolution between generated product truth and imported intelligence;
- security limits and rejection behavior;
- human review before commercial use.

Workbook integrity fields must remain sourced from the versioned ProductDefinition and ProductConfiguration, not from an intelligence payload.

## Current limitations

- The three normalized result shapes have no registered JSON schemas.
- `tests/intelligence-adapters.test.mjs` verifies all three adapters, provenance, non-mutation, version rejection, required identities, and unsafe-structure rejection.
- Numeric normalization accepts decimal comma/dot but does not establish units or statistical validity.
- Unknown source fields are retained, not semantically validated.
- Provenance proves the imported bytes and mapping time, not the truth or freshness of the source data.
- There is no runtime UI, storage flow, or publication pipeline for adapted values.
