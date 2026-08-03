import { createHash } from 'node:crypto';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { EtsyIntegrationError } from './integration.mjs';
import {
  createSocialEventSinkFromEnv,
  productFactorySocialEventKey
} from './social-event-sink.mjs';

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
const SOCIAL_CHANNELS = Object.freeze(['youtube', 'tiktok', 'instagram', 'facebook', 'pinterest']);

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
  const taxonomyId = etsy.taxonomyId == null
    ? null
    : requiredInteger(etsy.taxonomyId, `${field}.etsy.taxonomyId`);
  const taxonomyPath = etsy.taxonomyPath == null
    ? null
    : requiredString(etsy.taxonomyPath, `${field}.etsy.taxonomyPath`);
  if (!taxonomyId && !taxonomyPath) {
    throw new EtsyIntegrationError(
      'CATALOG_INVALID',
      `${field}.etsy requires taxonomyId or taxonomyPath`
    );
  }
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
      taxonomyId,
      taxonomyPath,
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

async function readJsonDocument(filename, label) {
  const metadata = await stat(filename).catch(() => null);
  if (!metadata?.isFile() || metadata.size > MAX_CATALOG_BYTES) {
    throw new EtsyIntegrationError('CATALOG_INVALID', `${label} is missing or too large`);
  }
  try {
    return {
      source: await readFile(filename, 'utf8'),
      filename
    };
  } catch {
    throw new EtsyIntegrationError('CATALOG_INVALID', `${label} could not be read`);
  }
}

function parseJsonDocument(document, label) {
  try {
    return JSON.parse(document.source);
  } catch {
    throw new EtsyIntegrationError('CATALOG_INVALID', `${label} is not valid JSON`);
  }
}

async function findNamedFiles(root, targetName, maximumDepth = 5) {
  const found = [];
  async function visit(directory, depth) {
    if (depth > maximumDepth) return;
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate, depth + 1);
      else if (entry.isFile() && entry.name === targetName) found.push(candidate);
      if (found.length > 100) {
        throw new EtsyIntegrationError('CATALOG_INVALID', 'Product Studio source contains too many listings');
      }
    }
  }
  await visit(root, 0);
  return found.sort((left, right) => left.localeCompare(right));
}

function relativeInside(root, filename, label) {
  const relative = path.relative(root, filename);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new EtsyIntegrationError('CATALOG_INVALID', `${label} must stay inside the release directory`);
  }
  return relative.replaceAll(path.sep, '/');
}

function mapWhoMade(value) {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'SELLER') return 'i_did';
  if (normalized === 'COLLECTIVE') return 'collective';
  if (normalized === 'SOMEONE_ELSE') return 'someone_else';
  return '';
}

function mapWhenMade(value) {
  return String(value || '').trim().replaceAll('-', '_');
}

export class ProductStudioListingCatalog {
  constructor({ releasePath, listingsPath }) {
    if (!path.isAbsolute(String(releasePath || '')) || !path.isAbsolute(String(listingsPath || ''))) {
      throw new EtsyIntegrationError(
        'CONFIG_INVALID',
        'Product Studio release and listing paths must be absolute'
      );
    }
    this.releasePath = path.resolve(releasePath);
    this.listingsPath = path.resolve(listingsPath);
  }

  async load() {
    const releaseRoot = await realpath(this.releasePath).catch(() => null);
    const listingsRoot = await realpath(this.listingsPath).catch(() => null);
    if (!releaseRoot || !listingsRoot) {
      throw new EtsyIntegrationError('CATALOG_NOT_FOUND', 'Product Studio source paths were not found');
    }
    const ownerDocument = await readJsonDocument(
      path.join(releaseRoot, 'owner-approval.json'),
      'Product Studio owner approval'
    );
    const ownerApproval = parseJsonDocument(ownerDocument, 'Product Studio owner approval');
    if (
      ownerApproval.schemaVersion !== '1.0.0' ||
      ownerApproval.standard !== QUALITY_STANDARD
    ) {
      throw new EtsyIntegrationError('CATALOG_INVALID', 'Product Studio owner approval is unsupported');
    }
    const packageFiles = await findNamedFiles(listingsRoot, 'listing-package.json');
    const packageByProduct = new Map();
    const packageByStudioKey = new Map();
    const revisionSources = [ownerDocument.source];
    for (const filename of packageFiles) {
      const document = await readJsonDocument(filename, 'Product Studio listing package');
      const listingPackage = parseJsonDocument(document, 'Product Studio listing package');
      const productId = requiredString(listingPackage.product_id, 'listing package product_id');
      const studioKey = path.relative(listingsRoot, filename).split(path.sep)[0];
      if (packageByProduct.has(productId)) {
        throw new EtsyIntegrationError(
          'CATALOG_INVALID',
          `Multiple listing packages exist for ${productId}`
        );
      }
      if (!studioKey || packageByStudioKey.has(studioKey)) {
        throw new EtsyIntegrationError(
          'CATALOG_INVALID',
          `Multiple listing packages exist for Product Studio key ${studioKey || 'unknown'}`
        );
      }
      packageByProduct.set(productId, listingPackage);
      packageByStudioKey.set(studioKey, listingPackage);
      revisionSources.push(document.source);
    }
    const releaseEntries = await readdir(releaseRoot, { withFileTypes: true });
    const rawListings = [];
    for (const entry of releaseEntries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      const productDirectory = path.join(releaseRoot, entry.name);
      const releaseManifestPath = path.join(productDirectory, 'release-manifest.json');
      const imageManifestPath = path.join(productDirectory, 'image-manifest.json');
      const releaseMetadata = await stat(releaseManifestPath).catch(() => null);
      if (!releaseMetadata) continue;
      if (!releaseMetadata.isFile()) {
        throw new EtsyIntegrationError(
          'CATALOG_INVALID',
          `${entry.name} release manifest is not a file`
        );
      }
      const releaseDocument = await readJsonDocument(
        releaseManifestPath,
        `${entry.name} release manifest`
      );
      const imageDocument = await readJsonDocument(
        imageManifestPath,
        `${entry.name} image manifest`
      );
      const releaseManifest = parseJsonDocument(releaseDocument, `${entry.name} release manifest`);
      const imageManifest = parseJsonDocument(imageDocument, `${entry.name} image manifest`);
      revisionSources.push(releaseDocument.source, imageDocument.source);
      const productId = requiredString(releaseManifest.product?.productId, `${entry.name} productId`);
      const listingPackage = packageByProduct.get(productId) || packageByStudioKey.get(entry.name);
      if (!listingPackage) {
        throw new EtsyIntegrationError(
          'CATALOG_INVALID',
          `No listing package exists for ${productId}`
        );
      }
      if (imageManifest.productId !== productId || imageManifest.standard !== QUALITY_STANDARD) {
        throw new EtsyIntegrationError('CATALOG_INVALID', `${entry.name} image manifest mismatch`);
      }
      const etsyForm = listingPackage.transfer_package?.etsy_form;
      const deliveryName = requiredString(
        releaseManifest.customerDelivery?.zip,
        `${entry.name} customer delivery ZIP`
      );
      const ownerPublicationAuthorized = ownerApproval.decision === 'GO' &&
        ownerApproval.publication?.authorized === true;
      const releaseApproved = releaseManifest.gates?.automatedValidation === 'passed' &&
        releaseManifest.gates?.humanVisualApproval === 'approved' &&
        releaseManifest.gates?.listingApproval === 'approved';
      const visualQualityApproved = releaseApproved &&
        imageManifest.publicationReady === true &&
        ownerPublicationAuthorized;
      const publicationReady = listingPackage.validation_status === READY &&
        listingPackage.transfer_package?.validation_status === READY &&
        releaseManifest.gates?.publicationReady === true &&
        visualQualityApproved;
      const images = safeArray(imageManifest.images, `${entry.name} images`, MAX_IMAGES)
        .sort((left, right) => Number(left.order) - Number(right.order))
        .map((image) => ({
          path: relativeInside(
            releaseRoot,
            path.join(productDirectory, 'listing-assets', requiredString(image.file, 'image file')),
            'Product Studio image'
          ),
          altText: String(image.altText || '')
        }));
      const deliveryPath = path.join(productDirectory, 'delivery', deliveryName);
      rawListings.push({
        id: productId,
        version: requiredString(releaseManifest.product?.version, `${entry.name} version`),
        status: publicationReady ? ACTIVE : 'draft',
        publication: {
          validationStatus: publicationReady ? READY : 'READY_FOR_REVIEW',
          visualQualityStandard: QUALITY_STANDARD,
          visualQualityApproved,
          ownerApproved: ownerPublicationAuthorized
        },
        etsy: {
          title: etsyForm?.title || listingPackage.title,
          description: etsyForm?.description || listingPackage.description,
          price: etsyForm?.price?.amount ?? listingPackage.transfer_package?.price,
          quantity: etsyForm?.quantity || 999,
          whoMade: mapWhoMade(etsyForm?.who_made_it),
          whenMade: mapWhenMade(etsyForm?.when_made),
          taxonomyPath: etsyForm?.category?.path,
          isSupply: etsyForm?.item_kind === 'SUPPLY',
          type: etsyForm?.item_type === 'DIGITAL_FILES' ? 'download' : 'physical',
          shouldAutoRenew: etsyForm?.renewal === 'AUTOMATIC',
          tags: etsyForm?.tags || listingPackage.tags
        },
        assets: {
          images,
          files: etsyForm?.item_type === 'DIGITAL_FILES'
            ? [{
                path: relativeInside(releaseRoot, deliveryPath, 'Product Studio delivery file'),
                name: deliveryName
              }]
            : []
        }
      });
    }
    const listings = rawListings.map(parseListing);
    const listingIds = new Set();
    for (const listing of listings) {
      if (listingIds.has(listing.id)) {
        throw new EtsyIntegrationError(
          'CATALOG_INVALID',
          `Multiple Product Studio releases use listing ID ${listing.id}`
        );
      }
      listingIds.add(listing.id);
    }
    return Object.freeze({
      revision: sha256(revisionSources.join('\n')),
      baseDirectory: releaseRoot,
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

async function prepareListing(listing, baseDirectory, minimumImages = 1) {
  const blockers = blockersFor(listing);
  if (listing.assets.images.length < minimumImages) blockers.push('SOCIAL_ASSETS_REQUIRED');
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

async function responseDocument(response, label) {
  const body = await response.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new EtsyIntegrationError('API_RESPONSE_INVALID', `Etsy returned an invalid ${label}`);
  }
  return body;
}

function positiveProviderTimestamp(value, field) {
  const timestamp = Number(value);
  if (!Number.isSafeInteger(timestamp) || timestamp < 946684800) {
    throw new EtsyIntegrationError('API_RESPONSE_INVALID', `Etsy returned an invalid ${field}`);
  }
  return timestamp;
}

function activeListingReadback(body, expectedListingId) {
  const listingId = String(body?.listing_id ?? '');
  if (listingId !== String(expectedListingId) || body?.state !== ACTIVE) {
    throw new EtsyIntegrationError('LISTING_READBACK_MISMATCH', 'Etsy did not confirm the expected active listing');
  }
  let listingUrl;
  try {
    listingUrl = new URL(String(body.url ?? ''));
  } catch {
    throw new EtsyIntegrationError('API_RESPONSE_INVALID', 'Etsy returned an invalid listing URL');
  }
  if (
    listingUrl.protocol !== 'https:'
    || listingUrl.username
    || listingUrl.password
    || listingUrl.hash
    || !(listingUrl.hostname === 'etsy.com' || listingUrl.hostname.endsWith('.etsy.com'))
    || !new RegExp(`^/listing/${listingId}(?:/|$)`, 'u').test(listingUrl.pathname)
  ) {
    throw new EtsyIntegrationError('LISTING_READBACK_MISMATCH', 'Etsy returned a mismatched canonical listing URL');
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.map((tag) => String(tag).trim()).filter(Boolean))]
    : null;
  if (!title || title.length > 140 || description.length < 20 || !tags || tags.length > 20) {
    throw new EtsyIntegrationError('API_RESPONSE_INVALID', 'Etsy returned incomplete listing metadata');
  }
  const revisionTimestamp = positiveProviderTimestamp(
    body.last_modified_timestamp ?? body.updated_timestamp ?? body.state_timestamp,
    'listing revision timestamp'
  );
  const publishedTimestamp = positiveProviderTimestamp(
    body.state_timestamp ?? body.updated_timestamp ?? body.last_modified_timestamp,
    'listing publication timestamp'
  );
  return Object.freeze({
    listingId,
    listingUrl: listingUrl.href,
    listingRevision: `etsy-${revisionTimestamp}`,
    title,
    description,
    tags: Object.freeze(tags),
    publishedAt: new Date(publishedTimestamp * 1000).toISOString()
  });
}

function etsyImageUrls(body, expectedListingId) {
  if (!Array.isArray(body?.results)) {
    throw new EtsyIntegrationError('API_RESPONSE_INVALID', 'Etsy returned an invalid listing image collection');
  }
  const images = [...body.results]
    .sort((left, right) => Number(left?.rank ?? 0) - Number(right?.rank ?? 0))
    .map((image) => {
      if (String(image?.listing_id ?? '') !== String(expectedListingId)) {
        throw new EtsyIntegrationError('LISTING_READBACK_MISMATCH', 'Etsy returned an image for another listing');
      }
      let url;
      try {
        url = new URL(String(image.url_fullxfull ?? ''));
      } catch {
        throw new EtsyIntegrationError('API_RESPONSE_INVALID', 'Etsy returned an invalid listing image URL');
      }
      if (
        url.protocol !== 'https:'
        || url.username
        || url.password
        || url.hash
        || !(url.hostname === 'etsystatic.com' || url.hostname.endsWith('.etsystatic.com'))
      ) {
        throw new EtsyIntegrationError('API_RESPONSE_INVALID', 'Etsy returned an untrusted listing image URL');
      }
      return url.href;
    });
  const unique = [...new Set(images)];
  if (unique.length < 3) {
    throw new EtsyIntegrationError('SOCIAL_ASSETS_INCOMPLETE', 'At least three Etsy listing images are required for social video generation');
  }
  return Object.freeze(unique.slice(0, 20));
}

function socialPublicationEvent(listing, readback, imageUrls) {
  const event = {
    schemaVersion: '1.0.0',
    mode: 'APPROVAL',
    channels: SOCIAL_CHANNELS,
    etsyReceipt: {
      listingId: readback.listingId,
      listingUrl: readback.listingUrl,
      listingRevision: readback.listingRevision,
      productId: listing.id,
      productName: listing.etsy.title,
      title: readback.title,
      description: readback.description,
      tags: readback.tags,
      publishedAt: readback.publishedAt,
      status: 'ACTIVE',
      readbackVerified: true,
      imageUrls
    },
    approval: { status: 'PENDING' },
    assetUrls: imageUrls.slice(0, 6)
  };
  return Object.freeze(event);
}

function draftForm(listing, taxonomyId) {
  const form = new URLSearchParams({
    quantity: String(listing.etsy.quantity),
    title: listing.etsy.title,
    description: listing.etsy.description,
    price: listing.etsy.price.toFixed(2),
    who_made: listing.etsy.whoMade,
    when_made: listing.etsy.whenMade,
    taxonomy_id: String(taxonomyId),
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

function listingPayload(listing, resolvedTaxonomyId) {
  return {
    version: listing.version,
    title: listing.etsy.title,
    description: listing.etsy.description,
    price: listing.etsy.price,
    quantity: listing.etsy.quantity,
    whoMade: listing.etsy.whoMade,
    whenMade: listing.etsy.whenMade,
    taxonomyId: resolvedTaxonomyId,
    taxonomyPath: listing.etsy.taxonomyPath,
    isSupply: listing.etsy.isSupply,
    type: listing.etsy.type,
    shouldAutoRenew: listing.etsy.shouldAutoRenew,
    tags: listing.etsy.tags,
    physical: listing.physical
  };
}

function normalizedTaxonomyPath(value) {
  return String(value || '')
    .split('>')
    .map((segment) => segment.trim().toLocaleLowerCase('en-US'))
    .filter(Boolean)
    .join(' > ');
}

function taxonomyPathIndex(nodes) {
  if (!Array.isArray(nodes)) {
    throw new EtsyIntegrationError('API_RESPONSE_INVALID', 'Etsy returned an invalid taxonomy tree');
  }
  const index = new Map();
  function visit(node, ancestors) {
    const id = Number(node?.id);
    const name = typeof node?.name === 'string' ? node.name.trim() : '';
    if (!Number.isSafeInteger(id) || id < 1 || !name) {
      throw new EtsyIntegrationError('API_RESPONSE_INVALID', 'Etsy returned an invalid taxonomy node');
    }
    const pathNames = [...ancestors, name];
    const key = normalizedTaxonomyPath(pathNames.join(' > '));
    const matches = index.get(key) || [];
    matches.push(id);
    index.set(key, matches);
    if (node.children != null && !Array.isArray(node.children)) {
      throw new EtsyIntegrationError('API_RESPONSE_INVALID', 'Etsy returned invalid taxonomy children');
    }
    for (const child of node.children || []) visit(child, pathNames);
  }
  for (const node of nodes) visit(node, []);
  return index;
}

export class EtsyListingPublisher {
  constructor({ integration, catalog, shopId, socialEventSink = null }) {
    if (!integration || !catalog) {
      throw new EtsyIntegrationError('CONFIG_INVALID', 'Listing publisher dependencies are required');
    }
    if (
      socialEventSink
      && (typeof socialEventSink.enqueue !== 'function' || typeof socialEventSink.reconcile !== 'function')
    ) {
      throw new EtsyIntegrationError('CONFIG_INVALID', 'Social event sink must support enqueue and reconciliation');
    }
    this.integration = integration;
    this.catalog = catalog;
    this.shopId = requiredInteger(shopId, 'ETSY_SHOP_ID');
    this.socialEventSink = socialEventSink;
    this.taxonomyIndexPromise = null;
  }

  async #withSyncState(item) {
    if (typeof this.integration.getSyncStatus !== 'function') return item;
    const sync = await this.integration.getSyncStatus({
      operation: 'etsy-activate-listing',
      resourceKey: item.listing.id
    });
    if (sync?.status !== 'succeeded') return item;
    if (this.socialEventSink) {
      const socialSync = await this.integration.getSyncStatus({
        operation: 'etsy-enqueue-social-event',
        resourceKey: item.listing.id
      });
      if (socialSync?.status !== 'succeeded') {
        return Object.freeze({
          ...item,
          socialHandoffPending: true,
          activatedListingId: sync.result?.externalResourceId ?? null
        });
      }
    }
    return Object.freeze({
      ...item,
      blockers: Object.freeze([...item.blockers, 'ALREADY_PUBLISHED'])
    });
  }

  async overview() {
    const catalog = await this.catalog.load();
    const prepared = await Promise.all(
      catalog.listings.map(async (listing) => this.#withSyncState(
        await prepareListing(listing, catalog.baseDirectory, this.socialEventSink ? 3 : 1)
      ))
    );
    const listings = prepared.map(({ listing, blockers, socialHandoffPending }) => Object.freeze({
      id: listing.id,
      title: listing.etsy.title,
      status: listing.status,
      eligible: blockers.length === 0,
      blockers: [...blockers],
      socialHandoffPending: Boolean(socialHandoffPending)
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
        await prepareListing(listing, catalog.baseDirectory, this.socialEventSink ? 3 : 1)
      ))
    );
    const eligible = prepared.filter(({ blockers }) => blockers.length === 0);
    if (!eligible.length) {
      throw new EtsyIntegrationError('NO_ELIGIBLE_LISTINGS', 'No active listings are ready to publish');
    }
    const resolved = await Promise.all(eligible.map(async (item) => ({
      item,
      taxonomyId: item.activatedListingId ? null : await this.#resolveTaxonomyId(item.listing)
    })));
    const results = [];
    for (const { item, taxonomyId } of resolved) {
      try {
        results.push(await this.#publishOne(item, taxonomyId));
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

  async #taxonomyIndex() {
    if (!this.taxonomyIndexPromise) {
      this.taxonomyIndexPromise = (async () => {
        const response = await this.integration.request(
          '/v3/application/seller-taxonomy/nodes',
          { method: 'GET', oauth: false }
        );
        const body = await response.json().catch(() => null);
        return taxonomyPathIndex(body?.results);
      })().catch((error) => {
        this.taxonomyIndexPromise = null;
        throw error;
      });
    }
    return this.taxonomyIndexPromise;
  }

  async #resolveTaxonomyId(listing) {
    if (listing.etsy.taxonomyId) return listing.etsy.taxonomyId;
    const key = normalizedTaxonomyPath(listing.etsy.taxonomyPath);
    const matches = (await this.#taxonomyIndex()).get(key) || [];
    if (!matches.length) {
      throw new EtsyIntegrationError(
        'TAXONOMY_NOT_FOUND',
        `No Etsy taxonomy matches ${listing.etsy.taxonomyPath}`
      );
    }
    if (matches.length > 1) {
      throw new EtsyIntegrationError(
        'TAXONOMY_AMBIGUOUS',
        `Multiple Etsy taxonomies match ${listing.etsy.taxonomyPath}`
      );
    }
    return matches[0];
  }

  async #publishOne({ listing, assets, activatedListingId = null }, taxonomyId) {
    let listingId = activatedListingId ? String(activatedListingId) : null;
    if (listingId && !/^\d{4,30}$/u.test(listingId)) {
      throw new EtsyIntegrationError('SYNC_RESULT_INVALID', 'Stored Etsy activation result is invalid');
    }
    if (!listingId) {
      const draft = await this.integration.runIdempotentSync({
        operation: 'etsy-create-draft',
        resourceKey: listing.id,
        payload: listingPayload(listing, taxonomyId),
        execute: async () => {
          const response = await this.integration.request(
            `/v3/application/shops/${this.shopId}/listings`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
              body: draftForm(listing, taxonomyId)
            }
          );
          return {
            externalResourceId: await responseJson(response, 'listing_id'),
            outcome: 'draft-created'
          };
        }
      });
      listingId = draft.externalResourceId;
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
    }
    let social = null;
    if (this.socialEventSink) {
      const listingResponse = await this.integration.request(
        `/v3/application/listings/${listingId}`,
        { method: 'GET', oauth: false }
      );
      const readback = activeListingReadback(
        await responseDocument(listingResponse, 'listing readback'),
        listingId
      );
      const imagesResponse = await this.integration.request(
        `/v3/application/listings/${listingId}/images`,
        { method: 'GET', oauth: false }
      );
      const imageUrls = etsyImageUrls(
        await responseDocument(imagesResponse, 'listing image readback'),
        listingId
      );
      const event = socialPublicationEvent(listing, readback, imageUrls);
      const key = productFactorySocialEventKey(event);
      const result = await this.integration.runIdempotentSync({
        operation: 'etsy-enqueue-social-event',
        resourceKey: listing.id,
        payload: { eventKey: key, event },
        execute: async () => this.socialEventSink.enqueue(event),
        reconcile: async () => this.socialEventSink.reconcile(event)
      });
      social = Object.freeze({
        eventKey: key,
        outcome: result.outcome,
        listingUrl: readback.listingUrl,
        listingRevision: readback.listingRevision,
        readbackVerified: true
      });
    }
    return Object.freeze({
      id: listing.id,
      externalListingId: listingId,
      outcome: 'published',
      social
    });
  }
}

export function createListingPublisherFromEnv(env, integration) {
  if (String(env.ETSY_EXECUTION_ENABLED).toLowerCase() !== 'true') return null;
  const catalogPath = typeof env.ETSY_LISTING_CATALOG_PATH === 'string'
    ? env.ETSY_LISTING_CATALOG_PATH.trim()
    : '';
  const releasePath = typeof env.ETSY_PRODUCT_STUDIO_RELEASE_PATH === 'string'
    ? env.ETSY_PRODUCT_STUDIO_RELEASE_PATH.trim()
    : '';
  const listingsPath = typeof env.ETSY_PRODUCT_STUDIO_LISTINGS_PATH === 'string'
    ? env.ETSY_PRODUCT_STUDIO_LISTINGS_PATH.trim()
    : '';
  const shopId = Number(env.ETSY_SHOP_ID);
  const hasManualCatalog = Boolean(catalogPath);
  const hasProductStudioCatalog = Boolean(releasePath || listingsPath);
  if (hasManualCatalog && hasProductStudioCatalog) {
    throw new EtsyIntegrationError(
      'CONFIG_INVALID',
      'Configure either the manual listing catalog or Product Studio source paths'
    );
  }
  let catalog;
  if (hasManualCatalog) {
    if (!path.isAbsolute(catalogPath)) {
      throw new EtsyIntegrationError(
        'CONFIG_INVALID',
        'ETSY_LISTING_CATALOG_PATH must be an absolute path'
      );
    }
    catalog = new FileListingCatalog(catalogPath);
  } else {
    if (!releasePath || !listingsPath || !path.isAbsolute(releasePath) || !path.isAbsolute(listingsPath)) {
      throw new EtsyIntegrationError(
        'CONFIG_INVALID',
        'Both Product Studio source paths must be absolute'
      );
    }
    catalog = new ProductStudioListingCatalog({ releasePath, listingsPath });
  }
  if (!Number.isSafeInteger(shopId) || shopId < 1) {
    throw new EtsyIntegrationError('CONFIG_INVALID', 'ETSY_SHOP_ID must be a positive integer');
  }
  return new EtsyListingPublisher({
    integration,
    catalog,
    shopId,
    socialEventSink: createSocialEventSinkFromEnv(env)
  });
}
