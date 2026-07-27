export const NND_VISUAL_QUALITY_STANDARD = 'NND-VISUAL-QUALITY-2026.1';

export const REQUIRED_HUMAN_VISUAL_CHECKS = Object.freeze([
  'premium-campaign-quality',
  'product-truth',
  'source-fidelity',
  'artifact-freedom',
  'mobile-readability',
  'digital-product-coverage',
  'etsy-export-conformity',
]);

function issue(code, message) {
  return Object.freeze({ code, message });
}

function isIsoTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
    && Number.isFinite(Date.parse(value));
}

function expectedAssets(imageManifest) {
  return Array.isArray(imageManifest?.assets)
    ? imageManifest.assets.map(asset => ({ id: asset.id, sha256: asset.sha256 }))
    : [];
}

export function evaluateHumanVisualApproval(approval, imageManifest) {
  const assets = expectedAssets(imageManifest);
  if (approval === null || approval === undefined) {
    return Object.freeze({
      status: 'MISSING',
      approved: false,
      standard: NND_VISUAL_QUALITY_STANDARD,
      reviewerId: null,
      decidedAt: null,
      checkedAssets: 0,
      requiredAssets: assets.length,
      issues: Object.freeze([
        issue('HUMAN_APPROVAL_MISSING', 'A documented human visual inspection is required before publication.'),
      ]),
    });
  }

  const issues = [];
  if (typeof approval !== 'object' || Array.isArray(approval)) {
    issues.push(issue('HUMAN_APPROVAL_INVALID', 'Human visual approval must be an object.'));
  }
  const record = typeof approval === 'object' && approval !== null && !Array.isArray(approval) ? approval : {};
  if (record.standard !== NND_VISUAL_QUALITY_STANDARD) {
    issues.push(issue('VISUAL_STANDARD_MISMATCH', `Approval must use ${NND_VISUAL_QUALITY_STANDARD}.`));
  }
  if (record.reviewerType !== 'HUMAN') {
    issues.push(issue('HUMAN_REVIEWER_REQUIRED', 'Automated or inferred approval is not accepted.'));
  }
  if (typeof record.reviewerId !== 'string' || record.reviewerId.trim().length < 3) {
    issues.push(issue('REVIEWER_ID_MISSING', 'A stable human reviewer identifier is required.'));
  }
  if (record.decision !== 'APPROVED') {
    issues.push(issue('APPROVAL_DECISION_MISSING', 'The human reviewer must explicitly approve the exact asset set.'));
  }
  if (!isIsoTimestamp(record.decidedAt)) {
    issues.push(issue('APPROVAL_TIMESTAMP_INVALID', 'The approval timestamp must be a valid UTC ISO-8601 value.'));
  }

  const checks = Array.isArray(record.checks) ? record.checks : [];
  const checksById = new Map();
  for (const check of checks) {
    if (!check || typeof check !== 'object' || typeof check.id !== 'string') continue;
    if (checksById.has(check.id)) {
      issues.push(issue('DUPLICATE_VISUAL_CHECK', `Visual check '${check.id}' is recorded more than once.`));
      continue;
    }
    checksById.set(check.id, check);
  }
  for (const checkId of REQUIRED_HUMAN_VISUAL_CHECKS) {
    const check = checksById.get(checkId);
    if (!check || check.status !== 'PASS' || typeof check.notes !== 'string' || !check.notes.trim()) {
      issues.push(issue('VISUAL_CHECK_INCOMPLETE', `Visual check '${checkId}' requires PASS plus reviewer notes.`));
    }
  }

  const approvedAssets = Array.isArray(record.assets) ? record.assets : [];
  const approvedById = new Map();
  for (const asset of approvedAssets) {
    if (!asset || typeof asset !== 'object' || typeof asset.id !== 'string') continue;
    if (approvedById.has(asset.id)) {
      issues.push(issue('DUPLICATE_APPROVED_ASSET', `Asset '${asset.id}' is approved more than once.`));
      continue;
    }
    approvedById.set(asset.id, asset.sha256);
  }
  if (!assets.length) {
    issues.push(issue('VISUAL_ASSET_SET_MISSING', 'The image manifest contains no assets to approve.'));
  }
  if (approvedAssets.length !== assets.length) {
    issues.push(issue('VISUAL_ASSET_COUNT_MISMATCH', `Approval covers ${approvedAssets.length} of ${assets.length} assets.`));
  }
  for (const asset of assets) {
    if (typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(asset.sha256)) {
      issues.push(issue('SOURCE_ASSET_HASH_MISSING', `Image '${asset.id}' has no valid SHA-256 source evidence.`));
    } else if (approvedById.get(asset.id) !== asset.sha256) {
      issues.push(issue('APPROVED_ASSET_HASH_MISMATCH', `Approval does not match the current bytes for '${asset.id}'.`));
    }
  }

  const status = issues.length ? 'FAIL' : 'PASS';
  return Object.freeze({
    status,
    approved: status === 'PASS',
    standard: NND_VISUAL_QUALITY_STANDARD,
    reviewerId: typeof record.reviewerId === 'string' ? record.reviewerId.trim() : null,
    decidedAt: isIsoTimestamp(record.decidedAt) ? record.decidedAt : null,
    checkedAssets: approvedAssets.length,
    requiredAssets: assets.length,
    issues: Object.freeze(issues),
  });
}
