# Themes

## Catalog

`src/themes/index.mjs` contains six immutable, active `ThemeDefinition` schema `1.0.0` values.

| Theme ID | Primary | Accent | Canvas |
| --- | --- | --- | --- |
| `executive-navy` | `#153A5B` | `#8A5700` | `#F4F7FB` |
| `modern-minimal` | `#202124` | `#00695C` | `#F7F7F7` |
| `warm-neutral` | `#5B4536` | `#8A4E12` | `#FBF7F1` |
| `sage-finance` | `#2C5940` | `#765600` | `#F4F7F2` |
| `soft-pastel` | `#66435E` | `#17645B` | `#FFF9FC` |
| `lavender-balance` | `#51446F` | `#2F6F72` | `#F8F6FC` |

All themes use `Aptos Display` for headings, `Aptos` for body text, and `Cascadia Mono` for monospaced text. Rendering may substitute fonts when a target system does not have them installed.

## Semantic structure

Each strict definition includes:

- identity, version, status, and localized name key;
- a complete semantic color palette for canvas, surfaces, headings, body text, borders, bands, inputs, formulas, success, warning, error, and inverse text;
- heading/body/mono font names;
- workbook-style metadata for headers, tables, dashboard cards, input cells, calculated cells, and feedback states;
- a reduced preview palette;
- extension metadata for semantic tokens, print profile, and image-production palette.

The catalog tests validate each contract and require at least a 4.5 contrast ratio for the tested body, header, input, formula, and feedback combinations. They also require visually distinct input and formula fills.

## Runtime use

The preview engine uses `theme.preview`. The workbook engine consumes `theme.colors` and `theme.fonts` to style titles, headers, inputs, formula cells, conditional formatting, and tabs. The listing-image engine derives accessible Light/Dark raster palettes from the selected theme and embeds the theme identity in each PNG and manifest.

Two boundaries are important:

- `workbookStyles` is validated semantic metadata, but the current workbook engine builds its concrete ExcelJS styles directly from `colors` and `fonts` rather than applying every `workbookStyles` object.
- `extensions.printProfile` is downstream metadata. Current worksheet orientation, paper size, and fit values come from each `SheetDefinition.print`.

## Adding a theme

1. Add a strict theme entry to `themeCatalog` with a stable lowercase ID and SemVer version.
2. Supply every required color and workbook-style field; use six-digit hex colors only.
3. Add the localized theme name key to all active locale bundles.
4. Add the ID to each product that supports it and decide whether it should be a configuration default.
5. Verify preview, workbook, print, monochrome, and image-production output.
6. Run the contract/catalog suite and generate representative workbooks with input, formula, warning, error, and conditional-format states.

```powershell
node --test tests/contracts-registry.test.mjs tests/catalogs-products.test.mjs tests/workbook-engine.test.mjs
```

## Release checks

- Body and state text meet the required contrast threshold.
- Input and calculated cells remain distinguishable without relying on color alone.
- Negative/positive conditional formats remain legible.
- Header text is readable against the accent fill used by the workbook engine.
- Print output remains understandable in grayscale.
- Font substitution does not break header height, column width, or page fit.

The current automated tests cover contrast foundations and structural workbook styling. They do not perform screenshot comparison for every theme or verify installed-font rendering in native spreadsheet applications.
