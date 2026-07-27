import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { devNull } from 'node:os';
import ffmpegPath from 'ffmpeg-static';

import { ETSY_VIDEO_SPECS } from '../src/commercial/etsy-dominance-engine.mjs';
import { sha256Hex } from '../src/engines/security.js';

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, '..');

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function renderVideo(spec, imagesDirectory, outputDirectory) {
  const imagePaths = spec.storyboardImageIds.map((id, index) => resolve(imagesDirectory, `${String(index + (spec.id === 'product-tour' ? 1 : 8)).padStart(2, '0')}-${id}.png`));
  // Resolve by ID when sequence numbers differ from the storyboard position.
  const available = await Promise.all(spec.storyboardImageIds.map(async id => {
    const candidates = Array.from({ length: 20 }, (_, index) => resolve(imagesDirectory, `${String(index + 1).padStart(2, '0')}-${id}.png`));
    return (await Promise.all(candidates.map(async path => await exists(path) ? path : null))).find(Boolean) ?? null;
  }));
  if (available.some(path => !path)) throw new Error(`Missing storyboard PNGs for ${spec.id}: ${spec.storyboardImageIds.filter((_, index) => !available[index]).join(', ')}`);
  imagePaths.splice(0, imagePaths.length, ...available);
  const transitionSeconds = 0.45;
  const secondsPerImage = (spec.durationSeconds + transitionSeconds * (imagePaths.length - 1)) / imagePaths.length;
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  for (const imagePath of imagePaths) args.push('-loop', '1', '-t', secondsPerImage.toFixed(3), '-i', imagePath);
  args.push('-f', 'lavfi', '-t', String(spec.durationSeconds), '-i', 'color=c=0x00FF94@0.82:s=30x30:r=30');
  const frameCount = Math.ceil(secondsPerImage * 30);
  const filters = imagePaths.map((_, index) => {
    const panDirection = index % 2 === 0 ? 1 : -1;
    const overscanWidth = Math.ceil(spec.width * 1.12);
    const overscanHeight = Math.ceil(spec.height * 1.12);
    return `[${index}:v]scale=${overscanWidth}:${overscanHeight}:force_original_aspect_ratio=increase,crop=${overscanWidth}:${overscanHeight},setsar=1,zoompan=z='min(zoom+0.00075,1.085)':x='iw/2-(iw/zoom/2)+${panDirection}*18*sin(on/24)':y='ih/2-(ih/zoom/2)+12*cos(on/29)':d=${frameCount}:s=${spec.width}x${spec.height}:fps=30,trim=duration=${secondsPerImage.toFixed(3)},setpts=PTS-STARTPTS[v${index}]`;
  });
  let previous = 'v0';
  for (let index = 1; index < imagePaths.length; index += 1) {
    const output = index === imagePaths.length - 1 ? 'tour' : `xf${index}`;
    const offset = (index * (secondsPerImage - transitionSeconds)).toFixed(3);
    filters.push(`[${previous}][v${index}]xfade=transition=fade:duration=${transitionSeconds}:offset=${offset}[${output}]`);
    previous = output;
  }
  const cursorInput = imagePaths.length;
  filters.push(`[${cursorInput}:v]format=rgba[cursor]`);
  filters.push(`[${previous}][cursor]overlay=x='120+mod(t*185\,820)':y='160+mod(t*113\,650)':eval=frame,drawbox=x=0:y=1068:w='1080*t/${spec.durationSeconds}':h=12:color=0x00FF94@0.95:t=fill,trim=duration=${spec.durationSeconds},setpts=PTS-STARTPTS[v]`);
  const target = resolve(outputDirectory, spec.filename);
  args.push('-filter_complex', filters.join(';'), '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '30', target);
  await execFileAsync(ffmpegPath, args, { cwd: root, windowsHide: true, timeout: 180_000, maxBuffer: 2 * 1024 * 1024 });
  await execFileAsync(ffmpegPath, ['-v', 'error', '-i', target, '-map', '0:v:0', '-f', 'null', devNull], { cwd: root, windowsHide: true, timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });
  const bytes = new Uint8Array(await readFile(target));
  const signature = new TextDecoder('latin1').decode(bytes.slice(0, 64));
  const fullText = new TextDecoder('latin1').decode(bytes);
  if (!signature.includes('ftyp') || !fullText.includes('vide') || fullText.includes('soun')) throw new Error(`${spec.filename} failed MP4 video/audio validation.`);
  if (bytes.byteLength > 100 * 1024 * 1024) throw new Error(`${spec.filename} exceeds Etsy's 100 MB upload limit.`);
  return Object.freeze({
    id: spec.id,
    filename: basename(target),
    path: target,
    bytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
    width: spec.width,
    height: spec.height,
    durationSeconds: spec.durationSeconds,
    frameRate: 30,
    audio: false,
    storyboardImageIds: [...spec.storyboardImageIds],
    motionProfile: 'ken-burns-crossfade-focus-cursor-v2',
    focusCursor: true,
    transition: 'crossfade',
    validation: 'PASS',
  });
}

export async function buildEtsyListingVideos({ imagesDirectory, outputDirectory, generatedAt = new Date().toISOString() }) {
  if (!ffmpegPath) throw new Error('The bundled FFmpeg executable is unavailable.');
  const imageRoot = resolve(imagesDirectory);
  const outputRoot = resolve(outputDirectory);
  await mkdir(outputRoot, { recursive: true });
  const videos = [];
  for (const spec of ETSY_VIDEO_SPECS) videos.push(await renderVideo(spec, imageRoot, outputRoot));
  const manifest = Object.freeze({
    schemaVersion: '1.0.0',
    status: videos.length === 2 && videos.every(video => video.validation === 'PASS') ? 'PASS' : 'FAIL',
    generatedAt: new Date(generatedAt).toISOString(),
    platform: 'etsy',
    videoCount: videos.length,
    policy: Object.freeze({ maximumVideos: 2, durationSeconds: Object.freeze([3, 15]), maximumBytes: 100 * 1024 * 1024, minimumResolution: 500, targetResolution: 1080, audio: false, requiredMotionProfile: 'ken-burns-crossfade-focus-cursor-v2' }),
    videos: Object.freeze(videos.map(({ path: _path, ...video }) => video)),
  });
  await writeFile(resolve(outputRoot, 'etsy-video-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return Object.freeze({ videos: Object.freeze(videos), manifest });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const imagesDirectory = resolve(root, option('--images', 'output/etsy-dominance/listing/images'));
  const outputDirectory = resolve(root, option('--output', 'output/etsy-dominance/listing/videos'));
  const generatedAt = option('--generated-at', new Date().toISOString());
  const result = await buildEtsyListingVideos({ imagesDirectory, outputDirectory, generatedAt });
  process.stdout.write(`${JSON.stringify({ status: result.manifest.status, outputDirectory, videos: result.manifest.videos }, null, 2)}\n`);
}
