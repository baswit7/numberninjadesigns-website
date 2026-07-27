import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import JSZip from 'jszip';

const root = resolve('.');
const sourcePath = resolve(root, 'output/generated-products/native-release-ultimate/budget-planner-ultimate/nl-NL/EUR/sage-finance/light/1.0.0/package/budget-planner-ultimate_nl-NL_EUR_2026_sage-finance_light_1.0.0.zip');
const outputPath = resolve(root, 'output/generated-products/native-release-ultimate/customer-release/budget-planner-ultimate_nl-NL_EUR_2026_customer.zip');
const reportPath = resolve(root, 'release-evidence/final-media-release/customer-package-report.json');
const source = await JSZip.loadAsync(await readFile(sourcePath));
const required = Object.freeze([
  ['Budget_Planner_Ultimate_nl-NL_2026.xlsx', 'product/ultimate-budget-planner-nl-NL-2026-light.xlsx'],
  ['README.html', 'customer/README.html'],
  ['QUICK_START.html', 'customer/QUICK_START.html'],
  ['LICENSE.txt', 'customer/LICENSE.txt'],
]);
const customer = new JSZip();
const date = new Date('2000-01-01T00:00:00.000Z');
for (const [target, sourceEntry] of required) {
  const entry = source.file(sourceEntry);
  if (!entry) throw new Error(`Required customer deliverable is missing: ${sourceEntry}.`);
  customer.file(target, await entry.async('uint8array'), { binary: true, date, createFolders: false });
}
const bytes = await customer.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 9 }, platform: 'DOS', streamFiles: false });
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, bytes);
const verified = await JSZip.loadAsync(await readFile(outputPath));
const entries = Object.keys(verified.files).filter(path => !verified.files[path].dir).sort();
const expected = required.map(([target]) => target).sort();
const containsInternalEvidence = entries.some(path => /(?:^|\/)(?:qa|evidence|manifests?)(?:\/|$)|manifest\.json$/iu.test(path));
const status = JSON.stringify(entries) === JSON.stringify(expected) && !containsInternalEvidence && bytes.length > 0 ? 'PASS' : 'FAIL';
const report = { schemaVersion: '1.0.0', generatedAt: new Date().toISOString(), status, output: outputPath.replace(root, '.').replaceAll('\\', '/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), entries, containsInternalEvidence };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (status !== 'PASS') process.exitCode = 1;
