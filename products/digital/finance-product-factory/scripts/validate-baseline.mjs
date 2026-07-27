import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expectedRoot = 'c:/ai/active/finance product factory';
const evidencePath = resolve(root, 'release-evidence/baseline-validation.json');
const checks = [];
const warnings = [];

const normalize = value => value.replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function fileDigest(relativePath) {
  const absolutePath = resolve(root, relativePath);
  const bytes = await readFile(absolutePath);
  const info = await stat(absolutePath);
  return { relativePath, size: info.size, sha256: sha256(bytes) };
}

async function treeDigest(prefix) {
  const files = git('ls-files', '--', prefix).split(/\r?\n/).filter(Boolean).sort();
  const rows = [];
  let bytes = 0;
  for (const relativePath of files) {
    const entry = await fileDigest(relativePath);
    bytes += entry.size;
    rows.push(`${relativePath.replaceAll('\\', '/')}|${entry.size}|${entry.sha256}`);
  }
  return { files: files.length, bytes, sha256: sha256(rows.join('\n')) };
}

async function runCheck(id, critical, operation) {
  try {
    const details = await operation();
    checks.push({ id, critical, status: 'PASS', details });
  } catch (error) {
    checks.push({ id, critical, status: 'FAIL', details: error.message });
  }
}

const expectedFiles = [
  ['incoming/Finance_Product_Factory.html', 106716, 'fdf375f084bfb6521de4dc412426e88b1936d1bbb533c7ddc2e753d9cfd00c48'],
  ['legacy/source-baselines/Finance_Product_Factory.legacy-16079.html', 16079, '967482956468f78988b3362756a816197ad3982bef30fbffc599b69ab0701d97'],
  ['legacy/source-baselines/Finance_Product_Factory.authoritative-106716.html', 106716, 'fdf375f084bfb6521de4dc412426e88b1936d1bbb533c7ddc2e753d9cfd00c48'],
  ['incoming/Finance_Product_Factory_Overdracht_Claude_Code.docx', 37857, 'f69bfa427d22fa72de9d6baff687024c7ab42a268fa19f846c4924915604e562'],
  ['docs/Finance_Product_Factory_Overdracht_Claude_Code.docx', 37857, 'f69bfa427d22fa72de9d6baff687024c7ab42a268fa19f846c4924915604e562'],
  ['incoming/Projectinstellingen en Bronnen.txt', 2425, '684265ab6f60b4f4929204077dcc23d755f44bc49913be27bedfd533f2c48b9b'],
  ['docs/Projectinstellingen en Bronnen.txt', 2425, '684265ab6f60b4f4929204077dcc23d755f44bc49913be27bedfd533f2c48b9b'],
];

await runCheck('repository.root', true, async () => {
  const actual = normalize(await realpath(root));
  assert.equal(actual, expectedRoot);
  assert.equal(normalize(git('rev-parse', '--show-toplevel')), expectedRoot);
  assert.equal((await lstat(root)).isSymbolicLink(), false);
  return actual;
});

await runCheck('repository.history', true, async () => {
  assert.equal(git('branch', '--show-current'), 'main');
  execFileSync('git', ['merge-base', '--is-ancestor', 'b811fac', 'HEAD'], { cwd: root });
  assert.equal(git('remote').length, 0);
  return { head: git('rev-parse', 'HEAD'), base: 'b811fac', remoteCount: 0 };
});

await runCheck('source.integrity', true, async () => {
  const results = [];
  for (const [relativePath, size, expectedHash] of expectedFiles) {
    const actual = await fileDigest(relativePath);
    assert.equal(actual.size, size, `${relativePath}: unexpected size`);
    assert.equal(actual.sha256, expectedHash, `${relativePath}: checksum mismatch`);
    results.push(actual);
  }
  return results;
});

await runCheck('source.external-authoritative', true, async () => {
  const path = 'C:/AI/Active/Finance Producs Factory MVP/Finance_Product_Factory.html';
  const bytes = await readFile(path);
  assert.equal(bytes.length, 106716);
  assert.equal(sha256(bytes), 'fdf375f084bfb6521de4dc412426e88b1936d1bbb533c7ddc2e753d9cfd00c48');
  return { path, size: bytes.length, sha256: sha256(bytes) };
});

await runCheck('html.structure-and-syntax', true, async () => {
  const paths = [
    'incoming/Finance_Product_Factory.html',
    'legacy/source-baselines/Finance_Product_Factory.legacy-16079.html',
    'apps/product-factory/index.html',
    'index.html',
  ];
  const results = [];
  for (const relativePath of paths) {
    const html = await readFile(resolve(root, relativePath), 'utf8');
    for (const pattern of [/<!doctype html/i, /<html\b/i, /<head\b/i, /<\/head>/i, /<body\b/i, /<\/body>/i, /<\/html>/i]) {
      assert.match(html, pattern, `${relativePath}: incomplete HTML`);
    }
    const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(code => code.trim());
    inlineScripts.forEach((code, index) => new Script(code, { filename: `${relativePath}#script-${index + 1}` }));
    assert.doesNotMatch(html, /C:\\AI\\Active\\(?:numberninjadesigns\.github\.io|NumberNinjaDesigns Studio OS)/i);
    results.push({ relativePath, inlineScripts: inlineScripts.length });
  }
  return results;
});

await runCheck('html.local-assets', true, async () => {
  const paths = ['index.html', 'apps/product-factory/index.html'];
  const checked = [];
  for (const relativePath of paths) {
    const html = await readFile(resolve(root, relativePath), 'utf8');
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
      const reference = match[1].split(/[?#]/)[0];
      if (!reference || /^(?:https?:|data:|mailto:|javascript:|#)/i.test(match[1])) continue;
      const asset = resolve(dirname(resolve(root, relativePath)), reference);
      await stat(asset);
      checked.push(reference);
    }
  }
  return { checked };
});

await runCheck('modules.preserved', true, async () => {
  const etsy = await treeDigest('modules/etsy-intelligence-engine');
  const listing = await treeDigest('modules/listing-intelligence-engine');
  assert.deepEqual(etsy, { files: 17, bytes: 1517361, sha256: 'c5609af6d2232e3cbb0824a74c19ccb75f6a09d8aa01325d3adf7fae81aa39d2' });
  assert.deepEqual(listing, { files: 28, bytes: 52528, sha256: 'c63b9044b05c26814af31a602b29d775a4d8e8dc672f9f8369e42213b8b988b2' });
  return { etsy, listing };
});

await runCheck('provenance.machine-readable', true, async () => {
  const provenance = JSON.parse(await readFile(resolve(root, 'release-evidence/source-checksums.json'), 'utf8'));
  assert.equal(provenance.schemaVersion, '1.0.0');
  assert.equal(provenance.files.length, 6);
  for (const entry of provenance.files) {
    for (const field of ['sourcePath', 'targetPath', 'role', 'size', 'sha256', 'copiedAt', 'modifiedAfterCopy', 'selectedAsAuthoritative', 'selectionReason']) {
      assert.ok(Object.hasOwn(entry, field), `${entry.role}: missing ${field}`);
    }
  }
  for (const relativePath of ['release-evidence/baseline-selection-report.md', 'release-evidence/baseline-gap-analysis.md', 'release-evidence/repository-preservation-report.md']) {
    assert.ok((await stat(resolve(root, relativePath))).size > 0, `${relativePath}: empty or missing`);
  }
  return { entries: provenance.files.length, markdownReports: 3 };
});

await runCheck('runtime.browser-smoke', true, async () => {
  const smoke = JSON.parse(await readFile(resolve(root, 'release-evidence/browser-smoke.json'), 'utf8'));
  assert.equal(smoke.overallStatus, 'PASS');
  assert.equal(smoke.desktopShell.horizontalOverflow, false);
  assert.equal(smoke.desktopProductFactory.horizontalOverflow, false);
  assert.equal(smoke.mobileProductFactory.horizontalOverflow, false);
  assert.equal(smoke.desktopShell.consoleErrors + smoke.desktopProductFactory.consoleErrors + smoke.mobileProductFactory.consoleErrors, 0);
  for (const screenshot of smoke.screenshots) {
    const actual = await fileDigest(screenshot.path);
    assert.equal(actual.size, screenshot.size, `${screenshot.path}: unexpected size`);
    assert.equal(actual.sha256, screenshot.sha256, `${screenshot.path}: checksum mismatch`);
  }
  return { screenshots: smoke.screenshots.length, generatedWorkbook: smoke.generation.targetPath };
});

await runCheck('workbook.generated-integrity', true, async () => {
  const validation = JSON.parse(await readFile(resolve(root, 'release-evidence/xlsx-validation.json'), 'utf8'));
  assert.equal(validation.integrityStatus, 'PASS');
  assert.deepEqual(validation.sheets.map(sheet => sheet.name), ['Dashboard', 'Income', 'Expenses', 'Categories']);
  assert.equal(validation.formulas.total, 27);
  assert.equal(validation.workbook.xmlErrors, 0);
  const actual = await fileDigest(validation.workbook.path);
  assert.equal(actual.size, validation.workbook.size);
  assert.equal(actual.sha256, validation.workbook.sha256);
  for (const [sheetName, expectedHash] of Object.entries(validation.artifactTool.renderHashes)) {
    const render = await fileDigest(`release-evidence/screenshots/workbook-${sheetName.toLowerCase()}.png`);
    assert.equal(render.sha256, expectedHash, `${sheetName}: render checksum mismatch`);
  }
  return { overallStatus: validation.overallStatus, requestedConfigurationStatus: validation.requestedConfigurationStatus, workbook: actual };
});

const authoritativeHtml = await readFile(resolve(root, 'incoming/Finance_Product_Factory.html'), 'utf8');
if (!/exceljs/i.test(authoritativeHtml)) warnings.push({ id: 'html.embedded-exceljs', status: 'NOT_PRESENT', details: 'The authoritative HTML uses SheetJS and JSZip, not embedded ExcelJS.' });
if (/https:\/\/(?:cdnjs|fonts\.googleapis|fonts\.gstatic)/i.test(authoritativeHtml) || /https:\/\/(?:cdnjs|fonts\.googleapis|fonts\.gstatic)/i.test(await readFile(resolve(root, 'apps/product-factory/index.html'), 'utf8'))) {
  warnings.push({ id: 'html.offline', status: 'NETWORK_DEPENDENT', details: 'Workbook generation and/or fonts still depend on CDN resources; no full offline claim is made.' });
}
const xlsxValidation = JSON.parse(await readFile(resolve(root, 'release-evidence/xlsx-validation.json'), 'utf8'));
warnings.push(...xlsxValidation.warnings.map((details, index) => ({ id: `workbook.baseline-limitation.${index + 1}`, status: 'KNOWN_LIMITATION', details })));

const failedCritical = checks.filter(check => check.critical && check.status !== 'PASS');
const report = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  repositoryRoot: await realpath(root),
  branch: git('branch', '--show-current'),
  head: git('rev-parse', 'HEAD'),
  baseCommit: 'b811fac',
  overallStatus: failedCritical.length ? 'FAIL' : 'PASS',
  checks,
  warnings,
};

await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ overallStatus: report.overallStatus, checks: checks.length, warnings: warnings.length, evidencePath }, null, 2));
if (failedCritical.length) process.exitCode = 1;
