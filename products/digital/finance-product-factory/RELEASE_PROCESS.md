# Release process

## Release model

Finance Product Factory has two intentionally different output paths:

| Path | Native evidence | Compatibility | Manifest status |
| --- | --- | --- | --- |
| Browser generation or `npm run validate:production` | none | `PARTIAL` | `DRAFT` |
| `npm run release:native` on Windows with Excel Desktop 2019+ | exact-byte Excel COM probe | `PASS` when every native gate passes | can become `READY_FOR_REVIEW` |

The sole release-certified spreadsheet target is Microsoft Excel Desktop 2019 or later. Excel for the web, LibreOffice, and Google Sheets are not release-certified.

`READY_FOR_REVIEW` is not `APPROVED` or `RELEASED`. This repository produces technical artifacts and evidence only. It contains no mechanism that grants human approval or publishes to a marketplace.

## 1. Preflight and ownership

```powershell
git rev-parse --show-toplevel
git branch --show-current
git merge-base --is-ancestor b811fac HEAD
git status --short
```

The root must be `C:\AI\Active\Finance Product Factory`. Classify every existing change, preserve checksum-controlled historical sources, and ensure the release contains only reviewed implementation/evidence changes.

## 2. Reproducible dependencies

```powershell
npm ci
node --version
npm --version
```

Node 22 or newer is required. Record Node/npm versions, the lockfile digest, Excel version, platform, generation timestamp, and output/evidence paths.

## 3. Automated gates

```powershell
npm test
npm run test:production
npm run verify:security
npm run measure:performance
$env:NODE_PATH='C:\path\to\playwright\node_modules'
npm run test:e2e
```

All commands must exit zero. The security and performance commands write evidence under `release-evidence/production-expansion/`; review their generated `status`, limitations, environment, and hashes.

The E2E runner uses a separate local Playwright/Chromium verification runtime, starts and stops its own HTTP server, and writes its report, screenshots, and verified downloads under `release-evidence/production-expansion/browser-e2e/`. Playwright is not required by the production application.

The focused production test proves:

- deterministic preflight for all 1,296 active product/locale/currency/theme/appearance combinations;
- independent reread for 28 product/locale covering XLSX variants;
- seven required tier/locale/appearance packages written in an isolated temporary directory;
- a five-workbook master sales set, both as physical XLSX files and a verified ZIP;
- exactly ten generated 2400×1600 PNG assets per full package, with fail-closed image and final-ZIP validation;
- explicit `PARTIAL` compatibility and `DRAFT` release status when native evidence is absent.

Optionally materialize the same non-native canonical artifacts for review:

```powershell
npm run validate:production
```

This writes under `output/validation-matrix`. It is a validation artifact set, not a release, and must remain `DRAFT`.

## 4. Native release gate

Run only on Windows with Microsoft Excel Desktop 2019 or later installed. Use a unique UTC timestamp/evidence directory:

```powershell
$releaseTimestamp = (Get-Date).ToUniversalTime().ToString('o')
$runId = $releaseTimestamp -replace '[:.]', '-'
npm run release:native -- --generated-at $releaseTimestamp --output output/generated-products --evidence "release-evidence/production-expansion/native-excel/$runId"
```

The CLI executes seven required sales scenarios: Basic NL Light; Professional NL Light/Dark; and Ultimate NL/DE Light/Dark. They use EUR, `sage-finance`, capacity 100, and sample data. This scenario set is tier-focused and is not a native matrix for all seven active product definitions.

Five of those native-tested workbooks form the master sales set:

- `basic-light.xlsx`;
- `professional-light.xlsx`;
- `professional-dark.xlsx`;
- `ultimate-light.xlsx`;
- `ultimate-dark.xlsx`.

For every product, the CLI:

1. completes contract/catalog preflight and creates XLSX bytes;
2. rereads those bytes with ExcelJS/JSZip and captures their SHA-256;
3. passes a defensive copy of that exact byte sequence to `compatibilityProbe`;
4. opens it read-only in Excel with macros, events, alerts, and link updates disabled;
5. performs a full dependency-tree rebuild and recalculation;
6. rejects external workbook links, circular references, calculated formula errors, or a native/structural formula-count mismatch;
7. writes a separate `SaveCopyAs` file, reopens it in Excel, and rereads the saved copy structurally;
8. returns `PASS` evidence for the declared `excel-desktop` target;
9. generates and validates all ten listing PNGs, packages the original tested workbook bytes—not the Excel save-copy—and verifies workbook/image hashes inside the file map and ZIP;
10. requires validation `PASS`, quality `PASS` with score at least 90, compatibility `PASS`, physical image validation `PASS`, and both manifests `READY_FOR_REVIEW`.

The CLI verifies the complete 31-file full-package path set and every ZIP checksum. All seven scenarios and the five-workbook master sales set are validated in staging before promotion into the managed project output hierarchy. Promotion uses backups and per-target rollback; staging is removed on success or failure. Existing managed targets are not replaced unless `--replace` is explicitly supplied.

## 5. Evidence review

Review each product evidence directory and the run-level `summary.json`:

- generated-source and Excel-saved workbook paths/hashes;
- `excel-smoke.json`, including recorded Excel version, calculation version, formula count, formula-error list, external links, circular-reference state, and checks;
- structural validation of the Excel save-copy;
- packaged workbook hash equal to the native-tested source hash;
- package paths, entry sizes, media types, and SHA-256 values;
- all ten physical image paths, PNG metadata, dimensions, unique hashes, and final-ZIP validation;
- the five master-sales-set workbook paths/hashes and archive equality;
- validation, quality, compatibility, generated-product, image-production, and release manifests.

Native evidence recorded before the seven-product, six-theme, physical-image release policy is historical and must not be presented as current certification. Use a newly completed run-level summary for the current implementation.

The CLI records the Excel version but does not enforce the numeric `2019+` floor. The reviewer must confirm that policy from the recorded version/environment.

## 6. Commercial review boundary

Before approval, review:

- workbook calculations against independent financial fixtures;
- locale, currency, theme, instructions, protection, validation, print, and accessibility behavior;
- listing title/description/tags/features, included files, use cases, four FAQ entries, alt text, price positioning, bundle suggestion, and upsell suggestion;
- license, disclaimers, marketplace policy, refund language, and commercial claims;
- the ten generated PNGs for localized copy, contrast, clipping, visual hierarchy, and marketplace suitability.

The base PNGs are generated and validated without Photoshop. The Photoshop batch manifest is optional downstream automation metadata; no PSD or smart-object execution is generated by the package or native release CLI.

No command in this repository records authoritative human approval or performs external upload/publication. Any such process is outside this repository and requires separate authorization and tooling.

## Stop conditions

Stop when:

- any test, security, performance, structural, native, formula, hash, path, or manifest gate fails;
- compatibility is not `PASS` or either manifest is not `READY_FOR_REVIEW`;
- the packaged workbook hash differs from the exact native-tested source bytes;
- the Excel version is older than 2019 or cannot be established;
- evidence is missing, stale, historical-only, or tied to another configuration;
- listing, legal, pricing, image, accessibility, or financial review is incomplete;
- any claim implies certification for Excel Web, LibreOffice, Google Sheets, human approval, publication, Photoshop execution, or PSD generation.
