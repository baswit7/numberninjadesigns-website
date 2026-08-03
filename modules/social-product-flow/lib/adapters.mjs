import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ADAPTER_MODES,
  FlowError,
  SCHEMA_VERSION,
  assert,
  assertNoSecrets
} from "./core.mjs";

const REQUIRED_METHODS = Object.freeze([
  "getCapabilities",
  "validate",
  "prepare",
  "publish",
  "reconcile",
  "fetchMetrics"
]);

export class AssistedAdapter {
  constructor(platform, capability) {
    assert(platform, "PLATFORM_REQUIRED", "Adapter platform is required.");
    assert(capability?.mode, "CAPABILITY_REQUIRED", `Capability is required for ${platform}.`);
    this.platform = platform;
    this.capability = structuredClone(capability);
  }

  async getCapabilities() {
    return {
      schemaVersion: SCHEMA_VERSION,
      platform: this.platform,
      ...structuredClone(this.capability)
    };
  }

  async validate(context) {
    const issues = [];
    const content = context?.content?.platforms?.[this.platform];

    if (!content) {
      issues.push({
        severity: "BLOCKING",
        code: "PLATFORM_CONTENT_MISSING",
        message: `No prepared content exists for ${this.platform}.`
      });
    }

    if (this.capability.requiresShareAndSaveUrl && !context?.content?.canonical?.shareAndSaveUrl) {
      issues.push({
        severity: "BLOCKING",
        code: "SHARE_AND_SAVE_URL_MISSING",
        message: "An Etsy Share & Save URL must be supplied from Etsy; it is never synthesized."
      });
    }

    if (this.capability.mode === ADAPTER_MODES.DISABLED) {
      issues.push({
        severity: "BLOCKING",
        code: "PLATFORM_DISABLED",
        message: this.capability.reason
      });
    }

    if (this.capability.mode === ADAPTER_MODES.BLOCKED) {
      issues.push({
        severity: "BLOCKING",
        code: "PLATFORM_BLOCKED",
        message: this.capability.reason
      });
    }

    return {
      valid: !issues.some((issue) => issue.severity === "BLOCKING"),
      issues
    };
  }

  async prepare(context) {
    assertNoSecrets(context);
    const content = context.content.platforms[this.platform];
    return {
      schemaVersion: SCHEMA_VERSION,
      platform: this.platform,
      status:
        this.capability.mode === ADAPTER_MODES.BLOCKED
          ? "BLOCKED"
          : this.capability.mode === ADAPTER_MODES.DISABLED
            ? "DISABLED"
            : "ASSISTED_READY",
      reason: this.capability.reason,
      publicationPath: this.capability.publicationPath,
      media: structuredClone(context.media),
      metadata: structuredClone(content.metadata),
      cover: structuredClone(content.cover),
      checklist: [
        "Confirm the approved fingerprint is current.",
        "Inspect the final video at 100% and confirm product truth.",
        "Open the official platform publishing surface.",
        "Copy the prepared metadata; keep editable fields editable.",
        "Publish only after platform previews and destination rules pass.",
        "Record the resulting provider post ID and canonical URL."
      ],
      evidence: structuredClone(this.capability.evidence ?? [])
    };
  }

  async publish() {
    throw new FlowError(
      "AUTOMATIC_PUBLISH_UNAVAILABLE",
      `${this.platform} has no proven automatic publication bridge in this repository.`,
      { platform: this.platform, mode: this.capability.mode }
    );
  }

  async reconcile() {
    return {
      platform: this.platform,
      outcome: "UNKNOWN",
      providerPostId: null,
      canonicalUrl: null,
      reason: "No provider reconciliation bridge is configured."
    };
  }

  async fetchMetrics() {
    return {
      platform: this.platform,
      available: false,
      reason: "No provider metrics bridge is configured.",
      metrics: null
    };
  }
}

export class ProviderBridgeAdapter extends AssistedAdapter {
  constructor(platform, capability, bridge) {
    super(platform, capability);
    assert(
      capability.mode === ADAPTER_MODES.AUTOMATIC,
      "BRIDGE_MODE_INVALID",
      "A provider bridge can only be registered for an AUTOMATIC capability."
    );

    const missing = REQUIRED_METHODS.filter((method) => typeof bridge?.[method] !== "function");
    assert(
      missing.length === 0,
      "BRIDGE_CONTRACT_INCOMPLETE",
      `Provider bridge is missing: ${missing.join(", ")}.`,
      { missing }
    );
    this.bridge = bridge;
  }

  async getCapabilities() {
    return this.bridge.getCapabilities();
  }

  async validate(context) {
    return this.bridge.validate(context);
  }

  async prepare(context) {
    return this.bridge.prepare(context);
  }

  async publish(context) {
    return this.bridge.publish(context);
  }

  async reconcile(context) {
    return this.bridge.reconcile(context);
  }

  async fetchMetrics(context) {
    return this.bridge.fetchMetrics(context);
  }
}

export class PlatformRegistry {
  constructor(document) {
    assert(
      document?.schemaVersion === SCHEMA_VERSION,
      "CAPABILITY_SCHEMA_UNSUPPORTED",
      `Unsupported capability schema: ${document?.schemaVersion ?? "missing"}.`
    );
    assert(
      document.platforms && typeof document.platforms === "object",
      "PLATFORM_CAPABILITIES_MISSING",
      "Platform capabilities are required."
    );

    this.document = structuredClone(document);
    this.adapters = new Map(
      Object.entries(document.platforms).map(([platform, capability]) => [
        platform,
        new AssistedAdapter(platform, capability)
      ])
    );
  }

  static async fromFile(filePath) {
    const parsed = JSON.parse(await readFile(resolve(filePath), "utf8"));
    return new PlatformRegistry(parsed);
  }

  list() {
    return [...this.adapters.keys()];
  }

  get(platform) {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new FlowError("PLATFORM_UNKNOWN", `Unknown platform: ${platform}.`);
    }
    return adapter;
  }

  registerAutomatic(platform, capability, bridge) {
    assert(this.adapters.has(platform), "PLATFORM_UNKNOWN", `Unknown platform: ${platform}.`);
    this.adapters.set(
      platform,
      new ProviderBridgeAdapter(platform, { ...capability, mode: ADAPTER_MODES.AUTOMATIC }, bridge)
    );
  }
}
