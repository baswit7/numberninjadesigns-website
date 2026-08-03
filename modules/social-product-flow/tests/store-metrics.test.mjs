import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  FlowError,
  JsonFlowStore,
  buildWinnerHookVariants,
  createMetricSchedule,
  normalizeMetrics,
  rankPublishedVariants
} from "../lib/index.mjs";

test("JSON store uses optimistic revisions and refuses secret-like fields", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nnd-social-flow-"));
  try {
    const store = new JsonFlowStore(join(directory, "campaign.json"));
    const first = await store.save({ campaignId: "campaign-1", state: "DRAFT" }, {
      expectedStoreRevision: 0,
      actor: "test"
    });
    assert.equal(first.storeRevision, 1);

    await assert.rejects(
      () => store.save({ campaignId: "campaign-1", state: "DRAFT" }, {
        expectedStoreRevision: 0
      }),
      (error) => error instanceof FlowError && error.code === "STORE_REVISION_CONFLICT"
    );

    await assert.rejects(
      () => store.save({ campaignId: "campaign-1", apiKey: "forbidden" }),
      (error) => error instanceof FlowError && error.code === "SECRET_FIELD_FORBIDDEN"
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("metric checkpoints and winner-derived hooks use only measured complete variants", () => {
  assert.deepEqual(createMetricSchedule("2026-07-28T10:00:00.000Z"), [
    { checkpoint: "24H", dueAt: "2026-07-29T10:00:00.000Z" },
    { checkpoint: "7D", dueAt: "2026-08-04T10:00:00.000Z" }
  ]);

  const metrics = normalizeMetrics(
    "instagram",
    { views: 1_000, likes: 50, comments: 5, shares: 4, saves: 8, clicks: 10 },
    new Date("2026-07-29T10:00:00.000Z")
  );
  const ranked = rankPublishedVariants([
    { id: "A", hook: "Your spreadsheet should do the math.", state: "COMPLETE", metrics },
    {
      id: "X",
      hook: "Estimated data is excluded.",
      state: "COMPLETE",
      metrics: { ...metrics, estimated: true, engagementRate: 1 }
    }
  ]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, "A");
  const variants = buildWinnerHookVariants(ranked[0]);
  assert.deepEqual(variants.map((variant) => variant.variant), ["B", "C"]);
  assert.ok(variants.every((variant) => variant.lineage === "A"));
});
