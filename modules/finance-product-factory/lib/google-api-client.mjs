const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 4;
const MAX_RETRY_DELAY_MS = 60_000;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_403_REASONS = new Set([
  "rateLimitExceeded",
  "userRateLimitExceeded",
  "sharingRateLimitExceeded"
]);

export class GoogleApiError extends Error {
  constructor(message, { status = null, reason = null, retryable = false } = {}) {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
    this.reason = reason;
    this.retryable = retryable;
  }
}

function validateAccessToken(value) {
  if (
    typeof value !== "string" ||
    value.length < 20 ||
    value.length > 8192 ||
    /\s/.test(value)
  ) {
    throw new GoogleApiError("Google access token is unavailable or malformed.");
  }
  return value;
}

function validateRequestUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !(
      url.hostname === "www.googleapis.com" ||
      url.hostname === "sheets.googleapis.com"
    )
  ) {
    throw new GoogleApiError("Google API request target is not allow-listed.");
  }
  return url.toString();
}

async function readGoogleError(response) {
  let payload;
  try {
    const text = await response.text();
    payload = text.length <= 64_000 ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  const rawReason =
    payload?.error?.errors?.find((item) => typeof item?.reason === "string")
      ?.reason ?? null;
  const reason =
    typeof rawReason === "string" && /^[A-Za-z0-9_.-]{1,100}$/.test(rawReason)
      ? rawReason
      : null;
  return {
    reason,
    retryable:
      RETRYABLE_STATUSES.has(response.status) ||
      (response.status === 403 && RETRYABLE_403_REASONS.has(reason))
  };
}

function retryDelay(attempt, response, random) {
  const retryAfter = Number(response?.headers?.get?.("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter * 1000, MAX_RETRY_DELAY_MS);
  }
  const exponential = 500 * 2 ** Math.max(0, attempt - 1);
  return Math.min(exponential + Math.floor(random() * 250), MAX_RETRY_DELAY_MS);
}

export function createEnvironmentAccessTokenProvider(
  environment = process.env,
  variableName = "GOOGLE_FACTORY_ACCESS_TOKEN"
) {
  return async () => validateAccessToken(environment[variableName]);
}

export function createGoogleApiClient({
  accessTokenProvider,
  fetchImpl = globalThis.fetch,
  sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  random = Math.random,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS
} = {}) {
  if (typeof accessTokenProvider !== "function") {
    throw new TypeError("accessTokenProvider must be a function.");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A Fetch implementation is required.");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120_000) {
    throw new RangeError("timeoutMs must be between 1000 and 120000.");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 8) {
    throw new RangeError("maxAttempts must be between 1 and 8.");
  }

  return Object.freeze({
    async request({
      url,
      label,
      method = "GET",
      headers = {},
      body,
      acceptedStatuses = [200],
      idempotent = true
    }) {
      const target = validateRequestUrl(url);
      const accepted = new Set(acceptedStatuses);
      let forceRefresh = false;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const accessToken = validateAccessToken(
          await accessTokenProvider({ forceRefresh })
        );
        forceRefresh = false;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        let response;

        try {
          response = await fetchImpl(target, {
            method,
            headers: {
              Accept: "application/json",
              ...headers,
              Authorization: `Bearer ${accessToken}`
            },
            body,
            signal: controller.signal
          });
        } catch {
          const canRetry = idempotent && attempt < maxAttempts;
          if (!canRetry) {
            throw new GoogleApiError(`${label} failed without an HTTP response.`, {
              retryable: true
            });
          }
          await sleep(retryDelay(attempt, null, random));
          continue;
        } finally {
          clearTimeout(timeout);
        }

        if (accepted.has(response.status)) return response;

        const details = await readGoogleError(response);
        const tokenExpired = response.status === 401;
        const canRetry =
          attempt < maxAttempts &&
          (tokenExpired || (idempotent && details.retryable));
        if (!canRetry) {
          const suffix = details.reason ? `: ${details.reason}` : "";
          throw new GoogleApiError(
            `${label} failed (HTTP ${response.status}${suffix}).`,
            {
              status: response.status,
              reason: details.reason,
              retryable: details.retryable
            }
          );
        }

        forceRefresh = tokenExpired;
        await sleep(retryDelay(attempt, response, random));
      }

      throw new GoogleApiError(`${label} exhausted its retry budget.`);
    }
  });
}
