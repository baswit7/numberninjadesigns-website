export const CURRENCY_SCHEMA_VERSION = '1.0.0';

const profile = (code, name, symbol, symbolPosition, decimalSeparator, groupSeparator, defaultMarket, supportedMarkets, datePattern, weekStartsOn, paperSize, standard, accounting) => Object.freeze({
  schemaVersion: CURRENCY_SCHEMA_VERSION,
  id: code,
  code,
  name,
  symbol,
  symbolPosition,
  symbolSpacing: symbolPosition === 'AFTER',
  decimalDigits: 2,
  decimalSeparator,
  groupSeparator,
  defaultMarket,
  supportedMarkets: Object.freeze(supportedMarkets),
  regionalDefaults: Object.freeze({ datePattern, weekStartsOn, paperSize, amountTermKey: 'currency.amount' }),
  workbookNumberFormats: Object.freeze({ standard, accounting }),
});

export const currencyCatalog = Object.freeze({
  EUR: profile('EUR', 'Euro', '€', 'BEFORE', ',', '.', 'NL', ['AT', 'BE', 'DE', 'ES', 'FI', 'FR', 'IE', 'IT', 'LU', 'NL', 'PT'], 'dd-mm-yyyy', 1, 'A4', '"€"#,##0.00;[Red]-"€"#,##0.00;"€"0.00', '_-"€"* #,##0.00_-;[Red]-"€"* #,##0.00_-;_-"€"* "-"??_-'),
  USD: profile('USD', 'US Dollar', '$', 'BEFORE', '.', ',', 'US', ['EC', 'PA', 'PR', 'US'], 'mm/dd/yyyy', 0, 'Letter', '"$"#,##0.00;[Red]-"$"#,##0.00;"$"0.00', '_-"$"* #,##0.00_-;[Red]-"$"* #,##0.00_-;_-"$"* "-"??_-'),
  GBP: profile('GBP', 'Pound Sterling', '£', 'BEFORE', '.', ',', 'GB', ['GB'], 'dd/mm/yyyy', 1, 'A4', '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00', '_-"£"* #,##0.00_-;[Red]-"£"* #,##0.00_-;_-"£"* "-"??_-'),
  CAD: profile('CAD', 'Canadian Dollar', 'CA$', 'BEFORE', '.', ',', 'CA', ['CA'], 'yyyy-mm-dd', 0, 'Letter', '"CA$"#,##0.00;[Red]-"CA$"#,##0.00;"CA$"0.00', '_-"CA$"* #,##0.00_-;[Red]-"CA$"* #,##0.00_-;_-"CA$"* "-"??_-'),
  AUD: profile('AUD', 'Australian Dollar', 'A$', 'BEFORE', '.', ',', 'AU', ['AU'], 'dd/mm/yyyy', 1, 'A4', '"A$"#,##0.00;[Red]-"A$"#,##0.00;"A$"0.00', '_-"A$"* #,##0.00_-;[Red]-"A$"* #,##0.00_-;_-"A$"* "-"??_-'),
  CHF: profile('CHF', 'Swiss Franc', 'CHF', 'AFTER', '.', "'", 'CH', ['CH', 'LI'], 'dd.mm.yyyy', 1, 'A4', '#,##0.00 "CHF";[Red]-#,##0.00 "CHF";0.00 "CHF"', '_-* #,##0.00 "CHF"_-;[Red]-* #,##0.00 "CHF"_-;_-* "-"?? "CHF"_-'),
});

export const currencyIds = Object.freeze(Object.keys(currencyCatalog));
export const requiredCurrencyMatrix = Object.freeze([
  Object.freeze({ locale: 'nl-NL', currency: 'EUR', market: 'NL' }),
  Object.freeze({ locale: 'nl-NL', currency: 'USD', market: 'NL' }),
  Object.freeze({ locale: 'en-US', currency: 'USD', market: 'US' }),
  Object.freeze({ locale: 'en-US', currency: 'EUR', market: 'US' }),
  Object.freeze({ locale: 'en-GB', currency: 'GBP', market: 'GB' }),
  Object.freeze({ locale: 'de-DE', currency: 'EUR', market: 'DE' }),
]);

export default currencyCatalog;
