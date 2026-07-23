# Etsy Intelligence Engine

Local-first intelligence layer for the `NumberNinjaDesigns` Digital Production division. It imports marketplace CSV files, normalizes heterogeneous signals and turns them into ranked product decisions, blueprints, variant plans and revenue forecasts.

## Start

Open `index.html` directly and import a CSV. For the built-in example, serve the repository locally:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080/modules/etsy-intelligence-engine/`.

No installation, account or API key is required. All imported data stays in the browser and persists in `localStorage`.

## Supported imports

- Etsy Listings Export
- Similar Keywords
- Top Listings

Column aliases are resolved by `importers/registry.js`. Unknown columns remain available under each record's `raw` property. Add EverBee, eRank, Marmalead or API sources by registering a new importer; analysis code never needs to change.

## User workflow

1. Select **Import CSV** and the matching source.
2. Drop one or more CSV files.
3. Review ranked opportunities and market gaps.
4. Open a row for its product blueprint and forecast.
5. Use Blueprints, Variants and Revenue for the build decision.
6. Export the ranked decisions as CSV.

Scores are comparative within the current dataset. Import representative market samples; a tiny or biased dataset lowers decision reliability.

## Architecture

```text
CSV/API adapter -> canonical market record -> analysis -> decision engines -> dashboard/export
                                              |                     |
                                              +-> pattern learning --+
```

| Module | Responsibility |
|---|---|
| `config/engine.config.js` | weights, locales, niches, variants and economic assumptions |
| `importers/registry.js` | isolated adapters and canonical field mapping |
| `core/` | pure CSV and math utilities |
| `engine/analyze.js` | normalization, opportunity scoring and pattern detection |
| `engine/decide.js` | clustering, blueprints, variants and forecasts |
| `engine/store.js` | versioned local persistence and learning memory |
| `app.js` | UI composition and browser interactions |

## Scoring model

Every metric is normalized to 0–100. Competition, reviews and listing age are inverted where lower values indicate greater opportunity. The final score is a weighted sum configured in `scoreWeights`. Weights must total `1.0`; unit tests enforce this contract.

Forecasts are directional decision aids, not financial guarantees. Adjust fees, build cost and conversion assumptions in configuration before using them for production planning.

## Extension points

- Register a source adapter with `ImporterRegistry.register(id, importer)`.
- Add locales to `ENGINE_CONFIG.locales` without UI changes.
- Change scoring without modifying analysis logic.
- Replace `store.js` with IndexedDB or a remote repository behind the same state boundary.
- Feed generated blueprint objects into the existing product generator through an explicit adapter.
- Add time-series snapshots for true trend and seasonality models.

## Tests

```powershell
node modules/etsy-intelligence-engine/tests/engine.test.mjs
```

Tests cover quoted CSV parsing, adapter normalization, score bounds, niche clustering, patterns, blueprint generation, variants, forecasts and weight integrity.

## Security and privacy

- No imported file or key leaves the browser.
- UI output is rendered from normalized text fields; future remote adapters must validate and sanitize their payloads.
- No credentials are required or stored.
- Persistence failures fall back safely and are logged with the `[EIE]` prefix.
- API adapters should add abort timeouts, exponential backoff with jitter, rate-limit handling, token refresh, response caching and explicit green/orange/red connection states.
