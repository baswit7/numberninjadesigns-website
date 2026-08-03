import { createHash } from 'node:crypto';

import { EtsyIntegrationError } from './integration.mjs';

const PRODUCT_FACTORY_EVENT_ENDPOINT = 'http://127.0.0.1:4173/api/social/etsy-events';
const MAX_EVENT_BYTES = 1024 * 1024;
const MAX_RESPONSE_BYTES = 64 * 1024;
const ACCEPTED_STATUSES = new Set(['CAMPAIGN_STARTED', 'PROCESSING', 'QUEUED']);

function fail(code, message, options) {
  throw new EtsyIntegrationError(code, message, options);
}

function validatedEndpoint(value) {
  const endpoint = String(value ?? '').trim();
  if (endpoint !== PRODUCT_FACTORY_EVENT_ENDPOINT) {
    fail(
      'CONFIG_INVALID',
      `ETSY_SOCIAL_EVENT_ENDPOINT must equal ${PRODUCT_FACTORY_EVENT_ENDPOINT}`
    );
  }
  return endpoint;
}

function eventKey(event) {
  const receipt = event?.etsyReceipt;
  const source = `${receipt?.listingId ?? ''}\n${receipt?.listingRevision ?? ''}\n${receipt?.productId ?? ''}`;
  if (!/^\d{4,30}\n[^\r\n]{1,120}\n[^\r\n]{2,120}$/u.test(source)) {
    fail('SOCIAL_EVENT_INVALID', 'The social event is missing a stable Etsy identity');
  }
  return createHash('sha256').update(source).digest('hex').slice(0, 32);
}

async function boundedJson(response) {
  if (!response.body) fail('SOCIAL_EVENT_RESPONSE_INVALID', 'Product Factory returned an empty response');
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await response.body.cancel().catch(() => undefined);
      fail('SOCIAL_EVENT_RESPONSE_INVALID', 'Product Factory returned an oversized response');
    }
    chunks.push(Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks, total).toString('utf8'));
  } catch {
    fail('SOCIAL_EVENT_RESPONSE_INVALID', 'Product Factory returned invalid JSON');
  }
}

function acceptedResult(key) {
  return Object.freeze({
    externalResourceId: key,
    outcome: 'social-campaign-enqueued'
  });
}

export class ProductFactorySocialEventSink {
  constructor({
    endpoint = PRODUCT_FACTORY_EVENT_ENDPOINT,
    fetchImpl = globalThis.fetch,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    timeoutMs = 20_000
  } = {}) {
    if (typeof fetchImpl !== 'function' || typeof sleep !== 'function') {
      fail('CONFIG_INVALID', 'Social event transport dependencies are invalid');
    }
    this.endpoint = validatedEndpoint(endpoint);
    this.fetch = fetchImpl;
    this.sleep = sleep;
    this.timeoutMs = Math.max(1_000, Math.min(60_000, Number(timeoutMs) || 20_000));
  }

  async reconcile(event) {
    const key = eventKey(event);
    const receiptUrl = new URL('/api/social/etsy-events/receipt', this.endpoint);
    receiptUrl.searchParams.set('eventKey', key);
    let response;
    try {
      response = await this.fetch(receiptUrl, {
        method: 'GET',
        headers: { accept: 'application/json' },
        redirect: 'manual',
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch {
      return Object.freeze({ status: 'unknown' });
    }
    if (response.status === 404) return Object.freeze({ status: 'absent' });
    if (response.status === 429 || [502, 503, 504].includes(response.status)) {
      return Object.freeze({ status: 'unknown' });
    }
    if (response.status !== 200) {
      fail('SOCIAL_EVENT_RECONCILIATION_REJECTED', 'Product Factory rejected social event reconciliation');
    }
    const payload = await boundedJson(response);
    if (payload?.event?.eventKey !== key || !ACCEPTED_STATUSES.has(payload?.event?.status)) {
      fail('SOCIAL_EVENT_RESPONSE_INVALID', 'Product Factory returned a mismatched social event receipt');
    }
    return Object.freeze({ status: 'succeeded', result: acceptedResult(key) });
  }

  async enqueue(event) {
    const key = eventKey(event);
    const body = JSON.stringify(event);
    if (Buffer.byteLength(body) > MAX_EVENT_BYTES) {
      fail('SOCIAL_EVENT_INVALID', 'The social event exceeds 1 MiB');
    }
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      let response = null;
      try {
        response = await this.fetch(this.endpoint, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'idempotency-key': key
          },
          body,
          redirect: 'manual',
          signal: AbortSignal.timeout(this.timeoutMs)
        });
      } catch {
        // A timeout can occur after local intake. Reconcile before every retry.
      }
      if (response?.status === 202) {
        try {
          const payload = await boundedJson(response);
          if (payload?.event?.eventKey === key && ACCEPTED_STATUSES.has(payload?.event?.status)) {
            return acceptedResult(key);
          }
        } catch (error) {
          if (error?.code !== 'SOCIAL_EVENT_RESPONSE_INVALID') throw error;
        }
      } else if (response && response.status !== 429 && ![502, 503, 504].includes(response.status)) {
        fail('SOCIAL_EVENT_REJECTED', 'Product Factory rejected the social event');
      }
      const resolution = await this.reconcile(event);
      if (resolution.status === 'succeeded') return resolution.result;
      if (attempt < 3) await this.sleep(250 * (2 ** (attempt - 1)));
    }
    fail(
      'SOCIAL_EVENT_OUTCOME_UNKNOWN',
      'Product Factory social event outcome is unknown and requires readback reconciliation'
    );
  }
}

export function createSocialEventSinkFromEnv(env = process.env, dependencies = {}) {
  const endpoint = typeof env.ETSY_SOCIAL_EVENT_ENDPOINT === 'string'
    ? env.ETSY_SOCIAL_EVENT_ENDPOINT.trim()
    : '';
  if (!endpoint) return null;
  return new ProductFactorySocialEventSink({ endpoint, ...dependencies });
}

export function productFactorySocialEventKey(event) {
  return eventKey(event);
}
