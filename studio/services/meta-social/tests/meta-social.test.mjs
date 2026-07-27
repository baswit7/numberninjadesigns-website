import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { MetaSocialClient } from "../src/client.mjs";
import { getMetaEnvironmentReadiness, loadMetaEnvironment } from "../src/env.mjs";

function jsonResponse(payload, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("loads the canonical Meta environment without exposing values in readiness", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nnd-meta-"));
  const envPath = path.join(directory, ".env");
  fs.writeFileSync(
    envPath,
    [
      "META_GRAPH_API_VERSION=v99.0",
      "META_FACEBOOK_PAGE_ID=101",
      "META_FACEBOOK_PAGE_ACCESS_TOKEN=test-token",
      "INSTAGRAM_BUSINESS_ACCOUNT_ID=202",
    ].join("\n"),
  );

  try {
    const config = loadMetaEnvironment({ processEnvironment: {}, envPath });
    const readiness = getMetaEnvironmentReadiness({ processEnvironment: {}, envPath });
    assert.equal(config.pageId, "101");
    assert.equal(readiness.ready, true);
    assert.equal(JSON.stringify(readiness).includes("test-token"), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("uses bearer authorization, never a token query parameter, and normalizes data", async () => {
  const requests = [];
  const responses = [
    jsonResponse({ id: "101", name: "NumberNinjaDesigns", followers_count: 12 }),
    jsonResponse({ id: "202", username: "numberninjadesigns", followers_count: 9, media_count: 1 }),
    jsonResponse({
      data: [{
        id: "303",
        caption: "Product update",
        media_type: "IMAGE",
        permalink: "https://example.invalid/media/303",
        timestamp: "2026-07-27T10:00:00Z",
        like_count: 4,
        comments_count: 2,
      }],
    }),
  ];
  const client = new MetaSocialClient(
    {
      apiVersion: "v99.0",
      pageId: "101",
      pageAccessToken: "test-token",
      instagramAccountId: "202",
    },
    {
      fetchImpl: async (url, options) => {
        requests.push({ url: String(url), options });
        return responses.shift();
      },
      sleep: async () => {},
    },
  );

  const report = await client.sync({ mediaLimit: 10 });
  assert.equal(report.status, "connected");
  assert.equal(report.connection.color, "green");
  assert.equal(report.recentMedia.length, 1);
  assert.equal(report.summary.totalLikes, 4);
  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(new URL(request.url).searchParams.has("access_token"), false);
    assert.equal(request.options.headers.Authorization, "Bearer test-token");
    assert.equal(request.options.method, "GET");
  }
});

test("retries a rate-limited read request once", async () => {
  let callCount = 0;
  const client = new MetaSocialClient(
    {
      apiVersion: "v99.0",
      pageId: "101",
      pageAccessToken: "test-token",
      instagramAccountId: "202",
    },
    {
      fetchImpl: async () => {
        callCount += 1;
        return callCount === 1
          ? jsonResponse({ error: { code: 4 } }, { status: 429, headers: { "retry-after": "0" } })
          : jsonResponse({ id: "101" });
      },
      sleep: async () => {},
      maxRetries: 1,
    },
  );

  const response = await client.request("101", { fields: "id" });
  assert.equal(response.id, "101");
  assert.equal(callCount, 2);
});
