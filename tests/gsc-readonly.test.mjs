import test from "node:test";
import assert from "node:assert/strict";
import {
  querySearchConsole,
  resolveDateRange
} from "../scripts/gsc/fetch-search-console.mjs";

const accessToken = "test-access-token-with-safe-length";
const siteUrl = "https://www.numberninjadesigns.com/";

test("default Search Console range is finalized and bounded to 28 days", () => {
  assert.deepEqual(resolveDateRange({ now: new Date("2026-07-27T12:00:00Z") }), {
    startDate: "2026-06-27",
    endDate: "2026-07-24"
  });
});

test("readonly query uses the canonical property and produces a private report contract", async () => {
  let request;
  const report = await querySearchConsole(
    {
      accessToken,
      siteUrl,
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      now: new Date("2026-07-27T12:00:00Z")
    },
    {
      fetchImpl: async (url, options) => {
        request = { url, options };
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              rows: [
                { keys: ["2026-07-01"], clicks: 2, impressions: 20, ctr: 0.1, position: 4 },
                { keys: ["2026-07-02"], clicks: 3, impressions: 30, ctr: 0.1, position: 6 }
              ]
            };
          }
        };
      }
    }
  );

  assert.equal(
    request.url,
    "https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fwww.numberninjadesigns.com%2F/searchAnalytics/query"
  );
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, `Bearer ${accessToken}`);
  assert.deepEqual(JSON.parse(request.options.body).dimensions, ["date"]);
  assert.equal(JSON.parse(request.options.body).dataState, "final");
  assert.equal(report.authorizationScope, "https://www.googleapis.com/auth/webmasters.readonly");
  assert.equal(report.summary.clicks, 5);
  assert.equal(report.summary.impressions, 50);
  assert.equal(report.summary.position, 5.2);
  assert.equal(JSON.stringify(report).includes(accessToken), false);
});

test("query fails closed for absent credentials or a non-canonical property", async () => {
  await assert.rejects(
    () => querySearchConsole({ accessToken: "", siteUrl }),
    /access token is unavailable/
  );
  await assert.rejects(
    () => querySearchConsole({ accessToken, siteUrl: "https://numberninjadesigns.com/" }),
    /canonical URL-prefix property/
  );
});

test("query retries bounded transient failures without leaking response bodies", async () => {
  let attempts = 0;
  const report = await querySearchConsole(
    {
      accessToken,
      siteUrl,
      startDate: "2026-07-01",
      endDate: "2026-07-01"
    },
    {
      fetchImpl: async () => {
        attempts += 1;
        if (attempts < 3) return { ok: false, status: 429 };
        return { ok: true, status: 200, async json() { return {}; } };
      },
      sleep: async () => {}
    }
  );
  assert.equal(attempts, 3);
  assert.equal(report.rowCount, 0);
});

test("invalid dates and oversized windows are rejected before any request", () => {
  assert.throws(
    () => resolveDateRange({ startDate: "2026-07-02", endDate: "2026-07-01" }),
    /must not be after/
  );
  assert.throws(
    () => resolveDateRange({ startDate: "2026-01-01", endDate: "2026-07-01" }),
    /must not exceed 90 days/
  );
});
