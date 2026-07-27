# Localization

## Catalog and contract

`src/locales/index.mjs` exports immutable `LocalizationBundle` schema `1.0.0` values. A bundle contains a BCP 47-style locale ID, version, status, optional fallback metadata, messages, and formatting metadata for dates, decimal separators, thousands separators, and paper size.

`requiredMessageKeys` is derived from the sorted `en-US` key set. Production tests require every active locale to contain that exact canonical set.

## Locale status

| Locale | Status | Coverage metadata | Reviewed | Runtime support |
| --- | --- | ---: | --- | --- |
| `nl-NL` | active | 100% | yes | production |
| `en-US` | active | 100% | yes | production |
| `en-GB` | active | 100% | yes | production |
| `de-DE` | active | 100% | yes | production |
| `fr-FR` | beta | 100% | no | preview catalog only |
| `es-ES` | beta | 8% | no | partial preview catalog only |
| `it-IT` | beta | 8% | no | partial preview catalog only |

Current product definitions support only the four active locales. Selecting a beta locale programmatically does not bypass product/configuration validation.

## Resolution behavior

Workbook generation receives one resolved bundle. `createTranslator()` reads that bundle's `messages` and uses the caller-provided fallback text when a key is absent. It does not traverse `fallbackLocale`. The generator interface is deliberately fixed to `nl-NL` and its Light default independently from the selected product language and workbook appearance.

Consequences:

- `fallbackLocale` is descriptive metadata in the current workbook path, not an automatic merge mechanism.
- An active locale must be complete before release.
- A missing workbook message resolves to the definition's fallback text or key, which is visible degradation rather than a translated result.
- Production catalog tests reject missing semantic sample, instruction, dropdown, and customer-visible formula values for every production locale.

All translated spreadsheet text is passed through formula-prefix neutralization before being written to a cell.

## Locale, market, and currency separation

Locale controls translated workbook labels and date-format metadata. Market is a two-letter configuration field used for commercial context. Currency is resolved independently from `src/currencies/index.mjs` and controls workbook number formats. Changing locale does not force a currency change, although each bundle records a recommended market and currency in `extensions`.

The active currency catalog contains `EUR`, `USD`, `GBP`, `CAD`, `AUD`, and `CHF`, each with two decimal digits and explicit standard/accounting workbook formats.

## Adding or changing messages

1. Add the canonical key to `en-US`.
2. Add a reviewed translation to `nl-NL`, `en-GB`, and `de-DE` in the same change.
3. Keep product `nameKey`, `descriptionKey`, sheet `nameKey`, column `labelKey`, instruction keys, validation message keys, theme keys, and commercial keys resolvable.
4. Keep spreadsheet labels concise enough for headers and sheet names; translated sheet names must remain unique and valid under Excel's 31-character rule.
5. Run the catalog tests and generate a workbook for every changed active locale.

```powershell
node --test tests/catalogs-products.test.mjs tests/contracts-registry.test.mjs tests/workbook-engine.test.mjs
```

## Adding a locale

A new production locale requires a complete reviewed bundle, schema validation, formatting metadata, product `supportedLocales` updates, UI selection support, localized commercial content, generated workbook review, and native compatibility evidence. Set status to `beta` until all of those gates pass. Coverage metadata alone is not sufficient.

## Known boundaries

- The generator interface intentionally remains Dutch; product-language selection controls generated workbook, listing, document, and image copy independently.
- Pluralization, grammatical interpolation, locale negotiation, right-to-left layout, and automatic fallback-chain merging are not implemented.
- Date number formats are metadata strings interpreted by the target spreadsheet application; they are not proof of locale-correct rendering in every reader.
- Translation completeness tests prove key coverage, not linguistic quality.
