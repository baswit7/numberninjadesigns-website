import {
  expiredSessionCookie,
  MAX_JSON_BYTES,
  MAX_VIDEO_BYTES,
  parseCookies,
  publicError,
  PublisherError,
  SESSION_COOKIE,
  sessionCookie,
} from './core.mjs';
import { publicConfig } from './config.mjs';

const SECURITY_HEADERS = Object.freeze({
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
});

function headers(extra = {}) {
  return { ...SECURITY_HEADERS, ...extra };
}

function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: headers({ 'Content-Type': 'application/json; charset=utf-8', ...extra }),
  });
}

function method(request, expected) {
  if (request.method !== expected) throw new PublisherError(405, 'METHOD_NOT_ALLOWED', 'Deze aanvraagmethode is niet toegestaan.', { headers: { Allow: expected } });
}

function sameOrigin(request, config) {
  const origin = request.headers.get('origin');
  if (origin !== config.origin) throw new PublisherError(403, 'ORIGIN_REJECTED', 'De aanvraag komt niet van de toegestane website.');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite.toLowerCase() !== 'same-origin') throw new PublisherError(403, 'ORIGIN_REJECTED', 'De aanvraag komt niet van de toegestane website.');
}

async function readJson(request) {
  const contentType = String(request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') throw new PublisherError(415, 'JSON_REQUIRED', 'Een JSON-aanvraag is vereist.');
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) throw new PublisherError(413, 'REQUEST_TOO_LARGE', 'De aanvraag is te groot.');
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.byteLength > MAX_JSON_BYTES) throw new PublisherError(413, 'REQUEST_TOO_LARGE', 'De aanvraag is te groot.');
  try {
    const parsed = JSON.parse(bytes.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
    return parsed;
  } catch { throw new PublisherError(400, 'INVALID_JSON', 'De JSON-aanvraag is ongeldig.'); }
}

async function readVideo(request) {
  const contentType = String(request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'video/webm') throw new PublisherError(415, 'VIDEO_TYPE_UNSUPPORTED', 'Alleen de goedgekeurde WebM-preview kan worden geüpload.');
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (!Number.isInteger(declared) || declared < 1 || declared > MAX_VIDEO_BYTES) throw new PublisherError(413, 'VIDEO_TOO_LARGE', 'De video overschrijdt de veilige uploadlimiet.');
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.byteLength !== declared || bytes.byteLength > MAX_VIDEO_BYTES) throw new PublisherError(400, 'VIDEO_LENGTH_MISMATCH', 'De videolengte komt niet overeen met de aanvraag.');
  return bytes;
}

function cookieValue(request) {
  return parseCookies(request.headers.get('cookie')).get(SESSION_COOKIE) ?? null;
}

async function authenticated(request, service, config, csrf = false) {
  const session = await service.resolveSession(cookieValue(request));
  if (csrf) {
    sameOrigin(request, config);
    service.verifyCsrf(session, request.headers.get('x-nn-csrf'));
  }
  return session;
}

export function createPublisherHandler({ service, config }) {
  return async function handlePublisherRequest(request) {
    try {
      const url = new URL(request.url);
      const action = url.searchParams.get('action') ?? '';

      if (action === 'health') {
        method(request, 'GET');
        const database = await service.repository.health();
        return json(200, { ok: true, service: 'numberninjadesigns-social-publisher', database, mode: config.mode });
      }
      if (action === 'session') {
        method(request, 'GET');
        const opened = await service.openSession(cookieValue(request));
        const extra = opened.setCookie ? { 'Set-Cookie': sessionCookie(opened.setCookie, config.secureCookies) } : {};
        return json(200, { ok: true, session: opened.public, config: publicConfig(config) }, extra);
      }
      if (action === 'oauth-start') {
        method(request, 'POST');
        const session = await authenticated(request, service, config, true);
        const body = await readJson(request);
        return json(200, { ok: true, oauth: await service.oauthStart(session, body.provider) });
      }
      if (action === 'oauth-callback') {
        method(request, 'POST');
        sameOrigin(request, config);
        const session = await authenticated(request, service, config, false);
        return json(200, { ok: true, connection: await service.oauthCallback(session, await readJson(request)) });
      }
      if (action === 'listings') {
        method(request, 'GET');
        const session = await authenticated(request, service, config);
        return json(200, { ok: true, listings: await service.listings(session, url.searchParams.get('refresh') === '1') });
      }
      if (action === 'image') {
        method(request, 'GET');
        const session = await authenticated(request, service, config);
        const image = await service.listingImage(session, url.searchParams.get('listingId'), url.searchParams.get('index') ?? '0');
        return new Response(image.bytes, {
          status: 200,
          headers: headers({
            'Cache-Control': 'private, max-age=300',
            'Content-Length': String(image.bytes.byteLength),
            'Content-Type': image.contentType,
          }),
        });
      }
      if (action === 'creator') {
        method(request, 'POST');
        const session = await authenticated(request, service, config, true);
        await readJson(request);
        return json(200, { ok: true, creator: await service.creator(session) });
      }
      if (action === 'publish-init') {
        method(request, 'POST');
        const session = await authenticated(request, service, config, true);
        return json(202, { ok: true, ...(await service.publishInit(session, await readJson(request))) });
      }
      if (action === 'upload') {
        method(request, 'POST');
        const session = await authenticated(request, service, config, true);
        const bytes = await readVideo(request);
        const job = await service.upload(session, url.searchParams.get('jobId'), request.headers.get('x-nn-upload'), bytes);
        return json(202, { ok: true, job });
      }
      if (action === 'status') {
        method(request, 'GET');
        const session = await authenticated(request, service, config);
        return json(200, { ok: true, job: await service.status(session, url.searchParams.get('jobId')) });
      }
      if (action === 'disconnect') {
        method(request, 'POST');
        const session = await authenticated(request, service, config, true);
        const body = await readJson(request);
        return json(200, { ok: true, connection: await service.disconnect(session, body.provider) });
      }
      if (action === 'delete-data') {
        method(request, 'POST');
        const session = await authenticated(request, service, config, true);
        await readJson(request);
        return json(200, { ok: true, ...(await service.deleteData(session)) }, { 'Set-Cookie': expiredSessionCookie(config.secureCookies) });
      }
      throw new PublisherError(404, 'ACTION_NOT_FOUND', 'De gevraagde actie bestaat niet.');
    } catch (error) {
      const safe = publicError(error);
      return json(safe.status, safe.body, safe.headers ?? {});
    }
  };
}
