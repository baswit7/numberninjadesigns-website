import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NND_VISUAL_QUALITY_STANDARD,
  REQUIRED_HUMAN_VISUAL_CHECKS,
  evaluateHumanVisualApproval,
} from '../src/quality/human-visual-approval.mjs';

const assets = [
  { id: 'hero', sha256: 'a'.repeat(64) },
  { id: 'dashboard', sha256: 'b'.repeat(64) },
];
const imageManifest = { assets };

function approval(overrides = {}) {
  return {
    standard: NND_VISUAL_QUALITY_STANDARD,
    reviewerType: 'HUMAN',
    reviewerId: 'reviewer-001',
    decision: 'APPROVED',
    decidedAt: '2026-07-24T12:00:00.000Z',
    checks: REQUIRED_HUMAN_VISUAL_CHECKS.map(id => ({
      id,
      status: 'PASS',
      notes: `Reviewed ${id} at 100% zoom.`,
    })),
    assets: assets.map(asset => ({ ...asset })),
    ...overrides,
  };
}

test('keeps publication blocked when human approval is missing', () => {
  const result = evaluateHumanVisualApproval(null, imageManifest);
  assert.equal(result.status, 'MISSING');
  assert.equal(result.approved, false);
  assert.match(result.issues[0].message, /human visual inspection/i);
});

test('rejects automated, incomplete, or unbound approval records', () => {
  const result = evaluateHumanVisualApproval(approval({
    reviewerType: 'AUTOMATION',
    checks: [],
    assets: [{ id: 'hero', sha256: 'c'.repeat(64) }],
  }), imageManifest);
  assert.equal(result.status, 'FAIL');
  assert.equal(result.approved, false);
  assert.ok(result.issues.some(item => item.code === 'HUMAN_REVIEWER_REQUIRED'));
  assert.ok(result.issues.some(item => item.code === 'VISUAL_CHECK_INCOMPLETE'));
  assert.ok(result.issues.some(item => item.code === 'APPROVED_ASSET_HASH_MISMATCH'));
});

test('accepts only a complete human review bound to the current image hashes', () => {
  const result = evaluateHumanVisualApproval(approval(), imageManifest);
  assert.equal(result.status, 'PASS');
  assert.equal(result.approved, true);
  assert.equal(result.checkedAssets, assets.length);
  assert.deepEqual(result.issues, []);
});

test('invalidates approval after any image byte hash changes', () => {
  const changedManifest = { assets: [{ ...assets[0], sha256: 'c'.repeat(64) }, assets[1]] };
  const result = evaluateHumanVisualApproval(approval(), changedManifest);
  assert.equal(result.status, 'FAIL');
  assert.ok(result.issues.some(item => item.code === 'APPROVED_ASSET_HASH_MISMATCH'));
});
