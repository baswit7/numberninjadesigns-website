import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';

import { synthesizeElevenLabs, transcribeElevenLabs } from '../src/media/elevenlabs-client.mjs';
import { buildSubtitleFiles, buildTutorialContent } from '../src/media/tutorial-language.mjs';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ffmpegOptions = { cwd: root, windowsHide: true, timeout: 300_000, maxBuffer: 8 * 1024 * 1024 };

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}

function within(parent, child) {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..');
}

function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
async function exists(path) { try { await access(path); return true; } catch { return false; } }
function slash(path) { return path.replaceAll(sep, '/'); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/gu, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function secondsFromClock(value) { const [hours, minutes, seconds] = value.split(':'); return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds); }
function shortTime(seconds) { const minutes = Math.floor(seconds / 60); const remainder = Math.floor(seconds % 60); return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`; }

async function probeAudio(path) {
  const result = await run(ffmpegPath, ['-hide_banner', '-i', path, '-af', 'silencedetect=noise=-45dB:d=1.5', '-f', 'null', 'NUL'], ffmpegOptions);
  const durationText = /Duration:\s*([0-9:.]+)/u.exec(result.stderr)?.[1];
  if (!durationText) throw new Error(`Audio duration is unavailable for ${basename(path)}.`);
  const duration = secondsFromClock(durationText);
  const bytes = await readFile(path);
  const mp3 = (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (!mp3 || duration <= 0) throw new Error(`Invalid physical MP3: ${basename(path)}.`);
  const silences = [...result.stderr.matchAll(/silence_duration:\s*([0-9.]+)/gu)].map(match => Number(match[1]));
  return Object.freeze({ status: 'PASS', format: 'MP3', bytes: bytes.length, duration, decoded: true, maxSilence: silences.length ? Math.max(...silences) : 0, sha256: hash(bytes) });
}

async function probeVideo(path) {
  const decoded = await run(ffmpegPath, ['-hide_banner', '-i', path, '-vf', 'blackdetect=d=0.5:pix_th=0.05', '-f', 'null', 'NUL'], ffmpegOptions);
  const durationText = /Duration:\s*([0-9:.]+)/u.exec(decoded.stderr)?.[1];
  const dimensions = /Video:[^\n]*?\b(\d{3,5})x(\d{3,5})\b/u.exec(decoded.stderr);
  const fps = /Video:[^\n]*?\b(\d+(?:\.\d+)?) fps\b/u.exec(decoded.stderr);
  const blackDurations = [...decoded.stderr.matchAll(/black_duration:([0-9.]+)/gu)].map(match => Number(match[1]));
  const bytes = await readFile(path);
  const result = { status: 'PASS', bytes: bytes.length, duration: durationText ? secondsFromClock(durationText) : 0, width: Number(dimensions?.[1]), height: Number(dimensions?.[2]), fps: Number(fps?.[1]), videoDecoded: /Video:/u.test(decoded.stderr), audioDecoded: /Audio:/u.test(decoded.stderr), maximumBlackDuration: blackDurations.length ? Math.max(...blackDurations) : 0, sha256: hash(bytes) };
  if (!result.bytes || result.duration <= 0 || result.width !== 1920 || result.height !== 1080 || Math.abs(result.fps - 30) > 0.01 || !result.videoDecoded || !result.audioDecoded || result.maximumBlackDuration > 0.5) throw new Error(`Final MP4 validation failed: ${JSON.stringify(result)}.`);
  return Object.freeze(result);
}

function evidenceDocument(title, body) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#071019;color:#f1f5f3;font-family:Segoe UI,Arial,sans-serif;padding:48px}h1{font-size:44px;margin:0 0 28px;color:#00d88a}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}.card{background:#10202c;border:1px solid #29404e;border-radius:18px;padding:22px;min-height:160px}.card img{width:100%;height:270px;object-fit:contain;background:#fff;border-radius:10px}.images{grid-template-columns:repeat(5,minmax(0,1fr))}.images .card{padding:10px}.images .card img{height:300px}.file{font:22px Consolas,monospace;overflow-wrap:anywhere}.meta{color:#9eb1bb;font-size:18px}footer{position:fixed;right:36px;bottom:24px;color:#8da1ac}</style><body><h1>${escapeHtml(title)}</h1>${body}<footer>Finance Product Factory · physical release evidence</footer></body></html>`;
}

async function writeEvidencePages(outputRoot, content) {
  const evidence = join(outputRoot, 'visual-evidence');
  await mkdir(evidence, { recursive: true });
  const workbookScreens = ['workbook-dashboard.png', 'workbook-income.png', 'workbook-expenses.png', 'workbook-categories.png'];
  const workbookBody = `<div class="grid">${workbookScreens.map(file => `<div class="card"><img src="/release-evidence/screenshots/${file}"><p class="file">${file}</p></div>`).join('')}</div>`;
  const imagesBody = `<div class="grid images">${Array.from({ length: 10 }, (_, index) => { const file = `${String(index + 1).padStart(2, '0')}-${['hero', 'dashboard-overview', 'monthly-budget', 'key-features', 'light-dark-comparison', 'whats-included', 'language-currency-options', 'how-it-works', 'workbook-previews', 'digital-download'][index]}.png`; return `<div class="card"><img src="/output/photoshop-production/ultimate-nl-dark/images/${file}"><p>${file}</p></div>`; }).join('')}</div>`;
  const productPaths = [
    resolve(root, 'output/generated-products/native-release-ultimate/budget-planner-ultimate/nl-NL/EUR/sage-finance/light/1.0.0/product/ultimate-budget-planner-nl-NL-2026-light.xlsx'),
    resolve(root, 'output/generated-products/native-release-ultimate/customer-release/budget-planner-ultimate_nl-NL_EUR_2026_customer.zip'),
    resolve(root, 'output/generated-products/native-release-ultimate/sales-set/finance-product-factory-master-sales-set.zip'),
  ];
  const productBody = `<div class="grid">${(await Promise.all(productPaths.map(async path => { const info = await stat(path); return `<div class="card"><p class="file">${escapeHtml(basename(path))}</p><p class="meta">Physical file · ${info.size.toLocaleString('en-US')} bytes</p></div>`; }))).join('')}</div>`;
  const closingBody = `<div class="card"><p style="font-size:34px;line-height:1.45">${escapeHtml(content.scenes.at(-1).narration)}</p><p class="meta">XLSX · 10 PSD · 10 PNG · customer ZIP · master sales set · tutorial MP4</p></div>`;
  await Promise.all([
    writeFile(join(evidence, 'workbook.html'), evidenceDocument(content.scenes[11].title, workbookBody)),
    writeFile(join(evidence, 'images.html'), evidenceDocument(content.scenes[12].title, imagesBody)),
    writeFile(join(evidence, 'packages.html'), evidenceDocument(content.scenes[13].title, productBody)),
    writeFile(join(evidence, 'closing.html'), evidenceDocument(content.scenes[14].title, closingBody)),
  ]);
  return evidence;
}

async function captureWorkflow({ outputRoot, content, locale, baseUrl }) {
  const rawRoot = join(outputRoot, 'raw');
  await mkdir(rawRoot, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: rawRoot, size: { width: 1920, height: 1080 } }, locale: locale || 'en-US' });
  const page = await context.newPage();
  const pause = (milliseconds = 1100) => page.waitForTimeout(milliseconds);
  const nav = async step => { await page.locator('#stepNavigation .step-button').nth(step - 1).click(); await pause(); };
  const outputWebPath = `/${slash(relative(root, outputRoot))}/visual-evidence/`;
  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30_000 });
    await pause(1600);
    await page.locator('[data-product-id="budget-planner-ultimate"]').click(); await pause();
    await nav(2); await page.locator('#market').selectOption(content.language === 'en' ? 'US' : content.language === 'de' ? 'DE' : content.language === 'fr' ? 'FR' : content.language === 'es' ? 'US' : 'NL'); await page.locator('#audience').fill(content.scenes[3].title); await pause();
    await nav(3); const requested = await page.locator('#locale option').evaluateAll((options, value) => options.some(option => option.value === value) ? value : options.some(option => option.value === 'en-US') ? 'en-US' : options[0]?.value, locale); await page.locator('#locale').selectOption(requested); await page.locator('#currency').selectOption(content.language === 'en' ? 'USD' : 'EUR'); await pause();
    await nav(4); await page.locator('#year').fill('2026'); await pause();
    await nav(5); await pause(1400);
    await nav(6); const theme = page.locator('#themeGrid [role="radio"]').first(); if (await theme.count()) await theme.click(); await page.locator('#productAppearanceDark').check(); await pause(1500);
    await nav(7); await page.locator('#refreshPreview').click(); await pause(1800);
    await nav(8); await page.locator('#runValidation').click(); await pause(1800);
    await nav(9); await page.locator('#generateProduct').click(); await page.waitForFunction(() => !document.querySelector('#downloadWorkbook')?.disabled, null, { timeout: 120_000 }); await pause(1600);
    await nav(10); await pause(1500);
    await page.goto(new URL(`${outputWebPath}workbook.html`, baseUrl).href, { waitUntil: 'networkidle' }); await pause(3500);
    await page.goto(new URL(`${outputWebPath}images.html`, baseUrl).href, { waitUntil: 'networkidle' }); await pause(4000);
    await page.goto(new URL(`${outputWebPath}packages.html`, baseUrl).href, { waitUntil: 'networkidle' }); await pause(3000);
    await page.goto(new URL(`${outputWebPath}closing.html`, baseUrl).href, { waitUntil: 'networkidle' }); await pause(2600);
    const video = page.video();
    await context.close();
    const path = join(outputRoot, 'workflow-recording.webm');
    await video.saveAs(path);
    await rm(rawRoot, { recursive: true, force: true });
    return path;
  } finally {
    await browser.close().catch(() => {});
  }
}

const locale = option('--locale', 'en-US');
const runId = option('--run-id', new Date().toISOString().replace(/[:.]/gu, '-'));
const baseUrl = option('--base-url', 'http://127.0.0.1:4173/apps/product-factory/');
const outputRoot = resolve(root, option('--output', `output/tutorial-videos/${runId}`));
const audioSource = option('--audio-source');
const planOnly = process.argv.includes('--plan-only');
const reuseExistingAudio = process.argv.includes('--reuse-existing-audio');
if (!within(root, outputRoot) || (audioSource && !within(root, resolve(root, audioSource)))) throw new Error('Tutorial paths must stay inside the repository.');
if (!/^https?:\/\/(?:127\.0\.0\.1|localhost):\d+\//u.test(baseUrl)) throw new Error('Tutorial capture URL must use the local application server.');
if (!ffmpegPath) throw new Error('The validated FFmpeg runtime is unavailable.');

await mkdir(outputRoot, { recursive: true });
const initial = buildTutorialContent(locale);
if (planOnly) {
  await writeFile(join(outputRoot, 'tutorial-script.json'), `${JSON.stringify(initial, null, 2)}\n`);
  await writeFile(join(outputRoot, 'tutorial-video-manifest.json'), `${JSON.stringify({ schemaVersion: '2.0.0', status: 'PLAN_READY', locale, language: initial.language, sceneCount: initial.scenes.length }, null, 2)}\n`);
  process.exit(0);
}

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID;
if (!apiKey || !voiceId) throw new Error('Server-side ElevenLabs configuration is required.');
const sceneAudioRoot = join(outputRoot, 'scene-audio');
await mkdir(sceneAudioRoot, { recursive: true });
const audio = [];
for (const scene of initial.scenes) {
  const filename = `${String(scene.index).padStart(2, '0')}-${scene.id}.mp3`;
  const target = join(sceneAudioRoot, filename);
  if (audioSource) {
    const source = join(resolve(root, audioSource), filename);
    if (resolve(source) !== resolve(target)) await copyFile(source, target);
  } else if (reuseExistingAudio && await exists(target)) {
    // Resume only within the explicit run directory; probeAudio validates every reused file below.
  }
  else {
    const started = Date.now();
    const speech = await synthesizeElevenLabs({ apiKey, voiceId, text: scene.narration });
    await writeFile(target, speech.bytes);
    const delay = Math.max(0, 1250 - (Date.now() - started));
    if (delay) await new Promise(resolveDelay => setTimeout(resolveDelay, delay));
  }
  audio.push({ scene, filename, path: target, ...(await probeAudio(target)) });
}

const concatPath = join(outputRoot, 'audio-concat.txt');
await writeFile(concatPath, audio.map(item => `file '${slash(item.path).replaceAll("'", "'\\''")}'`).join('\n'));
const voicePath = join(outputRoot, 'voice-over.mp3');
await run(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concatPath, '-c:a', 'libmp3lame', '-b:a', '128k', voicePath], ffmpegOptions);
await rm(concatPath, { force: true });
const voiceProbe = await probeAudio(voicePath);
let elapsed = 0;
const timedScenes = audio.map(item => { const scene = { ...item.scene, start: elapsed, end: elapsed + item.duration }; elapsed = scene.end; return scene; });
const subtitles = buildSubtitleFiles(timedScenes);
const chapters = timedScenes.map(scene => `${shortTime(scene.start)} ${scene.title}`);
const script = { ...initial, scenes: timedScenes, steps: timedScenes, narration: timedScenes.map(scene => scene.narration).join(' '), subtitles: subtitles.vtt, srt: subtitles.srt, vtt: subtitles.vtt, chapters };
const markdown = [`# ${script.title}`, '', script.description, '', ...timedScenes.flatMap(scene => [`## ${scene.index}. ${scene.title}`, '', scene.narration, '', `Timing: ${shortTime(scene.start)}–${shortTime(scene.end)}`, ''])].join('\n');
await Promise.all([
  writeFile(join(outputRoot, 'tutorial-script.md'), `${markdown.trim()}\n`),
  writeFile(join(outputRoot, 'tutorial-script.json'), `${JSON.stringify(script, null, 2)}\n`),
  writeFile(join(outputRoot, 'scene-data.json'), `${JSON.stringify(timedScenes, null, 2)}\n`),
  writeFile(join(outputRoot, 'subtitles.srt'), subtitles.srt),
  writeFile(join(outputRoot, 'subtitles.vtt'), subtitles.vtt),
  writeFile(join(outputRoot, 'youtube-title.txt'), `${script.title}\n`),
  writeFile(join(outputRoot, 'youtube-description.txt'), `${script.description}\n`),
  writeFile(join(outputRoot, 'youtube-tags.txt'), `${script.tags.join(', ')}\n`),
  writeFile(join(outputRoot, 'youtube-chapters.txt'), `${chapters.join('\n')}\n`),
]);

const transcription = await transcribeElevenLabs({ apiKey, audioBytes: new Uint8Array(await readFile(voicePath)) });
const languageAliases = { en: ['en', 'eng'], nl: ['nl', 'nld', 'dut'], de: ['de', 'deu', 'ger'], fr: ['fr', 'fra', 'fre'], es: ['es', 'spa'] };
const languageVerified = languageAliases[script.language].includes(transcription.languageCode);
if (!languageVerified) throw new Error(`Generated audio language '${transcription.languageCode || 'unknown'}' does not match '${script.language}'.`);

await writeEvidencePages(outputRoot, script);
const workflowPath = await captureWorkflow({ outputRoot, content: script, locale, baseUrl });
const workflowProbe = await run(ffmpegPath, ['-hide_banner', '-i', workflowPath, '-f', 'null', 'NUL'], ffmpegOptions);
const workflowDurationText = /Duration:\s*([0-9:.]+)/u.exec(workflowProbe.stderr)?.[1];
const workflowDuration = workflowDurationText ? secondsFromClock(workflowDurationText) : 0;
if (workflowDuration <= 0) throw new Error('Workflow recording has no duration.');
const speedRatio = voiceProbe.duration / workflowDuration;
const finalPath = join(outputRoot, 'tutorial.mp4');
await run(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-i', workflowPath, '-i', voicePath, '-i', join(outputRoot, 'subtitles.srt'), '-filter_complex', `[0:v]setpts=${speedRatio.toFixed(8)}*PTS,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#071019,fps=30,format=yuv420p[v]`, '-map', '[v]', '-map', '1:a:0', '-map', '2:0', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-c:s', 'mov_text', '-shortest', '-movflags', '+faststart', finalPath], ffmpegOptions);
const thumbnailPath = join(outputRoot, 'youtube-thumbnail.png');
await run(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-i', resolve(root, 'output/photoshop-production/ultimate-nl-dark/images/01-hero.png'), '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=#071019', '-frames:v', '1', thumbnailPath], ffmpegOptions);
const videoProbe = await probeVideo(finalPath);
const artifacts = [];
for (const path of [join(outputRoot, 'tutorial-script.md'), join(outputRoot, 'tutorial-script.json'), ...audio.map(item => item.path), voicePath, join(outputRoot, 'subtitles.srt'), join(outputRoot, 'subtitles.vtt'), join(outputRoot, 'youtube-title.txt'), join(outputRoot, 'youtube-description.txt'), join(outputRoot, 'youtube-tags.txt'), join(outputRoot, 'youtube-chapters.txt'), thumbnailPath, workflowPath, finalPath]) {
  const bytes = await readFile(path); artifacts.push({ path: slash(relative(root, path)), bytes: bytes.length, sha256: hash(bytes) });
}
const validation = { schemaVersion: '2.0.0', status: 'PASS', locale, resolvedLanguage: script.language, languageDetection: { status: 'PASS', detected: transcription.languageCode, expected: script.language, transcriptCharacters: transcription.text.length }, sceneAudio: audio.map(item => ({ file: item.filename, status: item.status, bytes: item.bytes, duration: item.duration, format: item.format, decoded: item.decoded, maxSilence: item.maxSilence, sha256: item.sha256 })), combinedAudio: voiceProbe, workflow: { status: 'PASS', duration: workflowDuration, physicalApplicationCapture: true }, video: videoProbe, secretFieldsStored: false };
const manifest = { schemaVersion: '2.0.0', status: 'PASS', locale, language: script.language, fallbackApplied: !['es', 'de', 'fr', 'nl', 'en'].some(prefix => String(locale).toLowerCase().startsWith(prefix)) || (String(locale).toLowerCase().startsWith('it') && script.language === 'en'), sceneCount: timedScenes.length, voice: { provider: 'ElevenLabs', modelId: 'eleven_multilingual_v2', mode: 'MULTILINGUAL_DEFAULT', combinedDuration: voiceProbe.duration }, capture: { provider: 'Playwright', browser: 'Google Chrome', physicalWorkflow: true }, assembly: { provider: 'FFmpeg', format: 'MP4', width: 1920, height: 1080, fps: 30, audio: 'AAC', subtitles: 'mov_text' }, artifacts, validationPath: slash(relative(root, join(outputRoot, 'validation-evidence.json'))) };
await writeFile(join(outputRoot, 'validation-evidence.json'), `${JSON.stringify(validation, null, 2)}\n`);
await writeFile(join(outputRoot, 'tutorial-video-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ status: manifest.status, locale, language: script.language, scenes: timedScenes.length, audioSeconds: voiceProbe.duration, videoSeconds: videoProbe.duration, output: slash(relative(root, outputRoot)) }));
