import {
  ADAPTER_MODES,
  EXECUTION_MODES,
  SCHEMA_VERSION,
  approvalIsCurrent,
  assert,
  classifyPublicationFailure,
  createApproval,
  createIdempotencyKey,
  isSafeHttpsUrl,
  sha256,
  stableStringify,
  transitionState
} from "./core.mjs";
import { buildCampaignContent, buildSocialMasterPlan } from "./content.mjs";
import { createMetricSchedule, normalizeMetrics } from "./metrics.mjs";

const APPROVAL_METHODS = Object.freeze([
  "LOCAL_APPROVAL_CONSOLE",
  "EXPLICIT_USER_CONFIRMATION"
]);

function stateEntity(state, now, reason = null) {
  return {
    state,
    updatedAt: now.toISOString(),
    history: [{
      from: null,
      to: state,
      at: now.toISOString(),
      reason,
      actor: "system"
    }]
  };
}

function selectedPlatformNames(campaign) {
  return Object.keys(campaign.platforms).sort();
}

export function approvalInputFor(campaign) {
  return {
    revision: campaign.revision,
    video: {
      fileName: campaign.media.master.fileName,
      sha256: campaign.media.master.sha256,
      profile: campaign.media.master.profile,
      facts: campaign.media.master.technicalValidation?.facts ?? null,
      variants: Object.fromEntries(
        Object.entries(campaign.media.variants ?? {}).map(([name, variant]) => [
          name,
          {
            fileName: variant.fileName,
            sha256: variant.sha256,
            profile: variant.profile,
            facts: variant.technicalValidation?.facts ?? null
          }
        ])
      )
    },
    cover: Object.fromEntries(
      selectedPlatformNames(campaign).map((platform) => [
        platform,
        campaign.content.platforms[platform].cover
      ])
    ),
    text: Object.fromEntries(
      selectedPlatformNames(campaign).map((platform) => [
        platform,
        campaign.content.platforms[platform].metadata
      ])
    ),
    link: campaign.content.canonical.shareAndSaveUrl,
    platforms: selectedPlatformNames(campaign),
    audience: campaign.content.canonical.audience
  };
}

function approvalCurrent(campaign) {
  return approvalIsCurrent(campaign.approval, approvalInputFor(campaign));
}

export class SocialProductOrchestrator {
  constructor({ registry, governance, executionMode = EXECUTION_MODES.DRY_RUN, clock = () => new Date() }) {
    assert(registry, "PLATFORM_REGISTRY_REQUIRED", "A platform registry is required.");
    assert(
      Object.values(EXECUTION_MODES).includes(executionMode),
      "EXECUTION_MODE_INVALID",
      `Unsupported execution mode: ${executionMode}.`
    );
    this.registry = registry;
    this.governance = structuredClone(governance ?? {});
    this.executionMode = executionMode;
    this.clock = clock;
  }

  async buildCampaign({
    product,
    platforms = this.registry.list(),
    shareAndSaveUrl = null,
    revision = 1
  }) {
    const now = this.clock();
    const content = buildCampaignContent({ product, platforms, shareAndSaveUrl });
    const platformEntries = await Promise.all(
      platforms.map(async (platform) => {
        const capability = await this.registry.get(platform).getCapabilities();
        const blocked = [ADAPTER_MODES.BLOCKED, ADAPTER_MODES.DISABLED].includes(capability.mode);
        return [
          platform,
          {
            ...stateEntity(blocked ? "BLOCKED" : "DRAFT", now, blocked ? capability.reason : null),
            mode: capability.mode,
            capability,
            idempotencyKey: createIdempotencyKey([
              product.identity.productId,
              product.productVersion,
              revision,
              platform
            ]),
            providerPostId: null,
            canonicalUrl: null,
            publicationAttempt: 0,
            metricSchedule: []
          }
        ];
      })
    );

    return {
      schemaVersion: SCHEMA_VERSION,
      campaignId: `nnd-${product.identity.slug}-v${product.productVersion}-r${revision}`,
      revision,
      executionMode: this.executionMode,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      product: structuredClone(product),
      ...stateEntity("DRAFT", now),
      content,
      media: {
        master: {
          profile: "SOCIAL_MASTER",
          fileName: `NumberNinja-${product.identity.slug}-v${product.productVersion}-Social-15s.mp4`,
          filePath: null,
          sha256: null,
          technicalValidation: null,
          humanVisualApproval: null,
          renderPlan: buildSocialMasterPlan(product)
        },
        variants: platforms.includes("etsy")
          ? {
              etsy: {
                profile: "ETSY_SILENT",
                fileName: `NumberNinja-${product.identity.slug}-v${product.productVersion}-Etsy-Silent.mp4`,
                filePath: null,
                sha256: null,
                technicalValidation: null
              }
            }
          : {},
        safeZone: { x1: 120, y1: 288, x2: 840, y2: 1130 }
      },
      approval: null,
      platforms: Object.fromEntries(platformEntries),
      audit: [{
        at: now.toISOString(),
        event: "CAMPAIGN_CREATED",
        actor: "system",
        fingerprint: sha256(stableStringify({
          productId: product.identity.productId,
          productVersion: product.productVersion,
          revision,
          platforms: [...platforms].sort()
        }))
      }]
    };
  }

  markRendered(campaign, {
    filePath,
    fileSha256,
    technicalValidation,
    humanVisualApproval = null
  }) {
    assert(campaign.state === "DRAFT", "CAMPAIGN_NOT_DRAFT", "Only a draft campaign can record a new render.");
    assert(filePath, "MASTER_VIDEO_PATH_MISSING", "Rendered master path is required.");
    assert(/^[A-F0-9]{64}$/.test(fileSha256), "MASTER_VIDEO_HASH_INVALID", "Rendered master SHA-256 is invalid.");
    assert(technicalValidation?.valid === true, "MASTER_VIDEO_INVALID", "The social master failed technical validation.");

    const now = this.clock();
    let next = transitionState(campaign, "RENDERING", { now, reason: "Validated render received." });
    next = transitionState(next, "RENDERED", { now, reason: "Technical profile passed." });
    next = transitionState(next, "AWAITING_APPROVAL", { now, reason: "Render is ready for human review." });
    next.media.master = {
      ...next.media.master,
      filePath,
      sha256: fileSha256,
      technicalValidation: structuredClone(technicalValidation),
      humanVisualApproval: structuredClone(humanVisualApproval)
    };

    for (const platform of selectedPlatformNames(next)) {
      const state = next.platforms[platform];
      if (state.state !== "BLOCKED") {
        let transitioned = transitionState(state, "RENDERING", { now });
        transitioned = transitionState(transitioned, "RENDERED", { now });
        next.platforms[platform] = transitionState(transitioned, "AWAITING_APPROVAL", { now });
      }
    }
    next.updatedAt = now.toISOString();
    return next;
  }

  markVariantRendered(campaign, platform, {
    filePath,
    fileSha256,
    technicalValidation
  }) {
    assert(
      ["DRAFT", "RENDERING", "RENDERED", "AWAITING_APPROVAL"].includes(campaign.state),
      "CAMPAIGN_VARIANT_IMMUTABLE",
      "Video variants cannot change after campaign approval."
    );
    const existing = campaign.media.variants?.[platform];
    assert(existing, "VIDEO_VARIANT_UNKNOWN", `No video variant is declared for ${platform}.`);
    assert(filePath, "VIDEO_VARIANT_PATH_MISSING", "Rendered variant path is required.");
    assert(/^[A-F0-9]{64}$/.test(fileSha256), "VIDEO_VARIANT_HASH_INVALID", "Rendered variant SHA-256 is invalid.");
    assert(technicalValidation?.valid === true, "VIDEO_VARIANT_INVALID", `${platform} video variant failed validation.`);
    assert(
      technicalValidation.profile === existing.profile,
      "VIDEO_VARIANT_PROFILE_MISMATCH",
      `Expected ${existing.profile}, received ${technicalValidation.profile}.`
    );

    const next = structuredClone(campaign);
    next.media.variants[platform] = {
      ...existing,
      filePath,
      sha256: fileSha256,
      technicalValidation: structuredClone(technicalValidation)
    };
    next.approval = null;
    next.updatedAt = this.clock().toISOString();
    return next;
  }

  approveCampaign(campaign, approvedBy, approvedAt = this.clock()) {
    assert(
      campaign.state === "AWAITING_APPROVAL",
      "CAMPAIGN_NOT_AWAITING_APPROVAL",
      "Campaign must be awaiting approval."
    );
    assert(
      campaign.media.master.technicalValidation?.valid === true,
      "TECHNICAL_APPROVAL_MISSING",
      "Technical video validation must pass before approval."
    );
    assert(
      campaign.media.master.humanVisualApproval?.approved === true,
      "VISUAL_APPROVAL_MISSING",
      "The binding 100% human visual inspection must pass before approval."
    );

    const now = approvedAt;
    const next = transitionState(campaign, "APPROVED", {
      now,
      actor: approvedBy,
      reason: "Campaign fingerprint approved."
    });
    next.approval = createApproval(approvalInputFor(next), approvedBy, now);

    for (const platform of selectedPlatformNames(next)) {
      if (next.platforms[platform].state === "AWAITING_APPROVAL") {
        next.platforms[platform] = transitionState(next.platforms[platform], "APPROVED", {
          now,
          actor: approvedBy
        });
      }
    }
    return next;
  }

  applyApprovalDecision(campaign, decision) {
    assert(
      decision?.campaignId === campaign.campaignId &&
        decision?.revision === campaign.revision,
      "APPROVAL_DECISION_REVISION_MISMATCH",
      "Approval decision belongs to a different campaign revision."
    );
    assert(
      decision.decision === "APPROVE" && decision.visualApproved === true,
      "APPROVAL_DECISION_INVALID",
      "Approval decision must explicitly approve the 100% visual inspection."
    );
    const approvalMethod = decision.method ?? "LOCAL_APPROVAL_CONSOLE";
    assert(
      APPROVAL_METHODS.includes(approvalMethod),
      "APPROVAL_METHOD_INVALID",
      `Unsupported approval method: ${approvalMethod}.`
    );
    const decidedAt = new Date(decision.decidedAt);
    assert(
      !Number.isNaN(decidedAt.getTime()),
      "APPROVAL_DECISION_TIME_INVALID",
      "Approval decision requires a valid decision time."
    );
    const expectedFingerprint = sha256(stableStringify(approvalInputFor(campaign)));
    assert(
      decision.fingerprint === expectedFingerprint,
      "APPROVAL_DECISION_STALE",
      "Approval decision fingerprint does not match current campaign content."
    );
    const next = structuredClone(campaign);
    next.media.master.humanVisualApproval = {
      approved: true,
      approvedBy: decision.approvedBy,
      approvedAt: decidedAt.toISOString(),
      method: approvalMethod,
      statementSha256: decision.statementSha256 ?? null
    };
    return this.approveCampaign(next, decision.approvedBy, decidedAt);
  }

  queueApprovedCampaign(campaign) {
    assert(campaign.state === "APPROVED", "CAMPAIGN_NOT_APPROVED", "Campaign must be approved before queueing.");
    assert(approvalCurrent(campaign), "APPROVAL_STALE", "Campaign content changed after approval.");
    const now = this.clock();
    const shareAndSaveUrl = campaign.content.canonical.shareAndSaveUrl;
    const next = structuredClone(campaign);
    let automaticCount = 0;
    let assistedCount = 0;
    let missingLinkCount = 0;

    for (const platform of selectedPlatformNames(next)) {
      const platformState = next.platforms[platform];
      if (platformState.state !== "APPROVED") {
        continue;
      }
      if (platformState.capability.requiresShareAndSaveUrl && !shareAndSaveUrl) {
        next.platforms[platform] = transitionState(platformState, "NEEDS_LINK", {
          now,
          reason: "Verified Etsy Share & Save URL is missing."
        });
        missingLinkCount += 1;
      } else if (platformState.mode === ADAPTER_MODES.AUTOMATIC) {
        next.platforms[platform] = transitionState(platformState, "QUEUED", { now });
        automaticCount += 1;
      } else {
        next.platforms[platform] = transitionState(platformState, "ASSISTED_READY", {
          now,
          reason: platformState.capability.reason
        });
        assistedCount += 1;
      }
    }

    const target =
      automaticCount > 0
        ? "QUEUED"
        : assistedCount > 0
          ? "ASSISTED_READY"
          : missingLinkCount > 0
            ? "NEEDS_LINK"
            : "BLOCKED";
    const transitioned = transitionState(next, target, {
      now,
      reason: `automatic=${automaticCount}; assisted=${assistedCount}; needsLink=${missingLinkCount}`
    });
    transitioned.platformSummary = { automaticCount, assistedCount, missingLinkCount };
    return transitioned;
  }

  async prepareAssistedHandoffs(campaign) {
    assert(approvalCurrent(campaign), "APPROVAL_STALE", "Assisted handoff requires a current approval.");
    const handoffs = {};
    for (const platform of selectedPlatformNames(campaign)) {
      const platformState = campaign.platforms[platform];
      if (platformState.state !== "ASSISTED_READY") {
        continue;
      }
      const adapter = this.registry.get(platform);
      const validation = await adapter.validate({
        content: campaign.content,
        media: campaign.media
      });
      if (!validation.valid) {
        handoffs[platform] = { status: "BLOCKED", validation };
        continue;
      }
      handoffs[platform] = await adapter.prepare({
        content: campaign.content,
        media: campaign.media
      });
    }
    return handoffs;
  }

  recordAssistedPublication(campaign, platform, {
    providerPostId,
    canonicalUrl = null,
    publishedAt,
    recordedBy,
    evidenceReference
  }) {
    assert(approvalCurrent(campaign), "APPROVAL_STALE", "Manual publication evidence requires a current approval.");
    const platformState = campaign.platforms[platform];
    assert(platformState?.state === "ASSISTED_READY", "PLATFORM_NOT_ASSISTED_READY", `${platform} is not assisted-ready.`);
    assert(
      typeof providerPostId === "string" && providerPostId.trim(),
      "PROVIDER_POST_ID_MISSING",
      "The provider post ID is required."
    );
    assert(
      typeof recordedBy === "string" && recordedBy.trim().length >= 2,
      "PUBLICATION_RECORDER_INVALID",
      "An identifiable recorder is required."
    );
    assert(
      typeof evidenceReference === "string" && evidenceReference.trim().length >= 3,
      "PUBLICATION_EVIDENCE_MISSING",
      "A local evidence reference is required."
    );
    const published = new Date(publishedAt);
    assert(!Number.isNaN(published.getTime()), "PUBLISHED_AT_INVALID", "A valid publication time is required.");
    assert(
      canonicalUrl === null || isSafeHttpsUrl(canonicalUrl),
      "CANONICAL_URL_INVALID",
      "Canonical post URL must be HTTPS."
    );

    const next = structuredClone(campaign);
    const target = canonicalUrl ? "PUBLISHED" : "NEEDS_LINK";
    let recorded = transitionState(platformState, target, {
      now: published,
      actor: recordedBy.trim(),
      reason: canonicalUrl
        ? "Assisted publication recorded."
        : "Assisted publication recorded; canonical post link still required."
    });
    recorded.providerPostId = providerPostId.trim();
    recorded.canonicalUrl = canonicalUrl;
    recorded.publishedAt = published.toISOString();
    recorded.metricSchedule = platformState.capability.supportsMetrics
      ? createMetricSchedule(published)
      : [];
    recorded.manualEvidence = {
      recordedBy: recordedBy.trim(),
      evidenceReference: evidenceReference.trim(),
      method: "OFFICIAL_PLATFORM_UI"
    };
    next.platforms[platform] = recorded;
    next.updatedAt = this.clock().toISOString();
    return next;
  }

  recordPublishedLink(campaign, platform, canonicalUrl, recordedBy) {
    const platformState = campaign.platforms[platform];
    assert(
      platformState?.state === "NEEDS_LINK" && platformState.providerPostId,
      "PUBLISHED_LINK_NOT_EXPECTED",
      `${platform} has no published post awaiting a canonical link.`
    );
    assert(isSafeHttpsUrl(canonicalUrl), "CANONICAL_URL_INVALID", "Canonical post URL must be HTTPS.");
    const next = structuredClone(campaign);
    const published = transitionState(platformState, "PUBLISHED", {
      now: this.clock(),
      actor: recordedBy,
      reason: "Canonical provider post link recorded."
    });
    published.canonicalUrl = canonicalUrl;
    next.platforms[platform] = published;
    next.updatedAt = published.updatedAt;
    return next;
  }

  recordMetricCheckpoint(campaign, platform, checkpoint, rawMetrics, {
    source = "MANUAL_OFFICIAL_ANALYTICS",
    recordedBy = "operator"
  } = {}) {
    assert(["24H", "7D"].includes(checkpoint), "METRIC_CHECKPOINT_INVALID", "Checkpoint must be 24H or 7D.");
    const platformState = campaign.platforms[platform];
    assert(
      ["PUBLISHED", "METRICS_PENDING"].includes(platformState?.state),
      "PLATFORM_NOT_METRICS_READY",
      `${platform} is not ready for metric collection.`
    );
    const schedule = platformState.metricSchedule.find((item) => item.checkpoint === checkpoint);
    assert(schedule, "METRIC_CHECKPOINT_NOT_SCHEDULED", `${checkpoint} is not scheduled for ${platform}.`);
    const now = this.clock();
    assert(now.getTime() >= Date.parse(schedule.dueAt), "METRIC_CHECKPOINT_NOT_DUE", `${checkpoint} is not due yet.`);

    const next = structuredClone(campaign);
    let pending = platformState.state === "PUBLISHED"
      ? transitionState(platformState, "METRICS_PENDING", { now })
      : structuredClone(platformState);
    const normalized = normalizeMetrics(platform, rawMetrics, now);
    normalized.source = source;
    normalized.recordedBy = recordedBy;
    normalized.checkpoint = checkpoint;
    pending.metricObservations = Array.isArray(pending.metricObservations)
      ? pending.metricObservations.filter((observation) => observation.checkpoint !== checkpoint)
      : [];
    pending.metricObservations.push(normalized);

    const complete = ["24H", "7D"].every((required) =>
      pending.metricObservations.some((observation) => observation.checkpoint === required)
    );
    if (complete) {
      pending = transitionState(pending, "COMPLETE", {
        now,
        reason: "24-hour and 7-day metric checkpoints recorded."
      });
    } else {
      pending.updatedAt = now.toISOString();
      pending.history.push({
        from: "METRICS_PENDING",
        to: "METRICS_PENDING",
        at: now.toISOString(),
        reason: `${checkpoint} metric checkpoint recorded.`,
        actor: recordedBy
      });
    }
    next.platforms[platform] = pending;
    next.updatedAt = now.toISOString();
    return next;
  }

  updateShareAndSaveUrl(campaign, shareAndSaveUrl) {
    assert(
      !["PUBLISHING", "PUBLISHED", "METRICS_PENDING"].includes(campaign.state),
      "CAMPAIGN_IMMUTABLE_DURING_PUBLICATION",
      "Create a new campaign revision after publication starts."
    );
    const now = this.clock();
    const next = structuredClone(campaign);
    next.revision += 1;
    next.campaignId = `nnd-${next.product.identity.slug}-v${next.product.productVersion}-r${next.revision}`;
    next.content = buildCampaignContent({
      product: next.product,
      platforms: selectedPlatformNames(next),
      shareAndSaveUrl
    });
    next.approval = null;
    const target = next.media.master.technicalValidation?.valid ? "AWAITING_APPROVAL" : "DRAFT";
    next.history.push({
      from: next.state,
      to: target,
      at: now.toISOString(),
      reason: "Share & Save URL changed; prior approval invalidated.",
      actor: "system"
    });
    next.state = target;
    next.updatedAt = now.toISOString();

    for (const platform of selectedPlatformNames(next)) {
      const platformState = next.platforms[platform];
      if (platformState.mode === ADAPTER_MODES.BLOCKED || platformState.mode === ADAPTER_MODES.DISABLED) {
        continue;
      }
      platformState.history.push({
        from: platformState.state,
        to: target,
        at: now.toISOString(),
        reason: "Campaign revision changed; prior approval invalidated.",
        actor: "system"
      });
      platformState.state = target;
      platformState.updatedAt = now.toISOString();
      platformState.idempotencyKey = createIdempotencyKey([
        next.product.identity.productId,
        next.product.productVersion,
        next.revision,
        platform
      ]);
    }
    return next;
  }

  assertLiveExecutionAllowed() {
    assert(this.executionMode === EXECUTION_MODES.LIVE, "DRY_RUN_ACTIVE", "Live publication is disabled in DRY_RUN.");
    assert(
      this.governance.executionPlaneEnabled === true &&
        this.governance.providerCallsAllowed === true,
      "EXECUTION_GOVERNANCE_BLOCKED",
      "Studio OS execution plane and provider calls must both be explicitly enabled."
    );
  }

  async publishPlatform(campaign, platform) {
    this.assertLiveExecutionAllowed();
    assert(approvalCurrent(campaign), "APPROVAL_STALE", "Publication requires a current approval.");
    const platformState = campaign.platforms[platform];
    assert(platformState?.state === "QUEUED", "PLATFORM_NOT_QUEUED", `${platform} is not queued.`);
    assert(platformState.mode === ADAPTER_MODES.AUTOMATIC, "PLATFORM_NOT_AUTOMATIC", `${platform} is not automatic.`);

    const adapter = this.registry.get(platform);
    const context = {
      campaignId: campaign.campaignId,
      idempotencyKey: platformState.idempotencyKey,
      content: campaign.content,
      media: campaign.media,
      attempt: platformState.publicationAttempt + 1
    };
    const validation = await adapter.validate(context);
    assert(validation.valid, "PLATFORM_VALIDATION_FAILED", `${platform} validation failed.`, validation);
    const prepared = await adapter.prepare(context);
    const now = this.clock();
    let next = structuredClone(campaign);
    next.platforms[platform] = transitionState(platformState, "PUBLISHING", { now });
    next.platforms[platform].publicationAttempt += 1;

    try {
      const result = await adapter.publish({ ...context, prepared });
      assert(result?.providerPostId, "PROVIDER_POST_ID_MISSING", "Provider response has no post ID.");
      const publishedAt = result.publishedAt ?? this.clock().toISOString();
      let published = transitionState(next.platforms[platform], "PUBLISHED", {
        now: new Date(publishedAt)
      });
      published.providerPostId = result.providerPostId;
      published.canonicalUrl = result.canonicalUrl ?? null;
      published.metricSchedule = createMetricSchedule(publishedAt);
      next.platforms[platform] = published;
      return next;
    } catch (error) {
      const failure = classifyPublicationFailure(error, {
        attempt: next.platforms[platform].publicationAttempt,
        now: this.clock()
      });
      if (failure.requiresReconcile) {
        const reconciliation = await adapter.reconcile(context);
        if (reconciliation?.outcome === "PUBLISHED" && reconciliation.providerPostId) {
          let published = transitionState(next.platforms[platform], "PUBLISHED", {
            now: this.clock(),
            reason: "Ambiguous write reconciled as published."
          });
          published.providerPostId = reconciliation.providerPostId;
          published.canonicalUrl = reconciliation.canonicalUrl ?? null;
          published.metricSchedule = createMetricSchedule(published.updatedAt);
          next.platforms[platform] = published;
          return next;
        }
      }
      next.platforms[platform] = transitionState(next.platforms[platform], failure.state, {
        now: this.clock(),
        reason: failure.reason
      });
      next.platforms[platform].failure = failure;
      return next;
    }
  }
}
