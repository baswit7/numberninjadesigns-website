import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEtsyDominanceProfile } from '../src/commercial/etsy-dominance-engine.mjs';
import { buildEtsyRaceControlBundle, buildEtsyRaceControlPlan, evaluateRaceControlExperiment } from '../src/commercial/etsy-race-control-engine.mjs';

const definition = { id: 'budget-planner-ultimate' };

function profile(locale = 'en-US', currency = 'USD') {
  return buildEtsyDominanceProfile({ definition, configuration: { locale, currency, filename: `ultimate-${locale}.xlsx` }, generatedAt: '2026-07-23T12:00:00.000Z' });
}

function record(variant, overrides = {}) {
  return {
    variant, days: 14, listingViews: 600, orders: variant === 'A' ? 18 : 21, revenue: variant === 'A' ? 522 : 714,
    favorites: variant === 'A' ? 52 : 61, supportContacts: 1, resolutionCases: 0, firstMessages: 10, withinSla: 10,
    ...overrides,
  };
}

test('builds a policy-safe four-experiment learning queue', () => {
  for (const [locale, currency] of [['en-US', 'USD'], ['nl-NL', 'EUR']]) {
    const plan = buildEtsyRaceControlPlan({ profile: profile(locale, currency), locale, currency, generatedAt: '2026-07-23T12:00:00.000Z' });
    assert.equal(plan.status, 'READY');
    assert.equal(plan.experiments.length, 4);
    assert.equal(plan.experiments.filter(item => item.status === 'READY').length, 1);
    assert.equal(plan.gate.runMode, 'SEQUENTIAL_MATCHED_WINDOWS_ONE_VARIABLE_ONLY');
    assert.equal(plan.exampleEvidence.records.length, 2);
    assert.equal(plan.exampleEvidence.records.every(item => item.example === true), true);
    assert.deepEqual(
      { status: evaluateRaceControlExperiment(plan.exampleEvidence.records, plan.gate).status, winner: evaluateRaceControlExperiment(plan.exampleEvidence.records, plan.gate).winner },
      { status: 'PROMOTE', winner: 'B' },
    );
    assert.equal(plan.privacy.customerDataAllowed, false);
    assert.ok(plan.reviewGuardrails.every(item => !/reward.*review|paid review/i.test(item)));
    assert.ok(plan.policySources.every(source => source.url.startsWith('https://')));
  }
});

test('promotes only a material winner that clears support guardrails', () => {
  const collecting = evaluateRaceControlExperiment([record('A', { listingViews: 200 }), record('B', { listingViews: 200 })]);
  assert.equal(collecting.status, 'COLLECTING');

  const winner = evaluateRaceControlExperiment([record('A'), record('B')]);
  assert.equal(winner.status, 'PROMOTE');
  assert.equal(winner.winner, 'B');

  const unsafe = evaluateRaceControlExperiment([record('A'), record('B', { supportContacts: 10 })]);
  assert.equal(unsafe.status, 'NO_CLEAR_WINNER');
  assert.equal(unsafe.winner, null);
});

test('ships a complete offline Race Control seller bundle', () => {
  const bundle = buildEtsyRaceControlBundle({ profile: profile(), generatedAt: '2026-07-23T12:00:00.000Z' });
  assert.deepEqual([...bundle.files.keys()], [
    'seller/race-control/race-control-plan.json',
    'seller/race-control/race-control-dashboard.html',
    'seller/race-control/experiment-backlog.csv',
    'seller/race-control/weekly-scorecard.csv',
    'seller/race-control/operating-playbook.md',
    'seller/race-control/etsy-quick-replies.txt',
  ]);
  const dashboard = bundle.files.get('seller/race-control/race-control-dashboard.html');
  assert.match(dashboard, /connect-src 'none'/);
  assert.match(dashboard, /localStorage/);
  assert.match(dashboard, /Export evidence/);
  assert.match(dashboard, /id="loadExample"/);
  assert.match(dashboard, /EXAMPLE DATA · do not use as real evidence/);
  assert.match(dashboard, /exampleData:isExample\(\)/);
  assert.doesNotMatch(dashboard, /\b(?:TODO|LOREM|PLACEHOLDER)\b/);
  const script = dashboard.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
  const replies = bundle.files.get('seller/race-control/etsy-quick-replies.txt');
  assert.match(replies, /honest review/i);
  assert.match(replies, /no reward or benefit/i);
});
