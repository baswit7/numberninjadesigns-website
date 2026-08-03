import assert from 'node:assert/strict';
import test from 'node:test';

import { PublisherError, sha256 } from '../server/social-publisher/core.mjs';
import { PublisherService } from '../server/social-publisher/service.mjs';

const NOW = Date.UTC(2026, 7, 3, 18, 0, 0);
const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_TENANT_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_SESSION_ID = '44444444-4444-4444-8444-444444444444';
const ENCRYPTION_KEY = Buffer.alloc(32, 11).toString('base64');

const config = Object.freeze({
  encryptionKey: ENCRYPTION_KEY,
  mode: 'review',
  etsy: {
    clientId: 'etsy-client',
    sharedSecret: 'etsy-secret-placeholder',
    redirectUri: 'https://www.numberninjadesigns.com/etsy/callback/',
  },
  tiktok: {
    clientKey: 'tiktok-client',
    clientSecret: 'tiktok-secret-placeholder',
    redirectUri: 'https://www.numberninjadesigns.com/tiktok/callback/',
  },
});

const session = Object.freeze({
  id: SESSION_ID,
  tenant_id: TENANT_ID,
  csrf_hash: sha256('csrf-placeholder'),
  authenticated_at: new Date(NOW - 1_000).toISOString(),
  expires_at: new Date(NOW + 86_400_000).toISOString(),
  etsy_user_id: '9001',
  etsy_shop_id: '8001',
  etsy_shop_name: 'Owned Test Shop',
  etsy_connected: true,
  tiktok_connected: true,
});

function tokenKey(tenantId, provider) {
  return `${tenantId}|${provider}`;
}

class MemoryRepository {
  constructor() {
    this.oauthRequests = new Map();
    this.tokens = new Map();
    this.listings = new Map();
    this.contexts = new Map();
    this.jobs = new Map();
    this.auditEvents = [];
  }

  async rateLimit() { return true; }
  async audit(input) { this.auditEvents.push(structuredClone(input)); }
  async cleanup() {}

  async saveOAuthRequest(input) { this.oauthRequests.set(input.stateHash, structuredClone(input)); }

  async consumeOAuthRequest(stateHash, provider, sessionId, tenantId) {
    const request = this.oauthRequests.get(stateHash);
    if (!request || request.provider !== provider || request.sessionId !== sessionId || request.tenantId !== tenantId || Date.parse(request.expiresAt) <= NOW) return null;
    this.oauthRequests.delete(stateHash);
    return {
      state_hash: stateHash,
      session_id: request.sessionId,
      tenant_id: request.tenantId,
      provider: request.provider,
      verifier_cipher: request.verifierCipher,
    };
  }

  async bindEtsyTenant({ tenantId }) { return tenantId; }

  async upsertProviderToken(input) {
    this.tokens.set(tokenKey(input.tenantId, input.provider), {
      tenant_id: input.tenantId,
      provider: input.provider,
      access_cipher: input.accessCipher,
      refresh_cipher: input.refreshCipher,
      token_type: input.tokenType,
      scopes: [...input.scopes],
      provider_subject: input.providerSubject,
      expires_at: input.expiresAt,
      refresh_expires_at: input.refreshExpiresAt,
      updated_at: new Date(NOW).toISOString(),
    });
  }

  async getProviderToken(tenantId, provider) { return this.tokens.get(tokenKey(tenantId, provider)) ?? null; }

  async getListing(tenantId, listingId) { return this.listings.get(`${tenantId}|${listingId}`) ?? null; }

  async saveCreatorContext(input) {
    this.contexts.set(`${input.tenantId}|${input.id}`, {
      id: input.id,
      tenant_id: input.tenantId,
      context_hash: input.contextHash,
      creator_subject: input.creatorSubject,
      creator_username: input.creatorUsername,
      creator_nickname: input.creatorNickname,
      privacy_options: [...input.privacyOptions],
      comment_disabled: input.commentDisabled,
      duet_disabled: input.duetDisabled,
      stitch_disabled: input.stitchDisabled,
      max_duration_seconds: input.maxDurationSeconds,
      fetched_at: new Date(NOW).toISOString(),
      expires_at: input.expiresAt,
    });
  }

  async getCreatorContext(tenantId, contextId) {
    const row = this.contexts.get(`${tenantId}|${contextId}`);
    return row && Date.parse(row.expires_at) > NOW ? row : null;
  }

  async findPublishJob(tenantId, mediaSha256, settingsSha256) {
    return [...this.jobs.values()].find((job) => job.tenant_id === tenantId && job.media_sha256 === mediaSha256 && job.settings_sha256 === settingsSha256) ?? null;
  }

  async createPublishJob(input) {
    if (await this.findPublishJob(input.tenantId, input.mediaSha256, input.settingsSha256)) return null;
    const job = {
      id: input.id,
      tenant_id: input.tenantId,
      listing_id: input.listingId,
      media_sha256: input.mediaSha256,
      settings_sha256: input.settingsSha256,
      creator_context_hash: input.creatorContextHash,
      media_bytes: input.mediaBytes,
      media_type: input.mediaType,
      duration_seconds: input.durationSeconds,
      state: input.state,
      consented_at: input.consentedAt,
      publish_id: input.publishId,
      upload_url_cipher: input.uploadUrlCipher,
      upload_nonce_hash: input.uploadNonceHash,
      upload_expires_at: input.uploadExpiresAt,
      provider_status: input.providerStatus,
      provider_post_id: null,
      failure_code: null,
      created_at: new Date(NOW).toISOString(),
      updated_at: new Date(NOW).toISOString(),
      completed_at: null,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async markPublishInitialized(tenantId, jobId, input) {
    const job = await this.getPublishJob(tenantId, jobId);
    if (!job || job.state !== 'INITIALIZING') return null;
    Object.assign(job, {
      state: 'AWAITING_UPLOAD',
      publish_id: input.publishId,
      upload_url_cipher: input.uploadUrlCipher,
      upload_nonce_hash: input.uploadNonceHash,
      upload_expires_at: input.uploadExpiresAt,
      provider_status: 'AWAITING_UPLOAD',
      updated_at: new Date(NOW).toISOString(),
    });
    return job;
  }

  async getPublishJob(tenantId, jobId) {
    const job = this.jobs.get(jobId);
    return job?.tenant_id === tenantId ? job : null;
  }

  async rotateUploadNonce(tenantId, jobId, nonceHash) {
    const job = await this.getPublishJob(tenantId, jobId);
    if (!job || job.state !== 'AWAITING_UPLOAD' || Date.parse(job.upload_expires_at) <= NOW) return null;
    job.upload_nonce_hash = nonceHash;
    return job;
  }

  async claimUpload(tenantId, jobId, nonceHash) {
    const job = await this.getPublishJob(tenantId, jobId);
    if (!job || job.state !== 'AWAITING_UPLOAD' || job.upload_nonce_hash !== nonceHash || Date.parse(job.upload_expires_at) <= NOW) return null;
    job.state = 'UPLOADING';
    job.upload_nonce_hash = null;
    return job;
  }

  async updatePublishJob(tenantId, jobId, patch) {
    const job = await this.getPublishJob(tenantId, jobId);
    if (!job) return null;
    if (patch.state) job.state = patch.state;
    if (patch.providerStatus) job.provider_status = patch.providerStatus;
    if (patch.providerPostId) job.provider_post_id = patch.providerPostId;
    job.failure_code = patch.failureCode ?? null;
    if (patch.clearUpload) job.upload_url_cipher = null;
    if (patch.complete) job.completed_at = new Date(NOW).toISOString();
    job.updated_at = new Date(NOW).toISOString();
    return job;
  }
}

class FakeTransport {
  constructor() {
    this.creator = {
      creator_username: 'owned_creator',
      creator_nickname: 'Owned Creator',
      privacy_level_options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
      comment_disabled: false,
      duet_disabled: false,
      stitch_disabled: true,
      max_video_post_duration_sec: 180,
    };
    this.status = { status: 'PROCESSING_UPLOAD' };
    this.calls = [];
    this.initCalls = 0;
    this.uploadCalls = 0;
  }

  async json(provider, url, options = {}) {
    this.calls.push({ provider, url, method: options.method || 'GET' });
    if (url === 'https://api.etsy.com/v3/public/oauth/token') {
      return { access_token: 'etsy-access-placeholder', refresh_token: 'etsy-refresh-placeholder', token_type: 'Bearer', scope: 'listings_r shops_r', expires_in: 3_600 };
    }
    if (url.endsWith('/users/me')) return { user_id: 9001, shop_id: 8001 };
    if (url.includes('/shops/8001')) return { shop_name: 'Owned Test Shop' };
    if (url.endsWith('/creator_info/query/')) return { data: structuredClone(this.creator), error: { code: 'ok', message: '' } };
    if (url.endsWith('/video/init/')) {
      this.initCalls += 1;
      return { data: { publish_id: `publish-${this.initCalls}`, upload_url: `https://upload.us.tiktokapis.com/video/${this.initCalls}` }, error: { code: 'ok', message: '' } };
    }
    if (url.endsWith('/status/fetch/')) {
      return {
        data: {
          status: this.status.status,
          fail_reason: this.status.failReason,
          publicaly_available_post_id: this.status.postId ? [this.status.postId] : [],
        },
        error: { code: 'ok', message: '' },
      };
    }
    throw new Error(`Unhandled fake JSON route: ${url}`);
  }

  async request(_provider, url, options = {}) {
    this.calls.push({ provider: 'TikTok', url, method: options.method || 'GET' });
    if (options.method === 'PUT' && url.startsWith('https://upload.us.tiktokapis.com/')) {
      this.uploadCalls += 1;
      return new Response(null, { status: 201 });
    }
    return new Response(null, { status: 200 });
  }
}

function serviceFixture() {
  const repository = new MemoryRepository();
  const transport = new FakeTransport();
  const service = new PublisherService({ config, repository, transport, now: () => NOW });
  repository.listings.set(`${TENANT_ID}|7001`, {
    tenant_id: TENANT_ID,
    listing_id: '7001',
    revision: 'revision-1',
    title: 'Owned listing',
    description: 'Description',
    price_amount: 1299,
    price_divisor: 100,
    currency_code: 'EUR',
    listing_url: 'https://www.etsy.com/listing/7001/owned-listing',
    image_urls: ['https://i.etsystatic.com/7001/image.jpg'],
    expires_at: new Date(NOW + 900_000).toISOString(),
  });
  return { repository, service, transport };
}

async function connectTikTok(service) {
  await service.saveToken(TENANT_ID, 'tiktok', {
    accessToken: 'tiktok-access-placeholder',
    refreshToken: 'tiktok-refresh-placeholder',
    tokenType: 'Bearer',
    scopes: ['user.info.basic', 'video.publish'],
    subject: 'creator-subject-placeholder',
    expiresAt: new Date(NOW + 3_600_000).toISOString(),
    refreshExpiresAt: new Date(NOW + 86_400_000).toISOString(),
  });
}

function payload(context, bytes, overrides = {}) {
  return {
    listingId: '7001',
    listingRevision: 'revision-1',
    mediaSha256: sha256(bytes),
    mediaBytes: bytes.byteLength,
    mediaType: 'video/webm',
    durationSeconds: 10,
    contextId: context.id,
    contextHash: context.hash,
    caption: 'Owned Etsy listing #EtsyFinds',
    privacyLevel: 'SELF_ONLY',
    allowComment: false,
    allowDuet: false,
    allowStitch: false,
    disclosure: 'own_brand',
    previewAcknowledged: true,
    consent: true,
    consentedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

test('OAuth state is unique, single-use and cannot be consumed by another tenant session', async () => {
  const { repository, service } = serviceFixture();
  const unconnected = { ...session, authenticated_at: null, etsy_connected: false, tiktok_connected: false };
  const first = await service.oauthStart(unconnected, 'etsy');
  const second = await service.oauthStart(unconnected, 'etsy');
  const firstUrl = new URL(first.authorizationUrl);
  const firstState = firstUrl.searchParams.get('state');
  assert.notEqual(firstState, new URL(second.authorizationUrl).searchParams.get('state'));
  assert.equal(firstUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(repository.oauthRequests.size, 2);

  const otherSession = { ...unconnected, id: OTHER_SESSION_ID, tenant_id: OTHER_TENANT_ID };
  await assert.rejects(
    service.oauthCallback(otherSession, { provider: 'etsy', state: firstState, code: 'provider-code-placeholder' }),
    (error) => error instanceof PublisherError && error.code === 'OAUTH_STATE_REJECTED',
  );
  assert.equal(repository.oauthRequests.has(sha256(firstState)), true, 'wrong session must not burn a valid state');

  const connection = await service.oauthCallback(unconnected, { provider: 'etsy', state: firstState, code: 'provider-code-placeholder' });
  assert.deepEqual(connection, { provider: 'etsy', connected: true, shopName: 'Owned Test Shop' });
  const stored = await repository.getProviderToken(TENANT_ID, 'etsy');
  assert.ok(stored);
  assert.equal(stored.access_cipher.includes('etsy-access-placeholder'), false);
  assert.equal(stored.refresh_cipher.includes('etsy-refresh-placeholder'), false);

  await assert.rejects(
    service.oauthCallback(unconnected, { provider: 'etsy', state: firstState, code: 'provider-code-placeholder' }),
    (error) => error instanceof PublisherError && error.code === 'OAUTH_STATE_REJECTED',
  );
});

test('publish flow binds current creator settings, exact media and duplicate protection', async () => {
  const { repository, service, transport } = serviceFixture();
  await connectTikTok(service);
  const creator = await service.creator(session);
  assert.equal(creator.creatorUsername, 'owned_creator');
  assert.equal(creator.creatorSubject, undefined);

  const media = Buffer.from('ten-second-webm-placeholder');
  const input = payload(creator, media);
  const initialized = await service.publishInit(session, input);
  assert.equal(initialized.job.state, 'AWAITING_UPLOAD');
  assert.match(initialized.uploadNonce, /^[A-Za-z0-9_-]{40,100}$/u);
  assert.equal(transport.initCalls, 1);

  const uploaded = await service.upload(session, initialized.job.id, initialized.uploadNonce, media);
  assert.equal(uploaded.state, 'PROCESSING');
  assert.equal(transport.uploadCalls, 1);

  transport.status = { status: 'PUBLISH_COMPLETE', postId: '987654321' };
  const completed = await service.status(session, initialized.job.id);
  assert.equal(completed.state, 'COMPLETE');
  assert.equal(completed.providerPostId, '987654321');

  const duplicate = await service.publishInit(session, input);
  assert.equal(duplicate.duplicatePrevented, true);
  assert.equal(duplicate.job.id, initialized.job.id);
  assert.equal(duplicate.uploadNonce, null);
  assert.equal(transport.initCalls, 1, 'completed publication must never be initialized twice');
  assert.ok(repository.auditEvents.some((event) => event.eventName === 'publish.completed'));
});

test('review mode rejects public privacy before a TikTok write', async () => {
  const { service, transport } = serviceFixture();
  await connectTikTok(service);
  const creator = await service.creator(session);
  const media = Buffer.from('private-review-media');
  await assert.rejects(
    service.publishInit(session, payload(creator, media, { privacyLevel: 'PUBLIC_TO_EVERYONE' })),
    (error) => error instanceof PublisherError && error.code === 'REVIEW_MODE_PRIVATE_ONLY',
  );
  assert.equal(transport.initCalls, 0);
  assert.equal(transport.uploadCalls, 0);
});

test('creator changes invalidate consent context before a TikTok write', async () => {
  const { service, transport } = serviceFixture();
  await connectTikTok(service);
  const creator = await service.creator(session);
  transport.creator.creator_nickname = 'Changed Creator';
  const media = Buffer.from('creator-context-media');
  await assert.rejects(
    service.publishInit(session, payload(creator, media, { caption: 'Changed-context test' })),
    (error) => error instanceof PublisherError && error.code === 'CREATOR_CONTEXT_CHANGED',
  );
  assert.equal(transport.initCalls, 0);
});

test('media mismatch consumes its one-time nonce and never reaches TikTok upload', async () => {
  const { service, transport } = serviceFixture();
  await connectTikTok(service);
  const creator = await service.creator(session);
  const expected = Buffer.from('expected-video-bytes');
  const initialized = await service.publishInit(session, payload(creator, expected, { caption: 'Integrity test' }));
  const different = Buffer.from('different-video-byte');
  assert.equal(different.byteLength, expected.byteLength);
  await assert.rejects(
    service.upload(session, initialized.job.id, initialized.uploadNonce, different),
    (error) => error instanceof PublisherError && error.code === 'MEDIA_INTEGRITY_MISMATCH',
  );
  assert.equal(transport.uploadCalls, 0);
  await assert.rejects(
    service.upload(session, initialized.job.id, initialized.uploadNonce, expected),
    (error) => error instanceof PublisherError && error.code === 'UPLOAD_NOT_AUTHORIZED',
  );
});

test('tenant-scoped listing lookup rejects cross-tenant publication data', async () => {
  const { service } = serviceFixture();
  await connectTikTok(service);
  const creator = await service.creator(session);
  const otherSession = { ...session, id: OTHER_SESSION_ID, tenant_id: OTHER_TENANT_ID };
  const media = Buffer.from('cross-tenant-media');
  await assert.rejects(
    service.publishInit(otherSession, payload(creator, media)),
    (error) => error instanceof PublisherError && error.code === 'LISTING_REVISION_CHANGED',
  );
});

test('audit storage failure cannot turn an accepted provider result into a retry', async () => {
  const { repository, service, transport } = serviceFixture();
  repository.audit = async () => { throw new Error('simulated audit outage'); };
  await connectTikTok(service);
  const creator = await service.creator(session);
  const media = Buffer.from('audit-resilience-media');
  const initialized = await service.publishInit(session, payload(creator, media, { caption: 'Audit resilience test' }));
  assert.equal(initialized.job.state, 'AWAITING_UPLOAD');
  assert.equal(transport.initCalls, 1);
});

test('durability failure after provider acceptance is recorded as uncertain', async () => {
  const { repository, service, transport } = serviceFixture();
  await connectTikTok(service);
  const creator = await service.creator(session);
  repository.markPublishInitialized = async () => { throw new Error('simulated database interruption'); };
  const media = Buffer.from('durability-boundary-media');
  await assert.rejects(service.publishInit(session, payload(creator, media, { caption: 'Durability boundary test' })));
  assert.equal(transport.initCalls, 1);
  const job = [...repository.jobs.values()][0];
  assert.equal(job.state, 'INIT_UNCERTAIN');
  assert.equal(job.failure_code, 'INIT_RESULT_UNKNOWN');
  assert.equal(job.completed_at, null);
});
