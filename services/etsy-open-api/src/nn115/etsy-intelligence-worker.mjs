import {
  buildPortableMarketProjection,
  captureMarketplaceSnapshot,
  readMarketConfig,
} from '../vendor/nn101/EtsyMarketIntelligence.mjs';
import { hashCanonical } from './execution-contract.mjs';

const ETSY_API_BASE = 'https://openapi.etsy.com';
const SHOP_ID = /^[1-9][0-9]{0,18}$/u;
const HEADER_VALUE = /^[^\r\n]{1,2048}$/u;
const GENERIC_PRODUCT_WORDS = new Set([
  'and', 'digital', 'download', 'excel', 'finance', 'for', 'planner',
  'spreadsheet', 'template', 'the', 'tracker', 'with', 'your',
]);

export class EtsyWorkerError extends Error {
  constructor(code, message, statusCode = 502) {
    super(message);
    this.name = 'EtsyWorkerError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ControlledInterruptionError extends Error {
  constructor() {
    super('Controlled interruption after durable checkpoint.');
    this.name = 'ControlledInterruptionError';
    this.code = 'CONTROLLED_INTERRUPTION';
    this.statusCode = 503;
  }
}

function fail(code, message, statusCode) {
  throw new EtsyWorkerError(code, message, statusCode);
}

function credential(value, label) {
  if (typeof value !== 'string' || !HEADER_VALUE.test(value) || value.trim().length < 3) {
    fail('ETSY_AUTHORITY_MISSING', `${label} is unavailable.`, 503);
  }
  return value;
}

export function loadReadOnlyEtsyAuthority(env = process.env) {
  const keystring = credential(env.ETSY_API_KEYSTRING, 'Etsy keystring');
  const sharedSecret = credential(env.ETSY_SHARED_SECRET, 'Etsy shared secret');
  const ownShopId = String(env.ETSY_SHOP_ID ?? '');
  if (!SHOP_ID.test(ownShopId)) fail('ETSY_AUTHORITY_MISSING', 'Etsy shop binding is unavailable.', 503);
  return Object.freeze({ apiKeyHeader: `${keystring}:${sharedSecret}`, ownShopId });
}

function boundedInteger(value, fallback, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(30_000, retryAfter * 1_000);
  return Math.min(30_000, 1_000 * (2 ** (attempt - 1)));
}

async function fetchOwnCatalog({ authority, fetchImpl, delay }) {
  const listings = [];
  let requestCount = 0;
  let offset = 0;
  let total = null;
  while (offset < 500 && (total === null || offset < total)) {
    const url = new URL(`/v3/application/shops/${authority.ownShopId}/listings/active`, ETSY_API_BASE);
    url.searchParams.set('limit', '100');
    url.searchParams.set('offset', String(offset));
    let response;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await fetchImpl(url, {
          method: 'GET',
          headers: { accept: 'application/json', 'x-api-key': authority.apiKeyHeader },
          redirect: 'error',
          signal: AbortSignal.timeout(30_000),
        });
      } catch {
        if (attempt < 3) {
          await delay(retryDelay(null, attempt));
          continue;
        }
        fail('ETSY_CATALOG_TRANSPORT_FAILED', 'Etsy catalog read failed.');
      }
      requestCount += 1;
      if (response.ok) break;
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      if (retryable && attempt < 3) {
        await delay(retryDelay(response, attempt));
        continue;
      }
      fail(
        response.status === 401 || response.status === 403 ? 'ETSY_CATALOG_AUTHORITY_REJECTED' : 'ETSY_CATALOG_READ_FAILED',
        `Etsy catalog read stopped at HTTP ${response.status}.`,
        response.status,
      );
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      fail('ETSY_CATALOG_SCHEMA_INVALID', 'Etsy catalog response is not valid JSON.');
    }
    if (!payload || !Number.isSafeInteger(Number(payload.count)) || !Array.isArray(payload.results) || payload.results.length > 100) {
      fail('ETSY_CATALOG_SCHEMA_INVALID', 'Etsy catalog response has an invalid schema.');
    }
    total = Number(payload.count);
    for (const item of payload.results) {
      const listingId = String(item?.listing_id ?? '');
      const shopId = String(item?.shop_id ?? authority.ownShopId);
      const title = String(item?.title ?? '').replace(/\s+/gu, ' ').trim().slice(0, 500);
      if (!SHOP_ID.test(listingId) || shopId !== authority.ownShopId || title.length < 1 || String(item?.state) !== 'active') {
        fail('ETSY_CATALOG_SCHEMA_INVALID', 'Etsy catalog contains an invalid listing.');
      }
      listings.push(Object.freeze({
        listingId,
        title,
        tags: Array.isArray(item.tags) ? item.tags.slice(0, 30).map(tag => String(tag).replace(/\s+/gu, ' ').trim().slice(0, 100)).filter(Boolean) : [],
      }));
    }
    if (payload.results.length < 100) break;
    offset += payload.results.length;
  }
  return Object.freeze({ listings: Object.freeze(listings), requestCount });
}

function tokens(value) {
  return new Set(String(value ?? '')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/u)
    .filter(word => word.length > 2 && !GENERIC_PRODUCT_WORDS.has(word)));
}

function duplicateEvidence(keyword, catalogListings) {
  const opportunityTokens = tokens(`${keyword.label} ${keyword.query}`);
  const duplicates = [];
  for (const listing of catalogListings) {
    const listingTokens = tokens(`${listing.title} ${listing.tags.join(' ')}`);
    const overlap = [...opportunityTokens].filter(token => listingTokens.has(token)).length;
    const ratio = overlap / Math.max(1, opportunityTokens.size);
    if (overlap >= 2 && ratio >= 0.6) duplicates.push(listing.listingId);
  }
  return Object.freeze({ duplicateRisk: duplicates.length > 0, duplicateListingIds: Object.freeze(duplicates) });
}

function nextDailyRun(now) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 6, 0, 0));
  return next.toISOString();
}

function snapshotIsFresh(snapshot, now, freshnessHours) {
  const captured = Date.parse(snapshot?.capturedAt ?? '');
  if (!Number.isFinite(captured) || captured > now.getTime() + 5 * 60_000) return false;
  return now.getTime() - captured < freshnessHours * 3_600_000;
}

function resultFromSnapshot({ executionId, snapshot, outcome, providerCalls }) {
  return Object.freeze({
    resultId: `nn115-result-${hashCanonical(`${executionId}:${snapshot.snapshotHash}`).slice(0, 32)}`,
    executionId,
    taskId: 'NN-115',
    specialistTaskId: 'NN-101',
    outcome,
    snapshotId: snapshot.snapshotId,
    snapshotHash: snapshot.snapshotHash,
    capturedAt: snapshot.capturedAt,
    providerCalls,
    observations: snapshot.evidence?.sampledObservations ?? 0,
    shops: snapshot.evidence?.uniqueShops ?? snapshot.shops?.length ?? 0,
    ownExclusions: snapshot.evidence?.ownExcludedCount ?? 0,
    ownCatalogListings: snapshot.catalog?.listingCount ?? 0,
    rankedOpportunities: snapshot.rankedOpportunities ?? [],
    recommendedOpportunity: snapshot.recommendedOpportunity ?? null,
    publication: Object.freeze({ allowed: false, approvalRequired: true, state: 'AWAITING_APPROVAL' }),
    nextEligibleRun: snapshot.nextEligibleRun,
    secretValuesReported: false,
  });
}

export class EtsyIntelligenceWorker {
  constructor({
    store,
    config,
    authority,
    fetchImpl = globalThis.fetch,
    delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    clock = Date.now,
    freshnessHours = 30,
    heartbeatMs = null,
    afterCheckpoint = async () => {},
  }) {
    if (
      !store
      || typeof store.readLatestSnapshot !== 'function'
      || typeof store.writeCheckpoint !== 'function'
      || typeof store.renewExecutionLease !== 'function'
      || typeof store.publishDailySnapshot !== 'function'
    ) {
      fail('WORKER_CONFIG_INVALID', 'Durable store is required.', 500);
    }
    if (!config || !Array.isArray(config.keywords) || config.keywords.length < 1) fail('WORKER_CONFIG_INVALID', 'NN-101 config is required.', 500);
    if (!authority || !HEADER_VALUE.test(authority.apiKeyHeader ?? '') || !SHOP_ID.test(authority.ownShopId ?? '')) {
      fail('WORKER_CONFIG_INVALID', 'Read-only Etsy authority is required.', 500);
    }
    if (typeof fetchImpl !== 'function' || typeof clock !== 'function' || typeof afterCheckpoint !== 'function') {
      fail('WORKER_CONFIG_INVALID', 'Worker dependencies are invalid.', 500);
    }
    this.store = store;
    this.config = config;
    this.authority = authority;
    this.fetch = fetchImpl;
    this.delay = delay;
    this.clock = clock;
    this.freshnessHours = boundedInteger(freshnessHours, 30, 1, 168);
    const defaultHeartbeatMs = Math.min(60_000, Math.max(250, Math.floor((store.leaseMs ?? 300_000) / 3)));
    this.heartbeatMs = boundedInteger(heartbeatMs, defaultHeartbeatMs, 10, 100_000);
    this.afterCheckpoint = afterCheckpoint;
  }

  async run({ executionId, claim, control = null }) {
    let heartbeatError = null;
    let heartbeatTail = Promise.resolve();
    const renewLease = () => this.store.renewExecutionLease(executionId, claim);
    await renewLease();
    const heartbeat = setInterval(() => {
      heartbeatTail = heartbeatTail
        .then(renewLease)
        .catch((error) => { heartbeatError ??= error; });
    }, this.heartbeatMs);
    heartbeat.unref?.();
    const assertLease = async () => {
      await heartbeatTail;
      if (heartbeatError) throw heartbeatError;
      await renewLease();
    };
    try {
      return await this.#executeWithLease({ executionId, claim, control }, assertLease);
    } finally {
      clearInterval(heartbeat);
      await heartbeatTail;
    }
  }

  async #executeWithLease({ executionId, claim, control }, assertLease) {
    const now = new Date(this.clock());
    if (!Number.isFinite(now.getTime())) fail('CLOCK_INVALID', 'Worker clock is invalid.', 500);
    const controlledInterruption = control?.controlledInterruption === true;
    let interruptionFired = controlledInterruption
      ? await this.store.readCheckpoint(executionId, 'controlled-interruption-fired')
      : null;
    const latest = await this.store.readLatestSnapshot();
    if (snapshotIsFresh(latest, now, this.freshnessHours)) {
      return resultFromSnapshot({ executionId, snapshot: latest, outcome: 'NOOP_FRESH', providerCalls: 0 });
    }

    const captures = [];
    for (const keyword of this.config.keywords) {
      const checkpointName = `etsy-keyword-${keyword.id}`;
      let capture = await this.store.readCheckpoint(executionId, checkpointName);
      if (!capture) {
        const keywordConfig = Object.freeze({ ...this.config, keywords: Object.freeze([keyword]) });
        capture = await captureMarketplaceSnapshot({
          config: keywordConfig,
          apiKeyHeader: this.authority.apiKeyHeader,
          ownShopId: this.authority.ownShopId,
          capturedAt: now,
          fetchImpl: this.fetch,
          delay: this.delay,
        });
        await this.store.writeCheckpoint(executionId, claim, checkpointName, capture);
        await this.afterCheckpoint({ type: 'keyword', id: keyword.id, checkpointName });
        if (controlledInterruption && !interruptionFired) {
          interruptionFired = Object.freeze({
            schemaVersion: '1.0.0',
            taskId: 'NN-115',
            checkpointName,
            firedAt: now.toISOString(),
            secretValuesReported: false,
          });
          await this.store.writeCheckpoint(executionId, claim, 'controlled-interruption-fired', interruptionFired);
          throw new ControlledInterruptionError();
        }
      }
      captures.push(capture);
    }

    let catalog = await this.store.readCheckpoint(executionId, 'etsy-own-catalog');
    if (!catalog) {
      catalog = await fetchOwnCatalog({ authority: this.authority, fetchImpl: this.fetch, delay: this.delay });
      await this.store.writeCheckpoint(executionId, claim, 'etsy-own-catalog', catalog);
      await this.afterCheckpoint({ type: 'catalog', id: this.authority.ownShopId, checkpointName: 'etsy-own-catalog' });
    }

    const capture = Object.freeze({
      runId: `daily:${now.toISOString().slice(0, 10)}`,
      capturedAt: now.toISOString(),
      capturedDate: now.toISOString().slice(0, 10),
      requestCount: captures.reduce((sum, item) => sum + item.requestCount, 0),
      qpdRemaining: captures.map(item => item.qpdRemaining).filter(Number.isFinite).sort((left, right) => left - right)[0] ?? null,
      qpsRemaining: captures.map(item => item.qpsRemaining).filter(Number.isFinite).sort((left, right) => left - right)[0] ?? null,
      ownExcludedCount: captures.reduce((sum, item) => sum + item.ownExcludedCount, 0),
      keywords: Object.freeze(captures.flatMap(item => item.keywords)),
      observations: Object.freeze(captures.flatMap(item => item.observations)),
    });
    const projection = buildPortableMarketProjection({ capture, config: this.config, now });
    const rankedOpportunities = Object.freeze([...projection.keywords]
      .sort((left, right) => right.opportunityIndex - left.opportunityIndex || left.id.localeCompare(right.id, 'en-US'))
      .map(keyword => Object.freeze({
        keywordId: keyword.id,
        label: keyword.label,
        query: keyword.query,
        opportunityIndex: keyword.opportunityIndex,
        confidence: keyword.confidence,
        resultCount: keyword.resultCount,
        sampledCount: keyword.sampledCount,
        ...duplicateEvidence(keyword, catalog.listings),
      })));
    const recommendedOpportunity = rankedOpportunities.find(item => !item.duplicateRisk) ?? null;
    const snapshotCore = {
      schemaVersion: '1.0.0',
      taskId: 'NN-101',
      snapshotId: `etsy:daily:${capture.capturedDate}`,
      canonicalIdentity: `etsy:daily:${capture.capturedDate}`,
      capturedAt: capture.capturedAt,
      nextEligibleRun: nextDailyRun(now),
      source: projection.source,
      evidence: {
        ...projection.evidence,
        uniqueShops: projection.shops.length,
      },
      contract: projection.contract,
      keywords: projection.keywords,
      listings: projection.listings.slice(0, 250),
      shops: projection.shops,
      titlePhrases: projection.titlePhrases,
      tagSignals: projection.tagSignals,
      catalog: {
        shopId: this.authority.ownShopId,
        checkedAt: now.toISOString(),
        listingCount: catalog.listings.length,
        listings: catalog.listings.slice(0, 100),
      },
      rankedOpportunities,
      recommendedOpportunity,
      alerts: projection.alerts,
      limitations: projection.limitations,
      publication: { allowed: false, approvalRequired: true },
      secretValuesReported: false,
    };
    const snapshot = Object.freeze({ ...snapshotCore, snapshotHash: hashCanonical(snapshotCore) });
    await assertLease();
    const published = await this.store.publishDailySnapshot(executionId, claim, capture.capturedDate, snapshot);
    return resultFromSnapshot({
      executionId,
      snapshot: published.snapshot,
      outcome: published.created ? 'REFRESHED' : 'DUPLICATE_PREVENTED',
      providerCalls: capture.requestCount + catalog.requestCount,
    });
  }
}

export async function createEtsyIntelligenceWorker(env = process.env, dependencies = {}) {
  const config = dependencies.config ?? await readMarketConfig(new URL('../vendor/nn101/config.json', import.meta.url));
  return new EtsyIntelligenceWorker({
    config,
    authority: dependencies.authority ?? loadReadOnlyEtsyAuthority(env),
    ...dependencies,
  });
}
