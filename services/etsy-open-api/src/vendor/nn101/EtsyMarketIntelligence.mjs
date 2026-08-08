import crypto from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCHEMA_VERSION = '1.0.0';
const TASK_ID = 'NN-101';
const PROVIDER = 'Etsy Open API v3';
const MARKET_ENDPOINT = 'https://openapi.etsy.com/v3/application/listings/active';
const MAX_CONFIG_BYTES = 256 * 1024;
const MAX_ENV_BYTES = 1024 * 1024;
const MAX_CSV_BYTES = 10 * 1024 * 1024;
const MAX_CSV_FILES = 100;
const MAX_LISTINGVIEW_RECORDS = 100_000;
const MAX_TEXT = 2_000;
const RETRY_LIMIT = 3;
const OWN_SHOP = 'NumberNinjaDesigns';
const RANGE_DAYS = Object.freeze({ '7': 7, '30': 30, '90': 90, '365': 365, all: null });
const LISTING_ID = /^[1-9][0-9]{0,18}$/u;
const KEYWORD_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ENV_KEYS = Object.freeze({
  clientId: ['ETSY_CLIENT_ID', 'ETSY_API_KEY', 'ETSY_KEYSTRING'],
  sharedSecret: ['ETSY_CLIENT_SECRET', 'ETSY_SHARED_SECRET'],
  shopId: ['ETSY_SHOP_ID'],
});

export class EtsyMarketError extends Error {
  constructor(code, message, statusCode = 1) {
    super(message);
    this.name = 'EtsyMarketError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const round = (value, digits = 2) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const cleanText = (value, maximum = MAX_TEXT) => String(value ?? '').replace(/\s+/gu, ' ').trim().slice(0, maximum);
const normalizedText = value => cleanText(value).toLocaleLowerCase('en-US');

function assert(condition, code, message) {
  if (!condition) throw new EtsyMarketError(code, message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readRegularFile(filePath, maximumBytes, label) {
  const resolved = path.resolve(filePath instanceof URL ? fileURLToPath(filePath) : filePath);
  let info;
  try { info = await lstat(resolved); } catch { throw new EtsyMarketError(`${label.toUpperCase()}_MISSING`, `${label} ontbreekt.`); }
  assert(info.isFile() && !info.isSymbolicLink() && info.size > 0 && info.size <= maximumBytes, `${label.toUpperCase()}_UNSAFE`, `${label} is onveilig of te groot.`);
  const actual = await realpath(resolved);
  assert(pathsEqual(actual, resolved), `${label.toUpperCase()}_UNSAFE`, `${label} verwijst buiten het vaste pad.`);
  return readFile(actual);
}

function pathsEqual(left, right) {
  const normalize = value => path.resolve(value).replace(/[\\/]+$/u, '');
  return process.platform === 'win32'
    ? normalize(left).toLocaleLowerCase('en-US') === normalize(right).toLocaleLowerCase('en-US')
    : normalize(left) === normalize(right);
}

async function ensureRoot(rootPath) {
  const resolved = path.resolve(rootPath);
  await mkdir(resolved, { recursive: true });
  const info = await lstat(resolved);
  assert(info.isDirectory() && !info.isSymbolicLink(), 'MARKET_ROOT_UNSAFE', 'De concurrentie-opslag is onveilig.');
  const actual = await realpath(resolved);
  assert(pathsEqual(actual, resolved), 'MARKET_ROOT_UNSAFE', 'De concurrentie-opslag verwijst buiten het vaste pad.');
  return resolved;
}

async function atomicJson(filePath, value) {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await rename(temporary, filePath);
}

export async function readMarketConfig(configPath) {
  const bytes = await readRegularFile(configPath, MAX_CONFIG_BYTES, 'config');
  let config;
  try { config = JSON.parse(bytes.toString('utf8')); } catch { throw new EtsyMarketError('CONFIG_INVALID', 'De Etsy-configuratie bevat geen geldige JSON.'); }
  assert(isObject(config) && config.schemaVersion === SCHEMA_VERSION && config.taskId === TASK_ID, 'CONFIG_INVALID', 'De Etsy-configuratie heeft een onverwachte versie of Task ID.');
  assert(config.expectedShopName === OWN_SHOP, 'CONFIG_INVALID', 'De uitgesloten eigen shop wijkt af van het contract.');
  const ownListingIds = Array.isArray(config.expectedListingIds) ? config.expectedListingIds.map(String) : [];
  assert(ownListingIds.length === 11 && new Set(ownListingIds).size === 11 && ownListingIds.every(id => LISTING_ID.test(id)), 'CONFIG_INVALID', 'De uitsluitlijst moet exact 11 eigen listing-ID’s bevatten.');
  const market = config.marketIntelligence;
  assert(isObject(market) && market.schemaVersion === SCHEMA_VERSION, 'CONFIG_INVALID', 'De concurrentieconfiguratie ontbreekt.');
  assert(typeof market.currencyCode === 'string' && /^[A-Z]{3}$/u.test(market.currencyCode), 'CONFIG_INVALID', 'De marktvaluta is ongeldig.');
  assert(Number.isInteger(market.resultLimit) && market.resultLimit >= 25 && market.resultLimit <= 100, 'CONFIG_INVALID', 'De paginagrootte moet tussen 25 en 100 liggen.');
  assert(Number.isInteger(market.pagesPerKeyword) && market.pagesPerKeyword >= 1 && market.pagesPerKeyword <= 5, 'CONFIG_INVALID', 'Het aantal pagina’s per zoekwoord is ongeldig.');
  const keywords = Array.isArray(market.keywords) ? market.keywords : [];
  assert(keywords.length >= 1 && keywords.length <= 30, 'CONFIG_INVALID', 'De zoekwoordwatchlist moet 1 tot 30 items bevatten.');
  const seenIds = new Set();
  const seenQueries = new Set();
  const projectedKeywords = keywords.map((entry, index) => {
    assert(isObject(entry), 'CONFIG_INVALID', `Zoekwoord ${index + 1} is ongeldig.`);
    const id = cleanText(entry.id, 80);
    const label = cleanText(entry.label, 120);
    const query = cleanText(entry.query, 120);
    assert(KEYWORD_ID.test(id) && label.length >= 2 && query.length >= 2, 'CONFIG_INVALID', `Zoekwoord ${index + 1} is ongeldig.`);
    const queryKey = normalizedText(query);
    assert(!seenIds.has(id) && !seenQueries.has(queryKey), 'CONFIG_INVALID', 'De zoekwoordwatchlist bevat duplicaten.');
    seenIds.add(id);
    seenQueries.add(queryKey);
    return Object.freeze({ id, label, query });
  });
  return Object.freeze({
    taskId: TASK_ID,
    expectedShopName: OWN_SHOP,
    ownListingIds: Object.freeze(ownListingIds),
    currencyCode: market.currencyCode,
    resultLimit: market.resultLimit,
    pagesPerKeyword: market.pagesPerKeyword,
    keywords: Object.freeze(projectedKeywords),
  });
}

function parseDotEnvLiteral(rawValue) {
  const value = rawValue.trim();
  if (value.startsWith('"')) {
    assert(value.length >= 2 && value.endsWith('"'), 'ENV_INVALID', 'Een dubbele quote in .env is niet gesloten.');
    return value.slice(1, -1).replace(/\\n/gu, '\n').replace(/\\r/gu, '\r').replace(/\\t/gu, '\t').replace(/\\"/gu, '"').replace(/\\\\/gu, '\\');
  }
  if (value.startsWith("'")) {
    assert(value.length >= 2 && value.endsWith("'"), 'ENV_INVALID', 'Een enkele quote in .env is niet gesloten.');
    return value.slice(1, -1);
  }
  return value.replace(/\s+#.*$/u, '').trimEnd();
}

export async function readEtsyPublicAuthority(envPath) {
  const bytes = await readRegularFile(envPath, MAX_ENV_BYTES, '.env');
  const values = new Map();
  for (const line of bytes.toString('utf8').split(/\r?\n/u)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match) continue;
    assert(!values.has(match[1]), 'ENV_INVALID', `Dubbele .env-sleutel: ${match[1]}`);
    values.set(match[1], parseDotEnvLiteral(match[2]));
  }
  const first = keys => keys.map(key => values.get(key)).find(value => typeof value === 'string' && value.trim().length > 0);
  const clientId = first(ENV_KEYS.clientId);
  const sharedSecret = first(ENV_KEYS.sharedSecret);
  const shopId = first(ENV_KEYS.shopId);
  assert(typeof clientId === 'string' && clientId.length <= 512, 'ENV_AUTHORITY_MISSING', 'De Etsy API-key ontbreekt in .env.');
  assert(typeof sharedSecret === 'string' && sharedSecret.length <= 2_048, 'ENV_AUTHORITY_MISSING', 'Het Etsy shared secret ontbreekt in .env.');
  assert(typeof shopId === 'string' && LISTING_ID.test(shopId), 'ENV_AUTHORITY_MISSING', 'Het eigen Etsy shop-ID ontbreekt in .env.');
  return Object.freeze({ apiKeyHeader: `${clientId}:${sharedSecret}`, ownShopId: shopId });
}

function safeInteger(value, label, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined)) return null;
  const number = Number(value);
  assert(Number.isSafeInteger(number) && number >= 0, 'PROVIDER_SCHEMA_INVALID', `${label} is ongeldig.`);
  return number;
}

function epochToIso(value, label) {
  const seconds = safeInteger(value, label, { nullable: true });
  if (seconds === null || seconds === 0) return null;
  const date = new Date(seconds * 1_000);
  assert(Number.isFinite(date.getTime()), 'PROVIDER_SCHEMA_INVALID', `${label} is geen geldige datum.`);
  return date.toISOString();
}

function validateEtsyListingUrl(raw, listingId) {
  let url;
  try { url = new URL(String(raw)); } catch { throw new EtsyMarketError('PROVIDER_SCHEMA_INVALID', 'Etsy gaf een ongeldige listing-URL terug.'); }
  assert(url.protocol === 'https:' && /(^|\.)etsy\.com$/iu.test(url.hostname) && !url.username && !url.password && url.pathname.includes(`/listing/${listingId}`), 'PROVIDER_SCHEMA_INVALID', 'Een listing-URL valt buiten Etsy.');
  url.hash = '';
  return url.toString();
}

function normalizeProviderListing(raw, rank, config) {
  assert(isObject(raw), 'PROVIDER_SCHEMA_INVALID', 'Etsy gaf een ongeldige listing terug.');
  const listingId = String(raw.listing_id ?? '');
  const shopId = String(raw.shop_id ?? '');
  assert(LISTING_ID.test(listingId) && LISTING_ID.test(shopId), 'PROVIDER_SCHEMA_INVALID', 'Etsy gaf een ongeldig listing- of shop-ID terug.');
  assert(String(raw.state) === 'active', 'PROVIDER_SCHEMA_INVALID', 'Etsy gaf een niet-actieve listing terug in de actieve zoekroute.');
  const title = cleanText(raw.title, 500);
  assert(title.length > 0, 'PROVIDER_SCHEMA_INVALID', 'Een Etsy-listingtitel ontbreekt.');
  const price = raw.price;
  assert(isObject(price), 'PROVIDER_SCHEMA_INVALID', 'De Etsy-listingprijs ontbreekt.');
  const amount = safeInteger(price.amount, 'price.amount');
  const divisor = safeInteger(price.divisor, 'price.divisor');
  const currencyCode = String(price.currency_code ?? '');
  assert(divisor > 0 && /^[A-Z]{3}$/u.test(currencyCode), 'PROVIDER_SCHEMA_INVALID', 'Etsy gaf een onverwachte valuta of prijsdeler terug.');
  const tags = Array.isArray(raw.tags) ? raw.tags.slice(0, 30).map(tag => cleanText(tag, 100)).filter(Boolean) : [];
  return Object.freeze({
    listingId,
    shopId,
    rank,
    title,
    url: validateEtsyListingUrl(raw.url, listingId),
    priceMinor: Math.round((amount / divisor) * 100),
    currencyCode,
    favorites: safeInteger(raw.num_favorers, 'num_favorers', { nullable: true }),
    createdAt: epochToIso(raw.original_creation_timestamp ?? raw.created_timestamp ?? raw.creation_timestamp, 'created_timestamp'),
    updatedAt: epochToIso(raw.last_modified_timestamp ?? raw.updated_timestamp, 'updated_timestamp'),
    tags,
  });
}

export function normalizeMarketplaceResponse(raw, { keywordId, config, rankOffset = 0, ownShopId }) {
  assert(isObject(raw), 'PROVIDER_SCHEMA_INVALID', 'Etsy gaf geen object terug.');
  const resultCount = safeInteger(raw.count, 'count');
  assert(Array.isArray(raw.results) && raw.results.length <= config.resultLimit, 'PROVIDER_SCHEMA_INVALID', 'Etsy gaf een ongeldige resultatenpagina terug.');
  const ownListingSet = new Set(config.ownListingIds);
  const normalized = raw.results.map((item, index) => normalizeProviderListing(item, rankOffset + index + 1, config));
  const ownExcluded = normalized.filter(item => item.shopId === ownShopId || ownListingSet.has(item.listingId));
  return Object.freeze({
    resultCount,
    ownExcludedCount: ownExcluded.length,
    listings: Object.freeze(normalized.filter(item => item.shopId !== ownShopId && !ownListingSet.has(item.listingId))),
    keywordId,
  });
}

function retryDelay(error, attempt) {
  const retryAfter = Number(error?.retryAfter);
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(30_000, retryAfter * 1_000);
  return Math.min(30_000, 1_000 * (2 ** (attempt - 1)));
}

async function fetchMarketplacePage(url, apiKeyHeader, { fetchImpl = fetch, delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)) } = {}) {
  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: { accept: 'application/json', 'x-api-key': apiKeyHeader },
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      });
    } catch (cause) {
      if (attempt < RETRY_LIMIT) { await delay(retryDelay(null, attempt)); continue; }
      throw new EtsyMarketError('ETSY_TRANSPORT_FAILED', `Etsy marktplaatsverbinding mislukt: ${cleanText(cause?.message, 180)}`);
    }
    if (response.ok) {
      let payload;
      try { payload = await response.json(); } catch { throw new EtsyMarketError('PROVIDER_SCHEMA_INVALID', 'Etsy gaf geen geldige JSON terug.'); }
      return {
        payload,
        limits: {
          qpdRemaining: numericHeader(response.headers, 'x-remaining-today'),
          qpsRemaining: numericHeader(response.headers, 'x-remaining-this-second') ?? numericHeader(response.headers, 'x-remaining-this-secon'),
        },
      };
    }
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    if (retryable && attempt < RETRY_LIMIT) {
      const error = { retryAfter: response.headers.get('retry-after') };
      await delay(retryDelay(error, attempt));
      continue;
    }
    const code = response.status === 401 ? 'ETSY_API_KEY_REJECTED'
      : response.status === 403 ? 'ETSY_MARKET_ACCESS_REJECTED'
        : response.status === 429 ? 'ETSY_RATE_LIMIT_EXHAUSTED'
          : response.status >= 500 ? 'ETSY_PROVIDER_UNAVAILABLE' : 'ETSY_REQUEST_REJECTED';
    throw new EtsyMarketError(code, `Etsy marktplaatsrequest is gestopt (HTTP ${response.status}).`);
  }
  throw new EtsyMarketError('ETSY_SYNC_FAILED', 'Etsy marktplaatssync is onverwacht gestopt.');
}

function numericHeader(headers, name) {
  const value = Number(headers?.get?.(name));
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function percentile(values, proportion) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * proportion;
  const lower = Math.floor(position);
  const remainder = position - lower;
  return sorted[lower + 1] === undefined ? sorted[lower] : sorted[lower] + remainder * (sorted[lower + 1] - sorted[lower]);
}

const median = values => percentile(values, 0.5);

function scaleRelative(value, values, { invert = false, logarithmic = false } = {}) {
  const clean = values.filter(Number.isFinite).map(item => logarithmic ? Math.log1p(item) : item);
  if (!Number.isFinite(value) || !clean.length) return 50;
  const candidate = logarithmic ? Math.log1p(value) : value;
  const minimum = Math.min(...clean);
  const maximum = Math.max(...clean);
  const scaled = maximum === minimum ? 50 : ((candidate - minimum) / (maximum - minimum)) * 100;
  return invert ? 100 - scaled : scaled;
}

export function calculateOpportunityIndexes(keywordRows) {
  const saturation = keywordRows.map(row => row.resultCount);
  const favorites = keywordRows.map(row => row.medianFavorites).filter(Number.isFinite);
  const prices = keywordRows.map(row => row.medianPriceMinor).filter(Number.isFinite);
  const entrantShares = keywordRows.map(row => row.sampledCount > 0 ? row.newListings30d / row.sampledCount : null).filter(Number.isFinite);
  return keywordRows.map(row => {
    const entrantShare = row.sampledCount > 0 ? row.newListings30d / row.sampledCount : null;
    const score = (
      scaleRelative(row.resultCount, saturation, { invert: true, logarithmic: true }) * 0.45
      + scaleRelative(row.medianFavorites, favorites, { logarithmic: true }) * 0.25
      + scaleRelative(row.medianPriceMinor, prices) * 0.15
      + scaleRelative(entrantShare, entrantShares, { invert: true }) * 0.15
    );
    return { ...row, opportunityIndex: Math.round(score), confidence: row.sampledCount >= 150 ? 'high' : row.sampledCount >= 75 ? 'medium' : 'low' };
  });
}

export async function captureMarketplaceSnapshot({
  config,
  apiKeyHeader,
  ownShopId,
  capturedAt = new Date(),
  fetchImpl = fetch,
  delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
}) {
  assert(isObject(config) && Array.isArray(config.keywords) && config.keywords.length > 0, 'CONFIG_INVALID', 'De gevalideerde Etsy-marktconfiguratie ontbreekt.');
  assert(typeof apiKeyHeader === 'string' && apiKeyHeader.length >= 3 && apiKeyHeader.length <= 2_048 && !/[\r\n]/u.test(apiKeyHeader), 'ENV_AUTHORITY_MISSING', 'De Etsy API-authority ontbreekt of is ongeldig.');
  assert(typeof ownShopId === 'string' && LISTING_ID.test(ownShopId), 'ENV_AUTHORITY_MISSING', 'Het eigen Etsy shop-ID ontbreekt of is ongeldig.');
  assert(capturedAt instanceof Date && Number.isFinite(capturedAt.getTime()), 'CLOCK_INVALID', 'De runtimeklok is ongeldig.');

  const observations = [];
  const keywordSummaries = [];
  let requestCount = 0;
  let ownExcludedCount = 0;
  let qpdRemaining = null;
  let qpsRemaining = null;
  for (const keyword of config.keywords) {
    let resultCount = 0;
    const keywordListings = new Map();
    let keywordOwnExcluded = 0;
    for (let page = 0; page < config.pagesPerKeyword; page += 1) {
      const offset = page * config.resultLimit;
      const url = new URL(MARKET_ENDPOINT);
      url.searchParams.set('limit', String(config.resultLimit));
      url.searchParams.set('offset', String(offset));
      url.searchParams.set('keywords', keyword.query);
      url.searchParams.set('sort_on', 'score');
      url.searchParams.set('sort_order', 'desc');
      url.searchParams.set('is_safe', 'true');
      url.searchParams.set('currency', config.currencyCode);
      const response = await fetchMarketplacePage(url, apiKeyHeader, { fetchImpl, delay });
      requestCount += 1;
      qpdRemaining = response.limits.qpdRemaining ?? qpdRemaining;
      qpsRemaining = response.limits.qpsRemaining ?? qpsRemaining;
      const normalized = normalizeMarketplaceResponse(response.payload, {
        keywordId: keyword.id,
        config,
        rankOffset: offset,
        ownShopId,
      });
      resultCount = normalized.resultCount;
      keywordOwnExcluded += normalized.ownExcludedCount;
      for (const listing of normalized.listings) {
        if (!keywordListings.has(listing.listingId)) keywordListings.set(listing.listingId, listing);
      }
      if (response.payload.results.length < config.resultLimit || offset + response.payload.results.length >= resultCount) break;
    }
    const listings = [...keywordListings.values()];
    ownExcludedCount += keywordOwnExcluded;
    keywordSummaries.push(summarizeKeyword(keyword, listings, resultCount, keywordOwnExcluded, capturedAt, config.currencyCode));
    observations.push(...listings.map(listing => ({ ...listing, keywordId: keyword.id })));
  }

  return Object.freeze({
    runId: `daily:${currentDate(capturedAt)}`,
    capturedAt: capturedAt.toISOString(),
    capturedDate: currentDate(capturedAt),
    requestCount,
    qpdRemaining,
    qpsRemaining,
    ownExcludedCount,
    keywords: Object.freeze(keywordSummaries),
    observations: Object.freeze(observations),
  });
}

function initializeSchema(database) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      captured_at TEXT NOT NULL,
      captured_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('success','failed')),
      request_count INTEGER NOT NULL,
      keyword_count INTEGER NOT NULL,
      observation_count INTEGER NOT NULL,
      unique_listing_count INTEGER NOT NULL,
      own_excluded_count INTEGER NOT NULL,
      qpd_remaining INTEGER,
      qps_remaining INTEGER,
      error_code TEXT,
      error_message TEXT
    ) STRICT;
    CREATE TABLE IF NOT EXISTS keyword_snapshots (
      run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
      captured_date TEXT NOT NULL,
      keyword_id TEXT NOT NULL,
      label TEXT NOT NULL,
      query TEXT NOT NULL,
      result_count INTEGER NOT NULL,
      sampled_count INTEGER NOT NULL,
      unique_shop_count INTEGER NOT NULL,
      price_sample_count INTEGER NOT NULL DEFAULT 0,
      median_price_minor INTEGER,
      p25_price_minor INTEGER,
      p75_price_minor INTEGER,
      median_favorites REAL,
      new_listings_30d INTEGER NOT NULL,
      own_excluded_count INTEGER NOT NULL,
      PRIMARY KEY(run_id, keyword_id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS listing_observations (
      run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
      captured_date TEXT NOT NULL,
      keyword_id TEXT NOT NULL,
      rank INTEGER NOT NULL,
      listing_id TEXT NOT NULL,
      shop_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      price_minor INTEGER NOT NULL,
      currency_code TEXT NOT NULL,
      favorites INTEGER,
      created_at TEXT,
      updated_at TEXT,
      tags_json TEXT NOT NULL,
      PRIMARY KEY(run_id, keyword_id, listing_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS ix_listing_observations_listing ON listing_observations(listing_id, captured_date);
    CREATE INDEX IF NOT EXISTS ix_listing_observations_shop ON listing_observations(shop_id, captured_date);
    CREATE INDEX IF NOT EXISTS ix_keyword_snapshots_date ON keyword_snapshots(captured_date, keyword_id);
    CREATE TABLE IF NOT EXISTS listingview_imports (
      import_id INTEGER PRIMARY KEY,
      imported_at TEXT NOT NULL,
      source_file TEXT NOT NULL,
      source_sha256 TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      ambiguous_count INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('imported','review'))
    ) STRICT;
    CREATE TABLE IF NOT EXISTS listingview_records (
      import_id INTEGER NOT NULL REFERENCES listingview_imports(import_id) ON DELETE CASCADE,
      source_row INTEGER NOT NULL,
      keyword TEXT NOT NULL,
      search_volume REAL,
      competition REAL,
      price REAL,
      favorites REAL,
      estimated_sales REAL,
      estimated_revenue REAL,
      conversion_rate REAL,
      PRIMARY KEY(import_id, source_row)
    ) STRICT;
  `);
  const keywordColumns = new Set(database.prepare('PRAGMA table_info(keyword_snapshots)').all().map(column => column.name));
  if (!keywordColumns.has('price_sample_count')) database.exec('ALTER TABLE keyword_snapshots ADD COLUMN price_sample_count INTEGER NOT NULL DEFAULT 0');
}

function begin(database, callback) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = callback();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function currentDate(now) {
  return now.toISOString().slice(0, 10);
}

function ageDays(iso, now) {
  if (!iso) return null;
  const milliseconds = Date.parse(iso);
  return Number.isFinite(milliseconds) ? Math.max(0, Math.floor((now.getTime() - milliseconds) / 86_400_000)) : null;
}

function summarizeKeyword(keyword, listings, resultCount, ownExcludedCount, now, currencyCode) {
  const prices = listings.filter(item => item.currencyCode === currencyCode).map(item => item.priceMinor);
  const favoriteValues = listings.map(item => item.favorites).filter(Number.isFinite);
  return {
    id: keyword.id,
    label: keyword.label,
    query: keyword.query,
    resultCount,
    sampledCount: listings.length,
    uniqueShops: new Set(listings.map(item => item.shopId)).size,
    priceSampleCount: prices.length,
    medianPriceMinor: median(prices) === null ? null : Math.round(median(prices)),
    p25PriceMinor: percentile(prices, 0.25) === null ? null : Math.round(percentile(prices, 0.25)),
    p75PriceMinor: percentile(prices, 0.75) === null ? null : Math.round(percentile(prices, 0.75)),
    medianFavorites: round(median(favoriteValues)),
    newListings30d: listings.filter(item => {
      const days = ageDays(item.createdAt, now);
      return days !== null && days <= 30;
    }).length,
    ownExcludedCount,
  };
}

function insertSuccessfulRun(database, capture) {
  begin(database, () => {
    database.prepare('DELETE FROM runs WHERE run_id = ?').run(capture.runId);
    database.prepare(`INSERT INTO runs (
      run_id,captured_at,captured_date,status,request_count,keyword_count,observation_count,
      unique_listing_count,own_excluded_count,qpd_remaining,qps_remaining,error_code,error_message
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      capture.runId, capture.capturedAt, capture.capturedDate, 'success', capture.requestCount,
      capture.keywords.length, capture.observations.length, new Set(capture.observations.map(item => item.listingId)).size,
      capture.ownExcludedCount, capture.qpdRemaining, capture.qpsRemaining, null, null,
    );
    const insertKeyword = database.prepare(`INSERT INTO keyword_snapshots (
      run_id,captured_date,keyword_id,label,query,result_count,sampled_count,unique_shop_count,
      price_sample_count,median_price_minor,p25_price_minor,p75_price_minor,median_favorites,new_listings_30d,own_excluded_count
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const keyword of capture.keywords) insertKeyword.run(
      capture.runId, capture.capturedDate, keyword.id, keyword.label, keyword.query, keyword.resultCount,
      keyword.sampledCount, keyword.uniqueShops, keyword.priceSampleCount, keyword.medianPriceMinor, keyword.p25PriceMinor,
      keyword.p75PriceMinor, keyword.medianFavorites, keyword.newListings30d, keyword.ownExcludedCount,
    );
    const insertObservation = database.prepare(`INSERT INTO listing_observations (
      run_id,captured_date,keyword_id,rank,listing_id,shop_id,title,url,price_minor,currency_code,
      favorites,created_at,updated_at,tags_json
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const listing of capture.observations) insertObservation.run(
      capture.runId, capture.capturedDate, listing.keywordId, listing.rank, listing.listingId, listing.shopId,
      listing.title, listing.url, listing.priceMinor, listing.currencyCode, listing.favorites,
      listing.createdAt, listing.updatedAt, JSON.stringify(listing.tags),
    );
  });
}

function latestRun(database) {
  return database.prepare("SELECT * FROM runs WHERE status='success' ORDER BY captured_at DESC LIMIT 1").get() ?? null;
}

function mapKeywordRow(row) {
  return {
    id: row.keyword_id,
    label: row.label,
    query: row.query,
    resultCount: row.result_count,
    sampledCount: row.sampled_count,
    uniqueShops: row.unique_shop_count,
    priceSampleCount: row.price_sample_count,
    medianPriceMinor: row.median_price_minor,
    p25PriceMinor: row.p25_price_minor,
    p75PriceMinor: row.p75_price_minor,
    medianFavorites: row.median_favorites,
    newListings30d: row.new_listings_30d,
    ownExcludedCount: row.own_excluded_count,
  };
}

function titlePhrases(listings, limit = 25) {
  const stop = new Set(['and', 'the', 'for', 'with', 'from', 'your', 'you', 'een', 'het', 'voor', 'van', 'met', 'digital', 'download', 'template', 'spreadsheet', 'excel']);
  const counts = new Map();
  for (const listing of listings) {
    const words = normalizedText(listing.title).replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/u).filter(word => word.length > 2 && !stop.has(word));
    for (let index = 0; index < words.length - 1; index += 1) {
      const phrase = `${words[index]} ${words[index + 1]}`;
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en-US')).slice(0, limit).map(([phrase, count]) => ({ phrase, count }));
}

function tagSignals(listings, limit = 30) {
  const counts = new Map();
  for (const listing of listings) for (const tag of listing.tags) {
    const key = normalizedText(tag);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en-US')).slice(0, limit).map(([tag, count]) => ({ tag, count }));
}

function dedupeListings(observations) {
  const byId = new Map();
  for (const item of observations) {
    const existing = byId.get(item.listingId);
    if (!existing) byId.set(item.listingId, { ...item, keywordIds: [item.keywordId], bestRank: item.rank });
    else {
      if (!existing.keywordIds.includes(item.keywordId)) existing.keywordIds.push(item.keywordId);
      existing.bestRank = Math.min(existing.bestRank, item.rank);
    }
  }
  return [...byId.values()];
}

function shopRanking(listings, limit = 50) {
  const shops = new Map();
  for (const listing of listings) {
    const shop = shops.get(listing.shopId) ?? { shopId: listing.shopId, listingIds: new Set(), keywordIds: new Set(), prices: [], favorites: 0, sampleTitle: listing.title };
    shop.listingIds.add(listing.listingId);
    listing.keywordIds.forEach(id => shop.keywordIds.add(id));
    shop.prices.push(listing.priceMinor);
    if (Number.isFinite(listing.favorites)) shop.favorites += listing.favorites;
    shops.set(listing.shopId, shop);
  }
  return [...shops.values()].map(shop => ({
    shopId: shop.shopId,
    label: `Shop ${shop.shopId}`,
    listingCount: shop.listingIds.size,
    keywordCount: shop.keywordIds.size,
    medianPriceMinor: Math.round(median(shop.prices) ?? 0),
    totalFavorites: shop.favorites,
    sampleTitle: shop.sampleTitle,
  })).sort((a, b) => b.keywordCount - a.keywordCount || b.listingCount - a.listingCount || b.totalFavorites - a.totalFavorites).slice(0, limit);
}

function listingViewSummary(database) {
  const latest = database.prepare('SELECT * FROM listingview_imports ORDER BY imported_at DESC, import_id DESC LIMIT 1').get();
  const totals = database.prepare('SELECT COUNT(*) AS files, COALESCE(SUM(record_count),0) AS records, COALESCE(SUM(ambiguous_count),0) AS ambiguous FROM listingview_imports').get();
  return latest ? {
    state: 'available',
    importedAt: latest.imported_at,
    sourceFiles: totals.files,
    recordCount: totals.records,
    ambiguousCount: totals.ambiguous,
    latestSourceType: latest.source_type,
    metricClass: 'third-party-estimate',
    apiStatus: 'unavailable-no-release-date',
  } : {
    state: 'missing', importedAt: null, sourceFiles: 0, recordCount: 0, ambiguousCount: 0,
    latestSourceType: null, metricClass: 'third-party-estimate', apiStatus: 'unavailable-no-release-date',
  };
}

function dateFloor(days, now) {
  if (days === null) return null;
  return new Date(now.getTime() - ((days - 1) * 86_400_000)).toISOString().slice(0, 10);
}

function rangeTrends(database, days, now) {
  const floor = dateFloor(days, now);
  const rows = floor
    ? database.prepare(`SELECT ks.*, r.captured_at FROM keyword_snapshots ks JOIN runs r ON r.run_id=ks.run_id WHERE r.status='success' AND ks.captured_date >= ? ORDER BY r.captured_at, ks.keyword_id`).all(floor)
    : database.prepare(`SELECT ks.*, r.captured_at FROM keyword_snapshots ks JOIN runs r ON r.run_id=ks.run_id WHERE r.status='success' ORDER BY r.captured_at, ks.keyword_id`).all();
  return rows.slice(-15_000).map(row => ({
    capturedAt: row.captured_at,
    date: row.captured_date,
    keywordId: row.keyword_id,
    resultCount: row.result_count,
    sampledCount: row.sampled_count,
    uniqueShops: row.unique_shop_count,
    medianPriceMinor: row.median_price_minor,
    medianFavorites: row.median_favorites,
    newListings30d: row.new_listings_30d,
  }));
}

export function buildPortableMarketProjection({ capture, config, now = new Date() }) {
  assert(isObject(capture) && Array.isArray(capture.keywords) && Array.isArray(capture.observations), 'CAPTURE_INVALID', 'De Etsy-marktcapture is ongeldig.');
  assert(isObject(config) && Array.isArray(config.keywords), 'CONFIG_INVALID', 'De gevalideerde Etsy-marktconfiguratie ontbreekt.');
  assert(now instanceof Date && Number.isFinite(now.getTime()), 'CLOCK_INVALID', 'De runtimeklok is ongeldig.');
  const capturedMilliseconds = Date.parse(capture.capturedAt);
  assert(Number.isFinite(capturedMilliseconds), 'CAPTURE_INVALID', 'De Etsy-marktcapture bevat geen geldige tijd.');

  const keywordRows = calculateOpportunityIndexes(capture.keywords);
  const observations = capture.observations.map(item => ({ ...item, ageDays: ageDays(item.createdAt, now) }));
  const listings = dedupeListings(observations)
    .sort((left, right) => left.bestRank - right.bestRank || (right.favorites ?? -1) - (left.favorites ?? -1));
  const sourceAgeHours = Math.max(0, (now.getTime() - capturedMilliseconds) / 3_600_000);
  const alerts = [];
  if (sourceAgeHours > 36) {
    alerts.push({
      severity: 'warning',
      code: 'MARKET_DATA_STALE',
      title: 'Marktdata is verouderd',
      message: `De laatste officiële Etsy-snapshot is ${Math.floor(sourceAgeHours)} uur oud.`,
    });
  }
  const sampledCount = keywordRows.reduce((sum, row) => sum + row.sampledCount, 0);
  const priceSampleCount = keywordRows.reduce((sum, row) => sum + row.priceSampleCount, 0);
  const priceCoverage = priceSampleCount / Math.max(1, sampledCount);
  if (priceCoverage < 0.25) {
    alerts.push({
      severity: 'info',
      code: 'PRICE_CURRENCY_SEGMENTED',
      title: 'Prijzen zijn per valuta gescheiden',
      message: `EUR-prijsbanden gebruiken ${Math.round(priceCoverage * 100)}% van de steekproef; valuta's worden nooit opgeteld.`,
    });
  }
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    taskId: TASK_ID,
    generatedAt: now.toISOString(),
    status: {
      state: sourceAgeHours > 36 ? 'stale' : 'connected',
      message: `${keywordRows.length} zoekintenties en ${listings.length} unieke concurrentlistings geanalyseerd.`,
    },
    contract: {
      ownShopExcluded: OWN_SHOP,
      ownListingIdsExcluded: [...config.ownListingIds],
      currencyCode: config.currencyCode,
      keywordCount: config.keywords.length,
    },
    source: {
      provider: PROVIDER,
      endpoint: 'GET /v3/application/listings/active',
      capturedAt: capture.capturedAt,
      requestCount: capture.requestCount,
      qpdRemaining: capture.qpdRemaining,
      qpsRemaining: capture.qpsRemaining,
      access: 'application-key-read-only',
      ageHours: round(sourceAgeHours),
    },
    evidence: {
      sampledObservations: capture.observations.length,
      uniqueListings: listings.length,
      ownExcludedCount: capture.ownExcludedCount,
      capturedDate: capture.capturedDate,
    },
    keywords: keywordRows,
    listings,
    shops: shopRanking(listings),
    titlePhrases: titlePhrases(listings),
    tagSignals: tagSignals(listings),
    alerts,
    limitations: marketLimitations(),
    secretValuesReported: false,
  });
}

function dashboardPayload(database, config, now) {
  const run = latestRun(database);
  const listingView = listingViewSummary(database);
  if (!run) return {
    schemaVersion: SCHEMA_VERSION,
    taskId: TASK_ID,
    generatedAt: now.toISOString(),
    status: { state: 'empty', message: 'Nog geen officiële Etsy-concurrentiesnapshot beschikbaar.' },
    contract: { ownShopExcluded: OWN_SHOP, ownListingIdsExcluded: [...config.ownListingIds], currencyCode: config.currencyCode, keywordCount: config.keywords.length },
    source: { provider: PROVIDER, endpoint: 'GET /v3/application/listings/active', capturedAt: null, requestCount: 0, qpdRemaining: null, qpsRemaining: null, access: 'application-key-read-only' },
    keywords: config.keywords.map(keyword => ({ ...keyword, resultCount: null, sampledCount: 0, uniqueShops: 0, priceSampleCount: 0, medianPriceMinor: null, p25PriceMinor: null, p75PriceMinor: null, medianFavorites: null, newListings30d: 0, ownExcludedCount: 0, opportunityIndex: null, confidence: 'low' })),
    listings: [], shops: [], titlePhrases: [], tagSignals: [], ranges: Object.fromEntries(Object.keys(RANGE_DAYS).map(key => [key, []])), listingView,
    alerts: [{ severity: 'warning', code: 'MARKET_SNAPSHOT_MISSING', title: 'Concurrentiesnapshot ontbreekt', message: 'Voer de read-only Etsy-marktplaatssync uit.' }],
    limitations: marketLimitations(),
    secretValuesReported: false,
  };
  const keywordRows = calculateOpportunityIndexes(database.prepare('SELECT * FROM keyword_snapshots WHERE run_id=? ORDER BY keyword_id').all(run.run_id).map(mapKeywordRow));
  const observations = database.prepare('SELECT * FROM listing_observations WHERE run_id=? ORDER BY keyword_id, rank').all(run.run_id).map(row => ({
    keywordId: row.keyword_id, rank: row.rank, listingId: row.listing_id, shopId: row.shop_id,
    title: row.title, url: row.url, priceMinor: row.price_minor, currencyCode: row.currency_code,
    favorites: row.favorites, createdAt: row.created_at, updatedAt: row.updated_at,
    ageDays: ageDays(row.created_at, now), tags: JSON.parse(row.tags_json),
  }));
  const listings = dedupeListings(observations).sort((a, b) => a.bestRank - b.bestRank || (b.favorites ?? -1) - (a.favorites ?? -1));
  const sourceAgeHours = Math.max(0, (now.getTime() - Date.parse(run.captured_at)) / 3_600_000);
  const alerts = [];
  if (sourceAgeHours > 36) alerts.push({ severity: 'warning', code: 'MARKET_DATA_STALE', title: 'Marktdata is verouderd', message: `De laatste officiële Etsy-snapshot is ${Math.floor(sourceAgeHours)} uur oud.` });
  if (listingView.state === 'missing') alerts.push({ severity: 'info', code: 'LISTINGVIEW_OPTIONAL_MISSING', title: 'ListingView is aanvullend', message: 'Officiële Etsy-analyse werkt volledig; ListingView-estimates kunnen later via een toegestane export worden toegevoegd.' });
  const priceCoverage = keywordRows.reduce((sum, row) => sum + row.priceSampleCount, 0) / Math.max(1, keywordRows.reduce((sum, row) => sum + row.sampledCount, 0));
  if (priceCoverage < 0.25) alerts.push({ severity: 'info', code: 'PRICE_CURRENCY_SEGMENTED', title: 'Prijzen zijn per valuta gescheiden', message: `Etsy retourneert native listingvaluta’s; EUR-prijsbanden gebruiken ${Math.round(priceCoverage * 100)}% van de steekproef en valuta’s worden nooit opgeteld.` });
  if (listingView.ambiguousCount > 0) alerts.push({ severity: 'warning', code: 'LISTINGVIEW_AMBIGUOUS_VALUES', title: 'ListingView-getallen vragen controle', message: `${listingView.ambiguousCount} locale getallen zijn fail-closed buiten berekeningen gehouden.` });
  return {
    schemaVersion: SCHEMA_VERSION,
    taskId: TASK_ID,
    generatedAt: now.toISOString(),
    status: { state: sourceAgeHours > 36 ? 'stale' : 'connected', message: `${keywordRows.length} zoekintenties en ${listings.length} unieke concurrentlistings geanalyseerd.` },
    contract: { ownShopExcluded: OWN_SHOP, ownListingIdsExcluded: [...config.ownListingIds], currencyCode: config.currencyCode, keywordCount: config.keywords.length },
    source: { provider: PROVIDER, endpoint: 'GET /v3/application/listings/active', capturedAt: run.captured_at, requestCount: run.request_count, qpdRemaining: run.qpd_remaining, qpsRemaining: run.qps_remaining, access: 'application-key-read-only', ageHours: round(sourceAgeHours) },
    evidence: { sampledObservations: run.observation_count, uniqueListings: run.unique_listing_count, ownExcludedCount: run.own_excluded_count, capturedDate: run.captured_date },
    keywords: keywordRows,
    listings,
    shops: shopRanking(listings),
    titlePhrases: titlePhrases(listings),
    tagSignals: tagSignals(listings),
    ranges: Object.fromEntries(Object.entries(RANGE_DAYS).map(([key, days]) => [key, rangeTrends(database, days, now)])),
    listingView,
    alerts,
    limitations: marketLimitations(),
    secretValuesReported: false,
  };
}

function marketLimitations() {
  return [
    'Etsy Open API-marktplaatsdata bevat geen betrouwbare verkopen, omzet, zoekvolume, impressies of CTR; deze waarden worden niet verzonnen.',
    'Het officiële resultaataantal meet querysaturatie; de listingsteekproef is begrensd tot de geconfigureerde pagina’s en is geen volledige marktpopulatie.',
    'Etsy retourneert bij de marktplaatsroute native listingvaluta’s. Prijsbanden gebruiken uitsluitend de geconfigureerde EUR-sectie; verschillende valuta’s worden nooit samengevoegd.',
    'De marktruimte-index is een relatieve portfolioscore op officiële saturatie, zichtbare favorieten, prijs en toetredingsdruk; het is geen omzet- of verkoopvoorspelling.',
    'Shopnamen zijn niet nodig voor rangschikking en worden zonder extra OAuth-authority als veilige shop-ID’s weergegeven.',
    'ListingView-signalen zijn derde-partijschattingen, blijven strikt gescheiden en worden alleen uit toegestane exports geïmporteerd.',
    'ListingView Support heeft bevestigd dat API/MCP nog in ontwikkeling is en geen releasedatum heeft.',
  ];
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(field); field = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some(cell => cell.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  row.push(field);
  if (row.some(cell => cell.trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return normalizedText(value).replace(/[^a-z0-9]+/gu, ' ').trim();
}

function findColumn(headers, aliases) {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const index = normalized.indexOf(alias);
    if (index >= 0) return index;
  }
  return -1;
}

function localizedNumber(raw, kind = 'decimal') {
  const original = cleanText(raw, 100);
  if (!original || /^(?:n\/?a|null|undefined|-)$/iu.test(original)) return { value: null, ambiguous: false };
  const percent = original.includes('%');
  let value = original.replace(/[\s\u00a0$€£¥%]/gu, '').replace(/^\((.*)\)$/u, '-$1');
  if (!/^-?[0-9][0-9.,]*$/u.test(value)) return { value: null, ambiguous: true };
  const unsigned = value.replace(/^-/, '');
  const dots = (unsigned.match(/\./gu) ?? []).length;
  const commas = (unsigned.match(/,/gu) ?? []).length;
  if (dots && commas) value = unsigned.lastIndexOf('.') > unsigned.lastIndexOf(',') ? value.replaceAll(',', '') : value.replaceAll('.', '').replace(',', '.');
  else if (dots > 1 && /^\d{1,3}(\.\d{3})+$/u.test(unsigned)) value = value.replaceAll('.', '');
  else if (commas > 1 && /^\d{1,3}(,\d{3})+$/u.test(unsigned)) value = value.replaceAll(',', '');
  else if (dots === 1 || commas === 1) {
    const separator = dots ? '.' : ',';
    const [whole, fraction] = unsigned.split(separator);
    const grouped = ['integer', 'money'].includes(kind) && fraction.length === 3 && whole.length <= 3;
    value = grouped ? value.replace(separator, '') : value.replace(',', '.');
  }
  const number = Number(value);
  if (!Number.isFinite(number)) return { value: null, ambiguous: true };
  return { value: percent ? number / 100 : number, ambiguous: false };
}

export function parseListingViewCsv(text) {
  const rows = parseCsv(text.replace(/^\uFEFF/u, ''));
  const headers = rows[0] ?? [];
  const columns = {
    keyword: findColumn(headers, ['keyword', 'keywords', 'title', 'listing title', 'tag', 'shop name']),
    searchVolume: findColumn(headers, ['search volume', 'searches', 'volume']),
    competition: findColumn(headers, ['competition', 'competing listings', 'results', 'listing count', 'total listings']),
    price: findColumn(headers, ['price', 'average price', 'avg price']),
    favorites: findColumn(headers, ['favorites', 'favourites']),
    estimatedSales: findColumn(headers, ['estimated sales', 'monthly sales', '6mo sales', 'total sales', 'avg total sales', 'sales']),
    estimatedRevenue: findColumn(headers, ['estimated revenue', 'monthly revenue', '6mo revenue', 'total revenue', 'avg total revenue', 'gross sales', 'revenue']),
    conversionRate: findColumn(headers, ['conversion rate', 'conversion']),
  };
  assert(columns.keyword >= 0, 'LISTINGVIEW_SCHEMA_UNRECOGNIZED', 'De ListingView-CSV heeft geen herkenbare keyword- of titelkolom.');
  let ambiguousCount = 0;
  const records = rows.slice(1).map((row, index) => {
    const metric = (column, kind) => {
      if (column < 0) return null;
      const parsed = localizedNumber(row[column], kind);
      if (parsed.ambiguous) ambiguousCount += 1;
      return parsed.value;
    };
    return {
      sourceRow: index + 2,
      keyword: cleanText(row[columns.keyword], 500),
      searchVolume: metric(columns.searchVolume, 'integer'),
      competition: metric(columns.competition, 'integer'),
      price: metric(columns.price, 'money'),
      favorites: metric(columns.favorites, 'integer'),
      estimatedSales: metric(columns.estimatedSales, 'integer'),
      estimatedRevenue: metric(columns.estimatedRevenue, 'money'),
      conversionRate: metric(columns.conversionRate, 'percentage'),
    };
  }).filter(record => record.keyword);
  const normalizedHeaders = new Set(headers.map(normalizeHeader));
  const sourceType = normalizedHeaders.has('shop name') ? 'shops'
    : normalizedHeaders.has('competing listings') ? 'similar-keywords'
    : normalizedHeaders.has('listing title') ? 'top-listings'
      : normalizedHeaders.has('tag') ? 'tags' : 'listings';
  return { records, ambiguousCount, sourceType };
}

async function csvFiles(inputPath) {
  const resolved = path.resolve(inputPath);
  const info = await lstat(resolved).catch(() => null);
  assert(info && !info.isSymbolicLink(), 'LISTINGVIEW_INPUT_UNSAFE', 'De ListingView-invoer ontbreekt of is een symbolic link.');
  if (info.isFile()) return [resolved];
  assert(info.isDirectory(), 'LISTINGVIEW_INPUT_UNSAFE', 'De ListingView-invoer is geen bestand of map.');
  const files = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en-US'));
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await walk(candidate);
      else if (entry.isFile() && path.extname(entry.name).toLocaleLowerCase('en-US') === '.csv') files.push(candidate);
      assert(files.length <= MAX_CSV_FILES, 'LISTINGVIEW_INPUT_TOO_LARGE', 'De ListingView-invoer bevat te veel CSV-bestanden.');
    }
  }
  await walk(resolved);
  return files;
}

async function importListingView(database, inputPath, now) {
  const files = await csvFiles(inputPath);
  assert(files.length > 0, 'LISTINGVIEW_INPUT_EMPTY', 'Geen ListingView-CSV-bestanden gevonden.');
  let importedFiles = 0;
  let skippedFiles = 0;
  let importedRecords = 0;
  let ambiguousCount = 0;
  for (const filePath of files) {
    const bytes = await readRegularFile(filePath, MAX_CSV_BYTES, 'ListingView CSV');
    const hash = sha256(bytes);
    if (database.prepare('SELECT 1 FROM listingview_imports WHERE source_sha256=?').get(hash)) { skippedFiles += 1; continue; }
    const parsed = parseListingViewCsv(bytes.toString('utf8'));
    assert(importedRecords + parsed.records.length <= MAX_LISTINGVIEW_RECORDS, 'LISTINGVIEW_INPUT_TOO_LARGE', 'De ListingView-invoer overschrijdt de recordlimiet.');
    begin(database, () => {
      const result = database.prepare(`INSERT INTO listingview_imports (imported_at,source_file,source_sha256,source_type,record_count,ambiguous_count,status) VALUES (?,?,?,?,?,?,?)`).run(
        now.toISOString(), path.basename(filePath), hash, parsed.sourceType, parsed.records.length, parsed.ambiguousCount, parsed.ambiguousCount ? 'review' : 'imported',
      );
      const insert = database.prepare(`INSERT INTO listingview_records (import_id,source_row,keyword,search_volume,competition,price,favorites,estimated_sales,estimated_revenue,conversion_rate) VALUES (?,?,?,?,?,?,?,?,?,?)`);
      for (const record of parsed.records) insert.run(
        result.lastInsertRowid, record.sourceRow, record.keyword, record.searchVolume, record.competition,
        record.price, record.favorites, record.estimatedSales, record.estimatedRevenue, record.conversionRate,
      );
    });
    importedFiles += 1;
    importedRecords += parsed.records.length;
    ambiguousCount += parsed.ambiguousCount;
  }
  return { importedFiles, skippedFiles, importedRecords, ambiguousCount };
}

export async function createMarketStore({ rootPath, configPath, envPath, now = () => new Date() }) {
  const root = await ensureRoot(rootPath);
  const config = await readMarketConfig(configPath);
  const databasePath = path.join(root, 'etsy-market-intelligence.sqlite');
  const dashboardPath = path.join(root, 'dashboard.json');
  const statusPath = path.join(root, 'status.json');
  const database = new DatabaseSync(databasePath);
  initializeSchema(database);

  async function buildDashboard() {
    const generated = dashboardPayload(database, config, now());
    await atomicJson(dashboardPath, generated);
    await atomicJson(statusPath, {
      schemaVersion: SCHEMA_VERSION, taskId: TASK_ID, state: generated.status.state,
      message: generated.status.message, generatedAt: generated.generatedAt, secretValuesReported: false,
    });
    return generated;
  }

  return Object.freeze({
    paths: Object.freeze({ root, databasePath, dashboardPath, statusPath }),
    config,
    async initialize() {
      const dashboard = await buildDashboard();
      return { ok: true, taskId: TASK_ID, command: 'init', state: dashboard.status.state, keywordCount: config.keywords.length, secretValuesReported: false };
    },
    async sync(options = {}) {
      const captured = now();
      assert(captured instanceof Date && Number.isFinite(captured.getTime()), 'CLOCK_INVALID', 'De runtimeklok is ongeldig.');
      const authority = await readEtsyPublicAuthority(envPath);
      const capture = await captureMarketplaceSnapshot({
        config,
        apiKeyHeader: authority.apiKeyHeader,
        ownShopId: authority.ownShopId,
        capturedAt: captured,
        ...options,
      });
      insertSuccessfulRun(database, capture);
      const evidence = {
        schemaVersion: SCHEMA_VERSION, taskId: TASK_ID, capturedAt: capture.capturedAt,
        source: { provider: PROVIDER, endpoint: 'GET /v3/application/listings/active', access: 'application-key-read-only', requestCount: capture.requestCount, qpdRemaining: capture.qpdRemaining, qpsRemaining: capture.qpsRemaining },
        contract: { ownShopExcluded: OWN_SHOP, ownListingIdsExcluded: [...config.ownListingIds], currencyCode: config.currencyCode },
        keywords: calculateOpportunityIndexes(capture.keywords),
        observations: capture.observations,
        secretValuesReported: false,
      };
      const evidenceHash = sha256(JSON.stringify(evidence));
      const evidencePath = path.join(root, 'evidence', 'etsy-open-api', `${capture.capturedDate}-${evidenceHash.slice(0, 16)}.json`);
      try { await readRegularFile(evidencePath, 100 * 1024 * 1024, 'evidence'); } catch (error) {
        if (error.code === 'EVIDENCE_MISSING') await atomicJson(evidencePath, evidence); else throw error;
      }
      const dashboard = await buildDashboard();
      return {
        ok: true, taskId: TASK_ID, command: 'sync', capturedAt: capture.capturedAt,
        keywordCount: capture.keywords.length, requestCount: capture.requestCount, observations: capture.observations.length,
        uniqueCompetitorListings: dashboard.evidence.uniqueListings, ownExcludedCount: capture.ownExcludedCount,
        qpdRemaining: capture.qpdRemaining, dashboardPath, evidencePath, secretValuesReported: false,
      };
    },
    async importListingView(inputPath) {
      assert(typeof inputPath === 'string' && inputPath.trim(), 'LISTINGVIEW_INPUT_MISSING', 'Een ListingView-invoerpad is verplicht.');
      const result = await importListingView(database, inputPath, now());
      await buildDashboard();
      return { ok: true, taskId: TASK_ID, command: 'import-listingview', ...result, metricClass: 'third-party-estimate', secretValuesReported: false };
    },
    async buildDashboard() {
      const dashboard = await buildDashboard();
      return { ok: true, taskId: TASK_ID, command: 'build-dashboard', state: dashboard.status.state, keywordCount: dashboard.keywords.length, listingCount: dashboard.listings.length, dashboardPath, secretValuesReported: false };
    },
    close() { database.close(); },
  });
}

function cliArguments(argv) {
  const [command = 'init', ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    assert(/^--(?:root|config|env|input)$/u.test(key ?? '') && typeof value === 'string', 'CLI_INVALID', 'Ongeldige Etsy Market Intelligence-argumenten.');
    options[key.slice(2)] = value;
  }
  return { command, options };
}

async function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const defaults = {
    root: path.join(process.env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local'), 'FinanceOS', 'etsy-market-intelligence', TASK_ID),
    config: path.join(scriptDirectory, 'config.json'),
    env: path.resolve(scriptDirectory, '..', '..', '.env'),
  };
  const { command, options } = cliArguments(process.argv.slice(2));
  const store = await createMarketStore({ rootPath: options.root ?? defaults.root, configPath: options.config ?? defaults.config, envPath: options.env ?? defaults.env });
  try {
    const result = command === 'init' ? await store.initialize()
      : command === 'sync' ? await store.sync()
        : command === 'import-listingview' ? await store.importListingView(options.input)
          : command === 'build-dashboard' ? await store.buildDashboard()
            : (() => { throw new EtsyMarketError('CLI_INVALID', 'Onbekend Etsy Market Intelligence-commando.'); })();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    store.close();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    const safe = error instanceof EtsyMarketError ? error : new EtsyMarketError('MARKET_INTELLIGENCE_FAILED', cleanText(error?.message, 300));
    process.stderr.write(`${JSON.stringify({ ok: false, taskId: TASK_ID, code: safe.code, error: safe.message, secretValuesReported: false })}\n`);
    process.exitCode = 1;
  });
}
