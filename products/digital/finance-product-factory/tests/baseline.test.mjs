import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(resolve(root, path), 'utf8');
const digest = async path => {
  const absolute = resolve(root, path);
  const bytes = await readFile(absolute);
  return { size: (await stat(absolute)).size, sha256: createHash('sha256').update(bytes).digest('hex') };
};

test('isolated baseline contains all three entrypoints', async () => {
  const entrypoints = [
    'apps/product-factory/index.html',
    'modules/etsy-intelligence-engine/index.html',
    'modules/listing-intelligence-engine/dashboard/index.html',
  ];
  await Promise.all(entrypoints.map(path => access(resolve(root, path))));

  const shell = await read('index.html');
  for (const path of entrypoints) assert.match(shell, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(shell, /read-only adapters/i);
  assert.match(shell, /workbookintegriteit nooit wijzigen/i);
});

test('product factory preserves the baseline workbook through versioned definitions', async () => {
  const { productDefinitionById } = await import('../src/products/index.mjs');
  const definition = productDefinitionById['budget-planner-basic'];
  assert.ok(definition, 'Budget Planner Basic must remain registered.');
  assert.equal(definition.status, 'active');

  const sheetIds = new Set(definition.sheets.map(sheet => sheet.id));
  for (const sheetId of ['dashboard', 'income', 'expenses', 'categories']) assert.ok(sheetIds.has(sheetId), `Missing baseline sheet: ${sheetId}`);

  const operations = new Set(definition.formulas.map(formula => formula.operation));
  for (const operation of ['SUM', 'SUMIF', 'SUMIFS']) assert.ok(operations.has(operation), `Missing baseline formula operation: ${operation}`);

  const html = await read('apps/product-factory/index.html');
  assert.match(html, /vendor\/exceljs\/4\.4\.0\/exceljs\.min\.js/);
  assert.match(html, /vendor\/jszip\/3\.10\.1\/jszip\.min\.js/);
  assert.match(html, /type="module"\s+src="\.\/app\.js"/);
});

test('authoritative and legacy Product Factory sources are checksum-preserved', async () => {
  assert.deepEqual(await digest('incoming/Finance_Product_Factory.html'), {
    size: 106716,
    sha256: 'fdf375f084bfb6521de4dc412426e88b1936d1bbb533c7ddc2e753d9cfd00c48',
  });
  assert.deepEqual(await digest('legacy/source-baselines/Finance_Product_Factory.authoritative-106716.html'), {
    size: 106716,
    sha256: 'fdf375f084bfb6521de4dc412426e88b1936d1bbb533c7ddc2e753d9cfd00c48',
  });
  assert.deepEqual(await digest('legacy/source-baselines/Finance_Product_Factory.legacy-16079.html'), {
    size: 16079,
    sha256: '967482956468f78988b3362756a816197ad3982bef30fbffc599b69ab0701d97',
  });
});

test('project documents are checksum-identical to incoming sources', async () => {
  assert.deepEqual(
    await digest('incoming/Finance_Product_Factory_Overdracht_Claude_Code.docx'),
    await digest('docs/Finance_Product_Factory_Overdracht_Claude_Code.docx'),
  );
  assert.deepEqual(
    await digest('incoming/Projectinstellingen en Bronnen.txt'),
    await digest('docs/Projectinstellingen en Bronnen.txt'),
  );
});

test('provenance and validation evidence are machine-readable', async () => {
  const sourceChecksums = JSON.parse(await read('release-evidence/source-checksums.json'));
  const validation = JSON.parse(await read('release-evidence/baseline-validation.json'));
  const browserSmoke = JSON.parse(await read('release-evidence/browser-smoke.json'));
  const xlsxValidation = JSON.parse(await read('release-evidence/xlsx-validation.json'));
  assert.equal(sourceChecksums.files.length, 6);
  assert.equal(validation.overallStatus, 'PASS');
  assert.equal(browserSmoke.overallStatus, 'PASS');
  assert.equal(xlsxValidation.integrityStatus, 'PASS');
  for (const path of ['PROJECT_SCOPE.md', 'SOURCE_PROVENANCE.md', 'ARCHITECTURE.md', 'release-evidence/baseline-selection-report.md', 'release-evidence/baseline-gap-analysis.md', 'release-evidence/repository-preservation-report.md']) {
    await access(resolve(root, path));
  }
});

test('contract inventory references existing canonical schemas', async () => {
  const inventory = await read('packages/shared-contracts/CONTRACT_INVENTORY.md');
  for (const schema of ['market-opportunity.v1.schema.json', 'product-manifest.v1.schema.json', 'listing-package.v1.schema.json']) {
    assert.match(inventory, new RegExp(schema.replaceAll('.', '\\.')));
  }
});
