import { careerProductDefinitions } from './career-products.mjs';

const V = '1.0.0';
const ACTIVE_LOCALES = Object.freeze(['nl-NL', 'en-US', 'en-GB', 'de-DE']);
const CURRENCIES = Object.freeze(['EUR', 'USD', 'GBP', 'CAD', 'AUD', 'CHF']);
const THEMES = Object.freeze(['executive-navy', 'modern-minimal', 'warm-neutral', 'sage-finance', 'soft-pastel', 'lavender-balance']);
const CAPACITIES = Object.freeze([50, 100, 250, 500, 1000, 2500, 5000, 10000]);

const freeze = value => Object.freeze(value);
const freezeRows = values => freeze(values.map(value => freeze({ ...value })));
const col = (id, labelKey, type, role, validationId = null, width = 18, format = null) => freeze({ schemaVersion: V, id, labelKey, type, width, role, format, validationId, required: role === 'input', locked: role !== 'input' });
const formula = (id, sheetId, target, operation, parameters, rowBound = false, extensions = {}) => freeze({ schemaVersion: V, id, sheetId, target, operation, parameters: freeze(parameters), fillDirection: rowBound ? 'down' : 'none', inputRowsBound: rowBound, extensions: freeze(extensions) });
const listSource = (id, sheetId, columnId, source, required = true) => freeze({ schemaVersion: V, id, sheetId, columnId, type: 'list', source, required, messageKey: 'errors.required', severity: required ? 'blocker' : 'error' });
const listValues = (id, sheetId, columnId, values, required = true) => freeze({ schemaVersion: V, id, sheetId, columnId, type: 'list', values: freeze(values), required, messageKey: 'errors.required', severity: required ? 'blocker' : 'error' });
const localizedValue = (messageKey, fallback) => freeze({ messageKey, fallback });
const localizedListValues = (id, sheetId, columnId, keys, required = true) => freeze({
  ...listValues(id, sheetId, columnId, keys, required),
  extensions: freeze({ translateValues: true }),
});
const decimalMin = (id, sheetId, columnId, minimum = 0, required = true) => freeze({ schemaVersion: V, id, sheetId, columnId, type: 'decimal', required, operator: 'greaterThanOrEqual', minimum, messageKey: 'errors.required', severity: required ? 'blocker' : 'error' });
const decimalRange = (id, sheetId, columnId, minimum, maximum, required = true) => freeze({ schemaVersion: V, id, sheetId, columnId, type: 'range', required, operator: 'between', minimum, maximum, messageKey: 'errors.required', severity: required ? 'blocker' : 'error' });
const dateRule = (id, sheetId, columnId, source = 'configuration.year', required = true) => freeze({ schemaVersion: V, id, sheetId, columnId, type: 'date', source, required, messageKey: 'errors.required', severity: required ? 'blocker' : 'error' });
const textRule = (id, sheetId, columnId, minimum = 1, maximum = 80, required = true) => freeze({ schemaVersion: V, id, sheetId, columnId, type: 'textLength', required, minimum, maximum, messageKey: 'errors.required', severity: required ? 'blocker' : 'error' });

const PRINT = freeze({ orientation: 'landscape', paperSize: 'A4', fitToWidth: 1, fitToHeight: 0 });
const sheet = (id, nameKey, type, order, columns, formulas = [], validations = [], inputRows = 100, autoFilter = true, sampleRows = [], extensions = {}) => freeze({
  schemaVersion: V, id, nameKey, type, order, hidden: false, columns: freeze(columns), inputRows, freeze: freeze({ rows: type === 'dashboard' ? 0 : 1, columns: 0 }), autoFilter, print: PRINT, formulas: freeze(formulas), validations: freeze(validations), sampleRows: freezeRows(sampleRows), styleRole: type === 'dashboard' ? 'dashboard' : type === 'lookup' ? 'lookup' : 'table', extensions: freeze({ capacityMode: inputRows === 100 && ['input', 'data'].includes(type) ? 'CONFIGURATION_INPUT_CAPACITY' : 'FIXED', ...extensions }),
});

const CONFIG_FIELDS = freeze([
  freeze({ id: 'locale', type: 'enum', labelKey: 'ui.label.locale', configurationPath: 'locale', defaultValue: 'nl-NL', choices: ACTIVE_LOCALES, required: true }),
  freeze({ id: 'market', type: 'string', labelKey: 'ui.label.market', configurationPath: 'market', defaultValue: 'NL', required: true }),
  freeze({ id: 'currency', type: 'enum', labelKey: 'ui.label.currency', configurationPath: 'currency', defaultValue: 'EUR', choices: CURRENCIES, required: true }),
  freeze({ id: 'year', type: 'integer', labelKey: 'ui.label.year', configurationPath: 'year', defaultValue: 2026, minimum: 2020, maximum: 2100, required: true }),
  freeze({ id: 'theme-id', type: 'enum', labelKey: 'ui.label.theme', configurationPath: 'themeId', defaultValue: 'sage-finance', choices: THEMES, required: true }),
  freeze({ id: 'product-appearance', type: 'enum', labelKey: 'ui.label.productAppearance', configurationPath: 'extensions.productAppearance', defaultValue: 'light', choices: freeze(['light', 'dark']), required: true }),
  freeze({ id: 'title', type: 'string', labelKey: 'ui.label.title', configurationPath: 'title', defaultValue: 'Finance Workbook', required: true }),
  freeze({ id: 'filename', type: 'string', labelKey: 'ui.label.filename', configurationPath: 'filename', defaultValue: 'finance-workbook.xlsx', required: true }),
  freeze({ id: 'input-capacity', type: 'enum', labelKey: 'ui.label.inputCapacity', configurationPath: 'inputCapacity', defaultValue: 100, choices: CAPACITIES, required: true }),
  freeze({ id: 'sample-data-enabled', type: 'boolean', labelKey: 'ui.label.sampleData', configurationPath: 'sampleDataEnabled', defaultValue: true, required: true }),
]);

const QUALITY = freeze([
  freeze({ id: 'technical-integrity', metric: 'technical-integrity', weight: 0.25, threshold: 100, severity: 'blocker' }), freeze({ id: 'formula-quality', metric: 'formula-quality', weight: 0.15, threshold: 100, severity: 'blocker' }), freeze({ id: 'usability', metric: 'usability', weight: 0.10, threshold: 90, severity: 'warning' }), freeze({ id: 'visual-quality', metric: 'visual-quality', weight: 0.10, threshold: 90, severity: 'warning' }), freeze({ id: 'localization', metric: 'localization', weight: 0.10, threshold: 100, severity: 'blocker' }), freeze({ id: 'commercial-completeness', metric: 'commercial-completeness', weight: 0.10, threshold: 90, severity: 'error' }), freeze({ id: 'instructions', metric: 'instructions', weight: 0.05, threshold: 90, severity: 'warning' }), freeze({ id: 'compatibility', metric: 'compatibility', weight: 0.05, threshold: 90, severity: 'error' }), freeze({ id: 'accessibility', metric: 'accessibility', weight: 0.05, threshold: 90, severity: 'warning' }), freeze({ id: 'export-completeness', metric: 'export-completeness', weight: 0.05, threshold: 100, severity: 'blocker' }),
]);

const IMAGE_ROLES = freeze([
  freeze({ id: 'hero', purpose: 'thumbnail', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'dashboard-overview', purpose: 'feature', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'monthly-budget', purpose: 'detail', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'key-features', purpose: 'feature', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'light-dark-comparison', purpose: 'comparison', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'whats-included', purpose: 'contents', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'language-currency-options', purpose: 'compatibility', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'how-it-works', purpose: 'instructions', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'workbook-previews', purpose: 'bundle', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'digital-download', purpose: 'trust', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'excel-google-sheets', purpose: 'compatibility', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'paycheck-planning', purpose: 'feature', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'debt-payoff', purpose: 'feature', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'savings-goals', purpose: 'feature', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'net-worth', purpose: 'feature', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'bill-subscriptions', purpose: 'feature', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'privacy-no-account', purpose: 'trust', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'support-promise', purpose: 'trust', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'buyer-fit', purpose: 'other', width: 2400, height: 1600, format: 'png', required: true }),
  freeze({ id: 'value-stack', purpose: 'bundle', width: 2400, height: 1600, format: 'png', required: true }),
]);
const COMPATIBILITY = freeze({ targets: freeze(['excel-desktop']), minimumExcelVersion: '2019', requiresFormulaRecalculation: true, googleSheetsSupported: false, limitations: freeze(['Excel desktop 2019 or later is the verified release target.', 'Excel for web, LibreOffice and Google Sheets are not release-certified; importing may recalculate formulas and simplify workbook styling.']) });
const DUAL_PLATFORM_COMPATIBILITY = freeze({
  targets: freeze(['excel-desktop', 'excel-web', 'google-sheets']),
  minimumExcelVersion: '2019',
  requiresFormulaRecalculation: true,
  googleSheetsSupported: true,
  limitations: freeze([
    'Excel desktop on Windows is native-smoke-tested in the local release gate.',
    'Excel for Mac, Excel for the web and Google Sheets use the cross-platform formula profile; native cloud import remains an explicit release-evidence step.',
  ]),
});
const EXPORT = freeze({ workbookFilenameTemplate: '{productId}_{locale}_{currency}_{year}_{themeId}_{appearance}_{version}.xlsx', packageFilenameTemplate: '{productId}_{locale}_{currency}_{year}_{themeId}_{appearance}_{version}.zip', include: freeze(['workbook', 'readme', 'license', 'manifest', 'listing', 'images', 'reports', 'source-manifests']) });

const defaultFilename = id => ({
  'budget-planner-basic': 'basic-budget-planner-nl-NL-2026-light.xlsx',
  'budget-planner-professional': 'professional-budget-planner-nl-NL-2026-light.xlsx',
  'budget-planner-ultimate': 'ultimate-budget-planner-nl-NL-2026-light.xlsx',
})[id] ?? `${id}.xlsx`;
const configuration = (id, version, title, featureFlags) => freeze({ schemaVersion: V, productId: id, productVersion: version, locale: 'nl-NL', market: 'NL', currency: 'EUR', year: 2026, themeId: 'sage-finance', title, filename: defaultFilename(id), inputCapacity: 100, sampleDataEnabled: true, categoryOverrides: freeze([]), featureFlags: freeze(featureFlags), branding: freeze({ enabled: false }), outputOptions: freeze({ workbook: true, package: true, customerDocs: true, listing: true, imageManifests: true }), extensions: freeze({ productAppearance: 'light', paletteId: 'sage-finance' }) });
const commercial = (nameKey, descriptionKey, category, audience, keywords) => freeze({ schemaVersion: V, titleKey: nameKey, descriptionKey, category, targetAudience: freeze(audience), keywords: freeze(keywords), marketplaces: freeze(['etsy', 'direct']), licenseKey: 'commercial.personalLicense', disclaimerKeys: freeze(['commercial.noFinancialAdvice']), listingAttributes: freeze({ productType: 'digital-download', includesWorkbook: true, draftOnly: true }) });

const define = spec => {
  const formulas = freeze(spec.sheets.flatMap(item => item.formulas));
  const validations = freeze(spec.sheets.flatMap(item => item.validations));
  const images = freeze(IMAGE_ROLES.map(item => freeze({ ...item, altTextKey: spec.nameKey })));
  const categoryProfileId = spec.sheets.some(item => item.id === 'categories') ? `${spec.id}-categories-v1` : null;
  return freeze({ schemaVersion: V, id: spec.id, version: spec.version, status: spec.status, productFamily: spec.productFamily, category: spec.category, nameKey: spec.nameKey, descriptionKey: spec.descriptionKey, saleType: 'spreadsheet', difficulty: spec.difficulty, tags: freeze(spec.tags), recommended: spec.recommended, features: freeze(spec.features), supportedLocales: ACTIVE_LOCALES, supportedCurrencies: CURRENCIES, supportedThemes: THEMES, defaultConfiguration: configuration(spec.id, spec.version, spec.title, spec.featureFlags), configurableFields: CONFIG_FIELDS, sheets: freeze(spec.sheets), formulas, validations, qualityRules: QUALITY, commercialMetadata: commercial(spec.nameKey, spec.descriptionKey, spec.category, spec.audience, spec.tags), imageSpecifications: images, compatibility: spec.compatibility ?? COMPATIBILITY, exportProfile: EXPORT, generatorId: 'declarative-workbook-v1', extensions: freeze({ defaultVisible: spec.status === 'active', approvalRequired: true, beta: spec.status === 'beta', ...(spec.extensions ?? {}), ...(categoryProfileId ? { categoryProfileId } : {}) }) });
};

const dashboardColumns = () => [col('metric', 'columns.description', 'string', 'label', null, 28, 'text'), col('value', 'columns.value', 'formula', 'calculated', null, 18, 'currency')];
const CATEGORY_SAMPLE_ROWS = freezeRows([
  { category: localizedValue('sample.category.salary', 'Salary'), type: localizedValue('values.categoryType.income', 'Income'), budgeted: 3200 },
  { category: localizedValue('sample.category.freelance', 'Freelance'), type: localizedValue('values.categoryType.income', 'Income'), budgeted: 600 },
  { category: localizedValue('sample.category.housing', 'Housing'), type: localizedValue('values.categoryType.expense', 'Expense'), budgeted: 1200 },
  { category: localizedValue('sample.category.utilities', 'Utilities'), type: localizedValue('values.categoryType.expense', 'Expense'), budgeted: 240 },
  { category: localizedValue('sample.category.groceries', 'Groceries'), type: localizedValue('values.categoryType.expense', 'Expense'), budgeted: 500 },
  { category: localizedValue('sample.category.transport', 'Transport'), type: localizedValue('values.categoryType.expense', 'Expense'), budgeted: 250 },
  { category: localizedValue('sample.category.insurance', 'Insurance'), type: localizedValue('values.categoryType.expense', 'Expense'), budgeted: 190 },
  { category: localizedValue('sample.category.healthcare', 'Healthcare'), type: localizedValue('values.categoryType.expense', 'Expense'), budgeted: 120 },
  { category: localizedValue('sample.category.entertainment', 'Entertainment'), type: localizedValue('values.categoryType.expense', 'Expense'), budgeted: 180 },
  { category: localizedValue('sample.category.emergencySavings', 'Emergency savings'), type: localizedValue('values.categoryType.savings', 'Savings'), budgeted: 300 },
  { category: localizedValue('sample.category.longTermSavings', 'Long-term savings'), type: localizedValue('values.categoryType.savings', 'Savings'), budgeted: 250 },
]);
const categoriesSheet = order => {
  const typeValidation = localizedListValues('category-type', 'categories', 'type', ['values.categoryType.income', 'values.categoryType.expense', 'values.categoryType.savings'], true);
  return sheet('categories', 'sheets.categories', 'lookup', order, [col('category', 'columns.category', 'string', 'identifier', null, 24, 'text'), col('type', 'columns.type', 'string', 'input', 'category-type', 16, 'text'), col('budgeted', 'columns.budgeted', 'currency', 'input', null, 16, 'currency')], [], [typeValidation], 40, true, CATEGORY_SAMPLE_ROWS);
};

const budgetDashboardFormulas = [
  formula('total-income', 'dashboard', 'total-income', 'SUM', { range: freeze({ sheetId: 'income', columnId: 'amount' }) }),
  formula('total-expenses', 'dashboard', 'total-expenses', 'SUM', { range: freeze({ sheetId: 'expenses', columnId: 'actual' }) }),
  formula('net-balance', 'dashboard', 'net-balance', 'SUBTRACT', { minuend: freeze({ formulaId: 'total-income' }), subtrahend: freeze({ formulaId: 'total-expenses' }) }),
  formula('savings-rate', 'dashboard', 'savings-rate', 'IFERROR', { numerator: freeze({ formulaId: 'net-balance' }), denominator: freeze({ formulaId: 'total-income' }), fallback: 0 }),
  formula('category-budget', 'dashboard', 'category-budget', 'SUMIF', { sumRange: freeze({ sheetId: 'expenses', columnId: 'budgeted' }), criteriaRange: freeze({ sheetId: 'expenses', columnId: 'category' }), criteriaSource: freeze({ sheetId: 'categories', columnId: 'category' }) }),
  formula('category-actual', 'dashboard', 'category-actual', 'SUMIF', { sumRange: freeze({ sheetId: 'expenses', columnId: 'actual' }), criteriaRange: freeze({ sheetId: 'expenses', columnId: 'category' }), criteriaSource: freeze({ sheetId: 'categories', columnId: 'category' }) }),
  formula('monthly-income', 'dashboard', 'monthly-income', 'SUMIFS', { sumRange: freeze({ sheetId: 'income', columnId: 'amount' }), criteria: freeze([{ columnId: 'date', operator: 'MONTH_EQUALS', runtimeValue: 'SELECTED_MONTH' }]) }),
  formula('monthly-expenses', 'dashboard', 'monthly-expenses', 'SUMIFS', { sumRange: freeze({ sheetId: 'expenses', columnId: 'actual' }), criteria: freeze([{ columnId: 'date', operator: 'MONTH_EQUALS', runtimeValue: 'SELECTED_MONTH' }]) }),
];

const budgetPlannerBasic = define({
  id: 'budget-planner-basic', version: '1.0.0', status: 'active', productFamily: 'personal-budgeting', category: 'budgeting', nameKey: 'products.budgetPlannerBasic.name', descriptionKey: 'products.budgetPlannerBasic.description', title: 'Budget Planner Basic', difficulty: 'beginner', tags: ['budget', 'income', 'expenses', 'personal-finance'], features: ['budget-vs-actual', 'category-analysis', 'monthly-totals', 'annual-totals'], recommended: true, audience: ['personal-budgeters', 'households'], featureFlags: { budgetVsActual: true, categoryAnalysis: true, monthlyTotals: true, annualTotals: true },
  sheets: [
    sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), budgetDashboardFormulas, [], 0, false, [], {
      charts: freeze([
        freeze({
          id: 'basic-budget-actual-chart', type: 'column', titleKey: 'charts.budgetVsActual', legend: 'b',
          anchor: freeze({ from: freeze({ column: 4, row: 4 }), to: freeze({ column: 11, row: 18 }) }),
          categories: freeze({ sheetId: 'category-analysis', columnId: 'category', firstRow: 5, lastRow: 11 }),
          series: freeze([
            freeze({ id: 'budgeted', nameKey: 'columns.budgeted', values: freeze({ sheetId: 'category-analysis', columnId: 'budgeted', firstRow: 5, lastRow: 11 }) }),
            freeze({ id: 'actual', nameKey: 'columns.actual', values: freeze({ sheetId: 'category-analysis', columnId: 'actual', firstRow: 5, lastRow: 11 }) }),
          ]),
        }),
        freeze({
          id: 'basic-category-chart', type: 'doughnut', titleKey: 'charts.expenseCategories', legend: 'b',
          anchor: freeze({ from: freeze({ column: 12, row: 4 }), to: freeze({ column: 19, row: 18 }) }),
          categories: freeze({ sheetId: 'category-analysis', columnId: 'category', firstRow: 5, lastRow: 11 }),
          series: freeze([freeze({ id: 'actual', nameKey: 'columns.actual', values: freeze({ sheetId: 'category-analysis', columnId: 'actual', firstRow: 5, lastRow: 11 }) })]),
        }),
      ]),
    }),
    (() => { const rules = [dateRule('income-date', 'income', 'date'), listSource('income-category', 'income', 'category', 'categories.category#income'), decimalMin('income-amount', 'income', 'amount')]; return sheet('income', 'sheets.income', 'input', 2, [col('date', 'columns.date', 'date', 'input', 'income-date', 14, 'locale-date'), col('description', 'columns.description', 'string', 'input', null, 30, 'text'), col('category', 'columns.category', 'string', 'input', 'income-category', 22, 'text'), col('amount', 'columns.amount', 'currency', 'input', 'income-amount', 16, 'currency')], [], rules); })(),
    (() => { const rules = [dateRule('expense-date', 'expenses', 'date'), listSource('expense-category', 'expenses', 'category', 'categories.category#expense'), decimalMin('expense-budget', 'expenses', 'budgeted', 0, false), decimalMin('expense-actual', 'expenses', 'actual')]; return sheet('expenses', 'sheets.expenses', 'input', 3, [col('date', 'columns.date', 'date', 'input', 'expense-date', 14, 'locale-date'), col('description', 'columns.description', 'string', 'input', null, 30, 'text'), col('category', 'columns.category', 'string', 'input', 'expense-category', 22, 'text'), col('budgeted', 'columns.budgeted', 'currency', 'input', 'expense-budget', 16, 'currency'), col('actual', 'columns.actual', 'currency', 'input', 'expense-actual', 16, 'currency')], [], rules); })(),
    categoriesSheet(4),
  ],
  extensions: { tier: 'basic', moduleIds: freeze(['dashboard', 'income', 'expenses', 'categories', 'category-analysis', 'instructions']), supportedAppearances: freeze(['light', 'dark']), minimumChartCount: 2 },
});

const monthlyBudgetPlanner = define({
  id: 'monthly-budget-planner', version: '1.0.0', status: 'active', productFamily: 'personal-budgeting', category: 'budgeting', nameKey: 'products.monthlyBudgetPlanner.name', descriptionKey: 'products.monthlyBudgetPlanner.description', title: 'Monthly Budget Planner', difficulty: 'beginner', tags: ['monthly-budget', 'carry-over', 'savings'], features: ['fixed-variable-costs', 'carry-over', 'month-status'], recommended: true, audience: ['monthly-budgeters', 'households'], featureFlags: { carryOver: false, monthlyStatus: true },
  sheets: [
    sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [formula('monthly-total-income', 'dashboard', 'total-income', 'SUM', { range: freeze({ sheetId: 'income', columnId: 'amount' }) }), formula('monthly-total-expenses', 'dashboard', 'total-expenses', 'SUM', { range: freeze({ sheetId: 'expenses', columnId: 'amount' }) }), formula('monthly-remaining', 'dashboard', 'remaining-budget', 'SUBTRACT', { minuend: freeze({ formulaId: 'monthly-total-income' }), subtrahend: freeze({ formulaId: 'monthly-total-expenses' }) })], [], 0, false),
    (() => { const rules = [localizedListValues('budget-month', 'monthly-budget', 'month', ['values.month.jan', 'values.month.feb', 'values.month.mar', 'values.month.apr', 'values.month.may', 'values.month.jun', 'values.month.jul', 'values.month.aug', 'values.month.sep', 'values.month.oct', 'values.month.nov', 'values.month.dec']), listSource('budget-category', 'monthly-budget', 'category', 'categories.category'), decimalMin('budget-value', 'monthly-budget', 'budgeted')]; const formulas = [formula('budget-actual', 'monthly-budget', 'actual', 'SUMIFS', { sumRange: freeze({ sheetId: 'expenses', columnId: 'amount' }), criteria: freeze([{ columnId: 'category', rowValue: 'category' }, { columnId: 'date', operator: 'MONTH_EQUALS', rowValue: 'month' }]) }, true), formula('budget-remaining-row', 'monthly-budget', 'remaining', 'SUBTRACT', { minuend: freeze({ columnId: 'budgeted' }), subtrahend: freeze({ columnId: 'actual' }), featureFlag: 'carryOver' }, true), formula('budget-status', 'monthly-budget', 'status', 'IF', { condition: freeze({ left: freeze({ columnId: 'actual' }), operator: 'LESS_THAN_OR_EQUAL', right: freeze({ columnId: 'budgeted' }) }), whenTrue: localizedValue('values.status.onTrack', 'On track'), whenFalse: localizedValue('values.status.overBudget', 'Over budget') }, true)]; return sheet('monthly-budget', 'sheets.monthlyBudget', 'input', 2, [col('month', 'columns.month', 'string', 'input', 'budget-month', 14, 'text'), col('category', 'columns.category', 'string', 'input', 'budget-category', 22, 'text'), col('budgeted', 'columns.budgeted', 'currency', 'input', 'budget-value', 16, 'currency'), col('actual', 'columns.actual', 'formula', 'calculated', null, 16, 'currency'), col('remaining', 'columns.remaining', 'formula', 'calculated', null, 16, 'currency'), col('status', 'columns.status', 'formula', 'calculated', null, 16, 'text')], formulas, rules, 144); })(),
    (() => { const rules = [dateRule('monthly-income-date', 'income', 'date'), listSource('monthly-income-category', 'income', 'category', 'categories.category#income'), decimalMin('monthly-income-amount', 'income', 'amount')]; return sheet('income', 'sheets.income', 'input', 3, [col('date', 'columns.date', 'date', 'input', 'monthly-income-date', 14, 'locale-date'), col('description', 'columns.description', 'string', 'input', null, 28, 'text'), col('category', 'columns.category', 'string', 'input', 'monthly-income-category', 22, 'text'), col('amount', 'columns.amount', 'currency', 'input', 'monthly-income-amount', 16, 'currency')], [], rules); })(),
    (() => { const rules = [dateRule('monthly-expense-date', 'expenses', 'date'), listSource('monthly-expense-category', 'expenses', 'category', 'categories.category#expense'), decimalMin('monthly-expense-amount', 'expenses', 'amount')]; return sheet('expenses', 'sheets.expenses', 'input', 4, [col('date', 'columns.date', 'date', 'input', 'monthly-expense-date', 14, 'locale-date'), col('description', 'columns.description', 'string', 'input', null, 28, 'text'), col('category', 'columns.category', 'string', 'input', 'monthly-expense-category', 22, 'text'), col('amount', 'columns.amount', 'currency', 'input', 'monthly-expense-amount', 16, 'currency')], [], rules); })(),
    categoriesSheet(5),
  ],
});

const debtSnowballPlanner = define({
  id: 'debt-snowball-planner', version: '1.0.0', status: 'active', productFamily: 'debt-repayment', category: 'debt-management', nameKey: 'products.debtSnowballPlanner.name', descriptionKey: 'products.debtSnowballPlanner.description', title: 'Debt Snowball Planner', difficulty: 'intermediate', tags: ['debt', 'snowball', 'payoff'], features: ['snowball-priority', 'payoff-projection', 'interest-tracking'], recommended: true, audience: ['debt-payoff-users', 'households'], featureFlags: { smallestBalancePriority: true, payoffProjection: true },
  sheets: [
    sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [formula('debt-total', 'dashboard', 'total-debt', 'SUM', { range: freeze({ sheetId: 'debts', columnId: 'balance' }) }), formula('payment-total', 'dashboard', 'minimum-payment-total', 'SUM', { range: freeze({ sheetId: 'debts', columnId: 'payment' }) }), formula('debt-progress', 'dashboard', 'payoff-progress', 'IFERROR', { numerator: freeze({ aggregateId: 'paid-principal' }), denominator: freeze({ aggregateId: 'opening-balance' }), fallback: 0 })], [], 0, false),
    (() => { const rules = [textRule('debt-name', 'debts', 'name'), decimalMin('debt-balance', 'debts', 'balance', 0.01), decimalRange('debt-rate', 'debts', 'rate', 0, 1), decimalMin('debt-payment', 'debts', 'payment', 0.01)]; const formulas = [formula('snowball-priority', 'debts', 'priority', 'RANK_ASCENDING', { valueColumnId: 'balance', ignoreZero: true }, true), formula('snowball-projected-date', 'debts', 'projected-date', 'PROJECTED_PAYOFF_DATE', { balanceColumnId: 'balance', rateColumnId: 'rate', paymentColumnId: 'payment' }, true)]; return sheet('debts', 'sheets.debts', 'input', 2, [col('name', 'columns.name', 'string', 'input', 'debt-name', 26, 'text'), col('balance', 'columns.balance', 'currency', 'input', 'debt-balance', 16, 'currency'), col('rate', 'columns.rate', 'percentage', 'input', 'debt-rate', 13, 'percentage'), col('payment', 'columns.payment', 'currency', 'input', 'debt-payment', 16, 'currency'), col('priority', 'columns.priority', 'formula', 'calculated', null, 12, 'integer'), col('projected-date', 'columns.projectedDate', 'formula', 'calculated', null, 18, 'locale-date')], formulas, rules); })(),
    sheet('payment-plan', 'sheets.paymentPlan', 'report', 3, [col('date', 'columns.date', 'date', 'calculated', null, 14, 'locale-date'), col('name', 'columns.name', 'string', 'display', null, 24, 'text'), col('payment', 'columns.payment', 'currency', 'calculated', null, 16, 'currency'), col('remaining', 'columns.remaining', 'currency', 'calculated', null, 17, 'currency')], [formula('plan-payment', 'payment-plan', 'payment', 'MIN', { values: freeze([{ sourceSheetId: 'debts', columnId: 'payment' }, { columnId: 'remaining', rowOffset: -1 }]) }, true), formula('plan-remaining', 'payment-plan', 'remaining', 'MAX', { values: freeze([{ constant: 0 }, { operation: 'SUBTRACT', operands: freeze([{ columnId: 'remaining', rowOffset: -1 }, { columnId: 'payment' }]) }]) }, true)], [], 1200),
    sheet('instructions', 'sheets.instructions', 'report', 4, [col('description', 'columns.description', 'string', 'display', null, 80, 'text')], [], [], 8, false),
  ],
});

const savingsGoalTracker = define({
  id: 'savings-goal-tracker', version: '1.0.0', status: 'active', productFamily: 'savings', category: 'savings', nameKey: 'products.savingsGoalTracker.name', descriptionKey: 'products.savingsGoalTracker.description', title: 'Savings Goal Tracker', difficulty: 'beginner', tags: ['savings', 'goals', 'contributions'], features: ['multiple-goals', 'contribution-log', 'projected-completion'], recommended: true, audience: ['savers', 'households'], featureFlags: { multipleGoals: true, projectedCompletion: true },
  sheets: [
    sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [formula('goal-target-total', 'dashboard', 'target-total', 'SUM', { range: freeze({ sheetId: 'goals', columnId: 'target' }) }), formula('goal-saved-total', 'dashboard', 'saved-total', 'SUM', { range: freeze({ sheetId: 'goals', columnId: 'progress-value' }) }), formula('goal-progress-total', 'dashboard', 'overall-progress', 'IFERROR', { numerator: freeze({ formulaId: 'goal-saved-total' }), denominator: freeze({ formulaId: 'goal-target-total' }), fallback: 0 })], [], 0, false),
    (() => { const rules = [textRule('goal-name', 'goals', 'name'), listSource('goal-category', 'goals', 'category', 'categories.category'), decimalMin('goal-target', 'goals', 'target', 0.01), dateRule('goal-date', 'goals', 'date', 'today-or-later')]; const formulas = [formula('goal-contributions', 'goals', 'progress-value', 'SUMIF', { sumRange: freeze({ sheetId: 'contributions', columnId: 'amount' }), criteriaRange: freeze({ sheetId: 'contributions', columnId: 'name' }), criteriaColumnId: 'name' }, true), formula('goal-remaining', 'goals', 'remaining', 'MAX', { values: freeze([{ constant: 0 }, { operation: 'SUBTRACT', operands: freeze([{ columnId: 'target' }, { columnId: 'progress-value' }]) }]) }, true), formula('goal-progress', 'goals', 'progress', 'IFERROR', { numerator: freeze({ columnId: 'progress-value' }), denominator: freeze({ columnId: 'target' }), fallback: 0 }, true), formula('goal-projected-date', 'goals', 'projected-date', 'PROJECTED_GOAL_DATE', { remainingColumnId: 'remaining', contributionsSheetId: 'contributions' }, true)]; return sheet('goals', 'sheets.goals', 'input', 2, [col('name', 'columns.name', 'string', 'input', 'goal-name', 26, 'text'), col('category', 'columns.category', 'string', 'input', 'goal-category', 20, 'text'), col('target', 'columns.target', 'currency', 'input', 'goal-target', 16, 'currency'), col('date', 'columns.dueDate', 'date', 'input', 'goal-date', 16, 'locale-date'), col('progress-value', 'columns.value', 'formula', 'calculated', null, 16, 'currency'), col('remaining', 'columns.remaining', 'formula', 'calculated', null, 16, 'currency'), col('progress', 'columns.progress', 'formula', 'calculated', null, 14, 'percentage'), col('projected-date', 'columns.projectedDate', 'formula', 'calculated', null, 18, 'locale-date')], formulas, rules); })(),
    (() => { const rules = [dateRule('contribution-date', 'contributions', 'date'), listSource('contribution-goal', 'contributions', 'name', 'goals.name'), decimalMin('contribution-amount', 'contributions', 'amount', 0.01)]; return sheet('contributions', 'sheets.contributions', 'input', 3, [col('date', 'columns.date', 'date', 'input', 'contribution-date', 14, 'locale-date'), col('name', 'columns.name', 'string', 'input', 'contribution-goal', 26, 'text'), col('amount', 'columns.amount', 'currency', 'input', 'contribution-amount', 16, 'currency'), col('note', 'columns.note', 'string', 'input', null, 32, 'text')], [], rules); })(),
    categoriesSheet(4),
  ],
});

const subscriptionTracker = define({
  id: 'subscription-tracker', version: '1.0.0', status: 'active', productFamily: 'recurring-expenses', category: 'expense-management', nameKey: 'products.subscriptionTracker.name', descriptionKey: 'products.subscriptionTracker.description', title: 'Subscription Tracker', difficulty: 'beginner', tags: ['subscriptions', 'recurring-costs', 'savings'], features: ['renewal-dates', 'annual-cost', 'savings-analysis'], recommended: true, audience: ['subscription-users', 'households'], featureFlags: { renewalAlerts: true, savingsAnalysis: true },
  sheets: [
    sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [formula('subscription-count', 'dashboard', 'active-count', 'COUNTIF', { range: freeze({ sheetId: 'subscriptions', columnId: 'status' }), criteria: localizedValue('values.status.active', 'Active') }, false, { numberFormat: 'integer' }), formula('subscription-annual-total', 'dashboard', 'annual-total', 'SUMIFS', { sumRange: freeze({ sheetId: 'subscriptions', columnId: 'annual-cost' }), criteria: freeze([{ columnId: 'status', value: localizedValue('values.status.active', 'Active') }]) }), formula('subscription-savings-total', 'dashboard', 'potential-savings', 'SUM', { range: freeze({ sheetId: 'subscriptions', columnId: 'potential-savings' }) })], [], 0, false),
    (() => { const rules = [textRule('subscription-name', 'subscriptions', 'name'), listSource('subscription-category', 'subscriptions', 'category', 'categories.category'), decimalMin('subscription-amount', 'subscriptions', 'amount'), localizedListValues('subscription-frequency', 'subscriptions', 'frequency', ['values.frequency.weekly', 'values.frequency.monthly', 'values.frequency.quarterly', 'values.frequency.semiAnnual', 'values.frequency.annual']), localizedListValues('subscription-status', 'subscriptions', 'status', ['values.status.active', 'values.status.paused', 'values.status.cancelCandidate', 'values.status.cancelled']), dateRule('subscription-date', 'subscriptions', 'date')]; const formulas = [formula('subscription-annual-cost', 'subscriptions', 'annual-cost', 'FREQUENCY_TO_ANNUAL', { amountColumnId: 'amount', frequencyColumnId: 'frequency' }, true), formula('subscription-potential-savings', 'subscriptions', 'potential-savings', 'IF', { condition: freeze({ left: freeze({ columnId: 'status' }), operator: 'EQUAL', right: localizedValue('values.status.cancelCandidate', 'Review for cancellation') }), whenTrue: freeze({ columnId: 'annual-cost' }), whenFalse: 0 }, true)]; return sheet('subscriptions', 'sheets.subscriptions', 'input', 2, [col('name', 'columns.name', 'string', 'input', 'subscription-name', 24, 'text'), col('provider', 'columns.provider', 'string', 'input', null, 22, 'text'), col('category', 'columns.category', 'string', 'input', 'subscription-category', 20, 'text'), col('amount', 'columns.amount', 'currency', 'input', 'subscription-amount', 16, 'currency'), col('frequency', 'columns.frequency', 'string', 'input', 'subscription-frequency', 15, 'text'), col('annual-cost', 'columns.cost', 'formula', 'calculated', null, 16, 'currency'), col('date', 'columns.dueDate', 'date', 'input', 'subscription-date', 16, 'locale-date'), col('status', 'columns.status', 'string', 'input', 'subscription-status', 16, 'text'), col('potential-savings', 'columns.remaining', 'formula', 'calculated', null, 18, 'currency')], formulas, rules); })(),
    categoriesSheet(3),
  ],
});

const simpleTransactionSheet = (id, nameKey, order, prefix) => {
  const rules = [dateRule(`${prefix}-date`, id, 'date'), listSource(`${prefix}-category`, id, 'category', 'categories.category'), decimalMin(`${prefix}-amount`, id, 'amount')];
  return sheet(id, nameKey, 'input', order, [col('date', 'columns.date', 'date', 'input', `${prefix}-date`, 14, 'locale-date'), col('description', 'columns.description', 'string', 'input', null, 28, 'text'), col('category', 'columns.category', 'string', 'input', `${prefix}-category`, 22, 'text'), col('amount', 'columns.amount', 'currency', 'input', `${prefix}-amount`, 16, 'currency')], [], rules);
};

const betaSpecs = [
  {
    id: 'annual-budget-planner', family: 'personal-budgeting', category: 'budgeting', nameKey: 'products.annualBudgetPlanner.name', descriptionKey: 'products.annualBudgetPlanner.description', title: 'Annual Budget Planner', tags: ['annual-budget', 'planning'], features: ['twelve-month-plan', 'category-targets'], flags: { annualProjection: true }, audience: ['annual-planners'],
    sheets: () => [sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [formula('annual-income-total', 'dashboard', 'total-income', 'SUMIFS', { sumRange: freeze({ sheetId: 'transactions', columnId: 'amount' }), criteria: freeze([{ columnId: 'type', value: 'INCOME' }]) }), formula('annual-expense-total', 'dashboard', 'total-expenses', 'SUMIFS', { sumRange: freeze({ sheetId: 'transactions', columnId: 'amount' }), criteria: freeze([{ columnId: 'type', value: 'EXPENSE' }]) }), formula('annual-net', 'dashboard', 'net-balance', 'SUBTRACT', { minuend: freeze({ formulaId: 'annual-income-total' }), subtrahend: freeze({ formulaId: 'annual-expense-total' }) })], [], 0, false), sheet('annual-budget', 'sheets.annualBudget', 'input', 2, [col('month', 'columns.month', 'string', 'input', 'annual-month'), col('category', 'columns.category', 'string', 'input', 'annual-category'), col('budgeted', 'columns.budgeted', 'currency', 'input', 'annual-budget')], [], [listValues('annual-month', 'annual-budget', 'month', ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']), listSource('annual-category', 'annual-budget', 'category', 'categories.category'), decimalMin('annual-budget', 'annual-budget', 'budgeted')], 192), (() => { const rules = [dateRule('annual-transaction-date', 'transactions', 'date'), listSource('annual-transaction-category', 'transactions', 'category', 'categories.category'), listValues('annual-transaction-type', 'transactions', 'type', ['INCOME', 'EXPENSE']), decimalMin('annual-transaction-amount', 'transactions', 'amount')]; return sheet('transactions', 'sheets.transactions', 'input', 3, [col('date', 'columns.date', 'date', 'input', 'annual-transaction-date', 14, 'locale-date'), col('description', 'columns.description', 'string', 'input', null, 28, 'text'), col('category', 'columns.category', 'string', 'input', 'annual-transaction-category', 22, 'text'), col('type', 'columns.type', 'string', 'input', 'annual-transaction-type', 14, 'text'), col('amount', 'columns.amount', 'currency', 'input', 'annual-transaction-amount', 16, 'currency')], [], rules); })(), categoriesSheet(4)],
  },
  {
    id: 'debt-avalanche-planner', family: 'debt-repayment', category: 'debt-management', nameKey: 'products.debtAvalanchePlanner.name', descriptionKey: 'products.debtAvalanchePlanner.description', title: 'Debt Avalanche Planner', tags: ['debt', 'avalanche', 'interest'], features: ['interest-priority', 'payoff-projection'], flags: { highestInterestPriority: true }, audience: ['debt-payoff-users'],
    sheets: () => [sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [formula('avalanche-total', 'dashboard', 'total-debt', 'SUM', { range: freeze({ sheetId: 'debts', columnId: 'balance' }) })], [], 0, false), (() => { const rules = [textRule('avalanche-name', 'debts', 'name'), decimalMin('avalanche-balance', 'debts', 'balance', 0.01), decimalRange('avalanche-rate', 'debts', 'rate', 0, 1), decimalMin('avalanche-payment', 'debts', 'payment', 0.01)]; return sheet('debts', 'sheets.debts', 'input', 2, [col('name', 'columns.name', 'string', 'input', 'avalanche-name'), col('balance', 'columns.balance', 'currency', 'input', 'avalanche-balance'), col('rate', 'columns.rate', 'percentage', 'input', 'avalanche-rate'), col('payment', 'columns.payment', 'currency', 'input', 'avalanche-payment'), col('priority', 'columns.priority', 'formula', 'calculated')], [formula('avalanche-priority', 'debts', 'priority', 'RANK_DESCENDING', { valueColumnId: 'rate' }, true)], rules); })(), sheet('payment-plan', 'sheets.paymentPlan', 'report', 3, [col('date', 'columns.date', 'date', 'calculated'), col('payment', 'columns.payment', 'currency', 'calculated'), col('remaining', 'columns.remaining', 'currency', 'calculated')], [], [], 1200), sheet('instructions', 'sheets.instructions', 'report', 4, [col('description', 'columns.description', 'string', 'display', null, 80)], [], [], 8, false)],
  },
  {
    id: 'sinking-funds-planner', family: 'savings', category: 'savings', nameKey: 'products.sinkingFundsPlanner.name', descriptionKey: 'products.sinkingFundsPlanner.description', title: 'Sinking Funds Planner', tags: ['sinking-funds', 'savings'], features: ['irregular-expenses', 'target-dates'], flags: { contributionProjection: true }, audience: ['savers'],
    sheets: () => [sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [formula('fund-target-total', 'dashboard', 'target-total', 'SUM', { range: freeze({ sheetId: 'funds', columnId: 'target' }) })], [], 0, false), (() => { const rules = [textRule('fund-name', 'funds', 'name'), listSource('fund-category', 'funds', 'category', 'categories.category'), decimalMin('fund-target', 'funds', 'target', 0.01), dateRule('fund-date', 'funds', 'date', 'today-or-later')]; return sheet('funds', 'sheets.funds', 'input', 2, [col('name', 'columns.name', 'string', 'input', 'fund-name'), col('category', 'columns.category', 'string', 'input', 'fund-category'), col('target', 'columns.target', 'currency', 'input', 'fund-target'), col('date', 'columns.dueDate', 'date', 'input', 'fund-date'), col('remaining', 'columns.remaining', 'formula', 'calculated')], [formula('fund-remaining', 'funds', 'remaining', 'MAX', { values: freeze([{ constant: 0 }, { operation: 'SUBTRACT', operands: freeze([{ columnId: 'target' }, { aggregateId: 'contributions' }]) }]) }, true)], rules); })(), simpleTransactionSheet('contributions', 'sheets.contributions', 3, 'fund-contribution'), categoriesSheet(4)],
  },
  {
    id: 'bill-payment-calendar', family: 'bill-management', category: 'bill-management', nameKey: 'products.billPaymentCalendar.name', descriptionKey: 'products.billPaymentCalendar.description', title: 'Bill Payment Calendar', tags: ['bills', 'calendar', 'payments'], features: ['due-dates', 'payment-status', 'calendar-view'], flags: { calendarView: true }, audience: ['bill-payers'],
    sheets: () => [sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [formula('bill-total', 'dashboard', 'bill-total', 'SUM', { range: freeze({ sheetId: 'bills', columnId: 'amount' }) }), formula('bill-unpaid', 'dashboard', 'unpaid-total', 'SUMIFS', { sumRange: freeze({ sheetId: 'bills', columnId: 'amount' }), criteria: freeze([{ columnId: 'status', value: 'UNPAID' }]) })], [], 0, false), (() => { const rules = [textRule('bill-name', 'bills', 'name'), decimalMin('bill-amount', 'bills', 'amount'), listValues('bill-frequency', 'bills', 'frequency', ['ONCE', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL']), dateRule('bill-date', 'bills', 'date'), listValues('bill-status', 'bills', 'status', ['UNPAID', 'PAID', 'SCHEDULED', 'OVERDUE'])]; return sheet('bills', 'sheets.bills', 'input', 2, [col('name', 'columns.name', 'string', 'input', 'bill-name'), col('amount', 'columns.amount', 'currency', 'input', 'bill-amount'), col('frequency', 'columns.frequency', 'string', 'input', 'bill-frequency'), col('date', 'columns.dueDate', 'date', 'input', 'bill-date'), col('status', 'columns.status', 'string', 'input', 'bill-status')], [], rules); })(), sheet('calendar', 'sheets.calendar', 'report', 3, [col('date', 'columns.date', 'date', 'calculated'), col('name', 'columns.name', 'string', 'display'), col('amount', 'columns.amount', 'currency', 'calculated'), col('status', 'columns.status', 'formula', 'calculated')], [formula('calendar-status', 'calendar', 'status', 'IF', { condition: freeze({ operation: 'AND', operands: freeze([{ sourceSheetId: 'bills', columnId: 'date', operator: 'LESS_THAN', runtimeValue: 'TODAY' }, { sourceSheetId: 'bills', columnId: 'status', operator: 'EQUAL', value: 'UNPAID' }]) }), whenTrue: 'OVERDUE', whenFalse: 'SCHEDULED' }, true)], [], 366), categoriesSheet(4)],
  },
  {
    id: 'net-worth-tracker', family: 'net-worth', category: 'wealth-tracking', nameKey: 'products.netWorthTracker.name', descriptionKey: 'products.netWorthTracker.description', title: 'Net Worth Tracker', tags: ['net-worth', 'assets', 'liabilities'], features: ['asset-tracking', 'liability-tracking', 'history'], flags: { history: true }, audience: ['net-worth-trackers'],
    sheets: () => [sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [formula('asset-total', 'dashboard', 'asset-total', 'SUM', { range: freeze({ sheetId: 'assets', columnId: 'amount' }) }), formula('liability-total', 'dashboard', 'liability-total', 'SUM', { range: freeze({ sheetId: 'liabilities', columnId: 'amount' }) }), formula('net-worth', 'dashboard', 'net-worth', 'SUBTRACT', { minuend: freeze({ formulaId: 'asset-total' }), subtrahend: freeze({ formulaId: 'liability-total' }) })], [], 0, false), simpleTransactionSheet('assets', 'sheets.assets', 2, 'asset'), simpleTransactionSheet('liabilities', 'sheets.liabilities', 3, 'liability'), sheet('history', 'sheets.history', 'report', 4, [col('date', 'columns.date', 'date', 'calculated'), col('value', 'columns.value', 'currency', 'calculated')], [formula('history-value', 'history', 'value', 'SUBTRACT', { minuend: freeze({ aggregateId: 'assets' }), subtrahend: freeze({ aggregateId: 'liabilities' }) }, true)], [], 120), categoriesSheet(5)],
  },
  {
    id: 'side-hustle-profit-tracker', family: 'micro-business', category: 'micro-business', nameKey: 'products.sideHustleProfitTracker.name', descriptionKey: 'products.sideHustleProfitTracker.description', title: 'Side Hustle Profit Tracker', tags: ['side-hustle', 'profit', 'tax'], features: ['revenue-cost-profit', 'tax-estimate'], flags: { taxEstimate: true }, audience: ['side-hustle-operators'],
    sheets: () => [sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [formula('hustle-income', 'dashboard', 'income-total', 'SUM', { range: freeze({ sheetId: 'income', columnId: 'amount' }) }), formula('hustle-expenses', 'dashboard', 'expense-total', 'SUM', { range: freeze({ sheetId: 'expenses', columnId: 'amount' }) }), formula('hustle-profit', 'dashboard', 'profit', 'SUBTRACT', { minuend: freeze({ formulaId: 'hustle-income' }), subtrahend: freeze({ formulaId: 'hustle-expenses' }) })], [], 0, false), simpleTransactionSheet('income', 'sheets.income', 2, 'hustle-income'), simpleTransactionSheet('expenses', 'sheets.expenses', 3, 'hustle-expense'), sheet('tax-estimate', 'sheets.taxEstimate', 'summary', 4, [col('rate', 'columns.rate', 'percentage', 'input', 'tax-rate'), col('value', 'columns.value', 'formula', 'calculated')], [formula('tax-estimate', 'tax-estimate', 'value', 'ROUND', { value: freeze({ operation: 'MULTIPLY', operands: freeze([{ formulaId: 'hustle-profit' }, { columnId: 'rate' }]) }), decimals: 2 }, true)], [decimalRange('tax-rate', 'tax-estimate', 'rate', 0, 1)], 12), categoriesSheet(5)],
  },
  {
    id: 'small-business-income-expense-tracker', family: 'small-business', category: 'small-business', nameKey: 'products.smallBusinessIncomeExpense.name', descriptionKey: 'products.smallBusinessIncomeExpense.description', title: 'Small Business Income and Expense Tracker', tags: ['small-business', 'income', 'expenses', 'tax'], features: ['income-expense', 'business-use', 'tax-summary'], flags: { taxSummary: true, businessUse: true }, audience: ['small-business-owners'],
    sheets: () => [sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [formula('business-income', 'dashboard', 'income-total', 'SUM', { range: freeze({ sheetId: 'income', columnId: 'amount' }) }), formula('business-expenses', 'dashboard', 'expense-total', 'SUM', { range: freeze({ sheetId: 'expenses', columnId: 'amount' }) }), formula('business-profit', 'dashboard', 'profit', 'SUBTRACT', { minuend: freeze({ formulaId: 'business-income' }), subtrahend: freeze({ formulaId: 'business-expenses' }) })], [], 0, false), simpleTransactionSheet('income', 'sheets.income', 2, 'business-income'), simpleTransactionSheet('expenses', 'sheets.expenses', 3, 'business-expense'), categoriesSheet(4), sheet('tax-summary', 'sheets.taxSummary', 'summary', 5, [col('category', 'columns.category', 'string', 'display'), col('amount', 'columns.amount', 'formula', 'calculated')], [formula('tax-category-total', 'tax-summary', 'amount', 'SUMIF', { sumRange: freeze({ sheetId: 'expenses', columnId: 'amount' }), criteriaRange: freeze({ sheetId: 'expenses', columnId: 'category' }), criteriaColumnId: 'category' }, true)], [], 40)],
  },
];

const ACTIVE_SAMPLE_ROWS = freeze({
  'budget-planner-basic': freeze({
    income: freezeRows([
      { date: '2026-01-25', description: localizedValue('sample.description.monthlySalary', 'Monthly salary'), category: localizedValue('sample.category.salary', 'Salary'), amount: 3200 },
      { date: '2026-02-10', description: localizedValue('sample.description.freelance', 'Freelance project'), category: localizedValue('sample.category.freelance', 'Freelance'), amount: 600 },
      { date: '2026-03-25', description: localizedValue('sample.description.monthlySalary', 'Monthly salary'), category: localizedValue('sample.category.salary', 'Salary'), amount: 3200 },
    ]),
    expenses: freezeRows([
      { date: '2026-01-02', description: localizedValue('sample.description.housingPayment', 'Housing payment'), category: localizedValue('sample.category.housing', 'Housing'), budgeted: 1200, actual: 1200 },
      { date: '2026-01-08', description: localizedValue('sample.description.energyWater', 'Energy and water'), category: localizedValue('sample.category.utilities', 'Utilities'), budgeted: 240, actual: 218.4 },
      { date: '2026-01-14', description: localizedValue('sample.description.householdGroceries', 'Household groceries'), category: localizedValue('sample.category.groceries', 'Groceries'), budgeted: 500, actual: 478.35 },
      { date: '2026-01-18', description: localizedValue('sample.description.publicTransport', 'Public transport'), category: localizedValue('sample.category.transport', 'Transport'), budgeted: 250, actual: 224.5 },
      { date: '2026-01-21', description: localizedValue('sample.description.homeInsurance', 'Home insurance'), category: localizedValue('sample.category.insurance', 'Insurance'), budgeted: 190, actual: 190 },
    ]),
  }),
  'monthly-budget-planner': freeze({
    'monthly-budget': freezeRows([
      { month: localizedValue('values.month.jan', 'Jan'), category: localizedValue('sample.category.housing', 'Housing'), budgeted: 1200 },
      { month: localizedValue('values.month.jan', 'Jan'), category: localizedValue('sample.category.utilities', 'Utilities'), budgeted: 240 },
      { month: localizedValue('values.month.jan', 'Jan'), category: localizedValue('sample.category.groceries', 'Groceries'), budgeted: 500 },
      { month: localizedValue('values.month.jan', 'Jan'), category: localizedValue('sample.category.transport', 'Transport'), budgeted: 250 },
      { month: localizedValue('values.month.jan', 'Jan'), category: localizedValue('sample.category.emergencySavings', 'Emergency savings'), budgeted: 300 },
    ]),
    income: freezeRows([
      { date: '2026-01-25', description: localizedValue('sample.description.monthlySalary', 'Monthly salary'), category: localizedValue('sample.category.salary', 'Salary'), amount: 3200 },
      { date: '2026-01-31', description: localizedValue('sample.description.freelance', 'Freelance project'), category: localizedValue('sample.category.freelance', 'Freelance'), amount: 450 },
      { date: '2026-02-25', description: localizedValue('sample.description.monthlySalary', 'Monthly salary'), category: localizedValue('sample.category.salary', 'Salary'), amount: 3200 },
    ]),
    expenses: freezeRows([
      { date: '2026-01-02', description: localizedValue('sample.description.housingPayment', 'Housing payment'), category: localizedValue('sample.category.housing', 'Housing'), amount: 1200 },
      { date: '2026-01-08', description: localizedValue('sample.description.energyWater', 'Energy and water'), category: localizedValue('sample.category.utilities', 'Utilities'), amount: 218.4 },
      { date: '2026-01-14', description: localizedValue('sample.description.householdGroceries', 'Household groceries'), category: localizedValue('sample.category.groceries', 'Groceries'), amount: 478.35 },
      { date: '2026-01-18', description: localizedValue('sample.description.publicTransport', 'Public transport'), category: localizedValue('sample.category.transport', 'Transport'), amount: 224.5 },
      { date: '2026-01-28', description: localizedValue('sample.description.savingsTransfer', 'Emergency-fund transfer'), category: localizedValue('sample.category.emergencySavings', 'Emergency savings'), amount: 300 },
    ]),
  }),
  'debt-snowball-planner': freeze({
    debts: freezeRows([
      { name: localizedValue('sample.debt.creditCardA', 'Credit card A'), type: localizedValue('values.debtType.creditCard', 'Credit card'), balance: 850, rate: 0.189, payment: 75 },
      { name: localizedValue('sample.debt.medicalPlan', 'Medical plan'), type: localizedValue('values.debtType.medicalDebt', 'Medical debt'), balance: 1450, rate: 0, payment: 90 },
      { name: localizedValue('sample.debt.personalLoan', 'Personal loan'), type: localizedValue('values.debtType.personalLoan', 'Personal loan'), balance: 4200, rate: 0.079, payment: 160 },
      { name: localizedValue('sample.debt.autoLoan', 'Vehicle loan'), type: localizedValue('values.debtType.autoLoan', 'Auto loan'), balance: 7800, rate: 0.054, payment: 245 },
    ]),
    'payment-plan': freezeRows([
      { date: '2026-08-01', name: localizedValue('sample.debt.creditCardA', 'Credit card A') },
      { date: '2026-09-01', name: localizedValue('sample.debt.creditCardA', 'Credit card A') },
      { date: '2026-10-01', name: localizedValue('sample.debt.medicalPlan', 'Medical plan') },
    ]),
  }),
  'savings-goal-tracker': freeze({
    goals: freezeRows([
      { name: localizedValue('sample.goal.emergencyFund', 'Emergency fund'), category: localizedValue('sample.category.emergencySavings', 'Emergency savings'), target: 6000, date: '2027-06-30' },
      { name: localizedValue('sample.goal.homeMaintenance', 'Home maintenance'), category: localizedValue('sample.category.housing', 'Housing'), target: 2400, date: '2027-03-31' },
      { name: localizedValue('sample.goal.longTermReserve', 'Long-term reserve'), category: localizedValue('sample.category.longTermSavings', 'Long-term savings'), target: 12000, date: '2028-12-31' },
    ]),
    contributions: freezeRows([
      { date: '2026-08-01', name: localizedValue('sample.goal.emergencyFund', 'Emergency fund'), amount: 300, note: localizedValue('sample.note.monthlyTransfer', 'Monthly transfer') },
      { date: '2026-08-15', name: localizedValue('sample.goal.homeMaintenance', 'Home maintenance'), amount: 150, note: localizedValue('sample.note.plannedReserve', 'Planned reserve') },
      { date: '2026-09-01', name: localizedValue('sample.goal.emergencyFund', 'Emergency fund'), amount: 300, note: localizedValue('sample.note.monthlyTransfer', 'Monthly transfer') },
      { date: '2026-09-15', name: localizedValue('sample.goal.longTermReserve', 'Long-term reserve'), amount: 250, note: localizedValue('sample.note.monthlyTransfer', 'Monthly transfer') },
      { date: '2026-10-01', name: localizedValue('sample.goal.emergencyFund', 'Emergency fund'), amount: 300, note: localizedValue('sample.note.monthlyTransfer', 'Monthly transfer') },
    ]),
  }),
  'subscription-tracker': freeze({
    subscriptions: freezeRows([
      { name: localizedValue('sample.subscription.videoStreaming', 'Video streaming'), provider: localizedValue('sample.provider.media', 'Example Media'), category: localizedValue('sample.category.entertainment', 'Entertainment'), amount: 12.99, frequency: localizedValue('values.frequency.monthly', 'Monthly'), date: '2026-08-12', status: localizedValue('values.status.active', 'Active') },
      { name: localizedValue('sample.subscription.cloudStorage', 'Cloud storage'), provider: localizedValue('sample.provider.cloud', 'Example Cloud'), category: localizedValue('sample.category.utilities', 'Utilities'), amount: 2.99, frequency: localizedValue('values.frequency.monthly', 'Monthly'), date: '2026-08-18', status: localizedValue('values.status.active', 'Active') },
      { name: localizedValue('sample.subscription.fitnessApp', 'Fitness app'), provider: localizedValue('sample.provider.fitness', 'Example Fitness'), category: localizedValue('sample.category.healthcare', 'Healthcare'), amount: 59.99, frequency: localizedValue('values.frequency.annual', 'Annual'), date: '2026-11-02', status: localizedValue('values.status.cancelCandidate', 'Review for cancellation') },
      { name: localizedValue('sample.subscription.musicService', 'Music service'), provider: localizedValue('sample.provider.audio', 'Example Audio'), category: localizedValue('sample.category.entertainment', 'Entertainment'), amount: 10.99, frequency: localizedValue('values.frequency.monthly', 'Monthly'), date: '2026-08-24', status: localizedValue('values.status.active', 'Active') },
      { name: localizedValue('sample.subscription.deviceCover', 'Device cover'), provider: localizedValue('sample.provider.cover', 'Example Cover'), category: localizedValue('sample.category.insurance', 'Insurance'), amount: 8.5, frequency: localizedValue('values.frequency.monthly', 'Monthly'), date: '2026-08-28', status: localizedValue('values.status.paused', 'Paused') },
    ]),
  }),
});

const WORKFLOW_GUIDANCE = freeze({
  'budget-planner-basic': localizedValue('instructions.workflow.budgetBasic', 'Record every income and expense, including planned and actual amounts.'),
  'monthly-budget-planner': localizedValue('instructions.workflow.monthlyBudget', 'Set monthly category budgets first, then record income and expenses.'),
  'debt-snowball-planner': localizedValue('instructions.workflow.debtSnowball', 'Enter every balance, annual interest rate and realistic minimum payment.'),
  'savings-goal-tracker': localizedValue('instructions.workflow.savingsGoals', 'Define each target and due date, then log every contribution.'),
  'subscription-tracker': localizedValue('instructions.workflow.subscriptions', 'Record billing frequency, renewal date and review status for every subscription.'),
});

const instructionRows = definition => [
  { step: 1, name: localizedValue('instructions.configure.title', 'Configure'), description: localizedValue('instructions.configure.body', 'Choose the year, product language, currency, appearance and palette before entering data.') },
  { step: 2, name: localizedValue('instructions.replaceExamples.title', 'Replace examples'), description: localizedValue('instructions.replaceExamples.body', 'Sample rows are illustrative and contain no personal data. Replace them with your own records.') },
  { step: 3, name: localizedValue('instructions.enterData.title', 'Enter data'), description: WORKFLOW_GUIDANCE[definition.id] },
  { step: 4, name: localizedValue('instructions.review.title', 'Review'), description: localizedValue('instructions.review.body', 'Review variances, alerts, goals and trends before making decisions.') },
  { step: 5, name: localizedValue('instructions.backup.title', 'Validate and back up'), description: localizedValue('instructions.backup.body', 'Resolve validation messages and keep a separate clean backup of the workbook.') },
];

const instructionsSheet = (order, definition) => sheet(
  'instructions',
  'sheets.instructions',
  'report',
  order,
  [col('step', 'columns.step', 'integer', 'display', null, 10, 'integer'), col('name', 'columns.name', 'string', 'display', null, 24, 'text'), col('description', 'columns.description', 'string', 'display', null, 80, 'text')],
  [],
  [],
  5,
  false,
  instructionRows(definition),
);

const categoryAnalysisSheet = order => sheet(
  'category-analysis',
  'sheets.categoryAnalysis',
  'report',
  order,
  [col('category', 'columns.category', 'string', 'display', null, 24, 'text'), col('budgeted', 'columns.budgeted', 'formula', 'calculated', null, 16, 'currency'), col('actual', 'columns.actual', 'formula', 'calculated', null, 16, 'currency'), col('variance', 'columns.variance', 'formula', 'calculated', null, 16, 'currency')],
  [
    formula('analysis-budgeted', 'category-analysis', 'budgeted', 'SUMIF', { sumRange: freeze({ sheetId: 'expenses', columnId: 'budgeted' }), criteriaRange: freeze({ sheetId: 'expenses', columnId: 'category' }), criteriaColumnId: 'category' }, true),
    formula('analysis-actual', 'category-analysis', 'actual', 'SUMIF', { sumRange: freeze({ sheetId: 'expenses', columnId: 'actual' }), criteriaRange: freeze({ sheetId: 'expenses', columnId: 'category' }), criteriaColumnId: 'category' }, true),
    formula('analysis-variance', 'category-analysis', 'variance', 'SUBTRACT', { minuend: freeze({ columnId: 'budgeted' }), subtrahend: freeze({ columnId: 'actual' }) }, true),
  ],
  [],
  9,
  true,
  CATEGORY_SAMPLE_ROWS.filter(item => item.type.messageKey !== 'values.categoryType.income').map(item => ({ category: item.category })),
);

const debtTypesSheet = order => sheet(
  'debt-types',
  'sheets.debtTypes',
  'lookup',
  order,
  [col('type', 'columns.type', 'string', 'identifier', null, 24, 'text')],
  [],
  [],
  8,
  true,
  [
    { type: localizedValue('values.debtType.creditCard', 'Credit card') },
    { type: localizedValue('values.debtType.medicalDebt', 'Medical debt') },
    { type: localizedValue('values.debtType.personalLoan', 'Personal loan') },
    { type: localizedValue('values.debtType.autoLoan', 'Auto loan') },
    { type: localizedValue('values.debtType.studentLoan', 'Student loan') },
  ],
);

const MONTH_KEYS = freeze(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']);
const monthRows = () => MONTH_KEYS.map(key => ({ month: localizedValue(`values.month.${key}`, key.toUpperCase()) }));
const categoryRows = () => [
  { category: localizedValue('sample.category.salary', 'Salary'), type: localizedValue('values.categoryType.income', 'Income'), budgeted: 4200 },
  { category: localizedValue('sample.category.freelance', 'Freelance'), type: localizedValue('values.categoryType.income', 'Income'), budgeted: 650 },
  { category: localizedValue('sample.category.housing', 'Housing'), type: localizedValue('values.categoryType.expense', 'Expense'), budgeted: 1450 },
  { category: localizedValue('sample.category.utilities', 'Utilities'), type: localizedValue('values.categoryType.expense', 'Expense'), budgeted: 275 },
  { category: localizedValue('sample.category.groceries', 'Groceries'), type: localizedValue('values.categoryType.expense', 'Expense'), budgeted: 560 },
  { category: localizedValue('sample.category.transport', 'Transport'), type: localizedValue('values.categoryType.expense', 'Expense'), budgeted: 310 },
  { category: localizedValue('sample.category.insurance', 'Insurance'), type: localizedValue('values.categoryType.expense', 'Expense'), budgeted: 190 },
  { category: localizedValue('sample.category.personal', 'Personal'), type: localizedValue('values.categoryType.expense', 'Expense'), budgeted: 180 },
  { category: localizedValue('sample.category.savings', 'Savings'), type: localizedValue('values.categoryType.savings', 'Savings'), budgeted: 650 },
];

const premiumCategoriesSheet = order => sheet(
  'categories', 'sheets.categories', 'lookup', order,
  [col('category', 'columns.category', 'string', 'identifier', null, 26, 'text'), col('type', 'columns.type', 'string', 'input', 'premium-category-type', 18, 'text'), col('budgeted', 'columns.budgeted', 'currency', 'input', null, 16, 'currency')],
  [],
  [localizedListValues('premium-category-type', 'categories', 'type', ['values.categoryType.income', 'values.categoryType.expense', 'values.categoryType.savings'])],
  40, true, categoryRows(),
);

const premiumInstructionsSheet = order => sheet(
  'instructions', 'sheets.instructions', 'report', order,
  [col('step', 'columns.step', 'integer', 'display', null, 10, 'integer'), col('name', 'columns.name', 'string', 'display', null, 26, 'text'), col('description', 'columns.description', 'string', 'display', null, 80, 'text')],
  [], [], 5, false,
  [
    { step: 1, name: localizedValue('instructions.configure.title', 'Configure'), description: localizedValue('instructions.configure.body', 'Choose the year, locale, currency, appearance and palette before entering data.') },
    { step: 2, name: localizedValue('instructions.categories.title', 'Categories'), description: localizedValue('instructions.categories.body', 'Review the category list and adapt it before entering transactions.') },
    { step: 3, name: localizedValue('instructions.enterData.title', 'Enter data'), description: localizedValue('instructions.enterData.body', 'Use highlighted input cells only; calculated cells and dashboards update automatically.') },
    { step: 4, name: localizedValue('instructions.review.title', 'Review'), description: localizedValue('instructions.review.body', 'Review variances, alerts, goals and trends before making decisions.') },
    { step: 5, name: localizedValue('instructions.backup.title', 'Validate and back up'), description: localizedValue('instructions.backup.body', 'Resolve validation messages and keep a separate clean backup of the workbook.') },
  ],
  { premiumLayout: true },
);

const chart = (id, type, titleKey, anchor, categories, series, legend = 'b') => freeze({
  id, type, titleKey, legend,
  anchor: freeze({ from: freeze(anchor.from), to: freeze(anchor.to) }),
  categories: freeze(categories),
  series: freeze(series.map(item => freeze(item))),
});

const premiumIncomeSheet = (order, sheetId = 'income', nameKey = 'sheets.income') => sheet(
  sheetId, nameKey, 'input', order,
  [col('date', 'columns.date', 'date', 'input', `${sheetId}-date`, 14, 'locale-date'), col('description', 'columns.description', 'string', 'input', null, 30, 'text'), col('category', 'columns.category', 'string', 'input', `${sheetId}-category`, 22, 'text'), col('amount', 'columns.amount', 'currency', 'input', `${sheetId}-amount`, 16, 'currency')],
  [],
  [dateRule(`${sheetId}-date`, sheetId, 'date'), listSource(`${sheetId}-category`, sheetId, 'category', 'categories.category#income'), decimalMin(`${sheetId}-amount`, sheetId, 'amount')],
  100, true,
  [
    { date: '2026-01-25', description: localizedValue('sample.description.salary', 'Salary'), category: localizedValue('sample.category.salary', 'Salary'), amount: 4200 },
    { date: '2026-02-10', description: localizedValue('sample.description.freelance', 'Freelance project'), category: localizedValue('sample.category.salary', 'Salary'), amount: 650 },
    { date: '2026-03-25', description: localizedValue('sample.description.salary', 'Salary'), category: localizedValue('sample.category.salary', 'Salary'), amount: 4200 },
  ],
);

const premiumExpenseSheet = (id, nameKey, order, samplePrefix) => {
  const rules = [dateRule(`${id}-date`, id, 'date'), listSource(`${id}-category`, id, 'category', 'categories.category#expense'), decimalMin(`${id}-budgeted`, id, 'budgeted', 0, false), decimalMin(`${id}-actual`, id, 'actual', 0, false)];
  const formulas = [formula(`${id}-status`, id, 'status', 'IF', { condition: freeze({ left: freeze({ columnId: 'actual' }), operator: 'LESS_THAN_OR_EQUAL', right: freeze({ columnId: 'budgeted' }) }), whenTrue: freeze({ messageKey: 'values.status.onTrack', fallback: 'On track' }), whenFalse: freeze({ messageKey: 'values.status.overBudget', fallback: 'Over budget' }) }, true)];
  return sheet(id, nameKey, 'input', order, [col('date', 'columns.date', 'date', 'input', `${id}-date`, 14, 'locale-date'), col('description', 'columns.description', 'string', 'input', null, 30, 'text'), col('category', 'columns.category', 'string', 'input', `${id}-category`, 22, 'text'), col('budgeted', 'columns.budgeted', 'currency', 'input', `${id}-budgeted`, 16, 'currency'), col('actual', 'columns.actual', 'currency', 'input', `${id}-actual`, 16, 'currency'), col('status', 'columns.status', 'formula', 'calculated', null, 17, 'text')], formulas, rules, 100, true, [
    { date: '2026-01-02', description: localizedValue(`sample.description.${samplePrefix}1`, samplePrefix === 'fixed' ? 'Housing payment' : 'Groceries'), category: localizedValue(samplePrefix === 'fixed' ? 'sample.category.housing' : 'sample.category.groceries', samplePrefix === 'fixed' ? 'Housing' : 'Groceries'), budgeted: samplePrefix === 'fixed' ? 1450 : 560, actual: samplePrefix === 'fixed' ? 1450 : 525 },
    { date: '2026-02-05', description: localizedValue(`sample.description.${samplePrefix}2`, samplePrefix === 'fixed' ? 'Utilities' : 'Transport'), category: localizedValue(samplePrefix === 'fixed' ? 'sample.category.utilities' : 'sample.category.transport', samplePrefix === 'fixed' ? 'Utilities' : 'Transport'), budgeted: samplePrefix === 'fixed' ? 275 : 310, actual: samplePrefix === 'fixed' ? 268 : 342 },
    { date: '2026-03-12', description: localizedValue(`sample.description.${samplePrefix}3`, samplePrefix === 'fixed' ? 'Insurance' : 'Personal spending'), category: localizedValue(samplePrefix === 'fixed' ? 'sample.category.utilities' : 'sample.category.groceries', samplePrefix === 'fixed' ? 'Utilities' : 'Groceries'), budgeted: samplePrefix === 'fixed' ? 190 : 180, actual: samplePrefix === 'fixed' ? 190 : 164 },
  ]);
};

const premiumBillsSheet = order => sheet(
  'bills', 'sheets.bills', 'input', order,
  [col('name', 'columns.name', 'string', 'input', 'premium-bill-name', 26, 'text'), col('amount', 'columns.amount', 'currency', 'input', 'premium-bill-amount', 16, 'currency'), col('date', 'columns.dueDate', 'date', 'input', 'premium-bill-date', 16, 'locale-date'), col('payment-method', 'columns.paymentMethod', 'string', 'input', 'premium-bill-method', 20, 'text'), col('status', 'columns.status', 'string', 'input', 'premium-bill-status', 18, 'text')],
  [],
  [textRule('premium-bill-name', 'bills', 'name'), decimalMin('premium-bill-amount', 'bills', 'amount'), dateRule('premium-bill-date', 'bills', 'date'), localizedListValues('premium-bill-method', 'bills', 'payment-method', ['values.paymentMethod.directDebit', 'values.paymentMethod.bankTransfer', 'values.paymentMethod.card']), localizedListValues('premium-bill-status', 'bills', 'status', ['values.status.scheduled', 'values.status.paid', 'values.status.overdue'])],
  100, true,
  [
    { name: localizedValue('sample.bill.housing', 'Housing'), amount: 1450, date: '2026-01-02', 'payment-method': localizedValue('values.paymentMethod.directDebit', 'Direct debit'), status: localizedValue('values.status.scheduled', 'Scheduled') },
    { name: localizedValue('sample.bill.utilities', 'Utilities'), amount: 268, date: '2026-01-05', 'payment-method': localizedValue('values.paymentMethod.directDebit', 'Direct debit'), status: localizedValue('values.status.paid', 'Paid') },
    { name: localizedValue('sample.bill.insurance', 'Insurance'), amount: 190, date: '2026-01-12', 'payment-method': localizedValue('values.paymentMethod.bankTransfer', 'Bank transfer'), status: localizedValue('values.status.scheduled', 'Scheduled') },
  ],
);

const premiumGoalsSheet = order => sheet(
  'goals', 'sheets.goals', 'input', order,
  [col('name', 'columns.name', 'string', 'input', 'premium-goal-name', 26, 'text'), col('target', 'columns.target', 'currency', 'input', 'premium-goal-target', 16, 'currency'), col('current', 'columns.value', 'currency', 'input', 'premium-goal-current', 16, 'currency'), col('date', 'columns.dueDate', 'date', 'input', 'premium-goal-date', 16, 'locale-date'), col('remaining', 'columns.remaining', 'formula', 'calculated', null, 16, 'currency'), col('progress', 'columns.progress', 'formula', 'calculated', null, 14, 'percentage'), col('status', 'columns.status', 'formula', 'calculated', null, 18, 'text')],
  [
    formula('premium-goal-remaining', 'goals', 'remaining', 'ROW_DIFFERENCE', { leftColumnId: 'target', rightColumnId: 'current' }, true),
    formula('premium-goal-progress', 'goals', 'progress', 'ROW_RATIO', { numeratorColumnId: 'current', denominatorColumnId: 'target' }, true),
    formula('premium-goal-status', 'goals', 'status', 'IF', { condition: freeze({ left: freeze({ columnId: 'current' }), operator: 'GREATER_THAN_OR_EQUAL', right: freeze({ columnId: 'target' }) }), whenTrue: freeze({ messageKey: 'values.status.complete', fallback: 'Complete' }), whenFalse: freeze({ messageKey: 'values.status.inProgress', fallback: 'In progress' }) }, true),
  ],
  [textRule('premium-goal-name', 'goals', 'name'), decimalMin('premium-goal-target', 'goals', 'target', 0.01), decimalMin('premium-goal-current', 'goals', 'current', 0, false), dateRule('premium-goal-date', 'goals', 'date', 'today-or-later')],
  100, true,
  [
    { name: localizedValue('sample.goal.emergencyFund', 'Emergency fund'), target: 10000, current: 4250, date: '2026-12-31' },
    { name: localizedValue('sample.goal.travel', 'Travel'), target: 3500, current: 1900, date: '2026-09-30' },
    { name: localizedValue('sample.goal.home', 'Home improvement'), target: 6000, current: 2250, date: '2027-03-31' },
  ],
);

const professionalAnnualOverview = order => sheet(
  'annual-overview', 'sheets.annualOverview', 'report', order,
  [col('month', 'columns.month', 'string', 'display', null, 14, 'text'), col('income', 'columns.income', 'formula', 'calculated', null, 16, 'currency'), col('fixed', 'columns.fixedExpenses', 'formula', 'calculated', null, 16, 'currency'), col('variable', 'columns.variableExpenses', 'formula', 'calculated', null, 16, 'currency'), col('expenses', 'columns.expenses', 'formula', 'calculated', null, 16, 'currency'), col('cashflow', 'columns.cashflow', 'formula', 'calculated', null, 16, 'currency'), col('savings-rate', 'columns.savingsRate', 'formula', 'calculated', null, 14, 'percentage')],
  [
    formula('professional-month-income', 'annual-overview', 'income', 'SUMIFS', { sumRange: freeze({ sheetId: 'income', columnId: 'amount' }), criteria: freeze([{ columnId: 'date', operator: 'MONTH_EQUALS', rowValue: 'month' }]) }, true),
    formula('professional-month-fixed', 'annual-overview', 'fixed', 'SUMIFS', { sumRange: freeze({ sheetId: 'fixed-expenses', columnId: 'actual' }), criteria: freeze([{ columnId: 'date', operator: 'MONTH_EQUALS', rowValue: 'month' }]) }, true),
    formula('professional-month-variable', 'annual-overview', 'variable', 'SUMIFS', { sumRange: freeze({ sheetId: 'variable-expenses', columnId: 'actual' }), criteria: freeze([{ columnId: 'date', operator: 'MONTH_EQUALS', rowValue: 'month' }]) }, true),
    formula('professional-month-expenses', 'annual-overview', 'expenses', 'ROW_SUM', { columns: freeze(['fixed', 'variable']) }, true),
    formula('professional-month-cashflow', 'annual-overview', 'cashflow', 'ROW_DIFFERENCE', { leftColumnId: 'income', rightColumnId: 'expenses' }, true),
    formula('professional-month-savings-rate', 'annual-overview', 'savings-rate', 'ROW_RATIO', { numeratorColumnId: 'cashflow', denominatorColumnId: 'income' }, true),
  ], [], 12, true, monthRows(), { premiumLayout: true },
);

const professionalCategoryAnalysis = order => sheet(
  'category-analysis', 'sheets.categoryAnalysis', 'report', order,
  [col('category', 'columns.category', 'string', 'display', null, 24, 'text'), col('fixed-budget', 'columns.fixedBudget', 'formula', 'calculated', null, 16, 'currency'), col('variable-budget', 'columns.variableBudget', 'formula', 'calculated', null, 16, 'currency'), col('budgeted', 'columns.budgeted', 'formula', 'calculated', null, 16, 'currency'), col('fixed-actual', 'columns.fixedActual', 'formula', 'calculated', null, 16, 'currency'), col('variable-actual', 'columns.variableActual', 'formula', 'calculated', null, 16, 'currency'), col('actual', 'columns.actual', 'formula', 'calculated', null, 16, 'currency'), col('variance', 'columns.variance', 'formula', 'calculated', null, 16, 'currency'), col('percentage', 'columns.categoryPercentage', 'formula', 'calculated', null, 16, 'percentage')],
  [
    formula('professional-category-fixed-budget', 'category-analysis', 'fixed-budget', 'SUMIF', { sumRange: freeze({ sheetId: 'fixed-expenses', columnId: 'budgeted' }), criteriaRange: freeze({ sheetId: 'fixed-expenses', columnId: 'category' }), criteriaColumnId: 'category' }, true),
    formula('professional-category-variable-budget', 'category-analysis', 'variable-budget', 'SUMIF', { sumRange: freeze({ sheetId: 'variable-expenses', columnId: 'budgeted' }), criteriaRange: freeze({ sheetId: 'variable-expenses', columnId: 'category' }), criteriaColumnId: 'category' }, true),
    formula('professional-category-budget', 'category-analysis', 'budgeted', 'ROW_SUM', { columns: freeze(['fixed-budget', 'variable-budget']) }, true),
    formula('professional-category-fixed-actual', 'category-analysis', 'fixed-actual', 'SUMIF', { sumRange: freeze({ sheetId: 'fixed-expenses', columnId: 'actual' }), criteriaRange: freeze({ sheetId: 'fixed-expenses', columnId: 'category' }), criteriaColumnId: 'category' }, true),
    formula('professional-category-variable-actual', 'category-analysis', 'variable-actual', 'SUMIF', { sumRange: freeze({ sheetId: 'variable-expenses', columnId: 'actual' }), criteriaRange: freeze({ sheetId: 'variable-expenses', columnId: 'category' }), criteriaColumnId: 'category' }, true),
    formula('professional-category-actual', 'category-analysis', 'actual', 'ROW_SUM', { columns: freeze(['fixed-actual', 'variable-actual']) }, true),
    formula('professional-category-variance', 'category-analysis', 'variance', 'ROW_DIFFERENCE', { leftColumnId: 'budgeted', rightColumnId: 'actual' }, true),
    formula('professional-category-percentage', 'category-analysis', 'percentage', 'IFERROR', { numerator: freeze({ columnId: 'actual' }), denominator: freeze({ formulaId: 'professional-total-expenses' }), fallback: 0 }, true, { numberFormat: 'percentage' }),
  ], [], categoryRows().length, true, categoryRows().map(row => ({ category: row.category })), { premiumLayout: true },
);

const professionalCashflow = order => sheet(
  'cashflow', 'sheets.cashflow', 'report', order,
  [col('month', 'columns.month', 'string', 'display', null, 14, 'text'), col('income', 'columns.income', 'formula', 'calculated', null, 16, 'currency'), col('expenses', 'columns.expenses', 'formula', 'calculated', null, 16, 'currency'), col('cashflow', 'columns.cashflow', 'formula', 'calculated', null, 16, 'currency')],
  [
    formula('professional-cashflow-income', 'cashflow', 'income', 'COPY', { source: freeze({ sheetId: 'annual-overview', columnId: 'income', row: 'current' }) }, true),
    formula('professional-cashflow-expenses', 'cashflow', 'expenses', 'COPY', { source: freeze({ sheetId: 'annual-overview', columnId: 'expenses', row: 'current' }) }, true),
    formula('professional-cashflow-net', 'cashflow', 'cashflow', 'COPY', { source: freeze({ sheetId: 'annual-overview', columnId: 'cashflow', row: 'current' }) }, true),
  ], [], 12, true, monthRows(), { premiumLayout: true },
);

const professionalCharts = freeze([
  chart('professional-cashflow-chart', 'line', 'charts.monthlyCashflow', { from: { column: 4, row: 4 }, to: { column: 11, row: 18 } }, { sheetId: 'annual-overview', columnId: 'month', firstRow: 5, lastRow: 16 }, [
    { id: 'income', nameKey: 'metrics.total-income', values: freeze({ sheetId: 'annual-overview', columnId: 'income', firstRow: 5, lastRow: 16 }) },
    { id: 'expenses', nameKey: 'metrics.total-expenses', values: freeze({ sheetId: 'annual-overview', columnId: 'expenses', firstRow: 5, lastRow: 16 }) },
    { id: 'cashflow', nameKey: 'metrics.cashflow', values: freeze({ sheetId: 'annual-overview', columnId: 'cashflow', firstRow: 5, lastRow: 16 }) },
  ]),
  chart('professional-budget-actual-chart', 'column', 'charts.budgetVsActual', { from: { column: 12, row: 4 }, to: { column: 19, row: 18 } }, { sheetId: 'category-analysis', columnId: 'category', firstRow: 5, lastRow: 13 }, [
    { id: 'budgeted', nameKey: 'columns.budgeted', values: freeze({ sheetId: 'category-analysis', columnId: 'budgeted', firstRow: 5, lastRow: 13 }) },
    { id: 'actual', nameKey: 'columns.actual', values: freeze({ sheetId: 'category-analysis', columnId: 'actual', firstRow: 5, lastRow: 13 }) },
  ]),
  chart('professional-category-chart', 'doughnut', 'charts.expenseCategories', { from: { column: 4, row: 20 }, to: { column: 11, row: 34 } }, { sheetId: 'category-analysis', columnId: 'category', firstRow: 5, lastRow: 13 }, [
    { id: 'actual', nameKey: 'columns.actual', values: freeze({ sheetId: 'category-analysis', columnId: 'actual', firstRow: 5, lastRow: 13 }) },
  ]),
  chart('professional-goals-chart', 'bar', 'charts.savingsGoals', { from: { column: 12, row: 20 }, to: { column: 19, row: 34 } }, { sheetId: 'goals', columnId: 'name', firstRow: 5, lastRow: 14 }, [
    { id: 'target', nameKey: 'columns.target', values: freeze({ sheetId: 'goals', columnId: 'target', firstRow: 5, lastRow: 14 }) },
    { id: 'current', nameKey: 'columns.value', values: freeze({ sheetId: 'goals', columnId: 'current', firstRow: 5, lastRow: 14 }) },
  ]),
]);

const budgetPlannerProfessional = define({
  id: 'budget-planner-professional', version: '1.0.0', status: 'active', productFamily: 'personal-budgeting', category: 'budgeting', nameKey: 'products.budgetPlannerProfessional.name', descriptionKey: 'products.budgetPlannerProfessional.description', title: 'Budget Planner Professional', difficulty: 'intermediate', tags: ['budget', 'annual-overview', 'cashflow', 'bills', 'savings-goals'], features: ['professional-dashboard', 'annual-overview', 'dynamic-month-model', 'fixed-variable-expenses', 'bill-tracker', 'savings-goals', 'category-analysis', 'budget-vs-actual', 'cashflow', 'charts', 'instructions'], recommended: true, audience: ['personal-budgeters', 'households'], featureFlags: { annualOverview: true, dynamicMonthModel: true, fixedVariableExpenses: true, billTracker: true, savingsGoals: true, charts: true },
  sheets: [
    sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [
      formula('professional-total-income', 'dashboard', 'total-income', 'SUM', { range: freeze({ sheetId: 'income', columnId: 'amount' }) }),
      formula('professional-total-expenses', 'dashboard', 'total-expenses', 'SUM', { ranges: freeze([{ sheetId: 'fixed-expenses', columnId: 'actual' }, { sheetId: 'variable-expenses', columnId: 'actual' }]) }),
      formula('professional-net-cashflow', 'dashboard', 'cashflow', 'SUBTRACT', { minuend: freeze({ formulaId: 'professional-total-income' }), subtrahend: freeze({ formulaId: 'professional-total-expenses' }) }),
      formula('professional-savings-rate', 'dashboard', 'savings-rate', 'IFERROR', { numerator: freeze({ formulaId: 'professional-net-cashflow' }), denominator: freeze({ formulaId: 'professional-total-income' }), fallback: 0 }, false, { numberFormat: 'percentage' }),
      formula('professional-goal-target', 'dashboard', 'goal-target', 'SUM', { range: freeze({ sheetId: 'goals', columnId: 'target' }) }),
      formula('professional-goal-current', 'dashboard', 'goal-current', 'SUM', { range: freeze({ sheetId: 'goals', columnId: 'current' }) }),
      formula('professional-bills-total', 'dashboard', 'bills-total', 'SUM', { range: freeze({ sheetId: 'bills', columnId: 'amount' }) }),
    ], [], 0, false, [], { charts: professionalCharts, premiumLayout: true }),
    professionalAnnualOverview(2),
    premiumIncomeSheet(3),
    premiumExpenseSheet('fixed-expenses', 'sheets.fixedExpenses', 4, 'fixed'),
    premiumExpenseSheet('variable-expenses', 'sheets.variableExpenses', 5, 'variable'),
    premiumBillsSheet(6),
    premiumGoalsSheet(7),
    professionalCashflow(8),
    professionalCategoryAnalysis(9),
    premiumCategoriesSheet(10),
    premiumInstructionsSheet(11),
  ],
  extensions: { tier: 'professional', moduleIds: freeze(['dashboard', 'annual-overview', 'dynamic-month-model', 'income', 'fixed-expenses', 'variable-expenses', 'bills', 'savings-goals', 'cashflow', 'category-analysis', 'instructions']), supportedAppearances: freeze(['light', 'dark']), minimumChartCount: 4 },
});

const configuredValue = configurationPath => freeze({ configurationPath });

const ultimateStartSheet = order => sheet(
  'start-here', 'sheets.startHere', 'report', order,
  [col('section', 'columns.section', 'string', 'display', null, 28, 'text'), col('description', 'columns.description', 'string', 'display', null, 80, 'text')],
  [], [], 7, false,
  [
    { section: localizedValue('startHere.welcome.title', 'Welcome'), description: localizedValue('startHere.welcome.body', 'This Finance OS connects planning, transactions, goals, debt and net worth in one workbook.') },
    { section: localizedValue('startHere.configure.title', 'Configure'), description: localizedValue('startHere.configure.body', 'Review product language, market, currency, year, appearance and palette on the Configuration sheet.') },
    { section: localizedValue('startHere.categories.title', 'Set categories'), description: localizedValue('startHere.categories.body', 'Adapt the category list before entering transactions so every analysis remains consistent.') },
    { section: localizedValue('startHere.transactions.title', 'Enter transactions'), description: localizedValue('startHere.transactions.body', 'Use the central Transactions sheet for income, expenses and savings transfers.') },
    { section: localizedValue('startHere.plan.title', 'Build the plan'), description: localizedValue('startHere.plan.body', 'Set annual budgets, pay-period allocations, recurring items, bills and funds.') },
    { section: localizedValue('startHere.review.title', 'Review dashboards'), description: localizedValue('startHere.review.body', 'Use the executive, monthly, cashflow and trend views to spot variances early.') },
    { section: localizedValue('startHere.maintain.title', 'Maintain safely'), description: localizedValue('startHere.maintain.body', 'Keep input cells current, resolve warnings and retain a clean backup before major changes.') },
  ],
  { premiumLayout: true, coverSheet: true },
);

const ultimateConfigurationSheet = order => sheet(
  'configuration', 'sheets.configuration', 'report', order,
  [col('setting', 'columns.setting', 'string', 'display', null, 30, 'text'), col('value', 'columns.value', 'string', 'display', null, 32, 'text'), col('description', 'columns.description', 'string', 'display', null, 72, 'text')],
  [], [], 9, false,
  [
    { setting: localizedValue('configuration.product', 'Product'), value: configuredValue('productId'), description: localizedValue('configuration.product.help', 'The selected product tier and definition.') },
    { setting: localizedValue('configuration.productLanguage', 'Product language'), value: configuredValue('locale'), description: localizedValue('configuration.productLanguage.help', 'Controls customer-visible workbook text only.') },
    { setting: localizedValue('configuration.market', 'Market'), value: configuredValue('market'), description: localizedValue('configuration.market.help', 'Controls regional defaults independently from product language.') },
    { setting: localizedValue('configuration.currency', 'Currency'), value: configuredValue('currency'), description: localizedValue('configuration.currency.help', 'Controls monetary number formats.') },
    { setting: localizedValue('configuration.year', 'Year'), value: configuredValue('year'), description: localizedValue('configuration.year.help', 'Controls the active planning year.') },
    { setting: localizedValue('configuration.appearance', 'Workbook appearance'), value: configuredValue('extensions.productAppearance'), description: localizedValue('configuration.appearance.help', 'Light or dark workbook styling, independent from the generator interface.') },
    { setting: localizedValue('configuration.palette', 'Colour palette'), value: configuredValue('themeId'), description: localizedValue('configuration.palette.help', 'The functional workbook colour palette.') },
    { setting: localizedValue('configuration.capacity', 'Input capacity'), value: configuredValue('inputCapacity'), description: localizedValue('configuration.capacity.help', 'Maximum rows on scalable input sheets.') },
    { setting: localizedValue('configuration.sampleData', 'Sample data'), value: configuredValue('sampleDataEnabled'), description: localizedValue('configuration.sampleData.help', 'Indicates whether professional example data was included.') },
  ],
  { premiumLayout: true },
);

const ultimateTransactionSampleRows = () => {
  const rows = [];
  const groceryAmounts = [486, 512, 498, 525, 507, 493, 519, 534, 501, 488, 522, 548];
  const utilityAmounts = [238, 226, 214, 198, 184, 176, 181, 187, 199, 211, 224, 242];
  const transportAmounts = [246, 232, 258, 241, 267, 252, 239, 261, 248, 255, 243, 271];
  for (let month = 1; month <= 12; month += 1) {
    const monthValue = String(month).padStart(2, '0');
    rows.push(
      { date: `2026-${monthValue}-25`, description: localizedValue('sample.description.salary', 'Salary'), type: localizedValue('values.transactionType.income', 'Income'), category: localizedValue('sample.category.salary', 'Salary'), account: localizedValue('values.account.checking', 'Checking'), 'payment-method': localizedValue('values.paymentMethod.bankTransfer', 'Bank transfer'), amount: 4200 },
      { date: `2026-${monthValue}-02`, description: localizedValue('sample.description.fixed1', 'Housing payment'), type: localizedValue('values.transactionType.expense', 'Expense'), category: localizedValue('sample.category.housing', 'Housing'), account: localizedValue('values.account.checking', 'Checking'), 'payment-method': localizedValue('values.paymentMethod.directDebit', 'Direct debit'), amount: 1450 },
      { date: `2026-${monthValue}-08`, description: localizedValue('sample.description.energyWater', 'Energy and water'), type: localizedValue('values.transactionType.expense', 'Expense'), category: localizedValue('sample.category.utilities', 'Utilities'), account: localizedValue('values.account.checking', 'Checking'), 'payment-method': localizedValue('values.paymentMethod.directDebit', 'Direct debit'), amount: utilityAmounts[month - 1] },
      { date: `2026-${monthValue}-14`, description: localizedValue('sample.description.variable1', 'Groceries'), type: localizedValue('values.transactionType.expense', 'Expense'), category: localizedValue('sample.category.groceries', 'Groceries'), account: localizedValue('values.account.creditCard', 'Credit card'), 'payment-method': localizedValue('values.paymentMethod.card', 'Card'), amount: groceryAmounts[month - 1] },
      { date: `2026-${monthValue}-18`, description: localizedValue('sample.description.variable2', 'Transport'), type: localizedValue('values.transactionType.expense', 'Expense'), category: localizedValue('sample.category.transport', 'Transport'), account: localizedValue('values.account.checking', 'Checking'), 'payment-method': localizedValue('values.paymentMethod.card', 'Card'), amount: transportAmounts[month - 1] },
      { date: `2026-${monthValue}-27`, description: localizedValue('sample.description.savingsTransfer', 'Emergency fund transfer'), type: localizedValue('values.transactionType.savings', 'Savings'), category: localizedValue('sample.category.savings', 'Savings'), account: localizedValue('values.account.savings', 'Savings'), 'payment-method': localizedValue('values.paymentMethod.bankTransfer', 'Bank transfer'), amount: 400 },
    );
    if (month % 3 === 0) rows.push({ date: `2026-${monthValue}-10`, description: localizedValue('sample.description.freelance', 'Freelance project'), type: localizedValue('values.transactionType.income', 'Income'), category: localizedValue('sample.category.freelance', 'Freelance'), account: localizedValue('values.account.checking', 'Checking'), 'payment-method': localizedValue('values.paymentMethod.bankTransfer', 'Bank transfer'), amount: 650 });
  }
  return rows;
};

const ultimateTransactionsSheet = order => sheet(
  'transactions', 'sheets.transactions', 'input', order,
  [
    col('date', 'columns.date', 'date', 'input', 'ultimate-transaction-date', 14, 'locale-date'),
    col('description', 'columns.description', 'string', 'input', 'ultimate-transaction-description', 30, 'text'),
    col('type', 'columns.transactionType', 'string', 'input', 'ultimate-transaction-type', 18, 'text'),
    col('category', 'columns.category', 'string', 'input', 'ultimate-transaction-category', 22, 'text'),
    col('account', 'columns.account', 'string', 'input', 'ultimate-transaction-account', 20, 'text'),
    col('payment-method', 'columns.paymentMethod', 'string', 'input', 'ultimate-transaction-method', 20, 'text'),
    col('amount', 'columns.amount', 'currency', 'input', 'ultimate-transaction-amount', 16, 'currency'),
  ],
  [],
  [
    dateRule('ultimate-transaction-date', 'transactions', 'date'),
    textRule('ultimate-transaction-description', 'transactions', 'description', 1, 120),
    localizedListValues('ultimate-transaction-type', 'transactions', 'type', ['values.transactionType.income', 'values.transactionType.expense', 'values.transactionType.savings']),
    listSource('ultimate-transaction-category', 'transactions', 'category', 'categories.category'),
    localizedListValues('ultimate-transaction-account', 'transactions', 'account', ['values.account.checking', 'values.account.savings', 'values.account.creditCard']),
    localizedListValues('ultimate-transaction-method', 'transactions', 'payment-method', ['values.paymentMethod.directDebit', 'values.paymentMethod.bankTransfer', 'values.paymentMethod.card', 'values.paymentMethod.cash']),
    decimalMin('ultimate-transaction-amount', 'transactions', 'amount', 0.01),
  ],
  100, true,
  ultimateTransactionSampleRows(),
  { centralInputModel: true },
);

const ultimateAnnualBudgetSheet = order => sheet(
  'annual-budget', 'sheets.annualBudget', 'input', order,
  [
    col('month', 'columns.month', 'string', 'identifier', null, 14, 'text'),
    col('fixed', 'columns.fixedBudget', 'currency', 'input', 'ultimate-budget-fixed', 16, 'currency'),
    col('variable', 'columns.variableBudget', 'currency', 'input', 'ultimate-budget-variable', 16, 'currency'),
    col('savings', 'columns.savingsBudget', 'currency', 'input', 'ultimate-budget-savings', 16, 'currency'),
    col('rollover', 'columns.rollover', 'currency', 'input', 'ultimate-budget-rollover', 16, 'currency'),
    col('planned', 'columns.totalPlanned', 'formula', 'calculated', null, 18, 'currency'),
  ],
  [formula('ultimate-budget-planned', 'annual-budget', 'planned', 'ROW_SUM', { columns: freeze(['fixed', 'variable', 'savings', 'rollover']) }, true)],
  [
    decimalMin('ultimate-budget-fixed', 'annual-budget', 'fixed', 0, false),
    decimalMin('ultimate-budget-variable', 'annual-budget', 'variable', 0, false),
    decimalMin('ultimate-budget-savings', 'annual-budget', 'savings', 0, false),
    decimalMin('ultimate-budget-rollover', 'annual-budget', 'rollover', -100000, false),
  ],
  12, true,
  monthRows().map((row, index) => ({ ...row, fixed: 1915, variable: 1050 + (index % 3) * 75, savings: 650, rollover: index ? 50 : 0 })),
  { premiumLayout: true, rolloverSupport: true },
);

const ultimateMonthlyDashboardSheet = order => sheet(
  'monthly-dashboard', 'sheets.monthlyDashboard', 'report', order,
  [
    col('month', 'columns.month', 'string', 'display', null, 14, 'text'),
    col('income', 'columns.income', 'formula', 'calculated', null, 16, 'currency'),
    col('expenses', 'columns.expenses', 'formula', 'calculated', null, 16, 'currency'),
    col('savings', 'columns.savings', 'formula', 'calculated', null, 16, 'currency'),
    col('cashflow', 'columns.cashflow', 'formula', 'calculated', null, 16, 'currency'),
    col('budget', 'columns.budgeted', 'formula', 'calculated', null, 16, 'currency'),
    col('variance', 'columns.variance', 'formula', 'calculated', null, 16, 'currency'),
    col('savings-rate', 'columns.savingsRate', 'formula', 'calculated', null, 14, 'percentage'),
  ],
  [
    formula('ultimate-month-income', 'monthly-dashboard', 'income', 'SUMIFS', { sumRange: freeze({ sheetId: 'transactions', columnId: 'amount' }), criteria: freeze([freeze({ sheetId: 'transactions', columnId: 'date', operator: 'MONTH_EQUALS', rowValue: 'month' }), freeze({ sheetId: 'transactions', columnId: 'type', operator: 'EQUAL', value: localizedValue('values.transactionType.income', 'Income') })]) }, true),
    formula('ultimate-month-expenses', 'monthly-dashboard', 'expenses', 'SUMIFS', { sumRange: freeze({ sheetId: 'transactions', columnId: 'amount' }), criteria: freeze([freeze({ sheetId: 'transactions', columnId: 'date', operator: 'MONTH_EQUALS', rowValue: 'month' }), freeze({ sheetId: 'transactions', columnId: 'type', operator: 'EQUAL', value: localizedValue('values.transactionType.expense', 'Expense') })]) }, true),
    formula('ultimate-month-savings', 'monthly-dashboard', 'savings', 'SUMIFS', { sumRange: freeze({ sheetId: 'transactions', columnId: 'amount' }), criteria: freeze([freeze({ sheetId: 'transactions', columnId: 'date', operator: 'MONTH_EQUALS', rowValue: 'month' }), freeze({ sheetId: 'transactions', columnId: 'type', operator: 'EQUAL', value: localizedValue('values.transactionType.savings', 'Savings') })]) }, true),
    formula('ultimate-month-cashflow', 'monthly-dashboard', 'cashflow', 'SUBTRACT', { minuend: freeze({ columnId: 'income' }), subtrahend: freeze({ operation: 'ADD', operands: freeze([freeze({ columnId: 'expenses' }), freeze({ columnId: 'savings' })]) }) }, true),
    formula('ultimate-month-budget', 'monthly-dashboard', 'budget', 'COPY', { source: freeze({ sheetId: 'annual-budget', columnId: 'planned', row: 'current' }) }, true),
    formula('ultimate-month-variance', 'monthly-dashboard', 'variance', 'ROW_DIFFERENCE', { leftColumnId: 'budget', rightColumnId: 'expenses' }, true),
    formula('ultimate-month-savings-rate', 'monthly-dashboard', 'savings-rate', 'ROW_RATIO', { numeratorColumnId: 'savings', denominatorColumnId: 'income' }, true),
  ],
  [], 12, true, monthRows(), { premiumLayout: true },
);

const ultimateCashflowSheet = order => sheet(
  'cashflow-dashboard', 'sheets.cashflowDashboard', 'report', order,
  [
    col('month', 'columns.month', 'string', 'display', null, 14, 'text'),
    col('income', 'columns.income', 'formula', 'calculated', null, 16, 'currency'),
    col('expenses', 'columns.expenses', 'formula', 'calculated', null, 16, 'currency'),
    col('cashflow', 'columns.cashflow', 'formula', 'calculated', null, 16, 'currency'),
    col('cumulative', 'columns.cumulativeCashflow', 'formula', 'calculated', null, 18, 'currency'),
  ],
  [
    formula('ultimate-cashflow-income', 'cashflow-dashboard', 'income', 'COPY', { source: freeze({ sheetId: 'monthly-dashboard', columnId: 'income', row: 'current' }) }, true),
    formula('ultimate-cashflow-expenses', 'cashflow-dashboard', 'expenses', 'COPY', { source: freeze({ sheetId: 'monthly-dashboard', columnId: 'expenses', row: 'current' }) }, true),
    formula('ultimate-cashflow-net', 'cashflow-dashboard', 'cashflow', 'COPY', { source: freeze({ sheetId: 'monthly-dashboard', columnId: 'cashflow', row: 'current' }) }, true),
    formula('ultimate-cashflow-cumulative', 'cashflow-dashboard', 'cumulative', 'RUNNING_SUM', { sourceColumnId: 'cashflow' }, true),
  ],
  [], 12, true, monthRows(), { premiumLayout: true },
);

const ultimatePayPeriodSheet = order => sheet(
  'pay-period-plan', 'sheets.payPeriodPlan', 'input', order,
  [
    col('period', 'columns.payPeriod', 'string', 'input', 'ultimate-pay-period', 18, 'text'),
    col('start', 'columns.startDate', 'date', 'input', 'ultimate-pay-start', 14, 'locale-date'),
    col('end', 'columns.endDate', 'date', 'input', 'ultimate-pay-end', 14, 'locale-date'),
    col('income', 'columns.income', 'currency', 'input', 'ultimate-pay-income', 16, 'currency'),
    col('allocated', 'columns.allocated', 'currency', 'input', 'ultimate-pay-allocated', 16, 'currency'),
    col('remaining', 'columns.remaining', 'formula', 'calculated', null, 16, 'currency'),
  ],
  [formula('ultimate-pay-remaining', 'pay-period-plan', 'remaining', 'ROW_DIFFERENCE', { leftColumnId: 'income', rightColumnId: 'allocated' }, true)],
  [textRule('ultimate-pay-period', 'pay-period-plan', 'period'), dateRule('ultimate-pay-start', 'pay-period-plan', 'start'), dateRule('ultimate-pay-end', 'pay-period-plan', 'end'), decimalMin('ultimate-pay-income', 'pay-period-plan', 'income'), decimalMin('ultimate-pay-allocated', 'pay-period-plan', 'allocated', 0, false)],
  26, true,
  [
    { period: localizedValue('sample.payPeriod.first', 'Pay period 1'), start: '2026-01-01', end: '2026-01-15', income: 2100, allocated: 1780 },
    { period: localizedValue('sample.payPeriod.second', 'Pay period 2'), start: '2026-01-16', end: '2026-01-31', income: 2100, allocated: 1925 },
  ],
  { premiumLayout: true },
);

const ultimateRecurringSheet = order => sheet(
  'recurring-transactions', 'sheets.recurringTransactions', 'input', order,
  [
    col('description', 'columns.description', 'string', 'input', 'ultimate-recurring-description', 30, 'text'),
    col('type', 'columns.transactionType', 'string', 'input', 'ultimate-recurring-type', 18, 'text'),
    col('category', 'columns.category', 'string', 'input', 'ultimate-recurring-category', 22, 'text'),
    col('amount', 'columns.amount', 'currency', 'input', 'ultimate-recurring-amount', 16, 'currency'),
    col('frequency', 'columns.frequency', 'string', 'input', 'ultimate-recurring-frequency', 18, 'text'),
    col('next-date', 'columns.nextDate', 'date', 'input', 'ultimate-recurring-next', 14, 'locale-date'),
    col('annual', 'columns.annualCost', 'formula', 'calculated', null, 18, 'currency'),
  ],
  [formula('ultimate-recurring-annual', 'recurring-transactions', 'annual', 'FREQUENCY_TO_ANNUAL', { amountColumnId: 'amount', frequencyColumnId: 'frequency' }, true)],
  [
    textRule('ultimate-recurring-description', 'recurring-transactions', 'description'),
    localizedListValues('ultimate-recurring-type', 'recurring-transactions', 'type', ['values.transactionType.income', 'values.transactionType.expense', 'values.transactionType.savings']),
    listSource('ultimate-recurring-category', 'recurring-transactions', 'category', 'categories.category'),
    decimalMin('ultimate-recurring-amount', 'recurring-transactions', 'amount'),
    localizedListValues('ultimate-recurring-frequency', 'recurring-transactions', 'frequency', ['values.frequency.weekly', 'values.frequency.biweekly', 'values.frequency.monthly', 'values.frequency.quarterly', 'values.frequency.semiAnnual', 'values.frequency.annual']),
    dateRule('ultimate-recurring-next', 'recurring-transactions', 'next-date', 'today-or-later'),
  ],
  100, true,
  [
    { description: localizedValue('sample.description.salary', 'Salary'), type: localizedValue('values.transactionType.income', 'Income'), category: localizedValue('sample.category.salary', 'Salary'), amount: 4200, frequency: localizedValue('values.frequency.monthly', 'Monthly'), 'next-date': '2026-04-25' },
    { description: localizedValue('sample.description.fixed1', 'Housing payment'), type: localizedValue('values.transactionType.expense', 'Expense'), category: localizedValue('sample.category.housing', 'Housing'), amount: 1450, frequency: localizedValue('values.frequency.monthly', 'Monthly'), 'next-date': '2026-04-02' },
  ],
  { premiumLayout: true },
);

const ultimateSubscriptionsSheet = order => sheet(
  'subscriptions', 'sheets.subscriptions', 'input', order,
  [
    col('name', 'columns.name', 'string', 'input', 'ultimate-subscription-name', 28, 'text'),
    col('category', 'columns.category', 'string', 'input', 'ultimate-subscription-category', 22, 'text'),
    col('amount', 'columns.amount', 'currency', 'input', 'ultimate-subscription-amount', 16, 'currency'),
    col('frequency', 'columns.frequency', 'string', 'input', 'ultimate-subscription-frequency', 18, 'text'),
    col('renewal', 'columns.renewalDate', 'date', 'input', 'ultimate-subscription-renewal', 16, 'locale-date'),
    col('status', 'columns.status', 'string', 'input', 'ultimate-subscription-status', 16, 'text'),
    col('annual-cost', 'columns.annualCost', 'formula', 'calculated', null, 18, 'currency'),
  ],
  [formula('ultimate-subscription-annual', 'subscriptions', 'annual-cost', 'FREQUENCY_TO_ANNUAL', { amountColumnId: 'amount', frequencyColumnId: 'frequency' }, true)],
  [
    textRule('ultimate-subscription-name', 'subscriptions', 'name'),
    listSource('ultimate-subscription-category', 'subscriptions', 'category', 'categories.category'),
    decimalMin('ultimate-subscription-amount', 'subscriptions', 'amount'),
    localizedListValues('ultimate-subscription-frequency', 'subscriptions', 'frequency', ['values.frequency.monthly', 'values.frequency.quarterly', 'values.frequency.annual']),
    dateRule('ultimate-subscription-renewal', 'subscriptions', 'renewal', 'today-or-later'),
    localizedListValues('ultimate-subscription-status', 'subscriptions', 'status', ['values.status.active', 'values.status.review', 'values.status.cancelled']),
  ],
  100, true,
  [
    { name: localizedValue('sample.subscription.cloudStorage', 'Cloud storage'), category: localizedValue('sample.category.personal', 'Personal'), amount: 9.99, frequency: localizedValue('values.frequency.monthly', 'Monthly'), renewal: '2026-05-10', status: localizedValue('values.status.active', 'Active') },
    { name: localizedValue('sample.subscription.streaming', 'Streaming service'), category: localizedValue('sample.category.personal', 'Personal'), amount: 14.99, frequency: localizedValue('values.frequency.monthly', 'Monthly'), renewal: '2026-05-18', status: localizedValue('values.status.review', 'Review') },
  ],
  { premiumLayout: true },
);

const ultimateFundSheet = (id, nameKey, order, sampleRows, capacity = 20) => sheet(
  id, nameKey, 'input', order,
  [
    col('name', 'columns.name', 'string', 'input', `${id}-name`, 28, 'text'),
    col('target', 'columns.target', 'currency', 'input', `${id}-target`, 16, 'currency'),
    col('current', 'columns.value', 'currency', 'input', `${id}-current`, 16, 'currency'),
    col('monthly', 'columns.monthlyContribution', 'currency', 'input', `${id}-monthly`, 18, 'currency'),
    col('deadline', 'columns.dueDate', 'date', 'input', `${id}-deadline`, 16, 'locale-date'),
    col('remaining', 'columns.remaining', 'formula', 'calculated', null, 16, 'currency'),
    col('required-monthly', 'columns.requiredMonthly', 'formula', 'calculated', null, 18, 'currency'),
    col('progress', 'columns.progress', 'formula', 'calculated', null, 14, 'percentage'),
    col('projection', 'columns.projectedDate', 'formula', 'calculated', null, 16, 'locale-date'),
    col('status', 'columns.status', 'formula', 'calculated', null, 18, 'text'),
  ],
  [
    formula(`${id}-remaining`, id, 'remaining', 'ROW_DIFFERENCE', { leftColumnId: 'target', rightColumnId: 'current' }, true),
    formula(`${id}-required-monthly`, id, 'required-monthly', 'REQUIRED_MONTHLY_CONTRIBUTION', { targetColumnId: 'target', currentColumnId: 'current', deadlineColumnId: 'deadline' }, true),
    formula(`${id}-progress`, id, 'progress', 'ROW_RATIO', { numeratorColumnId: 'current', denominatorColumnId: 'target' }, true),
    formula(`${id}-projection`, id, 'projection', 'PROJECTED_GOAL_DATE', { remainingColumnId: 'remaining', monthlyContributionColumnId: 'monthly' }, true, { numberFormat: 'date' }),
    formula(`${id}-status`, id, 'status', 'IF', { condition: freeze({ left: freeze({ columnId: 'current' }), operator: 'GREATER_THAN_OR_EQUAL', right: freeze({ columnId: 'target' }) }), whenTrue: localizedValue('values.status.complete', 'Complete'), whenFalse: localizedValue('values.status.inProgress', 'In progress') }, true),
  ],
  [textRule(`${id}-name`, id, 'name'), decimalMin(`${id}-target`, id, 'target', 0.01), decimalMin(`${id}-current`, id, 'current', 0, false), decimalMin(`${id}-monthly`, id, 'monthly', 0, false), dateRule(`${id}-deadline`, id, 'deadline', 'today-or-later')],
  capacity, true, sampleRows, { premiumLayout: true },
);

const ultimateGoalsSheet = order => ultimateFundSheet('goals', 'sheets.goals', order, [
  { name: localizedValue('sample.goal.emergencyFund', 'Emergency fund'), target: 12000, current: 4500, monthly: 400, deadline: '2027-08-31' },
  { name: localizedValue('sample.goal.travel', 'Travel'), target: 3500, current: 1900, monthly: 250, deadline: '2026-12-31' },
  { name: localizedValue('sample.goal.home', 'Home improvement'), target: 6000, current: 2250, monthly: 300, deadline: '2027-12-31' },
]);

const ultimateSinkingFundsSheet = order => ultimateFundSheet('sinking-funds', 'sheets.sinkingFunds', order, [
  { name: localizedValue('sample.fund.vehicle', 'Vehicle maintenance'), target: 1800, current: 650, monthly: 125, deadline: '2027-03-31' },
  { name: localizedValue('sample.fund.annualBills', 'Annual bills'), target: 2400, current: 1100, monthly: 180, deadline: '2026-12-31' },
  { name: localizedValue('sample.fund.gifts', 'Gifts'), target: 900, current: 350, monthly: 75, deadline: '2026-11-30' },
]);

const ultimateEmergencyFundSheet = order => ultimateFundSheet('emergency-fund', 'sheets.emergencyFund', order, [
  { name: localizedValue('sample.goal.emergencyFund', 'Emergency fund'), target: 12000, current: 4500, monthly: 400, deadline: '2027-08-31' },
], 5);

const ultimateDebtsSheet = order => sheet(
  'debts', 'sheets.debts', 'input', order,
  [
    col('name', 'columns.name', 'string', 'input', 'ultimate-debt-name', 26, 'text'),
    col('type', 'columns.type', 'string', 'input', 'ultimate-debt-type', 20, 'text'),
    col('start-balance', 'columns.startBalance', 'currency', 'input', 'ultimate-debt-start', 18, 'currency'),
    col('balance', 'columns.balance', 'currency', 'input', 'ultimate-debt-balance', 18, 'currency'),
    col('rate', 'columns.interestRate', 'percentage', 'input', 'ultimate-debt-rate', 16, 'percentage'),
    col('minimum', 'columns.minimumPayment', 'currency', 'input', 'ultimate-debt-minimum', 18, 'currency'),
    col('extra', 'columns.extraPayment', 'currency', 'input', 'ultimate-debt-extra', 16, 'currency'),
    col('payment', 'columns.totalPayment', 'formula', 'calculated', null, 18, 'currency'),
    col('paid', 'columns.amountPaid', 'formula', 'calculated', null, 16, 'currency'),
    col('progress', 'columns.progress', 'formula', 'calculated', null, 14, 'percentage'),
    col('payoff-date', 'columns.projectedPayoffDate', 'formula', 'calculated', null, 18, 'locale-date'),
    col('interest-estimate', 'columns.interestEstimate', 'formula', 'calculated', null, 18, 'currency'),
  ],
  [
    formula('ultimate-debt-payment', 'debts', 'payment', 'ROW_SUM', { columns: freeze(['minimum', 'extra']) }, true),
    formula('ultimate-debt-paid', 'debts', 'paid', 'ROW_DIFFERENCE', { leftColumnId: 'start-balance', rightColumnId: 'balance' }, true),
    formula('ultimate-debt-progress', 'debts', 'progress', 'ROW_RATIO', { numeratorColumnId: 'paid', denominatorColumnId: 'start-balance' }, true),
    formula('ultimate-debt-payoff', 'debts', 'payoff-date', 'PROJECTED_PAYOFF_DATE', { balanceColumnId: 'balance', rateColumnId: 'rate', paymentColumnId: 'payment' }, true, { numberFormat: 'date' }),
    formula('ultimate-debt-interest', 'debts', 'interest-estimate', 'TOTAL_INTEREST_ESTIMATE', { balanceColumnId: 'balance', rateColumnId: 'rate', minimumPaymentColumnId: 'minimum', extraPaymentColumnId: 'extra' }, true),
  ],
  [
    textRule('ultimate-debt-name', 'debts', 'name'),
    localizedListValues('ultimate-debt-type', 'debts', 'type', ['values.debtType.creditCard', 'values.debtType.personalLoan', 'values.debtType.autoLoan', 'values.debtType.studentLoan', 'values.debtType.mortgage']),
    decimalMin('ultimate-debt-start', 'debts', 'start-balance'),
    decimalMin('ultimate-debt-balance', 'debts', 'balance'),
    decimalRange('ultimate-debt-rate', 'debts', 'rate', 0, 1, false),
    decimalMin('ultimate-debt-minimum', 'debts', 'minimum'),
    decimalMin('ultimate-debt-extra', 'debts', 'extra', 0, false),
  ],
  100, true,
  [
    { name: localizedValue('sample.debt.creditCard', 'Credit card'), type: localizedValue('values.debtType.creditCard', 'Credit card'), 'start-balance': 5200, balance: 4100, rate: 0.189, minimum: 145, extra: 100 },
    { name: localizedValue('sample.debt.autoLoan', 'Vehicle loan'), type: localizedValue('values.debtType.autoLoan', 'Auto loan'), 'start-balance': 14800, balance: 12150, rate: 0.0575, minimum: 325, extra: 75 },
    { name: localizedValue('sample.debt.studentLoan', 'Student loan'), type: localizedValue('values.debtType.studentLoan', 'Student loan'), 'start-balance': 9200, balance: 8350, rate: 0.042, minimum: 180, extra: 50 },
  ],
  { premiumLayout: true, strategies: freeze(['snowball', 'avalanche']) },
);

const ultimatePaymentPlanSheet = order => sheet(
  'payment-plan', 'sheets.paymentPlan', 'report', order,
  [
    col('name', 'columns.name', 'formula', 'calculated', null, 26, 'text'),
    col('balance', 'columns.balance', 'formula', 'calculated', null, 18, 'currency'),
    col('rate', 'columns.interestRate', 'formula', 'calculated', null, 16, 'percentage'),
    col('payment', 'columns.totalPayment', 'formula', 'calculated', null, 18, 'currency'),
    col('snowball-rank', 'columns.snowballRank', 'formula', 'calculated', null, 16, 'integer'),
    col('avalanche-rank', 'columns.avalancheRank', 'formula', 'calculated', null, 16, 'integer'),
    col('payoff-date', 'columns.projectedPayoffDate', 'formula', 'calculated', null, 18, 'locale-date'),
  ],
  [
    formula('ultimate-plan-name', 'payment-plan', 'name', 'COPY', { source: freeze({ sheetId: 'debts', columnId: 'name', row: 'current' }) }, true),
    formula('ultimate-plan-balance', 'payment-plan', 'balance', 'COPY', { source: freeze({ sheetId: 'debts', columnId: 'balance', row: 'current' }) }, true),
    formula('ultimate-plan-rate', 'payment-plan', 'rate', 'COPY', { source: freeze({ sheetId: 'debts', columnId: 'rate', row: 'current' }) }, true),
    formula('ultimate-plan-payment', 'payment-plan', 'payment', 'COPY', { source: freeze({ sheetId: 'debts', columnId: 'payment', row: 'current' }) }, true),
    formula('ultimate-plan-snowball', 'payment-plan', 'snowball-rank', 'RANK_ASCENDING', { valueColumnId: 'balance', ignoreZero: true }, true, { numberFormat: 'integer' }),
    formula('ultimate-plan-avalanche', 'payment-plan', 'avalanche-rank', 'RANK_DESCENDING', { valueColumnId: 'rate' }, true, { numberFormat: 'integer' }),
    formula('ultimate-plan-payoff', 'payment-plan', 'payoff-date', 'COPY', { source: freeze({ sheetId: 'debts', columnId: 'payoff-date', row: 'current' }) }, true, { numberFormat: 'date' }),
  ],
  [], 20, true, [], { premiumLayout: true },
);

const ultimateAssetsSheet = order => sheet(
  'assets', 'sheets.assets', 'input', order,
  [col('name', 'columns.name', 'string', 'input', 'ultimate-asset-name', 28, 'text'), col('category', 'columns.category', 'string', 'input', 'ultimate-asset-category', 22, 'text'), col('value', 'columns.value', 'currency', 'input', 'ultimate-asset-value', 18, 'currency'), col('updated', 'columns.updatedDate', 'date', 'input', 'ultimate-asset-updated', 16, 'locale-date')],
  [],
  [textRule('ultimate-asset-name', 'assets', 'name'), localizedListValues('ultimate-asset-category', 'assets', 'category', ['values.assetType.cash', 'values.assetType.investment', 'values.assetType.property', 'values.assetType.retirement']), decimalMin('ultimate-asset-value', 'assets', 'value', 0, false), dateRule('ultimate-asset-updated', 'assets', 'updated')],
  100, true,
  [
    { name: localizedValue('sample.asset.home', 'Home'), category: localizedValue('values.assetType.property', 'Property'), value: 245000, updated: '2026-03-31' },
    { name: localizedValue('sample.asset.checking', 'Checking account'), category: localizedValue('values.assetType.cash', 'Cash'), value: 6500, updated: '2026-03-31' },
    { name: localizedValue('sample.asset.investments', 'Investment account'), category: localizedValue('values.assetType.investment', 'Investment'), value: 18200, updated: '2026-03-31' },
    { name: localizedValue('sample.asset.retirement', 'Retirement account'), category: localizedValue('values.assetType.retirement', 'Retirement'), value: 32500, updated: '2026-03-31' },
  ],
  { premiumLayout: true },
);

const ultimateLiabilitiesSheet = order => sheet(
  'liabilities', 'sheets.liabilityRegister', 'input', order,
  [col('name', 'columns.name', 'string', 'input', 'ultimate-liability-name', 28, 'text'), col('category', 'columns.category', 'string', 'input', 'ultimate-liability-category', 22, 'text'), col('value', 'columns.value', 'currency', 'input', 'ultimate-liability-value', 18, 'currency'), col('updated', 'columns.updatedDate', 'date', 'input', 'ultimate-liability-updated', 16, 'locale-date')],
  [],
  [textRule('ultimate-liability-name', 'liabilities', 'name'), localizedListValues('ultimate-liability-category', 'liabilities', 'category', ['values.liabilityType.credit', 'values.liabilityType.loan', 'values.liabilityType.mortgage']), decimalMin('ultimate-liability-value', 'liabilities', 'value', 0, false), dateRule('ultimate-liability-updated', 'liabilities', 'updated')],
  100, true,
  [
    { name: localizedValue('sample.debt.creditCard', 'Credit card'), category: localizedValue('values.liabilityType.credit', 'Credit'), value: 4100, updated: '2026-03-31' },
    { name: localizedValue('sample.debt.autoLoan', 'Vehicle loan'), category: localizedValue('values.liabilityType.loan', 'Loan'), value: 12150, updated: '2026-03-31' },
    { name: localizedValue('sample.liability.mortgage', 'Mortgage'), category: localizedValue('values.liabilityType.mortgage', 'Mortgage'), value: 168000, updated: '2026-03-31' },
  ],
  { premiumLayout: true },
);

const ultimateNetWorthSheet = order => {
  const assetValues = [22500, 23100, 23850, 24500, 25250, 26100, 26950, 27800, 28750, 29650, 30550, 31500];
  const liabilityValues = [19250, 18900, 18550, 18200, 17850, 17500, 17150, 16800, 16450, 16100, 15750, 15400];
  return sheet(
    'net-worth-history', 'sheets.netWorthHistory', 'input', order,
    [col('month', 'columns.month', 'string', 'identifier', null, 14, 'text'), col('assets', 'columns.assets', 'currency', 'input', 'ultimate-net-assets', 18, 'currency'), col('liabilities', 'columns.liabilities', 'currency', 'input', 'ultimate-net-liabilities', 18, 'currency'), col('net-worth', 'columns.netWorth', 'formula', 'calculated', null, 18, 'currency')],
    [formula('ultimate-net-worth-row', 'net-worth-history', 'net-worth', 'ROW_DIFFERENCE', { leftColumnId: 'assets', rightColumnId: 'liabilities' }, true)],
    [decimalMin('ultimate-net-assets', 'net-worth-history', 'assets', 0, false), decimalMin('ultimate-net-liabilities', 'net-worth-history', 'liabilities', 0, false)],
    12, true,
    monthRows().map((row, index) => ({ ...row, assets: assetValues[index], liabilities: liabilityValues[index] })),
    { premiumLayout: true },
  );
};

const ultimateCategoryAnalysisSheet = order => {
  const rows = categoryRows().slice(2, 8).map(row => ({ category: row.category }));
  return sheet(
    'category-analysis', 'sheets.categoryAnalysis', 'report', order,
    [col('category', 'columns.category', 'string', 'display', null, 24, 'text'), col('budgeted', 'columns.budgeted', 'formula', 'calculated', null, 16, 'currency'), col('actual', 'columns.actual', 'formula', 'calculated', null, 16, 'currency'), col('variance', 'columns.variance', 'formula', 'calculated', null, 16, 'currency'), col('percentage', 'columns.categoryPercentage', 'formula', 'calculated', null, 16, 'percentage')],
    [
      formula('ultimate-category-budget', 'category-analysis', 'budgeted', 'SUMIF', { sumRange: freeze({ sheetId: 'categories', columnId: 'budgeted' }), criteriaRange: freeze({ sheetId: 'categories', columnId: 'category' }), criteriaColumnId: 'category' }, true),
      formula('ultimate-category-actual', 'category-analysis', 'actual', 'SUMIFS', { sumRange: freeze({ sheetId: 'transactions', columnId: 'amount' }), criteria: freeze([freeze({ sheetId: 'transactions', columnId: 'category', operator: 'EQUAL', rowValue: 'category' }), freeze({ sheetId: 'transactions', columnId: 'type', operator: 'EQUAL', value: localizedValue('values.transactionType.expense', 'Expense') })]) }, true),
      formula('ultimate-category-variance', 'category-analysis', 'variance', 'ROW_DIFFERENCE', { leftColumnId: 'budgeted', rightColumnId: 'actual' }, true),
      formula('ultimate-category-percentage', 'category-analysis', 'percentage', 'IFERROR', { numerator: freeze({ columnId: 'actual' }), denominator: freeze({ formulaId: 'ultimate-total-expenses' }), fallback: 0 }, true, { numberFormat: 'percentage' }),
    ],
    [], rows.length, true, rows, { premiumLayout: true },
  );
};

const ultimateIncomeAnalysisSheet = order => sheet(
  'income-analysis', 'sheets.incomeAnalysis', 'report', order,
  [col('category', 'columns.category', 'string', 'display', null, 24, 'text'), col('amount', 'columns.amount', 'formula', 'calculated', null, 18, 'currency'), col('percentage', 'columns.categoryPercentage', 'formula', 'calculated', null, 16, 'percentage')],
  [
    formula('ultimate-income-category-amount', 'income-analysis', 'amount', 'SUMIFS', { sumRange: freeze({ sheetId: 'transactions', columnId: 'amount' }), criteria: freeze([freeze({ sheetId: 'transactions', columnId: 'category', operator: 'EQUAL', rowValue: 'category' }), freeze({ sheetId: 'transactions', columnId: 'type', operator: 'EQUAL', value: localizedValue('values.transactionType.income', 'Income') })]) }, true),
    formula('ultimate-income-category-share', 'income-analysis', 'percentage', 'IFERROR', { numerator: freeze({ columnId: 'amount' }), denominator: freeze({ formulaId: 'ultimate-total-income' }), fallback: 0 }, true, { numberFormat: 'percentage' }),
  ],
  [], 2, true,
  [{ category: localizedValue('sample.category.salary', 'Salary') }, { category: localizedValue('sample.category.freelance', 'Freelance') }],
  { premiumLayout: true },
);

const ultimateTrendSheet = order => sheet(
  'trend-analysis', 'sheets.trendAnalysis', 'report', order,
  [col('month', 'columns.month', 'string', 'display', null, 14, 'text'), col('income', 'columns.income', 'formula', 'calculated', null, 16, 'currency'), col('expenses', 'columns.expenses', 'formula', 'calculated', null, 16, 'currency'), col('cashflow', 'columns.cashflow', 'formula', 'calculated', null, 16, 'currency'), col('budget-variance', 'columns.budgetVariance', 'formula', 'calculated', null, 18, 'currency'), col('savings-rate', 'columns.savingsRate', 'formula', 'calculated', null, 16, 'percentage')],
  [
    formula('ultimate-trend-income', 'trend-analysis', 'income', 'COPY', { source: freeze({ sheetId: 'monthly-dashboard', columnId: 'income', row: 'current' }) }, true),
    formula('ultimate-trend-expenses', 'trend-analysis', 'expenses', 'COPY', { source: freeze({ sheetId: 'monthly-dashboard', columnId: 'expenses', row: 'current' }) }, true),
    formula('ultimate-trend-cashflow', 'trend-analysis', 'cashflow', 'COPY', { source: freeze({ sheetId: 'monthly-dashboard', columnId: 'cashflow', row: 'current' }) }, true),
    formula('ultimate-trend-variance', 'trend-analysis', 'budget-variance', 'COPY', { source: freeze({ sheetId: 'monthly-dashboard', columnId: 'variance', row: 'current' }) }, true),
    formula('ultimate-trend-savings', 'trend-analysis', 'savings-rate', 'COPY', { source: freeze({ sheetId: 'monthly-dashboard', columnId: 'savings-rate', row: 'current' }) }, true),
  ],
  [], 12, true, monthRows(), { premiumLayout: true },
);

const ultimateCharts = freeze([
  chart('ultimate-cashflow-chart', 'line', 'charts.monthlyCashflow', { from: { column: 4, row: 4 }, to: { column: 11, row: 18 } }, { sheetId: 'monthly-dashboard', columnId: 'month', firstRow: 5, lastRow: 16 }, [
    { id: 'income', nameKey: 'metrics.total-income', values: freeze({ sheetId: 'monthly-dashboard', columnId: 'income', firstRow: 5, lastRow: 16 }) },
    { id: 'expenses', nameKey: 'metrics.total-expenses', values: freeze({ sheetId: 'monthly-dashboard', columnId: 'expenses', firstRow: 5, lastRow: 16 }) },
    { id: 'cashflow', nameKey: 'metrics.cashflow', values: freeze({ sheetId: 'monthly-dashboard', columnId: 'cashflow', firstRow: 5, lastRow: 16 }) },
  ]),
  chart('ultimate-budget-actual-chart', 'column', 'charts.budgetVsActual', { from: { column: 12, row: 4 }, to: { column: 19, row: 18 } }, { sheetId: 'monthly-dashboard', columnId: 'month', firstRow: 5, lastRow: 16 }, [
    { id: 'budgeted', nameKey: 'columns.budgeted', values: freeze({ sheetId: 'monthly-dashboard', columnId: 'budget', firstRow: 5, lastRow: 16 }) },
    { id: 'actual', nameKey: 'columns.actual', values: freeze({ sheetId: 'monthly-dashboard', columnId: 'expenses', firstRow: 5, lastRow: 16 }) },
  ]),
  chart('ultimate-category-chart', 'doughnut', 'charts.expenseCategories', { from: { column: 4, row: 20 }, to: { column: 11, row: 34 } }, { sheetId: 'category-analysis', columnId: 'category', firstRow: 5, lastRow: 10 }, [
    { id: 'actual', nameKey: 'columns.actual', values: freeze({ sheetId: 'category-analysis', columnId: 'actual', firstRow: 5, lastRow: 10 }) },
  ]),
  chart('ultimate-net-worth-chart', 'line', 'charts.netWorthTrend', { from: { column: 12, row: 20 }, to: { column: 19, row: 34 } }, { sheetId: 'net-worth-history', columnId: 'month', firstRow: 5, lastRow: 16 }, [
    { id: 'net-worth', nameKey: 'metrics.net-worth', values: freeze({ sheetId: 'net-worth-history', columnId: 'net-worth', firstRow: 5, lastRow: 16 }) },
  ]),
  chart('ultimate-goals-chart', 'bar', 'charts.savingsGoals', { from: { column: 4, row: 36 }, to: { column: 11, row: 50 } }, { sheetId: 'goals', columnId: 'name', firstRow: 5, lastRow: 14 }, [
    { id: 'target', nameKey: 'columns.target', values: freeze({ sheetId: 'goals', columnId: 'target', firstRow: 5, lastRow: 14 }) },
    { id: 'current', nameKey: 'columns.value', values: freeze({ sheetId: 'goals', columnId: 'current', firstRow: 5, lastRow: 14 }) },
  ]),
  chart('ultimate-debts-chart', 'bar', 'charts.debtProgress', { from: { column: 12, row: 36 }, to: { column: 19, row: 50 } }, { sheetId: 'debts', columnId: 'name', firstRow: 5, lastRow: 14 }, [
    { id: 'start-balance', nameKey: 'columns.startBalance', values: freeze({ sheetId: 'debts', columnId: 'start-balance', firstRow: 5, lastRow: 14 }) },
    { id: 'balance', nameKey: 'columns.balance', values: freeze({ sheetId: 'debts', columnId: 'balance', firstRow: 5, lastRow: 14 }) },
  ]),
  chart('ultimate-income-distribution-chart', 'doughnut', 'charts.incomeDistribution', { from: { column: 4, row: 52 }, to: { column: 11, row: 66 } }, { sheetId: 'income-analysis', columnId: 'category', firstRow: 5, lastRow: 6 }, [
    { id: 'amount', nameKey: 'columns.amount', values: freeze({ sheetId: 'income-analysis', columnId: 'amount', firstRow: 5, lastRow: 6 }) },
  ]),
]);

const budgetPlannerUltimate = define({
  id: 'budget-planner-ultimate', version: '1.0.0', status: 'active', productFamily: 'personal-finance-os', category: 'budgeting', nameKey: 'products.budgetPlannerUltimate.name', descriptionKey: 'products.budgetPlannerUltimate.description', title: 'Budget Planner Ultimate', difficulty: 'advanced', tags: ['finance-os', 'budget', 'cashflow', 'goals', 'debt', 'net-worth', 'analytics'], features: ['executive-dashboard', 'monthly-dashboard', 'cashflow-dashboard', 'annual-budget', 'pay-period-plan', 'central-transactions', 'recurring-transactions', 'subscriptions', 'bill-calendar', 'sinking-funds', 'emergency-fund', 'goals', 'debt-snowball', 'debt-avalanche', 'net-worth', 'trend-analysis', 'category-analysis', 'income-analysis', 'charts', 'configuration', 'start-here'], recommended: true, audience: ['personal-budgeters', 'households', 'finance-enthusiasts'], featureFlags: { financeOs: true, executiveDashboard: true, monthlyDashboard: true, cashflowDashboard: true, centralTransactions: true, payPeriodPlanning: true, recurringTransactions: true, subscriptions: true, billCalendar: true, sinkingFunds: true, emergencyFund: true, debtStrategies: true, netWorth: true, trendAnalysis: true, charts: true }, compatibility: DUAL_PLATFORM_COMPATIBILITY,
  sheets: [
    ultimateStartSheet(1),
    sheet('executive-dashboard', 'sheets.executiveDashboard', 'dashboard', 2, dashboardColumns(), [
      formula('ultimate-total-income', 'executive-dashboard', 'total-income', 'SUMIF', { sumRange: freeze({ sheetId: 'transactions', columnId: 'amount' }), criteriaRange: freeze({ sheetId: 'transactions', columnId: 'type' }), criteria: localizedValue('values.transactionType.income', 'Income') }),
      formula('ultimate-total-expenses', 'executive-dashboard', 'total-expenses', 'SUMIF', { sumRange: freeze({ sheetId: 'transactions', columnId: 'amount' }), criteriaRange: freeze({ sheetId: 'transactions', columnId: 'type' }), criteria: localizedValue('values.transactionType.expense', 'Expense') }),
      formula('ultimate-total-savings', 'executive-dashboard', 'total-savings', 'SUMIF', { sumRange: freeze({ sheetId: 'transactions', columnId: 'amount' }), criteriaRange: freeze({ sheetId: 'transactions', columnId: 'type' }), criteria: localizedValue('values.transactionType.savings', 'Savings') }),
      formula('ultimate-free-to-spend', 'executive-dashboard', 'free-to-spend', 'SUBTRACT', { minuend: freeze({ formulaId: 'ultimate-total-income' }), subtrahend: freeze({ operation: 'ADD', operands: freeze([freeze({ formulaId: 'ultimate-total-expenses' }), freeze({ formulaId: 'ultimate-total-savings' })]) }) }),
      formula('ultimate-savings-rate', 'executive-dashboard', 'savings-rate', 'IFERROR', { numerator: freeze({ formulaId: 'ultimate-total-savings' }), denominator: freeze({ formulaId: 'ultimate-total-income' }), fallback: 0 }, false, { numberFormat: 'percentage' }),
      formula('ultimate-total-assets', 'executive-dashboard', 'total-assets', 'SUM', { range: freeze({ sheetId: 'assets', columnId: 'value' }) }),
      formula('ultimate-total-liabilities', 'executive-dashboard', 'total-liabilities', 'SUM', { range: freeze({ sheetId: 'liabilities', columnId: 'value' }) }),
      formula('ultimate-net-worth', 'executive-dashboard', 'net-worth', 'SUBTRACT', { minuend: freeze({ formulaId: 'ultimate-total-assets' }), subtrahend: freeze({ formulaId: 'ultimate-total-liabilities' }) }),
      formula('ultimate-goal-target', 'executive-dashboard', 'goal-target', 'SUM', { range: freeze({ sheetId: 'goals', columnId: 'target' }) }),
      formula('ultimate-goal-current', 'executive-dashboard', 'goal-current', 'SUM', { range: freeze({ sheetId: 'goals', columnId: 'current' }) }),
      formula('ultimate-goal-progress', 'executive-dashboard', 'goal-progress', 'IFERROR', { numerator: freeze({ formulaId: 'ultimate-goal-current' }), denominator: freeze({ formulaId: 'ultimate-goal-target' }), fallback: 0 }, false, { numberFormat: 'percentage' }),
      formula('ultimate-debt-balance', 'executive-dashboard', 'debt-balance', 'SUM', { range: freeze({ sheetId: 'debts', columnId: 'balance' }) }),
      formula('ultimate-budget-health', 'executive-dashboard', 'budget-health-score', 'PERCENT_SCORE', { numerator: freeze({ formulaId: 'ultimate-free-to-spend' }), denominator: freeze({ formulaId: 'ultimate-total-income' }) }, false, { numberFormat: 'integer' }),
    ], [], 0, false, [], { charts: ultimateCharts, premiumLayout: true, executive: true }),
    ultimateMonthlyDashboardSheet(3),
    ultimateCashflowSheet(4),
    ultimateTrendSheet(5),
    ultimateAnnualBudgetSheet(6),
    ultimatePayPeriodSheet(7),
    ultimateTransactionsSheet(8),
    ultimateRecurringSheet(9),
    ultimateSubscriptionsSheet(10),
    premiumBillsSheet(11),
    ultimateSinkingFundsSheet(12),
    ultimateEmergencyFundSheet(13),
    ultimateGoalsSheet(14),
    ultimateDebtsSheet(15),
    ultimatePaymentPlanSheet(16),
    ultimateAssetsSheet(17),
    ultimateLiabilitiesSheet(18),
    ultimateNetWorthSheet(19),
    ultimateCategoryAnalysisSheet(20),
    ultimateIncomeAnalysisSheet(21),
    premiumCategoriesSheet(22),
    ultimateConfigurationSheet(23),
    premiumInstructionsSheet(24),
  ],
  extensions: {
    tier: 'ultimate',
    moduleIds: freeze(['start-here', 'executive-dashboard', 'monthly-dashboard', 'cashflow-dashboard', 'trend-analysis', 'annual-budget', 'pay-period-plan', 'transactions', 'recurring-transactions', 'subscriptions', 'bills', 'sinking-funds', 'emergency-fund', 'goals', 'debts', 'payment-plan', 'assets', 'liabilities', 'net-worth-history', 'category-analysis', 'income-analysis', 'categories', 'configuration', 'instructions']),
    supportedAppearances: freeze(['light', 'dark']),
    minimumChartCount: 7,
    financeOs: true,
  },
});

const releaseCandidate = spec => {
  const definition = define({
    ...spec,
    version: '0.9.0',
    status: 'beta',
    recommended: true,
    extensions: {
      tier: spec.tier,
      moduleIds: freeze(spec.moduleIds),
      supportedAppearances: freeze(spec.supportedAppearances ?? ['light', 'dark']),
      releaseCandidate: true,
      defaultVisible: true,
      portfolioId: spec.portfolioId,
      platformProfiles: freeze({ excel: 'STRUCTURAL_VALIDATION_REQUIRED', googleSheets: 'PROVISIONAL_IMPORT_CHECKLIST_REQUIRED', dualPlatformClaimAllowed: false }),
      evidenceStatus: spec.evidenceStatus ?? 'LISTINGVIEW_SUPPORTED',
      ...(spec.extensions ?? {}),
    },
  });
  const themeId = spec.defaultThemeId ?? 'sage-finance';
  return freeze({
    ...definition,
    defaultConfiguration: freeze({
      ...definition.defaultConfiguration,
      themeId,
      extensions: freeze({ ...definition.defaultConfiguration.extensions, paletteId: themeId }),
    }),
  });
};

const annualBudgetSpreadsheet = releaseCandidate({
  id: 'annual-budget-spreadsheet',
  portfolioId: 'annual-budget-spreadsheet',
  tier: 'professional',
  productFamily: 'personal-budgeting',
  category: 'budgeting',
  nameKey: 'products.annualBudgetSpreadsheet.name',
  descriptionKey: 'products.annualBudgetSpreadsheet.description',
  title: 'Annual Budget Spreadsheet',
  difficulty: 'intermediate',
  tags: ['annual-budget', 'monthly-budget', 'cashflow', 'bills', 'savings'],
  features: ['professional-dashboard', 'annual-overview', 'dynamic-month-model', 'fixed-variable-expenses', 'bill-tracker', 'savings-goals', 'category-analysis', 'budget-vs-actual', 'cashflow', 'charts', 'instructions'],
  audience: ['annual-budgeters', 'households'],
  featureFlags: { annualOverview: true, monthlyPlanning: true, bills: true, goals: true, charts: true },
  sheets: budgetPlannerProfessional.sheets,
  moduleIds: ['dashboard', 'annual-overview', 'income', 'fixed-expenses', 'variable-expenses', 'bills', 'goals', 'cashflow', 'category-analysis', 'categories', 'instructions'],
});

const paycheckBudgetPlanner = releaseCandidate({
  id: 'paycheck-budget-planner',
  portfolioId: 'paycheck-budget-spreadsheet',
  tier: 'professional',
  productFamily: 'personal-budgeting',
  category: 'budgeting',
  nameKey: 'products.paycheckBudgetPlanner.name',
  descriptionKey: 'products.paycheckBudgetPlanner.description',
  title: 'Paycheck Budget Spreadsheet',
  difficulty: 'intermediate',
  tags: ['paycheck-budget', 'biweekly-budget', 'bill-tracker', 'savings', 'budget-planner'],
  features: ['professional-dashboard', 'pay-period-plan', 'bill-tracker', 'budget-vs-actual', 'category-analysis', 'charts', 'instructions'],
  audience: ['paycheck-budgeters', 'biweekly-budgeters'],
  featureFlags: { payPeriodPlanning: true, billAllocation: true, categoryAnalysis: true, charts: true },
  sheets: [
    sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [
      formula('paycheck-income-total', 'dashboard', 'total-income', 'SUM', { range: freeze({ sheetId: 'pay-periods', columnId: 'income' }) }),
      formula('paycheck-bills-total', 'dashboard', 'bills-total', 'SUM', { range: freeze({ sheetId: 'bills', columnId: 'amount' }) }),
      formula('paycheck-planned-total', 'dashboard', 'total-planned', 'SUM', { range: freeze({ sheetId: 'allocations', columnId: 'budgeted' }) }),
      formula('paycheck-actual-total', 'dashboard', 'total-expenses', 'SUM', { range: freeze({ sheetId: 'allocations', columnId: 'actual' }) }),
      formula('paycheck-remaining-total', 'dashboard', 'remaining-budget', 'SUBTRACT', { minuend: freeze({ formulaId: 'paycheck-income-total' }), subtrahend: freeze({ formulaId: 'paycheck-actual-total' }) }),
    ], [], 0, false, [], {
      charts: freeze([chart('paycheck-plan-chart', 'column', 'charts.paycheckPlan', { from: { column: 4, row: 4 }, to: { column: 12, row: 19 } }, { sheetId: 'pay-periods', columnId: 'pay-period', firstRow: 5, lastRow: 16 }, [
        { id: 'income', nameKey: 'columns.income', values: freeze({ sheetId: 'pay-periods', columnId: 'income', firstRow: 5, lastRow: 16 }) },
        { id: 'remaining', nameKey: 'columns.remaining', values: freeze({ sheetId: 'pay-periods', columnId: 'remaining', firstRow: 5, lastRow: 16 }) },
      ])]),
      premiumLayout: true,
    }),
    sheet('pay-periods', 'sheets.payPeriods', 'input', 2,
      [col('pay-period', 'columns.payPeriod', 'string', 'identifier', null, 20, 'text'), col('start-date', 'columns.startDate', 'date', 'input', 'pay-period-start', 16, 'locale-date'), col('end-date', 'columns.endDate', 'date', 'input', 'pay-period-end', 16, 'locale-date'), col('income', 'columns.income', 'currency', 'input', 'pay-period-income', 16, 'currency'), col('bills', 'columns.bills', 'formula', 'calculated', null, 16, 'currency'), col('allocated', 'columns.allocated', 'formula', 'calculated', null, 16, 'currency'), col('remaining', 'columns.remaining', 'formula', 'calculated', null, 16, 'currency')],
      [
        formula('pay-period-bills', 'pay-periods', 'bills', 'SUMIF', { sumRange: freeze({ sheetId: 'bills', columnId: 'amount' }), criteriaRange: freeze({ sheetId: 'bills', columnId: 'pay-period' }), criteriaColumnId: 'pay-period' }, true),
        formula('pay-period-allocated', 'pay-periods', 'allocated', 'SUMIF', { sumRange: freeze({ sheetId: 'allocations', columnId: 'budgeted' }), criteriaRange: freeze({ sheetId: 'allocations', columnId: 'pay-period' }), criteriaColumnId: 'pay-period' }, true),
        formula('pay-period-remaining', 'pay-periods', 'remaining', 'ROW_DIFFERENCE', { leftColumnId: 'income', rightColumnId: 'allocated' }, true),
      ],
      [dateRule('pay-period-start', 'pay-periods', 'start-date'), dateRule('pay-period-end', 'pay-periods', 'end-date'), decimalMin('pay-period-income', 'pay-periods', 'income', 0, false)],
      26, true,
      [
        { 'pay-period': localizedValue('sample.payPeriod.first', 'Pay period 1'), 'start-date': '2026-01-01', 'end-date': '2026-01-14', income: 2400 },
        { 'pay-period': localizedValue('sample.payPeriod.second', 'Pay period 2'), 'start-date': '2026-01-15', 'end-date': '2026-01-31', income: 2400 },
      ], { premiumLayout: true }),
    sheet('bills', 'sheets.bills', 'input', 3,
      [col('name', 'columns.name', 'string', 'input', 'paycheck-bill-name', 28, 'text'), col('date', 'columns.dueDate', 'date', 'input', 'paycheck-bill-date', 16, 'locale-date'), col('pay-period', 'columns.payPeriod', 'string', 'input', 'paycheck-bill-period', 20, 'text'), col('amount', 'columns.amount', 'currency', 'input', 'paycheck-bill-amount', 16, 'currency'), col('status', 'columns.status', 'string', 'input', 'paycheck-bill-status', 18, 'text')],
      [],
      [textRule('paycheck-bill-name', 'bills', 'name'), dateRule('paycheck-bill-date', 'bills', 'date'), listSource('paycheck-bill-period', 'bills', 'pay-period', 'pay-periods.pay-period'), decimalMin('paycheck-bill-amount', 'bills', 'amount'), localizedListValues('paycheck-bill-status', 'bills', 'status', ['values.status.scheduled', 'values.status.paid', 'values.status.overdue'])],
      100, true,
      [
        { name: localizedValue('sample.bill.housing', 'Housing'), date: '2026-01-02', 'pay-period': localizedValue('sample.payPeriod.first', 'Pay period 1'), amount: 1450, status: localizedValue('values.status.scheduled', 'Scheduled') },
        { name: localizedValue('sample.bill.utilities', 'Utilities'), date: '2026-01-18', 'pay-period': localizedValue('sample.payPeriod.second', 'Pay period 2'), amount: 268, status: localizedValue('values.status.paid', 'Paid') },
      ]),
    sheet('allocations', 'sheets.allocations', 'input', 4,
      [col('pay-period', 'columns.payPeriod', 'string', 'input', 'allocation-period', 20, 'text'), col('category', 'columns.category', 'string', 'input', 'allocation-category', 22, 'text'), col('budgeted', 'columns.budgeted', 'currency', 'input', 'allocation-budgeted', 16, 'currency'), col('actual', 'columns.actual', 'currency', 'input', 'allocation-actual', 16, 'currency'), col('remaining', 'columns.remaining', 'formula', 'calculated', null, 16, 'currency')],
      [formula('allocation-remaining', 'allocations', 'remaining', 'ROW_DIFFERENCE', { leftColumnId: 'budgeted', rightColumnId: 'actual' }, true)],
      [listSource('allocation-period', 'allocations', 'pay-period', 'pay-periods.pay-period'), listSource('allocation-category', 'allocations', 'category', 'categories.category'), decimalMin('allocation-budgeted', 'allocations', 'budgeted', 0, false), decimalMin('allocation-actual', 'allocations', 'actual', 0, false)],
      100, true,
      [
        { 'pay-period': localizedValue('sample.payPeriod.first', 'Pay period 1'), category: localizedValue('sample.category.housing', 'Housing'), budgeted: 1450, actual: 1450 },
        { 'pay-period': localizedValue('sample.payPeriod.second', 'Pay period 2'), category: localizedValue('sample.category.groceries', 'Groceries'), budgeted: 560, actual: 525 },
      ]),
    premiumCategoriesSheet(5),
    premiumInstructionsSheet(6),
  ],
  moduleIds: ['dashboard', 'pay-period-plan', 'bills', 'allocations', 'categories', 'instructions'],
});

const debtSavingsBundle = releaseCandidate({
  id: 'debt-savings-bundle',
  portfolioId: 'debt-payoff-tracker',
  tier: 'ultimate',
  productFamily: 'personal-finance-os',
  category: 'debt-management',
  nameKey: 'products.debtSavingsBundle.name',
  descriptionKey: 'products.debtSavingsBundle.description',
  title: 'Debt and Savings Bundle',
  difficulty: 'advanced',
  tags: ['debt-payoff', 'savings-goals', 'sinking-funds', 'emergency-fund', 'finance-dashboard'],
  features: ['executive-dashboard', 'debt-snowball', 'debt-avalanche', 'payoff-projection', 'savings-goals', 'sinking-funds', 'emergency-fund', 'charts', 'instructions'],
  audience: ['debt-payoff-users', 'savers'],
  featureFlags: { debtStrategies: true, savingsGoals: true, sinkingFunds: true, emergencyFund: true, charts: true },
  sheets: [
    sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [
      formula('bundle-debt-total', 'dashboard', 'total-debt', 'SUM', { range: freeze({ sheetId: 'debts', columnId: 'balance' }) }),
      formula('bundle-minimum-total', 'dashboard', 'minimum-payment-total', 'SUM', { range: freeze({ sheetId: 'debts', columnId: 'minimum' }) }),
      formula('bundle-savings-target', 'dashboard', 'goal-target', 'SUM', { ranges: freeze([{ sheetId: 'goals', columnId: 'target' }, { sheetId: 'sinking-funds', columnId: 'target' }, { sheetId: 'emergency-fund', columnId: 'target' }]) }),
      formula('bundle-savings-current', 'dashboard', 'goal-current', 'SUM', { ranges: freeze([{ sheetId: 'goals', columnId: 'current' }, { sheetId: 'sinking-funds', columnId: 'current' }, { sheetId: 'emergency-fund', columnId: 'current' }]) }),
      formula('bundle-savings-progress', 'dashboard', 'goal-progress', 'IFERROR', { numerator: freeze({ formulaId: 'bundle-savings-current' }), denominator: freeze({ formulaId: 'bundle-savings-target' }), fallback: 0 }, false, { numberFormat: 'percentage' }),
    ], [], 0, false, [], { premiumLayout: true }),
    ultimateDebtsSheet(2),
    ultimatePaymentPlanSheet(3),
    ultimateGoalsSheet(4),
    ultimateSinkingFundsSheet(5),
    ultimateEmergencyFundSheet(6),
    premiumInstructionsSheet(7),
  ],
  moduleIds: ['dashboard', 'debts', 'payment-plan', 'goals', 'sinking-funds', 'emergency-fund', 'instructions'],
});

const PROJECT_WORKFLOW_STATUSES = freeze(['values.status.scheduled', 'values.status.inProgress', 'values.status.review', 'values.status.complete', 'values.status.paused']);
const projectWorkflowStatus = (id, sheetId, columnId = 'status') => localizedListValues(id, sheetId, columnId, PROJECT_WORKFLOW_STATUSES);
const projectManagementCompletionSheets = startOrder => [
  sheet('project-initiation', 'sheets.projectInitiation', 'input', startOrder,
    [col('project', 'columns.project', 'string', 'input', 'initiation-project', 28, 'text'), col('artifact-type', 'columns.artifactType', 'string', 'identifier', 'initiation-type', 24, 'text'), col('statement', 'columns.statement', 'string', 'input', 'initiation-statement', 52, 'text'), col('owner', 'columns.owner', 'string', 'input', 'initiation-owner', 22, 'text'), col('approver', 'columns.approver', 'string', 'input', null, 22, 'text'), col('due-date', 'columns.dueDate', 'date', 'input', 'initiation-due', 16, 'locale-date'), col('status', 'columns.status', 'string', 'input', 'initiation-status', 18, 'text')],
    [], [listSource('initiation-project', 'project-initiation', 'project', 'projects.name'), textRule('initiation-type', 'project-initiation', 'artifact-type', 2, 60), textRule('initiation-statement', 'project-initiation', 'statement', 2, 500), textRule('initiation-owner', 'project-initiation', 'owner'), dateRule('initiation-due', 'project-initiation', 'due-date', 'configuration.year', false), projectWorkflowStatus('initiation-status', 'project-initiation')], 100, true, [], { premiumLayout: true, components: freeze(['Project Charter', 'Business Case', 'Project Scope', 'Objectives', 'Success Criteria', 'Assumptions', 'Constraints', 'Deliverables', 'Governance']) }),
  sheet('stakeholder-register', 'sheets.stakeholderRegister', 'input', startOrder + 1,
    [col('project', 'columns.project', 'string', 'input', 'stakeholder-project', 28, 'text'), col('stakeholder', 'columns.stakeholder', 'string', 'identifier', 'stakeholder-name', 28, 'text'), col('role', 'columns.role', 'string', 'input', 'stakeholder-role', 24, 'text'), col('influence', 'columns.influence', 'string', 'input', 'stakeholder-influence', 16, 'text'), col('interest', 'columns.interest', 'string', 'input', 'stakeholder-interest', 16, 'text'), col('engagement', 'columns.engagement', 'string', 'input', null, 28, 'text'), col('owner', 'columns.owner', 'string', 'input', 'stakeholder-owner', 22, 'text'), col('note', 'columns.note', 'string', 'input', null, 36, 'text')],
    [], [listSource('stakeholder-project', 'stakeholder-register', 'project', 'projects.name'), textRule('stakeholder-name', 'stakeholder-register', 'stakeholder'), textRule('stakeholder-role', 'stakeholder-register', 'role'), localizedListValues('stakeholder-influence', 'stakeholder-register', 'influence', ['values.priority.low', 'values.priority.medium', 'values.priority.high', 'values.priority.critical']), localizedListValues('stakeholder-interest', 'stakeholder-register', 'interest', ['values.priority.low', 'values.priority.medium', 'values.priority.high']), textRule('stakeholder-owner', 'stakeholder-register', 'owner')], 250, true, [], { premiumLayout: true, components: freeze(['Stakeholder Register', 'Stakeholder Analysis', 'Power-Interest Analysis']) }),
  sheet('raci-matrix', 'sheets.raciMatrix', 'input', startOrder + 2,
    [col('project', 'columns.project', 'string', 'input', 'raci-project', 28, 'text'), col('deliverable', 'columns.deliverable', 'string', 'identifier', 'raci-deliverable', 34, 'text'), col('role', 'columns.role', 'string', 'input', 'raci-role', 24, 'text'), col('responsibility', 'columns.responsibility', 'string', 'input', 'raci-responsibility', 20, 'text'), col('person', 'columns.person', 'string', 'input', 'raci-person', 24, 'text'), col('status', 'columns.status', 'string', 'input', 'raci-status', 18, 'text')],
    [], [listSource('raci-project', 'raci-matrix', 'project', 'projects.name'), textRule('raci-deliverable', 'raci-matrix', 'deliverable'), textRule('raci-role', 'raci-matrix', 'role'), localizedListValues('raci-responsibility', 'raci-matrix', 'responsibility', ['values.raci.responsible', 'values.raci.accountable', 'values.raci.consulted', 'values.raci.informed']), textRule('raci-person', 'raci-matrix', 'person'), projectWorkflowStatus('raci-status', 'raci-matrix')], 250, true, [], { premiumLayout: true, components: freeze(['RACI']) }),
  sheet('communications', 'sheets.communications', 'input', startOrder + 3,
    [col('project', 'columns.project', 'string', 'input', 'communication-project', 28, 'text'), col('artifact-type', 'columns.artifactType', 'string', 'identifier', 'communication-type', 24, 'text'), col('audience', 'columns.audience', 'string', 'input', 'communication-audience', 28, 'text'), col('channel', 'columns.channel', 'string', 'input', null, 20, 'text'), col('cadence', 'columns.cadence', 'string', 'input', null, 20, 'text'), col('meeting-date', 'columns.meetingDate', 'date', 'input', 'communication-date', 16, 'locale-date'), col('owner', 'columns.owner', 'string', 'input', 'communication-owner', 22, 'text'), col('decision-action', 'columns.decisionAction', 'string', 'input', null, 42, 'text'), col('due-date', 'columns.dueDate', 'date', 'input', 'communication-due', 16, 'locale-date'), col('status', 'columns.status', 'string', 'input', 'communication-status', 18, 'text')],
    [], [listSource('communication-project', 'communications', 'project', 'projects.name'), textRule('communication-type', 'communications', 'artifact-type'), textRule('communication-audience', 'communications', 'audience'), dateRule('communication-date', 'communications', 'meeting-date', 'configuration.year', false), textRule('communication-owner', 'communications', 'owner'), dateRule('communication-due', 'communications', 'due-date', 'configuration.year', false), projectWorkflowStatus('communication-status', 'communications')], 250, true, [], { premiumLayout: true, components: freeze(['Communication Plan', 'Meeting Minutes', 'Action Register', 'Escalation Matrix']) }),
  sheet('delivery-plan', 'sheets.deliveryPlan', 'input', startOrder + 4,
    [col('project', 'columns.project', 'string', 'input', 'delivery-project', 28, 'text'), col('artifact-type', 'columns.artifactType', 'string', 'input', 'delivery-type', 22, 'text'), col('item', 'columns.item', 'string', 'identifier', 'delivery-item', 34, 'text'), col('parent-item', 'columns.parentItem', 'string', 'input', null, 28, 'text'), col('dependency', 'columns.dependency', 'string', 'input', null, 28, 'text'), col('start-date', 'columns.startDate', 'date', 'input', 'delivery-start', 16, 'locale-date'), col('end-date', 'columns.endDate', 'date', 'input', 'delivery-end', 16, 'locale-date'), col('owner', 'columns.owner', 'string', 'input', 'delivery-owner', 22, 'text'), col('status', 'columns.status', 'string', 'input', 'delivery-status', 18, 'text'), col('progress', 'columns.progress', 'percentage', 'input', 'delivery-progress', 14, 'percentage')],
    [], [listSource('delivery-project', 'delivery-plan', 'project', 'projects.name'), textRule('delivery-type', 'delivery-plan', 'artifact-type'), textRule('delivery-item', 'delivery-plan', 'item'), dateRule('delivery-start', 'delivery-plan', 'start-date'), dateRule('delivery-end', 'delivery-plan', 'end-date'), textRule('delivery-owner', 'delivery-plan', 'owner'), projectWorkflowStatus('delivery-status', 'delivery-plan'), decimalRange('delivery-progress', 'delivery-plan', 'progress', 0, 1, false)], 500, true, [], { ganttView: true, premiumLayout: true, components: freeze(['Work Breakdown Structure', 'Milestones', 'Project Schedule', 'Gantt', 'Dependencies', 'Roadmap', 'Release Planning']) }),
  sheet('resource-capacity', 'sheets.resourceCapacity', 'input', startOrder + 5,
    [col('project', 'columns.project', 'string', 'input', 'resource-project', 28, 'text'), col('resource', 'columns.resource', 'string', 'identifier', 'resource-name', 26, 'text'), col('role', 'columns.role', 'string', 'input', 'resource-role', 24, 'text'), col('reporting-period', 'columns.reportingPeriod', 'string', 'input', null, 20, 'text'), col('available-capacity', 'columns.availableCapacity', 'percentage', 'input', 'resource-available', 18, 'percentage'), col('allocated-capacity', 'columns.allocatedCapacity', 'percentage', 'input', 'resource-allocated', 18, 'percentage'), col('remaining-capacity', 'columns.remainingCapacity', 'formula', 'calculated', null, 18, 'percentage'), col('note', 'columns.note', 'string', 'input', null, 34, 'text')],
    [formula('resource-capacity-remaining', 'resource-capacity', 'remaining-capacity', 'ROW_DIFFERENCE', { leftColumnId: 'available-capacity', rightColumnId: 'allocated-capacity' }, true, { numberFormat: 'percentage' })], [listSource('resource-project', 'resource-capacity', 'project', 'projects.name'), textRule('resource-name', 'resource-capacity', 'resource'), textRule('resource-role', 'resource-capacity', 'role'), decimalRange('resource-available', 'resource-capacity', 'available-capacity', 0, 1), decimalRange('resource-allocated', 'resource-capacity', 'allocated-capacity', 0, 1)], 250, true, [], { premiumLayout: true, components: freeze(['Resource Planning', 'Capacity Planning', 'Resource Dashboard']) }),
  sheet('agile-planning', 'sheets.agilePlanning', 'input', startOrder + 6,
    [col('project', 'columns.project', 'string', 'input', 'agile-project', 28, 'text'), col('sprint', 'columns.sprint', 'string', 'input', 'agile-sprint', 20, 'text'), col('backlog-item', 'columns.backlogItem', 'string', 'identifier', 'agile-item', 38, 'text'), col('priority', 'columns.priority', 'string', 'input', 'agile-priority', 16, 'text'), col('story-points', 'columns.storyPoints', 'number', 'input', 'agile-points', 14, 'integer'), col('owner', 'columns.owner', 'string', 'input', 'agile-owner', 22, 'text'), col('start-date', 'columns.startDate', 'date', 'input', 'agile-start', 16, 'locale-date'), col('end-date', 'columns.endDate', 'date', 'input', 'agile-end', 16, 'locale-date'), col('status', 'columns.status', 'string', 'input', 'agile-status', 18, 'text')],
    [], [listSource('agile-project', 'agile-planning', 'project', 'projects.name'), textRule('agile-sprint', 'agile-planning', 'sprint'), textRule('agile-item', 'agile-planning', 'backlog-item'), localizedListValues('agile-priority', 'agile-planning', 'priority', ['values.priority.low', 'values.priority.medium', 'values.priority.high', 'values.priority.critical']), decimalRange('agile-points', 'agile-planning', 'story-points', 0, 100, false), textRule('agile-owner', 'agile-planning', 'owner'), dateRule('agile-start', 'agile-planning', 'start-date', 'configuration.year', false), dateRule('agile-end', 'agile-planning', 'end-date', 'configuration.year', false), projectWorkflowStatus('agile-status', 'agile-planning')], 500, true, [], { kanbanView: true, premiumLayout: true, components: freeze(['Sprint Planner', 'Backlog', 'Roadmap', 'Release Planning']) }),
  sheet('raid-log', 'sheets.raidLog', 'input', startOrder + 7,
    [col('project', 'columns.project', 'string', 'input', 'raid-project', 28, 'text'), col('log-type', 'columns.logType', 'string', 'identifier', 'raid-type', 18, 'text'), col('statement', 'columns.statement', 'string', 'input', 'raid-statement', 42, 'text'), col('probability', 'columns.probability', 'percentage', 'input', 'raid-probability', 16, 'percentage'), col('impact', 'columns.impact', 'string', 'input', 'raid-impact', 16, 'text'), col('owner', 'columns.owner', 'string', 'input', 'raid-owner', 22, 'text'), col('due-date', 'columns.dueDate', 'date', 'input', 'raid-due', 16, 'locale-date'), col('status', 'columns.status', 'string', 'input', 'raid-status', 18, 'text')],
    [], [listSource('raid-project', 'raid-log', 'project', 'projects.name'), textRule('raid-type', 'raid-log', 'log-type'), textRule('raid-statement', 'raid-log', 'statement', 2, 500), decimalRange('raid-probability', 'raid-log', 'probability', 0, 1, false), localizedListValues('raid-impact', 'raid-log', 'impact', ['values.priority.low', 'values.priority.medium', 'values.priority.high', 'values.priority.critical']), textRule('raid-owner', 'raid-log', 'owner'), dateRule('raid-due', 'raid-log', 'due-date', 'configuration.year', false), projectWorkflowStatus('raid-status', 'raid-log')], 250, true, [], { premiumLayout: true, components: freeze(['RAID Log', 'Risk Register', 'Issue Log', 'Assumption Log', 'Dependency Log']) }),
  sheet('decisions-changes', 'sheets.decisionsChanges', 'input', startOrder + 8,
    [col('project', 'columns.project', 'string', 'input', 'decision-project', 28, 'text'), col('artifact-type', 'columns.artifactType', 'string', 'identifier', 'decision-type', 20, 'text'), col('description', 'columns.description', 'string', 'input', 'decision-description', 38, 'text'), col('rationale', 'columns.rationale', 'string', 'input', null, 36, 'text'), col('schedule-impact', 'columns.scheduleImpact', 'string', 'input', null, 24, 'text'), col('budget-impact', 'columns.budgetImpact', 'currency', 'input', null, 18, 'currency'), col('approver', 'columns.approver', 'string', 'input', 'decision-approver', 22, 'text'), col('date', 'columns.date', 'date', 'input', 'decision-date', 16, 'locale-date'), col('status', 'columns.status', 'string', 'input', 'decision-status', 18, 'text')],
    [], [listSource('decision-project', 'decisions-changes', 'project', 'projects.name'), textRule('decision-type', 'decisions-changes', 'artifact-type'), textRule('decision-description', 'decisions-changes', 'description', 2, 500), textRule('decision-approver', 'decisions-changes', 'approver'), dateRule('decision-date', 'decisions-changes', 'date'), projectWorkflowStatus('decision-status', 'decisions-changes')], 250, true, [], { premiumLayout: true, components: freeze(['Decision Log', 'Change Register']) }),
  sheet('requirements-traceability', 'sheets.requirementsTraceability', 'input', startOrder + 9,
    [col('project', 'columns.project', 'string', 'input', 'requirement-project', 28, 'text'), col('requirement-id', 'columns.requirementId', 'string', 'identifier', 'requirement-id', 18, 'text'), col('requirement', 'columns.requirement', 'string', 'input', 'requirement-description', 42, 'text'), col('source', 'columns.source', 'string', 'input', null, 24, 'text'), col('priority', 'columns.priority', 'string', 'input', 'requirement-priority', 16, 'text'), col('linked-deliverable', 'columns.linkedDeliverable', 'string', 'input', null, 30, 'text'), col('acceptance-test', 'columns.acceptanceTest', 'string', 'input', null, 38, 'text'), col('owner', 'columns.owner', 'string', 'input', 'requirement-owner', 22, 'text'), col('status', 'columns.status', 'string', 'input', 'requirement-status', 18, 'text')],
    [], [listSource('requirement-project', 'requirements-traceability', 'project', 'projects.name'), textRule('requirement-id', 'requirements-traceability', 'requirement-id'), textRule('requirement-description', 'requirements-traceability', 'requirement', 2, 500), localizedListValues('requirement-priority', 'requirements-traceability', 'priority', ['values.priority.low', 'values.priority.medium', 'values.priority.high', 'values.priority.critical']), textRule('requirement-owner', 'requirements-traceability', 'owner'), projectWorkflowStatus('requirement-status', 'requirements-traceability')], 500, true, [], { premiumLayout: true, components: freeze(['Requirements Register', 'Traceability Matrix']) }),
  sheet('quality-acceptance', 'sheets.qualityAcceptance', 'input', startOrder + 10,
    [col('project', 'columns.project', 'string', 'input', 'quality-project', 28, 'text'), col('artifact-type', 'columns.artifactType', 'string', 'identifier', 'quality-type', 22, 'text'), col('criterion', 'columns.criterion', 'string', 'input', 'quality-criterion', 42, 'text'), col('evidence', 'columns.evidence', 'string', 'input', null, 38, 'text'), col('owner', 'columns.owner', 'string', 'input', 'quality-owner', 22, 'text'), col('date', 'columns.date', 'date', 'input', 'quality-date', 16, 'locale-date'), col('status', 'columns.status', 'string', 'input', 'quality-status', 18, 'text')],
    [], [listSource('quality-project', 'quality-acceptance', 'project', 'projects.name'), textRule('quality-type', 'quality-acceptance', 'artifact-type'), textRule('quality-criterion', 'quality-acceptance', 'criterion', 2, 500), textRule('quality-owner', 'quality-acceptance', 'owner'), dateRule('quality-date', 'quality-acceptance', 'date', 'configuration.year', false), projectWorkflowStatus('quality-status', 'quality-acceptance')], 250, true, [], { premiumLayout: true, components: freeze(['Quality Register', 'Acceptance Register']) }),
  sheet('status-reports', 'sheets.statusReports', 'input', startOrder + 11,
    [col('project', 'columns.project', 'string', 'input', 'report-project', 28, 'text'), col('reporting-period', 'columns.reportingPeriod', 'string', 'identifier', 'report-period', 20, 'text'), col('overall-health', 'columns.overallHealth', 'string', 'input', 'report-health', 18, 'text'), col('achievements', 'columns.achievements', 'string', 'input', null, 38, 'text'), col('next-period', 'columns.nextPeriod', 'string', 'input', null, 38, 'text'), col('blockers', 'columns.blockers', 'string', 'input', null, 34, 'text'), col('decision-needed', 'columns.decisionNeeded', 'string', 'input', null, 34, 'text'), col('owner', 'columns.owner', 'string', 'input', 'report-owner', 22, 'text'), col('date', 'columns.date', 'date', 'input', 'report-date', 16, 'locale-date')],
    [], [listSource('report-project', 'status-reports', 'project', 'projects.name'), textRule('report-period', 'status-reports', 'reporting-period'), localizedListValues('report-health', 'status-reports', 'overall-health', ['values.priority.low', 'values.priority.medium', 'values.priority.high', 'values.priority.critical']), textRule('report-owner', 'status-reports', 'owner'), dateRule('report-date', 'status-reports', 'date')], 100, true, [], { premiumLayout: true, components: freeze(['Status Report', 'Project Health', 'Executive Summary']) }),
  sheet('kpi-register', 'sheets.kpiRegister', 'report', startOrder + 12,
    [col('project', 'columns.project', 'string', 'input', 'kpi-project', 28, 'text'), col('area', 'columns.area', 'string', 'identifier', 'kpi-area', 22, 'text'), col('metric', 'columns.metric', 'string', 'input', 'kpi-metric', 30, 'text'), col('target', 'columns.target', 'number', 'input', null, 16, 'number'), col('actual', 'columns.actual', 'number', 'input', null, 16, 'number'), col('variance', 'columns.variance', 'formula', 'calculated', null, 16, 'number'), col('owner', 'columns.owner', 'string', 'input', 'kpi-owner', 22, 'text'), col('status', 'columns.status', 'string', 'input', 'kpi-status', 18, 'text')],
    [formula('kpi-variance', 'kpi-register', 'variance', 'ROW_DIFFERENCE', { leftColumnId: 'target', rightColumnId: 'actual' }, true)], [listSource('kpi-project', 'kpi-register', 'project', 'projects.name'), textRule('kpi-area', 'kpi-register', 'area'), textRule('kpi-metric', 'kpi-register', 'metric'), textRule('kpi-owner', 'kpi-register', 'owner'), projectWorkflowStatus('kpi-status', 'kpi-register')], 100, true, [], { premiumLayout: true, components: freeze(['KPI Dashboard', 'Risk Dashboard', 'Budget Dashboard', 'Resource Dashboard', 'Milestone Dashboard']) }),
  sheet('go-live-closure', 'sheets.goLiveClosure', 'input', startOrder + 13,
    [col('project', 'columns.project', 'string', 'input', 'closure-project', 28, 'text'), col('phase', 'columns.phase', 'string', 'identifier', 'closure-phase', 22, 'text'), col('task', 'columns.task', 'string', 'input', 'closure-task', 38, 'text'), col('owner', 'columns.owner', 'string', 'input', 'closure-owner', 22, 'text'), col('due-date', 'columns.dueDate', 'date', 'input', 'closure-due', 16, 'locale-date'), col('status', 'columns.status', 'string', 'input', 'closure-status', 18, 'text'), col('evidence', 'columns.evidence', 'string', 'input', null, 38, 'text')],
    [], [listSource('closure-project', 'go-live-closure', 'project', 'projects.name'), textRule('closure-phase', 'go-live-closure', 'phase'), textRule('closure-task', 'go-live-closure', 'task', 2, 500), textRule('closure-owner', 'go-live-closure', 'owner'), dateRule('closure-due', 'go-live-closure', 'due-date', 'configuration.year', false), projectWorkflowStatus('closure-status', 'go-live-closure')], 250, true, [], { premiumLayout: true, components: freeze(['Go-Live Checklist', 'Hypercare', 'Handover', 'Closure Checklist']) }),
  sheet('lessons-benefits', 'sheets.lessonsBenefits', 'input', startOrder + 14,
    [col('project', 'columns.project', 'string', 'input', 'benefit-project', 28, 'text'), col('artifact-type', 'columns.artifactType', 'string', 'identifier', 'benefit-type', 22, 'text'), col('statement', 'columns.statement', 'string', 'input', 'benefit-statement', 42, 'text'), col('owner', 'columns.owner', 'string', 'input', 'benefit-owner', 22, 'text'), col('target-date', 'columns.targetDate', 'date', 'input', 'benefit-date', 16, 'locale-date'), col('outcome', 'columns.outcome', 'string', 'input', null, 36, 'text'), col('status', 'columns.status', 'string', 'input', 'benefit-status', 18, 'text')],
    [], [listSource('benefit-project', 'lessons-benefits', 'project', 'projects.name'), textRule('benefit-type', 'lessons-benefits', 'artifact-type'), textRule('benefit-statement', 'lessons-benefits', 'statement', 2, 500), textRule('benefit-owner', 'lessons-benefits', 'owner'), dateRule('benefit-date', 'lessons-benefits', 'target-date', 'configuration.year', false), projectWorkflowStatus('benefit-status', 'lessons-benefits')], 250, true, [], { premiumLayout: true, components: freeze(['Lessons Learned', 'Benefits Review']) }),
];

const projectManagementSpreadsheet = releaseCandidate({
  id: 'project-management-spreadsheet',
  portfolioId: 'project-management-spreadsheet',
  tier: 'ultimate',
  productFamily: 'project-management',
  category: 'project-management',
  nameKey: 'products.projectManagementSpreadsheet.name',
  descriptionKey: 'products.projectManagementSpreadsheet.description',
  title: 'Project Management Spreadsheet',
  difficulty: 'advanced',
  tags: ['project-management', 'task-tracker', 'gantt-chart', 'kanban-board', 'risk-register'],
  features: ['project-register', 'task-register', 'gantt-timeline', 'kanban-status', 'risk-register', 'project-dashboard', 'project-initiation', 'stakeholder-management', 'resource-capacity', 'delivery-planning', 'requirements-traceability', 'quality-acceptance', 'change-control', 'closure-benefits', 'charts', 'instructions'],
  audience: ['project-managers', 'small-teams'],
  featureFlags: { projects: true, tasks: true, gantt: true, kanban: true, risks: true, initiation: true, stakeholders: true, resources: true, agilePlanning: true, changeControl: true, requirements: true, closure: true, charts: true },
  defaultThemeId: 'executive-navy',
  sheets: [
    sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [
      formula('project-budget-total', 'dashboard', 'total-planned', 'SUM', { range: freeze({ sheetId: 'projects', columnId: 'budgeted' }) }),
      formula('project-actual-total', 'dashboard', 'total-expenses', 'SUM', { range: freeze({ sheetId: 'projects', columnId: 'actual' }) }),
      formula('project-task-complete', 'dashboard', 'tasks-complete', 'COUNTIF', { range: freeze({ sheetId: 'tasks', columnId: 'status' }), criteria: localizedValue('values.status.complete', 'Complete') }, false, { numberFormat: 'integer' }),
      formula('project-risk-review', 'dashboard', 'risks-open', 'COUNTIF', { range: freeze({ sheetId: 'risk-register', columnId: 'status' }), criteria: localizedValue('values.status.review', 'Review') }, false, { numberFormat: 'integer' }),
      formula('project-active-count', 'dashboard', 'projects-active', 'COUNTIF', { range: freeze({ sheetId: 'projects', columnId: 'status' }), criteria: localizedValue('values.status.inProgress', 'In progress') }, false, { numberFormat: 'integer' }),
      formula('project-delivery-complete', 'dashboard', 'milestones-complete', 'COUNTIF', { range: freeze({ sheetId: 'delivery-plan', columnId: 'status' }), criteria: localizedValue('values.status.complete', 'Complete') }, false, { numberFormat: 'integer' }),
      formula('project-requirements-review', 'dashboard', 'requirements-open', 'COUNTIF', { range: freeze({ sheetId: 'requirements-traceability', columnId: 'status' }), criteria: localizedValue('values.status.review', 'Review') }, false, { numberFormat: 'integer' }),
    ], [], 0, false, [], { premiumLayout: true }),
    sheet('projects', 'sheets.projects', 'input', 2,
      [col('name', 'columns.project', 'string', 'identifier', 'project-name', 30, 'text'), col('owner', 'columns.owner', 'string', 'input', 'project-owner', 22, 'text'), col('start-date', 'columns.startDate', 'date', 'input', 'project-start', 16, 'locale-date'), col('end-date', 'columns.endDate', 'date', 'input', 'project-end', 16, 'locale-date'), col('budgeted', 'columns.budgeted', 'currency', 'input', 'project-budget', 16, 'currency'), col('actual', 'columns.actual', 'currency', 'input', 'project-actual', 16, 'currency'), col('variance', 'columns.variance', 'formula', 'calculated', null, 16, 'currency'), col('status', 'columns.status', 'string', 'input', 'project-status', 18, 'text')],
      [formula('project-variance', 'projects', 'variance', 'ROW_DIFFERENCE', { leftColumnId: 'budgeted', rightColumnId: 'actual' }, true)],
      [textRule('project-name', 'projects', 'name'), textRule('project-owner', 'projects', 'owner'), dateRule('project-start', 'projects', 'start-date'), dateRule('project-end', 'projects', 'end-date'), decimalMin('project-budget', 'projects', 'budgeted', 0, false), decimalMin('project-actual', 'projects', 'actual', 0, false), localizedListValues('project-status', 'projects', 'status', ['values.status.scheduled', 'values.status.inProgress', 'values.status.review', 'values.status.complete', 'values.status.paused'])],
      100, true,
      [
        { name: localizedValue('sample.project.launch', 'Product launch'), owner: localizedValue('sample.owner.alex', 'Alex'), 'start-date': '2026-01-05', 'end-date': '2026-03-31', budgeted: 12000, actual: 7350, status: localizedValue('values.status.inProgress', 'In progress') },
        { name: localizedValue('sample.project.operations', 'Operations refresh'), owner: localizedValue('sample.owner.jordan', 'Jordan'), 'start-date': '2026-02-01', 'end-date': '2026-04-30', budgeted: 8000, actual: 2900, status: localizedValue('values.status.review', 'Review') },
      ]),
    sheet('tasks', 'sheets.tasks', 'input', 3,
      [col('project', 'columns.project', 'string', 'input', 'task-project', 28, 'text'), col('task', 'columns.task', 'string', 'input', 'task-name', 34, 'text'), col('owner', 'columns.owner', 'string', 'input', 'task-owner', 22, 'text'), col('priority', 'columns.priority', 'string', 'input', 'task-priority', 16, 'text'), col('start-date', 'columns.startDate', 'date', 'input', 'task-start', 16, 'locale-date'), col('end-date', 'columns.endDate', 'date', 'input', 'task-end', 16, 'locale-date'), col('status', 'columns.status', 'string', 'input', 'task-status', 18, 'text'), col('progress', 'columns.progress', 'percentage', 'input', 'task-progress', 14, 'percentage')],
      [],
      [listSource('task-project', 'tasks', 'project', 'projects.name'), textRule('task-name', 'tasks', 'task'), textRule('task-owner', 'tasks', 'owner'), localizedListValues('task-priority', 'tasks', 'priority', ['values.priority.low', 'values.priority.medium', 'values.priority.high', 'values.priority.critical']), dateRule('task-start', 'tasks', 'start-date'), dateRule('task-end', 'tasks', 'end-date'), localizedListValues('task-status', 'tasks', 'status', ['values.status.scheduled', 'values.status.inProgress', 'values.status.review', 'values.status.complete', 'values.status.paused']), decimalRange('task-progress', 'tasks', 'progress', 0, 1, false)],
      500, true,
      [
        { project: localizedValue('sample.project.launch', 'Product launch'), task: localizedValue('sample.task.brief', 'Approve project brief'), owner: localizedValue('sample.owner.alex', 'Alex'), priority: localizedValue('values.priority.high', 'High'), 'start-date': '2026-01-05', 'end-date': '2026-01-12', status: localizedValue('values.status.complete', 'Complete'), progress: 1 },
        { project: localizedValue('sample.project.launch', 'Product launch'), task: localizedValue('sample.task.assets', 'Prepare launch assets'), owner: localizedValue('sample.owner.jordan', 'Jordan'), priority: localizedValue('values.priority.medium', 'Medium'), 'start-date': '2026-01-13', 'end-date': '2026-02-20', status: localizedValue('values.status.inProgress', 'In progress'), progress: 0.55 },
      ]),
    sheet('timeline', 'sheets.timeline', 'report', 4,
      [col('project', 'columns.project', 'string', 'display', null, 28, 'text'), col('task', 'columns.task', 'string', 'display', null, 34, 'text'), col('start-date', 'columns.startDate', 'date', 'display', null, 16, 'locale-date'), col('end-date', 'columns.endDate', 'date', 'display', null, 16, 'locale-date'), col('status', 'columns.status', 'string', 'display', null, 18, 'text'), col('progress', 'columns.progress', 'percentage', 'display', null, 14, 'percentage')],
      [], [], 100, true,
      [
        { project: localizedValue('sample.project.launch', 'Product launch'), task: localizedValue('sample.task.brief', 'Approve project brief'), 'start-date': '2026-01-05', 'end-date': '2026-01-12', status: localizedValue('values.status.complete', 'Complete'), progress: 1 },
        { project: localizedValue('sample.project.launch', 'Product launch'), task: localizedValue('sample.task.assets', 'Prepare launch assets'), 'start-date': '2026-01-13', 'end-date': '2026-02-20', status: localizedValue('values.status.inProgress', 'In progress'), progress: 0.55 },
      ], { ganttView: true, premiumLayout: true }),
    sheet('risk-register', 'sheets.riskRegister', 'input', 5,
      [col('project', 'columns.project', 'string', 'input', 'risk-project', 28, 'text'), col('risk', 'columns.risk', 'string', 'input', 'risk-name', 34, 'text'), col('probability', 'columns.probability', 'percentage', 'input', 'risk-probability', 16, 'percentage'), col('impact', 'columns.impact', 'string', 'input', 'risk-impact', 16, 'text'), col('owner', 'columns.owner', 'string', 'input', 'risk-owner', 22, 'text'), col('mitigation', 'columns.mitigation', 'string', 'input', null, 42, 'text'), col('status', 'columns.status', 'string', 'input', 'risk-status', 18, 'text')],
      [],
      [listSource('risk-project', 'risk-register', 'project', 'projects.name'), textRule('risk-name', 'risk-register', 'risk'), decimalRange('risk-probability', 'risk-register', 'probability', 0, 1, false), localizedListValues('risk-impact', 'risk-register', 'impact', ['values.priority.low', 'values.priority.medium', 'values.priority.high', 'values.priority.critical']), textRule('risk-owner', 'risk-register', 'owner'), localizedListValues('risk-status', 'risk-register', 'status', ['values.status.review', 'values.status.inProgress', 'values.status.complete'])],
      100, true,
      [{ project: localizedValue('sample.project.launch', 'Product launch'), risk: localizedValue('sample.risk.delay', 'Approval delay'), probability: 0.35, impact: localizedValue('values.priority.high', 'High'), owner: localizedValue('sample.owner.alex', 'Alex'), mitigation: localizedValue('sample.risk.delayMitigation', 'Pre-book review slots'), status: localizedValue('values.status.review', 'Review') }]),
    ...projectManagementCompletionSheets(6),
    sheet('status-summary', 'sheets.statusSummary', 'report', 21,
      [col('status', 'columns.status', 'string', 'display', null, 20, 'text'), col('count', 'columns.count', 'formula', 'calculated', null, 14, 'integer')],
      [formula('task-status-count', 'status-summary', 'count', 'COUNTIF', { range: freeze({ sheetId: 'tasks', columnId: 'status' }), criteria: freeze({ columnId: 'status' }) }, true, { numberFormat: 'integer' })],
      [], 4, true,
      [{ status: localizedValue('values.status.scheduled', 'Scheduled') }, { status: localizedValue('values.status.inProgress', 'In progress') }, { status: localizedValue('values.status.review', 'Review') }, { status: localizedValue('values.status.complete', 'Complete') }],
      { kanbanView: true, premiumLayout: true }),
    premiumInstructionsSheet(22),
  ],
  moduleIds: ['dashboard', 'project-register', 'task-register', 'timeline', 'risk-register', 'project-initiation', 'stakeholder-register', 'raci-matrix', 'communications', 'delivery-plan', 'resource-capacity', 'agile-planning', 'raid-log', 'decisions-changes', 'requirements-traceability', 'quality-acceptance', 'status-reports', 'kpi-register', 'go-live-closure', 'lessons-benefits', 'kanban-status', 'instructions'],
});

const businessCategoriesSheet = order => sheet('categories', 'sheets.categories', 'lookup', order,
  [col('category', 'columns.category', 'string', 'identifier', null, 26, 'text'), col('type', 'columns.type', 'string', 'input', 'business-category-type', 18, 'text')],
  [],
  [localizedListValues('business-category-type', 'categories', 'type', ['values.transactionType.income', 'values.transactionType.expense'])],
  40, true,
  [
    { category: localizedValue('sample.business.sales', 'Sales'), type: localizedValue('values.transactionType.income', 'Income') },
    { category: localizedValue('sample.business.services', 'Services'), type: localizedValue('values.transactionType.income', 'Income') },
    { category: localizedValue('sample.business.software', 'Software'), type: localizedValue('values.transactionType.expense', 'Expense') },
    { category: localizedValue('sample.business.marketing', 'Marketing'), type: localizedValue('values.transactionType.expense', 'Expense') },
  ]);

const smallBusinessBookkeeping = releaseCandidate({
  id: 'small-business-bookkeeping',
  portfolioId: 'small-business-bookkeeping',
  tier: 'professional',
  productFamily: 'small-business',
  category: 'small-business',
  nameKey: 'products.smallBusinessBookkeeping.name',
  descriptionKey: 'products.smallBusinessBookkeeping.description',
  title: 'Small Business Bookkeeping Spreadsheet',
  difficulty: 'intermediate',
  tags: ['small-business', 'bookkeeping', 'income-expense', 'profit-loss', 'invoice-tracker'],
  features: ['professional-dashboard', 'central-transactions', 'income-analysis', 'invoice-tracker', 'payment-tracker', 'profit-loss-report', 'charts', 'instructions'],
  audience: ['small-business-owners', 'freelancers'],
  featureFlags: { transactions: true, invoices: true, payments: true, profitLoss: true, customers: true },
  defaultThemeId: 'executive-navy',
  sheets: [
    sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [
      formula('business-income-total', 'dashboard', 'total-income', 'SUMIF', { sumRange: freeze({ sheetId: 'transactions', columnId: 'amount' }), criteriaRange: freeze({ sheetId: 'transactions', columnId: 'type' }), criteria: localizedValue('values.transactionType.income', 'Income') }),
      formula('business-expense-total', 'dashboard', 'total-expenses', 'SUMIF', { sumRange: freeze({ sheetId: 'transactions', columnId: 'amount' }), criteriaRange: freeze({ sheetId: 'transactions', columnId: 'type' }), criteria: localizedValue('values.transactionType.expense', 'Expense') }),
      formula('business-profit-total', 'dashboard', 'profit', 'SUBTRACT', { minuend: freeze({ formulaId: 'business-income-total' }), subtrahend: freeze({ formulaId: 'business-expense-total' }) }),
      formula('business-invoice-balance', 'dashboard', 'invoice-balance', 'SUM', { range: freeze({ sheetId: 'invoices', columnId: 'balance' }) }),
    ], [], 0, false, [], { premiumLayout: true }),
    sheet('transactions', 'sheets.transactions', 'input', 2,
      [col('date', 'columns.date', 'date', 'input', 'business-transaction-date', 16, 'locale-date'), col('type', 'columns.transactionType', 'string', 'input', 'business-transaction-type', 18, 'text'), col('category', 'columns.category', 'string', 'input', 'business-transaction-category', 22, 'text'), col('description', 'columns.description', 'string', 'input', null, 32, 'text'), col('customer', 'columns.customer', 'string', 'input', null, 24, 'text'), col('invoice', 'columns.invoice', 'string', 'input', null, 18, 'text'), col('amount', 'columns.amount', 'currency', 'input', 'business-transaction-amount', 16, 'currency')],
      [],
      [dateRule('business-transaction-date', 'transactions', 'date'), localizedListValues('business-transaction-type', 'transactions', 'type', ['values.transactionType.income', 'values.transactionType.expense']), listSource('business-transaction-category', 'transactions', 'category', 'categories.category'), decimalMin('business-transaction-amount', 'transactions', 'amount', 0, false)],
      500, true,
      [
        { date: '2026-01-15', type: localizedValue('values.transactionType.income', 'Income'), category: localizedValue('sample.business.services', 'Services'), description: localizedValue('sample.business.consulting', 'Consulting project'), customer: localizedValue('sample.business.client', 'Northstar Studio'), invoice: 'INV-1001', amount: 3200 },
        { date: '2026-01-20', type: localizedValue('values.transactionType.expense', 'Expense'), category: localizedValue('sample.business.software', 'Software'), description: localizedValue('sample.business.softwarePlan', 'Software subscription'), amount: 89 },
      ]),
    sheet('customers', 'sheets.customers', 'input', 3,
      [col('customer', 'columns.customer', 'string', 'identifier', 'customer-name', 28, 'text'), col('email', 'columns.email', 'string', 'input', null, 32, 'text'), col('phone', 'columns.phone', 'string', 'input', null, 20, 'text'), col('status', 'columns.status', 'string', 'input', 'customer-status', 18, 'text'), col('note', 'columns.note', 'string', 'input', null, 38, 'text')],
      [], [textRule('customer-name', 'customers', 'customer'), localizedListValues('customer-status', 'customers', 'status', ['values.status.active', 'values.status.paused'])], 250, true,
      [{ customer: localizedValue('sample.business.client', 'Northstar Studio'), email: 'accounts@example.test', phone: '+1 202 555 0147', status: localizedValue('values.status.active', 'Active'), note: localizedValue('sample.business.clientNote', 'Monthly service client') }]),
    sheet('invoices', 'sheets.invoices', 'input', 4,
      [col('invoice', 'columns.invoice', 'string', 'identifier', 'invoice-id', 18, 'text'), col('customer', 'columns.customer', 'string', 'input', 'invoice-customer', 28, 'text'), col('date', 'columns.date', 'date', 'input', 'invoice-date', 16, 'locale-date'), col('due-date', 'columns.dueDate', 'date', 'input', 'invoice-due', 16, 'locale-date'), col('amount', 'columns.amount', 'currency', 'input', 'invoice-amount', 16, 'currency'), col('amount-paid', 'columns.amountPaid', 'currency', 'input', 'invoice-paid', 16, 'currency'), col('balance', 'columns.balance', 'formula', 'calculated', null, 16, 'currency'), col('status', 'columns.status', 'string', 'input', 'invoice-status', 18, 'text')],
      [formula('invoice-balance-row', 'invoices', 'balance', 'ROW_DIFFERENCE', { leftColumnId: 'amount', rightColumnId: 'amount-paid' }, true)],
      [textRule('invoice-id', 'invoices', 'invoice'), listSource('invoice-customer', 'invoices', 'customer', 'customers.customer'), dateRule('invoice-date', 'invoices', 'date'), dateRule('invoice-due', 'invoices', 'due-date'), decimalMin('invoice-amount', 'invoices', 'amount', 0, false), decimalMin('invoice-paid', 'invoices', 'amount-paid', 0, false), localizedListValues('invoice-status', 'invoices', 'status', ['values.status.scheduled', 'values.status.paid', 'values.status.overdue'])],
      250, true,
      [{ invoice: 'INV-1001', customer: localizedValue('sample.business.client', 'Northstar Studio'), date: '2026-01-15', 'due-date': '2026-02-14', amount: 3200, 'amount-paid': 1600, status: localizedValue('values.status.scheduled', 'Scheduled') }]),
    sheet('payments', 'sheets.payments', 'input', 5,
      [col('date', 'columns.date', 'date', 'input', 'payment-date', 16, 'locale-date'), col('invoice', 'columns.invoice', 'string', 'input', 'payment-invoice', 18, 'text'), col('customer', 'columns.customer', 'string', 'input', 'payment-customer', 28, 'text'), col('amount', 'columns.amount', 'currency', 'input', 'payment-amount', 16, 'currency'), col('payment-method', 'columns.paymentMethod', 'string', 'input', 'payment-method', 20, 'text')],
      [], [dateRule('payment-date', 'payments', 'date'), listSource('payment-invoice', 'payments', 'invoice', 'invoices.invoice'), listSource('payment-customer', 'payments', 'customer', 'customers.customer'), decimalMin('payment-amount', 'payments', 'amount', 0.01), localizedListValues('payment-method', 'payments', 'payment-method', ['values.paymentMethod.bankTransfer', 'values.paymentMethod.card', 'values.paymentMethod.cash'])], 250, true,
      [{ date: '2026-01-30', invoice: 'INV-1001', customer: localizedValue('sample.business.client', 'Northstar Studio'), amount: 1600, 'payment-method': localizedValue('values.paymentMethod.bankTransfer', 'Bank transfer') }]),
    sheet('profit-loss', 'sheets.profitLoss', 'dashboard', 6, dashboardColumns(), [
      formula('profit-loss-income', 'profit-loss', 'total-income', 'SUMIF', { sumRange: freeze({ sheetId: 'transactions', columnId: 'amount' }), criteriaRange: freeze({ sheetId: 'transactions', columnId: 'type' }), criteria: localizedValue('values.transactionType.income', 'Income') }),
      formula('profit-loss-expenses', 'profit-loss', 'total-expenses', 'SUMIF', { sumRange: freeze({ sheetId: 'transactions', columnId: 'amount' }), criteriaRange: freeze({ sheetId: 'transactions', columnId: 'type' }), criteria: localizedValue('values.transactionType.expense', 'Expense') }),
      formula('profit-loss-net', 'profit-loss', 'profit', 'SUBTRACT', { minuend: freeze({ formulaId: 'profit-loss-income' }), subtrahend: freeze({ formulaId: 'profit-loss-expenses' }) }),
    ], [], 0, false, [], { premiumLayout: true, disclaimerKey: 'commercial.noFinancialAdvice' }),
    businessCategoriesSheet(7),
    premiumInstructionsSheet(8),
  ],
  moduleIds: ['dashboard', 'transactions', 'customers', 'invoices', 'payments', 'profit-loss', 'categories', 'instructions'],
});

const weddingPlannerReleaseCandidate = releaseCandidate({
  id: 'wedding-planner-release-candidate',
  portfolioId: 'wedding-planning-spreadsheet',
  tier: 'ultimate',
  productFamily: 'wedding-planning',
  category: 'wedding-planning',
  nameKey: 'products.weddingPlanner.name',
  descriptionKey: 'products.weddingPlanner.description',
  title: 'Wedding Planning Spreadsheet',
  difficulty: 'advanced',
  tags: ['wedding-planner', 'wedding-budget', 'guest-list', 'rsvp-tracker', 'vendor-tracker'],
  features: ['wedding-dashboard', 'wedding-budget', 'guest-rsvp', 'vendor-comparison', 'payment-schedule', 'wedding-timeline', 'wedding-checklist', 'seating-plan', 'instructions'],
  audience: ['engaged-couples', 'wedding-planners'],
  featureFlags: { budget: true, guests: true, vendors: true, payments: true, timeline: true, checklist: true, seating: true },
  defaultThemeId: 'warm-neutral',
  supportedAppearances: ['light'],
  evidenceStatus: 'MARKET_VALIDATION_REQUIRED',
  sheets: [
    sheet('dashboard', 'sheets.dashboard', 'dashboard', 1, dashboardColumns(), [
      formula('wedding-budget-total', 'dashboard', 'total-planned', 'SUM', { range: freeze({ sheetId: 'wedding-budget', columnId: 'budgeted' }) }),
      formula('wedding-actual-total', 'dashboard', 'total-expenses', 'SUM', { range: freeze({ sheetId: 'wedding-budget', columnId: 'actual' }) }),
      formula('wedding-remaining-total', 'dashboard', 'remaining-budget', 'SUBTRACT', { minuend: freeze({ formulaId: 'wedding-budget-total' }), subtrahend: freeze({ formulaId: 'wedding-actual-total' }) }),
      formula('wedding-guest-count', 'dashboard', 'guest-count', 'SUM', { range: freeze({ sheetId: 'guests', columnId: 'party-size' }) }, false, { numberFormat: 'integer' }),
      formula('wedding-rsvp-count', 'dashboard', 'rsvp-count', 'COUNTIF', { range: freeze({ sheetId: 'guests', columnId: 'rsvp' }), criteria: localizedValue('values.rsvp.accepted', 'Accepted') }, false, { numberFormat: 'integer' }),
      formula('wedding-vendor-balance', 'dashboard', 'vendor-balance', 'SUM', { range: freeze({ sheetId: 'vendors', columnId: 'balance' }) }),
    ], [], 0, false, [], { premiumLayout: true, niche: 'wedding' }),
    sheet('wedding-budget', 'sheets.weddingBudget', 'input', 2,
      [col('category', 'columns.category', 'string', 'identifier', null, 24, 'text'), col('description', 'columns.description', 'string', 'input', null, 32, 'text'), col('budgeted', 'columns.budgeted', 'currency', 'input', 'wedding-budgeted', 16, 'currency'), col('actual', 'columns.actual', 'currency', 'input', 'wedding-actual', 16, 'currency'), col('remaining', 'columns.remaining', 'formula', 'calculated', null, 16, 'currency'), col('status', 'columns.status', 'formula', 'calculated', null, 18, 'text')],
      [
        formula('wedding-budget-remaining', 'wedding-budget', 'remaining', 'ROW_DIFFERENCE', { leftColumnId: 'budgeted', rightColumnId: 'actual' }, true),
        formula('wedding-budget-status', 'wedding-budget', 'status', 'IF', { condition: freeze({ left: freeze({ columnId: 'actual' }), operator: 'LESS_THAN_OR_EQUAL', right: freeze({ columnId: 'budgeted' }) }), whenTrue: localizedValue('values.status.onBudget', 'On budget'), whenFalse: localizedValue('values.status.overBudget', 'Over budget') }, true),
      ],
      [decimalMin('wedding-budgeted', 'wedding-budget', 'budgeted', 0, false), decimalMin('wedding-actual', 'wedding-budget', 'actual', 0, false)],
      100, true,
      [
        { category: localizedValue('sample.wedding.venue', 'Venue'), description: localizedValue('sample.wedding.venueHire', 'Venue hire'), budgeted: 6500, actual: 6200 },
        { category: localizedValue('sample.wedding.catering', 'Catering'), description: localizedValue('sample.wedding.dinner', 'Dinner service'), budgeted: 4800, actual: 4550 },
        { category: localizedValue('sample.wedding.photography', 'Photography'), description: localizedValue('sample.wedding.photoPackage', 'Photography package'), budgeted: 2200, actual: 2200 },
      ], { premiumLayout: true, niche: 'wedding' }),
    sheet('guests', 'sheets.guests', 'input', 3,
      [col('guest', 'columns.guest', 'string', 'identifier', 'guest-name', 28, 'text'), col('party-size', 'columns.partySize', 'integer', 'input', 'guest-party', 14, 'integer'), col('rsvp', 'columns.rsvp', 'string', 'input', 'guest-rsvp', 16, 'text'), col('meal', 'columns.meal', 'string', 'input', 'guest-meal', 20, 'text'), col('table', 'columns.table', 'integer', 'input', 'guest-table', 12, 'integer'), col('note', 'columns.note', 'string', 'input', null, 36, 'text')],
      [],
      [textRule('guest-name', 'guests', 'guest'), decimalRange('guest-party', 'guests', 'party-size', 1, 20), localizedListValues('guest-rsvp', 'guests', 'rsvp', ['values.rsvp.pending', 'values.rsvp.accepted', 'values.rsvp.declined']), localizedListValues('guest-meal', 'guests', 'meal', ['values.meal.standard', 'values.meal.vegetarian', 'values.meal.vegan', 'values.meal.children']), decimalRange('guest-table', 'guests', 'table', 1, 200, false)],
      500, true,
      [
        { guest: localizedValue('sample.wedding.guestOne', 'Taylor Morgan'), 'party-size': 2, rsvp: localizedValue('values.rsvp.accepted', 'Accepted'), meal: localizedValue('values.meal.vegetarian', 'Vegetarian'), table: 4 },
        { guest: localizedValue('sample.wedding.guestTwo', 'Casey Rivera'), 'party-size': 1, rsvp: localizedValue('values.rsvp.pending', 'Pending'), meal: localizedValue('values.meal.standard', 'Standard'), table: 5 },
      ]),
    sheet('vendors', 'sheets.vendors', 'input', 4,
      [col('category', 'columns.category', 'string', 'input', 'vendor-category', 22, 'text'), col('vendor', 'columns.vendor', 'string', 'identifier', 'vendor-name', 28, 'text'), col('contact', 'columns.contact', 'string', 'input', null, 30, 'text'), col('quoted', 'columns.quoted', 'currency', 'input', 'vendor-quoted', 16, 'currency'), col('amount-paid', 'columns.amountPaid', 'currency', 'input', 'vendor-paid', 16, 'currency'), col('balance', 'columns.balance', 'formula', 'calculated', null, 16, 'currency'), col('status', 'columns.status', 'string', 'input', 'vendor-status', 18, 'text')],
      [formula('vendor-balance-row', 'vendors', 'balance', 'ROW_DIFFERENCE', { leftColumnId: 'quoted', rightColumnId: 'amount-paid' }, true)],
      [localizedListValues('vendor-category', 'vendors', 'category', ['sample.wedding.venue', 'sample.wedding.catering', 'sample.wedding.photography', 'sample.wedding.music', 'sample.wedding.flowers']), textRule('vendor-name', 'vendors', 'vendor'), decimalMin('vendor-quoted', 'vendors', 'quoted', 0, false), decimalMin('vendor-paid', 'vendors', 'amount-paid', 0, false), localizedListValues('vendor-status', 'vendors', 'status', ['values.status.review', 'values.status.scheduled', 'values.status.paid'])],
      250, true,
      [{ category: localizedValue('sample.wedding.photography', 'Photography'), vendor: localizedValue('sample.wedding.vendorPhoto', 'Golden Hour Studio'), contact: 'hello@example.test', quoted: 2200, 'amount-paid': 1100, status: localizedValue('values.status.scheduled', 'Scheduled') }]),
    sheet('payments', 'sheets.payments', 'input', 5,
      [col('date', 'columns.dueDate', 'date', 'input', 'wedding-payment-date', 16, 'locale-date'), col('vendor', 'columns.vendor', 'string', 'input', 'wedding-payment-vendor', 28, 'text'), col('amount', 'columns.amount', 'currency', 'input', 'wedding-payment-amount', 16, 'currency'), col('status', 'columns.status', 'string', 'input', 'wedding-payment-status', 18, 'text'), col('note', 'columns.note', 'string', 'input', null, 36, 'text')],
      [], [dateRule('wedding-payment-date', 'payments', 'date'), listSource('wedding-payment-vendor', 'payments', 'vendor', 'vendors.vendor'), decimalMin('wedding-payment-amount', 'payments', 'amount', 0.01), localizedListValues('wedding-payment-status', 'payments', 'status', ['values.status.scheduled', 'values.status.paid', 'values.status.overdue'])], 250, true,
      [{ date: '2026-02-15', vendor: localizedValue('sample.wedding.vendorPhoto', 'Golden Hour Studio'), amount: 1100, status: localizedValue('values.status.scheduled', 'Scheduled'), note: localizedValue('sample.wedding.deposit', 'Final deposit') }]),
    sheet('timeline', 'sheets.timeline', 'input', 6,
      [col('task', 'columns.task', 'string', 'input', 'wedding-timeline-task', 34, 'text'), col('start-date', 'columns.startDate', 'date', 'input', 'wedding-timeline-start', 16, 'locale-date'), col('end-date', 'columns.endDate', 'date', 'input', 'wedding-timeline-end', 16, 'locale-date'), col('owner', 'columns.owner', 'string', 'input', 'wedding-timeline-owner', 22, 'text'), col('status', 'columns.status', 'string', 'input', 'wedding-timeline-status', 18, 'text')],
      [], [textRule('wedding-timeline-task', 'timeline', 'task'), dateRule('wedding-timeline-start', 'timeline', 'start-date'), dateRule('wedding-timeline-end', 'timeline', 'end-date'), textRule('wedding-timeline-owner', 'timeline', 'owner'), localizedListValues('wedding-timeline-status', 'timeline', 'status', ['values.status.scheduled', 'values.status.inProgress', 'values.status.complete'])], 250, true,
      [{ task: localizedValue('sample.wedding.taskVenue', 'Confirm venue contract'), 'start-date': '2026-01-05', 'end-date': '2026-01-15', owner: localizedValue('sample.owner.alex', 'Alex'), status: localizedValue('values.status.complete', 'Complete') }]),
    sheet('checklist', 'sheets.checklist', 'input', 7,
      [col('task', 'columns.task', 'string', 'input', 'wedding-check-task', 36, 'text'), col('priority', 'columns.priority', 'string', 'input', 'wedding-check-priority', 16, 'text'), col('due-date', 'columns.dueDate', 'date', 'input', 'wedding-check-date', 16, 'locale-date'), col('owner', 'columns.owner', 'string', 'input', 'wedding-check-owner', 22, 'text'), col('status', 'columns.status', 'string', 'input', 'wedding-check-status', 18, 'text')],
      [], [textRule('wedding-check-task', 'checklist', 'task'), localizedListValues('wedding-check-priority', 'checklist', 'priority', ['values.priority.low', 'values.priority.medium', 'values.priority.high']), dateRule('wedding-check-date', 'checklist', 'due-date'), textRule('wedding-check-owner', 'checklist', 'owner'), localizedListValues('wedding-check-status', 'checklist', 'status', ['values.status.scheduled', 'values.status.inProgress', 'values.status.complete'])], 250, true,
      [{ task: localizedValue('sample.wedding.taskGuests', 'Finalize guest list'), priority: localizedValue('values.priority.high', 'High'), 'due-date': '2026-03-01', owner: localizedValue('sample.owner.jordan', 'Jordan'), status: localizedValue('values.status.inProgress', 'In progress') }]),
    sheet('seating-plan', 'sheets.seatingPlan', 'input', 8,
      [col('table', 'columns.table', 'integer', 'input', 'seating-table', 12, 'integer'), col('guest', 'columns.guest', 'string', 'input', 'seating-guest', 28, 'text'), col('meal', 'columns.meal', 'string', 'input', 'seating-meal', 20, 'text'), col('note', 'columns.note', 'string', 'input', null, 42, 'text')],
      [], [decimalRange('seating-table', 'seating-plan', 'table', 1, 200), listSource('seating-guest', 'seating-plan', 'guest', 'guests.guest'), localizedListValues('seating-meal', 'seating-plan', 'meal', ['values.meal.standard', 'values.meal.vegetarian', 'values.meal.vegan', 'values.meal.children'])], 500, true,
      [{ table: 4, guest: localizedValue('sample.wedding.guestOne', 'Taylor Morgan'), meal: localizedValue('values.meal.vegetarian', 'Vegetarian'), note: localizedValue('sample.wedding.accessibility', 'Near accessible route') }]),
    premiumInstructionsSheet(9),
  ],
  moduleIds: ['dashboard', 'wedding-budget', 'guests', 'vendors', 'payments', 'timeline', 'checklist', 'seating-plan', 'instructions'],
  extensions: { nicheTheme: 'warm-professional', broadVariantGenerationBlocked: true },
});

export const releaseCandidateProductDefinitions = freeze([
  annualBudgetSpreadsheet,
  paycheckBudgetPlanner,
  debtSavingsBundle,
  projectManagementSpreadsheet,
  smallBusinessBookkeeping,
  weddingPlannerReleaseCandidate,
]);

const enrichProductionDefinition = definition => {
  const samples = ACTIVE_SAMPLE_ROWS[definition.id] ?? {};
  const suppliedInstructions = definition.sheets.find(current => current.id === 'instructions');
  const sheets = definition.sheets
    .filter(current => current.id !== 'instructions')
    .map(current => {
      let columns = current.columns;
      let validations = current.validations;
      if (definition.id === 'debt-snowball-planner' && current.id === 'debts') {
        const [nameColumn, ...remainingColumns] = current.columns;
        columns = freeze([nameColumn, col('type', 'columns.type', 'string', 'input', 'debt-type', 20, 'text'), ...remainingColumns]);
        validations = freeze([...current.validations, listSource('debt-type', 'debts', 'type', 'debt-types.type')]);
      }
      return freeze({ ...current, columns, validations, sampleRows: samples[current.id] ?? current.sampleRows });
    });

  let nextOrder = Math.max(...sheets.map(current => current.order)) + 1;
  if (definition.id === 'budget-planner-basic') sheets.push(categoryAnalysisSheet(nextOrder++));
  if (definition.id === 'debt-snowball-planner') sheets.push(debtTypesSheet(nextOrder++));
  const hasProfessionalInstructions = suppliedInstructions?.sampleRows?.length > 0;
  sheets.push(hasProfessionalInstructions
    ? freeze({ ...suppliedInstructions, order: nextOrder })
    : instructionsSheet(nextOrder, definition));
  sheets.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id, 'en'));

  const frozenSheets = freeze(sheets);
  return freeze({
    ...definition,
    sheets: frozenSheets,
    formulas: freeze(frozenSheets.flatMap(current => current.formulas)),
    validations: freeze(frozenSheets.flatMap(current => current.validations)),
  });
};

export const productionProductDefinitions = freeze([budgetPlannerBasic, budgetPlannerProfessional, budgetPlannerUltimate, monthlyBudgetPlanner, debtSnowballPlanner, savingsGoalTracker, subscriptionTracker].map(enrichProductionDefinition));
export const betaProductDefinitions = freeze(betaSpecs.map(spec => define({ id: spec.id, version: '0.1.0', status: 'beta', productFamily: spec.family, category: spec.category, nameKey: spec.nameKey, descriptionKey: spec.descriptionKey, title: spec.title, difficulty: 'intermediate', tags: spec.tags, features: spec.features, recommended: false, audience: spec.audience, featureFlags: spec.flags, sheets: spec.sheets() })));
export { careerProductDefinitions };
export const productDefinitions = freeze([...productionProductDefinitions, ...releaseCandidateProductDefinitions, ...betaProductDefinitions, ...careerProductDefinitions]);
export const productDefinitionById = freeze(Object.fromEntries(productDefinitions.map(definition => [definition.id, definition])));
export const defaultVisibleProductDefinitions = freeze(productDefinitions.filter(definition => definition.status === 'active'));

export default productDefinitions;
