import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { loadSecureElevenLabsConfiguration, resolveConfiguredVoice, secureElevenLabsStatus } from '../src/server/secure-elevenlabs-settings.mjs';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseRoot = resolve(root, 'output/tutorial-videos/final-multilingual-release');
const evidenceRoot = resolve(root, 'release-evidence/final-media-release');
const expectedRoot = resolve('C:/AI/Active/Finance Product Factory');
if (root !== expectedRoot || !releaseRoot.startsWith(`${root}${sep}`)) throw new Error('Verified Finance Product Factory root is required.');

const status = await secureElevenLabsStatus();
if (!status.configured || status.protection !== 'WINDOWS_DPAPI_CURRENT_USER' || status.voiceMode !== 'MULTILINGUAL_DEFAULT') throw new Error('Approved DPAPI multilingual voice configuration is unavailable.');
const configuration = await loadSecureElevenLabsConfiguration();
const voiceId = resolveConfiguredVoice(configuration, 'en');
const resume = process.argv.includes('--resume');
if (!resume) await rm(releaseRoot, { recursive: true, force: true });
await mkdir(releaseRoot, { recursive: true });

const jobs = [
  { locale: 'en-US', directory: 'en-US' },
  { locale: 'nl-NL', directory: 'nl-NL' },
  { locale: 'de-DE', directory: 'de-DE' },
  { locale: 'fr-FR', directory: 'fr-FR' },
  { locale: 'es-ES', directory: 'es-ES' },
  { locale: 'it-IT', directory: 'it-IT', audioSource: 'en-US/scene-audio' },
  { locale: 'nl-NL', directory: 'nl-NL-repeat', audioSource: 'nl-NL/scene-audio', repeatOf: 'nl-NL' },
];
const results = [];
for (const job of jobs) {
  const output = join(releaseRoot, job.directory);
  const args = [resolve(root, 'scripts/build-tutorial-video.mjs'), '--locale', job.locale, '--run-id', job.directory, '--output', relative(root, output)];
  if (resume) args.push('--reuse-existing-audio');
  if (job.audioSource) args.push('--audio-source', relative(root, join(releaseRoot, job.audioSource)));
  const child = await run(process.execPath, args, {
    cwd: root,
    windowsHide: true,
    timeout: 1_800_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, ELEVENLABS_API_KEY: configuration.apiKey, ELEVENLABS_VOICE_ID: voiceId },
  });
  const manifest = JSON.parse(await readFile(join(output, 'tutorial-video-manifest.json'), 'utf8'));
  if (manifest.status !== 'PASS') throw new Error(`Tutorial package ${job.directory} did not pass.`);
  results.push({ ...job, manifest, commandResult: child.stdout.trim().slice(-1000) });
}

async function inventory(directory) {
  return (await readdir(directory, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => relative(directory, join(entry.parentPath, entry.name)).replaceAll(sep, '/'))
    .sort();
}
const firstNl = results.find(result => result.directory === 'nl-NL');
const repeatNl = results.find(result => result.directory === 'nl-NL-repeat');
const firstInventory = await inventory(join(releaseRoot, 'nl-NL'));
const repeatInventory = await inventory(join(releaseRoot, 'nl-NL-repeat'));
const repeatability = {
  status: firstNl.manifest.sceneCount === repeatNl.manifest.sceneCount
    && firstNl.manifest.language === repeatNl.manifest.language
    && firstNl.manifest.assembly.width === repeatNl.manifest.assembly.width
    && firstNl.manifest.assembly.height === repeatNl.manifest.assembly.height
    && firstNl.manifest.assembly.fps === repeatNl.manifest.assembly.fps
    && JSON.stringify(firstInventory) === JSON.stringify(repeatInventory) ? 'PASS' : 'FAIL',
  sceneCount: [firstNl.manifest.sceneCount, repeatNl.manifest.sceneCount],
  language: [firstNl.manifest.language, repeatNl.manifest.language],
  resolution: [`${firstNl.manifest.assembly.width}x${firstNl.manifest.assembly.height}`, `${repeatNl.manifest.assembly.width}x${repeatNl.manifest.assembly.height}`],
  fps: [firstNl.manifest.assembly.fps, repeatNl.manifest.assembly.fps],
  identicalFileList: JSON.stringify(firstInventory) === JSON.stringify(repeatInventory),
};
if (repeatability.status !== 'PASS') throw new Error('Second nl-NL physical tutorial run is not structurally repeatable.');

const report = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  status: 'PASS',
  secureConfiguration: { protection: status.protection, voiceMode: status.voiceMode, plaintextPersisted: false },
  packages: results.map(result => ({ locale: result.locale, directory: result.directory, language: result.manifest.language, fallbackApplied: result.manifest.fallbackApplied, sceneCount: result.manifest.sceneCount, width: result.manifest.assembly.width, height: result.manifest.assembly.height, fps: result.manifest.assembly.fps })),
  repeatability,
  releaseRoot: relative(root, releaseRoot).replaceAll(sep, '/'),
};
await mkdir(evidenceRoot, { recursive: true });
await writeFile(join(evidenceRoot, 'multilingual-media-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
