export class CategoryResolutionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CategoryResolutionError';
    this.code = code;
    this.details = details;
  }
}

function localizedText(value, translate) {
  if (value && typeof value === 'object' && !Array.isArray(value) && value.messageKey) {
    const translated = typeof translate === 'function' ? translate(value.messageKey, value.fallback ?? value.messageKey) : null;
    return String(translated && translated !== value.messageKey ? translated : value.fallback ?? value.messageKey).trim();
  }
  return String(value ?? '').trim();
}

function uniqueValues(values, locale) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase(locale);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function categorySheet(productDefinition) {
  return productDefinition.sheets?.find(sheet => sheet.id === 'categories') ?? null;
}

const MINIMUM_CATEGORY_COUNT = 10;

const CATEGORY_SEEDS = Object.freeze({
  'personal-budgeting': Object.freeze({
    en: Object.freeze(['Housing', 'Utilities', 'Groceries', 'Transport', 'Insurance', 'Healthcare', 'Debt payments', 'Savings', 'Personal care', 'Entertainment', 'Education', 'Miscellaneous']),
    nl: Object.freeze(['Wonen', 'Nutsvoorzieningen', 'Boodschappen', 'Vervoer', 'Verzekeringen', 'Gezondheid', 'Schuldaflossing', 'Sparen', 'Persoonlijke verzorging', 'Ontspanning', 'Onderwijs', 'Overig']),
  }),
  'personal-finance-os': Object.freeze({
    en: Object.freeze(['Income', 'Housing', 'Utilities', 'Groceries', 'Transport', 'Insurance', 'Healthcare', 'Debt payments', 'Savings', 'Investments', 'Personal', 'Miscellaneous']),
    nl: Object.freeze(['Inkomen', 'Wonen', 'Nutsvoorzieningen', 'Boodschappen', 'Vervoer', 'Verzekeringen', 'Gezondheid', 'Schuldaflossing', 'Sparen', 'Beleggen', 'Persoonlijk', 'Overig']),
  }),
  'debt-repayment': Object.freeze({
    en: Object.freeze(['Credit card', 'Personal loan', 'Student loan', 'Car finance', 'Mortgage', 'Medical debt', 'Tax debt', 'Buy now pay later', 'Family loan', 'Business debt', 'Overdraft', 'Other debt']),
    nl: Object.freeze(['Creditcard', 'Persoonlijke lening', 'Studieschuld', 'Autofinanciering', 'Hypotheek', 'Medische schuld', 'Belastingschuld', 'Achteraf betalen', 'Familielening', 'Zakelijke schuld', 'Roodstand', 'Overige schuld']),
  }),
  savings: Object.freeze({
    en: Object.freeze(['Emergency fund', 'Home', 'Travel', 'Education', 'Vehicle', 'Wedding', 'Retirement', 'Investments', 'Family', 'Technology', 'Health', 'Other goal']),
    nl: Object.freeze(['Noodbuffer', 'Woning', 'Reizen', 'Onderwijs', 'Voertuig', 'Bruiloft', 'Pensioen', 'Beleggen', 'Gezin', 'Technologie', 'Gezondheid', 'Overig doel']),
  }),
  'recurring-expenses': Object.freeze({
    en: Object.freeze(['Housing', 'Utilities', 'Insurance', 'Streaming', 'Software', 'Phone', 'Internet', 'Memberships', 'Healthcare', 'Transport', 'Education', 'Other subscription']),
    nl: Object.freeze(['Wonen', 'Nutsvoorzieningen', 'Verzekeringen', 'Streaming', 'Software', 'Telefoon', 'Internet', 'Lidmaatschappen', 'Gezondheid', 'Vervoer', 'Onderwijs', 'Overig abonnement']),
  }),
  'small-business': Object.freeze({
    en: Object.freeze(['Sales', 'Services', 'Cost of goods', 'Software', 'Marketing', 'Office', 'Travel', 'Professional services', 'Payroll', 'Taxes', 'Insurance', 'Banking fees']),
    nl: Object.freeze(['Verkoop', 'Diensten', 'Inkoopkosten', 'Software', 'Marketing', 'Kantoor', 'Reizen', 'Professionele diensten', 'Lonen', 'Belastingen', 'Verzekeringen', 'Bankkosten']),
  }),
  'project-management': Object.freeze({
    en: Object.freeze(['Planning', 'Design', 'Development', 'Testing', 'Launch', 'Operations', 'Marketing', 'Finance', 'Legal', 'Procurement', 'Risk', 'Stakeholders']),
    nl: Object.freeze(['Planning', 'Ontwerp', 'Ontwikkeling', 'Testen', 'Lancering', 'Uitvoering', 'Marketing', 'Financiën', 'Juridisch', 'Inkoop', 'Risico', 'Stakeholders']),
  }),
  'wedding-planning': Object.freeze({
    en: Object.freeze(['Venue', 'Catering', 'Photography', 'Videography', 'Music and DJ', 'Flowers and decor', 'Attire', 'Rings', 'Invitations and stationery', 'Transport', 'Accommodation', 'Cake and desserts']),
    nl: Object.freeze(['Locatie', 'Catering', 'Fotografie', 'Videografie', 'Muziek en DJ', 'Bloemen en decoratie', 'Kleding', 'Ringen', 'Uitnodigingen en drukwerk', 'Vervoer', 'Accommodatie', 'Taart en desserts']),
  }),
  'career-job-application': Object.freeze({
    en: Object.freeze(['CV and resume', 'Cover letter', 'Professional profile', 'Portfolio', 'Vacancy research', 'Application tracking', 'Networking', 'Interview preparation', 'References', 'Job offers', 'Onboarding', 'Follow-up']),
    nl: Object.freeze(['CV', 'Motivatiebrief', 'Professioneel profiel', 'Portfolio', 'Vacatureonderzoek', 'Sollicitaties volgen', 'Netwerken', 'Interviewvoorbereiding', 'Referenties', 'Baanaanbiedingen', 'Onboarding', 'Opvolging']),
  }),
});

function humanize(value) {
  return String(value ?? '').replaceAll('-', ' ').replace(/\b\p{L}/gu, letter => letter.toLocaleUpperCase('en-US'));
}

function semanticFallbacks(productDefinition, translate) {
  return [
    ...(productDefinition.features ?? []).map(value => localizedText({ messageKey: `features.${value}`, fallback: humanize(value) }, translate)),
    ...(productDefinition.tags ?? []).map(humanize),
    ...(productDefinition.sheets ?? []).filter(sheet => !['dashboard', 'instructions'].includes(sheet.id)).map(sheet => localizedText({ messageKey: sheet.nameKey, fallback: humanize(sheet.id) }, translate)),
    ...(productDefinition.documentTemplates ?? []).map(template => template.title),
  ];
}

function fallbackProfileId(productDefinition) {
  return `${productDefinition.productFamily ?? productDefinition.id}-categories-v1`;
}

export function resolveCategoryProfile({ productDefinition, locale, currency, tier = null, translate } = {}) {
  if (!productDefinition || typeof productDefinition !== 'object') {
    throw new CategoryResolutionError('CATEGORY_DEFINITION_MISSING', 'A product definition is required to resolve categories.');
  }
  const sheet = categorySheet(productDefinition);
  const profileId = productDefinition.extensions?.categoryProfileId ?? fallbackProfileId(productDefinition);
  if (!productDefinition.supportedLocales?.includes(locale)) {
    throw new CategoryResolutionError('CATEGORY_LOCALE_UNSUPPORTED', `Category profile ${profileId} does not support locale ${locale}.`, { profileId, locale });
  }
  if (!productDefinition.supportedCurrencies?.includes(currency)) {
    throw new CategoryResolutionError('CATEGORY_CURRENCY_UNSUPPORTED', `Category profile ${profileId} does not support currency ${currency}.`, { profileId, currency });
  }
  const definitionTier = productDefinition.extensions?.tier ?? null;
  if (tier !== null && definitionTier !== null && String(tier).toLocaleLowerCase('en-US') !== String(definitionTier).toLocaleLowerCase('en-US')) {
    throw new CategoryResolutionError('CATEGORY_TIER_MISMATCH', `Category profile ${profileId} belongs to tier ${definitionTier}, not ${tier}.`, { profileId, expected: definitionTier, actual: tier });
  }
  const categoryColumn = sheet?.columns?.find(column => column.id === 'category') ?? sheet?.columns?.[0] ?? null;
  if (sheet && !categoryColumn) {
    throw new CategoryResolutionError('CATEGORY_COLUMN_MISSING', `Category profile ${profileId} has no category column.`, { profileId, sheetId: sheet.id });
  }
  const familySeeds = CATEGORY_SEEDS[productDefinition.productFamily];
  const seedLanguage = String(locale).toLocaleLowerCase('en-US').startsWith('nl') ? 'nl' : 'en';
  const sheetCategories = sheet && categoryColumn
    ? (sheet.sampleRows ?? []).map(row => localizedText(row?.[categoryColumn.id], translate))
    : [];
  const available = uniqueValues([
    ...sheetCategories,
    ...(familySeeds?.[seedLanguage] ?? []),
    ...semanticFallbacks(productDefinition, translate),
  ], locale);
  if (available.length < MINIMUM_CATEGORY_COUNT) {
    throw new CategoryResolutionError('CATEGORY_PROFILE_INCOMPLETE', `Category profile ${profileId} resolved to ${available.length} categories; at least ${MINIMUM_CATEGORY_COUNT} are required.`, {
      profileId, locale, currency, minimum: MINIMUM_CATEGORY_COUNT, actual: available.length,
    });
  }
  const categories = available.slice(0, Math.max(MINIMUM_CATEGORY_COUNT, sheetCategories.length));
  return Object.freeze({
    schemaVersion: '1.0.0', profileId, productId: productDefinition.id, locale, currency,
    tier: definitionTier, required: true, currencyFiltered: false,
    categories: Object.freeze(categories), sourceSheetId: sheet?.id ?? null,
  });
}

export function resolveConfiguredCategoryRows({ productDefinition, configuration, translate } = {}) {
  const sheet = categorySheet(productDefinition);
  if (!sheet) return [];
  const categoryColumn = sheet.columns?.find(column => column.id === 'category') ?? sheet.columns?.[0];
  if (!categoryColumn) return [];
  const locale = configuration?.locale ?? 'en-US';
  const configured = uniqueValues(configuration?.categoryOverrides ?? [], locale);
  if (!configured.length) return [...(sheet.sampleRows ?? [])];
  const templates = new Map((sheet.sampleRows ?? []).map(row => [
    localizedText(row?.[categoryColumn.id], translate).toLocaleLowerCase(locale),
    row,
  ]));
  return configured.map(category => {
    const template = templates.get(category.toLocaleLowerCase(locale));
    return template ? { ...template, [categoryColumn.id]: category } : { [categoryColumn.id]: category };
  });
}

export { MINIMUM_CATEGORY_COUNT };
