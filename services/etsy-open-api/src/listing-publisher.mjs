import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { EtsyIntegrationError } from './integration.mjs';

const MAX_CATALOG_BYTES = 512 * 1024;
const MAX_DIGITAL_FILE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES = 20;
const MAX_DIGITAL_FILES = 5;
const ACTIVE = 'active';
const READY = 'PUBLICATION_READY';
const QUALITY_STANDARD = 'NND-VISUAL-QUALITY-2026.1';
const WHO_MADE = new Set(['i_did', 'someone_else', 'collective']);
const WHEN_MADE = new Set([
  'made_to_order', '2020_2026', '2010_2019', '2007_2009', 'before_2007',
  '2000_2006', '1990s', '1980s', '1970s', '1960s', '1950s', '1940s',
  '1930s', '1920s', '1910s', '1900s', '1800s', '1700s', 'before_1700'
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function requiredString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new EtsyIntegrationError('CATALOG_INVALID', `${field} is required`);
  }
  return value.trim();
}

function limitedString(value, field, maximum) {
  const string = requiredString(value, field);
  if (string.length > maximum) {
    throw new EtsyIntegrationError('CATALOG_INVALID', `${field} exceeds ${maximum} characters`);
  }
  return string;
}

function optionalLimitedString(value, field, maximum) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.trim().length > maximum) {
    throw new EtsyIntegrationError('CATALOG_INVALID', `${field} exceeds ${maximum} characters`);
  }
  return value.trim();
}

function requiredInteger(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new EtsyIntegrationError('CATALOG_INVALID', `${field} must be a positive integer`);
  }
  return number;
}

function requiredBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new EtsyIntegrationError('CATALOG_INVALID', `${field} must be a boolean`);
  }
  return value;
}

function safeRelativePath(value, field) {
  const relative = requiredString(value, field);
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) {
    throw new EtsyIntegrationError('CATALOG_INVALID', `${field} must stay inside the catalog directory`);
  }
  return relative;
}

function safeArray(value, field, maximum) {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new EtsyIntegrationError('CATALOG_INVALID', `${field} must contain at most ${maximum} entries`);
  }
  return value;
}

function parseListing(raw, index) {
  const field = `listings[${index}]`;
  const etsy = raw?.etsy;
  const publication = raw?.publication;
  const assets = raw?.assets;
  if (!raw || typeof raw !== 'object' || !etsy || !publication || !assets) {
    throw new EtsyIntegrationError('CATALOG_INVALID', `${field} is incomplete`);
  }
  const price = Number(etsy.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new EtsyIntegrationError('CATALOG_INVALID', `${field}.etsy.price must be positive`);
  }
  const tags = safeArray(etsy.tags, `${field}.etsy.tags`, 13)
    .map((tag, tagIndex) => {
      const value = limitedString(tag, `${field}.etsy.tags[${tagIndex}]`, 20);
      if (/[^\p{L}\p{Nd}\p{Zs}'™©®-]/u.test(value)) {
        throw new EtsyIntegrationError(
          'CATALOG_INVALID',
          `${field}.etsy.tags[${tagIndex}] contains unsupported characters`
        );
      }
      return value;
    });
  const images = safeArray(assets.images, `${field}.assets.images`, MAX_IMAGES)
    .map((image, imageIndex) => ({
      path: safeRelativePath(image?.path, `${field}.assets.images[${imageIndex}].path`),
      altText: optionalLimitedString(
        image?.altText,
        `${field}.assets.images[${imageIndex}].altText`,
        500
      )
    }));
  const files = safeArray(assets.files, `${field}.assets.files`, MAX_DIGITAL_FILES)
    .map((file, fileIndex) => ({
      path: safeRelativePath(file?.path, `${field}.assets.files[${fileIndex}].path`),
      name: limitedString(file?.name, `${field}.assets.files[${fileIndex}].name`, 70)
    }));
  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    if (!/^[A-Za-z0-9._-]+$/.test(files[fileIndex].name)) {
      throw new EtsyIntegrationError(
        'CATALOG_INVALID',
        `${field}.assets.files[${fileIndex}].name contains unsupported characters`
      );
    }
  }
  const physical = raw.physical == null
    ? null
    : Object.freeze({
        shippingProfileId: requiredInteger(
          raw.physical.shippingProfileId,
          `${field}.physical.shippingProfileId`
        ),
        returnPolicyId: requiredInteger(
          raw.physical.returnPolicyId,
          `${field}.physical.returnPolicyId`
        ),
        readinessStateId: requiredInteger(
          raw.physical.readinessStateId,
          `${field}.physical.readinessStateId`
        )
      });
  const whoMade = requiredString(etsy.whoMade, `${field}.etsy.whoMade`);
  const whenMade = requiredString(etsy.whenMade, `${field}.etsy.whenMade`);
  if (!WHO_MADE.has(whoMade) || !WHEN_MADE.has(whenMade)) {
    throw new EtsyIntegrationError('CATALOG_INVALID', `${field}.etsy maker fields are unsupported`);
  }
  return Object.freeze({
    id: requiredString(raw.id, `${field}.id`),
    version: requiredString(raw.version, `${field}.version`),
    status: requiredString(raw.status, `${field}.status`).toLowerCase(),
    publication: Object.freeze({
      validationStatus: requiredString(publication.validationStatus, `${field}.publication.validationStatus`),
      visualQualityStandard: requiredString(
        publication.visualQualityStandard,
        `${field}.publication.visualQualityStandard`
      ),
      visualQualityApproved: requiredBoolean(
        publication.visualQualityApproved,
        `${field}.publication.visualQualityApproved`
      ),
      ownerApproved: requiredBoolean(publication.ownerApproved, `${field}.publication.ownerApproved`)
    }),
    etsy: Object.freeze({
      title: limitedString(etsy.title, `${field}.etsy.title`, 140),
      description: requiredString(etsy.description, `${field}.etsy.description`),
      price,
      quantity: requiredInteger(etsy.quantity, `${field}.etsy.quantity`),
      whoMade,
      whenMade,
      taxonomyId: requiredInteger(etsy.taxonomyId, `${field}.etsy.taxonomyId`),
      isSupply: requiredBoolean(etsy.isSupply, `${field}.etsy.isSupply`),
      type: requiredString(etsy.type, `${field}.etsy.type`),
      shouldAutoRenew: requiredBoolean(etsy.shouldAutoRenew, `${field}.etsy.shouldAutoRenew`),
      tags
    }),
    assets: Object.freeze({ images, files }),
    physical
  });
}

async function resolveAsset(baseDirectory, relativePath, expectedType) {
  const expectedRoot = `${await realpath(baseDirectory)}${path.sep}`;
  const candidate = path.resolve(baseDirectory, relativePath);
  let canonical;
  let metadata;
  try {
    canonical = await realpath(candidate);
    metadata = await stat(canonical);
  } catch {
    throw new EtsyIntegrationError('ASSET_MISSING', `A required ${expectedType} asset is missing`);
  }
  if (!canonical.startsWith(expectedRoot) || !metadata.isFile()) {
    throw new EtsyIntegrationError('ASSET_INVALID', `A required ${expectedType} asset is outside the catalog`);
  }
  if (expectedType === 'digital file' && metadata.size > MAX_DIGITAL_FILE_BYTES) {
    throw new EtsyIntegrationError('ASSET_TOO_LARGE', 'An Etsy digital file exceeds 20 MB');
  }
  return Object.freeze({ canonical, size: metadata.size });
}

export class FileListingCatalog {
  constructor(filename) {
    if (!path.isAbsolute(String(filename || ''))) {
      throw new EtsyIntegrationError('CONFIG_INVALID', 'ETSY_LISTING_CATALOG_PATH must be absolute');
    }
    this.filename = path.resolve(filename);
  }

  async load() {
    const metadata = await stat(this.filename).catch(() => null);
    if (!metadata?.isFile()) {
      throw new EtsyIntegrationError('CATALOG_NOT_FOUND', 'The configured listing catalog was not found');
    }
    if (metadata.size > MAX_CATALOG_BYTES) {
      throw new EtsyIntegrationError('CATALOG_INVALID', 'The listing catalog exceeds 512 KB');
    }
    const source = await readFile(this.filename, 'utf8');
    let document;
    try {
      document = JSON.parse(source);
    } catch {
      throw new EtsyIntegrationError('CATALOG_INVALID', 'The listing catalog is not valid JSON');
    }
    if (document?.schemaVersion !== '1.0.0' || !Array.isArray(document.listings)) {
      throw new EtsyIntegrationError('CATALOG_INVALID', 'The listing catalog schema is unsupported');
    }
    const listings = document.listings.map(parseListing);
    const ids = new Set();
    for (const listing of listings) {
      if (ids.has(listing.id)) {
        throw new EtsyIntegrationError('CATALOG_INVALID', 'The listing catalog contains duplicate IDs');
      }
      ids.add(listing.id);
    }
    return Object.freeze({
      revision: sha256(source),
      baseDirectory: path.dirname(this.filename),
      listings
    });
  }
}

function blockersFor(listing) {
  const blockers = [];
  if (listing.status !== ACTIVE) blockers.push('NOT_ACTIVE');
  if (listing.publication.validationStatus !== READY) blockers.push('NOT_PUBLICATION_READY');
  if (listing.publication.visualQualityStandard !== QUALITY_STANDARD) {
    blockers.push('QUALITY_STANDARD_MISMATCH');
  }
  if (!listing.publication.visualQualityApproved) blockers.push('VISUAL_QUALITY_NOT_APPROVED');
  if (!listing.publication.ownerApproved) blockers.push('OWNER_APPROVAL_REQUIRED');
  if (!listing.assets.images.length) blockers.push('IMAGE_REQUIRED');
  if (['download', 'both'].includes(listing.etsy.type) && !listing.assets.files.length) {
    blockers.push('DIGITAL_FILE_REQUIRED');
  }
  if (['physical', 'both'].includes(listing.etsy.type) && !listing.physical) {
    blockers.push('PHYSICAL_PROFILE_REQUIRED');
  }
  if (!['physical', 'download', 'both'].includes(listing.etsy.type)) blockers.push('LISTING_TYPE_INVALID');
  return blockers;
}

async function prepareListing(listing, baseDirectory) {
  const blockers = blockersFor(listing);
  const assets = { images: [], files: [] };
  if (!blockers.length) {
    try {
      for (const image of listing.assets.images) {
        assets.images.push({
          ...image,
          ...await resolveAsset(baseDirectory, image.path, 'image')
        });
      }
      for (const file of listing.assets.files) {
        assets.files.push({
          ...file,
          ...await resolveAsset(baseDirectory, file.path, 'digital file')
        });
      }
    } catch (error) {
      blockers.push(error.code || 'ASSET_INVALID');
    }
  }
  return Object.freeze({ listing, assets: Object.freeze(assets), blockers: Object.freeze(blockers) });
}

async function responseJson(response, expectedIdField) {
  const body = await response.json().catch(() => null);
  const id = body?.[expectedIdField];
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) {
    throw new EtsyIntegrationError('API_RESPONSE_INVALID', 'Etsy returned an invalid resource identifier');
  }
  return String(id);
}

function draftForm(listing) {
  const form = new URLSearchParams({
    quantity: String(listing.etsy.quantity),
    title: listing.etsy.title,
    description: listing.etsy.description,
    price: listing.etsy.price.toFixed(2),
    who_made: listing.etsy.whoMade,
    when_made: listing.etsy.whenMade,
    taxonomy_id: String(listing.etsy.taxonomyId),
    is_supply: String(listing.etsy.isSupply),
    should_auto_renew: String(listing.etsy.shouldAutoRenew),
    type: listing.etsy.type,
    tags: listing.etsy.tags.join(',')
  });
  if (listing.physical) {
    form.set('shipping_profile_id', String(listing.physical.shippingProfileId));
    form.set('return_policy_id', String(listing.physical.returnPolicyId));
    form.set('readiness_state_id', String(listing.physical.readinessStateId));
  }
  return form;
}

function listingPayload(listing) {
  return {
    version: listing.version,
    title: listing.etsy.title,
    description: listing.etsy.description,
    price: listing.etsy.price,
    quantity: listing.etsy.quantity,
    whoMade: listing.etsy.whoMade,
    whenMade: listing.etsy.whenMade,
    taxonomyId: listing.etsy.taxonomyId,
    isSupply: listing.etsy.isSupply,
    type: listing.etsy.type,
    shouldAutoRenew: listing.etsy.shouldAutoRenew,
    tags: listing.etsy.tags,
    physical: listing.physical
  };
}

export class EtsyListingPublisher {
  constructor({ integration, catalog, shopId }) {
    if (!integration || !catalog) {
      throw new EtsyIntegrationError('CONFIG_INVALID', 'Listing publisher dependencies are required');
    }
    this.integration = integration;
    this.catalog = catalog;
    this.shopId = requiredInteger(shopId, 'ETSY_SHOP_ID');
  }

  async #withSyncState(item) {
    if (typeof this.integration.getSyncStatus !== 'function') return item;
    const sync = await this.integration.getSyncStatus({
      operation: 'etsy-activate-listing',
      resourceKey: item.listing.id
    });
    if (sync?.status !== 'succeeded') return item;
    return Object.freeze({
      ...item,
      blockers: Object.freeze([...item.blockers, 'ALREADY_PUBLISHED'])
    });
  }

  async overview() {
    const catalog = await this.catalog.load();
    const prepared = await Promise.all(
      catalog.listings.map(async (listing) => this.#withSyncState(
        await prepareListing(listing, catalog.baseDirectory)
      ))
    );
    const listings = prepared.map(({ listing, blockers }) => Object.freeze({
      id: listing.id,
      title: listing.etsy.title,
      status: listing.status,
      eligible: blockers.length === 0,
      blockers: [...blockers]
    }));
    return Object.freeze({
      revision: catalog.revision,
      total: listings.length,
      active: listings.filter((listing) => listing.status === ACTIVE).length,
      eligible: listings.filter((listing) => listing.eligible).length,
      blocked: listings.filter((listing) => !listing.eligible).length,
      listings
    });
  }

  async publishAllActive({ revision }) {
    const catalog = await this.catalog.load();
    if (catalog.revision !== revision) {
      throw new EtsyIntegrationError(
        'CATALOG_CHANGED',
        'The listing catalog changed after the publication preview'
      );
    }
    const prepared = await Promise.all(
      catalog.listings.map(async (listing) => this.#withSyncState(
        await prepareListing(listing, catalog.baseDirectory)
      ))
    );
    const eligible = prepared.filter(({ blockers }) => blockers.length === 0);
    if (!eligible.length) {
      throw new EtsyIntegrationError('NO_ELIGIBLE_LISTINGS', 'No active listings are ready to publish');
    }
    const results = [];
    for (const item of eligible) {
      try {
        results.push(await this.#publishOne(item));
      } catch (error) {
        results.push(Object.freeze({
          id: item.listing.id,
          outcome: 'failed',
          errorCode: error.code || 'PUBLICATION_FAILED'
        }));
      }
    }
    return Object.freeze({
      revision: catalog.revision,
      requested: eligible.length,
      published: results.filter((result) => result.outcome === 'published').length,
      failed: results.filter((result) => result.outcome === 'failed').length,
      results
    });
  }

  async #publishOne({ listing, assets }) {
    const draft = await this.integration.runIdempotentSync({
      operation: 'etsy-create-draft',
      resourceKey: listing.id,
      payload: listingPayload(listing),
      execute: async () => {
        const response = await this.integration.request(
          `/v3/application/shops/${this.shopId}/listings`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: draftForm(listing)
          }
        );
        return {
          externalResourceId: await responseJson(response, 'listing_id'),
          outcome: 'draft-created'
        };
      }
    });
    const listingId = draft.externalResourceId;
    for (let index = 0; index < assets.images.length; index += 1) {
      const image = assets.images[index];
      const digest = sha256(await readFile(image.canonical));
      await this.integration.runIdempotentSync({
        operation: 'etsy-upload-image',
        resourceKey: `${listing.id}:image:${index + 1}`,
        payload: { listingId, digest, rank: index + 1, altText: image.altText },
        execute: async () => {
          const bytes = await readFile(image.canonical);
          const form = new FormData();
          form.append('image', new Blob([bytes]), path.basename(image.canonical));
          form.append('rank', String(index + 1));
          form.append('alt_text', image.altText);
          const response = await this.integration.request(
            `/v3/application/shops/${this.shopId}/listings/${listingId}/images`,
            { method: 'POST', body: form }
          );
          return {
            externalResourceId: await responseJson(response, 'listing_image_id'),
            outcome: 'image-uploaded'
          };
        }
      });
    }
    for (let index = 0; index < assets.files.length; index += 1) {
      const file = assets.files[index];
      const digest = sha256(await readFile(file.canonical));
      await this.integration.runIdempotentSync({
        operation: 'etsy-upload-file',
        resourceKey: `${listing.id}:file:${index + 1}`,
        payload: { listingId, digest, rank: index + 1, name: file.name },
        execute: async () => {
          const bytes = await readFile(file.canonical);
          const form = new FormData();
          form.append('file', new Blob([bytes]), file.name);
          form.append('name', file.name);
          form.append('rank', String(index + 1));
          const response = await this.integration.request(
            `/v3/application/shops/${this.shopId}/listings/${listingId}/files`,
            { method: 'POST', body: form }
          );
          return {
            externalResourceId: await responseJson(response, 'listing_file_id'),
            outcome: 'file-uploaded'
          };
        }
      });
    }
    await this.integration.runIdempotentSync({
      operation: 'etsy-activate-listing',
      resourceKey: listing.id,
      payload: { listingId, state: ACTIVE },
      execute: async () => {
        await this.integration.request(
          `/v3/application/shops/${this.shopId}/listings/${listingId}`,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ state: ACTIVE })
          }
        );
        return { externalResourceId: listingId, outcome: 'published' };
      }
    });
    return Object.freeze({ id: listing.id, externalListingId: listingId, outcome: 'published' });
  }
}

export function createListingPublisherFromEnv(env, integration) {
  if (String(env.ETSY_EXECUTION_ENABLED).toLowerCase() !== 'true') return null;
  const catalogPath = typeof env.ETSY_LISTING_CATALOG_PATH === 'string'
    ? env.ETSY_LISTING_CATALOG_PATH.trim()
    : '';
  const shopId = Number(env.ETSY_SHOP_ID);
  if (!catalogPath || !path.isAbsolute(catalogPath)) {
    throw new EtsyIntegrationError(
      'CONFIG_INVALID',
      'ETSY_LISTING_CATALOG_PATH must be an absolute path'
    );
  }
  if (!Number.isSafeInteger(shopId) || shopId < 1) {
    throw new EtsyIntegrationError('CONFIG_INVALID', 'ETSY_SHOP_ID must be a positive integer');
  }
  return new EtsyListingPublisher({
    integration,
    catalog: new FileListingCatalog(catalogPath),
    shopId
  });
}
