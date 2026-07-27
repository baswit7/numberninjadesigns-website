import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { testElevenLabsConnection } from '../media/elevenlabs-client.mjs';
import { resolveTutorialLanguage } from '../media/tutorial-language.mjs';
import { loadSecureElevenLabsConfiguration, resolveConfiguredVoice } from './secure-elevenlabs-settings.mjs';

const jobs = new Map();

function publicJob(job) {
  return { id: job.id, status: job.status, locale: job.locale, language: job.language, createdAt: job.createdAt, completedAt: job.completedAt ?? null, outputPath: job.outputPath ?? null, error: job.error ?? null };
}

export async function testTutorialConnection() {
  const configuration = await loadSecureElevenLabsConfiguration();
  return testElevenLabsConnection({ apiKey: configuration.apiKey });
}

export async function startTutorialJob(root, payload) {
  const locale = String(payload?.locale ?? '').trim() || 'en-US';
  if (!/^[a-z]{2}(?:-[A-Za-z]{2})?$/u.test(locale)) throw new Error('Productlocale is ongeldig.');
  const configuration = await loadSecureElevenLabsConfiguration();
  const language = resolveTutorialLanguage(locale);
  const voiceId = resolveConfiguredVoice(configuration, language);
  const id = randomUUID();
  const outputPath = `output/tutorial-videos/${id}`;
  const job = { id, status: 'RUNNING', locale, language, createdAt: new Date().toISOString(), outputPath };
  jobs.set(id, job);
  const voiceEnvironment = Object.fromEntries(Object.entries(configuration.voiceIds).filter(([, value]) => value).map(([key, value]) => [`ELEVENLABS_VOICE_ID_${key.toUpperCase()}`, value]));
  const child = spawn(process.execPath, [resolve(root, 'scripts/build-tutorial-video.mjs'), '--locale', locale, '--run-id', id, '--output', outputPath], {
    cwd: root, windowsHide: true,
    env: { ...process.env, ...voiceEnvironment, ELEVENLABS_API_KEY: configuration.apiKey, ELEVENLABS_VOICE_ID: voiceId },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let errorOutput = '';
  child.stderr.on('data', chunk => { errorOutput = `${errorOutput}${chunk}`.slice(-4_000); });
  child.once('error', error => Object.assign(job, { status: 'FAIL', completedAt: new Date().toISOString(), error: String(error.message ?? error).slice(0, 1_000) }));
  child.once('exit', async code => {
    if (code !== 0) {
      Object.assign(job, { status: 'FAIL', completedAt: new Date().toISOString(), error: errorOutput.trim().slice(0, 1_000) || `Tutorialproces stopte met code ${code}.` });
      return;
    }
    try {
      const manifest = JSON.parse(await readFile(resolve(root, outputPath, 'tutorial-video-manifest.json'), 'utf8'));
      Object.assign(job, { status: manifest.status === 'PASS' ? 'PASS' : 'FAIL', completedAt: new Date().toISOString(), error: manifest.status === 'PASS' ? null : 'Tutorialmanifest is niet geslaagd.' });
    } catch (error) {
      Object.assign(job, { status: 'FAIL', completedAt: new Date().toISOString(), error: `Tutorialmanifest ontbreekt: ${error.message}` });
    }
  });
  return publicJob(job);
}

export function tutorialJobStatus(id) {
  const job = jobs.get(String(id ?? ''));
  return job ? publicJob(job) : null;
}
