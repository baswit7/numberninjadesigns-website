import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CHANNELS, CONTEXTS, buildContentDraft } from '../src/content-studio.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(resolve(root, path), 'utf8');

test('the central shell exposes all separate work areas', async () => {
  const html = await read('index.html');
  const tabs = ['studio', 'products', 'content', 'market', 'listings', 'media', 'channels', 'api'];
  for (const tab of tabs) {
    assert.match(html, new RegExp(`id="tab-${tab}"`));
    assert.match(html, new RegExp(`id="panel-${tab}"`));
    assert.match(html, new RegExp(`aria-controls="panel-${tab}"`));
  }
  assert.match(html, /data-product-type="digital"/);
  assert.match(html, /data-product-type="physical"/);
  for (const channel of Object.keys(CHANNELS)) assert.match(html, new RegExp(`data-channel="${channel}"`));

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'Every DOM id must be unique.');
  for (const [, target] of html.matchAll(/\saria-controls="([^"]+)"/g)) {
    assert.ok(ids.includes(target), `aria-controls points to missing id: ${target}`);
  }
});

test('all consolidated contexts are available without a legacy storefront identity', () => {
  for (const id of [
    'numberninjadesigns',
    'finance-product-factory',
    'physical-products',
    'tok-hub',
    'boodschappenvergelijker',
    'ai-daytraden',
    'niveau-verhogen-paul',
    'leersystemen-verkoop',
  ]) assert.ok(CONTEXTS[id], `Missing context: ${id}`);

  const activeNames = Object.values(CONTEXTS).map(item => item.name).join(' ');
  assert.doesNotMatch(activeNames, /NumberNinjaTees/i);
});

test('content drafts are deterministic, channel-specific and guarded', () => {
  const input = {
    contextId: 'finance-product-factory',
    channelId: 'facebook',
    objectiveId: 'education',
    topic: 'een helder maandbudget',
    locale: 'nl-NL',
    generatedAt: '2026-07-27T10:00:00.000Z',
  };
  assert.deepEqual(buildContentDraft(input), buildContentDraft(input));
  const draft = buildContentDraft(input);
  assert.equal(draft.context.type, 'digital');
  assert.match(draft.guardrail, /Geen financieel advies/i);
  assert.ok(draft.content.bericht.length > 40);
});

test('X output respects its 280-character contract', () => {
  const draft = buildContentDraft({
    contextId: 'numberninjadesigns',
    channelId: 'x',
    objectiveId: 'launch',
    topic: 'een bijzonder uitgebreid onderwerp met veel details voor een nieuwe campagne en meerdere praktische voordelen',
    generatedAt: '2026-07-27T10:00:00.000Z',
  });
  assert.ok(draft.content.bericht.length <= 280);
  assert.equal(draft.content.tekens, draft.content.bericht.length);
});

test('English output does not reuse Dutch audience copy', () => {
  for (const channelId of Object.keys(CHANNELS)) {
    const draft = buildContentDraft({
      contextId: 'physical-products',
      channelId,
      objectiveId: 'launch',
      topic: 'a multiplication poster for a child’s room',
      locale: 'en-US',
      generatedAt: '2026-07-27T10:00:00.000Z',
    });
    const output = JSON.stringify(draft);
    assert.doesNotMatch(output, /kopers die|tastbare uitvoering|praktische aanpak|gebruikssituatie|ondertiteling aan/i);
    assert.match(output, /Physical products/);
    assert.match(draft.guardrail, /Only mention confirmed materials/i);
  }
});

test('physical and digital products retain different publication guardrails', () => {
  const base = {
    channelId: 'instagram',
    objectiveId: 'conversion',
    topic: 'productlancering',
    generatedAt: '2026-07-27T10:00:00.000Z',
  };
  const physical = buildContentDraft({ ...base, contextId: 'physical-products' });
  const digital = buildContentDraft({ ...base, contextId: 'finance-product-factory' });
  assert.notEqual(physical.context.type, digital.context.type);
  assert.match(physical.guardrail, /materialen, maten, levertijden/i);
  assert.match(digital.guardrail, /financieel advies/i);
});

test('shell uses local assets and valid internal entrypoints', async () => {
  const html = await read('index.html');
  assert.match(html, /<script defer src="\.\/src\/content-studio\.js"><\/script>\s*<script defer src="\.\/app\.js"><\/script>/);
  assert.doesNotMatch(html, /type="module"/);
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//i);
  assert.doesNotMatch(html, /\son[a-z]+=/i);
  assert.doesNotMatch(await read('app.js'), /\.innerHTML\s*=/);
  await Promise.all([
    access(resolve(root, 'apps/product-factory/index.html')),
    access(resolve(root, 'modules/etsy-intelligence-engine/index.html')),
    access(resolve(root, 'modules/listing-intelligence-engine/dashboard/index.html')),
    access(resolve(root, '../../../studio/apps/api-registry-manager/index.html')),
  ]);
});
