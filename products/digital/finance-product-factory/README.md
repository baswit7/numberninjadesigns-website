# Finance Product Factory

Finance Product Factory is a local, contract-driven workbook production system. It turns versioned product definitions into styled XLSX workbooks, validates the serialized OOXML, scores quality, renders listing images, and assembles a deterministic commercial ZIP package. The browser performs generation locally. The local Node server serves static files and writes verified output inside the managed project directory; there is no cloud storage, account system, or marketplace publication integration.

## Current implementation

- Seven active workbook products, six visible expansion release candidates, and seven hidden beta definitions.
- Four reviewed production locales: `nl-NL`, `en-US`, `en-GB`, and `de-DE`.
- Six independent currency profiles: `EUR`, `USD`, `GBP`, `CAD`, `AUD`, and `CHF`.
- Six active semantic workbook themes.
- Strict versioned contracts, an immutable product registry, safe draft persistence, sequential batch generation, workbook reread validation, quality scoring, compatibility reporting, and commercial packaging.
- Twenty deterministic, validated 2400×1600 PNG listing images per full package, plus two key-free Etsy listing-video generators and an optional Photoshop automation manifest.
- Direct managed project storage for individual XLSX, sales ZIP, PNG, image ZIP, and batch ZIP output, with browser-download fallback when the local storage endpoint is unavailable.
- A Windows native-release CLI that tests the exact generated workbook bytes in Microsoft Excel before packaging those same bytes.
- Local browser dependencies: ExcelJS 4.4.0 and JSZip 3.10.1 under `vendor/`.

The product selector exposes active definitions and the six explicitly marked expansion release candidates. Other beta definitions remain hidden and are not release-ready by status alone.

## Requirements and local use

- Node.js 22 or newer.
- npm for installing the Node test dependencies.
- A modern browser for the local application.

```powershell
npm ci
npm start
```

Open `http://127.0.0.1:4173/`. The root shell links to the Product Factory and the two preserved intelligence modules. Workbook generation uses repository-local browser assets and does not require a network request after the repository is available.

## Verification

The default test command discovers the preserved modules and all current factory test files:

```powershell
npm test
```

The production matrix has a focused entrypoint:

```powershell
npm run test:production
```

The 20 July 2026 market and vertical-release workflow has two explicit entrypoints:

```powershell
npm run analyze:market
npm run generate:expansion-release
```

The second command requires Microsoft Excel Desktop on Windows because every promoted expansion workbook must complete an exact-byte native open/recalculate/save smoke test.

See [TESTING.md](TESTING.md) for the exact coverage boundary and [RELEASE_PROCESS.md](RELEASE_PROCESS.md) for the manual release gates. `npm run validate` checks historical baseline evidence, while `npm run validate:production` creates structurally verified but non-native `DRAFT` artifacts.

## Release truth

Microsoft Excel Desktop 2019+ remains the native-smoke-test target. Budget Planner Ultimate additionally ships Excel and Google Sheets import-ready XLSX editions behind a formula/OOXML readiness gate; a live Google Sheets import is still separate external release evidence.

ExcelJS writes formulas but does not calculate them. The normal browser flow performs contract, structural, quality, and package checks without a native `compatibilityProbe`; compatibility therefore remains `PARTIAL` and both release manifests remain `DRAFT`.

On Windows with Excel Desktop 2019+ installed, `npm run release:native` executes the seven required tier/locale/appearance scenarios, runs full native recalculation/open-save checks on the exact generated workbook bytes, rereads Excel's saved copy, and packages the original tested byte sequence. It also builds the five-workbook master sales set: Basic Light, Professional Light/Dark, and Ultimate Light/Dark. A successful run can produce `READY_FOR_REVIEW`; that is a technical status only.

Stored native evidence that predates the seven-product, six-theme, physical-image implementation is historical evidence and does not certify the current catalog. A current native run is required for current compatibility claims.

The full commercial package includes the workbook, customer documents, listing copy, exactly twenty physical PNG listing images, image evidence, QA reports, manifests and—where supported—a separate Google Sheets import edition. The Etsy dominance release adds two validated silent MP4 listing videos. Photoshop remains optional.

Build the bilingual Etsy launch kits with `npm run build:etsy-dominance -- --replace`. English is the primary release; Dutch is generated as the secondary localized release. Build listing videos independently with `npm run build:etsy-videos -- --images <listing-image-directory> --output <video-directory>`.

Local decision controls do not upload, publish, email, or modify an external system. No generated status constitutes human approval or publication.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — runtime boundaries and dataflow.
- [PROJECT_SCOPE.md](PROJECT_SCOPE.md) — repository and change boundaries.
- [PRODUCT_DEFINITIONS.md](PRODUCT_DEFINITIONS.md) and [ADDING_A_PRODUCT.md](ADDING_A_PRODUCT.md) — catalog model and extension workflow.
- [WORKBOOK_ENGINE.md](WORKBOOK_ENGINE.md) and [FORMULA_ENGINE.md](FORMULA_ENGINE.md) — XLSX generation and formula compilation.
- [LOCALIZATION.md](LOCALIZATION.md) and [THEMES.md](THEMES.md) — production catalogs.
- [VALIDATION.md](VALIDATION.md), [QUALITY_SCORING.md](QUALITY_SCORING.md), and [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) — release evidence and boundaries.
- [COMMERCIAL_EXPORTS.md](COMMERCIAL_EXPORTS.md) and [IMAGE_PRODUCTION.md](IMAGE_PRODUCTION.md) — ZIP contents and generated image evidence.
- [INTELLIGENCE_ADAPTERS.md](INTELLIGENCE_ADAPTERS.md) — read-only import adapters.
- [SECURITY.md](SECURITY.md) — normative security baseline.
- [EXPANSION_2026-07-20.md](EXPANSION_2026-07-20.md) — ListingView normalization, the 85-product portfolio contract, vertical releases and evidence boundaries.
- [CHANGELOG.md](CHANGELOG.md) — unreleased implementation record.

## Historical provenance

Commit `b811fac` is the isolated integration baseline. Checksum-preserved source artifacts remain under `incoming/` and `legacy/source-baselines/`; their evidence is documented in [SOURCE_PROVENANCE.md](SOURCE_PROVENANCE.md) and `release-evidence/`. These artifacts preserve provenance and do not define the active product architecture.
