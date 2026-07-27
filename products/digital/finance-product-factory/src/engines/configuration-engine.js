import { ALLOWED_CAPACITIES } from './validation-engine.js';
import { assertAllowedKeys, sanitizeFilename, sha256Hex, stableStringify } from './security.js';
import { resolveCategoryProfile } from './category-engine.js';

const CONFIG_KEYS = Object.freeze([
  'schemaVersion', 'productId', 'productVersion', 'locale', 'market', 'currency', 'year', 'themeId',
  'title', 'filename', 'inputCapacity', 'sampleDataEnabled', 'categoryOverrides', 'featureFlags',
  'branding', 'outputOptions', 'extensions',
]);

const PRODUCT_APPEARANCES = Object.freeze(['light', 'dark']);

function productVariantFilename(definition, locale, year, appearance) {
  const tier = definition.extensions?.tier ?? (definition.id === 'budget-planner-basic' ? 'basic' : null);
  if (!['basic', 'professional', 'ultimate'].includes(tier)) return null;
  return `${tier}-budget-planner-${locale}-${year}-${appearance}.xlsx`;
}

function outputTypes(definition) {
  return definition.outputTypes ?? ['xlsx', 'zip'];
}

export function normalizeConfiguration(definition, input = {}, now = new Date()) {
  assertAllowedKeys(input, CONFIG_KEYS, 'ProductConfiguration input');
  const defaults = definition.defaultConfiguration ?? {};
  const productName = definition.id.replaceAll('-', ' ');
  const locale = input.locale ?? defaults.locale ?? 'nl-NL';
  const year = Number(input.year ?? defaults.year ?? now.getFullYear());
  const inferredMarket = { 'nl-NL': 'NL', 'en-US': 'US', 'en-GB': 'GB', 'de-DE': 'DE', 'fr-FR': 'FR' }[locale] ?? 'NL';
  const title = String(input.title ?? defaults.title ?? productName).trim();
  const themeId = input.themeId ?? defaults.themeId ?? 'executive-navy';
  const defaultExtensions = defaults.extensions && typeof defaults.extensions === 'object' && !Array.isArray(defaults.extensions) ? defaults.extensions : {};
  const inputExtensions = input.extensions && typeof input.extensions === 'object' && !Array.isArray(input.extensions) ? input.extensions : {};
  const productAppearance = inputExtensions.productAppearance ?? defaultExtensions.productAppearance ?? 'light';
  if (!PRODUCT_APPEARANCES.includes(productAppearance)) throw new Error(`Unsupported workbook appearance ${productAppearance}.`);
  const variantFilename = productVariantFilename(definition, locale, year, productAppearance);
  const explicitFilename = input.filename && input.filename !== defaults.filename ? input.filename : null;
  const rawFilename = explicitFilename ?? variantFilename ?? defaults.filename ?? `${definition.id}-${locale}-${input.currency ?? defaults.currency ?? 'EUR'}-${themeId}`;
  const declaredOutputs = outputTypes(definition);
  const primaryExtension = declaredOutputs.includes('xlsx') ? 'xlsx' : declaredOutputs.includes('docx') ? 'docx' : 'xlsx';
  const filenameBase = String(rawFilename).replace(/\.(?:xlsx|docx)$/i, '');
  const outputOptions = {
    workbook: declaredOutputs.includes('xlsx'),
    package: true,
    customerDocs: true,
    listing: true,
    imageManifests: true,
    ...(defaults.outputOptions ?? {}),
    ...(input.outputOptions ?? {}),
  };
  if (definition.outputTypes?.includes('docx') || Object.hasOwn(defaults.outputOptions ?? {}, 'documents') || Object.hasOwn(input.outputOptions ?? {}, 'documents')) {
    outputOptions.documents = declaredOutputs.includes('docx');
  }
  const configuration = {
    schemaVersion: '1.0.0',
    productId: definition.id,
    productVersion: definition.version,
    locale,
    market: input.market ?? defaults.market ?? inferredMarket,
    currency: input.currency ?? defaults.currency ?? 'EUR',
    year,
    themeId,
    title: (title || productName).slice(0, 120),
    filename: `${sanitizeFilename(filenameBase)}.${primaryExtension}`,
    inputCapacity: Number(input.inputCapacity ?? defaults.inputCapacity ?? 100),
    sampleDataEnabled: Boolean(input.sampleDataEnabled ?? defaults.sampleDataEnabled ?? true),
    categoryOverrides: [...(input.categoryOverrides ?? defaults.categoryOverrides ?? [])].map(value => String(value).trim()).filter(Boolean),
    featureFlags: { ...(defaults.featureFlags ?? {}), ...(input.featureFlags ?? {}) },
    branding: { enabled: true, ...(defaults.branding ?? {}), ...(input.branding ?? {}) },
    outputOptions,
    extensions: {
      ...defaultExtensions,
      ...inputExtensions,
      productAppearance,
      paletteId: themeId,
    },
  };
  if (!ALLOWED_CAPACITIES.includes(configuration.inputCapacity)) throw new Error(`Unsupported input capacity ${configuration.inputCapacity}.`);
  return configuration;
}

function configurationSource(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value.configuration && typeof value.configuration === 'object' && !Array.isArray(value.configuration)
    ? value.configuration
    : value;
}

function mergeConfigurationSources(defaults, persisted, selections) {
  return {
    ...defaults,
    ...persisted,
    ...selections,
    featureFlags: { ...(defaults.featureFlags ?? {}), ...(persisted.featureFlags ?? {}), ...(selections.featureFlags ?? {}) },
    branding: { ...(defaults.branding ?? {}), ...(persisted.branding ?? {}), ...(selections.branding ?? {}) },
    outputOptions: { ...(defaults.outputOptions ?? {}), ...(persisted.outputOptions ?? {}), ...(selections.outputOptions ?? {}) },
    extensions: { ...(defaults.extensions ?? {}), ...(persisted.extensions ?? {}), ...(selections.extensions ?? {}) },
  };
}

function categorySelectionSource(selections, persisted, categories) {
  const explicit = selections.extensions?.categoryResolution?.source ?? persisted.extensions?.categoryResolution?.source;
  if (!categories.length) return 'AUTO';
  return explicit === 'AUTO' ? 'AUTO' : 'MANUAL';
}

export function resolveProductConfiguration({
  productDefinition,
  userSelections = {},
  persistedState = {},
  locale,
  currency,
  tier,
  theme,
  translate,
  now = new Date(),
} = {}) {
  if (!productDefinition || typeof productDefinition !== 'object') throw new TypeError('productDefinition is required.');
  const defaults = configurationSource(productDefinition.defaultConfiguration);
  const persisted = configurationSource(persistedState);
  const selections = configurationSource(userSelections);
  const merged = mergeConfigurationSources(defaults, persisted, selections);
  merged.locale = locale ?? merged.locale;
  merged.currency = currency ?? merged.currency;
  merged.themeId = typeof theme === 'string' ? theme : theme?.id ?? merged.themeId;

  const requestedCategories = [...(selections.categoryOverrides ?? persisted.categoryOverrides ?? defaults.categoryOverrides ?? [])]
    .map(value => String(value).trim())
    .filter(Boolean);
  const source = categorySelectionSource(selections, persisted, requestedCategories);
  const profile = resolveCategoryProfile({
    productDefinition,
    locale: merged.locale,
    currency: merged.currency,
    tier: tier ?? productDefinition.extensions?.tier ?? null,
    translate,
  });
  const resolvedCategories = source === 'MANUAL' || !profile.required ? requestedCategories : [...profile.categories];
  merged.categoryOverrides = resolvedCategories;
  merged.extensions = {
    ...merged.extensions,
    categoryResolution: {
      schemaVersion: '1.0.0',
      profileId: profile.profileId,
      source: profile.required ? source : (resolvedCategories.length ? 'MANUAL' : 'NONE'),
      locale: merged.locale,
      currency: merged.currency,
      tier: profile.tier,
      count: resolvedCategories.length,
    },
  };
  return normalizeConfiguration(productDefinition, merged, now);
}

export async function configurationHash(configuration) {
  return sha256Hex(stableStringify(configuration));
}

export { CONFIG_KEYS };
export { PRODUCT_APPEARANCES };
