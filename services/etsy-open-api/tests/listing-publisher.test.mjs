import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  EtsyListingPublisher,
  FileListingCatalog,
  ProductStudioListingCatalog,
  createListingPublisherFromEnv
} from '../src/listing-publisher.mjs';

function listing(overrides = {}) {
  return {
    id: 'budget-planner',
    version: '1.0.0',
    status: 'active',
    publication: {
      validationStatus: 'PUBLICATION_READY',
      visualQualityStandard: 'NND-VISUAL-QUALITY-2026.1',
      visualQualityApproved: true,
      ownerApproved: true
    },
    etsy: {
      title: 'Excel Budget Planner',
      description: 'A complete offline budget planner. Digital product; nothing is shipped.',
      price: 12.95,
      quantity: 999,
      whoMade: 'i_did',
      whenMade: '2020_2026',
      taxonomyId: 1234,
      isSupply: false,
      type: 'download',
      shouldAutoRenew: true,
      tags: ['excel budget', 'budget planner']
    },
    assets: {
      images: [{ path: 'assets/cover.png', altText: 'Budget planner dashboard' }],
      files: [{ path: 'assets/product.zip', name: 'Budget-Planner.zip' }]
    },
    ...overrides
  };
}

async function fixture(context, listings) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'nnd-etsy-publisher-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'catalog.json'), JSON.stringify({
    schemaVersion: '1.0.0',
    listings
  }));
  await import('node:fs/promises').then(({ mkdir }) => mkdir(path.join(directory, 'assets')));
  await writeFile(path.join(directory, 'assets', 'cover.png'), Buffer.from('image'));
  await writeFile(path.join(directory, 'assets', 'product.zip'), Buffer.from('product'));
  return path.join(directory, 'catalog.json');
}

class FakeIntegration {
  constructor() {
    this.requests = [];
    this.records = new Map();
    this.nextId = 100;
  }

  key(operation, resourceKey) {
    return `${operation}:${resourceKey}`;
  }

  async getSyncStatus({ operation, resourceKey }) {
    return this.records.get(this.key(operation, resourceKey)) || null;
  }

  async runIdempotentSync({ operation, resourceKey, execute }) {
    const key = this.key(operation, resourceKey);
    const existing = this.records.get(key);
    if (existing?.status === 'succeeded') return existing.result;
    const result = await execute();
    this.records.set(key, { status: 'succeeded', result });
    return result;
  }

  async request(resourcePath, options) {
    this.requests.push({ resourcePath, options });
    if (resourcePath === '/v3/application/seller-taxonomy/nodes') {
      return new Response(JSON.stringify({
        results: [{
          id: 10,
          name: 'Paper & Party Supplies',
          children: [{
            id: 20,
            name: 'Paper',
            children: [{
              id: 30,
              name: 'Personal Finance Templates',
              children: []
            }]
          }]
        }]
      }), { status: 200 });
    }
    const id = this.nextId++;
    if (resourcePath.endsWith('/images')) {
      return new Response(JSON.stringify({ listing_image_id: id }), { status: 201 });
    }
    if (resourcePath.endsWith('/files')) {
      return new Response(JSON.stringify({ listing_file_id: id }), { status: 201 });
    }
    if (options.method === 'POST') {
      return new Response(JSON.stringify({ listing_id: id }), { status: 201 });
    }
    return new Response(JSON.stringify({ listing_id: id }), { status: 200 });
  }
}

async function productStudioFixture(context, { publicationAuthorized }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'nnd-product-studio-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const releasePath = path.join(directory, 'release');
  const listingsPath = path.join(directory, 'listings');
  const productId = 'budget-planner';
  const productReleasePath = path.join(releasePath, productId);
  const packagePath = path.join(listingsPath, productId);
  await mkdir(path.join(productReleasePath, 'listing-assets'), { recursive: true });
  await mkdir(path.join(productReleasePath, 'delivery'), { recursive: true });
  await mkdir(packagePath, { recursive: true });
  await writeFile(path.join(releasePath, 'owner-approval.json'), JSON.stringify({
    schemaVersion: '1.0.0',
    standard: 'NND-VISUAL-QUALITY-2026.1',
    decision: 'GO',
    publication: { authorized: publicationAuthorized }
  }));
  await writeFile(path.join(productReleasePath, 'release-manifest.json'), JSON.stringify({
    product: { productId, version: '1.0.0' },
    customerDelivery: { zip: 'Budget-Planner.zip' },
    gates: {
      automatedValidation: 'passed',
      humanVisualApproval: 'approved',
      listingApproval: 'approved',
      publicationReady: publicationAuthorized
    }
  }));
  await writeFile(path.join(productReleasePath, 'image-manifest.json'), JSON.stringify({
    productId,
    standard: 'NND-VISUAL-QUALITY-2026.1',
    publicationReady: publicationAuthorized,
    images: [{ order: 1, file: 'cover.jpg', altText: 'Budget planner dashboard' }]
  }));
  await writeFile(path.join(packagePath, 'listing-package.json'), JSON.stringify({
    product_id: 'budget-planner-listing-v1',
    title: 'Excel Budget Planner',
    description: 'A complete offline budget planner.',
    tags: ['excel budget'],
    validation_status: 'PUBLICATION_READY',
    transfer_package: {
      validation_status: 'PUBLICATION_READY',
      etsy_form: {
        title: 'Excel Budget Planner',
        description: 'A complete offline budget planner.',
        price: { amount: 12.95 },
        quantity: 999,
        who_made_it: 'SELLER',
        when_made: '2020-2026',
        category: {
          path: 'Paper & Party Supplies > Paper > Personal Finance Templates'
        },
        item_kind: 'FINISHED_PRODUCT',
        item_type: 'DIGITAL_FILES',
        renewal: 'AUTOMATIC',
        tags: ['excel budget']
      }
    }
  }));
  await writeFile(path.join(productReleasePath, 'listing-assets', 'cover.jpg'), 'image');
  await writeFile(path.join(productReleasePath, 'delivery', 'Budget-Planner.zip'), 'product');
  return { releasePath, listingsPath };
}

test('overview includes only active, fully approved listings with valid assets', async (context) => {
  const filename = await fixture(context, [
    listing(),
    listing({
      id: 'blocked',
      status: 'draft',
      publication: {
        validationStatus: 'READY_FOR_REVIEW',
        visualQualityStandard: 'NND-VISUAL-QUALITY-2026.1',
        visualQualityApproved: false,
        ownerApproved: false
      }
    })
  ]);
  const publisher = new EtsyListingPublisher({
    integration: new FakeIntegration(),
    catalog: new FileListingCatalog(filename),
    shopId: 42
  });
  const overview = await publisher.overview();
  assert.equal(overview.total, 2);
  assert.equal(overview.active, 1);
  assert.equal(overview.eligible, 1);
  assert.equal(overview.blocked, 1);
  assert.deepEqual(overview.listings[1].blockers, [
    'NOT_ACTIVE',
    'NOT_PUBLICATION_READY',
    'VISUAL_QUALITY_NOT_APPROVED',
    'OWNER_APPROVAL_REQUIRED'
  ]);
  assert.match(overview.revision, /^[a-f0-9]{64}$/);
});

test('bulk publication creates a draft, uploads assets, activates, and remains idempotent', async (context) => {
  const filename = await fixture(context, [listing()]);
  const integration = new FakeIntegration();
  const publisher = new EtsyListingPublisher({
    integration,
    catalog: new FileListingCatalog(filename),
    shopId: 42
  });
  const overview = await publisher.overview();
  const result = await publisher.publishAllActive({ revision: overview.revision });
  assert.equal(result.requested, 1);
  assert.equal(result.published, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(integration.requests.map((request) => request.options.method), [
    'POST',
    'POST',
    'POST',
    'PATCH'
  ]);
  assert.equal(
    integration.requests[0].resourcePath,
    '/v3/application/shops/42/listings'
  );
  assert.equal(integration.requests[0].options.body.get('type'), 'download');
  assert.equal(integration.requests[0].options.body.get('tags'), 'excel budget,budget planner');
  assert.equal(
    integration.requests[3].resourcePath,
    `/v3/application/shops/42/listings/${result.results[0].externalListingId}`
  );

  const after = await publisher.overview();
  assert.equal(after.eligible, 0);
  assert.deepEqual(after.listings[0].blockers, ['ALREADY_PUBLISHED']);
  await assert.rejects(
    publisher.publishAllActive({ revision: overview.revision }),
    { code: 'NO_ELIGIBLE_LISTINGS' }
  );
  assert.equal(integration.requests.length, 4);
});

test('bulk publication refuses a stale catalog revision', async (context) => {
  const filename = await fixture(context, [listing()]);
  const publisher = new EtsyListingPublisher({
    integration: new FakeIntegration(),
    catalog: new FileListingCatalog(filename),
    shopId: 42
  });
  const overview = await publisher.overview();
  await writeFile(filename, JSON.stringify({
    schemaVersion: '1.0.0',
    listings: [listing({ version: '1.0.1' })]
  }));
  await assert.rejects(
    publisher.publishAllActive({ revision: overview.revision }),
    { code: 'CATALOG_CHANGED' }
  );
});

test('physical listings require and submit Etsy shipping, return, and readiness profiles', async (context) => {
  const base = listing();
  const filename = await fixture(context, [listing({
    id: 'physical-product',
    etsy: { ...base.etsy, type: 'physical' },
    assets: { ...base.assets, files: [] },
    physical: {
      shippingProfileId: 71,
      returnPolicyId: 72,
      readinessStateId: 73
    }
  })]);
  const integration = new FakeIntegration();
  const publisher = new EtsyListingPublisher({
    integration,
    catalog: new FileListingCatalog(filename),
    shopId: 42
  });
  const overview = await publisher.overview();
  assert.equal(overview.eligible, 1);
  const result = await publisher.publishAllActive({ revision: overview.revision });
  assert.equal(result.published, 1);
  const form = integration.requests[0].options.body;
  assert.equal(form.get('shipping_profile_id'), '71');
  assert.equal(form.get('return_policy_id'), '72');
  assert.equal(form.get('readiness_state_id'), '73');
  assert.equal(integration.requests.some((request) => request.resourcePath.endsWith('/files')), false);
});

test('Product Studio catalog derives listings and keeps unauthorized releases blocked', async (context) => {
  const source = await productStudioFixture(context, { publicationAuthorized: false });
  const publisher = new EtsyListingPublisher({
    integration: new FakeIntegration(),
    catalog: new ProductStudioListingCatalog(source),
    shopId: 42
  });
  const overview = await publisher.overview();
  assert.equal(overview.total, 1);
  assert.equal(overview.active, 0);
  assert.equal(overview.eligible, 0);
  assert.deepEqual(overview.listings[0].blockers, [
    'NOT_ACTIVE',
    'NOT_PUBLICATION_READY',
    'VISUAL_QUALITY_NOT_APPROVED',
    'OWNER_APPROVAL_REQUIRED'
  ]);
});

test('Product Studio resolves taxonomy paths before the first provider write', async (context) => {
  const source = await productStudioFixture(context, { publicationAuthorized: true });
  const integration = new FakeIntegration();
  const publisher = new EtsyListingPublisher({
    integration,
    catalog: new ProductStudioListingCatalog(source),
    shopId: 42
  });
  const overview = await publisher.overview();
  const result = await publisher.publishAllActive({ revision: overview.revision });
  assert.equal(result.published, 1);
  assert.equal(integration.requests[0].resourcePath, '/v3/application/seller-taxonomy/nodes');
  assert.equal(integration.requests[0].options.oauth, false);
  assert.equal(integration.requests[1].options.method, 'POST');
  assert.equal(integration.requests[1].options.body.get('taxonomy_id'), '30');
});

test('an unresolved taxonomy path prevents every Etsy mutation', async (context) => {
  const base = listing();
  const filename = await fixture(context, [listing({
    etsy: {
      ...base.etsy,
      taxonomyId: null,
      taxonomyPath: 'Unknown > Product'
    }
  })]);
  const integration = new FakeIntegration();
  const publisher = new EtsyListingPublisher({
    integration,
    catalog: new FileListingCatalog(filename),
    shopId: 42
  });
  const overview = await publisher.overview();
  await assert.rejects(
    publisher.publishAllActive({ revision: overview.revision }),
    { code: 'TAXONOMY_NOT_FOUND' }
  );
  assert.deepEqual(integration.requests.map((request) => request.options.method), ['GET']);
});

test('publication configuration stays disabled by default and validates required values', () => {
  assert.equal(createListingPublisherFromEnv({ ETSY_EXECUTION_ENABLED: 'false' }, {}), null);
  assert.throws(
    () => createListingPublisherFromEnv({ ETSY_EXECUTION_ENABLED: 'true' }, {}),
    { code: 'CONFIG_INVALID' }
  );
  const publisher = createListingPublisherFromEnv({
    ETSY_EXECUTION_ENABLED: 'true',
    ETSY_SHOP_ID: '42',
    ETSY_PRODUCT_STUDIO_RELEASE_PATH: 'C:\\ProductStudio\\release',
    ETSY_PRODUCT_STUDIO_LISTINGS_PATH: 'C:\\ProductStudio\\listings'
  }, {});
  assert.ok(publisher.catalog instanceof ProductStudioListingCatalog);
});
