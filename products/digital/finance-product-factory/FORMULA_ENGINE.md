# Formula engine

## Two compiler layers

Formula support is deliberately split:

1. `src/engines/formula-engine.js` provides safe Excel addresses, references, literals, arithmetic, and a generic allowlisted function builder.
2. `src/engines/workbook-engine.js` compiles product-domain `FormulaDefinition.parameters` against resolved sheet and column IDs.

The registries are independent. A function supported by the low-level builder is not automatically a valid workbook product operation, and a workbook-domain operation may expand to several Excel functions.

## FormulaDefinition contract

Schema `1.0.0` requires `id`, `sheetId`, `target`, and uppercase `operation`, plus exactly one of `args` or `parameters`. Optional fields are `fillDirection`, `inputRowsBound`, and `extensions`.

The contract validator proves structure, IDs, sheet/target links, and `args`/`parameters` exclusivity. It does not prove that a code builder exists or that its operation-specific parameters are meaningful. The current workbook compiler uses `parameters`; `args` is not routed to the low-level builder.

## Low-level API

| Export | Boundary |
| --- | --- |
| `columnName()` | Columns 1 through 16,384. |
| `cellAddress()` | Valid Excel column and row 1 through 1,048,576. |
| `quoteSheetName()` | Non-empty, maximum 31 characters, forbidden Excel name characters rejected, quotes escaped. |
| `sheetRange()`, `sheetCell()` | Safely quoted sheet references. |
| `excelString()` | Excel string literal with doubled double-quotes. |
| `assertFormulaReference()` | Local or safely quoted sheet cell/range only. |
| `buildFormula()` | Allowlisted function plus arity and token validation. |
| `arithmetic()` | `+`, `-`, `*`, or `/` over safe tokens. |
| `formulaCount()` | Counts ExcelJS formula objects. |
| `supportedFormulaOperations` | Frozen eleven-function list. |
| `assertSafeIdentifier()` | Excel-like identifier validation. |

The eleven low-level functions are `SUM`, `SUMIF`, `SUMIFS`, `COUNTIF`, `COUNTIFS`, `AVERAGE`, `MIN`, `MAX`, `IF`, `IFERROR`, and `ROUND`.

Low-level tokens may be finite numbers, numeric strings, quoted Excel strings, booleans, cells, or ranges. An argument beginning with `=` is rejected, preventing nested raw formula injection.

## Workbook operation registry

`FORMULA_OPERATIONS` is frozen and currently contains 29 operations:

| Group | Operations |
| --- | --- |
| Core aggregate/control | `SUM`, `SUMIF`, `SUMIFS`, `COUNTIF`, `COUNTIFS`, `SUBTRACT`, `IFERROR`, `IF`, `MAX`, `MIN`, `ROUND` |
| Frequency/rank/payoff | `FREQUENCY_TO_ANNUAL`, `RANK_ASCENDING`, `RANK_DESCENDING`, `PROJECTED_PAYOFF_DATE` |
| Row arithmetic | `ROW_SUM`, `ROW_DIFFERENCE`, `ROW_PRODUCT`, `ROW_RATIO` |
| Finance/planning | `REMAINING_AMOUNT`, `PROGRESS_PERCENT`, `ANNUALIZED_AMOUNT`, `POTENTIAL_SAVINGS`, `DEBT_PRIORITY`, `ESTIMATED_PAYOFF_DATE`, `TOTAL_INTEREST_ESTIMATE`, `PROJECTED_GOAL_DATE`, `MONTH_STATUS` |
| Reference | `COPY` |

Builders read explicit fields from `parameters`; unsupported or missing references fail during compilation. Source code is authoritative for each exact parameter name.

## Structured expressions

Workbook expressions support:

- finite numbers, booleans, escaped strings, and the special runtime value `TODAY`;
- local column references with optional integer row offset;
- cross-sheet ranges with `sourceSheetId` and `columnId`;
- references to another registered formula by `formulaId`;
- a limited set of aggregate IDs;
- nested `ADD`, `SUBTRACT`, `MULTIPLY`, or `DIVIDE` over at least two operands;
- constants through a `constant` wrapper.

`IF` comparison operators are uppercase `EQUAL`, `NOT_EQUAL`, `LESS_THAN`, `LESS_THAN_OR_EQUAL`, `GREATER_THAN`, and `GREATER_THAN_OR_EQUAL`. Conditions may combine recursively with `AND` or `OR`.

SUM/COUNT criteria accept equivalent camel-case or uppercase comparison operators. `MONTH_EQUALS` expands one month into a configured-year start date and exclusive next-month boundary using `DATE`, `MATCH`, and `EDATE`.

## Targeting and fill

A formula target may be:

- an explicit A1 cell;
- a column ID on its declared sheet;
- a dashboard metric placed in the value column;
- `parameters.targetColumnId`;
- a validated `extensions.targetCell`.

`fillDirection: "down"` compiles across the sheet capacity. `none` and `right` currently compile a single target. Every output must begin with exactly one `=`, must not contain `#REF!`, and is stored in ExcelJS without the leading `=` and with cached result zero.

## Domain-specific behavior

- Payoff/date operations use `NPER`, `EDATE`, `ROUNDUP`, and `TODAY`; their output depends on target-application recalculation and its financial-function semantics.
- `FREQUENCY_TO_ANNUAL` recognizes uppercase `WEEKLY`, `BIWEEKLY`, `QUARTERLY`, `SEMI_ANNUAL`, and `ANNUAL`, defaulting other values to monthly.
- `ANNUALIZED_AMOUNT` instead recognizes title-case `Weekly`, `Biweekly`, `Quarterly`, and `Yearly`, also defaulting to monthly.
- `POTENTIAL_SAVINGS` recognizes title-case `Cancel` or `Review`; product definitions must align their validation values with the selected operation.
- Aggregate resolution contains limited aliases and debt-plan behavior; it is not an arbitrary query language.

These differences are implementation facts and should be normalized before a new product depends on them.

## Security and failure behavior

- Product data cannot inject a new operation or raw expression.
- Strings become Excel literals; sheet names and references are quoted/bounded.
- Unknown operations, sheets, columns, formula IDs, targets, criteria operators, condition operators, row offsets, and nested operations throw.
- Compilation rejects output without the expected formula envelope or with `#REF!`.
- Ordinary spreadsheet text is separately neutralized by `safeSpreadsheetText()`.

The engine never evaluates formulas in JavaScript and does not treat formula text as shell, HTML, or network instructions.

## Extension procedure

Adding an executable workbook operation requires:

1. a stable uppercase operation ID;
2. a code-defined builder using only structured validated inputs;
3. explicit parameter/reference validation and useful fail-closed errors;
4. unit tests for positive, boundary, missing-reference, and injection cases;
5. exact formula assertions after XLSX serialization/reread;
6. independent calculation fixtures and native target evidence.

Do not expose a generic raw-expression escape hatch.

## Current test boundary

```powershell
node --test tests/engine-support.test.mjs tests/workbook-engine.test.mjs tests/contracts-registry.test.mjs tests/catalogs-products.test.mjs
```

Current tests prove low-level `SUM`, nested-raw-formula rejection, selected exact workbook formulas, fail-closed unknown operations, and catalog reference integrity. They do not execute all 29 builders or prove native calculation results. See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) and [TESTING.md](TESTING.md).
