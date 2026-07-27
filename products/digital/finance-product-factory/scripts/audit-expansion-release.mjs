import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'output/expansion-release-2026-07-20');
const evidenceRoot = resolve(root, 'release-evidence/production-expansion/2026-07-20-final');
const reportPath = resolve(evidenceRoot, 'cross-release-audit.json');
const requiredReleasePaths = [
  'manifest/product-manifest.json',
  'manifest/compatibility-manifest.json',
  'manifest/validation-report.json',
  'manifest/quality-report.json',
  'manifest/release-package-validation.json',
  'listing/etsy-listing.json',
  'listing/image-plan.json',
  'reports/gap-analysis.json',
  'docs/README.md',
  'docs/quick-start.md',
  'docs/customer-instructions.md',
  'docs/FAQ.md',
  'docs/digital-download-notice.md',
  'docs/LICENSE.md',
  'docs/DISCLAIMER.md',
  'docs/support-notes.md',
  'docs/CHANGELOG.md',
];

function within(parent, child) {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

const errors = [];
const releases = [];
if (!within(root, outputRoot) || !within(root, evidenceRoot)) errors.push({ code: 'OUTPUT_SCOPE_ESCAPE' });
const index = await json(resolve(outputRoot, 'release-index.json'));
if (index.status !== 'PASS' || index.scenarioCount !== 8) errors.push({ code: 'RELEASE_INDEX_INVALID', status: index.status, scenarioCount: index.scenarioCount });

const directories = (await readdir(outputRoot, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
if (directories.length !== 8) errors.push({ code: 'RELEASE_DIRECTORY_COUNT', actual: directories.length });

for (const releaseId of directories) {
  const releaseRoot = resolve(outputRoot, releaseId);
  if (!within(outputRoot, releaseRoot)) {
    errors.push({ code: 'RELEASE_SCOPE_ESCAPE', releaseId });
    continue;
  }
  for (const path of requiredReleasePaths) if (!await exists(resolve(releaseRoot, path))) errors.push({ code: 'REQUIRED_FILE_MISSING', releaseId, path });
  const workbookFiles = (await readdir(resolve(releaseRoot, 'workbook'))).filter(name => name.endsWith('.xlsx'));
  const generatedName = workbookFiles.find(name => !name.endsWith('-excel-saved.xlsx'));
  const savedName = workbookFiles.find(name => name.endsWith('-excel-saved.xlsx'));
  if (!generatedName || !savedName || workbookFiles.length !== 2) errors.push({ code: 'WORKBOOK_SET_INVALID', releaseId, workbookFiles });
  if (!generatedName) continue;
  const workbookBytes = await readFile(resolve(releaseRoot, 'workbook', generatedName));
  const manifest = await json(resolve(releaseRoot, 'manifest/product-manifest.json'));
  const compatibility = await json(resolve(releaseRoot, 'manifest/compatibility-manifest.json'));
  const listing = await json(resolve(releaseRoot, 'listing/etsy-listing.json'));
  const imagePlan = await json(resolve(releaseRoot, 'listing/image-plan.json'));
  const releaseValidation = await json(resolve(releaseRoot, 'manifest/release-package-validation.json'));
  const smoke = await json(resolve(evidenceRoot, releaseId, 'excel-open-save-smoke.json'));
  const summary = await json(resolve(evidenceRoot, releaseId, 'release-summary.json'));
  const zipName = (await readdir(releaseRoot)).find(name => name.endsWith('-etsy-release.zip'));
  if (!zipName) errors.push({ code: 'ETSY_ZIP_MISSING', releaseId });
  const zipBytes = zipName ? await readFile(resolve(releaseRoot, zipName)) : Buffer.alloc(0);
  const zip = zipName ? await JSZip.loadAsync(zipBytes) : null;
  const zipPaths = zip ? Object.keys(zip.files).filter(path => !zip.files[path].dir) : [];
  const expectedSha = sha256(workbookBytes);

  if (manifest.workbook.sha256 !== expectedSha || compatibility.workbookSha256 !== expectedSha || summary.workbookSha256 !== expectedSha) errors.push({ code: 'WORKBOOK_HASH_MISMATCH', releaseId });
  if (manifest.releaseStatus !== 'READY_FOR_EXCEL_RELEASE') errors.push({ code: 'RELEASE_STATUS_INVALID', releaseId, status: manifest.releaseStatus });
  if (manifest.validation.workbook !== 'PASS' || manifest.validation.compatibility !== 'PASS') errors.push({ code: 'MANIFEST_GATE_INVALID', releaseId, validation: manifest.validation });
  if (compatibility.excel.status !== 'PASS') errors.push({ code: 'EXCEL_COMPATIBILITY_INVALID', releaseId, status: compatibility.excel.status });
  if (compatibility.googleSheets.status !== 'PROVISIONAL' || compatibility.googleSheets.salesClaimAllowed !== false) errors.push({ code: 'GOOGLE_SHEETS_CLAIM_INVALID', releaseId });
  if (smoke.status !== 'PASS' || smoke.formulaErrorCells.length || smoke.externalLinks.length || smoke.circularReference) errors.push({ code: 'NATIVE_EXCEL_GATE_INVALID', releaseId, smoke });
  if (listing.tags.length !== 13 || new Set(listing.tags).size !== 13 || listing.tags.some(tag => tag.length > 20)) errors.push({ code: 'ETSY_TAGS_INVALID', releaseId, tags: listing.tags });
  if (listing.title.length > 140) errors.push({ code: 'ETSY_TITLE_INVALID', releaseId, length: listing.title.length });
  if (imagePlan.length !== 10 || imagePlan.some(item => !item.filename || !item.requirement || item.dimensions?.width !== 2400 || item.dimensions?.height !== 1600)) errors.push({ code: 'IMAGE_PLAN_INVALID', releaseId });
  if (releaseValidation.status !== 'PASS') errors.push({ code: 'PACKAGE_VALIDATION_INVALID', releaseId, releaseValidation });
  for (const path of requiredReleasePaths) if (!zipPaths.includes(path)) errors.push({ code: 'ZIP_REQUIRED_FILE_MISSING', releaseId, path });
  if (!zipPaths.includes(`product/${generatedName}`)) errors.push({ code: 'ZIP_WORKBOOK_MISSING', releaseId, generatedName });

  for (const path of requiredReleasePaths.filter(path => path.endsWith('.md') || path.endsWith('.json'))) {
    const content = await readFile(resolve(releaseRoot, path), 'utf8');
    if (/\b(?:todo|tbd|lorem ipsum|placeholder)\b/iu.test(content)) errors.push({ code: 'PLACEHOLDER_FOUND', releaseId, path });
  }
  releases.push({
    releaseId,
    productId: manifest.productId,
    status: 'PASS',
    workbook: generatedName,
    workbookBytes: workbookBytes.byteLength,
    workbookSha256: expectedSha,
    excelVersion: smoke.excelVersion,
    sheets: summary.sheets,
    formulas: summary.formulas,
    validations: summary.validations,
    etsyTags: listing.tags.length,
    imagePlanItems: imagePlan.length,
    zip: zipName,
    zipBytes: zipBytes.byteLength,
    zipFiles: zipPaths.length,
  });
}

const report = {
  schemaVersion: '1.0.0',
  status: errors.length ? 'FAIL' : 'PASS',
  releaseCount: releases.length,
  totalWorkbookBytes: releases.reduce((sum, item) => sum + item.workbookBytes, 0),
  totalPackageBytes: releases.reduce((sum, item) => sum + item.zipBytes, 0),
  releases,
  errorCount: errors.length,
  errors,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, releaseCount: report.releaseCount, totalWorkbookBytes: report.totalWorkbookBytes, totalPackageBytes: report.totalPackageBytes, errors: report.errors }, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
