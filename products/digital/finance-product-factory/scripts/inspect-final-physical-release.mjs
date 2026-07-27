import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import ExcelJS from 'exceljs';
import ffmpegPath from 'ffmpeg-static';
import JSZip from 'jszip';

import { inspectPhysicalPng } from '../src/media/physical-png-validator.mjs';

const run = promisify(execFile);
const root = resolve('.');
const tutorialRoot = resolve(root, 'output/tutorial-videos/final-multilingual-release');
const reportPath = resolve(root, 'release-evidence/final-media-release/physical-inspection.json');
const expected = Object.freeze({ 'en-US': 'en', 'nl-NL': 'nl', 'de-DE': 'de', 'fr-FR': 'fr', 'es-ES': 'es', 'it-IT': 'en', 'nl-NL-repeat': 'nl' });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function decodeMedia(path) {
  const decoded = await run(ffmpegPath, ['-hide_banner', '-i', path, '-f', 'null', 'NUL'], { cwd: root, windowsHide: true, timeout: 300_000, maxBuffer: 8 * 1024 * 1024 });
  return { video: /Video:/u.test(decoded.stderr), audio: /Audio:/u.test(decoded.stderr), dimensions: /Video:[^\n]*?\b(\d{3,5})x(\d{3,5})\b/u.exec(decoded.stderr)?.slice(1, 3).map(Number) ?? null, fps: Number(/Video:[^\n]*?\b(\d+(?:\.\d+)?) fps\b/u.exec(decoded.stderr)?.[1] ?? 0), duration: /Duration:\s*([0-9:.]+)/u.exec(decoded.stderr)?.[1] ?? null };
}

function inspectSubtitles(srt, vtt) {
  const srtTimes = [...srt.matchAll(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/gu)];
  const vttTimes = [...vtt.matchAll(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/gu)];
  const millis = value => { const [hours, minutes, rest] = value.replace(',', '.').split(':'); return (Number(hours) * 3600 + Number(minutes) * 60 + Number(rest)) * 1000; };
  const nonOverlapping = srtTimes.every((cue, index) => millis(cue[1]) < millis(cue[2]) && (!index || millis(srtTimes[index - 1][2]) <= millis(cue[1])));
  return { status: srtTimes.length === 15 && vttTimes.length === 15 && nonOverlapping && vtt.startsWith('WEBVTT') ? 'PASS' : 'FAIL', srtCues: srtTimes.length, vttCues: vttTimes.length, nonOverlapping };
}

const tutorials = [];
for (const directory of Object.keys(expected)) {
  const path = join(tutorialRoot, directory);
  const manifest = JSON.parse(await readFile(join(path, 'tutorial-video-manifest.json'), 'utf8'));
  const validation = JSON.parse(await readFile(join(path, 'validation-evidence.json'), 'utf8'));
  const sceneFiles = (await readdir(join(path, 'scene-audio'))).filter(file => file.endsWith('.mp3')).sort();
  const sceneMagic = (await Promise.all(sceneFiles.map(file => readFile(join(path, 'scene-audio', file))))).every(bytes => (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
  const combined = await decodeMedia(join(path, 'voice-over.mp3'));
  const videoPath = join(path, 'tutorial.mp4');
  const videoBytes = await readFile(videoPath);
  const video = await decodeMedia(videoPath);
  const thumbnail = inspectPhysicalPng(new Uint8Array(await readFile(join(path, 'youtube-thumbnail.png'))), { expectedWidth: 1280, expectedHeight: 720 });
  const subtitles = inspectSubtitles(await readFile(join(path, 'subtitles.srt'), 'utf8'), await readFile(join(path, 'subtitles.vtt'), 'utf8'));
  const requiredFiles = ['tutorial-script.md', 'tutorial-script.json', 'scene-data.json', 'voice-over.mp3', 'subtitles.srt', 'subtitles.vtt', 'youtube-title.txt', 'youtube-description.txt', 'youtube-tags.txt', 'youtube-chapters.txt', 'youtube-thumbnail.png', 'tutorial.mp4', 'tutorial-video-manifest.json', 'validation-evidence.json'];
  const inventory = new Set(await readdir(path));
  const status = manifest.status === 'PASS' && validation.status === 'PASS' && manifest.language === expected[directory] && sceneFiles.length === 15 && sceneMagic && combined.audio && combined.duration && videoBytes.subarray(4, 8).toString('ascii') === 'ftyp' && video.video && video.audio && video.dimensions?.[0] === 1920 && video.dimensions?.[1] === 1080 && Math.abs(video.fps - 30) < 0.01 && thumbnail.status === 'PASS' && subtitles.status === 'PASS' && requiredFiles.every(file => inventory.has(file)) ? 'PASS' : 'FAIL';
  tutorials.push({ directory, status, language: manifest.language, sceneAudio: sceneFiles.length, combinedAudio: combined, subtitles, thumbnail: { status: thumbnail.status, width: thumbnail.width, height: thumbnail.height }, video: { ...video, bytes: videoBytes.length, sha256: sha256(videoBytes) } });
}

const photoshopRoot = resolve(root, 'output/photoshop-production/ultimate-nl-dark');
const pngFiles = (await readdir(join(photoshopRoot, 'images'))).filter(file => file.endsWith('.png'));
const psdFiles = (await readdir(join(photoshopRoot, 'psd'))).filter(file => file.endsWith('.psd'));
const pngPass = (await Promise.all(pngFiles.map(async file => inspectPhysicalPng(new Uint8Array(await readFile(join(photoshopRoot, 'images', file)))).status))).every(status => status === 'PASS');
const psdPass = (await Promise.all(psdFiles.map(async file => (await readFile(join(photoshopRoot, 'psd', file))).subarray(0, 4).toString('ascii') === '8BPS'))).every(Boolean);

const workbookPath = resolve(root, 'output/generated-products/native-release-ultimate/budget-planner-ultimate/nl-NL/EUR/sage-finance/light/1.0.0/product/ultimate-budget-planner-nl-NL-2026-light.xlsx');
const workbookBytes = await readFile(workbookPath);
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(workbookBytes);
const workbookInspection = { status: workbook.worksheets.length >= 4 && workbookBytes.subarray(0, 2).toString('ascii') === 'PK' ? 'PASS' : 'FAIL', file: basename(workbookPath), bytes: workbookBytes.length, worksheets: workbook.worksheets.map(sheet => sheet.name), sha256: sha256(workbookBytes) };

async function inspectZip(path) {
  const bytes = await readFile(path); const zip = await JSZip.loadAsync(bytes); const entries = Object.keys(zip.files).filter(entry => !zip.files[entry].dir).sort();
  return { file: basename(path), bytes: bytes.length, entries, sha256: sha256(bytes) };
}
const customerPackage = await inspectZip(resolve(root, 'output/generated-products/native-release-ultimate/customer-release/budget-planner-ultimate_nl-NL_EUR_2026_customer.zip'));
customerPackage.status = customerPackage.entries.length === 4 && !customerPackage.entries.some(entry => /qa|evidence|manifest/iu.test(entry)) ? 'PASS' : 'FAIL';
const salesSet = await inspectZip(resolve(root, 'output/generated-products/native-release-ultimate/sales-set/finance-product-factory-master-sales-set.zip'));
salesSet.status = salesSet.entries.length === 5 && salesSet.entries.every(entry => entry.endsWith('.xlsx')) ? 'PASS' : 'FAIL';

const checks = {
  tutorials: tutorials.every(item => item.status === 'PASS'),
  photoshop: pngFiles.length === 10 && psdFiles.length === 10 && pngPass && psdPass,
  workbook: workbookInspection.status === 'PASS',
  customerPackage: customerPackage.status === 'PASS',
  salesSet: salesSet.status === 'PASS',
};
const report = { schemaVersion: '1.0.0', inspectedAt: new Date().toISOString(), status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL', checks, tutorials, photoshop: { status: checks.photoshop ? 'PASS' : 'FAIL', pngCount: pngFiles.length, psdCount: psdFiles.length, pngDecoded: pngPass, psdMagic: psdPass }, workbook: workbookInspection, customerPackage, salesSet };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, checks, tutorials: tutorials.map(item => ({ directory: item.directory, status: item.status, language: item.language, duration: item.video.duration, dimensions: item.video.dimensions, fps: item.video.fps })) }, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
