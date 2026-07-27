# Commercial exports

## Responsibility

`src/commercial/package-engine.js` builds an offline, checksummed commercial ZIP from validated product/configuration/theme data, workbook bytes, strict validation/quality/compatibility reports, and the generated listing-image set.

It returns the package/workbook filenames, file map, ZIP bytes, listing model, ten physical PNGs, image validation evidence, image/optional-Photoshop manifests, generated-product manifest, and release manifest. It does not upload, publish, price from live market data, launch Photoshop, or create PSD files.

## Input and trust boundary

The engine strictly validates:

- `ProductDefinition`, `ProductConfiguration`, and `ThemeDefinition`;
- `ValidationReport`, `QualityReport`, and `CompatibilityReport`;
- product/version/locale/currency/theme alignment;
- workbook byte type and bounded size.

The package engine trusts the supplied reports; it does not independently run Excel. The approved path to a review-ready package is therefore `npm run release:native`, which runs the native compatibility probe before calling the package engine and re-verifies the packaged workbook hash.

## Full package layout

With the current full export profile and all output flags enabled, the package contains exactly 31 files. The workbook path uses `configuration.filename`; `product/budget-planner-basic.xlsx` is the example below.

```text
product/budget-planner-basic.xlsx
customer/README.html
customer/QUICK_START.html
customer/LICENSE.txt
listing/listing-metadata.json
listing/title.txt
listing/description.txt
listing/tags.txt
listing/features.txt
listing/faq.txt
listing/alt-texts.txt
listing/images/01-hero.png
listing/images/02-dashboard-overview.png
listing/images/03-monthly-budget.png
listing/images/04-key-features.png
listing/images/05-light-dark-comparison.png
listing/images/06-whats-included.png
listing/images/07-language-currency-options.png
listing/images/08-how-it-works.png
listing/images/09-workbook-previews.png
listing/images/10-digital-download.png
images/image-production-manifest.json
images/photoshop-batch-manifest.json
images/copy-overlay-plan.json
images/mockup-shot-list.json
qa/validation-report.json
qa/quality-report.json
qa/compatibility-report.json
qa/generated-product-manifest.json
qa/release-manifest.json
manifest.json
```

`exportProfile.include` and `ProductConfiguration.outputOptions` can remove groups for non-release generation. Package generation itself requires `outputOptions.package: true` and at least one selected payload.

## Listing package

`listing/listing-metadata.json` is a structured `GENERATED_DRAFT` with `reviewRequired: true`. It contains:

- primary and alternative titles, short/full descriptions, and the first 160 characters;
- category, target audience, translated features, keywords, up to 13 normalized tags, marketplaces, license, disclaimers, and listing attributes;
- the certified compatibility declaration and digital-download notice;
- `includedFiles`: workbook filename, `README.html`, `QUICK_START.html`, and `LICENSE.txt`;
- up to six feature-derived use cases;
- four FAQ entries covering digital delivery, verified spreadsheet application, local-data privacy, and refund-policy ownership;
- market/locale variants;
- price positioning with `REVIEW_REQUIRED`, `PREMIUM_VALUE`, selected currency, no suggested amount, and a no-live-evidence rationale;
- one review-dependent bundle suggestion and one review-dependent upsell suggestion.

The text exports mirror the relevant listing fields. `listing/faq.txt` contains question/answer blocks and `listing/alt-texts.txt` contains the generated image-brief alt text.

Titles are capped at 140 characters, short descriptions at 240, tags at 20 characters, and tag count at 13. These limits do not prove marketplace-policy compliance or copy quality.

## Images and supporting manifests

The package includes:

- exactly ten generated and validated 2400×1600 PNG assets in canonical order;
- a strict `ImageProductionManifest` with physical byte counts, SHA-256 values, dimensions, filenames, localized copy/alt text, required IDs, theme/workbook evidence, and validation results;
- an optional Photoshop automation manifest for downstream enhancement of the validated base PNGs;
- generated copy-overlay and eight-shot mapping manifests that reference the physical image paths and hashes.

The image manifest claims `GENERATED_AND_VALIDATED_IMAGE_ASSETS`. The Photoshop manifest claims `OPTIONAL_AUTOMATION_MANIFEST_BASE_PNGS_VALIDATED`, has no required source asset, and does not claim Photoshop execution or PSD creation.

See [IMAGE_PRODUCTION.md](IMAGE_PRODUCTION.md) for the exact lifecycle.

## Status gates

`GeneratedProductManifest.releaseStatus` maps reports as follows:

- any validation, quality, or compatibility `FAIL` → `BLOCKED`;
- all three `PASS` → `READY_FOR_REVIEW`;
- every other combination, including compatibility `PARTIAL` → `DRAFT`.

`ReleaseManifest.status` is `READY_FOR_REVIEW` only for the same all-pass gate; otherwise it is `DRAFT`. Its approvals array is empty. Neither manifest ever grants human approval or publication.

For current products:

- browser and non-native production-matrix packages remain `DRAFT` because compatibility is `PARTIAL`;
- a successful Excel Desktop 2019+ native CLI run can make both manifests `READY_FOR_REVIEW`;
- listing content remains `GENERATED_DRAFT`;
- every returned full package has already passed physical image and final-ZIP validation, independent of the workbook compatibility status.

## Exact-byte native release invariant

The package engine snapshots `workbookBytes` before asynchronous work. The native release CLI:

1. hashes the generated workbook bytes passed to Excel;
2. validates Excel recalculation/open-save and rereads the save-copy;
3. packages the original tested bytes;
4. verifies the file-map workbook hash equals the tested hash;
5. opens the ZIP and verifies every entry hash again.

The Excel save-copy is evidence of native survivability; it is not substituted into the product directory.

## Manifest integrity

Every payload receives normalized path, role, media type, byte count, and SHA-256. The generated manifest includes:

- complete configuration and its stable hash;
- hashes for the product definition, configuration, theme, and commercial metadata;
- validation, quality, and compatibility reports;
- warnings, assumptions, source definitions, payload file records, and checksum index.

The root `manifest.json` additionally records the workbook path/hash, the ten physical image paths/hashes, required path set, and final image-validation result. After ZIP creation the engine reopens the archive, checks the file map and every checksum, extracts all PNGs, and reruns image validation. Missing or tampered image bytes block the package.

The generated/release manifests exclude themselves from the payload checksum list to avoid recursive hashing. `extensions.packagePolicy.manifestCoverage` records `PAYLOAD_FILES_ONLY`.

## Security boundary

- No network or marketplace API is used.
- ZIP paths reject traversal, absolute paths, controls, Windows alternate streams/device names, prototype-like segments, and case-insensitive duplicates.
- Generated text/JSON rejects external URLs and recognizable absolute/traversal locations.
- Customer HTML escapes content and uses a restrictive offline CSP.
- File roles/media types are allowlisted; package entry and uncompressed-byte limits are enforced.
- Workbook bytes are copied before async processing; entries are written in stable order with one timestamp. PNGs use `STORE`; other entries use deterministic DEFLATE settings.

## Limitations

- Listing copy, FAQ, price position, bundle, and upsell fields require market/legal/human review.
- Physical base PNGs exist and are validated, but their commercial composition still requires visual and marketplace-policy review.
- The three Photoshop/overlay/mockup helper manifests are not registered versioned contracts; only `ImageProductionManifest` is.
- Direct callers can construct all-pass reports; release policy must require traceable native CLI evidence rather than trusting arbitrary report objects.
- Byte-identical ZIP determinism requires fixed data, runtimes, and timestamp.
- No technical manifest status constitutes human approval or publication.

## Verification

```powershell
node --test tests/listing-image-engine.test.mjs tests/package-engine.test.mjs tests/workbook-engine.test.mjs
npm run test:production
```

The package tests cover all 31 paths, listing FAQ/included-files/use-case/pricing/bundle/upsell fields, physical PNG decode and hashes, strict manifests, exact payload hashes, deterministic ZIP output, blocked/draft/review-ready mapping, location rejection, and optional-Photoshop boundaries. The workbook test proves exact probe-to-package byte identity. The production matrix proves fail-closed image/ZIP validation and that non-native packages remain `DRAFT`.
