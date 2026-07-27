import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const probeScript = resolve(root, 'scripts/renderer-probe.mjs');
const probesRoot = resolve(root, 'release-evidence/production-expansion/renderer-probes');
const baselineEvidencePath = resolve(root, 'release-evidence/production-expansion/baseline/xlsx-validation.json');
const probeDefinitions = [
  { id: '01-import-only', mode: 'import-only', expectedOutputs: [] },
  { id: '02-create-no-render', mode: 'create-no-render', expectedOutputs: [] },
  { id: '03-render-created-one', mode: 'render-created-one', expectedOutputs: ['created-one-sheet.png'] },
  {
    id: '04-render-existing-four',
    mode: 'render-existing-four',
    expectedOutputs: ['dashboard.png', 'income.png', 'expenses.png', 'categories.png'],
  },
];
const maxCapturedBytes = 4 * 1024 * 1024;

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

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function roundMs(value) {
  return Math.round(value * 10) / 10;
}

function assertInside(parent, candidate, label) {
  const rel = relative(parent, candidate);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`${label} must be a child of ${parent}`);
}

function normalizeSignedExitCode(code) {
  if (code === null || typeof code === 'undefined') return null;
  const unsigned = Number(code) >>> 0;
  return unsigned > 0x7fffffff ? unsigned - 0x100000000 : unsigned;
}

function exitCodeHex(code) {
  if (code === null || typeof code === 'undefined') return null;
  return `0x${(Number(code) >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;
}

function cleanEnvironment() {
  const allowed = [
    'APPDATA',
    'COMSPEC',
    'HOMEDRIVE',
    'HOMEPATH',
    'LOCALAPPDATA',
    'NUMBER_OF_PROCESSORS',
    'OS',
    'PATH',
    'PATHEXT',
    'PROCESSOR_ARCHITECTURE',
    'PROGRAMDATA',
    'SYSTEMDRIVE',
    'SYSTEMROOT',
    'TEMP',
    'TMP',
    'USERPROFILE',
    'WINDIR',
  ];
  return Object.fromEntries(allowed.filter(key => typeof process.env[key] === 'string').map(key => [key, process.env[key]]));
}

async function digestFile(path) {
  const bytes = await readFile(path);
  const info = await stat(path);
  return {
    path: relative(root, path).replaceAll('\\', '/'),
    size: info.size,
    sha256: sha256(bytes),
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function removeWorkspace(workspace) {
  assertInside(probesRoot, workspace, 'workspace cleanup target');
  const junction = resolve(workspace, 'node_modules');
  if (await pathExists(junction)) {
    const info = await lstat(junction);
    if (!info.isSymbolicLink()) throw new Error(`Refusing to remove non-link workspace node_modules: ${junction}`);
    await unlink(junction);
  }
  await rm(workspace, { recursive: true, force: true });
}

async function removeStaleWorkspaces() {
  if (!(await pathExists(probesRoot))) return;
  const entries = await readdir(probesRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('.workspace-')) {
      await removeWorkspace(resolve(probesRoot, entry.name));
    }
  }
}

async function captureProcess(executable, args, options) {
  const started = performance.now();
  const stdout = [];
  const stderr = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let outputLimitExceeded = false;
  let timedOut = false;
  let spawnError = null;

  const child = spawn(executable, args, {
    cwd: options.cwd,
    env: cleanEnvironment(),
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const append = (target, chunk, stream) => {
    const bytes = Buffer.from(chunk);
    if (stream === 'stdout') stdoutBytes += bytes.length;
    else stderrBytes += bytes.length;
    target.push(bytes);
    if (stdoutBytes + stderrBytes > maxCapturedBytes && !outputLimitExceeded) {
      outputLimitExceeded = true;
      child.kill('SIGKILL');
    }
  };

  child.stdout.on('data', chunk => append(stdout, chunk, 'stdout'));
  child.stderr.on('data', chunk => append(stderr, chunk, 'stderr'));
  child.on('error', error => {
    spawnError = { name: error.name, message: error.message, code: error.code ?? null };
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, options.timeoutMs);

  const closed = await new Promise(resolveClose => {
    child.on('close', (code, signal) => resolveClose({ code, signal }));
  });
  clearTimeout(timeout);

  return {
    rawExitCode: closed.code,
    signedExitCode: normalizeSignedExitCode(closed.code),
    exitCodeHex: exitCodeHex(closed.code),
    signal: closed.signal,
    timedOut,
    outputLimitExceeded,
    spawnError,
    durationMs: roundMs(performance.now() - started),
    stdout: Buffer.concat(stdout),
    stderr: Buffer.concat(stderr),
  };
}

async function runProbe(definition, context) {
  const outputDir = resolve(probesRoot, definition.id);
  assertInside(probesRoot, outputDir, 'probe output');
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const workspace = await mkdtemp(resolve(probesRoot, `.workspace-${definition.id}-`));
  const junction = resolve(workspace, 'node_modules');
  const args = [
    probeScript,
    '--mode', definition.mode,
    '--workspace', workspace,
    '--output', outputDir,
  ];
  if (definition.mode === 'render-existing-four') args.push('--workbook', context.workbookPath);

  let captured;
  try {
    await symlink(context.nodeModulesPath, junction, 'junction');
    const linkedTarget = await realpath(junction);
    if (linkedTarget.toLowerCase() !== context.nodeModulesRealPath.toLowerCase()) {
      throw new Error(`Junction target mismatch: ${linkedTarget}`);
    }
    captured = await captureProcess(context.nodePath, args, { cwd: workspace, timeoutMs: context.timeoutMs });
  } finally {
    await removeWorkspace(workspace);
  }

  const stdoutPath = resolve(outputDir, 'stdout.log');
  const stderrPath = resolve(outputDir, 'stderr.log');
  await writeFile(stdoutPath, captured.stdout);
  await writeFile(stderrPath, captured.stderr);

  const childResultPath = resolve(outputDir, 'child-result.json');
  const childResult = (await pathExists(childResultPath)) ? await readJson(childResultPath) : null;
  const renderOutputs = [];
  for (const name of definition.expectedOutputs) {
    const target = resolve(outputDir, name);
    if (await pathExists(target)) renderOutputs.push(await digestFile(target));
  }
  const expectedOutputsPresent = renderOutputs.length === definition.expectedOutputs.length;
  const operationCompleted = childResult?.status === 'PASS' && childResult.operationCompleted === true && expectedOutputsPresent;

  let status = 'FAIL';
  if (captured.timedOut) status = 'TIMEOUT';
  else if (captured.outputLimitExceeded) status = 'OUTPUT_LIMIT_EXCEEDED';
  else if (captured.signedExitCode === 0 && operationCompleted) status = 'PASS';
  else if (captured.signedExitCode !== 0 && operationCompleted) status = 'OPERATION_COMPLETED_PROCESS_EXIT_FAILED';

  const result = {
    schemaVersion: '1.0.0',
    id: definition.id,
    mode: definition.mode,
    status,
    command: {
      executable: context.nodePath,
      arguments: args,
      shell: false,
      timeoutMs: context.timeoutMs,
    },
    durationMs: captured.durationMs,
    process: {
      rawExitCode: captured.rawExitCode,
      signedExitCode: captured.signedExitCode,
      exitCodeHex: captured.exitCodeHex,
      signal: captured.signal,
      timedOut: captured.timedOut,
      outputLimitExceeded: captured.outputLimitExceeded,
      spawnError: captured.spawnError,
    },
    operationCompleted,
    childResult,
    expectedOutputs: definition.expectedOutputs,
    expectedOutputsPresent,
    renderOutputs,
    streams: {
      stdout: await digestFile(stdoutPath),
      stderr: await digestFile(stderrPath),
    },
    junctionRemoved: !(await pathExists(junction)),
  };
  await writeFile(resolve(outputDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}

function classifyBoundary(results) {
  const [moduleOnly, createOnly, oneRender, fourRender] = results;
  const renderExitMatches = oneRender.process.exitCodeHex === fourRender.process.exitCodeHex;
  if (
    moduleOnly.status === 'PASS'
    && createOnly.status === 'PASS'
    && oneRender.status === 'OPERATION_COMPLETED_PROCESS_EXIT_FAILED'
    && fourRender.status === 'OPERATION_COMPLETED_PROCESS_EXIT_FAILED'
    && renderExitMatches
  ) {
    return {
      classification: 'RENDER_PATH_NATIVE_TEARDOWN_FAILURE_REPRODUCED',
      provenBoundary: 'The failure begins after render() is used and after output bytes are durably written.',
      exclusions: ['artifact-tool module import', 'workbook creation without render', 'the baseline XLSX input', 'four-sheet render count'],
      unresolved: 'The probes do not identify the exact native package, function, or teardown object responsible.',
    };
  }
  if (results.every(result => result.status === 'PASS')) {
    return {
      classification: 'FAILURE_NOT_REPRODUCED',
      provenBoundary: 'All isolated probes exited cleanly in this runtime.',
      exclusions: [],
      unresolved: 'The earlier failure may be runtime-version, process-host, or environment specific.',
    };
  }
  return {
    classification: 'BOUNDARY_PARTIALLY_ISOLATED',
    provenBoundary: 'The observed probe matrix does not support the expected render-only boundary.',
    exclusions: [],
    unresolved: 'Review each probe result before attributing the failure to rendering or native teardown.',
  };
}

async function findLinks(path) {
  const links = [];
  if (!(await pathExists(path))) return links;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const target = resolve(path, entry.name);
    const info = await lstat(target);
    if (info.isSymbolicLink()) links.push(relative(root, target).replaceAll('\\', '/'));
    else if (entry.isDirectory()) links.push(...await findLinks(target));
  }
  return links;
}

const args = parseArgs(process.argv.slice(2));
const timeoutMs = Number(args['timeout-ms'] ?? 60_000);
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 5_000 || timeoutMs > 120_000) {
  throw new Error('--timeout-ms must be an integer between 5000 and 120000');
}

const runtimeRoot = resolve(args['runtime-root'] ?? process.env.CODEX_PRIMARY_RUNTIME ?? join(homedir(), '.cache/codex-runtimes/codex-primary-runtime'));
const runtimeManifest = await readJson(resolve(runtimeRoot, 'runtime.json'));
const nodePath = resolve(runtimeRoot, 'dependencies/node/bin/node.exe');
const nodeModulesPath = resolve(runtimeRoot, 'dependencies/node/node_modules');
const nodeModulesRealPath = await realpath(nodeModulesPath);
const artifactPackage = await readJson(resolve(nodeModulesPath, '@oai/artifact-tool/package.json'));
if (artifactPackage.name !== '@oai/artifact-tool') throw new Error('Unexpected artifact-tool package name');
if (artifactPackage.version !== runtimeManifest.artifactToolVersion) {
  throw new Error(`Runtime/package artifact-tool version mismatch: ${runtimeManifest.artifactToolVersion} vs ${artifactPackage.version}`);
}
if (relative(runtimeRoot, nodeModulesRealPath).startsWith('..')) throw new Error('Bundled node_modules resolves outside the runtime root');

const baselineEvidence = await readJson(baselineEvidencePath);
const workbookPath = resolve(root, args.workbook ?? baselineEvidence.path);
assertInside(root, workbookPath, 'workbook');
const workbook = await digestFile(workbookPath);
if (workbook.size !== baselineEvidence.size || workbook.sha256 !== baselineEvidence.sha256) {
  throw new Error('Workbook does not match the baseline XLSX evidence');
}

await mkdir(probesRoot, { recursive: true });
await removeStaleWorkspaces();

const rootPackage = await readJson(resolve(root, 'package.json'));
const dependencySections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const productionDependencyPresent = dependencySections.some(section => Object.hasOwn(rootPackage[section] ?? {}, '@oai/artifact-tool'));
const environment = {
  schemaVersion: '1.0.0',
  capturedAt: new Date().toISOString(),
  repositoryRoot: root,
  runtime: {
    root: await realpath(runtimeRoot),
    bundleVersion: runtimeManifest.bundleVersion,
    nodeVersion: runtimeManifest.nodeVersion,
    artifactToolVersion: runtimeManifest.artifactToolVersion,
    nodePath,
    nodeModulesPath: nodeModulesRealPath,
    qaOnly: true,
    productionDependencyPresent,
  },
  workbook,
  scripts: {
    probe: await digestFile(probeScript),
    runner: await digestFile(fileURLToPath(import.meta.url)),
  },
};
if (productionDependencyPresent) throw new Error('@oai/artifact-tool must not be a product dependency');
await writeFile(resolve(probesRoot, 'environment.json'), `${JSON.stringify(environment, null, 2)}\n`, 'utf8');

const results = [];
for (const definition of probeDefinitions) {
  const result = await runProbe(definition, {
    nodePath,
    nodeModulesPath,
    nodeModulesRealPath,
    timeoutMs,
    workbookPath,
  });
  results.push(result);
}

const residualLinks = await findLinks(probesRoot);
const boundary = classifyBoundary(results);
const failedProcesses = results.filter(result => result.process.signedExitCode !== 0);
const summary = {
  schemaVersion: '1.0.0',
  capturedAt: new Date().toISOString(),
  status: failedProcesses.length ? 'INVESTIGATION_COMPLETE_WITH_VISIBLE_PROCESS_FAILURES' : 'PASS',
  boundary,
  probes: results.map(result => ({
    id: result.id,
    mode: result.mode,
    status: result.status,
    durationMs: result.durationMs,
    signedExitCode: result.process.signedExitCode,
    exitCodeHex: result.process.exitCodeHex,
    operationCompleted: result.operationCompleted,
    stdout: result.streams.stdout,
    stderr: result.streams.stderr,
    renderOutputs: result.renderOutputs,
  })),
  processFailureCount: failedProcesses.length,
  successfulRenderArtifactCount: results.flatMap(result => result.renderOutputs).length,
  successfulRenderArtifactsPreserved: results.flatMap(result => result.renderOutputs),
  junctionResidue: residualLinks,
  junctionCleanupStatus: residualLinks.length === 0 ? 'PASS' : 'FAIL',
  runnerExitPolicy: 'Exit 1 when any isolated child process exits non-zero; child failures are never normalized to success.',
};
await writeFile(resolve(probesRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  status: summary.status,
  classification: boundary.classification,
  processFailureCount: summary.processFailureCount,
  successfulRenderArtifactCount: summary.successfulRenderArtifactCount,
  junctionCleanupStatus: summary.junctionCleanupStatus,
  summaryPath: relative(root, resolve(probesRoot, 'summary.json')).replaceAll('\\', '/'),
}, null, 2)}\n`);

if (residualLinks.length > 0) process.exitCode = 2;
else if (failedProcesses.length > 0) process.exitCode = 1;
