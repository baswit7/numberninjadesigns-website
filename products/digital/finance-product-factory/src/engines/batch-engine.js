import { ALLOWED_CAPACITIES, ALLOWED_PRODUCT_APPEARANCES } from './validation-engine.js';

export const UI_BATCH_LIMIT = 25;
export const BATCH_OUTPUTS = Object.freeze(['workbook', 'package', 'customerDocs', 'listing', 'imageManifests']);

function values(selection, key, fallback) {
  const list = selection[key] ?? fallback;
  if (!Array.isArray(list) || list.length === 0) throw new Error(`Batch dimension ${key} must contain at least one value.`);
  return [...new Set(list.map(value => typeof value === 'string' ? value.trim() : value))];
}

export function variantKey(variant) {
  return [variant.productId, variant.locale, variant.currency, variant.themeId, variant.productAppearance ?? 'light', variant.inputCapacity, variant.sampleDataEnabled ? 'sample' : 'blank'].join('|');
}

export function createBatchPlan(selection, {
  maxCombinations = UI_BATCH_LIMIT,
  historicalMsPerVariant = 0,
  averageBytes = 150_000,
  filesPerVariant = 20,
} = {}) {
  if (!selection || typeof selection !== 'object') throw new TypeError('Batch selection must be an object.');
  const dimensions = {
    productIds: values(selection, 'productIds', []),
    locales: values(selection, 'locales', ['nl-NL']),
    currencies: values(selection, 'currencies', ['EUR']),
    themeIds: values(selection, 'themeIds', ['executive-navy']),
    appearances: values(selection, 'appearances', ['light']),
    capacities: values(selection, 'capacities', [100]).map(Number),
  };
  const outputs = values(selection, 'outputs', ['workbook', 'package']);
  if (outputs.some(output => !BATCH_OUTPUTS.includes(output))) throw new Error('Batch contains an unsupported output type.');
  if (dimensions.capacities.some(capacity => !ALLOWED_CAPACITIES.includes(capacity))) throw new Error('Batch contains an unsupported input capacity.');
  if (dimensions.appearances.some(appearance => !ALLOWED_PRODUCT_APPEARANCES.includes(appearance))) throw new Error('Batch contains an unsupported workbook appearance.');
  if (!Number.isInteger(maxCombinations) || maxCombinations < 1 || maxCombinations > 100) throw new Error('Batch safe limit must be between 1 and 100.');
  const count = Object.values(dimensions).reduce((total, dimension) => total * dimension.length, 1);
  if (count > maxCombinations) throw new Error(`Batch has ${count} combinations; safe limit is ${maxCombinations}.`);
  const variants = [];
  for (const productId of dimensions.productIds)
    for (const locale of dimensions.locales)
      for (const currency of dimensions.currencies)
        for (const themeId of dimensions.themeIds)
          for (const productAppearance of dimensions.appearances)
            for (const inputCapacity of dimensions.capacities)
              variants.push(Object.freeze({ productId, locale, currency, themeId, productAppearance, inputCapacity, sampleDataEnabled: Boolean(selection.sampleDataEnabled ?? true), outputs: Object.freeze([...outputs]) }));
  return Object.freeze({
    schemaVersion: '1.0.0',
    count,
    variants: Object.freeze(variants),
    outputs: Object.freeze([...outputs]),
    expectedFiles: count * filesPerVariant,
    estimatedBytes: count * averageBytes,
    estimatedDurationMs: historicalMsPerVariant > 0 ? count * historicalMsPerVariant : null,
    warnings: Object.freeze(historicalMsPerVariant > 0 ? [] : ['Duration estimate unavailable until a successful generation has been measured.']),
    safeLimit: maxCombinations,
    createdAt: new Date().toISOString(),
  });
}

function elapsed(start) {
  const now = globalThis.performance?.now?.() ?? Date.now();
  return now - start;
}

async function yieldToMain() {
  if (typeof globalThis.requestAnimationFrame === 'function') await new Promise(resolve => globalThis.requestAnimationFrame(() => resolve()));
  else await new Promise(resolve => setTimeout(resolve, 0));
}

function priorResultsMap(previousResults) {
  const map = new Map();
  for (const result of previousResults ?? []) {
    if (result?.variant && result.status === 'PASS') map.set(variantKey(result.variant), result);
  }
  return map;
}

export async function runBatch(plan, generateVariant, {
  signal,
  onProgress = () => {},
  onCheckpoint = () => {},
  previousResults = [],
  retainValues = false,
  summarizeValue = value => value?.summary ?? null,
} = {}) {
  if (!plan?.variants || plan.count !== plan.variants.length) throw new TypeError('Batch plan is invalid.');
  if (typeof generateVariant !== 'function') throw new TypeError('Batch generator must be a function.');
  const completedPreviously = priorResultsMap(previousResults);
  const results = [];
  for (let index = 0; index < plan.variants.length; index += 1) {
    const variant = plan.variants[index];
    const key = variantKey(variant);
    if (signal?.aborted) {
      const cancelled = { schemaVersion: '1.0.0', status: 'CANCELLED', completed: results.length, total: plan.count, nextIndex: index, resumable: true, results };
      onCheckpoint(cancelled);
      return cancelled;
    }
    if (completedPreviously.has(key)) {
      const resumed = { ...completedPreviously.get(key), resumed: true };
      results.push(resumed);
      onProgress({ completed: index + 1, total: plan.count, result: resumed });
      continue;
    }
    const started = globalThis.performance?.now?.() ?? Date.now();
    let result;
    try {
      const value = await generateVariant(variant, { index, total: plan.count, signal });
      result = {
        status: 'PASS',
        variant,
        key,
        ...(retainValues ? { value } : { summary: summarizeValue(value) }),
        durationMs: Number(elapsed(started).toFixed(2)),
        resumed: false,
      };
    } catch (error) {
      result = {
        status: signal?.aborted ? 'CANCELLED' : 'FAIL',
        variant,
        key,
        error: String(error?.message ?? error).slice(0, 1_000),
        code: error?.code ?? 'GENERATION_FAILED',
        durationMs: Number(elapsed(started).toFixed(2)),
        resumed: false,
      };
    }
    results.push(result);
    const checkpoint = { schemaVersion: '1.0.0', status: 'RUNNING', completed: index + 1, total: plan.count, nextIndex: index + 1, resumable: true, results: [...results] };
    onProgress({ completed: index + 1, total: plan.count, result });
    onCheckpoint(checkpoint);
    await yieldToMain();
  }
  const failed = results.filter(result => result.status === 'FAIL').length;
  const cancelled = results.filter(result => result.status === 'CANCELLED').length;
  return {
    schemaVersion: '1.0.0',
    status: cancelled ? 'CANCELLED' : failed ? 'PASS_WITH_FAILURES' : 'PASS',
    completed: results.length,
    total: plan.count,
    passed: results.filter(result => result.status === 'PASS').length,
    failed,
    cancelled,
    nextIndex: plan.count,
    resumable: failed > 0 || cancelled > 0,
    results,
  };
}

export const resumeBatch = (plan, previousRun, generateVariant, options = {}) => runBatch(plan, generateVariant, { ...options, previousResults: previousRun?.results ?? [] });
