import { createHash, timingSafeEqual } from 'node:crypto';

const MAX_BODY_BYTES = 16 * 1024;
const BASE_HEADERS = Object.freeze({
  'cache-control': 'no-store, max-age=0',
  'content-type': 'application/json; charset=utf-8',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'x-robots-tag': 'noindex, nofollow, noarchive',
});

export class HttpBoundaryError extends Error {
  constructor(code, statusCode) {
    super(code);
    this.name = 'HttpBoundaryError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function reject(code, statusCode) {
  throw new HttpBoundaryError(code, statusCode);
}

export function header(request, name) {
  const normalized = name.toLocaleLowerCase('en-US');
  const fromGetter = request?.headers?.get?.(normalized);
  if (typeof fromGetter === 'string') return fromGetter;
  const direct = request?.headers?.[normalized] ?? request?.headers?.[name];
  return Array.isArray(direct) ? direct.join(',') : typeof direct === 'string' ? direct : '';
}

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function bearerAuthorized(request, expectedSecret) {
  if (typeof expectedSecret !== 'string' || expectedSecret.length < 32 || expectedSecret.length > 512) {
    reject('AUTHORITY_NOT_CONFIGURED', 503);
  }
  const authorization = header(request, 'authorization');
  const presented = authorization.startsWith('Bearer ') && authorization.length <= 520
    ? authorization.slice(7)
    : '';
  return timingSafeEqual(digest(presented), digest(expectedSecret));
}

export function requireBearer(request, expectedSecret) {
  if (!bearerAuthorized(request, expectedSecret)) reject('UNAUTHORIZED', 401);
}

export function requireMethod(request, method) {
  if (request?.method !== method) reject('METHOD_NOT_ALLOWED', 405);
}

async function bodyText(request) {
  const contentLength = Number(header(request, 'content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) reject('REQUEST_TOO_LARGE', 413);
  if (request.body !== undefined) {
    const value = typeof request.body === 'string'
      ? request.body
      : Buffer.isBuffer(request.body)
        ? request.body.toString('utf8')
        : JSON.stringify(request.body);
    if (Buffer.byteLength(value, 'utf8') > MAX_BODY_BYTES) reject('REQUEST_TOO_LARGE', 413);
    return value;
  }
  if (!request || typeof request[Symbol.asyncIterator] !== 'function') return '';
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) reject('REQUEST_TOO_LARGE', 413);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function readStrictJson(request) {
  const contentType = header(request, 'content-type').split(';', 1)[0].trim().toLocaleLowerCase('en-US');
  if (contentType !== 'application/json') reject('UNSUPPORTED_MEDIA_TYPE', 415);
  const text = await bodyText(request);
  if (!text) reject('MALFORMED_JSON', 400);
  try {
    return JSON.parse(text);
  } catch {
    reject('MALFORMED_JSON', 400);
  }
}

export function sendJson(response, statusCode, body, extraHeaders = {}) {
  response.statusCode = statusCode;
  for (const [name, value] of Object.entries({ ...BASE_HEADERS, ...extraHeaders })) response.setHeader(name, value);
  response.end(JSON.stringify(body));
}

export function sendError(response, error) {
  const statusCode = Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode <= 599
    ? error.statusCode
    : 500;
  const candidate = String(error?.code ?? 'INTERNAL_ERROR').toLocaleUpperCase('en-US').replace(/[^A-Z0-9_]/gu, '_');
  const errorCode = candidate.length >= 3 && candidate.length <= 160 ? candidate : 'INTERNAL_ERROR';
  const headers = errorCode === 'METHOD_NOT_ALLOWED' ? { allow: error?.allowedMethod ?? 'GET' } : {};
  sendJson(response, statusCode, { errorCode, secretValuesReported: false }, headers);
}
