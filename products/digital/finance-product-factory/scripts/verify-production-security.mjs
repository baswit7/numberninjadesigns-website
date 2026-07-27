import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, process.argv[2] ?? 'release-evidence/production-expansion/security/report.json');
const read = path => readFile(resolve(root, path), 'utf8');
const digest = async path => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');

const runtimePaths = [
  'apps/product-factory/index.html',
  'apps/product-factory/app.js',
  'apps/product-factory/styles.css',
  'src/engines/batch-engine.js',
  'src/engines/configuration-engine.js',
  'src/engines/document-engine.js',
  'src/engines/formula-engine.js',
  'src/engines/persistence-engine.js',
  'src/engines/preview-engine.js',
  'src/engines/quality-engine.js',
  'src/engines/security.js',
  'src/engines/validation-engine.js',
  'src/engines/workbook-engine.js',
  'src/commercial/package-engine.js',
  'src/commercial/listing-image-engine.js',
  'src/engines/chart-engine.js',
  'src/server/output-storage.mjs',
  'scripts/serve.mjs',
  'src/contracts/index.js',
  'src/contracts/validation.js',
  'src/contracts/schemas/DocumentTemplate.schema.json',
  'src/factory-runtime.js',
  'src/registry/index.js',
  'src/registry/product-registry.js',
  'src/currencies/index.mjs',
  'src/locales/index.mjs',
  'src/products/index.mjs',
  'src/products/career-products.mjs',
  'src/themes/index.mjs',
];

const sources = new Map(await Promise.all(runtimePaths.map(async path => [path, await read(path)])));
const findings = [];
const addFinding = (code, path, message) => findings.push({ code, path, message });

const appScript = sources.get('apps/product-factory/app.js');
for (const [code, pattern] of [
  ['UNSAFE_INNER_HTML', /\.innerHTML\s*=|insertAdjacentHTML\s*\(|outerHTML\s*=/],
  ['DYNAMIC_CODE_EXECUTION', /\beval\s*\(|\bnew\s+Function\s*\(|set(?:Timeout|Interval)\s*\(\s*['"`]/],
  ['INLINE_EVENT_HANDLER', /setAttribute\s*\(\s*['"]on[a-z]+['"]/i],
  ['DOCUMENT_WRITE', /document\.write\s*\(/],
]) if (pattern.test(appScript)) addFinding(code, 'apps/product-factory/app.js', 'Unsafe DOM or dynamic-code primitive detected.');

const prohibitedNetworkPattern = /\b(?:XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/;
for (const [path, source] of sources) {
  if (prohibitedNetworkPattern.test(source)) addFinding('NETWORK_API', path, 'A prohibited browser network primitive is present in the production runtime.');
}

const fetchCallPattern = /\b(?:globalThis\.|window\.)?fetch\s*\(/g;
for (const [path, source] of sources) {
  const fetchCallCount = [...source.matchAll(fetchCallPattern)].length;
  if (!fetchCallCount) continue;
  const approvedLocalRoutes = path === 'apps/product-factory/app.js'
    && fetchCallCount === 3
    && /fetch\('\/api\/native-listing-images', \{[\s\S]*?method: 'POST'/.test(source)
    && /const endpoint = new URL\('\/api\/output', window\.location\.origin\);/.test(source)
    && /response = await fetch\(endpoint, \{[\s\S]*?method: 'POST'/.test(source)
    && /path === '\/api\/elevenlabs\/test'[\s\S]*?path === '\/api\/elevenlabs\/status'[\s\S]*?path === '\/api\/elevenlabs\/configure'[\s\S]*?path === '\/api\/tutorial'[\s\S]*?\/api\\\/tutorial\\\/status/.test(source)
    && /endpoint\.origin !== window\.location\.origin/.test(source)
    && /const response = await fetch\(endpoint, \{ \.\.\.options, signal: controller\.signal \}\);/.test(source);
  if (!approvedLocalRoutes) addFinding('NETWORK_API', path, 'An unapproved browser fetch call is present in the production runtime.');
}

const html = sources.get('apps/product-factory/index.html');
const css = sources.get('apps/product-factory/styles.css');
for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
  if (/^(?:https?:)?\/\//i.test(match[1])) addFinding('REMOTE_ASSET', 'apps/product-factory/index.html', 'A remote HTML asset reference is present.');
}
if (/url\(\s*["']?(?:https?:)?\/\//i.test(css)) addFinding('REMOTE_CSS_ASSET', 'apps/product-factory/styles.css', 'A remote CSS asset reference is present.');

const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1] ?? '';
for (const directive of ["default-src 'self'", "script-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'none'"]) {
  if (!csp.includes(directive)) addFinding('CSP_DIRECTIVE', 'apps/product-factory/index.html', `Required CSP directive is missing: ${directive}.`);
}
if (csp.includes("'unsafe-eval'")) addFinding('CSP_UNSAFE_EVAL', 'apps/product-factory/index.html', 'CSP permits unsafe-eval.');

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bsk_[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
for (const [path, source] of sources) {
  if (secretPatterns.some(pattern => pattern.test(source))) addFinding('SECRET_PATTERN', path, 'A high-confidence credential pattern is present; the value is intentionally not reported.');
}

const expectedVendorHashes = {
  'vendor/exceljs/4.4.0/exceljs.min.js': '7e49da68588e250dbb8bba190d2caa8ab3787cc0284bda1d8b2f805c4df742c9',
  'vendor/jszip/3.10.1/jszip.min.js': 'acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e',
};
const vendor = [];
for (const [path, expectedSha256] of Object.entries(expectedVendorHashes)) {
  const actualSha256 = await digest(path);
  const status = actualSha256 === expectedSha256 ? 'PASS' : 'FAIL';
  vendor.push({ path, expectedSha256, actualSha256, status });
  if (status === 'FAIL') addFinding('VENDOR_HASH', path, 'Vendored runtime hash differs from the recorded provenance.');
}

const result = {
  schemaVersion: '1.0.0',
  capturedAt: new Date().toISOString(),
  status: findings.length ? 'FAIL' : 'PASS',
  filesInspected: runtimePaths.length,
  checks: {
    unsafeDomSinks: findings.filter(item => ['UNSAFE_INNER_HTML', 'INLINE_EVENT_HANDLER', 'DOCUMENT_WRITE'].includes(item.code)).length === 0,
    dynamicCodeExecution: findings.every(item => item.code !== 'DYNAMIC_CODE_EXECUTION'),
    browserNetworkPrimitives: findings.every(item => item.code !== 'NETWORK_API'),
    approvedSameOriginOutputRoute: findings.every(item => item.code !== 'NETWORK_API')
      && [...appScript.matchAll(fetchCallPattern)].length === 3,
    approvedSameOriginTutorialRoutes: findings.every(item => item.code !== 'NETWORK_API')
      && [...appScript.matchAll(fetchCallPattern)].length === 3,
    remoteAssets: findings.every(item => !['REMOTE_ASSET', 'REMOTE_CSS_ASSET'].includes(item.code)),
    restrictiveCsp: findings.every(item => !item.code.startsWith('CSP_')),
    highConfidenceSecrets: findings.every(item => item.code !== 'SECRET_PATTERN'),
    vendorHashes: vendor.every(item => item.status === 'PASS'),
  },
  vendor,
  findings,
  supportingTests: [
    'tests/engine-support.test.mjs covers formula/CSV neutralization, ZIP paths, prototype pollution, import limits and batch bounds.',
    'tests/package-engine.test.mjs covers deterministic checksummed ZIP output and unsafe path rejection.',
    'tests/frontend-integration.test.mjs covers CSP, local imports, DOM IDs and unsafe sink absence.',
  ],
  limitations: ['This static gate complements but does not replace dependency advisories, browser CSP enforcement, or adversarial review.'],
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exitCode = 1;
