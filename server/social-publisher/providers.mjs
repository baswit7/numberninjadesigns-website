import { MAX_IMAGE_BYTES, PublisherError, invariant, PRIVACY_LEVELS, scalar } from './core.mjs';

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_PROVIDER_JSON_BYTES = 1_000_000;

async function readBounded(response, maximumBytes = MAX_PROVIDER_JSON_BYTES) {
  const length = Number(response.headers.get('content-length') ?? 0);
  invariant(!Number.isFinite(length) || length <= maximumBytes, 502, 'PROVIDER_RESPONSE_INVALID', 'De provider stuurde een ongeldige response.');
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new PublisherError(502, 'PROVIDER_RESPONSE_INVALID', 'De provider stuurde een te grote response.');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers.get('retry-after') ?? 0);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 10_000);
  return Math.min(400 * (2 ** attempt), 4_000);
}

export class ProviderTransport {
  constructor({ fetchImpl = globalThis.fetch, sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)) } = {}) {
    invariant(typeof fetchImpl === 'function', 500, 'SERVER_CONFIGURATION_INVALID', 'HTTP-transport ontbreekt.');
    this.fetchImpl = fetchImpl;
    this.sleep = sleep;
  }

  async request(provider, url, options = {}, policy = {}) {
    const attempts = policy.attempts ?? 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), policy.timeoutMs ?? 15_000);
      let response;
      try {
        response = await this.fetchImpl(url, { ...options, redirect: policy.redirect ?? 'error', signal: controller.signal });
      } catch {
        clearTimeout(timer);
        if (attempt + 1 < attempts && policy.safeToRetry === true) {
          await this.sleep(Math.min(400 * (2 ** attempt), 4_000));
          continue;
        }
        throw new PublisherError(502, 'PROVIDER_UNREACHABLE', `${provider} is tijdelijk niet bereikbaar.`, { retryable: true });
      }
      clearTimeout(timer);
      if (response.ok) return response;
      if (attempt + 1 < attempts && policy.safeToRetry === true && RETRYABLE_STATUS.has(response.status)) {
        await readBounded(response, 64 * 1024).catch(() => Buffer.alloc(0));
        await this.sleep(retryDelay(response, attempt));
        continue;
      }
      const reconnect = response.status === 401 || response.status === 403;
      throw new PublisherError(reconnect ? 409 : 502, reconnect ? 'PROVIDER_RECONNECT_REQUIRED' : 'PROVIDER_REQUEST_REJECTED', `${provider} heeft de aanvraag geweigerd.`, { reconnect, retryable: RETRYABLE_STATUS.has(response.status) });
    }
    throw new PublisherError(502, 'PROVIDER_RETRY_EXHAUSTED', `${provider} bleef onbereikbaar.`, { retryable: true });
  }

  async json(provider, url, options = {}, policy = {}) {
    const response = await this.request(provider, url, options, policy);
    const bytes = await readBounded(response);
    try { return JSON.parse(bytes.toString('utf8')); } catch { throw new PublisherError(502, 'PROVIDER_RESPONSE_INVALID', `${provider} stuurde een ongeldige response.`); }
  }
}

function form(values) {
  return new URLSearchParams(Object.entries(values)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => [key, String(value)]));
}

function authorizationHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

function expiry(seconds, now = Date.now()) {
  const bounded = Number(seconds);
  invariant(Number.isFinite(bounded) && bounded > 0 && bounded <= 365 * 24 * 60 * 60, 502, 'PROVIDER_RESPONSE_INVALID', 'De provider stuurde een ongeldige tokenlevensduur.');
  return new Date(now + bounded * 1000).toISOString();
}

function normalizeTokenResponse(provider, body, now = Date.now()) {
  const accessToken = scalar(body?.access_token, `${provider} access token`, { max: 16_384, pattern: /^\S+$/u });
  const refreshToken = typeof body?.refresh_token === 'string' && body.refresh_token.length > 0
    ? scalar(body.refresh_token, `${provider} refresh token`, { max: 16_384, pattern: /^\S+$/u })
    : null;
  const scopes = String(body?.scope ?? '').split(/[ ,]+/u).map((item) => item.trim()).filter(Boolean).slice(0, 20);
  return {
    accessToken,
    refreshToken,
    tokenType: String(body?.token_type ?? 'Bearer').slice(0, 32),
    scopes,
    expiresAt: expiry(body?.expires_in, now),
    refreshExpiresAt: body?.refresh_expires_in ? expiry(body.refresh_expires_in, now) : null,
    subject: typeof body?.open_id === 'string' ? body.open_id.slice(0, 256) : null,
  };
}

function etsyHeaders(config, accessToken) {
  return {
    'x-api-key': `${config.clientId}:${config.sharedSecret}`,
    ...(accessToken ? authorizationHeader(accessToken) : {}),
  };
}

export function etsyAuthorizationUrl(config, state, codeChallenge) {
  const url = new URL('https://www.etsy.com/oauth/connect');
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'listings_r shops_r',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.href;
}

export async function exchangeEtsyCode(transport, config, code, verifier, now) {
  const body = await transport.json('Etsy', 'https://api.etsy.com/v3/public/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ grant_type: 'authorization_code', client_id: config.clientId, redirect_uri: config.redirectUri, code, code_verifier: verifier }),
  }, { timeoutMs: 20_000 });
  return normalizeTokenResponse('Etsy', body, now);
}

export async function refreshEtsyToken(transport, config, refreshToken, now) {
  const body = await transport.json('Etsy', 'https://api.etsy.com/v3/public/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ grant_type: 'refresh_token', client_id: config.clientId, refresh_token: refreshToken }),
  }, { timeoutMs: 20_000 });
  return normalizeTokenResponse('Etsy', body, now);
}

export async function fetchEtsyIdentity(transport, config, accessToken) {
  const me = await transport.json('Etsy', 'https://openapi.etsy.com/v3/application/users/me', {
    headers: etsyHeaders(config, accessToken),
  }, { attempts: 3, safeToRetry: true });
  const userId = scalar(String(me?.user_id ?? ''), 'Etsy user-ID', { pattern: /^\d+$/u, max: 32 });
  const shopId = scalar(String(me?.shop_id ?? ''), 'Etsy shop-ID', { pattern: /^\d+$/u, max: 32 });
  let shopName = 'Etsy shop';
  try {
    const shop = await transport.json('Etsy', `https://openapi.etsy.com/v3/application/shops/${encodeURIComponent(shopId)}`, {
      headers: etsyHeaders(config, accessToken),
    }, { attempts: 2, safeToRetry: true });
    if (typeof shop?.shop_name === 'string' && shop.shop_name.trim()) shopName = shop.shop_name.trim().slice(0, 120);
  } catch (error) {
    if (error instanceof PublisherError && error.reconnect) throw error;
  }
  return { userId, shopId, shopName };
}

export function isEtsyImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && (url.hostname === 'etsystatic.com' || url.hostname.endsWith('.etsystatic.com'));
  } catch { return false; }
}

export async function fetchEtsyImage(transport, imageUrl) {
  invariant(isEtsyImageUrl(imageUrl), 400, 'IMAGE_SOURCE_INVALID', 'De listingafbeelding heeft een ongeldige bron.');
  const response = await transport.request('Etsy media', imageUrl, {}, { attempts: 2, safeToRetry: true, timeoutMs: 20_000 });
  const contentType = String(response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
  invariant(['image/jpeg', 'image/png', 'image/webp'].includes(contentType), 415, 'IMAGE_TYPE_UNSUPPORTED', 'De listingafbeelding heeft een niet-ondersteund formaat.');
  const bytes = await readBounded(response, MAX_IMAGE_BYTES);
  invariant(bytes.byteLength > 0, 502, 'PROVIDER_RESPONSE_INVALID', 'Etsy stuurde een lege listingafbeelding.');
  return { bytes, contentType };
}

function normalizeListing(listing, imageUrls) {
  const listingId = scalar(String(listing?.listing_id ?? ''), 'listing-ID', { pattern: /^\d+$/u, max: 32 });
  const title = scalar(String(listing?.title ?? ''), 'listingtitel', { max: 180 });
  const revision = String(listing?.updated_timestamp ?? listing?.update_timestamp ?? listing?.last_modified_tsz ?? '0').slice(0, 32);
  const price = listing?.price && typeof listing.price === 'object' ? listing.price : {};
  const listingUrl = typeof listing?.url === 'string' && /^https:\/\/www\.etsy\.com\/listing\//u.test(listing.url) ? listing.url.slice(0, 1000) : null;
  return {
    listingId,
    revision,
    title,
    description: String(listing?.description ?? '').trim().slice(0, 1200),
    priceAmount: Number.isSafeInteger(Number(price.amount)) ? Number(price.amount) : null,
    priceDivisor: Number.isSafeInteger(Number(price.divisor)) && Number(price.divisor) > 0 ? Number(price.divisor) : null,
    currencyCode: typeof price.currency_code === 'string' ? price.currency_code.slice(0, 8) : null,
    listingUrl,
    imageUrls: imageUrls.filter(isEtsyImageUrl).slice(0, 3),
  };
}

async function mapLimited(values, limit, mapper) {
  const result = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      result[index] = await mapper(values[index], index);
    }
  }));
  return result;
}

export async function fetchEtsyListings(transport, config, accessToken, shopId) {
  const payload = await transport.json('Etsy', `https://openapi.etsy.com/v3/application/shops/${encodeURIComponent(shopId)}/listings?state=active&limit=12&offset=0&sort_on=updated&sort_order=down`, {
    headers: etsyHeaders(config, accessToken),
  }, { attempts: 3, safeToRetry: true, timeoutMs: 20_000 });
  const listings = Array.isArray(payload?.results) ? payload.results.slice(0, 12) : [];
  return mapLimited(listings, 4, async (listing) => {
    const listingId = scalar(String(listing?.listing_id ?? ''), 'listing-ID', { pattern: /^\d+$/u, max: 32 });
    let images = [];
    try {
      const imagePayload = await transport.json('Etsy', `https://openapi.etsy.com/v3/application/listings/${encodeURIComponent(listingId)}/images`, {
        headers: etsyHeaders(config, accessToken),
      }, { attempts: 2, safeToRetry: true });
      images = Array.isArray(imagePayload?.results)
        ? imagePayload.results.map((image) => image?.url_fullxfull ?? image?.url_570xN).filter(Boolean)
        : [];
    } catch (error) {
      if (error instanceof PublisherError && error.reconnect) throw error;
    }
    return normalizeListing(listing, images);
  });
}

export function tiktokAuthorizationUrl(config, state) {
  const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
  url.search = new URLSearchParams({
    client_key: config.clientKey,
    response_type: 'code',
    scope: 'user.info.basic,video.publish',
    redirect_uri: config.redirectUri,
    state,
    disable_auto_auth: '1',
  }).toString();
  return url.href;
}

export async function exchangeTikTokCode(transport, config, code, now) {
  const body = await transport.json('TikTok', 'https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ client_key: config.clientKey, client_secret: config.clientSecret, code, grant_type: 'authorization_code', redirect_uri: config.redirectUri }),
  }, { timeoutMs: 20_000 });
  return normalizeTokenResponse('TikTok', body, now);
}

export async function refreshTikTokToken(transport, config, refreshToken, now) {
  const body = await transport.json('TikTok', 'https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ client_key: config.clientKey, client_secret: config.clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken }),
  }, { timeoutMs: 20_000 });
  return normalizeTokenResponse('TikTok', body, now);
}

function assertTikTokSuccess(body) {
  const code = String(body?.error?.code ?? 'invalid_response');
  if (code === 'ok') return;
  const reconnect = ['access_token_invalid', 'scope_not_authorized'].includes(code);
  const retryable = ['internal_error', 'rate_limit_exceeded'].includes(code);
  throw new PublisherError(reconnect ? 409 : 502, reconnect ? 'PROVIDER_RECONNECT_REQUIRED' : `TIKTOK_${code.toUpperCase().replace(/[^A-Z0-9]+/gu, '_').slice(0, 64)}`, 'TikTok heeft de aanvraag geweigerd.', { reconnect, retryable });
}

export async function fetchTikTokCreator(transport, accessToken) {
  const body = await transport.json('TikTok', 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
    method: 'POST',
    headers: { ...authorizationHeader(accessToken), 'Content-Type': 'application/json; charset=UTF-8' },
    body: '{}',
  }, { attempts: 3, safeToRetry: true });
  assertTikTokSuccess(body);
  const data = body?.data ?? {};
  const privacyOptions = Array.isArray(data.privacy_level_options)
    ? data.privacy_level_options.map(String).filter((item) => PRIVACY_LEVELS.includes(item))
    : [];
  invariant(privacyOptions.length > 0, 502, 'PROVIDER_RESPONSE_INVALID', 'TikTok stuurde geen geldige privacyopties.');
  return {
    creatorUsername: typeof data.creator_username === 'string' ? data.creator_username.slice(0, 120) : null,
    creatorNickname: scalar(String(data.creator_nickname ?? ''), 'TikTok creatornaam', { max: 120 }),
    privacyOptions,
    commentDisabled: data.comment_disabled === true,
    duetDisabled: data.duet_disabled === true,
    stitchDisabled: data.stitch_disabled === true,
    maxDurationSeconds: Number.isInteger(data.max_video_post_duration_sec) ? data.max_video_post_duration_sec : 180,
  };
}

export async function initTikTokPost(transport, accessToken, payload) {
  const body = await transport.json('TikTok', 'https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: { ...authorizationHeader(accessToken), 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(payload),
  }, { timeoutMs: 20_000 });
  assertTikTokSuccess(body);
  const publishId = scalar(String(body?.data?.publish_id ?? ''), 'TikTok publish-ID', { max: 64 });
  const uploadUrl = scalar(String(body?.data?.upload_url ?? ''), 'TikTok upload-URL', { max: 512 });
  const parsed = new URL(uploadUrl);
  invariant(parsed.protocol === 'https:' && !parsed.username && !parsed.password && (parsed.hostname === 'tiktokapis.com' || parsed.hostname.endsWith('.tiktokapis.com')), 502, 'PROVIDER_RESPONSE_INVALID', 'TikTok stuurde een ongeldige uploadbestemming.');
  return { publishId, uploadUrl: parsed.href };
}

export async function uploadTikTokVideo(transport, uploadUrl, bytes) {
  const response = await transport.request('TikTok', uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/webm',
      'Content-Length': String(bytes.byteLength),
      'Content-Range': `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}`,
    },
    body: bytes,
  }, { timeoutMs: 120_000 });
  invariant(response.status === 201, 502, 'TIKTOK_UPLOAD_UNCONFIRMED', 'TikTok bevestigde de video-upload niet.', { retryable: true });
}

export async function fetchTikTokStatus(transport, accessToken, publishId) {
  const body = await transport.json('TikTok', 'https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
    method: 'POST',
    headers: { ...authorizationHeader(accessToken), 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ publish_id: publishId }),
  }, { attempts: 3, safeToRetry: true });
  assertTikTokSuccess(body);
  const status = scalar(String(body?.data?.status ?? ''), 'TikTok publicatiestatus', { max: 64 });
  const postIds = Array.isArray(body?.data?.publicaly_available_post_id) ? body.data.publicaly_available_post_id.map(String).filter((id) => /^\d+$/u.test(id)).slice(0, 1) : [];
  const failureCode = status === 'FAILED' ? String(body?.data?.fail_reason ?? 'provider_failed').replace(/[^a-z0-9_]+/giu, '_').slice(0, 80) : null;
  return { status, postId: postIds[0] ?? null, failureCode };
}

export async function revokeTikTokToken(transport, config, accessToken) {
  try {
    await transport.request('TikTok', 'https://open.tiktokapis.com/v2/oauth/revoke/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_key: config.clientKey, client_secret: config.clientSecret, token: accessToken }),
    }, { timeoutMs: 20_000 });
    return true;
  } catch { return false; }
}
