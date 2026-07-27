# Product definitions

## Canonical catalog

`src/products/index.mjs` is the canonical executable product catalog. Every entry is an immutable `ProductDefinition` schema `1.0.0` value registered by exact product ID and semantic version. The browser displays active definitions plus beta definitions carrying the explicit `extensions.releaseCandidate` marker. `src/products/portfolio-catalog.mjs` is the validated 85-product commercial portfolio contract; planned rows do not become executable products without a complete runtime definition.

Exports:

| Export | Contents |
| --- | --- |
| `productionProductDefinitions` | Seven active `1.0.0` definitions. |
| `releaseCandidateProductDefinitions` | Six visible, executable `0.9.0` vertical-release candidates. |
| `betaProductDefinitions` | Seven beta `0.1.0` definitions. |
| `productDefinitions` | The twenty-definition registry input. |
| `productDefinitionById` | Direct ID lookup for the current version of each product. |
| `defaultVisibleProductDefinitions` | Active definitions only. |

## Active catalog

| Product ID | Family | Core features | Sheets |
| --- | --- | --- | --- |
| `budget-planner-basic` | personal budgeting | budget versus actual, category analysis, monthly and annual totals | dashboard, income, expenses, categories, category analysis, instructions |
| `budget-planner-professional` | personal budgeting | annual planning, fixed/variable expenses, bills, goals, cashflow, category analytics, four native charts | 11 sheets |
| `budget-planner-ultimate` | personal finance OS | central transactions, dashboards, cashflow, trends, savings, debt, net worth, analytics, seven native charts | 24 sheets |
| `monthly-budget-planner` | personal budgeting | fixed/variable costs, carry-over flag, month status | dashboard, monthly budget, income, expenses, categories, instructions |
| `debt-snowball-planner` | debt repayment | balance priority, payoff projection, interest tracking | dashboard, debts, payment plan, debt types, instructions |
| `savings-goal-tracker` | savings | multiple goals, contribution log, projected completion | dashboard, goals, contributions, categories, instructions |
| `subscription-tracker` | recurring expenses | renewal dates, annualized cost, savings analysis | dashboard, subscriptions, categories, instructions |

Active definitions include populated lookup content, safe sample rows, and a product-specific instructions sheet. `active` means the definition passes the current catalog and contract gates; it does not replace native spreadsheet compatibility evidence or human commercial review.

## Expansion release candidates

| Product ID | Family | Release evidence |
| --- | --- | --- |
| `annual-budget-spreadsheet` | personal budgeting | ListingView-supported; native Excel release scenario |
| `paycheck-budget-planner` | personal budgeting | paycheck/biweekly ListingView-supported; native Excel release scenario |
| `debt-savings-bundle` | personal finance | debt/savings/bills ListingView-supported; native Excel release scenario |
| `project-management-spreadsheet` | project management | project/task/Gantt/Kanban evidence; native Excel release scenario |
| `small-business-bookkeeping` | small business | bookkeeping/shop evidence; native Excel release scenario |
| `wedding-planner-release-candidate` | wedding planning | technical release candidate; broad variants remain `MARKET_VALIDATION_REQUIRED` |

These definitions reuse existing sheet and formula compositions where workflows overlap. Google Sheets stays provisional and cannot appear as a verified sales claim until a real import checklist is completed with retained evidence.

## Beta catalog

| Product ID | Family | Declared features |
| --- | --- | --- |
| `annual-budget-planner` | personal budgeting | twelve-month plan, category targets |
| `debt-avalanche-planner` | debt repayment | interest priority, payoff projection |
| `sinking-funds-planner` | savings | irregular expenses, target dates |
| `bill-payment-calendar` | bill management | due dates, payment status, calendar view |
| `net-worth-tracker` | net worth | assets, liabilities, history |
| `side-hustle-profit-tracker` | micro business | revenue/cost/profit, tax estimate |
| `small-business-income-expense-tracker` | small business | income/expense, business use, tax summary |

Beta definitions are version `0.1.0`, `recommended: false`, hidden from the default UI, and resolvable only when a caller explicitly allows beta status. They pass the strict data contract but have not received the same production enrichment and release evidence as the active set.

## Shared production matrix

The current definitions declare:

- locales: `nl-NL`, `en-US`, `en-GB`, `de-DE`;
- currencies: `EUR`, `USD`, `GBP`, `CAD`, `AUD`, `CHF`;
- themes: `executive-navy`, `modern-minimal`, `warm-neutral`, `sage-finance`, `soft-pastel`, `lavender-balance`;
- workbook appearances: Light for every active product and Dark for Professional/Ultimate;
- input capacities: `50`, `100`, `250`, `500`, `1000` through configuration;
- release target: Excel Desktop only;
- minimum Excel version: 2019;
- formula recalculation required;
- Excel for the web, LibreOffice, and Google Sheets release certification: none;
- Google Sheets support flag: false.

The default configuration is Dutch/Netherlands, EUR, year 2026, `sage-finance`, Light appearance, capacity 100, sample data enabled, and all output options enabled.

## Definition anatomy

The strict contract requires identity and status, supported catalog IDs, default configuration, configurable fields, sheets, formulas, validations, quality-rule metadata, commercial metadata, image specifications, compatibility, and an export profile. Unknown top-level fields are rejected. The compatibility schema can represent several spreadsheet readers, but the current catalog deliberately declares only `excel-desktop`.

Nested definitions are data only:

- sheets define order, type, columns, capacity behavior, freezes, filters, print settings, formulas, validations, and optional sample rows;
- columns define data type, role, display format, width, lock state, and validation link;
- formulas select a code-defined operation and structured parameters;
- validations select a code-defined rule type and bounded source or values.

The immutable registry rejects invalid definitions, duplicate ID/version pairs, and unknown filters. Statuses are `draft`, `beta`, `active`, `deprecated`, and `retired`; only active definitions resolve by default.

## Invariants and evidence

`tests/catalogs-products.test.mjs` verifies the catalog counts, strict contracts, complete active matrix, reference integrity, absence of direct circular targets, safe examples, populated lookups, and active-product instructions. `tests/contracts-registry.test.mjs` verifies contract closure, semantic validation, semantic-version behavior, immutability, and atomic duplicate rejection.

`tests/production-integration-matrix.test.mjs` additionally validates all 1,296 appearance-aware preflight combinations, generates 28 product/locale covering XLSX variants, writes seven required tier/locale/appearance packages in an isolated temporary directory, and validates the five-file master sales set. Because that path supplies no native probe, compatibility remains `PARTIAL` and its release manifests remain `DRAFT`.

Production definitions include the exact ten required 2400×1600 PNG specifications used by the listing renderer. Full package generation produces and validates those physical PNGs. Photoshop remains optional and no PSD is generated.
