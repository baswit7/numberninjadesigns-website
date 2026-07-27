import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';
import JSZip from 'jszip';

import { loadSecureElevenLabsConfiguration, secureSettingsLocation } from '../src/server/secure-elevenlabs-settings.mjs';

const root = resolve('.');
const reportPath = resolve(root, 'release-evidence/final-media-release/secret-scan.json');
const configuration = await loadSecureElevenLabsConfiguration();
const secretValues = [
  ['api-key', configuration.apiKey],
  ['default-voice-id', configuration.voiceId],
  ...Object.entries(configuration.voiceIds).map(([language, value]) => [`${language}-voice-id`, value]),
].filter(([, value]) => value).filter(([, value], index, values) => values.findIndex(([, candidate]) => candidate === value) === index)
  .map(([kind, value]) => ({ kind, value, bytes: Buffer.from(value) }));
const files = new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).map(path => resolve(root, path)));

async function walk(directory) {
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.add(resolve(path));
    }
  } catch { /* Missing optional output is represented by its absence. */ }
}

await walk(resolve(root, 'output'));
await walk(resolve(root, 'release-evidence'));
await walk(join(process.env.LOCALAPPDATA, 'FinanceProductFactory', 'logs'));
files.add(resolve(secureSettingsLocation));
const hits = [];
let zipsScanned = 0;
let zipEntriesScanned = 0;
for (const path of files) {
  let bytes;
  try { bytes = await readFile(path); } catch { continue; }
  for (const secret of secretValues) if (bytes.indexOf(secret.bytes) >= 0) hits.push({ surface: 'file', kind: secret.kind, path });
  if (extname(path).toLowerCase() !== '.zip') continue;
  zipsScanned += 1;
  try {
    const archive = await JSZip.loadAsync(bytes);
    for (const [entryName, entry] of Object.entries(archive.files)) {
      if (entry.dir) continue;
      zipEntriesScanned += 1;
      const entryBytes = Buffer.from(await entry.async('uint8array'));
      for (const secret of secretValues) if (entryBytes.indexOf(secret.bytes) >= 0) hits.push({ surface: 'zip-entry', kind: secret.kind, path, entry: entryName });
    }
  } catch { /* Non-product or corrupt ZIP files are handled by package validation. */ }
}

const diff = Buffer.concat([
  execFileSync('git', ['-c', 'core.autocrlf=false', 'diff', '--no-ext-diff'], { cwd: root, maxBuffer: 256 * 1024 * 1024 }),
  execFileSync('git', ['-c', 'core.autocrlf=false', 'diff', '--cached', '--no-ext-diff'], { cwd: root, maxBuffer: 256 * 1024 * 1024 }),
]);
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4173/apps/product-factory/', { waitUntil: 'domcontentloaded' });
const storageValues = await page.evaluate(() => Object.values(localStorage));
const statusResponse = await page.evaluate(async () => ({ text: await (await fetch('/api/elevenlabs/status')).text() }));
await browser.close();

const checks = {
  plaintextSecretHits: hits.length,
  secretValuesChecked: secretValues.length,
  gitDiffContainsSecret: secretValues.some(secret => diff.indexOf(secret.bytes) >= 0),
  browserStorageContainsSecret: storageValues.some(value => secretValues.some(secret => value.includes(secret.value))),
  statusResponseContainsSecret: secretValues.some(secret => statusResponse.text.includes(secret.value)),
  statusResponseExposesSecretFields: /apiKey|voiceId|payload/iu.test(statusResponse.text),
};
const status = !checks.plaintextSecretHits && !checks.gitDiffContainsSecret && !checks.browserStorageContainsSecret && !checks.statusResponseContainsSecret && !checks.statusResponseExposesSecretFields ? 'PASS' : 'FAIL';
const report = { schemaVersion: '1.0.0', capturedAt: new Date().toISOString(), status, filesScanned: files.size, zipsScanned, zipEntriesScanned, checks, findings: hits.map(hit => ({ ...hit, path: hit.path.replace(root, '.').replaceAll('\\', '/') })) };
await mkdir(resolve(root, 'release-evidence/final-media-release'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (status !== 'PASS') process.exitCode = 1;
