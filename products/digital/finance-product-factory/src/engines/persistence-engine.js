import { safeJsonParse, sanitizeFilename, stableStringify } from './security.js';

export const STORAGE_KEYS = Object.freeze({
  draft: 'financeProductFactory:draft:v2',
  backup: 'financeProductFactory:backup:v2',
  approvals: 'financeProductFactory:approvals:v1',
  preferences: 'financeProductFactory:uiPreferences:v1',
  legacy: 'financeFactoryLastConfig',
});

export const DEFAULT_UI_PREFERENCES = Object.freeze({
  schemaVersion: '1.0.0',
  appearance: 'light',
});

const UI_PREFERENCE_KEYS = Object.freeze(['appearance', 'schemaVersion']);
const UI_APPEARANCES = new Set(['light', 'dark']);

export function normalizeUiPreferences(value = DEFAULT_UI_PREFERENCES) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('UI preferences must be an object.');
  const unknownKeys = Object.keys(value).filter(key => !UI_PREFERENCE_KEYS.includes(key));
  if (unknownKeys.length) throw new Error(`Unsupported UI preference keys: ${unknownKeys.join(', ')}.`);
  if ((value.schemaVersion ?? '1.0.0') !== '1.0.0') throw new Error(`Unsupported UI preferences schemaVersion ${value.schemaVersion}.`);
  const appearance = value.appearance ?? DEFAULT_UI_PREFERENCES.appearance;
  if (!UI_APPEARANCES.has(appearance)) throw new Error(`Unsupported generator appearance ${appearance}.`);
  return Object.freeze({ schemaVersion: '1.0.0', appearance });
}

export function loadUiPreferences(storage = globalThis.localStorage) {
  if (!storage) return { preferences: DEFAULT_UI_PREFERENCES, warnings: ['UI preference storage unavailable.'] };
  try {
    const raw = storage.getItem(STORAGE_KEYS.preferences);
    if (!raw) return { preferences: DEFAULT_UI_PREFERENCES, warnings: [] };
    return { preferences: normalizeUiPreferences(safeJsonParse(raw)), warnings: [] };
  } catch (error) {
    return { preferences: DEFAULT_UI_PREFERENCES, warnings: [`Stored UI preferences rejected: ${error.message}`] };
  }
}

export function saveUiPreferences(preferences, storage = globalThis.localStorage) {
  const normalized = normalizeUiPreferences(preferences);
  if (!storage) return normalized;
  storage.setItem(STORAGE_KEYS.preferences, stableStringify(normalized));
  return normalized;
}

function upgradeConfiguration(value = {}) {
  const productId = value.productId ?? (value.product === 'basic' ? 'budget-planner-basic' : String(value.product ?? 'budget-planner-basic'));
  const locale = value.locale ?? 'nl-NL';
  const themeId = value.themeId ?? String(value.theme ?? 'executive-navy').toLowerCase().replaceAll(' ', '-');
  const title = String(value.title ?? value.name ?? 'Budget Planner Basic').trim() || 'Budget Planner Basic';
  const rawFilename = String(value.filename ?? `${productId}-${locale}-${value.currency ?? 'EUR'}-${themeId}`).replace(/\.xlsx$/i, '');
  return {
    schemaVersion: '1.0.0',
    productId,
    productVersion: value.productVersion ?? '1.0.0',
    locale,
    market: value.market ?? ({ 'nl-NL': 'NL', 'en-US': 'US', 'en-GB': 'GB', 'de-DE': 'DE', 'fr-FR': 'FR' }[locale] ?? 'NL'),
    currency: value.currency ?? 'EUR',
    year: Number(value.year ?? new Date().getFullYear()),
    themeId,
    title,
    filename: `${sanitizeFilename(rawFilename)}.xlsx`,
    inputCapacity: Number(value.inputCapacity ?? 100),
    sampleDataEnabled: Boolean(value.sampleDataEnabled ?? true),
    categoryOverrides: Array.isArray(value.categoryOverrides) ? [...value.categoryOverrides] : [],
    featureFlags: value.featureFlags && typeof value.featureFlags === 'object' ? { ...value.featureFlags } : {},
    branding: { enabled: true, ...(value.branding && typeof value.branding === 'object' ? value.branding : {}) },
    outputOptions: {
      workbook: true, package: true, customerDocs: true, listing: true, imageManifests: true,
      ...(value.outputOptions && typeof value.outputOptions === 'object' ? value.outputOptions : {}),
    },
    extensions: value.extensions && typeof value.extensions === 'object' && !Array.isArray(value.extensions) ? structuredClone(value.extensions) : {},
  };
}

export function migrateStoredState(value) {
  if (!value || typeof value !== 'object') throw new Error('Stored state must be an object.');
  if (value.schemaVersion === '2.0.0') return { ...structuredClone(value), configuration: upgradeConfiguration(value.configuration ?? {}) };
  if (value.schemaVersion === '1.0.0') {
    return {
      schemaVersion: '2.0.0',
      savedAt: value.savedAt ?? new Date(0).toISOString(),
      step: Number(value.step ?? 1),
      configuration: upgradeConfiguration(value.configuration ?? value),
      approval: value.approval ?? { status: 'DRAFT', reason: '' },
      lastGeneration: value.lastGeneration ?? null,
    };
  }
  if ('product' in value || 'currency' in value || 'year' in value) {
    return {
      schemaVersion: '2.0.0', savedAt: new Date(0).toISOString(), step: 1,
      configuration: upgradeConfiguration(value),
      approval: { status: 'DRAFT', reason: '' }, lastGeneration: null,
    };
  }
  throw new Error(`Unsupported stored schemaVersion ${value.schemaVersion ?? '(missing)'}.`);
}

export function loadDraft(storage = globalThis.localStorage) {
  if (!storage) return { state: null, warnings: ['Storage unavailable.'] };
  const raw = storage.getItem(STORAGE_KEYS.draft);
  const legacy = raw ? null : storage.getItem(STORAGE_KEYS.legacy);
  if (!raw && !legacy) return { state: null, warnings: [] };
  try {
    const parsed = safeJsonParse(raw ?? legacy);
    const state = migrateStoredState(parsed);
    if (!raw) saveDraft(state, storage);
    return { state, warnings: raw ? [] : ['Legacy draft migrated to schema 2.0.0.'] };
  } catch (error) {
    return { state: null, warnings: [`Stored draft rejected: ${error.message}`] };
  }
}

export function saveDraft(state, storage = globalThis.localStorage) {
  if (!storage) return false;
  const normalized = { ...state, schemaVersion: '2.0.0', savedAt: new Date().toISOString() };
  const serialized = stableStringify(normalized);
  const previous = storage.getItem(STORAGE_KEYS.draft);
  try {
    if (previous) storage.setItem(STORAGE_KEYS.backup, previous);
    storage.setItem(STORAGE_KEYS.draft, serialized);
    return true;
  } catch (error) {
    if (previous) {
      try { storage.setItem(STORAGE_KEYS.draft, previous); } catch { /* storage is already unavailable */ }
    }
    throw new Error(`Draft could not be saved: ${error.message}`);
  }
}

export function resetDraft(storage = globalThis.localStorage) {
  if (!storage) return;
  const current = storage.getItem(STORAGE_KEYS.draft);
  if (current) storage.setItem(STORAGE_KEYS.backup, current);
  storage.removeItem(STORAGE_KEYS.draft);
}

export function exportDraft(state) {
  return `${JSON.stringify({ ...state, schemaVersion: '2.0.0', exportedAt: new Date().toISOString() }, null, 2)}\n`;
}

export function importDraft(text) {
  return migrateStoredState(safeJsonParse(text));
}
