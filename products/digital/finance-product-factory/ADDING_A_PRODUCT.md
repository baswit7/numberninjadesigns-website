# Adding a product

## Current extension model

Products are code-reviewed declarative data in `src/products/index.mjs`; there is no runtime plugin loader. New executable formula or validation behavior requires an engine change and tests, not a new string in product data.

Start a new product as `beta` with a pre-1.0 semantic version. Promote it to `active` only after the complete production checklist below is supported by evidence.

## Implementation sequence

1. Choose a stable lowercase ID, product family, category, and semantic version. IDs must match `^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$`.
2. Add product name and description keys to every production locale in `src/locales/index.mjs`. Keep the canonical active-locale key sets identical.
3. Declare `outputTypes` when the product is not the implicit XLSX/ZIP type. Build sheets for `xlsx` and strict `documentTemplates` for `docx`; combined products may declare both.
4. Keep formulas declarative. Select one of the operations documented in [FORMULA_ENGINE.md](FORMULA_ENGINE.md) and supply the exact structured `parameters` shape that its builder reads.
5. Resolve every cross-sheet range, validation source, formula target, and referenced column. A list source must use `sheetId.columnId`.
6. Provide safe, realistic sample rows and populated lookup values. Formula cells must not contain sample input values.
7. Provide commercial metadata, the exact ten 2400×1600 PNG specifications documented in [IMAGE_PRODUCTION.md](IMAGE_PRODUCTION.md), compatibility declarations, and the export profile. The shared `define()` helper supplies the current common defaults; review them rather than assuming they fit every product.
8. Register the definition in the appropriate exported array. A lightweight beta can be added to `betaSpecs`; an active product needs a dedicated definition and must be included in `productionProductDefinitions`.
9. If promoting to active, add product-specific entries to `ACTIVE_SAMPLE_ROWS` and verify that `enrichProductionDefinition()` produces a professional instructions sheet and any required lookup/analysis sheets. The enrichment function contains explicit special cases and does not infer new product behavior.
10. Run all contract, catalog, workbook, and package gates before requesting release review.

## Contract checklist

Every `ProductDefinition` must contain:

- schema version `1.0.0`, ID, SemVer version, status, family, category, localization keys, sale type, difficulty, tags, recommendation flag, and features;
- supported locales, currencies, and themes that exist in their catalogs;
- a strict default `ProductConfiguration` and configurable-field declarations;
- for `xlsx`, at least one strict `SheetDefinition` plus flattened product-level formula and validation collections;
- for `docx`, at least one strict `DocumentTemplate`, `outputOptions.documents: true`, `docx-ooxml`, and `documents` in the export profile;
- non-empty quality-rule metadata, commercial metadata, and image specifications;
- compatibility targets and an export profile.

Unknown top-level fields are rejected. The current shared defaults declare four production locales, six currencies, six themes, `excel-desktop` as the sole target, Excel 2019 minimum, mandatory recalculation, and no Google Sheets support. Excel for the web and LibreOffice are also not release-certified. Change the target declaration only with matching implementation, native probe logic, tests, and release evidence.

See [DOCUMENT_PIPELINE.md](DOCUMENT_PIPELINE.md) for the strict document schema, supported v1 elements, package behavior, and PDF/Google Docs boundaries.

## Formula and validation rules

- Do not embed raw Excel formulas in product definitions.
- Use `parameters`, not contract-valid `args`, for workbook formulas; the current workbook compiler does not route `args` to the low-level compiler.
- `fillDirection: "down"` is the only implemented multi-cell fill mode. `right` is not horizontally expanded.
- Keep validation lists short enough for the Excel inline-list limit or source them from a lookup column.
- Treat `inputRowsBound` as metadata only; the current compiler does not read it.
- Add an explicit code builder and negative security tests for any genuinely new operation.

## Required verification

```powershell
npm test
npm run test:production
```

Add focused tests for the new definition. At minimum they must prove strict contract validity, catalog resolution, unique/reachable references, safe sample data, populated lookup sheets, instructions, exact generated formula text, XLSX reread, and deterministic package behavior with fixed inputs.

The production integration suite currently validates 1,296 appearance-aware preflight combinations, generates a 28-case product/locale covering workbook set, builds seven required packages, and validates the five-workbook master sales set without native evidence. Those packages must remain `DRAFT`. Adding or changing an active product changes the derived matrix counts; update the explicit release scenarios only when sales policy requires it. Before promotion, also test the product at supported capacity boundaries and capture current Excel Desktop 2019+ evidence through the exact-byte native release path.

## Promotion gate

A beta may become active only when:

- all active locale messages are complete and reviewed;
- sample data, lookups, and customer instructions are complete;
- contract, catalog, engine, security, reread, and packaging tests pass;
- formula outputs have been reviewed against independent expected calculations;
- performance is acceptable at capacity 1000;
- native target evidence is current and traceable;
- listing metadata includes reviewed included-files, use cases, FAQ, pricing position, bundle, and upsell content;
- commercial copy, license, disclaimer, exact physical image set, image hashes/metadata, and required review evidence are complete.

Full package generation must render and validate the ten base PNGs. Photoshop remains optional; its manifest neither replaces the base-image gate nor proves PSD creation or smart-object execution.

Changing status alone is not promotion evidence, and no automated status constitutes human approval or publication.
