# Testing

## Default suite

```powershell
npm test
```

`package.json` maps this command to `node --test`, so Node discovers the preserved intelligence-module tests and all current factory tests.

| Area | Primary evidence |
| --- | --- |
| Historical baseline | Three entrypoints, checksum-preserved sources, evidence inventory, contract inventory. |
| Catalog/contracts | Fifteen strict schemas, semantic invariants, seven active/seven beta products, four production locales, six currencies, six themes. |
| Engine/security | Configuration migration, formula/text injection defenses, safe JSON/ZIP paths, batch bounds and report contracts. |
| Frontend integration | JavaScript/import resolution, DOM IDs/labels, local assets/CSP, unsafe sink absence, keyboard wiring, responsive focus. |
| Workbook/package/images | XLSX generation/reread, exact formulas, protection/validation, physical PNG decode/metadata/hashes, exact-byte probe handoff, and deterministic 31-file ZIP validation. |
| Production matrix | 1,296 appearance-aware preflight cases, 28 covering workbook generations, seven required packages, five-file master sales set, recovery, and semantic determinism. |
| Preserved intelligence modules | Existing Etsy and listing-engine behavior and deterministic exports. |

## Focused production matrix

```powershell
npm run test:production
```

This runs `tests/production-integration-matrix.test.mjs` and proves:

1. all 1,296 appearance-aware combinations across seven active products, four production locales, six currencies, six themes, and supported Light/Dark appearances pass deterministic preflight;
2. 28 product/locale covering variants generate contract-valid XLSX files with formulas, validations, unlocked inputs, hashes, and independent reread;
3. seven required tier/locale/appearance packages persist and recover transactionally in an OS temporary directory;
4. every full package contains the canonical ten 2400×1600 PNG set and rejects missing/tampered images;
5. the five physical master-sales-set workbooks exactly match the corresponding ZIP entries.

The matrix intentionally provides no native Excel evidence. It asserts compatibility `PARTIAL` and release `DRAFT`, preventing structural tests from becoming compatibility claims.

`npm run validate:production` runs the production validator as a repository-output command and writes `output/validation-matrix`; it is not an additional compatibility test and does not produce release-ready artifacts.

## Exact-byte compatibility test

`tests/workbook-engine.test.mjs` injects a controlled `compatibilityProbe`, hashes the bytes received by the probe, and asserts that the runtime result and packaged workbook contain the same byte sequence. It proves orchestration and immutability of the handoff.

The injected probe is not Microsoft Excel. Actual Excel certification is performed only by the native release CLI.

## Native Excel verification

`scripts/excel-open-save-smoke.ps1` requires Windows and installed Microsoft Excel. It:

- opens the generated workbook read-only with macros, events, alerts, and link updates disabled;
- runs `CalculateFullRebuild`;
- rejects external workbook links and circular references;
- counts formulas and rejects calculated `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?`, `#NUM!`, `#N/A`, and `#NULL!` cells;
- writes a separate `SaveCopyAs` workbook and reopens it;
- records Excel/calculation versions, paths, hashes, checks, limitations, and failures.

The production orchestrator is:

```powershell
npm run release:native
```

It additionally compares native and structural formula counts, rereads the Excel save-copy, verifies that the original tested bytes are packaged unchanged, checks all 31 package paths/checksums and ten PNGs, and promotes managed output only after all seven required scenarios plus the five-workbook master set pass. The automated Node suite does not launch this COM workflow.

## Browser E2E and visual evidence

The browser runner uses a locally installed Playwright/Chromium verification runtime; Playwright is not a production dependency. Point `NODE_PATH` at the verified Playwright `node_modules` directory, then run:

```powershell
$env:NODE_PATH='C:\path\to\playwright\node_modules'
npm run test:e2e
```

The 14-gate runner starts and stops its own local server and fails closed on console/page errors, external requests, failed or HTTP-error requests, overflow, accessibility checks, or invalid output. It covers desktop 1440×900, mobile 390×844, all twelve steps, seven visible products, four production locales, six themes, real XLSX/sales-ZIP/image-ZIP/PNG generation, direct managed project storage, local decision controls, batch cancel/resume/archive, backup/import/reset, keyboard/focus, reduced motion, labels, names, duplicate IDs, 44×44 touch targets, and automated text contrast. Evidence and screenshots are written to [the browser E2E report](release-evidence/production-expansion/browser-e2e/report.json).

## Other evidence commands

```powershell
npm run verify:security
npm run measure:performance
npm run validate
```

- Security verification inspects 22 runtime files, CSP/local-assets/network/dynamic-code controls, high-confidence secret patterns, and vendor hashes; it writes `release-evidence/production-expansion/security/report.json`.
- Performance verification measures capacities 50–1000 plus the current active-product batch; it writes `release-evidence/production-expansion/performance/measurements.json`. Existing five-product measurements are historical until the command is rerun for the seven-product catalog.
- Historical validation rewrites `release-evidence/baseline-validation.json`; it protects provenance and old baseline evidence, not current release compatibility.

## Certification boundary

The sole release-certified target is Excel Desktop 2019+. Excel for the web, LibreOffice, and Google Sheets are not release-certified. A structural reread, browser download, injected test probe, or manually supplied `compatibilityEvidence` cannot substitute for a successful current native CLI run on the certified target.

Stored native evidence from the earlier five-product policy predates the current catalog and physical-image gate. It is historical evidence, not current certification. A current run-level summary must cover the present seven scenarios and master sales set.

## Remaining gaps

- The native CLI covers seven tier/locale/appearance sales scenarios, not every active product or catalog variant.
- Only 28 of the 1,296 preflight combinations are generated as the automated workbook covering set.
- Formula builders are not independently executed operation-by-operation in every product context.
- Automated accessibility evidence does not replace assistive-technology and expert manual review.
- Financial correctness, commercial/legal copy, marketplace policy, and generated-image composition still require review outside the automated gates.
- No automated test creates or validates a PSD because PSD generation is not implemented.
