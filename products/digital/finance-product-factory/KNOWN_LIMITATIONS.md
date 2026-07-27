# Known limitations

This file records current implementation boundaries. None is waived by a passing contract or quality score.

## Documents

- DOCX v1 supports single-column business-document layouts, headings, paragraphs, lists, fixed-width tables, page breaks, headers/footers, page numbers, and editable placeholders. It does not support images, floating objects, multi-column sections, embedded fonts, tracked changes, or macros.
- PDF export is `NOT_IMPLEMENTED`; the approved constraints exclude Word/COM automation, browser conversion, cloud APIs, global installs, and non-deterministic conversion routes.
- Google Docs export is `NOT_IMPLEMENTED`. Manual DOCX import is a compatibility note only and is not release-certified native export.
- OOXML structural validation and local rendering do not prove that every installed Word-compatible editor will paginate identically.

## Workbook and formulas

- ExcelJS writes but does not calculate formulas. Generated cells use cached result `0`, and the workbook requests full recalculation on open.
- Automated reread checks syntax/structure and `#REF!`; it does not prove the financial result.
- The 29-operation workbook registry is not covered operation-by-operation in execution tests or across all products.
- Contract-valid `FormulaDefinition.args` is not routed through the workbook compiler; product formulas must use builder-specific `parameters`.
- `fillDirection: "right"` is treated as a single-cell non-down formula, and `inputRowsBound` is not consumed.
- `FREQUENCY_TO_ANNUAL` and `ANNUALIZED_AMOUNT` expect different frequency token casing/vocabularies.
- Several aggregate aliases and debt-plan edge cases are hard-coded in the compiler rather than described by a generic aggregation contract.
- Formula-sheet protection uses a known static password. It prevents accidental edits, not malicious access or data disclosure.

## Compatibility and release evidence

- Normal browser generation does not supply native target evidence, so compatibility is `PARTIAL` and packages remain `DRAFT`.
- Excel Desktop 2019+ is the native-smoke-test target. Budget Planner Ultimate has a Google Sheets import-ready edition that passes local formula/OOXML analysis, but native Google import certification requires an authorized external Google Drive action and is deliberately not claimed by the local build.
- Excel for Mac and Excel for the web use the same cross-platform formula profile; this Windows environment cannot provide native Apple or browser execution evidence.
- `scripts/generate-native-release.mjs` requires Windows and an installed Excel COM application. Native evidence is run-scoped: a scenario-level smoke `PASS` or Excel-saved copy is insufficient. Only a current run-level summary covering all seven required scenarios and the five-workbook master sales set can support the technical `READY_FOR_REVIEW` status; failed or partial run directories must not be promoted.
- The native CLI records the Excel version but does not parse and enforce the `2019+` floor; the release operator must verify that the recorded version satisfies policy.
- The CLI covers seven tier/locale/appearance scenarios for Basic, Professional, and Ultimate. It does not natively cover all seven active products or every locale, currency, theme, appearance, or capacity.
- Direct callers can supply `compatibilityEvidence` without running COM. That API capability is not an approved release-evidence path; certified release uses the native `compatibilityProbe` CLI.
- Older four-sheet and five-product native evidence remains historical and cannot certify the current seven-product, physical-image implementation.

## Catalog maturity

- Seven products are active. Six spreadsheet release candidates, seven workbook betas, and three Career betas pass strict structural contracts but do not have equivalent production release evidence.
- All 1,296 appearance-aware catalog combinations receive deterministic preflight validation, but only a 28-case product/locale covering set is generated during the automated workbook matrix test.
- `fr-FR` is complete but unreviewed beta; `es-ES` and `it-IT` are partial beta bundles. Production definitions support `nl-NL`, `en-US`, `en-GB`, and `de-DE` only.
- Locale fallback metadata is not automatically merged by workbook translation.

## Quality and accessibility

- The quality engine uses fixed internal dimensions; product `qualityRules` are validated metadata but do not configure scoring.
- `FinanceProductFactoryRuntime.generate()` currently supplies accessibility score `100` and export completeness `100` as constants. They are not measurements of the generated artifact.
- Commercial completeness is based on metadata presence, not independent copy or legal review.
- Automated theme and browser E2E tests cover contrast, screenshots, keyboard/focus, touch targets, and responsive overflow; they do not cover grayscale, font substitution, or real screen-reader behavior.

## Themes and rendering

- Workbook rendering depends on the spreadsheet reader and installed fonts; Aptos/Cascadia substitutions can change layout.
- The workbook engine uses theme colors/fonts directly and does not apply every `workbookStyles` object.
- Theme print-profile extensions do not override worksheet print settings; `SheetDefinition.print` is authoritative.
- The factory renders and validates ten programmatic 2400×1600 base PNGs. It does not create photographic device mockups, execute Photoshop, or create PSD files; visual and marketplace suitability still need review outside the automated gate.

## Application and persistence

- There is no remote backend, account synchronization, cloud storage, telemetry, CI/CD, or deployment configuration. A local HTTP endpoint exists solely to store validated output under the managed project directory.
- Drafts and local approval state use unencrypted browser `localStorage`; they are device/browser-profile specific and unsuitable for secrets or customer financial data.
- Batch generation is sequential and in-process, with a default UI limit of 25 combinations. Size/file estimates are heuristics unless historical measurements are supplied.
- Retained batch values and ZIP assembly can increase browser memory; no worker or streaming archive implementation exists.
- Local decision state does not require compatibility `PASS` and has no external effect. It is not human approval or publication evidence.

## Validation and security

- `inspectWorkbook()` is intended for locally generated bytes and has no explicit compressed/uncompressed input-size policy for arbitrary untrusted uploads.
- Spreadsheet-prefix neutralization reduces formula injection in text cells but is not a malware scanner.
- Package path and JSON safeguards do not validate the truth, legality, or freshness of commercial content.
- Historical `npm run validate` checksums and screenshots protect provenance; they are not a current browser E2E gate.

## Intelligence adapters

- Adapter results are not consumed by the Product Factory runtime and are not registered strict contracts.
- Adapter tests cover the three normalized mappings and their safety/provenance boundary, but no runtime consumer contract exists yet.
- Adapters preserve unknown source fields and provenance but do not prove source accuracy or freshness.
- No live API, MCP, marketplace publication, or canonical cross-module dataflow exists.

## Test and operational gaps

- `npm test` discovers the current Node test corpus, including the production integration matrix, but it does not execute the Windows Excel COM release CLI.
- The real-browser E2E suite depends on a separately installed local Playwright/Chromium verification runtime and is not part of production dependencies.
- The performance script writes evidence on demand, but no result should be treated as portable across hardware or runtimes.
- Deterministic package output is tested only with fixed inputs and timestamp; real-time generation intentionally changes timestamp-bearing content.
