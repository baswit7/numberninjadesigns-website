import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { inspectPhysicalPng } from '../src/media/physical-png-validator.mjs';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function option(name, fallback) {
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

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

const sourceRoot = resolve(root, option('--source', 'release-evidence/premium-rc-render-probe/workbook-renders'));
const outputRoot = resolve(root, option('--output', 'output/photoshop-production/ultimate-nl-dark'));
if (!within(root, sourceRoot) || !within(root, outputRoot)) throw new Error('Photoshop source and output paths must stay inside the repository.');

const renderFiles = {
  dashboard: join(sourceRoot, 'dashboard.png'),
  monthly: join(sourceRoot, 'monthly.png'),
  detail: join(sourceRoot, 'detail.png'),
  goals: join(sourceRoot, 'goals.png'),
  comparison: join(sourceRoot, 'comparison-dashboard.png'),
};
for (const [id, path] of Object.entries(renderFiles)) {
  if (!await exists(path)) throw new Error(`Required real Excel render '${id}' is missing: ${path}`);
}

const templatesRoot = join(outputRoot, 'psd');
const imagesRoot = join(outputRoot, 'images');
const evidenceRoot = join(outputRoot, 'evidence');
await Promise.all([mkdir(templatesRoot, { recursive: true }), mkdir(imagesRoot, { recursive: true }), mkdir(evidenceRoot, { recursive: true })]);

const definitions = [
  ['01-hero', 'Finance helder. Beslissingen sneller.', 'Een premium budgetplanner met echte Excel-dashboards.', [renderFiles.dashboard]],
  ['02-dashboard-overview', 'Alles in één financieel dashboard', 'Inkomsten, uitgaven, doelen en trends direct zichtbaar.', [renderFiles.dashboard]],
  ['03-monthly-budget', 'Plan iedere maand met vertrouwen', 'Vergelijk budget, realisatie en resterende ruimte.', [renderFiles.monthly]],
  ['04-key-features', 'Gebouwd voor serieuze financiële controle', 'Automatische categorieën, formules, grafieken en validatie.', [renderFiles.detail, renderFiles.goals]],
  ['05-light-dark-comparison', 'Light of dark. Dezelfde betrouwbare cijfers.', 'Kies de uitstraling die bij jouw workflow past.', [renderFiles.dashboard, renderFiles.comparison]],
  ['06-whats-included', 'Alles wat je nodig hebt om te starten', 'Dashboard, maandplanning, detailanalyse en doelen.', [renderFiles.dashboard, renderFiles.monthly, renderFiles.goals]],
  ['07-language-currency-options', 'Nederlands en euro-ready', 'Gelokaliseerde labels en consistente valutapresentatie.', [renderFiles.detail]],
  ['08-how-it-works', 'Van invoer naar inzicht in drie stappen', 'Vul in, controleer en stuur bij met actuele grafieken.', [renderFiles.monthly, renderFiles.dashboard]],
  ['09-workbook-previews', 'Bekijk de echte workbook-schermen', 'Alle previews komen rechtstreeks uit het gegenereerde XLSX.', [renderFiles.dashboard, renderFiles.detail, renderFiles.goals]],
  ['10-digital-download', 'Direct downloaden. Lokaal gebruiken.', 'Een complete digitale Excel-oplossing zonder abonnement.', [renderFiles.dashboard]],
];

const items = definitions.map(([id, headline, subheadline, renders]) => ({
  id,
  badge: 'BUDGET PLANNER ULTIMATE · NL · EUR · DARK',
  headline,
  subheadline,
  footer: 'Finance Product Factory · Echte Microsoft Excel-render · 2400 × 1600 px',
  renders,
  psdPath: join(templatesRoot, `${id}.psd`),
  pngPath: join(imagesRoot, `${id}.png`),
}));

const resultPath = join(evidenceRoot, 'photoshop-result.json');
const jobPath = join(evidenceRoot, 'photoshop-job.json');
const wrapperPath = join(evidenceRoot, 'run-photoshop-job.jsx');
const pipelinePath = resolve(root, 'assets/photoshop/fpf-listing-pipeline.jsx');
const job = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  route: 'PHOTOSHOP_COM_DOJAVASCRIPTFILE',
  resultPath,
  palette: { background: '#070707', surface: '#0F0F0F', accent: '#00FF94', text: '#EDEBE3', muted: '#A9AAA7' },
  items,
};
await writeFile(jobPath, `${JSON.stringify(job, null, 2)}\n`, 'utf8');
const jsxLiteral = value => String(value).replaceAll('\\', '/').replaceAll("'", "\\'");
await writeFile(wrapperPath, `var FPF_JOB_PATH = '${jsxLiteral(jobPath)}';\n$.evalFile(new File('${jsxLiteral(pipelinePath)}'));\n`, 'utf8');

const powershell = resolve(root, 'scripts/invoke-photoshop-com.ps1');
const { stdout } = await execFileAsync('pwsh.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Sta', '-ExecutionPolicy', 'Bypass', '-File', powershell, '-ScriptPath', wrapperPath, '-ResultPath', resultPath], {
  cwd: root,
  windowsHide: true,
  timeout: 300_000,
  maxBuffer: 2 * 1024 * 1024,
});
const automation = JSON.parse(stdout.trim());
if (automation.status !== 'PASS') throw new Error(`Photoshop automation failed: ${automation.error ?? 'unknown error'}`);

const validated = [];
for (const item of items) {
  const [pngBytes, psdBytes] = await Promise.all([readFile(item.pngPath), readFile(item.psdPath)]);
  const png = inspectPhysicalPng(pngBytes);
  if (psdBytes.length < 1024 || psdBytes.subarray(0, 4).toString('ascii') !== '8BPS') throw new Error(`PSD is missing or invalid: ${item.psdPath}`);
  validated.push({
    id: item.id,
    png: { path: relative(root, item.pngPath).replaceAll(sep, '/'), bytes: pngBytes.length, sha256: sha256(pngBytes), ...png },
    psd: { path: relative(root, item.psdPath).replaceAll(sep, '/'), bytes: psdBytes.length, sha256: sha256(psdBytes), magic: '8BPS' },
    sourceRenders: item.renders.map(path => relative(root, path).replaceAll(sep, '/')),
  });
}

const manifest = {
  schemaVersion: '1.0.0',
  status: validated.length === 10 && validated.every(item => item.png.status === 'PASS') ? 'PASS' : 'FAIL',
  generatedAt: job.generatedAt,
  photoshopVersion: automation.photoshopVersion,
  route: job.route,
  sourceTruth: 'ALL_WORKBOOK_VISUALS_PLACED_FROM_MICROSOFT_EXCEL_RENDER_OUTPUTS',
  dimensions: { width: 2400, height: 1600 },
  assets: validated,
  cleanup: { temporaryDocumentsClosed: true, documentsBefore: automation.documentsBefore, documentsAfter: automation.documentsAfter },
};
await writeFile(join(evidenceRoot, 'photoshop-production-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(manifest, null, 2));
if (manifest.status !== 'PASS') process.exitCode = 1;
