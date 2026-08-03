import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXECUTION_MODES,
  FlowError,
  PlatformRegistry,
  SocialProductOrchestrator,
  approvalInputFor,
  fingerprintApproval
} from "../lib/index.mjs";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(moduleRoot, "../..");

async function json(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function validation() {
  return {
    valid: true,
    profile: "SOCIAL_MASTER",
    facts: {
      codec: "h264",
      pixelFormat: "yuv420p",
      width: 1080,
      height: 1920,
      frameRate: 30,
      duration: 15,
      audioCodec: "aac"
    },
    issues: []
  };
}

test("dry-run campaign uses product/platform states and produces assisted handoffs only after approval", async () => {
  const product = await json(resolve(repositoryRoot, "modules/finance-product-factory/products/budget-planner-basic.json"));
  const registry = await PlatformRegistry.fromFile(resolve(moduleRoot, "config/platform-capabilities.json"));
  let currentTime = new Date("2026-07-28T10:00:00.000Z");
  const orchestrator = new SocialProductOrchestrator({
    registry,
    governance: { executionPlaneEnabled: false, providerCallsAllowed: false },
    executionMode: EXECUTION_MODES.DRY_RUN,
    clock: () => new Date(currentTime)
  });
  let campaign = await orchestrator.buildCampaign({
    product,
    platforms: ["etsy", "facebook", "instagram", "youtube", "tiktok", "pinterest"]
  });

  assert.equal(campaign.state, "DRAFT");
  assert.equal(campaign.platforms.etsy.state, "BLOCKED");
  assert.equal(campaign.platforms.instagram.state, "DRAFT");

  campaign = orchestrator.markRendered(campaign, {
    filePath: "C:\\verified\\social-master.mp4",
    fileSha256: "A".repeat(64),
    technicalValidation: validation(),
    humanVisualApproval: {
      approved: true,
      approvedBy: "Owner",
      approvedAt: "2026-07-28T10:00:00.000Z"
    }
  });
  campaign = orchestrator.approveCampaign(campaign, "Owner");
  assert.equal(campaign.state, "APPROVED");
  assert.equal(campaign.approval.fingerprint, fingerprintApproval(approvalInputFor(campaign)));

  campaign = orchestrator.queueApprovedCampaign(campaign);
  assert.equal(campaign.state, "ASSISTED_READY");
  assert.equal(campaign.platforms.facebook.state, "NEEDS_LINK");
  assert.equal(campaign.platforms.pinterest.state, "NEEDS_LINK");
  assert.equal(campaign.platforms.instagram.state, "ASSISTED_READY");

  const handoffs = await orchestrator.prepareAssistedHandoffs(campaign);
  assert.deepEqual(Object.keys(handoffs).sort(), ["instagram", "tiktok", "youtube"]);
  assert.equal(handoffs.instagram.status, "ASSISTED_READY");

  campaign = orchestrator.recordAssistedPublication(campaign, "instagram", {
    providerPostId: "ig-verified-123",
    publishedAt: "2026-07-28T10:00:00.000Z",
    recordedBy: "Owner",
    evidenceReference: "local-review/ig-verified-123.png"
  });
  assert.equal(campaign.platforms.instagram.state, "NEEDS_LINK");
  campaign = orchestrator.recordPublishedLink(
    campaign,
    "instagram",
    "https://www.instagram.com/reel/verified-123/",
    "Owner"
  );
  assert.equal(campaign.platforms.instagram.state, "PUBLISHED");

  currentTime = new Date("2026-07-29T10:00:00.000Z");
  campaign = orchestrator.recordMetricCheckpoint(
    campaign,
    "instagram",
    "24H",
    { views: 1000, likes: 60, comments: 4, shares: 5, saves: 10 },
    { recordedBy: "Owner" }
  );
  assert.equal(campaign.platforms.instagram.state, "METRICS_PENDING");
  currentTime = new Date("2026-08-04T10:00:00.000Z");
  campaign = orchestrator.recordMetricCheckpoint(
    campaign,
    "instagram",
    "7D",
    { views: 2400, likes: 130, comments: 12, shares: 18, saves: 31 },
    { recordedBy: "Owner" }
  );
  assert.equal(campaign.platforms.instagram.state, "COMPLETE");

  const revised = orchestrator.updateShareAndSaveUrl(
    campaign,
    "https://numberninjadesigns.etsy.com/listing/verified"
  );
  assert.equal(revised.revision, 2);
  assert.equal(revised.approval, null);
  assert.equal(revised.state, "AWAITING_APPROVAL");
});

test("explicit user confirmation preserves provenance and decision time", async () => {
  const product = await json(resolve(repositoryRoot, "modules/finance-product-factory/products/budget-planner-basic.json"));
  const registry = await PlatformRegistry.fromFile(resolve(moduleRoot, "config/platform-capabilities.json"));
  const orchestrator = new SocialProductOrchestrator({
    registry,
    executionMode: EXECUTION_MODES.DRY_RUN,
    clock: () => new Date("2026-07-28T21:00:00.000Z")
  });
  let campaign = await orchestrator.buildCampaign({
    product,
    platforms: ["instagram"],
    shareAndSaveUrl: "https://numberninjadesigns.etsy.com/listing/4545099893/product"
  });
  campaign = orchestrator.markRendered(campaign, {
    filePath: "C:\\verified\\social-master.mp4",
    fileSha256: "B".repeat(64),
    technicalValidation: validation()
  });
  const decidedAt = "2026-07-28T21:56:39.000Z";
  campaign = orchestrator.applyApprovalDecision(campaign, {
    campaignId: campaign.campaignId,
    revision: campaign.revision,
    fingerprint: fingerprintApproval(approvalInputFor(campaign)),
    decision: "APPROVE",
    visualApproved: true,
    approvedBy: "NumberNinjaDesigns owner",
    decidedAt,
    method: "EXPLICIT_USER_CONFIRMATION",
    statementSha256: "C".repeat(64)
  });

  assert.equal(campaign.state, "APPROVED");
  assert.equal(campaign.approval.approvedAt, decidedAt);
  assert.equal(campaign.media.master.humanVisualApproval.method, "EXPLICIT_USER_CONFIRMATION");
  assert.equal(campaign.media.master.humanVisualApproval.statementSha256, "C".repeat(64));
});

test("DRY_RUN and governance independently prevent automatic publication", async () => {
  const product = await json(resolve(repositoryRoot, "modules/finance-product-factory/products/budget-planner-basic.json"));
  const registry = new PlatformRegistry({
    schemaVersion: "1.0.0",
    platforms: {
      facebook: {
        mode: "ASSISTED",
        publicationPath: "REELS_API",
        supportsAutomaticPublish: true,
        supportsMetrics: true,
        requiresShareAndSaveUrl: false,
        reason: "Test bridge",
        evidence: []
      }
    }
  });
  const bridge = {
    async getCapabilities() {
      return {
        schemaVersion: "1.0.0",
        platform: "facebook",
        mode: "AUTOMATIC",
        publicationPath: "REELS_API",
        requiresShareAndSaveUrl: false
      };
    },
    async validate() {
      return { valid: true, issues: [] };
    },
    async prepare(context) {
      return context;
    },
    async publish() {
      return { providerPostId: "provider-123", canonicalUrl: "https://example.invalid/post/123" };
    },
    async reconcile() {
      return { outcome: "UNKNOWN" };
    },
    async fetchMetrics() {
      return { available: false };
    }
  };
  registry.registerAutomatic("facebook", { requiresShareAndSaveUrl: false }, bridge);
  const orchestrator = new SocialProductOrchestrator({
    registry,
    governance: { executionPlaneEnabled: true, providerCallsAllowed: true },
    executionMode: EXECUTION_MODES.DRY_RUN
  });
  let campaign = await orchestrator.buildCampaign({ product, platforms: ["facebook"] });
  campaign = orchestrator.markRendered(campaign, {
    filePath: "C:\\verified\\social-master.mp4",
    fileSha256: "B".repeat(64),
    technicalValidation: validation(),
    humanVisualApproval: { approved: true }
  });
  campaign = orchestrator.approveCampaign(campaign, "Owner");
  campaign = orchestrator.queueApprovedCampaign(campaign);

  await assert.rejects(
    () => orchestrator.publishPlatform(campaign, "facebook"),
    (error) => error instanceof FlowError && error.code === "DRY_RUN_ACTIVE"
  );
});
