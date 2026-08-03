import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

export const SESSION_COOKIE = 'nnsp_session';
export const MAX_JSON_BYTES = 32 * 1024;
export const MAX_VIDEO_BYTES = 4_000_000;
export const MAX_IMAGE_BYTES = 3_500_000;
export const REVIEW_PRIVACY = 'SELF_ONLY';
export const PRIVACY_LEVELS = Object.freeze([
  'PUBLIC_TO_EVERYONE',
  'MUTUAL_FOLLOW_FRIENDS',
  'FOLLOWER_OF_CREATOR',
  'SELF_ONLY',
]);

export class PublisherError extends Error {
  constructor(status, code, message, options = {}) {
    super(message);
    this.name = 'PublisherError';
    this.status = status;
    this.code = code;
    this.retryable = options.retryable === true;
    this.reconnect = options.reconnect === true;
    this.headers = options.headers ?? null;
  }
}

export function invariant(condition, status, code, message, options) {
  if (!condition) throw new PublisherError(status, code, message, options);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function sha256Base64Url(value) {
  return createHash('sha256').update(value).digest('base64url');
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function newId() {
  return randomUUID();
}

export function secureEqualText(left, right) {
  const a = Buffer.from(String(left ?? ''), 'utf8');
  const b = Buffer.from(String(right ?? ''), 'utf8');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function encryptionKey(raw) {
  invariant(typeof raw === 'string' && /^[A-Za-z0-9+/]{43}=$/u.test(raw), 500, 'SERVER_CONFIGURATION_INVALID', 'De serverconfiguratie is ongeldig.');
  const key = Buffer.from(raw, 'base64');
  invariant(key.byteLength === 32, 500, 'SERVER_CONFIGURATION_INVALID', 'De serverconfiguratie is ongeldig.');
  return key;
}

export function sealText(value, keyValue, aad) {
  invariant(typeof value === 'string' && value.length > 0, 500, 'ENCRYPTION_INPUT_INVALID', 'Beveiligde opslag weigerde lege gegevens.');
  const key = encryptionKey(keyValue);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(String(aad), 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
}

export function openText(value, keyValue, aad) {
  const parts = String(value ?? '').split('.');
  invariant(parts.length === 4 && parts[0] === 'v1', 500, 'ENCRYPTED_DATA_INVALID', 'Beveiligde opslag bevat ongeldige gegevens.');
  try {
    const key = encryptionKey(keyValue);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64url'));
    decipher.setAAD(Buffer.from(String(aad), 'utf8'));
    decipher.setAuthTag(Buffer.from(parts[3], 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(parts[2], 'base64url')), decipher.final()]).toString('utf8');
  } catch (error) {
    if (error instanceof PublisherError) throw error;
    throw new PublisherError(500, 'ENCRYPTED_DATA_INVALID', 'Beveiligde opslag bevat ongeldige gegevens.');
  }
}

export function scalar(value, name, options = {}) {
  invariant(typeof value === 'string', 400, 'INVALID_INPUT', `${name} heeft een ongeldig type.`);
  const normalized = options.trim === false ? value : value.trim();
  invariant(normalized.length >= (options.min ?? 1) && normalized.length <= (options.max ?? 500), 400, 'INVALID_INPUT', `${name} heeft een ongeldige lengte.`);
  invariant(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized), 400, 'INVALID_INPUT', `${name} bevat ongeldige tekens.`);
  if (options.pattern) invariant(options.pattern.test(normalized), 400, 'INVALID_INPUT', `${name} heeft een ongeldig formaat.`);
  if (options.allowed) invariant(options.allowed.includes(normalized), 400, 'INVALID_INPUT', `${name} bevat een niet-ondersteunde waarde.`);
  return normalized;
}

export function booleanValue(value, name) {
  invariant(typeof value === 'boolean', 400, 'INVALID_INPUT', `${name} moet waar of onwaar zijn.`);
  return value;
}

export function integerValue(value, name, minimum, maximum) {
  invariant(Number.isInteger(value) && value >= minimum && value <= maximum, 400, 'INVALID_INPUT', `${name} valt buiten het toegestane bereik.`);
  return value;
}

export function parseCookies(header) {
  const result = new Map();
  for (const part of String(header ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name && !result.has(name)) result.set(name, value);
  }
  return result;
}

export function sessionCookie(value, secure = true, maxAge = 2_592_000) {
  const segments = [`${SESSION_COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (secure) segments.push('Secure');
  return segments.join('; ');
}

export function expiredSessionCookie(secure = true) {
  return sessionCookie('', secure, 0);
}

export function sanitizeDetails(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const allowed = new Set(['provider', 'action', 'code', 'jobId', 'listingId', 'state', 'status', 'mode']);
  return Object.fromEntries(Object.entries(value)
    .filter(([key, item]) => allowed.has(key) && ['string', 'number', 'boolean'].includes(typeof item))
    .map(([key, item]) => [key, typeof item === 'string' ? item.slice(0, 160) : item]));
}

export function publicError(error) {
  if (error instanceof PublisherError) {
    return {
      status: error.status,
      body: {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          reconnect: error.reconnect,
        },
      },
      headers: error.headers,
    };
  }
  return {
    status: 500,
    body: { ok: false, error: { code: 'INTERNAL_ERROR', message: 'De aanvraag kon niet veilig worden verwerkt.', retryable: false, reconnect: false } },
    headers: null,
  };
}
