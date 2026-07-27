# Finance Product Factory expansion — 20 July 2026

## Scope and architecture

This expansion remains inside the existing contract-driven Finance Product Factory. It does not add a second workbook generator. Executable products continue to flow through `ProductDefinition` → `ProductConfiguration` → workbook engine → structural inspection → compatibility evidence → commercial release files.

The expansion adds three bounded layers:

1. `src/market/listingview-market-engine.mjs` recursively registers and normalizes the supplied ListingView source set.
2. `src/products/portfolio-catalog.mjs` describes all 85 requested commercial products without pretending every planned row is already executable.
3. Six executable release-candidate definitions compose existing and new sheet/formula modules for annual budget, paycheck budget, debt/savings, projects, business and wedding workflows.

## ListingView evidence boundary

Run `npm run analyze:market` to rebuild `generated/market-intelligence/2026-07-20`.

The analyzer:

- preserves every raw numeric value;
- treats dot-separated values as grouped integers only when field semantics and grouping syntax support that interpretation;
- marks ambiguous values instead of silently guessing;
- classifies CSV rows and screenshots from content evidence rather than filenames alone;
- keeps irrelevant/general exports in the source register while excluding them from niche conclusions;
- deduplicates exact source files and repeated listing rows;
- reports clusters, bands, shops, phrases, features, platforms, themes, opportunities and warnings.

ListingView data is a market signal, not exact Etsy accounting. Wedding evidence remains insufficient for large-scale variant claims; only the technical release candidate is generated and broader variants stay `MARKET_VALIDATION_REQUIRED`.

## Vertical releases

Run `npm run generate:expansion-release` on Windows with Microsoft Excel Desktop 2019 or later. The command stages and promotes eight releases only after the exact generated workbook bytes pass:

- structural ExcelJS/OOXML reread;
- native Excel open and full recalculation;
- formula-error inspection;
- external-link inspection;
- circular-reference inspection;
- SaveCopyAs and reopen.

Each promoted directory contains the source XLSX, the Excel-saved verification copy, an Etsy release ZIP, product/compatibility/validation manifests, customer documentation, a ten-image plan and a ListingView-informed gap analysis.

## Platform truth

Microsoft Excel Desktop is the verified release target for the generated expansion evidence. Google Sheets runtime validation was not available locally. Every release therefore carries:

- `googleSheets.status = PROVISIONAL`;
- a checked-formula list;
- import instructions;
- a minimal manual verification checklist;
- `salesClaimAllowed = false`.

No listing package claims verified Google Sheets compatibility.

## Portfolio phases

- Phase 1: market normalization, 85-product schema, reusable definitions, listing package validation and platform manifests are implemented.
- Phase 2: five finance flagships generate real, natively validated XLSX releases.
- Phase 3: Project Management Spreadsheet generates a real, natively validated XLSX release; the wider family is represented in the portfolio contract.
- Phase 4: Small Business Bookkeeping generates a real, natively validated XLSX release; the wider family is represented in the portfolio contract.
- Phase 5: one complete Wedding Planning release candidate generates real output; broad variants remain market-gated.
- Phase 6: life/family products are architecturally defined but deferred from executable release work because the requested priority is lower and vertical proof precedes breadth.

## Safety and commercial claims

Sample data is fictional and uses non-routable example domains. Workbooks contain no macros, credentials or external workbook links. Business and finance documents use neutral record-keeping language and disclaim professional advice. The release generator writes only below repository-managed `output/` and `release-evidence/` paths.
