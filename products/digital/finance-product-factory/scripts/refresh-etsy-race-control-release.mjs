import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import JSZip from 'jszip';

import { buildEtsyRaceControlBundle } from '../src/commercial/etsy-race-control-engine.mjs';
import { sha256Hex } from '../src/engines/security.js';

const root = resolve(import.meta.dirname, '..');

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}

async function write(target, value) {
  await mkdir(resolve(target, '..'), { recursive: true });
  await writeFile(target, value);
}

const outputRoot = resolve(root, option('--output', 'output/etsy-dominance/world-champion-v2'));
const summaryPath = resolve(outputRoot, 'release-summary.json');
const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
if (summary.status !== 'PASS' || summary.results.length !== 2) throw new Error('Race Control refresh requires an existing two-locale PASS release.');

for (const result of summary.results) {
  const localeRoot = resolve(outputRoot, result.scenario);
  const manifestPath = resolve(localeRoot, 'launch-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const strategy = JSON.parse(await readFile(resolve(localeRoot, 'listing', 'offer-strategy.json'), 'utf8'));
  const raceControl = buildEtsyRaceControlBundle({ profile: strategy, locale: manifest.locale, currency: manifest.currency, generatedAt: manifest.generatedAt });
  const zipPath = resolve(localeRoot, manifest.sellerKit.filename);
  const archive = await JSZip.loadAsync(await readFile(zipPath));
  const fileIndex = new Map(manifest.files.map(file => [file.path, file]));
  const zipDate = new Date(manifest.generatedAt);

  for (const [path, content] of raceControl.files) {
    const bytes = new TextEncoder().encode(content);
    await write(resolve(localeRoot, ...path.split('/')), bytes);
    archive.file(path, bytes, { binary: true, createFolders: false, date: zipDate });
    fileIndex.set(path, { path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
  }

  manifest.files = [...fileIndex.values()];
  manifest.deliverables.sellerRaceControlFiles = raceControl.files.size;
  manifest.raceControl = { status: raceControl.plan.status, version: raceControl.plan.raceControlVersion, experimentCount: raceControl.plan.experiments.length, dashboard: 'seller/race-control/race-control-dashboard.html', customerDataAllowed: raceControl.plan.privacy.customerDataAllowed };
  if (!manifest.sellerKit.includes.includes('offline Etsy Race Control')) manifest.sellerKit.includes.splice(-1, 0, 'offline Etsy Race Control');
  const manifestBytes = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
  await write(manifestPath, manifestBytes);
  archive.file('launch-manifest.json', manifestBytes, { binary: true, createFolders: false, date: zipDate });
  const zipBytes = await archive.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 }, platform: 'DOS', streamFiles: false });
  const verified = await JSZip.loadAsync(zipBytes);
  if (Object.values(verified.files).filter(entry => !entry.dir).length !== manifest.files.length + 1) throw new Error(`${result.scenario}: refreshed seller ZIP entry verification failed.`);
  await write(zipPath, zipBytes);
  result.zipBytes = (await stat(zipPath)).size;
  result.deliverables = manifest.deliverables;
}

await write(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
