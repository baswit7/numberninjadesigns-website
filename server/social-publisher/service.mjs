import {
  booleanValue,
  integerValue,
  invariant,
  MAX_VIDEO_BYTES,
  newId,
  openText,
  PRIVACY_LEVELS,
  PublisherError,
  randomToken,
  REVIEW_PRIVACY,
  sanitizeDetails,
  scalar,
  sealText,
  secureEqualText,
  sha256,
  sha256Base64Url,
  stableJson,
} from './core.mjs';
import {
  etsyAuthorizationUrl,
  exchangeEtsyCode,
  exchangeTikTokCode,
  fetchEtsyIdentity,
  fetchEtsyImage,
  fetchEtsyListings,
  fetchTikTokCreator,
  fetchTikTokStatus,
  initTikTokPost,
  refreshEtsyToken,
  refreshTikTokToken,
  revokeTikTokToken,
  tiktokAuthorizationUrl,
  uploadTikTokVideo,
} from './providers.mjs';

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const OAUTH_MS = 10 * 60 * 1000;
const LISTING_CACHE_MS = 15 * 60 * 1000;
const CREATOR_CONTEXT_MS = 5 * 60 * 1000;
const UPLOAD_URL_MS = 50 * 60 * 1000;
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA_PATTERN = /^[0-9a-f]{64}$/u;
const LISTING_ID_PATTERN = /^\d{1,32}$/u;
let lastCleanupAt = 0;

const RATE_LIMITS = Object.freeze({
  'oauth-start': { seconds: 600, maximum: 10 },
  listings: { seconds: 60, maximum: 30 },
  creator: { seconds: 60, maximum: 10 },
  'publish-init': { seconds: 60, maximum: 6 },
  upload: { seconds: 60, maximum: 6 },
  status: { seconds: 60, maximum: 20 },
  disconnect: { seconds: 600, maximum: 10 },
  'delete-data': { seconds: 3600, maximum: 3 },
});

function iso(timestamp) {
  return new Date(timestamp).toISOString();
}

function dateValue(value) {
  const timestamp = Date.parse(String(value ?? ''));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function tokenAad(tenantId, provider, kind) {
  return `${tenantId}|${provider}|${kind}|v1`;
}

function oauthVerifierAad(tenantId, stateHash) {
  return `${tenantId}|etsy|oauth-verifier|${stateHash}|v1`;
}

function uploadUrlAad(tenantId, jobId) {
  return `${tenantId}|tiktok|upload-url|${jobId}|v1`;
}

function contextShape(context, creatorSubject) {
  return {
    creatorSubject: creatorSubject ?? null,
    creatorUsername: context.creatorUsername ?? null,
    creatorNickname: context.creatorNickname,
    privacyOptions: [...context.privacyOptions].sort(),
    commentDisabled: context.commentDisabled,
    duetDisabled: context.duetDisabled,
    stitchDisabled: context.stitchDisabled,
    maxDurationSeconds: context.maxDurationSeconds,
  };
}

function contextHash(context, creatorSubject) {
  return sha256(stableJson(contextShape(context, creatorSubject)));
}

function publicContext(row) {
  return {
    id: String(row.id),
    hash: String(row.context_hash),
    creatorUsername: row.creator_username ? String(row.creator_username) : null,
    creatorNickname: String(row.creator_nickname),
    privacyOptions: Array.isArray(row.privacy_options) ? row.privacy_options.map(String) : [],
    commentDisabled: row.comment_disabled === true,
    duetDisabled: row.duet_disabled === true,
    stitchDisabled: row.stitch_disabled === true,
    maxDurationSeconds: Number(row.max_duration_seconds),
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

function imageUrls(row) {
  if (Array.isArray(row.image_urls)) return row.image_urls;
  try {
    const parsed = JSON.parse(String(row.image_urls ?? '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function publicListing(row) {
  const amount = row.price_amount === null || row.price_amount === undefined ? null : Number(row.price_amount);
  const divisor = row.price_divisor === null || row.price_divisor === undefined ? null : Number(row.price_divisor);
  return {
    listingId: String(row.listing_id),
    revision: String(row.revision),
    title: String(row.title),
    description: String(row.description ?? ''),
    price: Number.isFinite(amount) && Number.isFinite(divisor) && divisor > 0
      ? { amount, divisor, currencyCode: String(row.currency_code ?? '') }
      : null,
    listingUrl: row.listing_url ? String(row.listing_url) : null,
    imageCount: imageUrls(row).length,
    imageUrl: imageUrls(row).length ? `/api/social-publisher?action=image&listingId=${encodeURIComponent(String(row.listing_id))}&index=0` : null,
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

function publicJob(row) {
  return {
    id: String(row.id),
    listingId: String(row.listing_id),
    state: String(row.state),
    providerStatus: row.provider_status ? String(row.provider_status) : null,
    providerPostId: row.provider_post_id ? String(row.provider_post_id) : null,
    failureCode: row.failure_code ? String(row.failure_code) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}

export class PublisherService {
  constructor({ config, repository, transport, now = () => Date.now() }) {
    this.config = config;
    this.repository = repository;
    this.transport = transport;
    this.now = now;
  }

  async maybeCleanup() {
    const current = this.now();
    if (current - lastCleanupAt < 60 * 60 * 1000) return;
    lastCleanupAt = current;
    try { await this.repository.cleanup(); } catch { /* Cleanup must not expose database details or block a valid session. */ }
  }

  async openSession(cookieValue) {
    await this.maybeCleanup();
    let session = cookieValue ? await this.repository.getSession(sha256(cookieValue)) : null;
    let setCookie = null;
    let csrfToken = randomToken();
    if (!session) {
      const rawSession = randomToken();
      const tenantId = newId();
      const sessionId = newId();
      const expiresAt = iso(this.now() + SESSION_MS);
      await this.repository.createSession({ tenantId, sessionId, sessionHash: sha256(rawSession), csrfHash: sha256(csrfToken), expiresAt });
      session = {
        id: sessionId,
        tenant_id: tenantId,
        csrf_hash: sha256(csrfToken),
        authenticated_at: null,
        expires_at: expiresAt,
        etsy_user_id: null,
        etsy_shop_id: null,
        etsy_shop_name: null,
        etsy_connected: false,
        tiktok_connected: false,
      };
      setCookie = rawSession;
    } else {
      const rotated = await this.repository.rotateCsrf(session.id, sha256(csrfToken));
      invariant(rotated, 401, 'SESSION_EXPIRED', 'De sessie is verlopen.');
      session = { ...session, csrf_hash: sha256(csrfToken) };
    }
    return { session, csrfToken, setCookie, public: this.publicSession(session, csrfToken) };
  }

  async resolveSession(cookieValue) {
    invariant(typeof cookieValue === 'string' && /^[A-Za-z0-9_-]{40,100}$/u.test(cookieValue), 401, 'SESSION_REQUIRED', 'Start een nieuwe beveiligde sessie.');
    const session = await this.repository.getSession(sha256(cookieValue));
    invariant(session, 401, 'SESSION_EXPIRED', 'De sessie is verlopen.');
    return session;
  }

  publicSession(session, csrfToken) {
    return {
      authenticated: Boolean(session.authenticated_at && session.etsy_connected),
      csrfToken,
      expiresAt: new Date(session.expires_at).toISOString(),
      etsy: {
        connected: session.etsy_connected === true,
        shopName: session.etsy_shop_name ? String(session.etsy_shop_name) : null,
      },
      tiktok: { connected: session.tiktok_connected === true },
      mode: this.config.mode,
    };
  }

  verifyCsrf(session, csrfToken) {
    invariant(typeof csrfToken === 'string' && csrfToken.length <= 200 && secureEqualText(sha256(csrfToken), String(session.csrf_hash)), 403, 'CSRF_REJECTED', 'De beveiligingscontrole is verlopen. Vernieuw de pagina.');
  }

  async rateLimit(session, action) {
    const policy = RATE_LIMITS[action];
    if (!policy) return;
    const windowMs = policy.seconds * 1000;
    const windowStart = iso(Math.floor(this.now() / windowMs) * windowMs);
    const allowed = await this.repository.rateLimit(sha256(String(session.tenant_id)), action, windowStart, policy.maximum);
    invariant(allowed, 429, 'RATE_LIMITED', 'Te veel aanvragen. Probeer het later opnieuw.', { retryable: true, headers: { 'Retry-After': String(policy.seconds) } });
  }

  async audit(session, eventName, outcome, details = {}) {
    try {
      await this.repository.audit({
        tenantId: session?.tenant_id ?? null,
        sessionId: session?.id ?? null,
        eventName,
        outcome,
        details: sanitizeDetails(details),
      });
      return true;
    } catch {
      // Observability failure must never falsify or repeat an authoritative provider outcome.
      return false;
    }
  }

  async oauthStart(session, provider) {
    await this.rateLimit(session, 'oauth-start');
    scalar(provider, 'provider', { allowed: ['etsy', 'tiktok'], max: 20 });
    if (provider === 'tiktok') invariant(session.etsy_connected === true && session.authenticated_at, 401, 'ETSY_AUTH_REQUIRED', 'Verbind eerst de Etsy-shop die je bezit.');
    const state = randomToken();
    const stateHash = sha256(state);
    let verifierCipher = null;
    let authorizationUrl;
    if (provider === 'etsy') {
      const verifier = randomToken(64);
      verifierCipher = sealText(verifier, this.config.encryptionKey, oauthVerifierAad(session.tenant_id, stateHash));
      authorizationUrl = etsyAuthorizationUrl(this.config.etsy, state, sha256Base64Url(verifier));
    } else {
      authorizationUrl = tiktokAuthorizationUrl(this.config.tiktok, state);
    }
    await this.repository.saveOAuthRequest({
      stateHash,
      sessionId: session.id,
      tenantId: session.tenant_id,
      provider,
      verifierCipher,
      expiresAt: iso(this.now() + OAUTH_MS),
    });
    await this.audit(session, 'oauth.started', 'accepted', { provider });
    return { provider, authorizationUrl };
  }

  async oauthCallback(session, input) {
    const provider = scalar(input?.provider, 'provider', { allowed: ['etsy', 'tiktok'], max: 20 });
    const state = scalar(input?.state, 'OAuth state', { pattern: /^[A-Za-z0-9_-]{40,100}$/u, max: 100 });
    const request = await this.repository.consumeOAuthRequest(sha256(state), provider, session.id, session.tenant_id);
    invariant(request && secureEqualText(String(request.session_id), String(session.id)) && secureEqualText(String(request.tenant_id), String(session.tenant_id)), 403, 'OAUTH_STATE_REJECTED', 'De OAuth-callback is verlopen of hoort bij een andere sessie.');
    if (input?.error) {
      await this.audit(session, 'oauth.denied', 'rejected', { provider, code: String(input.error).slice(0, 80) });
      throw new PublisherError(400, 'OAUTH_DENIED', `${provider === 'etsy' ? 'Etsy' : 'TikTok'}-toegang is niet verleend.`);
    }
    const code = scalar(input?.code, 'OAuth code', { max: 2048 });
    if (provider === 'etsy') {
      invariant(request.verifier_cipher, 500, 'OAUTH_STATE_INVALID', 'De Etsy PKCE-status is ongeldig.');
      const verifier = openText(request.verifier_cipher, this.config.encryptionKey, oauthVerifierAad(session.tenant_id, sha256(state)));
      const token = await exchangeEtsyCode(this.transport, this.config.etsy, code, verifier, this.now());
      const identity = await fetchEtsyIdentity(this.transport, this.config.etsy, token.accessToken);
      const tenantId = await this.repository.bindEtsyTenant({
        tenantId: session.tenant_id,
        sessionId: session.id,
        userId: identity.userId,
        shopId: identity.shopId,
        shopName: identity.shopName,
      });
      invariant(tenantId, 500, 'TENANT_BINDING_FAILED', 'De Etsy-shop kon niet veilig aan de sessie worden gekoppeld.');
      await this.saveToken(tenantId, 'etsy', { ...token, scopes: token.scopes.length ? token.scopes : ['listings_r', 'shops_r'], subject: identity.userId });
      await this.audit({ ...session, tenant_id: tenantId }, 'oauth.completed', 'accepted', { provider });
      return { provider, connected: true, shopName: identity.shopName };
    }
    const token = await exchangeTikTokCode(this.transport, this.config.tiktok, code, this.now());
    invariant(token.scopes.includes('user.info.basic') && token.scopes.includes('video.publish'), 409, 'TIKTOK_SCOPE_MISSING', 'TikTok heeft niet alle vereiste toestemmingen verleend.', { reconnect: true });
    await this.saveToken(session.tenant_id, 'tiktok', token);
    await this.audit(session, 'oauth.completed', 'accepted', { provider });
    return { provider, connected: true };
  }

  async saveToken(tenantId, provider, token) {
    invariant(token.refreshToken, 502, 'PROVIDER_RESPONSE_INVALID', 'De provider stuurde geen vernieuwbare toestemming.');
    await this.repository.upsertProviderToken({
      tenantId,
      provider,
      accessCipher: sealText(token.accessToken, this.config.encryptionKey, tokenAad(tenantId, provider, 'access')),
      refreshCipher: token.refreshToken ? sealText(token.refreshToken, this.config.encryptionKey, tokenAad(tenantId, provider, 'refresh')) : null,
      tokenType: token.tokenType,
      scopes: token.scopes,
      providerSubject: token.subject,
      expiresAt: token.expiresAt,
      refreshExpiresAt: token.refreshExpiresAt,
    });
  }

  async accessToken(tenantId, provider) {
    let row = await this.repository.getProviderToken(tenantId, provider);
    invariant(row, 409, 'PROVIDER_RECONNECT_REQUIRED', `${provider === 'etsy' ? 'Etsy' : 'TikTok'} is niet verbonden.`, { reconnect: true });
    let accessToken = openText(row.access_cipher, this.config.encryptionKey, tokenAad(tenantId, provider, 'access'));
    if (dateValue(row.expires_at) > this.now() + TOKEN_REFRESH_MARGIN_MS) return { accessToken, row };
    invariant(row.refresh_cipher, 409, 'PROVIDER_RECONNECT_REQUIRED', `${provider === 'etsy' ? 'Etsy' : 'TikTok'} moet opnieuw worden verbonden.`, { reconnect: true });
    const refreshToken = openText(row.refresh_cipher, this.config.encryptionKey, tokenAad(tenantId, provider, 'refresh'));
    const refreshed = provider === 'etsy'
      ? await refreshEtsyToken(this.transport, this.config.etsy, refreshToken, this.now())
      : await refreshTikTokToken(this.transport, this.config.tiktok, refreshToken, this.now());
    await this.saveToken(tenantId, provider, {
      ...refreshed,
      refreshToken: refreshed.refreshToken ?? refreshToken,
      scopes: refreshed.scopes.length ? refreshed.scopes : row.scopes,
      subject: refreshed.subject ?? row.provider_subject,
    });
    row = await this.repository.getProviderToken(tenantId, provider);
    accessToken = openText(row.access_cipher, this.config.encryptionKey, tokenAad(tenantId, provider, 'access'));
    return { accessToken, row };
  }

  async listings(session, force = false) {
    invariant(session.etsy_connected === true, 409, 'PROVIDER_RECONNECT_REQUIRED', 'Verbind Etsy om eigen listings te laden.', { reconnect: true });
    await this.rateLimit(session, 'listings');
    if (!force) {
      const cached = await this.repository.listCachedListings(session.tenant_id);
      if (cached.length) return cached.map(publicListing);
    }
    const { accessToken } = await this.accessToken(session.tenant_id, 'etsy');
    const listings = await fetchEtsyListings(this.transport, this.config.etsy, accessToken, String(session.etsy_shop_id));
    await this.repository.upsertListings(session.tenant_id, listings, iso(this.now() + LISTING_CACHE_MS));
    const cached = await this.repository.listCachedListings(session.tenant_id);
    await this.audit(session, 'listings.refreshed', 'accepted', { provider: 'etsy', status: String(cached.length) });
    return cached.map(publicListing);
  }

  async listingImage(session, listingIdValue, indexValue) {
    await this.rateLimit(session, 'listings');
    const listingId = scalar(listingIdValue, 'listing-ID', { pattern: LISTING_ID_PATTERN, max: 32 });
    const index = Number(indexValue);
    invariant(Number.isInteger(index) && index >= 0 && index <= 2, 400, 'INVALID_INPUT', 'De afbeeldingsindex is ongeldig.');
    const listing = await this.repository.getListing(session.tenant_id, listingId);
    invariant(listing, 404, 'LISTING_NOT_FOUND', 'De listing is niet gevonden of moet worden vernieuwd.');
    const urls = imageUrls(listing);
    invariant(typeof urls[index] === 'string', 404, 'IMAGE_NOT_FOUND', 'De listingafbeelding is niet beschikbaar.');
    return fetchEtsyImage(this.transport, urls[index]);
  }

  async creator(session) {
    await this.rateLimit(session, 'creator');
    const { accessToken, row } = await this.accessToken(session.tenant_id, 'tiktok');
    const creator = await fetchTikTokCreator(this.transport, accessToken);
    const id = newId();
    const hash = contextHash(creator, row.provider_subject);
    const expiresAt = iso(this.now() + CREATOR_CONTEXT_MS);
    await this.repository.saveCreatorContext({
      id,
      tenantId: session.tenant_id,
      contextHash: hash,
      creatorSubject: row.provider_subject,
      ...creator,
      expiresAt,
    });
    await this.audit(session, 'creator.refreshed', 'accepted', { provider: 'tiktok' });
    return {
      id,
      hash,
      ...contextShape(creator, row.provider_subject),
      creatorSubject: undefined,
      expiresAt,
    };
  }

  validatePublishInput(input) {
    const listingId = scalar(input?.listingId, 'listing-ID', { pattern: LISTING_ID_PATTERN, max: 32 });
    const listingRevision = scalar(input?.listingRevision, 'listingrevisie', { max: 64 });
    const mediaSha256 = scalar(input?.mediaSha256, 'mediahash', { pattern: SHA_PATTERN, max: 64 });
    const mediaBytes = integerValue(input?.mediaBytes, 'mediagrootte', 1, MAX_VIDEO_BYTES);
    const mediaType = scalar(input?.mediaType, 'mediatype', { allowed: ['video/webm'], max: 40 });
    const durationSeconds = integerValue(input?.durationSeconds, 'videoduur', 1, 600);
    invariant(durationSeconds === 10, 400, 'VIDEO_DURATION_INVALID', 'De preview moet exact tien seconden duren.');
    const contextId = scalar(input?.contextId, 'creatorcontext', { pattern: UUID_PATTERN, max: 36 });
    const contextHashValue = scalar(input?.contextHash, 'creatorcontexthash', { pattern: SHA_PATTERN, max: 64 });
    const caption = scalar(input?.caption, 'caption', { max: 4400, trim: false });
    invariant(Array.from(caption).length <= 2200, 400, 'CAPTION_TOO_LONG', 'De TikTok-caption is langer dan 2.200 tekens.');
    const privacyLevel = scalar(input?.privacyLevel, 'privacy', { allowed: PRIVACY_LEVELS, max: 40 });
    const allowComment = booleanValue(input?.allowComment, 'Reacties');
    const allowDuet = booleanValue(input?.allowDuet, 'Duet');
    const allowStitch = booleanValue(input?.allowStitch, 'Stitch');
    const disclosure = scalar(input?.disclosure, 'commerciële disclosure', { allowed: ['own_brand', 'paid_partnership'], max: 32 });
    invariant(booleanValue(input?.previewAcknowledged, 'Previewbevestiging'), 400, 'PREVIEW_ACK_REQUIRED', 'Bevestig dat de preview exact is bekeken.');
    invariant(booleanValue(input?.consent, 'Publicatietoestemming'), 400, 'CONSENT_REQUIRED', 'Expliciete publicatietoestemming ontbreekt.');
    const consentedAt = scalar(input?.consentedAt, 'toestemmingsmoment', { max: 40 });
    const consentTime = dateValue(consentedAt);
    invariant(consentTime > this.now() - 10 * 60 * 1000 && consentTime < this.now() + 2 * 60 * 1000, 400, 'CONSENT_EXPIRED', 'De publicatietoestemming is verlopen.');
    return { listingId, listingRevision, mediaSha256, mediaBytes, mediaType, durationSeconds, contextId, contextHash: contextHashValue, caption, privacyLevel, allowComment, allowDuet, allowStitch, disclosure, consentedAt: iso(consentTime) };
  }

  async publishInit(session, input) {
    await this.rateLimit(session, 'publish-init');
    const values = this.validatePublishInput(input);
    invariant(session.etsy_connected === true && session.tiktok_connected === true, 409, 'PROVIDER_RECONNECT_REQUIRED', 'Etsy en TikTok moeten beide verbonden zijn.', { reconnect: true });
    const listing = await this.repository.getListing(session.tenant_id, values.listingId);
    invariant(listing && secureEqualText(String(listing.revision), values.listingRevision), 409, 'LISTING_REVISION_CHANGED', 'De Etsy-listing is gewijzigd. Vernieuw de listing en genereer opnieuw.');
    const storedContext = await this.repository.getCreatorContext(session.tenant_id, values.contextId);
    invariant(storedContext && secureEqualText(String(storedContext.context_hash), values.contextHash), 409, 'CREATOR_CONTEXT_EXPIRED', 'Vernieuw de TikTok creatorinformatie.');
    invariant(storedContext.privacy_options.includes(values.privacyLevel), 400, 'PRIVACY_NOT_AVAILABLE', 'De gekozen privacyoptie is niet beschikbaar.');
    invariant(!(storedContext.comment_disabled && values.allowComment), 400, 'INTERACTION_NOT_AVAILABLE', 'Reacties zijn voor deze creator niet beschikbaar.');
    invariant(!(storedContext.duet_disabled && values.allowDuet), 400, 'INTERACTION_NOT_AVAILABLE', 'Duet is voor deze creator niet beschikbaar.');
    invariant(!(storedContext.stitch_disabled && values.allowStitch), 400, 'INTERACTION_NOT_AVAILABLE', 'Stitch is voor deze creator niet beschikbaar.');
    invariant(values.durationSeconds <= Number(storedContext.max_duration_seconds), 400, 'VIDEO_DURATION_INVALID', 'De video is langer dan deze TikTok-creator toestaat.');
    if (this.config.mode === 'review') invariant(values.privacyLevel === REVIEW_PRIVACY, 409, 'REVIEW_MODE_PRIVATE_ONLY', 'Reviewmodus publiceert uitsluitend met Alleen ik.');

    const { accessToken, row: tokenRow } = await this.accessToken(session.tenant_id, 'tiktok');
    const latestCreator = await fetchTikTokCreator(this.transport, accessToken);
    const latestHash = contextHash(latestCreator, tokenRow.provider_subject);
    invariant(secureEqualText(latestHash, values.contextHash), 409, 'CREATOR_CONTEXT_CHANGED', 'De TikTok creatorinstellingen zijn gewijzigd. Vernieuw en controleer opnieuw.');

    const settings = {
      listingId: values.listingId,
      listingRevision: values.listingRevision,
      mediaSha256: values.mediaSha256,
      mediaBytes: values.mediaBytes,
      mediaType: values.mediaType,
      durationSeconds: values.durationSeconds,
      contextHash: values.contextHash,
      caption: values.caption,
      privacyLevel: values.privacyLevel,
      allowComment: values.allowComment,
      allowDuet: values.allowDuet,
      allowStitch: values.allowStitch,
      disclosure: values.disclosure,
    };
    const settingsSha256 = sha256(stableJson(settings));
    let existing = await this.repository.findPublishJob(session.tenant_id, values.mediaSha256, settingsSha256);
    if (existing) return this.resumeExistingUpload(session, existing);

    const jobId = newId();
    const reserved = await this.repository.createPublishJob({
      id: jobId,
      tenantId: session.tenant_id,
      listingId: values.listingId,
      mediaSha256: values.mediaSha256,
      settingsSha256,
      creatorContextHash: values.contextHash,
      mediaBytes: values.mediaBytes,
      mediaType: values.mediaType,
      durationSeconds: values.durationSeconds,
      state: 'INITIALIZING',
      consentedAt: values.consentedAt,
      publishId: null,
      uploadUrlCipher: null,
      uploadNonceHash: null,
      uploadExpiresAt: null,
      providerStatus: 'INITIALIZING',
    });
    if (!reserved) {
      existing = await this.repository.findPublishJob(session.tenant_id, values.mediaSha256, settingsSha256);
      invariant(existing, 409, 'IDEMPOTENCY_CONFLICT', 'Dezelfde publicatie wordt al verwerkt.');
      return this.resumeExistingUpload(session, existing);
    }

    let providerAccepted = false;
    try {
      const initialized = await initTikTokPost(this.transport, accessToken, {
        post_info: {
          title: values.caption,
          privacy_level: values.privacyLevel,
          disable_comment: !values.allowComment,
          disable_duet: !values.allowDuet,
          disable_stitch: !values.allowStitch,
          brand_content_toggle: values.disclosure === 'paid_partnership',
          brand_organic_toggle: values.disclosure === 'own_brand',
          is_aigc: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: { source: 'FILE_UPLOAD', video_size: values.mediaBytes, chunk_size: values.mediaBytes, total_chunk_count: 1 },
      });
      providerAccepted = true;
      const uploadNonce = randomToken();
      const job = await this.repository.markPublishInitialized(session.tenant_id, jobId, {
        publishId: initialized.publishId,
        uploadUrlCipher: sealText(initialized.uploadUrl, this.config.encryptionKey, uploadUrlAad(session.tenant_id, jobId)),
        uploadNonceHash: sha256(uploadNonce),
        uploadExpiresAt: iso(this.now() + UPLOAD_URL_MS),
      });
      invariant(job, 500, 'PUBLISH_STATE_LOST', 'De provider accepteerde de aanvraag, maar de lokale status kon niet worden bevestigd.');
      await this.audit(session, 'publish.initialized', 'accepted', { provider: 'tiktok', jobId, listingId: values.listingId, mode: this.config.mode });
      return { job: publicJob(job), uploadNonce };
    } catch (error) {
      const uncertain = providerAccepted || (error instanceof PublisherError && ['PROVIDER_UNREACHABLE', 'PUBLISH_STATE_LOST'].includes(error.code));
      await this.repository.updatePublishJob(session.tenant_id, jobId, {
        state: uncertain ? 'INIT_UNCERTAIN' : 'FAILED',
        providerStatus: uncertain ? 'UNKNOWN' : 'FAILED',
        failureCode: uncertain ? 'INIT_RESULT_UNKNOWN' : (error instanceof PublisherError ? error.code : 'INIT_FAILED'),
        complete: !uncertain,
      });
      await this.audit(session, 'publish.initialized', uncertain ? 'unknown' : 'rejected', { provider: 'tiktok', jobId, code: error instanceof PublisherError ? error.code : 'INIT_FAILED' });
      throw error;
    }
  }

  async resumeExistingUpload(session, existing) {
    if (existing.state === 'AWAITING_UPLOAD' && dateValue(existing.upload_expires_at) > this.now()) {
      const uploadNonce = randomToken();
      const job = await this.repository.rotateUploadNonce(session.tenant_id, existing.id, sha256(uploadNonce));
      invariant(job, 409, 'UPLOAD_SESSION_EXPIRED', 'De uploadsessie is verlopen.');
      return { job: publicJob(job), uploadNonce, duplicatePrevented: true };
    }
    return { job: publicJob(existing), uploadNonce: null, duplicatePrevented: true };
  }

  async upload(session, jobIdValue, uploadNonce, bytes) {
    await this.rateLimit(session, 'upload');
    const jobId = scalar(jobIdValue, 'job-ID', { pattern: UUID_PATTERN, max: 36 });
    const nonce = scalar(uploadNonce, 'uploadautorisatie', { pattern: /^[A-Za-z0-9_-]{40,100}$/u, max: 100 });
    invariant(Buffer.isBuffer(bytes) && bytes.byteLength > 0 && bytes.byteLength <= MAX_VIDEO_BYTES, 413, 'VIDEO_TOO_LARGE', 'De video overschrijdt de veilige uploadlimiet.');
    const job = await this.repository.claimUpload(session.tenant_id, jobId, sha256(nonce));
    invariant(job, 409, 'UPLOAD_NOT_AUTHORIZED', 'De uploadautorisatie is ongeldig, gebruikt of verlopen.');
    if (Number(job.media_bytes) !== bytes.byteLength || !secureEqualText(String(job.media_sha256), sha256(bytes))) {
      await this.repository.updatePublishJob(session.tenant_id, jobId, { state: 'FAILED', providerStatus: 'FAILED', failureCode: 'MEDIA_INTEGRITY_MISMATCH', complete: true, clearUpload: true });
      throw new PublisherError(400, 'MEDIA_INTEGRITY_MISMATCH', 'De geüploade video komt niet overeen met de goedgekeurde preview.');
    }
    const uploadUrl = openText(job.upload_url_cipher, this.config.encryptionKey, uploadUrlAad(session.tenant_id, jobId));
    try {
      await uploadTikTokVideo(this.transport, uploadUrl, bytes);
      const updated = await this.repository.updatePublishJob(session.tenant_id, jobId, { state: 'PROCESSING', providerStatus: 'PROCESSING_UPLOAD', failureCode: null, clearUpload: true });
      await this.audit(session, 'publish.uploaded', 'accepted', { provider: 'tiktok', jobId });
      return publicJob(updated);
    } catch (error) {
      const updated = await this.repository.updatePublishJob(session.tenant_id, jobId, { state: 'UPLOAD_UNCERTAIN', providerStatus: 'UNKNOWN', failureCode: 'UPLOAD_RESULT_UNKNOWN' });
      await this.audit(session, 'publish.uploaded', 'unknown', { provider: 'tiktok', jobId, code: error instanceof PublisherError ? error.code : 'UPLOAD_FAILED' });
      if (updated) throw error;
      throw new PublisherError(500, 'PUBLISH_STATE_LOST', 'De uploadstatus kon niet veilig worden opgeslagen.');
    }
  }

  async status(session, jobIdValue) {
    await this.rateLimit(session, 'status');
    const jobId = scalar(jobIdValue, 'job-ID', { pattern: UUID_PATTERN, max: 36 });
    let job = await this.repository.getPublishJob(session.tenant_id, jobId);
    invariant(job, 404, 'JOB_NOT_FOUND', 'De publicatietaak is niet gevonden.');
    if (['COMPLETE', 'FAILED', 'AWAITING_UPLOAD', 'INITIALIZING', 'INIT_UNCERTAIN'].includes(String(job.state))) return publicJob(job);
    invariant(job.publish_id, 409, 'PROVIDER_READBACK_UNAVAILABLE', 'De providerstatus kan niet worden teruggelezen.');
    const { accessToken } = await this.accessToken(session.tenant_id, 'tiktok');
    const status = await fetchTikTokStatus(this.transport, accessToken, String(job.publish_id));
    if (status.status === 'PUBLISH_COMPLETE') {
      job = await this.repository.updatePublishJob(session.tenant_id, jobId, { state: 'COMPLETE', providerStatus: status.status, providerPostId: status.postId, failureCode: null, complete: true, clearUpload: true });
      await this.audit(session, 'publish.completed', 'accepted', { provider: 'tiktok', jobId, status: status.status });
    } else if (status.status === 'FAILED') {
      job = await this.repository.updatePublishJob(session.tenant_id, jobId, { state: 'FAILED', providerStatus: status.status, failureCode: status.failureCode ?? 'PROVIDER_FAILED', complete: true, clearUpload: true });
      await this.audit(session, 'publish.completed', 'rejected', { provider: 'tiktok', jobId, code: status.failureCode ?? 'PROVIDER_FAILED' });
    } else {
      job = await this.repository.updatePublishJob(session.tenant_id, jobId, { state: 'PROCESSING', providerStatus: status.status, failureCode: null });
    }
    return publicJob(job);
  }

  async disconnect(session, providerValue) {
    await this.rateLimit(session, 'disconnect');
    const provider = scalar(providerValue, 'provider', { allowed: ['etsy', 'tiktok'], max: 20 });
    const row = await this.repository.getProviderToken(session.tenant_id, provider);
    if (row && provider === 'tiktok') {
      const accessToken = openText(row.access_cipher, this.config.encryptionKey, tokenAad(session.tenant_id, provider, 'access'));
      await revokeTikTokToken(this.transport, this.config.tiktok, accessToken);
    }
    await this.repository.deleteProviderToken(session.tenant_id, provider);
    await this.audit(session, 'provider.disconnected', 'accepted', { provider });
    return { provider, disconnected: true };
  }

  async deleteData(session) {
    await this.rateLimit(session, 'delete-data');
    const tiktok = await this.repository.getProviderToken(session.tenant_id, 'tiktok');
    if (tiktok) {
      const accessToken = openText(tiktok.access_cipher, this.config.encryptionKey, tokenAad(session.tenant_id, 'tiktok', 'access'));
      await revokeTikTokToken(this.transport, this.config.tiktok, accessToken);
    }
    await this.audit(session, 'tenant.deleted', 'accepted', { action: 'delete-data' });
    await this.repository.deleteTenant(session.tenant_id);
    return { deleted: true };
  }
}
