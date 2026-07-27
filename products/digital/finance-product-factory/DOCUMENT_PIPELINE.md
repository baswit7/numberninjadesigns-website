# Integrated document pipeline

## Boundary

DOCX is an additive capability of the existing factory. Document products use the same `ProductDefinition`, `ProductRegistry`, configuration, preflight, quality, package, and managed-output flow as XLSX products. There is no second registry, package engine, repository, or standalone generator.

## Product contract

`ProductDefinition.outputTypes` may declare `xlsx`, `docx`, and `zip`. Existing definitions that omit this field retain the implicit `['xlsx', 'zip']` behavior. A definition that declares `docx` must also declare `documentTemplates`, enable `defaultConfiguration.outputOptions.documents`, include `documents` in its export profile, and declare the `docx-ooxml` compatibility target.

Workbook-only fields (`sheets`, `formulas`, `validations`, and `exportProfile.workbookFilenameTemplate`) are optional for document-only definitions and remain required by semantic validation whenever `xlsx` is declared.

Each `DocumentTemplate` is a strict versioned contract with:

- identity, language, title, metadata, filename, and package-relative path;
- sections containing paragraphs, headings, ordered/unordered lists, tables, and page breaks;
- declared editable placeholders with labels, instructions, and required flags;
- optional header/footer, A4 or Letter page settings, margins, and a bounded style preset;
- required visible text markers and closed packaging metadata.

Unknown fields are rejected except inside the explicit `extensions` object. Table widths must contain one value per column and total exactly 9,360 DXA.

## Runtime

`FinanceProductFactoryRuntime.generate()` dispatches declared outputs to the existing workbook engine and/or `src/engines/document-engine.js`. The document engine builds deterministic ECMA-376 DOCX packages with local JSZip, a fixed ZIP timestamp, no network access, no macros, and no Office dependency. A fixed `generatedAt` value produces stable bytes for equivalent input.

The document validator reopens the DOCX and verifies:

- non-empty ZIP bytes and mandatory OOXML parts;
- safe, unique internal paths and resolvable internal relationships;
- absence of external or absolute file relationships;
- required titles/markers and declared/required placeholder integrity;
- generated document, heading, list, table, placeholder, part, and byte metrics.

`src/commercial/package-engine.js` retains one public package entrypoint. Its integrated document branch packages DOCX and optional XLSX payloads with the existing README, quick-start, license, listing, reports, and manifests. `src/server/output-storage.mjs` accepts `kind=document`, validates the container again, and writes only below `output/generated-products`.

## Supported v1 layouts

Version 1 intentionally supports business-document layouts: single-column paragraphs, three heading levels, lists, fixed-width tables, page breaks, headers/footers, page numbers, and editable highlighted placeholders. It does not implement floating text boxes, shapes, images, multi-column page sections, tracked changes, embedded fonts, macros, or desktop-publishing layouts.

## Export decisions

- PDF: `NOT_IMPLEMENTED`. No deterministic repository-local conversion route meets the no-COM, no-browser, no-cloud, and no-global-install constraints.
- Google Docs: `NOT_IMPLEMENTED` as a native export. Generated DOCX may be manually imported; that is a compatibility note, not an integrated export claim.

## Verification and release output

Run focused document and product checks with:

```powershell
node --test tests/document-foundation.test.mjs tests/career-products.test.mjs
```

Generate the Dutch and English Career release artifacts with:

```powershell
node scripts/generate-career-release.mjs
```

The script refuses to overwrite an existing Career variant directory and writes only below `output/generated-products`.
