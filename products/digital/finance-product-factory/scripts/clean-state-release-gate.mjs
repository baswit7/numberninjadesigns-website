import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectPhysicalPng } from '../src/media/physical-png-validator.mjs';
import { secureElevenLabsStatus } from '../src/server/secure-elevenlabs-settings.mjs';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidencePath = resolve(root, 'release-evidence/final-release-gate/latest.json');

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
async function exists(path) { try { await access(path); return true; } catch { return false; } }
function check(id, passed, evidence, failure) { return { id, status: passed ? 'PASS' : 'FAIL', evidence, ...(passed ? {} : { failure }) }; }

const { stdout: gitRootOutput } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd: root, windowsHide: true });
const gitRoot = resolve(gitRootOutput.trim());
const expectedRoot = resolve('C:/AI/Active/Finance Product Factory');
if (gitRoot !== expectedRoot) throw new Error(`Git root mismatch: ${gitRoot}`);

const photoshopManifestPath = resolve(root, 'output/photoshop-production/ultimate-nl-dark/evidence/photoshop-production-manifest.json');
const photoshop = await exists(photoshopManifestPath) ? JSON.parse(await readFile(photoshopManifestPath, 'utf8')) : null;
const physicalAssets = [];
for (const asset of photoshop?.assets ?? []) {
  try {
    const pngPath = resolve(root, ...asset.png.path.split('/'));
    const psdPath = resolve(root, ...asset.psd.path.split('/'));
    const [pngBytes, psdBytes] = await Promise.all([readFile(pngPath), readFile(psdPath)]);
    const png = inspectPhysicalPng(pngBytes);
    physicalAssets.push({ id: asset.id, status: png.status === 'PASS' && sha256(pngBytes) === asset.png.sha256 && psdBytes.subarray(0, 4).toString('ascii') === '8BPS' && sha256(psdBytes) === asset.psd.sha256 ? 'PASS' : 'FAIL' });
  } catch (error) {
    physicalAssets.push({ id: asset.id, status: 'FAIL', error: error.message });
  }
}

const tutorialManifestPaths = [];
const tutorialRoot = resolve(root, 'output/tutorial-videos');
if (await exists(tutorialRoot)) {
  const pending = [tutorialRoot];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) pending.push(join(directory, entry.name));
      else if (entry.name === 'tutorial-video-manifest.json') tutorialManifestPaths.push(join(directory, entry.name));
    }
  }
}
const tutorialManifests = await Promise.all(tutorialManifestPaths.map(async path => JSON.parse(await readFile(path, 'utf8'))));
const physicalTutorial = tutorialManifests.find(manifest => manifest.status === 'PASS');

const outputEntries = await exists(resolve(root, 'output')) ? await readdir(resolve(root, 'output'), { recursive: true }) : [];
const transientPaths = outputEntries.filter(path => /(?:\.tmp$|\.native-release-stage-|\.native-release-backup-)/u.test(path));
const credentialStatus = await secureElevenLabsStatus();
const checks = [
  check('git-root', gitRoot === expectedRoot, { expectedRoot, actualRoot: gitRoot }, 'Release gate ran in the wrong repository.'),
  check('photoshop-production', photoshop?.status === 'PASS' && photoshop?.assets?.length === 10 && physicalAssets.length === 10 && physicalAssets.every(asset => asset.status === 'PASS'), { status: photoshop?.status ?? 'MISSING', assetCount: physicalAssets.length, failedAssets: physicalAssets.filter(asset => asset.status !== 'PASS') }, 'Ten validated physical Photoshop PSD/PNG pairs are required.'),
  check('photoshop-cleanup', JSON.stringify(photoshop?.cleanup?.documentsBefore) === JSON.stringify(photoshop?.cleanup?.documentsAfter), photoshop?.cleanup ?? null, 'Photoshop document state was not restored.'),
  check('tutorial-video', Boolean(physicalTutorial), { physicalVideoManifests: tutorialManifests.filter(manifest => manifest.status === 'PASS').length, planManifests: tutorialManifests.filter(manifest => manifest.status === 'PLAN_READY').length, credentialsConfigured: credentialStatus.configured, voiceMode: credentialStatus.voiceMode }, 'A physical ElevenLabs voice-over and assembled tutorial MP4 are required.'),
  check('clean-generated-state', transientPaths.length === 0, { transientPaths }, 'Transient staging or temporary output remains.'),
];
const failed = checks.filter(item => item.status === 'FAIL');
const report = {
  schemaVersion: '1.0.0', generatedAt: new Date().toISOString(), status: failed.length ? 'BLOCKED' : 'APPROVED',
  failClosed: true, checks, summary: { passed: checks.length - failed.length, failed: failed.length, total: checks.length },
  blockers: failed.map(item => item.id),
};
await mkdir(dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (failed.length) process.exitCode = 1;
