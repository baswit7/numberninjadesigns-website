import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const probesRoot = resolve(root, 'release-evidence/production-expansion/renderer-probes');
const allowedModes = new Set([
  'import-only',
  'create-no-render',
  'render-created-one',
  'render-existing-four',
]);

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    values[key] = value;
    index += 1;
  }
  return values;
}

function assertInside(parent, candidate, label) {
  const rel = relative(parent, candidate);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`${label} must be a child of ${parent}`);
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function roundMs(value) {
  return Math.round(value * 10) / 10;
}

function emit(event, details = {}) {
  process.stdout.write(`${JSON.stringify({ event, ...details })}\n`);
}

async function digestFile(path) {
  const bytes = await readFile(path);
  const info = await stat(path);
  return { path: relative(root, path).replaceAll('\\', '/'), size: info.size, sha256: sha256(bytes) };
}

const args = parseArgs(process.argv.slice(2));
const mode = args.mode;
if (!allowedModes.has(mode)) throw new Error(`Unsupported --mode: ${mode ?? '<missing>'}`);
if (!args.workspace || !args.output) throw new Error('--workspace and --output are required');

const workspace = resolve(args.workspace);
const outputDir = resolve(args.output);
assertInside(probesRoot, workspace, 'workspace');
assertInside(probesRoot, outputDir, 'output');
await mkdir(outputDir, { recursive: true });

const startedAt = new Date().toISOString();
const started = performance.now();
const resultPath = resolve(outputDir, 'child-result.json');
const outputs = [];
let input = null;
let moduleEntry = null;

try {
  emit('probe-started', { mode });

  const requireFromWorkspace = createRequire(resolve(workspace, 'probe-loader.cjs'));
  moduleEntry = requireFromWorkspace.resolve('@oai/artifact-tool');
  const artifactTool = await import(pathToFileURL(moduleEntry).href);
  emit('artifact-tool-imported', {
    mode,
    exportsPresent: ['FileBlob', 'SpreadsheetFile', 'Workbook'].filter(name => typeof artifactTool[name] !== 'undefined'),
  });

  if (mode === 'create-no-render' || mode === 'render-created-one') {
    const { Workbook } = artifactTool;
    const workbook = Workbook.create();
    const sheet = workbook.worksheets.add('Probe');
    sheet.getRange('A1:B3').values = [
      ['Renderer probe', 'Value'],
      ['Mode', mode],
      ['Created', true],
    ];
    emit('workbook-created', { mode, sheetName: 'Probe' });

    if (mode === 'render-created-one') {
      const target = resolve(outputDir, 'created-one-sheet.png');
      const preview = await workbook.render({
        sheetName: 'Probe',
        autoCrop: 'all',
        scale: 1,
        format: 'png',
      });
      await writeFile(target, new Uint8Array(await preview.arrayBuffer()));
      outputs.push(await digestFile(target));
      emit('render-written', { mode, output: outputs.at(-1) });
    }
  }

  if (mode === 'render-existing-four') {
    if (!args.workbook) throw new Error('--workbook is required for render-existing-four');
    const workbookPath = resolve(args.workbook);
    assertInside(root, workbookPath, 'workbook');
    input = await digestFile(workbookPath);

    const { FileBlob, SpreadsheetFile } = artifactTool;
    const file = await FileBlob.load(workbookPath);
    const workbook = await SpreadsheetFile.importXlsx(file);
    emit('workbook-imported', { mode, input });

    for (const sheetName of ['Dashboard', 'Income', 'Expenses', 'Categories']) {
      const target = resolve(outputDir, `${sheetName.toLowerCase()}.png`);
      const preview = await workbook.render({ sheetName, autoCrop: 'all', scale: 1, format: 'png' });
      await writeFile(target, new Uint8Array(await preview.arrayBuffer()));
      outputs.push(await digestFile(target));
      emit('render-written', { mode, sheetName, output: outputs.at(-1) });
    }
  }

  const result = {
    schemaVersion: '1.0.0',
    mode,
    status: 'PASS',
    operationCompleted: true,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: roundMs(performance.now() - started),
    artifactToolEntry: await realpath(moduleEntry),
    input,
    outputs,
  };
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  emit('probe-completed', { mode, operationCompleted: true, outputs: outputs.length });
} catch (error) {
  const failure = {
    schemaVersion: '1.0.0',
    mode,
    status: 'FAIL',
    operationCompleted: false,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: roundMs(performance.now() - started),
    artifactToolEntry: moduleEntry,
    input,
    outputs,
    error: {
      name: error?.name ?? 'Error',
      message: error?.message ?? String(error),
      stack: String(error?.stack ?? '').split(/\r?\n/).slice(0, 8),
    },
  };
  await writeFile(resultPath, `${JSON.stringify(failure, null, 2)}\n`, 'utf8');
  process.stderr.write(`${JSON.stringify({ event: 'probe-failed', mode, error: failure.error })}\n`);
  process.exitCode = 2;
}
