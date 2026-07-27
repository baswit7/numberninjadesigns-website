import fs from "node:fs/promises";
import path from "node:path";

import {
  APPROVAL_SCHEMA_VERSION,
  APPROVAL_STANDARD,
  FINANCE_RELEASE_ID,
  REQUIRED_APPROVAL_CHECKS,
  buildApprovalScope,
  calculateArtifactScopeSha256,
} from "./lib/release-approval.mjs";

const argumentsSet = new Set(process.argv.slice(2));
const supportedArguments = new Set([
  "--confirm-owner-go",
  "--authorize-website-preview",
]);
if (
  !argumentsSet.has("--confirm-owner-go") ||
  [...argumentsSet].some(
    (argument) => !supportedArguments.has(argument),
  )
) {
  throw new Error(
    'Explicit owner confirmation required. Use "--confirm-owner-go" and optionally "--authorize-website-preview".',
  );
}
const websitePreviewAuthorized = argumentsSet.has(
  "--authorize-website-preview",
);

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const releaseRoot = path.join(
  repositoryRoot,
  "release-candidates",
  FINANCE_RELEASE_ID,
);
const releaseIds = [
  "budget-planner",
  "debt-payoff-tracker",
  "net-worth-tracker",
];
const manifests = await Promise.all(
  releaseIds.map(async (releaseId) =>
    JSON.parse(
      await fs.readFile(
        path.join(releaseRoot, releaseId, "release-manifest.json"),
        "utf8",
      ),
    ),
  ),
);
const scope = await buildApprovalScope({
  repositoryRoot,
  releaseRoot,
  manifests,
});
const artifactScopeSha256 = calculateArtifactScopeSha256(scope);
const receipt = {
  schemaVersion: APPROVAL_SCHEMA_VERSION,
  releaseId: FINANCE_RELEASE_ID,
  standard: APPROVAL_STANDARD,
  decision: "GO",
  approvedBy: "owner",
  approvalSource: "explicit-user-go",
  recordedAt: new Date().toISOString(),
  artifactScopeSha256,
  checks: REQUIRED_APPROVAL_CHECKS.map(({ id }) => ({
    id,
    status: "approved",
  })),
  publication: {
    authorized: false,
    websitePreview: {
      authorized: websitePreviewAuthorized,
      target: "production-website",
    },
    reason:
      "Commerce publication, customer delivery, providers, APIs, and real market data remain separately gated.",
  },
};

await fs.writeFile(
  path.join(releaseRoot, "owner-approval.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
  "utf8",
);
process.stdout.write(
  `Owner GO recorded for artifact scope ${artifactScopeSha256}.\n`,
);
