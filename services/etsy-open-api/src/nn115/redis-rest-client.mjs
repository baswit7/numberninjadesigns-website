const COMMAND = /^[A-Z][A-Z0-9_-]{1,31}$/u;

export class DurableStoreError extends Error {
  constructor(code, message, statusCode = 503) {
    super(message);
    this.name = 'DurableStoreError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function fail(code, message, statusCode) {
  throw new DurableStoreError(code, message, statusCode);
}

function validateEndpoint(raw) {
  let url;
  try {
    url = new URL(String(raw ?? ''));
  } catch {
    fail('DURABLE_STORE_CONFIG_INVALID', 'Durable store URL is invalid.', 500);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    fail('DURABLE_STORE_CONFIG_INVALID', 'Durable store URL must be a credential-free HTTPS origin.', 500);
  }
  return url.toString().replace(/\/$/u, '');
}

function validateToken(raw) {
  if (typeof raw !== 'string' || raw.length < 16 || raw.length > 4_096 || /[\r\n]/u.test(raw)) {
    fail('DURABLE_STORE_CONFIG_INVALID', 'Durable store token is missing or invalid.', 500);
  }
  return raw;
}

function validateArgument(value) {
  if (typeof value === 'string' || typeof value === 'number') return value;
  fail('DURABLE_STORE_COMMAND_INVALID', 'Redis command arguments must be strings or numbers.', 500);
}

export class RedisRestClient {
  constructor({ url, token, fetchImpl = globalThis.fetch, timeoutMs = 10_000 }) {
    this.url = validateEndpoint(url);
    this.token = validateToken(token);
    if (typeof fetchImpl !== 'function') fail('DURABLE_STORE_CONFIG_INVALID', 'A fetch implementation is required.', 500);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) {
      fail('DURABLE_STORE_CONFIG_INVALID', 'Redis timeout is outside the safe range.', 500);
    }
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async command(command, ...args) {
    const name = String(command ?? '').toUpperCase();
    if (!COMMAND.test(name)) fail('DURABLE_STORE_COMMAND_INVALID', 'Redis command name is invalid.', 500);
    const payload = [name, ...args.map(validateArgument)];
    let response;
    try {
      response = await this.fetch(this.url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.token}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(payload),
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      fail('DURABLE_STORE_UNAVAILABLE', 'Durable store request failed.');
    }
    let body;
    try {
      body = await response.json();
    } catch {
      fail('DURABLE_STORE_UNAVAILABLE', 'Durable store returned an invalid response.');
    }
    if (!response.ok || !body || Object.hasOwn(body, 'error') || !Object.hasOwn(body, 'result')) {
      fail('DURABLE_STORE_UNAVAILABLE', 'Durable store rejected the request.');
    }
    return body.result;
  }

  async eval(script, keys, args) {
    if (typeof script !== 'string' || script.length < 10 || script.length > 32_000) {
      fail('DURABLE_STORE_COMMAND_INVALID', 'Redis script is invalid.', 500);
    }
    if (!Array.isArray(keys) || !Array.isArray(args) || keys.some(key => typeof key !== 'string')) {
      fail('DURABLE_STORE_COMMAND_INVALID', 'Redis script keys or arguments are invalid.', 500);
    }
    return this.command('EVAL', script, keys.length, ...keys, ...args);
  }
}

export function createRedisRestClient(env = process.env, dependencies = {}) {
  return new RedisRestClient({
    url: env.KV_REST_API_URL,
    token: env.KV_REST_API_TOKEN,
    ...dependencies,
  });
}
