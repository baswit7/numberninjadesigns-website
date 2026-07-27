import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const helper = join(root, 'scripts', 'elevenlabs-secure-settings.ps1');
const settingsPath = process.env.FPF_SECURE_SETTINGS_PATH
  || join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'FinanceProductFactory', 'secure-settings.json');
const LANGUAGES = Object.freeze(['en', 'nl', 'de', 'fr', 'es']);

function validVoiceId(value) {
  return /^[A-Za-z0-9_-]{8,128}$/u.test(String(value ?? ''));
}

async function invoke(mode, input) {
  const stdout = await new Promise((accept, reject) => {
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper, '-Mode', mode, '-SettingsPath', settingsPath], {
      cwd: root,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    let errorOutput = '';
    child.stdout.on('data', chunk => { output = `${output}${chunk}`.slice(-1024 * 1024); });
    child.stderr.on('data', chunk => { errorOutput = `${errorOutput}${chunk}`.slice(-16 * 1024); });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? accept(output) : reject(new Error(`Secure settings helper failed with code ${code}: ${errorOutput.trim().slice(0, 500)}`)));
    child.stdin.end(input ? JSON.stringify(input) : '');
  });
  return JSON.parse(stdout.trim());
}

export async function saveSecureElevenLabsConfiguration(payload) {
  const apiKey = String(payload?.apiKey ?? '').trim();
  const voiceId = String(payload?.voiceId ?? '').trim();
  const voiceIds = Object.fromEntries(LANGUAGES.map(language => [language, String(payload?.voiceIds?.[language] ?? '').trim()]).filter(([, value]) => value));
  if (apiKey.length < 16 || apiKey.length > 512) throw new Error('ElevenLabs API key is invalid.');
  if (voiceId && !validVoiceId(voiceId)) throw new Error('ElevenLabs voice ID is invalid.');
  if (!voiceId && !LANGUAGES.every(language => validVoiceId(voiceIds[language]))) throw new Error('Configure one multilingual voice or all five language-specific voices.');
  if (Object.values(voiceIds).some(value => !validVoiceId(value))) throw new Error('A language-specific voice ID is invalid.');
  return invoke('save', { apiKey, voiceId, voiceIds });
}

export async function secureElevenLabsStatus() {
  const stored = await invoke('status');
  const environmentLanguages = LANGUAGES.filter(language => validVoiceId(process.env[`ELEVENLABS_VOICE_ID_${language.toUpperCase()}`]));
  const defaultVoiceConfigured = validVoiceId(process.env.ELEVENLABS_VOICE_ID) || Boolean(stored.defaultVoiceConfigured);
  const specificLanguages = [...new Set([...environmentLanguages, ...(stored.specificLanguages ?? [])])].sort();
  return Object.freeze({
    configured: Boolean(process.env.ELEVENLABS_API_KEY) || Boolean(stored.configured),
    protection: process.env.ELEVENLABS_API_KEY ? 'SERVER_ENVIRONMENT' : stored.protection,
    managed: false,
    voiceMode: defaultVoiceConfigured ? 'MULTILINGUAL_DEFAULT' : specificLanguages.length === LANGUAGES.length ? 'LANGUAGE_SPECIFIC' : 'INCOMPLETE',
    languagesConfigured: defaultVoiceConfigured ? [...LANGUAGES] : specificLanguages,
  });
}

export async function loadSecureElevenLabsConfiguration() {
  const stored = await invoke('read');
  const apiKey = String(process.env.ELEVENLABS_API_KEY || stored.apiKey || '').trim();
  const voiceId = String(process.env.ELEVENLABS_VOICE_ID || stored.voiceId || '').trim();
  const voiceIds = Object.fromEntries(LANGUAGES.map(language => [language, String(process.env[`ELEVENLABS_VOICE_ID_${language.toUpperCase()}`] || stored.voiceIds?.[language] || '').trim()]));
  if (!apiKey) throw new Error('Secure ElevenLabs API key is not configured.');
  if (!validVoiceId(voiceId) && !LANGUAGES.every(language => validVoiceId(voiceIds[language]))) throw new Error('Secure ElevenLabs voice configuration is incomplete.');
  return Object.freeze({ apiKey, voiceId, voiceIds: Object.freeze(voiceIds) });
}

export function resolveConfiguredVoice(configuration, language) {
  const voiceId = configuration.voiceIds?.[language] || configuration.voiceId;
  if (!validVoiceId(voiceId)) throw new Error(`No centrally configured ElevenLabs voice exists for language '${language}'.`);
  return voiceId;
}

export const secureSettingsLocation = settingsPath;
