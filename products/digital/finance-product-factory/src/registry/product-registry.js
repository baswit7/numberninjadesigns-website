import { compareSemver, ContractValidationError, validateProductDefinition } from '../contracts/index.js';

export const PRODUCT_STATUSES = Object.freeze(['draft', 'beta', 'active', 'deprecated', 'retired']);

const STATUS_ORDER = new Map(PRODUCT_STATUSES.map((status, index) => [status, index]));
const LIST_OPTIONS = new Set([
  'status',
  'productFamily',
  'category',
  'saleType',
  'difficulty',
  'locale',
  'currency',
  'theme',
  'tags',
  'features',
  'recommended',
  'beta',
  'deprecated',
  'search',
  'includeAllVersions',
  'sortBy',
  'direction',
]);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value, visited = new WeakSet()) {
  if (!value || typeof value !== 'object' || visited.has(value)) return value;
  visited.add(value);
  for (const child of Object.values(value)) deepFreeze(child, visited);
  return Object.freeze(value);
}

function normalizedText(value) {
  return String(value).normalize('NFKD').toLocaleLowerCase('en-US').trim();
}

function normalizeStringList(value, name) {
  if (value === undefined) return null;
  const list = Array.isArray(value) ? value : [value];
  if (!list.length || list.some(item => typeof item !== 'string' || !item.trim())) throw new RegistryError('INVALID_FILTER', `${name} must contain one or more non-empty strings.`, { name });
  return new Set(list.map(normalizedText));
}

function requireBoolean(value, name) {
  if (value !== undefined && typeof value !== 'boolean') throw new RegistryError('INVALID_FILTER', `${name} must be boolean.`, { name });
}

function isDeprecated(definition) {
  return definition.status === 'deprecated' || definition.status === 'retired';
}

function descriptor(definition) {
  return Object.freeze({
    id: definition.id,
    version: definition.version,
    status: definition.status,
    productFamily: definition.productFamily,
    category: definition.category,
    nameKey: definition.nameKey,
    descriptionKey: definition.descriptionKey,
    saleType: definition.saleType,
    difficulty: definition.difficulty,
    tags: definition.tags,
    features: definition.features,
    supportedLocales: definition.supportedLocales,
    supportedCurrencies: definition.supportedCurrencies,
    supportedThemes: definition.supportedThemes,
    recommended: definition.recommended,
    beta: definition.status === 'beta',
    deprecated: isDeprecated(definition),
  });
}

function searchDocument(definition) {
  return normalizedText([
    definition.id,
    definition.version,
    definition.nameKey,
    definition.descriptionKey,
    definition.productFamily,
    definition.category,
    definition.saleType,
    definition.difficulty,
    ...definition.tags,
    ...definition.features,
  ].join(' '));
}

const comparators = new Map([
  ['id', (left, right) => left.id.localeCompare(right.id, 'en')],
  ['name', (left, right) => left.nameKey.localeCompare(right.nameKey, 'en')],
  ['productFamily', (left, right) => left.productFamily.localeCompare(right.productFamily, 'en')],
  ['category', (left, right) => left.category.localeCompare(right.category, 'en')],
  ['version', (left, right) => compareSemver(left.version, right.version)],
  ['status', (left, right) => STATUS_ORDER.get(left.status) - STATUS_ORDER.get(right.status)],
  ['recommended', (left, right) => Number(left.recommended) - Number(right.recommended)],
]);

function normalizeListOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new RegistryError('INVALID_FILTER', 'Registry options must be an object.');
  const unknown = Object.keys(options).filter(key => !LIST_OPTIONS.has(key));
  if (unknown.length) throw new RegistryError('UNKNOWN_FILTER', `Unknown registry option(s): ${unknown.join(', ')}`, { unknown });

  const status = normalizeStringList(options.status, 'status');
  if (status) {
    const invalid = [...status].filter(value => !STATUS_ORDER.has(value));
    if (invalid.length) throw new RegistryError('INVALID_STATUS', `Unknown product status: ${invalid.join(', ')}`, { invalid });
  }
  for (const name of ['recommended', 'beta', 'deprecated', 'includeAllVersions']) requireBoolean(options[name], name);
  if (options.search !== undefined && typeof options.search !== 'string') throw new RegistryError('INVALID_FILTER', 'search must be a string.', { name: 'search' });

  const sortBy = options.sortBy ?? 'id';
  if (!comparators.has(sortBy)) throw new RegistryError('INVALID_SORT', `Unsupported sort field '${sortBy}'.`, { sortBy });
  const direction = options.direction ?? 'asc';
  if (!['asc', 'desc'].includes(direction)) throw new RegistryError('INVALID_SORT', "direction must be 'asc' or 'desc'.", { direction });

  return {
    status,
    productFamily: normalizeStringList(options.productFamily, 'productFamily'),
    category: normalizeStringList(options.category, 'category'),
    saleType: normalizeStringList(options.saleType, 'saleType'),
    difficulty: normalizeStringList(options.difficulty, 'difficulty'),
    locale: normalizeStringList(options.locale, 'locale'),
    currency: normalizeStringList(options.currency, 'currency'),
    theme: normalizeStringList(options.theme, 'theme'),
    tags: normalizeStringList(options.tags, 'tags'),
    features: normalizeStringList(options.features, 'features'),
    recommended: options.recommended,
    beta: options.beta,
    deprecated: options.deprecated,
    search: normalizedText(options.search ?? ''),
    includeAllVersions: options.includeAllVersions ?? false,
    sortBy,
    direction,
    statusWasExplicit: options.status !== undefined,
  };
}

function intersects(values, filter) {
  return !filter || values.some(value => filter.has(normalizedText(value)));
}

function matches(definition, options) {
  if (options.status && !options.status.has(definition.status)) return false;
  if (!options.statusWasExplicit && definition.status === 'draft') return false;
  if (!options.statusWasExplicit && options.deprecated === undefined && isDeprecated(definition)) return false;
  if (options.productFamily && !options.productFamily.has(normalizedText(definition.productFamily))) return false;
  if (options.category && !options.category.has(normalizedText(definition.category))) return false;
  if (options.saleType && !options.saleType.has(normalizedText(definition.saleType))) return false;
  if (options.difficulty && !options.difficulty.has(normalizedText(definition.difficulty))) return false;
  if (!intersects(definition.supportedLocales, options.locale)) return false;
  if (!intersects(definition.supportedCurrencies, options.currency)) return false;
  if (!intersects(definition.supportedThemes, options.theme)) return false;
  if (!intersects(definition.tags, options.tags)) return false;
  if (!intersects(definition.features, options.features)) return false;
  if (options.recommended !== undefined && definition.recommended !== options.recommended) return false;
  if (options.beta !== undefined && (definition.status === 'beta') !== options.beta) return false;
  if (options.deprecated !== undefined && isDeprecated(definition) !== options.deprecated) return false;
  if (options.search && !searchDocument(definition).includes(options.search)) return false;
  return true;
}

function latestPerProduct(definitions) {
  const latest = new Map();
  for (const definition of definitions) {
    const current = latest.get(definition.id);
    if (!current || compareSemver(definition.version, current.version) > 0) latest.set(definition.id, definition);
  }
  return [...latest.values()];
}

function sortDefinitions(definitions, options) {
  const primary = comparators.get(options.sortBy);
  const direction = options.direction === 'asc' ? 1 : -1;
  return [...definitions].sort((left, right) => {
    const result = primary(left, right) * direction;
    if (result !== 0) return result;
    const id = left.id.localeCompare(right.id, 'en');
    if (id !== 0) return id;
    return compareSemver(right.version, left.version);
  });
}

export class RegistryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RegistryError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export class ProductRegistry {
  #products = new Map();

  constructor(definitions = []) {
    if (!Array.isArray(definitions)) throw new RegistryError('INVALID_DEFINITIONS', 'Registry constructor requires an array of definitions.');
    this.registerMany(definitions);
  }

  get size() {
    let count = 0;
    for (const versions of this.#products.values()) count += versions.size;
    return count;
  }

  register(definition, options = {}) {
    return this.registerMany([definition], options)[0];
  }

  registerMany(definitions, options = {}) {
    if (!Array.isArray(definitions)) throw new RegistryError('INVALID_DEFINITIONS', 'registerMany requires an array.');
    if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => key !== 'replace')) throw new RegistryError('INVALID_REGISTER_OPTIONS', "Only the boolean 'replace' option is supported.");
    const replace = options.replace ?? false;
    if (typeof replace !== 'boolean') throw new RegistryError('INVALID_REGISTER_OPTIONS', 'replace must be boolean.');

    const staged = definitions.map(definition => {
      const report = validateProductDefinition(definition);
      if (!report.valid) throw new ContractValidationError(report);
      return deepFreeze(cloneJson(definition));
    });

    const batchKeys = new Set();
    for (const definition of staged) {
      const key = `${definition.id}@${definition.version}`;
      if (batchKeys.has(key)) throw new RegistryError('DUPLICATE_PRODUCT_VERSION', `Duplicate product version '${key}' in registration batch.`, { id: definition.id, version: definition.version });
      batchKeys.add(key);
      if (!replace && this.#products.get(definition.id)?.has(definition.version)) throw new RegistryError('DUPLICATE_PRODUCT_VERSION', `Product '${key}' is already registered.`, { id: definition.id, version: definition.version });
    }

    for (const definition of staged) {
      const versions = this.#products.get(definition.id) ?? new Map();
      versions.set(definition.version, definition);
      this.#products.set(definition.id, versions);
    }
    return Object.freeze([...staged]);
  }

  has(productId, version) {
    if (version === undefined) return this.#products.has(productId);
    return this.#products.get(productId)?.has(version) ?? false;
  }

  get(productId, version) {
    const versions = this.#products.get(productId);
    if (!versions) return null;
    if (version !== undefined) return versions.get(version) ?? null;
    return [...versions.values()].sort((left, right) => compareSemver(right.version, left.version))[0] ?? null;
  }

  resolve(productId, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new RegistryError('INVALID_RESOLVE_OPTIONS', 'Resolve options must be an object.');
    const allowed = new Set(['version', 'allowBeta', 'allowDeprecated', 'allowDraft', 'allowRetired']);
    const unknown = Object.keys(options).filter(key => !allowed.has(key));
    if (unknown.length) throw new RegistryError('INVALID_RESOLVE_OPTIONS', `Unknown resolve option(s): ${unknown.join(', ')}`, { unknown });
    for (const name of ['allowBeta', 'allowDeprecated', 'allowDraft', 'allowRetired']) requireBoolean(options[name], name);
    if (options.version !== undefined && typeof options.version !== 'string') throw new RegistryError('INVALID_RESOLVE_OPTIONS', 'version must be a string.');

    const candidates = options.version ? [this.get(productId, options.version)].filter(Boolean) : [...(this.#products.get(productId)?.values() ?? [])];
    const eligible = candidates.filter(definition => definition.status === 'active'
      || (definition.status === 'beta' && options.allowBeta)
      || (definition.status === 'deprecated' && options.allowDeprecated)
      || (definition.status === 'draft' && options.allowDraft)
      || (definition.status === 'retired' && options.allowRetired));
    return eligible.sort((left, right) => compareSemver(right.version, left.version))[0] ?? null;
  }

  versions(productId) {
    return Object.freeze([...(this.#products.get(productId)?.keys() ?? [])].sort((left, right) => compareSemver(right, left)));
  }

  list(options = {}) {
    const normalized = normalizeListOptions(options);
    const all = [...this.#products.values()].flatMap(versions => [...versions.values()]);
    const filtered = all.filter(definition => matches(definition, normalized));
    const selected = normalized.includeAllVersions ? filtered : latestPerProduct(filtered);
    return Object.freeze(sortDefinitions(selected, normalized));
  }

  listEntries(options = {}) {
    return Object.freeze(this.list(options).map(descriptor));
  }

  search(query, options = {}) {
    if (typeof query !== 'string' || !query.trim()) throw new RegistryError('INVALID_SEARCH', 'Search query must be a non-empty string.');
    return this.list({ ...options, search: query });
  }

  recommended(options = {}) {
    return this.list({ ...options, recommended: true });
  }

  statusCounts(options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => key !== 'includeAllVersions')) throw new RegistryError('INVALID_FILTER', "statusCounts only supports the boolean 'includeAllVersions' option.");
    const includeAllVersions = options.includeAllVersions ?? false;
    requireBoolean(includeAllVersions, 'includeAllVersions');
    const definitions = includeAllVersions
      ? [...this.#products.values()].flatMap(versions => [...versions.values()])
      : latestPerProduct([...this.#products.values()].flatMap(versions => [...versions.values()]));
    const counts = Object.fromEntries(PRODUCT_STATUSES.map(status => [status, 0]));
    for (const definition of definitions) counts[definition.status] += 1;
    return Object.freeze(counts);
  }
}

export function createProductRegistry(definitions = []) {
  return new ProductRegistry(definitions);
}
