import { SCHEMA_VERSION, assert } from "./core.mjs";

const METRIC_FIELDS = Object.freeze([
  "impressions",
  "views",
  "reach",
  "likes",
  "comments",
  "shares",
  "saves",
  "clicks",
  "watchTimeSeconds"
]);

export function createMetricSchedule(publishedAt) {
  const published = new Date(publishedAt);
  assert(!Number.isNaN(published.getTime()), "PUBLISHED_AT_INVALID", "A valid publication time is required.");
  return [
    {
      checkpoint: "24H",
      dueAt: new Date(published.getTime() + 24 * 60 * 60 * 1_000).toISOString()
    },
    {
      checkpoint: "7D",
      dueAt: new Date(published.getTime() + 7 * 24 * 60 * 60 * 1_000).toISOString()
    }
  ];
}

export function normalizeMetrics(platform, raw, capturedAt = new Date()) {
  const metrics = Object.fromEntries(
    METRIC_FIELDS.map((field) => {
      const value = Number(raw?.[field] ?? 0);
      return [field, Number.isFinite(value) && value >= 0 ? value : 0];
    })
  );
  const engagement =
    metrics.likes + metrics.comments * 2 + metrics.shares * 3 + metrics.saves * 3 + metrics.clicks * 4;
  const denominator = Math.max(metrics.views, metrics.reach, metrics.impressions, 1);

  return {
    schemaVersion: SCHEMA_VERSION,
    platform,
    capturedAt: capturedAt.toISOString(),
    metrics,
    engagementScore: engagement,
    engagementRate: Number((engagement / denominator).toFixed(6)),
    source: "PROVIDER_ADAPTER",
    estimated: false
  };
}

export function rankPublishedVariants(variants) {
  assert(Array.isArray(variants) && variants.length > 0, "METRIC_VARIANTS_MISSING", "Published variants are required.");
  const eligible = variants.filter(
    (variant) =>
      variant?.state === "COMPLETE" &&
      variant?.metrics?.estimated === false &&
      Number.isFinite(variant?.metrics?.engagementRate)
  );

  return eligible
    .map((variant) => ({
      id: variant.id,
      hook: variant.hook,
      engagementRate: variant.metrics.engagementRate,
      engagementScore: variant.metrics.engagementScore
    }))
    .sort(
      (left, right) =>
        right.engagementRate - left.engagementRate ||
        right.engagementScore - left.engagementScore ||
        left.id.localeCompare(right.id)
    );
}

export function buildWinnerHookVariants(winner) {
  assert(winner?.hook, "WINNER_HOOK_MISSING", "A proven winner hook is required.");
  return [
    {
      variant: "B",
      lineage: winner.id,
      hook: `Stop rebuilding your budget every month. ${winner.hook}`
    },
    {
      variant: "C",
      lineage: winner.id,
      hook: `${winner.hook} Now check the dashboard before the month checks you.`
    }
  ];
}
