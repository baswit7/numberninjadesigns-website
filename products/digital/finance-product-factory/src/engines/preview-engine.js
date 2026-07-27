import { safeSpreadsheetText } from './security.js';
import { resolveConfiguredCategoryRows } from './category-engine.js';

function resolve(translate, key, fallback) {
  const value = typeof translate === 'function' ? translate(key) : null;
  return value && value !== key ? value : fallback;
}

function exampleValue(column, configuration, translate, fallbackLabel = column.id.replaceAll('-', ' ')) {
  const key = `sample.${column.type}`;
  if (column.type === 'currency' || column.type === 'amount' || column.format === 'currency') return 125;
  if (column.type === 'percentage' || column.format === 'percentage') return 0.25;
  if (column.type === 'date') return `${configuration.year}-01-15`;
  if (column.type === 'status') return resolve(translate, 'values.status.active', 'Active');
  if (column.type === 'frequency') return resolve(translate, 'values.frequency.monthly', 'Monthly');
  if (column.type === 'formula' || column.role === 'calculated') return '=…';
  return resolve(translate, key, fallbackLabel);
}

function configuredValue(configuration, path) {
  return String(path).split('.').reduce((current, key) => current?.[key], configuration);
}

function localizedPreviewValue(value, column, configuration, translate) {
  let resolved = value;
  if (resolved && typeof resolved === 'object' && !Array.isArray(resolved) && resolved.messageKey) {
    resolved = resolve(translate, resolved.messageKey, resolved.fallback ?? resolved.messageKey);
  }
  if (resolved && typeof resolved === 'object' && !Array.isArray(resolved) && resolved.configurationPath) {
    resolved = configuredValue(configuration, resolved.configurationPath);
  }
  if (resolved instanceof Date) return Number.isFinite(resolved.getTime()) ? resolved.toISOString().slice(0, 10) : '';
  if (typeof resolved === 'number') return Number.isFinite(resolved) ? resolved : '';
  if (typeof resolved === 'boolean') return resolved;
  if (resolved === null || resolved === undefined) return '';
  return safeSpreadsheetText(resolved);
}

export function buildPreviewModel(definition, configuration, { translate, theme, currencyProfile } = {}) {
  const sheets = [...definition.sheets].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(sheet => {
    const columns = (sheet.columns ?? []).map(column => ({
      id: column.id,
      label: resolve(translate, column.labelKey, column.id.replaceAll('-', ' ')),
      type: column.type,
      role: column.role ?? 'input',
      width: column.width ?? 14,
    }));
    const configuredRows = sheet.id === 'categories'
      ? resolveConfiguredCategoryRows({ productDefinition: definition, configuration, translate })
      : (sheet.sampleRows ?? []);
    const sourceRows = configuration.sampleDataEnabled || sheet.type === 'lookup' ? configuredRows.slice(0, 5) : [];
    const rows = columns.length
      ? (sourceRows.length ? sourceRows : [{}]).map(sourceRow => Object.fromEntries(columns.map(column => {
        const sourceValue = sourceRow[column.id];
        const value = sourceValue === undefined
          ? exampleValue(column, configuration, translate, column.label)
          : localizedPreviewValue(sourceValue, column, configuration, translate);
        return [column.id, localizedPreviewValue(value, column, configuration, translate)];
      })))
      : [];
    return {
      id: sheet.id,
      name: resolve(translate, sheet.nameKey, sheet.id.replaceAll('-', ' ')),
      type: sheet.type,
      hidden: Boolean(sheet.hidden),
      columns,
      rows,
      inputCapacity: ['input', 'data'].includes(String(sheet.type).toLowerCase()) ? configuration.inputCapacity : null,
      frozen: Boolean(sheet.freeze?.rows || sheet.freeze?.columns || ['input', 'data'].includes(String(sheet.type).toLowerCase())),
      filter: Boolean(sheet.autoFilter ?? ['input', 'data'].includes(String(sheet.type).toLowerCase())),
      validationCount: (sheet.validations ?? []).length + (definition.validations ?? []).filter(rule => rule.sheetId === sheet.id).length,
      charts: (sheet.extensions?.charts ?? []).map(chart => ({
        id: chart.id,
        type: chart.type,
        title: resolve(translate, chart.titleKey, chart.id.replaceAll('-', ' ')),
        seriesCount: chart.series?.length ?? 0,
        sourceSheetIds: [...new Set([
          chart.categories?.sheetId,
          ...(chart.series ?? []).map(series => series.values?.sheetId),
        ].filter(Boolean))],
      })),
    };
  });
  return {
    schemaVersion: '1.0.0',
    productId: definition.id,
    productVersion: definition.version,
    title: configuration.title,
    locale: configuration.locale,
    currency: configuration.currency,
    currencyExample: new Intl.NumberFormat(configuration.locale, { style: 'currency', currency: configuration.currency }).format(1234.56),
    themeId: configuration.themeId,
    theme,
    currencyProfile,
    sheets,
    formulaCount: (definition.formulas ?? []).length,
    chartCount: sheets.reduce((total, sheet) => total + sheet.charts.length, 0),
    warnings: [],
    outputFiles: [
      `product/${configuration.filename}`,
      'customer/README.html',
      'customer/QUICK_START.html',
      'customer/LICENSE.txt',
      'listing/title.txt',
      'listing/description.txt',
      'listing/tags.txt',
      'listing/features.txt',
      'listing/faq.txt',
      'listing/alt-texts.txt',
      'listing/images/01-hero.png',
      'listing/images/02-dashboard-overview.png',
      'listing/images/03-monthly-budget.png',
      'listing/images/04-key-features.png',
      'listing/images/05-light-dark-comparison.png',
      'listing/images/06-whats-included.png',
      'listing/images/07-language-currency-options.png',
      'listing/images/08-how-it-works.png',
      'listing/images/09-workbook-previews.png',
      'listing/images/10-digital-download.png',
      'qa/validation-report.json',
      'qa/quality-report.json',
      'qa/compatibility-report.json',
      'qa/release-manifest.json',
      'manifest.json',
    ],
  };
}
