# Architecture decisions

## Boundary

The engine is a new module and does not modify the existing product generator. Its output contract is a canonical opportunity plus a generated blueprint. A future factory adapter can consume that contract without coupling importers, scoring or UI to workbook generation.

## Data contract

Canonical records contain source identity, keyword, demand, competition, price, engagement, listing maturity, sales/revenue, conversion indicators and optional design metadata. Missing values are represented as zero or an empty string; raw source fields remain attached for later adapter upgrades.

## Processing pipeline

1. An isolated importer maps a source into canonical records.
2. Market analysis normalizes signals against the active dataset.
3. Pattern detection extracts frequencies for colors, fonts, sheet counts, layouts, SEO terms, thumbnails and file formats.
4. Niche clustering uses configurable semantic vocabularies with an Emerging fallback.
5. Decision engines generate opportunity rankings, product blueprints, variants and economic forecasts.
6. The learning store accumulates winning signals across imports.
7. UI views and CSV export consume decision objects only.

## Scale path

The current synchronous pipeline is optimized for ordinary CSV exports. At roughly 25,000+ records, move parsing and analysis into a Web Worker. At 100,000+ records, replace localStorage with IndexedDB and compute frequency maps incrementally. Remote ingestion belongs behind adapters with a cached snapshot store; it must never enter UI code.

## Known model limitations

- CSV exports use inconsistent schemas; alias coverage must be expanded per real provider sample.
- Relative normalization makes scores dataset-dependent.
- Seasonality is currently inferred conservatively from keyword semantics because CSV snapshots lack time series.
- Revenue forecasts use transparent configurable heuristics, not causal prediction.
- Font, color and thumbnail detection depend on provided metadata; image-based detection is a future plugin.
