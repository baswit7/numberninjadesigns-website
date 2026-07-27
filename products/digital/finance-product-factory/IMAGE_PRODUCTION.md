# Image production

## Honest output claim

`src/commercial/listing-image-engine.js` renders a real, deterministic Etsy image set during full package generation. A successful package contains exactly ten distinct 2400×1600 RGB PNG files. `src/commercial/package-engine.js` validates those bytes, records their evidence, adds them to the sales ZIP, reopens the finished ZIP, and validates the archived bytes again.

Photoshop is optional. The package can include an automation manifest for downstream enhancement, but the factory does not require Photoshop, launch it, edit a PSD, or claim that a PSD exists.

## Exact asset set

Every active product uses this ordered set:

1. `listing/images/01-hero.png`;
2. `listing/images/02-dashboard-overview.png`;
3. `listing/images/03-monthly-budget.png`;
4. `listing/images/04-key-features.png`;
5. `listing/images/05-light-dark-comparison.png`;
6. `listing/images/06-whats-included.png`;
7. `listing/images/07-language-currency-options.png`;
8. `listing/images/08-how-it-works.png`;
9. `listing/images/09-workbook-previews.png`;
10. `listing/images/10-digital-download.png`.

`ProductDefinition.imageSpecifications`, the renderer blueprints, release validator, package manifest, and tests must agree on those IDs, order, filenames, `png` format, and 2400×1600 dimensions.

## Render inputs and behavior

Image generation requires:

- a contract-valid active product and configuration;
- generated workbook bytes and a passing structural validation report;
- the selected product locale, market, currency, year, theme, tier, and Light/Dark appearance;
- the same preview model and product definition used by the workbook flow;
- localized listing copy and alt text.

The renderer uses `deterministic-rgb8-raster-v1`. It produces local raster graphics from product facts, workbook structure, preview content, chart definitions, theme tokens, and configuration. It does not fetch templates, screenshots, fonts, images, or URLs.

Each PNG embeds product ID/version, locale, theme, tier, appearance, source-workbook SHA-256, render method, and image ID. The image manifest records the same identity, physical byte count, media type, dimensions, package path, localized alt text, and SHA-256.

## Fail-closed validation

`validateListingImageSet()` rejects the set unless all of the following are true:

- there are exactly ten image objects and ten manifest assets in canonical order;
- every path, filename, ID, locale, theme, tier, appearance, and dimension matches;
- every asset is `validated`, `image/png`, non-empty, and linked to the source-workbook hash;
- PNG signature, chunks, decoded raster, landscape dimensions, and embedded metadata are valid;
- the calculated SHA-256 matches the image object and manifest;
- all ten hashes are unique;
- localized alt text and render/chart evidence are present;
- the manifest execution claim is `GENERATED_AND_VALIDATED_IMAGE_ASSETS`.

Package construction then writes the PNGs using ZIP `STORE`, verifies required paths and checksums, reopens the finished ZIP, extracts all ten PNGs, and runs the image validator again. A missing, reordered, malformed, duplicated, or tampered image blocks the package.

## ImageProductionManifest

The strict `ImageProductionManifest` starts as a plan and is completed by the renderer. In the returned package it contains physical `validated` assets with hashes and evidence. Its extensions include:

- canonical filenames, package paths, required IDs, and dimensions;
- localized briefs and alt text;
- tier, appearance, theme, locale, and workbook SHA-256;
- preview sheet/formula evidence and chart/source-sheet evidence;
- render method and final validation report;
- `productionPolicy.executionClaim: GENERATED_AND_VALIDATED_IMAGE_ASSETS`.

The full package's root `manifest.json` repeats the physical listing-image index and the final image-validation result.

## Supporting manifests

### Optional Photoshop manifest

`images/photoshop-batch-manifest.json` describes optional downstream automation against the already validated base PNG set. It uses `OPTIONAL_AUTOMATION_MANIFEST_BASE_PNGS_VALIDATED`, sets `sourceAssetRequired: false`, and records layer/target names, replacement values, palette, fonts, dimensions, and output names.

It is not a PSD, does not prove Photoshop execution, and is not required to obtain the generated base images.

### Copy-overlay plan

`images/copy-overlay-plan.json` references the generated assets, hashes, localized copy, badges, calls to action, length limits, and contrast requirement. Its status is `GENERATED_VALIDATED`.

### Mockup shot list

`images/mockup-shot-list.json` maps eight downstream shot concepts to physical validated assets and hashes. Its status is `GENERATED_VALIDATED`; it does not claim that Photoshop or photographic device mockups were produced.

### Listing alt text

`listing/alt-texts.txt` contains the localized alt text for the same ten physical PNG assets. The structured copies also live in the image and root manifests.

## Browser and project storage

After generation the UI shows ten thumbnails from the generated bytes. The user can store:

- one PNG at a time;
- all ten images as an Etsy-image ZIP;
- the complete sales ZIP containing the same ten assets.

When the local server is available, these actions write below the scoped `output/generated-products/<product>/<locale>/<currency>/<theme>/<appearance>/v<version>/` hierarchy. Individual PNGs go to `listing/images/`. The server validates the requested metadata, safe destination, size, and PNG/ZIP container before writing and returns a SHA-256 receipt. If the storage service is unavailable, the browser offers a normal download instead.

## Security boundary

- No remote asset, CDN, URL, Photoshop process, or customer file is loaded.
- Dynamic copy is localized and bounded; package paths use the central traversal/device-name protections.
- Output storage rejects unknown catalog values, unsafe filenames, symlinks, out-of-root paths, malformed containers, and bodies above the configured limit.
- Image and package validation fail closed; no partial set is returned as complete.

## Boundaries

- The renderer creates programmatic listing graphics, not photographic device mockups or a PSD.
- Automated decode, metadata, hash, contrast-foundation, and layout checks do not replace human visual or marketplace-policy review.
- The optional Photoshop, overlay, and mockup helper manifests are not separate registered strict contracts; `ImageProductionManifest` is.
- No technical status constitutes human approval or publication.

## Verification

```powershell
node --test tests/listing-image-engine.test.mjs tests/package-engine.test.mjs
npm run test:production
npm run test:e2e
```

Tests cover exact filenames/order, physical 2400×1600 PNG generation, decode and embedded metadata, unique hashes, localization, manifest alignment, missing/tampered-image rejection, final-ZIP verification, image-only ZIP export, thumbnails, and managed project storage.
