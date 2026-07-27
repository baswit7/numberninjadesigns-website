import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const APPROVAL_SCHEMA_VERSION = "1.0.0";
export const APPROVAL_STANDARD = "NND-VISUAL-QUALITY-2026.1";
export const FINANCE_RELEASE_ID = "finance-launch-2026-07-24";

export const REQUIRED_APPROVAL_CHECKS = Object.freeze([
  {
    id: "premium-campaign-quality",
    label: "Premium campaign quality at 100% visual inspection",
  },
  {
    id: "workbook-formula-truth",
    label: "Exact workbook and formula truth",
  },
  {
    id: "visual-integrity",
    label: "No visual artifacts or misleading UI",
  },
  {
    id: "mobile-readability",
    label: "Mobile readability of listing images",
  },
  {
    id: "video-interaction",
    label: "Real video interaction and visible state change",
  },
  {
    id: "listing-copy-and-price",
    label: "Seller approval of listing copy and price",
  },
]);

const WEBSITE_SCOPE = Object.freeze([
  "index.html",
  "budget-planner-basic.html",
  "debt-payoff-tracker.html",
  "net-worth-tracker.html",
  "commerce.js",
  "commerce.css",
  "data/products.js",
]);

async function sha256(filePath) {
  const contents = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(contents).digest("hex");
}

async function fileEvidence(root, relativePath) {
  const filePath = path.join(root, relativePath);
  const stats = await fs.stat(filePath);
  return {
    path: relativePath.replaceAll("\\", "/"),
    bytes: stats.size,
    sha256: await sha256(filePath),
  };
}

function normalizeManifest(manifest) {
  return {
    standard: manifest.standard,
    product: manifest.product,
    customerDelivery: manifest.customerDelivery,
    commerce: manifest.commerce,
    assets: [...manifest.assets]
      .map(({ path: assetPath, bytes, sha256: assetHash }) => ({
        path: assetPath,
        bytes,
        sha256: assetHash,
      }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export async function buildApprovalScope({
  repositoryRoot,
  releaseRoot,
  manifests,
}) {
  const promotionalRoot = path.join(releaseRoot, "promotional-video");
  const promotionalFiles = (await fs.readdir(promotionalRoot))
    .filter((fileName) => fileName.toLowerCase().endsWith(".mp4"))
    .sort();

  return {
    releaseId: FINANCE_RELEASE_ID,
    standard: APPROVAL_STANDARD,
    products: manifests
      .map(normalizeManifest)
      .sort((left, right) =>
        left.product.productId.localeCompare(right.product.productId),
      ),
    promotionalVideos: await Promise.all(
      promotionalFiles.map((fileName) =>
        fileEvidence(
          releaseRoot,
          path.join("promotional-video", fileName),
        ),
      ),
    ),
    website: await Promise.all(
      WEBSITE_SCOPE.map((relativePath) =>
        fileEvidence(repositoryRoot, relativePath),
      ),
    ),
  };
}

export function calculateArtifactScopeSha256(scope) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(scope))
    .digest("hex");
}

export function validateApprovalReceipt(receipt, artifactScopeSha256) {
  const errors = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return { valid: false, errors: ["Approval receipt is missing."] };
  }

  if (receipt.schemaVersion !== APPROVAL_SCHEMA_VERSION) {
    errors.push("Approval schema version is invalid.");
  }
  if (receipt.releaseId !== FINANCE_RELEASE_ID) {
    errors.push("Approval release identity is invalid.");
  }
  if (receipt.standard !== APPROVAL_STANDARD) {
    errors.push("Approval quality standard is invalid.");
  }
  if (receipt.decision !== "GO") {
    errors.push("Approval decision is not GO.");
  }
  if (
    typeof receipt.approvedBy !== "string" ||
    receipt.approvedBy.trim().length === 0
  ) {
    errors.push("Approval owner is missing.");
  }
  if (
    typeof receipt.recordedAt !== "string" ||
    Number.isNaN(Date.parse(receipt.recordedAt))
  ) {
    errors.push("Approval timestamp is invalid.");
  }
  if (receipt.artifactScopeSha256 !== artifactScopeSha256) {
    errors.push("Approval does not match the current artifact set.");
  }

  const approvedChecks = new Map(
    Array.isArray(receipt.checks)
      ? receipt.checks.map((check) => [check.id, check.status])
      : [],
  );
  for (const requiredCheck of REQUIRED_APPROVAL_CHECKS) {
    if (approvedChecks.get(requiredCheck.id) !== "approved") {
      errors.push(`Mandatory approval check missing: ${requiredCheck.id}.`);
    }
  }
  if (receipt.publication?.authorized !== false) {
    errors.push("Commerce publication authorization must remain separate.");
  }
  if (
    typeof receipt.publication?.websitePreview?.authorized !==
    "boolean"
  ) {
    errors.push("Website preview authorization state is missing.");
  }

  return { valid: errors.length === 0, errors };
}
