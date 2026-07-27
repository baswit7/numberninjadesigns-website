const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const FORMULA_PREFIX = /^[=+\-@]/;
const INVALID_FILENAME = /[<>:"/\\|?*\u0000-\u001f]/g;

export const SECURITY_LIMITS = Object.freeze({
  importBytes: 1_000_000,
  jsonDepth: 12,
  arrayItems: 10_000,
  // Twenty-image commercial releases legitimately exceed the former 2,000-key
  // ceiling once their contract, checksum and validation evidence is embedded.
  // The 1 MB byte limit, depth limit and array limit still bound hostile input.
  objectKeys: 5_000,
  textLength: 20_000,
  filenameLength: 120,
  zipEntries: 250,
  zipUncompressedBytes: 50_000_000,
});

export function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function assertSafeStructure(value, limits = SECURITY_LIMITS) {
  const seen = new WeakSet();
  let arrayItems = 0;
  let objectKeys = 0;

  function visit(current, depth) {
    if (depth > limits.jsonDepth) throw new Error(`Import exceeds maximum nesting depth ${limits.jsonDepth}.`);
    if (current === null || ['string', 'number', 'boolean'].includes(typeof current)) {
      if (typeof current === 'string' && current.length > limits.textLength) {
        throw new Error(`Text exceeds maximum length ${limits.textLength}.`);
      }
      if (typeof current === 'number' && !Number.isFinite(current)) throw new Error('Non-finite numbers are not allowed.');
      return;
    }
    if (typeof current !== 'object') throw new Error(`Unsupported imported value type: ${typeof current}.`);
    if (seen.has(current)) throw new Error('Cyclic data is not allowed.');
    seen.add(current);

    if (Array.isArray(current)) {
      arrayItems += current.length;
      if (arrayItems > limits.arrayItems) throw new Error(`Import exceeds ${limits.arrayItems} array items.`);
      for (const item of current) visit(item, depth + 1);
    } else {
      if (!isPlainObject(current)) throw new Error('Only plain JSON objects are allowed.');
      const keys = Object.keys(current);
      objectKeys += keys.length;
      if (objectKeys > limits.objectKeys) throw new Error(`Import exceeds ${limits.objectKeys} object keys.`);
      for (const key of keys) {
        if (BLOCKED_KEYS.has(key)) throw new Error(`Forbidden object key: ${key}.`);
        visit(current[key], depth + 1);
      }
    }
    seen.delete(current);
  }

  visit(value, 0);
  return value;
}

export function safeJsonParse(text, limits = SECURITY_LIMITS) {
  if (typeof text !== 'string') throw new TypeError('JSON input must be text.');
  if (new TextEncoder().encode(text).byteLength > limits.importBytes) {
    throw new Error(`Import exceeds maximum size ${limits.importBytes} bytes.`);
  }
  return assertSafeStructure(JSON.parse(text), limits);
}

export function cloneSafe(value) {
  assertSafeStructure(value);
  return structuredClone(value);
}

export function sanitizeFilename(value, fallback = 'finance-product') {
  const normalized = String(value ?? '')
    .normalize('NFKC')
    .replace(INVALID_FILENAME, '-')
    .replace(/\s+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, SECURITY_LIMITS.filenameLength);
  const safe = normalized || fallback;
  if (safe === '.' || safe === '..' || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe)) {
    return `file-${safe.replaceAll('.', '-')}`;
  }
  return safe;
}

export function safeSpreadsheetText(value) {
  const text = String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, SECURITY_LIMITS.textLength);
  return FORMULA_PREFIX.test(text.trimStart()) ? `'${text}` : text;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function validateZipPath(path) {
  if (typeof path !== 'string' || !path || path.length > 240) throw new Error('Invalid ZIP entry path.');
  const normalized = path.replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) throw new Error(`Absolute ZIP path rejected: ${path}`);
  if (/[\u0000-\u001f\u007f<>:"|?*]/.test(normalized)) throw new Error(`Unsafe character in ZIP entry path: ${path}`);
  const segments = normalized.split('/');
  if (segments.some(segment => {
    const stem = segment.split('.')[0];
    return !segment || segment === '.' || segment === '..' || BLOCKED_KEYS.has(segment) || /[. ]$/.test(segment) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem);
  })) {
    throw new Error(`Unsafe ZIP entry path rejected: ${path}`);
  }
  return normalized;
}

export function stableStringify(value) {
  assertSafeStructure(value);
  const seen = new WeakSet();
  const sort = current => {
    if (current === null || typeof current !== 'object') return current;
    if (seen.has(current)) throw new Error('Cyclic data is not serializable.');
    seen.add(current);
    const result = Array.isArray(current)
      ? current.map(sort)
      : Object.fromEntries(Object.keys(current).sort().map(key => [key, sort(current[key])]));
    seen.delete(current);
    return result;
  };
  return JSON.stringify(sort(value));
}

export async function sha256Hex(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function assertAllowedKeys(object, allowed, label = 'object') {
  if (!isPlainObject(object)) throw new TypeError(`${label} must be a plain object.`);
  const extra = Object.keys(object).filter(key => !allowed.includes(key));
  if (extra.length) throw new Error(`${label} contains unknown fields: ${extra.join(', ')}.`);
  return object;
}
