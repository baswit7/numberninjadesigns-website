const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_MEDIA_LIMIT = 25;

export class MetaApiError extends Error {
  constructor(code, { status = null, providerCode = null } = {}) {
    super(code);
    this.name = "MetaApiError";
    this.code = code;
    this.status = status;
    this.providerCode = providerCode;
  }
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, parsed));
}

function retryDelayMs(response, attempt) {
  const retryAfter = Number.parseFloat(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(10_000, retryAfter * 1_000);
  }
  return Math.min(5_000, 500 * (2 ** attempt));
}

async function safeProviderCode(response) {
  try {
    const payload = await response.clone().json();
    const value = payload?.error?.code;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  } catch {
    return null;
  }
}

function normalizePage(page) {
  return {
    id: String(page.id),
    name: page.name ?? null,
    category: page.category ?? null,
    followersCount: Number.isFinite(Number(page.followers_count))
      ? Number(page.followers_count)
      : null,
    fanCount: Number.isFinite(Number(page.fan_count)) ? Number(page.fan_count) : null,
  };
}

function normalizeInstagram(account) {
  return {
    id: String(account.id),
    username: account.username ?? null,
    name: account.name ?? null,
    biography: account.biography ?? null,
    website: account.website ?? null,
    followersCount: Number.isFinite(Number(account.followers_count))
      ? Number(account.followers_count)
      : null,
    followsCount: Number.isFinite(Number(account.follows_count))
      ? Number(account.follows_count)
      : null,
    mediaCount: Number.isFinite(Number(account.media_count))
      ? Number(account.media_count)
      : null,
  };
}

function normalizeMedia(media) {
  return {
    id: String(media.id),
    caption: media.caption ?? "",
    mediaType: media.media_type ?? "UNKNOWN",
    permalink: media.permalink ?? null,
    timestamp: media.timestamp ?? null,
    likeCount: Number.isFinite(Number(media.like_count)) ? Number(media.like_count) : null,
    commentsCount: Number.isFinite(Number(media.comments_count))
      ? Number(media.comments_count)
      : null,
  };
}

export class MetaSocialClient {
  constructor(config, {
    fetchImpl = globalThis.fetch,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new Error("FETCH_NOT_AVAILABLE");
    }
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.sleep = sleep;
    this.timeoutMs = boundedInteger(timeoutMs, DEFAULT_TIMEOUT_MS, 1_000, 60_000);
    this.maxRetries = boundedInteger(maxRetries, DEFAULT_MAX_RETRIES, 0, 5);
  }

  async request(assetPath, parameters) {
    const url = new URL(
      `${encodeURIComponent(this.config.apiVersion)}/${encodeURIComponent(assetPath)}`,
      "https://graph.facebook.com/",
    );
    for (const [name, value] of Object.entries(parameters)) {
      url.searchParams.set(name, String(value));
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      let response;

      try {
        response = await this.fetchImpl(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.config.pageAccessToken}`,
          },
          signal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timeout);
        if (attempt < this.maxRetries) {
          await this.sleep(Math.min(5_000, 500 * (2 ** attempt)));
          continue;
        }
        throw new MetaApiError(
          error?.name === "AbortError" ? "META_REQUEST_TIMEOUT" : "META_NETWORK_ERROR",
        );
      }
      clearTimeout(timeout);

      if (response.ok) {
        try {
          return await response.json();
        } catch {
          throw new MetaApiError("META_RESPONSE_INVALID_JSON", { status: response.status });
        }
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < this.maxRetries) {
        await this.sleep(retryDelayMs(response, attempt));
        continue;
      }

      throw new MetaApiError("META_REQUEST_FAILED", {
        status: response.status,
        providerCode: await safeProviderCode(response),
      });
    }

    throw new MetaApiError("META_RETRY_EXHAUSTED");
  }

  async sync({ mediaLimit = DEFAULT_MEDIA_LIMIT } = {}) {
    const limit = boundedInteger(mediaLimit, DEFAULT_MEDIA_LIMIT, 1, 100);
    const [page, instagram, media] = await Promise.all([
      this.request(this.config.pageId, {
        fields: "id,name,category,fan_count,followers_count",
      }),
      this.request(this.config.instagramAccountId, {
        fields: "id,username,name,biography,website,followers_count,follows_count,media_count",
      }),
      this.request(`${this.config.instagramAccountId}/media`, {
        fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count",
        limit,
      }),
    ]);

    if (String(page.id) !== this.config.pageId) {
      throw new MetaApiError("META_PAGE_ID_MISMATCH");
    }
    if (String(instagram.id) !== this.config.instagramAccountId) {
      throw new MetaApiError("META_INSTAGRAM_ID_MISMATCH");
    }

    const recentMedia = Array.isArray(media.data) ? media.data.map(normalizeMedia) : [];
    return {
      schemaVersion: "1.0.0",
      generatedAt: new Date().toISOString(),
      source: "meta-graph-api:read-only",
      status: "connected",
      connection: {
        state: "connected",
        color: "green",
      },
      facebookPage: normalizePage(page),
      instagramBusinessAccount: normalizeInstagram(instagram),
      recentMedia,
      summary: {
        recentMediaCount: recentMedia.length,
        totalLikes: recentMedia.reduce((total, item) => total + (item.likeCount ?? 0), 0),
        totalComments: recentMedia.reduce(
          (total, item) => total + (item.commentsCount ?? 0),
          0,
        ),
      },
      boundaries: {
        readOnly: true,
        methods: ["GET"],
        publishesContent: false,
        sendsMessages: false,
        managesComments: false,
        managesAdvertising: false,
        storesSecrets: false,
        storesRawProviderResponses: false,
      },
    };
  }
}
