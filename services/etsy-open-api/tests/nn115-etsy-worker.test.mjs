import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ControlledInterruptionError,
  EtsyIntelligenceWorker,
  loadReadOnlyEtsyAuthority,
} from '../src/nn115/etsy-intelligence-worker.mjs';

const OWN_LISTINGS = [
  '4545099189', '4545099579', '4545099893', '4545100025', '4545117498', '4545117616',
  '4545117926', '4545118344', '4545118486', '4545118638', '4549606111',
];

function configFixture() {
  return Object.freeze({
    taskId: 'NN-101',
    expectedShopName: 'NumberNinjaDesigns',
    ownListingIds: Object.freeze(OWN_LISTINGS),
    currencyCode: 'EUR',
    resultLimit: 25,
    pagesPerKeyword: 1,
    keywords: Object.freeze([
      Object.freeze({ id: 'monthly-budget', label: 'Monthly budget', query: 'monthly budget spreadsheet' }),
      Object.freeze({ id: 'debt-snowball', label: 'Debt snowball', query: 'debt snowball spreadsheet' }),
    ]),
  });
}

function listing(listingId, shopId, title, overrides = {}) {
  return {
    listing_id: listingId,
    shop_id: shopId,
    state: 'active',
    title,
    url: `https://www.etsy.com/listing/${listingId}/safe-listing`,
    price: { amount: 1499, divisor: 100, currency_code: 'EUR' },
    num_favorers: 30,
    original_creation_timestamp: Math.floor(Date.parse('2026-03-01T00:00:00.000Z') / 1000),
    last_modified_timestamp: Math.floor(Date.parse('2026-08-01T00:00:00.000Z') / 1000),
    tags: ['budget spreadsheet', 'finance planner'],
    ...overrides,
  };
}

class WorkerStoreFixture {
  constructor(latest = null) {
    this.latest = latest;
    this.checkpoints = new Map();
    this.published = 0;
    this.heartbeats = 0;
  }

  async readLatestSnapshot() {
    return structuredClone(this.latest);
  }

  async readCheckpoint(executionId, name) {
    return structuredClone(this.checkpoints.get(`${executionId}:${name}`) ?? null);
  }

  async writeCheckpoint(executionId, claim, name, value) {
    assert.equal(typeof claim.ownerId, 'string');
    this.checkpoints.set(`${executionId}:${name}`, structuredClone(value));
  }

  async renewExecutionLease(executionId, claim) {
    assert.equal(typeof executionId, 'string');
    assert.equal(typeof claim.ownerId, 'string');
    this.heartbeats += 1;
  }

  async publishDailySnapshot(executionId, claim, date, snapshot) {
    assert.equal(typeof executionId, 'string');
    assert.equal(typeof claim.ownerId, 'string');
    if (this.latest && this.latest.snapshotHash !== snapshot.snapshotHash) {
      const error = new Error('conflict');
      error.code = 'SNAPSHOT_CONFLICT';
      throw error;
    }
    const created = !this.latest;
    this.latest = structuredClone(snapshot);
    if (created) this.published += 1;
    return { created, snapshot: structuredClone(this.latest) };
  }
}

test('long provider work renews its execution lease before fenced snapshot publication', async () => {
  const calls = [];
  const store = new WorkerStoreFixture();
  const provider = providerFixture(calls);
  const worker = new EtsyIntelligenceWorker({
    store,
    config: configFixture(),
    authority: { apiKeyHeader: 'keystring-test:shared-secret-test', ownShopId: '67071325' },
    fetchImpl: async (...args) => {
      await new Promise(resolve => setTimeout(resolve, 35));
      return provider(...args);
    },
    clock: () => Date.parse('2026-08-08T08:00:00.000Z'),
    freshnessHours: 30,
    heartbeatMs: 10,
  });

  const result = await worker.run({
    executionId: 'nn115-exec-heartbeat',
    claim: { ownerId: 'cloud-a', fencingToken: 1 },
  });

  assert.equal(result.outcome, 'REFRESHED');
  assert(store.heartbeats >= 2);
  assert.equal(store.published, 1);
});

function providerFixture(calls) {
  return async (url, init) => {
    const parsed = new URL(url);
    calls.push({
      path: parsed.pathname,
      keyword: parsed.searchParams.get('keywords'),
      method: init.method,
      headerNames: Object.keys(init.headers).map(key => key.toLocaleLowerCase('en-US')),
    });
    if (parsed.pathname === '/v3/application/shops/67071325/listings/active') {
      return new Response(JSON.stringify({
        count: 2,
        results: [
          listing(OWN_LISTINGS[0], '67071325', 'Monthly Budget Planner Spreadsheet'),
          listing(OWN_LISTINGS[1], '67071325', 'Net Worth Tracker Dashboard'),
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    const monthly = parsed.searchParams.get('keywords')?.startsWith('monthly');
    return new Response(JSON.stringify({
      count: monthly ? 100 : 2_000,
      results: monthly
        ? [listing('9000000001', '8000000001', 'Monthly Budget Planner Spreadsheet', { num_favorers: 120, price: { amount: 2499, divisor: 100, currency_code: 'EUR' } })]
        : [listing('9000000002', '8000000002', 'Debt Snowball Payoff Tracker', { num_favorers: 20, price: { amount: 999, divisor: 100, currency_code: 'EUR' } })],
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-remaining-today': '900',
        'x-remaining-this-second': '9',
      },
    });
  };
}

test('read-only Etsy authority fails closed and never projects credential values', () => {
  const authority = loadReadOnlyEtsyAuthority({
    ETSY_API_KEYSTRING: 'keystring-test',
    ETSY_SHARED_SECRET: 'shared-secret-test',
    ETSY_SHOP_ID: '67071325',
  });
  assert.equal(authority.ownShopId, '67071325');
  assert.deepEqual(Object.keys(authority).sort(), ['apiKeyHeader', 'ownShopId']);
  assert.throws(
    () => loadReadOnlyEtsyAuthority({ ETSY_API_KEYSTRING: 'keystring-test' }),
    { code: 'ETSY_AUTHORITY_MISSING' },
  );
});

test('fresh durable snapshot returns NOOP_FRESH without any Etsy request or duplicate publication', async () => {
  const calls = [];
  const store = new WorkerStoreFixture({
    schemaVersion: '1.0.0',
    snapshotId: 'etsy:daily:2026-08-08',
    snapshotHash: 'a'.repeat(64),
    capturedAt: '2026-08-08T07:00:00.000Z',
    nextEligibleRun: '2026-08-09T06:00:00.000Z',
    evidence: { sampledObservations: 200, uniqueListings: 150, ownExcludedCount: 11 },
    source: { requestCount: 22 },
    rankedOpportunities: [{ keywordId: 'debt-snowball', duplicateRisk: false }],
    recommendedOpportunity: { keywordId: 'debt-snowball', duplicateRisk: false },
    catalog: { listingCount: 11, checkedAt: '2026-08-08T07:00:00.000Z' },
  });
  const worker = new EtsyIntelligenceWorker({
    store,
    config: configFixture(),
    authority: { apiKeyHeader: 'keystring-test:shared-secret-test', ownShopId: '67071325' },
    fetchImpl: providerFixture(calls),
    clock: () => Date.parse('2026-08-08T08:00:00.000Z'),
    freshnessHours: 30,
  });
  const result = await worker.run({ executionId: 'nn115-exec-fresh', claim: { ownerId: 'cloud-a', fencingToken: 1 } });
  assert.equal(result.outcome, 'NOOP_FRESH');
  assert.equal(result.providerCalls, 0);
  assert.equal(result.snapshotId, 'etsy:daily:2026-08-08');
  assert.equal(calls.length, 0);
  assert.equal(store.published, 0);
});

test('stale run uses only official Etsy GETs, reuses NN-101, checks own catalog, and publishes one canonical snapshot', async () => {
  const calls = [];
  const store = new WorkerStoreFixture();
  const worker = new EtsyIntelligenceWorker({
    store,
    config: configFixture(),
    authority: { apiKeyHeader: 'keystring-test:shared-secret-test', ownShopId: '67071325' },
    fetchImpl: providerFixture(calls),
    clock: () => Date.parse('2026-08-08T08:00:00.000Z'),
    freshnessHours: 30,
  });
  const input = { executionId: 'nn115-exec-stale', claim: { ownerId: 'cloud-a', fencingToken: 1 } };
  const first = await worker.run(input);
  const second = await worker.run(input);

  assert.equal(first.outcome, 'REFRESHED');
  assert.equal(second.outcome, 'NOOP_FRESH');
  assert.equal(store.published, 1);
  assert.equal(calls.length, 3);
  assert(calls.every(call => call.method === 'GET'));
  assert(calls.every(call => call.headerNames.includes('x-api-key')));
  assert(calls.every(call => !call.headerNames.includes('authorization')));
  assert.equal(first.observations, 2);
  assert.equal(first.shops, 2);
  assert.equal(first.ownCatalogListings, 2);
  assert.equal(first.ownExclusions, 0);
  assert.equal(first.rankedOpportunities[0].keywordId, 'monthly-budget');
  assert.equal(first.rankedOpportunities[0].duplicateRisk, true);
  assert.equal(first.recommendedOpportunity.keywordId, 'debt-snowball');
  assert.equal(first.publication.allowed, false);
  assert.equal(first.publication.approvalRequired, true);
  assert.doesNotMatch(JSON.stringify(first), /shared-secret-test|keystring-test/u);
});

test('interruption after a durable keyword checkpoint resumes without a duplicate provider request', async () => {
  const calls = [];
  const store = new WorkerStoreFixture();
  let interrupted = false;
  const base = {
    store,
    config: configFixture(),
    authority: { apiKeyHeader: 'keystring-test:shared-secret-test', ownShopId: '67071325' },
    fetchImpl: providerFixture(calls),
    clock: () => Date.parse('2026-08-08T08:00:00.000Z'),
    freshnessHours: 30,
  };
  const firstWorker = new EtsyIntelligenceWorker({
    ...base,
    afterCheckpoint: async ({ type }) => {
      if (!interrupted && type === 'keyword') {
        interrupted = true;
        throw new ControlledInterruptionError();
      }
    },
  });
  const input = { executionId: 'nn115-exec-recovery', claim: { ownerId: 'cloud-a', fencingToken: 1 } };
  await assert.rejects(firstWorker.run(input), error => error instanceof ControlledInterruptionError);

  const recovered = await new EtsyIntelligenceWorker(base).run(input);
  assert.equal(recovered.outcome, 'REFRESHED');
  assert.equal(calls.filter(call => call.keyword === 'monthly budget spreadsheet').length, 1);
  assert.equal(calls.filter(call => call.keyword === 'debt snowball spreadsheet').length, 1);
  assert.equal(calls.filter(call => call.path.includes('/shops/67071325/listings/active')).length, 1);
});

test('production control marker interrupts exactly once and recovery reads the durable marker', async () => {
  const calls = [];
  const store = new WorkerStoreFixture();
  const worker = new EtsyIntelligenceWorker({
    store,
    config: configFixture(),
    authority: { apiKeyHeader: 'keystring-test:shared-secret-test', ownShopId: '67071325' },
    fetchImpl: providerFixture(calls),
    clock: () => Date.parse('2026-08-08T08:00:00.000Z'),
    freshnessHours: 30,
  });
  const input = {
    executionId: 'nn115-exec-controlled-recovery',
    claim: { ownerId: 'cloud-a', fencingToken: 1 },
    control: { controlledInterruption: true },
  };

  await assert.rejects(worker.run(input), error => error instanceof ControlledInterruptionError);
  assert.deepEqual(
    await store.readCheckpoint(input.executionId, 'controlled-interruption-fired'),
    {
      schemaVersion: '1.0.0',
      taskId: 'NN-115',
      checkpointName: 'etsy-keyword-monthly-budget',
      firedAt: '2026-08-08T08:00:00.000Z',
      secretValuesReported: false,
    },
  );

  const recovered = await worker.run({ ...input, claim: { ownerId: 'cloud-b', fencingToken: 2 } });
  assert.equal(recovered.outcome, 'REFRESHED');
  assert.equal(calls.filter(call => call.keyword === 'monthly budget spreadsheet').length, 1);
  assert.equal(calls.filter(call => call.keyword === 'debt snowball spreadsheet').length, 1);
});
