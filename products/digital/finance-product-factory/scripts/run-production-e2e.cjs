#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE_ROOT = path.join(ROOT, 'release-evidence', 'production-expansion', 'browser-e2e');
const SCREENSHOT_ROOT = path.join(EVIDENCE_ROOT, 'screenshots');
const DOWNLOAD_ROOT = path.join(EVIDENCE_ROOT, 'downloads');
const REPORT_PATH = path.join(EVIDENCE_ROOT, 'report.json');
const APP_PATH = '/apps/product-factory/';
const ACTIVE_PRODUCT_IDS = Object.freeze([
  'budget-planner-basic',
  'budget-planner-professional',
  'budget-planner-ultimate',
  'monthly-budget-planner',
  'debt-snowball-planner',
  'savings-goal-tracker',
  'subscription-tracker',
]);
const RELEASE_CANDIDATE_IDS = Object.freeze([
  'annual-budget-spreadsheet',
  'paycheck-budget-planner',
  'debt-savings-bundle',
  'project-management-spreadsheet',
  'small-business-bookkeeping',
  'wedding-planner-release-candidate',
]);
const VISIBLE_PRODUCT_IDS = Object.freeze([...ACTIVE_PRODUCT_IDS, ...RELEASE_CANDIDATE_IDS]);
const BATCH_SMOKE_PRODUCT_IDS = Object.freeze([
  'budget-planner-basic',
  'annual-budget-spreadsheet',
  'project-management-spreadsheet',
  'wedding-planner-release-candidate',
]);
const BETA_PRODUCT_IDS = Object.freeze([
  'annual-budget-planner',
  'debt-avalanche-planner',
  'sinking-funds-planner',
  'bill-payment-calendar',
  'net-worth-tracker',
  'side-hustle-profit-tracker',
  'small-business-income-expense-tracker',
]);
const LOCALE_IDS = Object.freeze(['nl-NL', 'en-US', 'en-GB', 'de-DE']);
const THEME_IDS = Object.freeze([
  'executive-navy',
  'modern-minimal',
  'warm-neutral',
  'sage-finance',
  'soft-pastel',
  'lavender-balance',
]);
const REQUIRED_LISTING_IMAGE_PATHS = Object.freeze([
  'listing/images/01-hero.png',
  'listing/images/02-dashboard-overview.png',
  'listing/images/03-monthly-budget.png',
  'listing/images/04-key-features.png',
  'listing/images/05-light-dark-comparison.png',
  'listing/images/06-whats-included.png',
  'listing/images/07-language-currency-options.png',
  'listing/images/08-how-it-works.png',
  'listing/images/09-workbook-previews.png',
  'listing/images/10-digital-download.png',
]);
const STEP_SCREENSHOT_NAMES = Object.freeze([
  'product',
  'market-audience',
  'locale-currency',
  'configuration',
  'categories',
  'theme',
  'preview',
  'validation',
  'generation',
  'quality-report',
  'export-package',
  'approval',
]);
const REQUIRED_PACKAGE_PATHS = Object.freeze([
  'customer/README.html',
  'customer/QUICK_START.html',
  'customer/LICENSE.txt',
  'listing/listing-metadata.json',
  'listing/title.txt',
  'listing/description.txt',
  'listing/tags.txt',
  'listing/features.txt',
  'listing/faq.txt',
  'listing/alt-texts.txt',
  ...REQUIRED_LISTING_IMAGE_PATHS,
  'images/image-production-manifest.json',
  'qa/validation-report.json',
  'qa/quality-report.json',
  'qa/compatibility-report.json',
  'qa/premium-release-report.json',
  'qa/generated-product-manifest.json',
  'qa/release-manifest.json',
  'manifest.json',
]);
const REQUIRED_XLSX_PATHS = Object.freeze([
  '[Content_Types].xml',
  '_rels/.rels',
  'docProps/core.xml',
  'xl/workbook.xml',
  'xl/_rels/workbook.xml.rels',
  'xl/styles.xml',
]);
const MANIFEST_ONLY_PATHS = new Set([
  'qa/generated-product-manifest.json',
  'qa/release-manifest.json',
  'manifest.json',
]);
const BUDGETS = Object.freeze({
  loadMs: positiveNumber(process.env.FPF_E2E_LOAD_BUDGET_MS, 5000),
  navigationMs: positiveNumber(process.env.FPF_E2E_NAV_BUDGET_MS, 1000),
  previewMs: positiveNumber(process.env.FPF_E2E_PREVIEW_BUDGET_MS, 2000),
  generationMs: positiveNumber(process.env.FPF_E2E_GENERATION_BUDGET_MS, 45000),
});

class EvidenceError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'EvidenceError';
    this.details = details || {};
  }
}

class EnvironmentBlockedError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'EnvironmentBlockedError';
    this.details = details || {};
  }
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function assert(condition, message, details) {
  if (!condition) throw new EvidenceError(message, details);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function roundMs(value) {
  return Math.round(Number(value) * 100) / 100;
}

function serializeError(error) {
  return {
    name: error && error.name ? String(error.name) : 'Error',
    message: error && error.message ? String(error.message) : String(error),
    details: error && error.details ? error.details : undefined,
    stack: error && error.stack ? String(error.stack).split(/\r?\n/u).slice(0, 12).join('\n') : undefined,
  };
}

function relativeEvidence(filePath) {
  return path.relative(EVIDENCE_ROOT, filePath).split(path.sep).join('/');
}

function isSafeArchivePath(entryPath) {
  if (typeof entryPath !== 'string' || entryPath.length === 0 || entryPath.length > 260) return false;
  if (entryPath.includes('\\') || entryPath.startsWith('/') || /^[A-Za-z]:/u.test(entryPath)) return false;
  if (/[\u0000-\u001f\u007f]/u.test(entryPath)) return false;
  const segments = entryPath.split('/');
  return segments.every(segment => segment && segment !== '.' && segment !== '..');
}

function parseArgs(argv) {
  const options = { confirmed: false, help: false };
  for (const argument of argv) {
    if (argument === '--localization-ready') options.confirmed = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new EvidenceError('Unknown argument: ' + argument);
  }
  if (process.env.FPF_LOCALIZATION_READY === '1') options.confirmed = true;
  return options;
}

function printHelp() {
  process.stdout.write([
    'Finance Product Factory production browser E2E runner',
    '',
    'Usage:',
    '  node scripts/run-production-e2e.cjs --localization-ready',
    '',
    'Environment:',
    '  NODE_PATH                     directory containing Playwright',
    '  FPF_LOCALIZATION_READY=1      alternative readiness confirmation',
    '  FPF_E2E_*_BUDGET_MS           optional timing budgets',
    '',
  ].join('\n'));
}

async function prepareEvidenceDirectory() {
  const relative = path.relative(ROOT, EVIDENCE_ROOT);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Evidence path escapes the repository.');
  await fsp.mkdir(EVIDENCE_ROOT, { recursive: true });
  const stat = await fsp.lstat(EVIDENCE_ROOT);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), 'Evidence root must be a real directory.');
  for (const ownedPath of [SCREENSHOT_ROOT, DOWNLOAD_ROOT]) {
    await fsp.rm(ownedPath, { recursive: true, force: true });
    await fsp.mkdir(ownedPath, { recursive: true });
  }
  await fsp.rm(REPORT_PATH, { force: true });
}

async function writeReport(report) {
  report.updatedAt = new Date().toISOString();
  const body = JSON.stringify(report, null, 2) + '\n';
  const temporary = REPORT_PATH + '.tmp-' + process.pid + '-' + Date.now();
  await fsp.writeFile(temporary, body, 'utf8');
  let lastError;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await fsp.rm(REPORT_PATH, { force: true });
      await fsp.rename(temporary, REPORT_PATH);
      return;
    } catch (error) {
      lastError = error;
      if (!['EBUSY', 'EACCES', 'EPERM', 'EEXIST'].includes(error.code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * (2 ** attempt)));
    }
  }
  try {
    await fsp.writeFile(REPORT_PATH, body, 'utf8');
    await fsp.rm(temporary, { force: true });
  } catch (error) {
    error.cause = lastError;
    throw error;
  }
}

async function screenshot(page, name, fullPage) {
  const safeName = name.replace(/[^a-z0-9_.-]+/giu, '-').replace(/^-+|-+$/gu, '').toLowerCase();
  const target = path.join(SCREENSHOT_ROOT, safeName + '.png');
  await page.screenshot({ path: target, fullPage: fullPage !== false, animations: 'disabled' });
  return relativeEvidence(target);
}

async function runGate(report, id, title, operation, page) {
  const startedAt = new Date().toISOString();
  const start = performance.now();
  let gate;
  try {
    const details = await operation();
    gate = {
      id,
      title,
      status: 'PASS',
      startedAt,
      durationMs: roundMs(performance.now() - start),
      details: details || {},
    };
  } catch (error) {
    let failureScreenshot;
    if (page && !page.isClosed()) {
      try {
        failureScreenshot = await screenshot(page, 'failure-' + id, true);
      } catch {
        failureScreenshot = undefined;
      }
    }
    gate = {
      id,
      title,
      status: error instanceof EnvironmentBlockedError ? 'BLOCKED' : 'FAIL',
      startedAt,
      durationMs: roundMs(performance.now() - start),
      error: serializeError(error),
      evidence: failureScreenshot ? { screenshot: failureScreenshot } : undefined,
    };
  }
  report.gates.push(gate);
  await writeReport(report);
  process.stdout.write('[' + gate.status + '] ' + id + ' (' + gate.durationMs + ' ms)\n');
  return gate;
}

function resolveRuntimeDependency(name) {
  try {
    return require.resolve(name);
  } catch (primaryError) {
    const candidates = String(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
    for (const candidate of candidates) {
      try {
        return require.resolve(name, { paths: [candidate] });
      } catch {
        // Continue through explicitly configured NODE_PATH entries.
      }
    }
    throw new EnvironmentBlockedError(
      'Unable to resolve ' + name + '. Set NODE_PATH to the verified Playwright node_modules directory.',
      { nodePathConfigured: Boolean(process.env.NODE_PATH), cause: primaryError.message },
    );
  }
}

async function freePort() {
  const server = net.createServer();
  server.unref();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : 0;
  await new Promise(resolve => server.close(resolve));
  assert(Number.isInteger(port) && port > 0, 'Unable to allocate a free localhost port.');
  return port;
}

function requestStatus(url) {
  return new Promise(resolve => {
    const request = http.get(url, response => {
      response.resume();
      response.once('end', () => resolve(response.statusCode || 0));
    });
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(0);
    });
    request.once('error', () => resolve(0));
  });
}

async function startStaticServer() {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'serve.mjs')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const append = chunk => {
    output = (output + chunk.toString('utf8')).slice(-20000);
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  const baseUrl = 'http://127.0.0.1:' + port;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new EnvironmentBlockedError('Static server exited before readiness.', {
        exitCode: child.exitCode,
        output,
      });
    }
    if (await requestStatus(baseUrl + APP_PATH) === 200) {
      return { child, port, baseUrl, getOutput: () => output };
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await stopChild(child);
  throw new EnvironmentBlockedError('Static server did not become ready within 15 seconds.', { output });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    once(child, 'exit').catch(() => undefined),
    new Promise(resolve => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

function createTelemetry(baseUrl) {
  return {
    allowedOrigin: new URL(baseUrl).origin,
    consoleErrors: [],
    pageErrors: [],
    externalRequests: [],
    requestFailures: [],
    httpErrors: [],
  };
}

function attachTelemetry(page, telemetry, pageName) {
  page.on('console', message => {
    if (message.type() === 'error') {
      telemetry.consoleErrors.push({ page: pageName, text: message.text(), location: message.location() });
    }
  });
  page.on('pageerror', error => {
    telemetry.pageErrors.push({ page: pageName, message: error.message, stack: error.stack });
  });
  page.on('request', request => {
    const url = request.url();
    if (/^(?:data|blob|about):/u.test(url)) return;
    try {
      if (new URL(url).origin !== telemetry.allowedOrigin) {
        telemetry.externalRequests.push({ page: pageName, method: request.method(), resourceType: request.resourceType(), url });
      }
    } catch {
      telemetry.externalRequests.push({ page: pageName, method: request.method(), resourceType: request.resourceType(), url });
    }
  });
  page.on('requestfailed', request => {
    telemetry.requestFailures.push({
      page: pageName,
      method: request.method(),
      resourceType: request.resourceType(),
      url: request.url(),
      failure: request.failure(),
    });
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      telemetry.httpErrors.push({ page: pageName, status: response.status(), url: response.url() });
    }
  });
}

async function waitForRuntime(page, baseUrl) {
  const start = performance.now();
  const response = await page.goto(baseUrl + APP_PATH, { waitUntil: 'domcontentloaded', timeout: 15000 });
  assert(response && response.status() === 200, 'Application navigation did not return HTTP 200.', {
    status: response ? response.status() : null,
  });
  await page.locator('#connectionStatus[data-state="ready"]').waitFor({ state: 'attached', timeout: 15000 });
  return roundMs(performance.now() - start);
}

async function navigateToStep(page, step) {
  const buttons = page.locator('#stepNavigation button');
  const start = performance.now();
  await buttons.nth(step - 1).click();
  await page.locator('.step-panel[data-step="' + step + '"]').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'workspace');
  return roundMs(performance.now() - start);
}

async function savedProjectOutput(page, {
  trigger,
  locationSelector,
  evidenceFilename,
  extension,
  timeout = 30000,
}) {
  await trigger();
  await page.waitForFunction(({ selector, suffix }) => {
    const node = document.querySelector(selector);
    return node && !node.hidden && node.textContent.includes('output/generated-products/') && node.textContent.trim().toLowerCase().endsWith(suffix);
  }, { selector: locationSelector, suffix: extension.toLowerCase() }, { timeout });
  const locationText = (await page.locator(locationSelector).textContent()).trim();
  const marker = 'output/generated-products/';
  const markerIndex = locationText.indexOf(marker);
  assert(markerIndex >= 0, 'Saved-output confirmation does not contain the managed project path.', { locationText });
  const relativePath = locationText.slice(markerIndex).replaceAll('\\', '/');
  assert(relativePath.toLowerCase().endsWith(extension.toLowerCase()), 'Saved-output confirmation has the wrong extension.', { relativePath, extension });
  const sourcePath = path.resolve(ROOT, ...relativePath.split('/'));
  const relativeToRoot = path.relative(ROOT, sourcePath);
  assert(relativeToRoot && !relativeToRoot.startsWith('..' + path.sep) && relativeToRoot !== '..' && !path.isAbsolute(relativeToRoot), 'Saved output escaped the repository.', { sourcePath });
  const bytes = await fsp.readFile(sourcePath);
  assert(bytes.byteLength > 0, 'Saved project output is empty.', { sourcePath });
  const evidencePath = path.join(DOWNLOAD_ROOT, evidenceFilename);
  await fsp.writeFile(evidencePath, bytes, { flag: 'wx' });
  return {
    path: sourcePath,
    projectRelativePath: relativePath,
    evidencePath: relativeEvidence(evidencePath),
    suggestedFilename: path.basename(sourcePath),
    bytes,
    size: bytes.byteLength,
    sha256: sha256(bytes),
  };
}

async function downloadTo(page, trigger, evidenceFilename, timeout = 30000) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout }),
    trigger(),
  ]);
  const evidencePath = path.join(DOWNLOAD_ROOT, evidenceFilename);
  await download.saveAs(evidencePath);
  const bytes = await fsp.readFile(evidencePath);
  assert(bytes.byteLength > 0, 'Browser download is empty.', { evidenceFilename });
  return {
    path: evidencePath,
    evidencePath: relativeEvidence(evidencePath),
    suggestedFilename: download.suggestedFilename(),
    bytes,
    size: bytes.byteLength,
    sha256: sha256(bytes),
  };
}

async function auditDocument(page) {
  return page.evaluate(() => {
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 &&
        rect.width > 0 && rect.height > 0 && !element.closest('[hidden]');
    };
    const nameOf = element => {
      const labelledBy = element.getAttribute('aria-labelledby');
      const labelledText = labelledBy
        ? labelledBy.split(/\s+/u).map(id => document.getElementById(id)?.textContent || '').join(' ').trim()
        : '';
      const nativeLabelText = element.labels
        ? [...element.labels].map(label => label.textContent || '').join(' ').trim()
        : '';
      return (
        element.getAttribute('aria-label') ||
        labelledText ||
        nativeLabelText ||
        element.getAttribute('title') ||
        element.getAttribute('alt') ||
        element.textContent ||
        element.getAttribute('value') ||
        ''
      ).trim();
    };
    const parseColor = value => {
      const match = String(value).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/iu);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null;
    };
    const channel = value => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    const luminance = color => 0.2126 * channel(color[0]) + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2]);
    const effectiveBackground = element => {
      let current = element;
      while (current) {
        const parsed = parseColor(getComputedStyle(current).backgroundColor);
        if (parsed && parsed[3] > 0.95) return parsed;
        current = current.parentElement;
      }
      return [255, 255, 255, 1];
    };
    const duplicateIds = Object.entries(
      [...document.querySelectorAll('[id]')].reduce((result, element) => {
        result[element.id] = (result[element.id] || 0) + 1;
        return result;
      }, {}),
    ).filter(([, count]) => count > 1).map(([id, count]) => ({ id, count }));
    const controls = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')];
    const unlabeledControls = controls.filter(element => {
      return !(element.labels && element.labels.length) &&
        !element.getAttribute('aria-label') &&
        !element.getAttribute('aria-labelledby') &&
        !element.getAttribute('title');
    }).map(element => ({ tag: element.tagName.toLowerCase(), id: element.id, type: element.type || null }));
    const interactive = [...new Set(document.querySelectorAll(
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="radio"]',
    ))].filter(visible);
    const namelessInteractive = interactive.filter(element => !nameOf(element)).map(element => ({
      tag: element.tagName.toLowerCase(),
      id: element.id,
      role: element.getAttribute('role'),
    }));
    const touchViolations = interactive.map(element => {
      const target = /^(?:checkbox|radio)$/u.test(element.type || '') && element.closest('label') ? element.closest('label') : element;
      const rect = target.getBoundingClientRect();
      return {
        id: element.id || null,
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role'),
        name: nameOf(element).slice(0, 80),
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
      };
    }).filter(item => item.width < 44 || item.height < 44);
    const contrastViolations = [...document.querySelectorAll('body *')].filter(element => {
      if (!visible(element) || element.matches('script, style, svg, path') || element.closest('[aria-hidden="true"]')) return false;
      if ('disabled' in element && element.disabled) return false;
      return [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    }).map(element => {
      const style = getComputedStyle(element);
      const foreground = parseColor(style.color);
      const background = effectiveBackground(element);
      if (!foreground || foreground[3] < 0.95) return null;
      const left = luminance(foreground);
      const right = luminance(background);
      const ratio = (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
      const fontSize = Number.parseFloat(style.fontSize);
      const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
      const large = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const threshold = large ? 3 : 4.5;
      return ratio + 0.01 < threshold ? {
        tag: element.tagName.toLowerCase(),
        id: element.id || null,
        className: typeof element.className === 'string' ? element.className.slice(0, 100) : '',
        text: element.textContent.trim().replace(/\s+/gu, ' ').slice(0, 100),
        foreground: style.color,
        background: 'rgb(' + background.slice(0, 3).join(', ') + ')',
        ratio: Math.round(ratio * 100) / 100,
        required: threshold,
      } : null;
    }).filter(Boolean);
    const root = document.documentElement;
    const overflow = {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      excessPixels: Math.max(0, root.scrollWidth - root.clientWidth),
    };
    if (overflow.excessPixels > 1) {
      overflow.offenders = [...document.querySelectorAll('body *')].filter(visible).map(element => {
        const rect = element.getBoundingClientRect();
        return { element, rect };
      }).filter(item => item.rect.right > root.clientWidth + 1 || item.rect.left < -1).slice(0, 20).map(item => ({
        tag: item.element.tagName.toLowerCase(),
        id: item.element.id || null,
        className: typeof item.element.className === 'string' ? item.element.className.slice(0, 100) : '',
        left: Math.round(item.rect.left),
        right: Math.round(item.rect.right),
      }));
    }
    return {
      duplicateIds,
      unlabeledControls,
      namelessInteractive,
      touchViolations,
      contrastViolations,
      overflow,
      visibleInteractiveCount: interactive.length,
      controlCount: controls.length,
    };
  });
}

async function validateWorkbook(bytes, ExcelJS, JSZip) {
  const ooxml = await JSZip.loadAsync(bytes);
  const ooxmlPaths = Object.keys(ooxml.files).filter(entry => !ooxml.files[entry].dir);
  for (const requiredPath of REQUIRED_XLSX_PATHS) {
    assert(ooxml.file(requiredPath), 'XLSX is missing required OOXML entry.', { requiredPath });
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  assert(workbook.worksheets.length >= 2, 'Generated workbook has too few worksheets.', {
    worksheets: workbook.worksheets.map(sheet => sheet.name),
  });
  const sheetNames = workbook.worksheets.map(sheet => sheet.name);
  assert(new Set(sheetNames).size === sheetNames.length, 'Generated workbook has duplicate worksheet names.', { sheetNames });
  let formulaCount = 0;
  const invalidFormulas = [];
  workbook.eachSheet(sheet => {
    sheet.eachRow({ includeEmpty: false }, row => {
      row.eachCell({ includeEmpty: false }, cell => {
        const formula = cell.value && typeof cell.value === 'object' ? cell.value.formula : null;
        if (formula) {
          formulaCount += 1;
          if (/#REF!|#NAME\?|#VALUE!/iu.test(formula)) {
            invalidFormulas.push({ sheet: sheet.name, address: cell.address, formula });
          }
        }
      });
    });
  });
  assert(formulaCount > 0, 'Generated workbook contains no formulas.');
  assert(invalidFormulas.length === 0, 'Generated workbook contains invalid formula tokens.', { invalidFormulas });
  return { sheetNames, formulaCount, ooxmlEntryCount: ooxmlPaths.length };
}

async function validatePackage(packageBytes, workbookBytes, JSZip, validateContract, inspectPngArtifact) {
  const archive = await JSZip.loadAsync(packageBytes);
  const entryPaths = Object.keys(archive.files);
  const files = entryPaths.filter(entry => !archive.files[entry].dir);
  assert(entryPaths.length === files.length, 'Package contains unexpected directory entries.', {
    directories: entryPaths.filter(entry => archive.files[entry].dir),
  });
  assert(files.every(isSafeArchivePath), 'Package contains an unsafe ZIP path.', {
    unsafe: files.filter(entry => !isSafeArchivePath(entry)),
  });
  for (const requiredPath of REQUIRED_PACKAGE_PATHS) {
    assert(archive.file(requiredPath), 'Package is missing a required entry.', { requiredPath });
  }
  const workbookPaths = files.filter(entry => /^product\/.+\.xlsx$/iu.test(entry));
  assert(workbookPaths.length === 1, 'Package must contain exactly one product workbook.', { workbookPaths });
  const packagedWorkbook = Buffer.from(await archive.file(workbookPaths[0]).async('uint8array'));
  assert(packagedWorkbook.equals(workbookBytes), 'Packaged workbook bytes differ from the direct XLSX download.', {
    directSha256: sha256(workbookBytes),
    packagedSha256: sha256(packagedWorkbook),
  });
  const contractFiles = [
    ['ValidationReport', 'qa/validation-report.json'],
    ['QualityReport', 'qa/quality-report.json'],
    ['CompatibilityReport', 'qa/compatibility-report.json'],
    ['ImageProductionManifest', 'images/image-production-manifest.json'],
    ['GeneratedProductManifest', 'qa/generated-product-manifest.json'],
    ['ReleaseManifest', 'qa/release-manifest.json'],
  ];
  const contracts = {};
  for (const [contractName, entryPath] of contractFiles) {
    const value = JSON.parse(await archive.file(entryPath).async('string'));
    const validation = validateContract(contractName, value, { unknownFields: 'reject' });
    assert(validation.valid, 'ZIP contract validation failed.', {
      contractName,
      entryPath,
      issues: validation.issues.slice(0, 20),
    });
    contracts[contractName] = value;
  }
  const generated = contracts.GeneratedProductManifest;
  const payloadPaths = files.filter(entry => !MANIFEST_ONLY_PATHS.has(entry)).sort();
  const manifestPaths = generated.files.map(record => record.path);
  assert(new Set(manifestPaths).size === manifestPaths.length, 'Generated manifest contains duplicate file records.');
  assert(JSON.stringify([...manifestPaths].sort()) === JSON.stringify(payloadPaths), 'Manifest paths differ from ZIP payload paths.', {
    manifestPaths: [...manifestPaths].sort(),
    payloadPaths,
  });
  assert(JSON.stringify(Object.keys(generated.checksums).sort()) === JSON.stringify(payloadPaths), 'Checksum index differs from ZIP payload paths.', {
    checksumPaths: Object.keys(generated.checksums).sort(),
    payloadPaths,
  });
  for (const record of generated.files) {
    assert(isSafeArchivePath(record.path), 'Manifest references an unsafe path.', { path: record.path });
    const entry = archive.file(record.path);
    assert(entry, 'Manifest references a missing ZIP entry.', { path: record.path });
    const bytes = Buffer.from(await entry.async('uint8array'));
    const digest = sha256(bytes);
    assert(bytes.byteLength === record.bytes, 'Manifest byte count mismatch.', {
      path: record.path,
      expected: record.bytes,
      actual: bytes.byteLength,
    });
    assert(digest === record.sha256 && digest === generated.checksums[record.path], 'Manifest checksum mismatch.', {
      path: record.path,
      expected: record.sha256,
      indexed: generated.checksums[record.path],
      actual: digest,
    });
  }
  const imageManifest = contracts.ImageProductionManifest;
  const imageManifestPaths = imageManifest.assets.map(asset => asset.packagePath);
  assert(JSON.stringify(imageManifestPaths) === JSON.stringify(REQUIRED_LISTING_IMAGE_PATHS), 'Image manifest paths differ from the required Etsy image set.', { imageManifestPaths });
  assert(imageManifest.extensions?.productionPolicy?.executionClaim === 'GENERATED_AND_VALIDATED_IMAGE_ASSETS', 'Image manifest does not claim generated and validated physical assets.');
  assert(JSON.stringify(imageManifest.extensions?.assetPaths) === JSON.stringify(REQUIRED_LISTING_IMAGE_PATHS), 'Image manifest asset index differs from the required Etsy image set.');
  assert(imageManifest.extensions?.workbookSha256 === sha256(workbookBytes), 'Image manifest is not bound to the packaged workbook bytes.');
  assert(imageManifest.extensions?.validation?.status === 'PASS' && imageManifest.extensions.validation.imageCount === REQUIRED_LISTING_IMAGE_PATHS.length, 'Image manifest fail-closed validation is not PASS.');
  const imageDigests = new Set();
  const imageDimensions = new Set();
  const imageValidation = [];
  for (const imagePath of REQUIRED_LISTING_IMAGE_PATHS) {
    const imageBytes = Buffer.from(await archive.file(imagePath).async('uint8array'));
    const inspection = inspectPngArtifact(imageBytes);
    const record = generated.files.find(candidate => candidate.path === imagePath);
    const asset = imageManifest.assets.find(candidate => candidate.packagePath === imagePath);
    assert(record?.mediaType === 'image/png' && record?.role === 'image', 'Generated manifest has invalid PNG media metadata.', { imagePath, record });
    assert(asset?.mediaType === 'image/png' && String(asset?.status).toLowerCase() === 'validated', 'Image manifest asset is not validated PNG evidence.', { imagePath, asset });
    assert(asset.bytes === imageBytes.byteLength && inspection.width === asset.width && inspection.height === asset.height, 'Image manifest dimensions or byte count differ from the physical PNG.', { imagePath, asset, inspection });
    assert(asset.locale === imageManifest.locale && asset.theme === imageManifest.theme, 'Image manifest asset locale or theme metadata is mixed.', { imagePath, asset });
    assert(asset.tier === imageManifest.extensions?.tier && asset.appearance === imageManifest.extensions?.appearance, 'Image manifest asset tier or appearance metadata is mixed.', { imagePath, asset });
    assert(typeof asset.renderSource === 'string' && asset.renderSource.length > 0, 'Image manifest asset has no render source.', { imagePath, asset });
    assert(!imageDigests.has(inspection.sha256), 'Listing images contain duplicate physical bytes.', { imagePath, sha256: inspection.sha256 });
    imageDigests.add(inspection.sha256);
    imageDimensions.add(`${inspection.width}x${inspection.height}`);
    imageValidation.push({ path: imagePath, ...inspection });
  }
  assert(imageDimensions.size === 1, 'Listing images do not use one consistent aspect ratio.', { dimensions: [...imageDimensions] });
  const rootManifest = JSON.parse(await archive.file('manifest.json').async('string'));
  assert(rootManifest && typeof rootManifest === 'object' && !Array.isArray(rootManifest), 'Root manifest.json is not a JSON object.');
  assert(rootManifest.status === 'VALIDATED_PACKAGE_INDEX' && rootManifest.productId === imageManifest.productId, 'Root manifest product or status differs from image evidence.', { rootManifest });
  assert(rootManifest.locale === imageManifest.locale && rootManifest.theme === imageManifest.theme, 'Root manifest locale or theme differs from image evidence.', { rootManifest });
  assert(rootManifest.tier === imageManifest.extensions?.tier && rootManifest.appearance === imageManifest.extensions?.appearance, 'Root manifest tier or appearance differs from image evidence.', { rootManifest });
  assert(rootManifest.workbook?.path === workbookPaths[0], 'Root manifest workbook path differs from the physical workbook.', { rootManifest, workbookPath: workbookPaths[0] });
  assert(rootManifest.workbook.bytes === workbookBytes.byteLength && rootManifest.workbook.sha256 === sha256(workbookBytes), 'Root manifest workbook byte or checksum evidence differs from the physical workbook.', { rootManifest: rootManifest.workbook });
  assert(rootManifest.imageValidation?.status === 'PASS' && rootManifest.imageValidation.imageCount === REQUIRED_LISTING_IMAGE_PATHS.length, 'Root manifest image validation is not PASS.', { imageValidation: rootManifest.imageValidation });
  assert(JSON.stringify(rootManifest.listingImages?.map(image => image.path)) === JSON.stringify(REQUIRED_LISTING_IMAGE_PATHS), 'Root manifest image paths differ from the physical Etsy set.');
  const requiredRootPaths = REQUIRED_PACKAGE_PATHS.filter(requiredPath => !['listing/listing-metadata.json', 'images/image-production-manifest.json'].includes(requiredPath));
  assert(requiredRootPaths.every(requiredPath => rootManifest.requiredPaths?.includes(requiredPath)), 'Root manifest required-path index is incomplete.', { requiredRootPaths, actual: rootManifest.requiredPaths });
  return {
    entryCount: files.length,
    workbookPath: workbookPaths[0],
    payloadCount: payloadPaths.length,
    contractStatuses: Object.fromEntries(contractFiles.map(([name]) => [name, contracts[name].status || 'VALID'])),
    releaseStatus: contracts.ReleaseManifest.status,
    listingImages: imageValidation,
  };
}

async function validateImagesArchive(bytes, JSZip, inspectPngArtifact) {
  const archive = await JSZip.loadAsync(bytes);
  const paths = Object.keys(archive.files).filter(entry => !archive.files[entry].dir).sort();
  assert(JSON.stringify(paths) === JSON.stringify([...REQUIRED_LISTING_IMAGE_PATHS].sort()), 'Etsy image archive path set is incomplete or unexpected.', { paths });
  const digests = new Set();
  const images = [];
  for (const imagePath of REQUIRED_LISTING_IMAGE_PATHS) {
    const imageBytes = await archive.file(imagePath).async('uint8array');
    const inspection = inspectPngArtifact(imageBytes);
    assert(!digests.has(inspection.sha256), 'Etsy image archive contains duplicate PNG bytes.', { imagePath });
    digests.add(inspection.sha256);
    images.push({ path: imagePath, ...inspection });
  }
  return { entryCount: paths.length, images };
}

async function validateBatchArchive(bytes, JSZip) {
  const archive = await JSZip.loadAsync(bytes);
  const paths = Object.keys(archive.files).filter(entry => !archive.files[entry].dir);
  assert(paths.length >= 2, 'Batch archive contains fewer than two files.', { paths });
  assert(paths.every(isSafeArchivePath), 'Batch archive contains an unsafe path.', {
    unsafe: paths.filter(entry => !isSafeArchivePath(entry)),
  });
  assert(paths.some(entry => entry.endsWith('.xlsx')), 'Batch archive contains no workbook.', { paths });
  assert(paths.some(entry => entry.endsWith('.zip')), 'Batch archive contains no commercial package.', { paths });
  for (const entryPath of paths) {
    const entry = await archive.file(entryPath).async('uint8array');
    assert(entry.byteLength > 0, 'Batch archive contains an empty entry.', { entryPath });
  }
  return { entryCount: paths.length, paths };
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(error.message + '\n');
    printHelp();
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.confirmed) {
    process.stderr.write('Run blocked: localization readiness was not confirmed. Pass --localization-ready.\n');
    process.exitCode = 2;
    return;
  }

  await prepareEvidenceDirectory();
  const report = {
    schemaVersion: '1.0.0',
    title: 'Finance Product Factory production browser E2E evidence',
    startedAt: new Date().toISOString(),
    updatedAt: null,
    finishedAt: null,
    status: 'RUNNING',
    command: 'node scripts/run-production-e2e.cjs --localization-ready',
    environment: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      nodePathConfigured: Boolean(process.env.NODE_PATH),
      headless: true,
      browser: 'chromium',
      budgets: BUDGETS,
      viewports: {
        desktop: { width: 1440, height: 900 },
        mobile: { width: 390, height: 844 },
      },
    },
    gates: [],
    timings: {},
    artifacts: [],
    telemetry: {},
    summary: null,
  };
  await writeReport(report);

  let browser;
  let server;
  let desktopContext;
  let page;
  let serverOutput = '';
  try {
    const playwrightPath = resolveRuntimeDependency('playwright');
    const playwright = require(playwrightPath);
    const ExcelJS = require(path.join(ROOT, 'node_modules', 'exceljs'));
    const JSZip = require(path.join(ROOT, 'node_modules', 'jszip'));
    const contracts = await import(pathToFileURL(path.join(ROOT, 'src', 'contracts', 'index.js')).href);
    const locales = await import(pathToFileURL(path.join(ROOT, 'src', 'locales', 'index.mjs')).href);
    const releaseValidation = await import(pathToFileURL(path.join(ROOT, 'scripts', 'validate-production-matrix.mjs')).href);
    report.environment.playwrightPath = playwrightPath;
    report.environment.playwrightVersion = require(path.join(path.dirname(playwrightPath), 'package.json')).version;
    const bundledChromium = playwright.chromium.executablePath();
    const browserCandidates = [
      process.env.FPF_BROWSER_EXECUTABLE,
      bundledChromium,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ].filter(Boolean);
    report.environment.chromiumExecutable = browserCandidates.find(candidate => fs.existsSync(candidate)) ?? bundledChromium;
    report.environment.chromiumSource = report.environment.chromiumExecutable === bundledChromium ? 'playwright-bundled' : 'installed-system-browser';
    assert(fs.existsSync(report.environment.chromiumExecutable), 'Chromium executable does not exist.', {
      executable: report.environment.chromiumExecutable,
    });

    server = await startStaticServer();
    report.environment.server = { host: '127.0.0.1', port: server.port, appPath: APP_PATH };
    const telemetry = createTelemetry(server.baseUrl);
    browser = await playwright.chromium.launch({ headless: true, executablePath: report.environment.chromiumExecutable });
    report.environment.browserVersion = browser.version();
    desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      acceptDownloads: true,
      locale: 'nl-NL',
      colorScheme: 'light',
    });
    page = await desktopContext.newPage();
    const unexpectedBrowserDownloads = [];
    page.on('download', download => unexpectedBrowserDownloads.push(download.suggestedFilename()));
    page.setDefaultTimeout(15000);
    attachTelemetry(page, telemetry, 'desktop');

    await runGate(report, 'desktop-load', 'Desktop runtime loads at 1440x900 within budget', async () => {
      const loadMs = await waitForRuntime(page, server.baseUrl);
      report.timings.desktopLoadMs = loadMs;
      assert(loadMs <= BUDGETS.loadMs, 'Desktop load exceeded timing budget.', {
        actualMs: loadMs,
        budgetMs: BUDGETS.loadMs,
      });
      const viewport = page.viewportSize();
      assert(viewport && viewport.width === 1440 && viewport.height === 900, 'Desktop viewport is incorrect.', { viewport });
      const shot = await screenshot(page, 'desktop-1440x900-initial', true);
      return { loadMs, budgetMs: BUDGETS.loadMs, viewport, screenshot: shot };
    }, page);

    await runGate(report, 'product-catalog', 'Exactly seven active products, six release candidates and zero unapproved beta products', async () => {
      const radios = page.locator('#productCatalog [role="radio"][data-product-id]');
      const ids = await radios.evaluateAll(nodes => nodes.map(node => node.dataset.productId));
      assert(ids.length === VISIBLE_PRODUCT_IDS.length, 'Visible product-card count differs from the release catalog.', { ids });
      assert(JSON.stringify([...ids].sort()) === JSON.stringify([...VISIBLE_PRODUCT_IDS].sort()), 'Visible product IDs differ from the active and release-candidate set.', { ids });
      const betaVisible = ids.filter(id => BETA_PRODUCT_IDS.includes(id));
      assert(betaVisible.length === 0, 'Beta products are visible in the production catalog.', { betaVisible });
      const semantics = await page.locator('#productCatalog').evaluate(element => ({
        role: element.getAttribute('role'),
        checked: [...element.querySelectorAll('[role="radio"]')].filter(node => node.getAttribute('aria-checked') === 'true').length,
      }));
      assert(semantics.role === 'radiogroup' && semantics.checked === 1, 'Product catalog radiogroup semantics are invalid.', semantics);
      return { activeProductIds: ids, visibleBetaCount: betaVisible.length, semantics };
    }, page);

    await runGate(report, 'steps-and-keyboard', 'All twelve steps, composite keyboard navigation, dialogs and focus are reachable', async () => {
      const stepButtons = page.locator('#stepNavigation button');
      assert(await stepButtons.count() === 12, 'Step navigation does not contain exactly twelve buttons.', {
        count: await stepButtons.count(),
      });
      const stepTimings = [];
      const stepScreenshots = [];
      for (let step = 1; step <= 12; step += 1) {
        const durationMs = await navigateToStep(page, step);
        stepTimings.push({ step, durationMs });
        assert(durationMs <= BUDGETS.navigationMs, 'Step navigation exceeded timing budget.', {
          step,
          actualMs: durationMs,
          budgetMs: BUDGETS.navigationMs,
        });
        stepScreenshots.push({
          step,
          screenshot: await screenshot(page, `step-${String(step).padStart(2, '0')}-${STEP_SCREENSHOT_NAMES[step - 1]}`, true),
        });
      }
      report.timings.stepNavigation = stepTimings;
      await navigateToStep(page, 1);
      const firstProduct = page.locator('#productCatalog [role="radio"][data-product-id]').first();
      await firstProduct.click();
      await firstProduct.press('ArrowRight');
      const productKeyboard = await page.evaluate(() => ({
        focused: document.activeElement?.dataset?.productId || null,
        selected: document.querySelector('#productCatalog [role="radio"][aria-checked="true"]')?.dataset?.productId || null,
      }));
      assert(productKeyboard.focused && productKeyboard.focused === productKeyboard.selected, 'Product radiogroup arrow navigation did not move focus and selection together.', productKeyboard);
      await page.locator('#productCatalog [role="radio"][data-product-id="budget-planner-basic"]').click();
      await navigateToStep(page, 6);
      const selectedTheme = page.locator('#themeGrid [role="radio"][aria-checked="true"]');
      await selectedTheme.press('ArrowRight');
      const themeKeyboard = await page.evaluate(() => ({
        focused: document.activeElement?.dataset?.themeId || null,
        selected: document.querySelector('#themeGrid [role="radio"][aria-checked="true"]')?.dataset?.themeId || null,
      }));
      assert(themeKeyboard.focused && themeKeyboard.focused === themeKeyboard.selected, 'Theme radiogroup arrow navigation did not move focus and selection together.', themeKeyboard);
      await page.locator('#themeGrid [role="radio"][data-theme-id="sage-finance"]').click();
      await navigateToStep(page, 7);
      const previewStart = performance.now();
      await page.locator('#refreshPreview').click();
      await page.locator('#workbookPreview [role="tab"]').first().waitFor({ state: 'visible' });
      const previewMs = roundMs(performance.now() - previewStart);
      report.timings.previewMs = previewMs;
      assert(previewMs <= BUDGETS.previewMs, 'Workbook preview exceeded timing budget.', {
        actualMs: previewMs,
        budgetMs: BUDGETS.previewMs,
      });
      const firstTab = page.locator('#workbookPreview [role="tab"]').first();
      await firstTab.focus();
      await firstTab.press('ArrowRight');
      const tabKeyboard = await page.evaluate(() => ({
        focusedId: document.activeElement?.id || null,
        selectedId: document.querySelector('#workbookPreview [role="tab"][aria-selected="true"]')?.id || null,
        panelLabelledBy: document.querySelector('#preview-sheet-panel')?.getAttribute('aria-labelledby') || null,
      }));
      assert(tabKeyboard.focusedId && tabKeyboard.focusedId === tabKeyboard.selectedId, 'Preview tabs did not move focus and selection together.', tabKeyboard);
      assert(tabKeyboard.panelLabelledBy === tabKeyboard.selectedId, 'Preview tabpanel is not labelled by the selected tab.', tabKeyboard);
      await page.locator('#openBatch').click();
      await page.locator('#batchDialog').waitFor({ state: 'visible' });
      const modalFocus = await page.evaluate(() => ({
        open: document.getElementById('batchDialog').open,
        focusInside: document.getElementById('batchDialog').contains(document.activeElement),
      }));
      assert(modalFocus.open && modalFocus.focusInside, 'Batch dialog did not open with focus inside.', modalFocus);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('batchDialog').open);
      const shot = await screenshot(page, 'keyboard-tabs-and-focus', true);
      return { stepTimings, stepScreenshots, previewMs, productKeyboard, themeKeyboard, tabKeyboard, modalFocus, screenshot: shot };
    }, page);

    await runGate(report, 'localization', 'Generator UI stays Dutch while product locale switches across the exact production set', async () => {
      await navigateToStep(page, 3);
      const keys = [
        'ui.shell.batchMode',
        'ui.shell.management',
        'ui.panel.productCatalog',
        'ui.filter.search',
        'ui.filter.sort',
        'ui.common.previous',
        'ui.label.productLanguage',
      ];
      const expected = Object.fromEntries(keys.map(key => [key, locales.localeCatalog['nl-NL'].messages[key]]));
      assert(Object.values(expected).every(value => typeof value === 'string' && value.trim()), 'Dutch generator locale is missing a required visible translation.', { expected });
      const observations = [];
      for (const localeId of LOCALE_IDS) {
        await page.locator('#locale').selectOption(localeId);
        await page.waitForFunction(locale => document.getElementById('locale')?.value === locale, localeId);
        const actual = await page.evaluate(keysToRead => {
          return Object.fromEntries(keysToRead.map(key => {
            const node = document.querySelector('[data-i18n="' + key + '"]');
            return [key, node ? node.textContent.trim() : null];
          }));
        }, keys);
        assert(JSON.stringify(actual) === JSON.stringify(expected), 'Generator UI changed language with the selected product locale.', { localeId, expected, actual });
        const htmlLang = await page.locator('html').getAttribute('lang');
        assert(htmlLang === 'nl-NL', 'Generator html lang must remain nl-NL.', { localeId, htmlLang });
        const selectedProductLocale = await page.locator('#locale').inputValue();
        assert(selectedProductLocale === localeId, 'Product locale selection did not persist.', { localeId, selectedProductLocale });
        const shot = await screenshot(page, 'locale-' + localeId, true);
        observations.push({ localeId, selectedProductLocale, htmlLang, generatorMessages: actual, screenshot: shot });
      }
      await page.locator('#locale').selectOption('nl-NL');
      return { observations, generatorLocale: 'nl-NL', productLocales: LOCALE_IDS };
    }, page);

    await runGate(report, 'theme-previews', 'All six production theme previews are selectable and visually distinct', async () => {
      await navigateToStep(page, 6);
      const themes = page.locator('#themeGrid [role="radio"][data-theme-id]');
      const ids = await themes.evaluateAll(nodes => nodes.map(node => node.dataset.themeId));
      assert(JSON.stringify([...ids].sort()) === JSON.stringify([...THEME_IDS].sort()), 'Theme IDs differ from the production theme set.', { ids });
      const observations = [];
      for (const themeId of THEME_IDS) {
        const radio = page.locator('#themeGrid [role="radio"][data-theme-id="' + themeId + '"]');
        await radio.click();
        assert(await radio.getAttribute('aria-checked') === 'true', 'Theme selection was not reflected in aria-checked.', { themeId });
        const signature = await radio.locator('.theme-preview').evaluate(element => {
          const style = getComputedStyle(element);
          return ['--theme-bg', '--theme-primary', '--theme-accent', '--theme-muted'].map(name => style.getPropertyValue(name).trim()).join('|');
        });
        const shot = await screenshot(page, 'theme-preview-' + themeId, false);
        observations.push({ themeId, signature, screenshot: shot });
      }
      assert(new Set(observations.map(item => item.signature)).size === THEME_IDS.length, 'Theme preview color signatures are not all distinct.', { observations });
      await page.locator('#themeGrid [role="radio"][data-theme-id="sage-finance"]').click();
      return { observations };
    }, page);

    let generatedArtifacts;
    await runGate(report, 'real-generation-and-project-storage', 'Basic Light generates verified XLSX, sale ZIP and Etsy image ZIP directly in the managed project folder', async () => {
      await navigateToStep(page, 1);
      await page.locator('#productCatalog [role="radio"][data-product-id="budget-planner-basic"]').click();
      await navigateToStep(page, 3);
      await page.locator('#locale').selectOption('nl-NL');
      await page.locator('#currency').selectOption('EUR');
      await navigateToStep(page, 4);
      await page.locator('#inputCapacity').selectOption('50');
      await navigateToStep(page, 6);
      await page.locator('#themeGrid [role="radio"][data-theme-id="sage-finance"]').click();
      await navigateToStep(page, 8);
      await page.locator('#runValidation').click();
      await page.locator('#validationSummary[data-state="pass"]').waitFor({ state: 'visible' });
      const validationScreenshot = await screenshot(page, 'validation-report-pass', true);
      await navigateToStep(page, 9);
      const generationStart = performance.now();
      await page.locator('#generateProduct').click();
      await page.waitForFunction(() => {
        const progress = document.getElementById('generationProgress');
        const workbook = document.getElementById('downloadWorkbook');
        const packageButton = document.getElementById('downloadPackage');
        const imagesButton = document.getElementById('downloadImages');
        return progress?.getAttribute('aria-valuenow') === '100' && !workbook?.disabled && !packageButton?.disabled && !imagesButton?.disabled;
      }, null, { timeout: Math.max(60000, BUDGETS.generationMs * 2) });
      const generationMs = roundMs(performance.now() - generationStart);
      report.timings.generationMs = generationMs;
      assert(generationMs <= BUDGETS.generationMs, 'Browser generation exceeded timing budget.', {
        actualMs: generationMs,
        budgetMs: BUDGETS.generationMs,
      });
      const qualityScore = Number(await page.locator('#qualityScore').textContent());
      assert(Number.isFinite(qualityScore) && qualityScore > 0, 'Generation did not produce a numeric quality score.', { qualityScore });
      const generationScreenshot = await screenshot(page, 'generation-success', true);
      await navigateToStep(page, 10);
      const qualityScreenshot = await screenshot(page, 'quality-report-pass', true);
      await navigateToStep(page, 11);
      const listingImageCards = page.locator('#listingImageGrid .listing-image-card');
      assert(await listingImageCards.count() === REQUIRED_LISTING_IMAGE_PATHS.length, 'Generator result does not show exactly ten Etsy image thumbnails.', {
        count: await listingImageCards.count(),
      });
      const thumbnailEvidence = await listingImageCards.evaluateAll(cards => cards.map(card => ({
        filename: card.querySelector('strong')?.textContent?.trim() ?? null,
        status: card.dataset.state ?? null,
        width: Number(card.querySelector('img')?.getAttribute('width') ?? 0),
        height: Number(card.querySelector('img')?.getAttribute('height') ?? 0),
      })));
      assert(JSON.stringify(thumbnailEvidence.map(item => item.filename)) === JSON.stringify(REQUIRED_LISTING_IMAGE_PATHS.map(item => item.split('/').at(-1))), 'Generator thumbnail filenames differ from the required Etsy set.', { thumbnailEvidence });
      assert(thumbnailEvidence.every(item => item.status === 'validated' && item.width >= 2000 && item.width > item.height), 'Generator thumbnail resolution or validation status is invalid.', { thumbnailEvidence });
      const workbookDownload = await savedProjectOutput(page, {
        trigger: () => page.locator('#downloadWorkbook').click(),
        locationSelector: '#workbookOutputLocation',
        evidenceFilename: 'basic-workbook.xlsx',
        extension: '.xlsx',
        timeout: 30000,
      });
      const packageDownload = await savedProjectOutput(page, {
        trigger: () => page.locator('#downloadPackage').click(),
        locationSelector: '#packageOutputLocation',
        evidenceFilename: 'basic-commercial-package.zip',
        extension: '.zip',
        timeout: 30000,
      });
      const imagesDownload = await savedProjectOutput(page, {
        trigger: () => page.locator('#downloadImages').click(),
        locationSelector: '#imagesOutputLocation',
        evidenceFilename: 'basic-etsy-images.zip',
        extension: '.zip',
        timeout: 30000,
      });
      const workbook = await validateWorkbook(workbookDownload.bytes, ExcelJS, JSZip);
      const commercialPackage = await validatePackage(packageDownload.bytes, workbookDownload.bytes, JSZip, contracts.validateContract, releaseValidation.inspectPngArtifact);
      const imagesArchive = await validateImagesArchive(imagesDownload.bytes, JSZip, releaseValidation.inspectPngArtifact);
      assert(unexpectedBrowserDownloads.length === 0, 'Managed output unexpectedly fell back to the browser Downloads folder.', { unexpectedBrowserDownloads });
      const shot = await screenshot(page, 'basic-generation-complete', true);
      generatedArtifacts = { workbookDownload, packageDownload, imagesDownload, workbook, commercialPackage, imagesArchive };
      report.artifacts.push(
        { type: 'xlsx', path: workbookDownload.evidencePath, bytes: workbookDownload.size, sha256: workbookDownload.sha256 },
        { type: 'zip', path: packageDownload.evidencePath, bytes: packageDownload.size, sha256: packageDownload.sha256 },
        { type: 'etsy-images-zip', path: imagesDownload.evidencePath, bytes: imagesDownload.size, sha256: imagesDownload.sha256 },
      );
      return {
        generationMs,
        budgetMs: BUDGETS.generationMs,
        qualityScore,
        validationScreenshot,
        generationScreenshot,
        qualityScreenshot,
        workbook: {
          evidencePath: workbookDownload.evidencePath,
          suggestedFilename: workbookDownload.suggestedFilename,
          bytes: workbookDownload.size,
          sha256: workbookDownload.sha256,
          validation: workbook,
        },
        package: {
          evidencePath: packageDownload.evidencePath,
          suggestedFilename: packageDownload.suggestedFilename,
          bytes: packageDownload.size,
          sha256: packageDownload.sha256,
          validation: commercialPackage,
        },
        images: {
          evidencePath: imagesDownload.evidencePath,
          suggestedFilename: imagesDownload.suggestedFilename,
          bytes: imagesDownload.size,
          sha256: imagesDownload.sha256,
          validation: imagesArchive,
        },
        thumbnails: thumbnailEvidence,
        screenshot: shot,
      };
    }, page);

    await runGate(report, 'approval-decisions', 'Reject reason enforcement and both reject and approve receipts work', async () => {
      assert(generatedArtifacts, 'Approval path is unavailable because real generation did not complete.');
      await navigateToStep(page, 12);
      const rejected = page.locator('input[name="decision"][value="REJECTED"]');
      await rejected.check();
      await page.locator('#decisionReason').fill('');
      await page.locator('#saveDecision').click();
      const missingReason = await page.evaluate(() => ({
        focusedId: document.activeElement?.id || null,
        alert: document.querySelector('[role="alert"]')?.textContent?.trim() || null,
        receiptHidden: document.getElementById('decisionReceipt').hidden,
      }));
      assert(missingReason.focusedId === 'decisionReason' && missingReason.alert && missingReason.receiptHidden, 'Reject without reason was not blocked with focus and alert.', missingReason);
      const errorScreenshot = await screenshot(page, 'approval-rejection-reason-error', true);
      await page.locator('#decisionReason').fill('E2E rejection reason: controlled review path.');
      await page.locator('#saveDecision').click();
      const rejectReceipt = await page.locator('#decisionReceipt').textContent();
      assert(rejectReceipt && /controlled review path/iu.test(rejectReceipt), 'Reject receipt does not include the saved reason.', { rejectReceipt });
      const approved = page.locator('input[name="decision"][value="APPROVED"]');
      await approved.check();
      await page.locator('#decisionReason').fill('E2E approval after verified quality gates.');
      await page.locator('#saveDecision').click();
      const approveReceipt = await page.locator('#decisionReceipt').textContent();
      assert(approveReceipt && /verified quality gates/iu.test(approveReceipt), 'Approve receipt does not include the saved reason.', { approveReceipt });
      const shot = await screenshot(page, 'approval-approved-receipt', true);
      return { missingReason, rejectReceipt, approveReceipt, errorScreenshot, screenshot: shot };
    }, page);

    await runGate(report, 'batch-cancel-resume-archive', 'Batch production cancels, resumes and downloads a valid archive', async () => {
      await page.locator('#openBatch').click();
      await page.locator('#batchDialog').waitFor({ state: 'visible' });
      const productChecks = page.locator('#batchProducts input[type="checkbox"]');
      assert(await productChecks.count() === VISIBLE_PRODUCT_IDS.length, 'Batch dialog does not expose all visible release products.', {
        count: await productChecks.count(),
      });
      for (let index = 0; index < await productChecks.count(); index += 1) {
        const input = productChecks.nth(index);
        const productId = await input.getAttribute('value');
        if (BATCH_SMOKE_PRODUCT_IDS.includes(productId)) await input.check();
        else await input.uncheck();
      }
      const capacityChecks = page.locator('#batchCapacities input[type="checkbox"]');
      for (let index = 0; index < await capacityChecks.count(); index += 1) {
        const input = capacityChecks.nth(index);
        if (await input.getAttribute('value') === '50') await input.check();
        else await input.uncheck();
      }
      const runButton = page.locator('#runBatch');
      await runButton.click();
      await page.waitForFunction(() => {
        const button = document.getElementById('runBatch');
        return button && !button.disabled && !/start|resume|hervat|fortsetzen|reprendre|démarrer|starten/iu.test(button.textContent);
      });
      await runButton.click();
      const resumeLabels = LOCALE_IDS.map(localeId => locales.localeCatalog[localeId].messages['ui.batch.resume']);
      await page.waitForFunction(labels => labels.includes(document.getElementById('runBatch')?.textContent?.trim()), resumeLabels, { timeout: 60000 });
      const cancelledResult = (await page.locator('#batchResults').textContent()).trim();
      assert(cancelledResult, 'Batch cancellation produced no result status.');
      await runButton.click();
      const archiveButton = page.locator('#batchResults button');
      await archiveButton.waitFor({ state: 'visible', timeout: 180000 });
      const resumedResult = (await page.locator('#batchResults').textContent()).trim();
      const batchDownload = await savedProjectOutput(page, {
        trigger: () => archiveButton.click(),
        locationSelector: '#batchResults .batch-save-location',
        evidenceFilename: 'finance-product-factory-batch.zip',
        extension: '.zip',
        timeout: 30000,
      });
      assert(unexpectedBrowserDownloads.length === 0, 'Batch output unexpectedly fell back to the browser Downloads folder.', { unexpectedBrowserDownloads });
      const validation = await validateBatchArchive(batchDownload.bytes, JSZip);
      report.artifacts.push({ type: 'batch-zip', path: batchDownload.evidencePath, bytes: batchDownload.size, sha256: batchDownload.sha256 });
      const shot = await screenshot(page, 'batch-resumed-archive-ready', true);
      await page.locator('#batchDialog button[type="submit"][value="cancel"]').first().click();
      await page.waitForFunction(() => !document.getElementById('batchDialog').open);
      return {
        cancelledResult,
        resumedResult,
        archive: {
          evidencePath: batchDownload.evidencePath,
          bytes: batchDownload.size,
          sha256: batchDownload.sha256,
          validation,
        },
        screenshot: shot,
      };
    }, page);

    await runGate(report, 'accessibility-and-layout', 'Labels, IDs, names, touch targets, contrast and global overflow pass audits', async () => {
      const surfaceAudits = [];
      for (let step = 1; step <= 12; step += 1) {
        await navigateToStep(page, step);
        surfaceAudits.push({ surface: 'step-' + step, audit: await auditDocument(page) });
      }
      await page.locator('#openSettings').click();
      surfaceAudits.push({ surface: 'settings', audit: await auditDocument(page) });
      await page.locator('#closeSettings').click();
      await page.locator('#openBatch').click();
      await page.locator('#batchDialog').waitFor({ state: 'visible' });
      surfaceAudits.push({ surface: 'batch-dialog', audit: await auditDocument(page) });
      await page.locator('#batchDialog button[type="submit"][value="cancel"]').first().click();
      await page.waitForFunction(() => !document.getElementById('batchDialog').open);

      const collect = field => {
        const records = [];
        const byKey = new Map();
        for (const surfaceAudit of surfaceAudits) {
          for (const violation of surfaceAudit.audit[field]) {
            const key = JSON.stringify(violation);
            if (!byKey.has(key)) {
              const record = { ...violation, surfaces: [] };
              byKey.set(key, record);
              records.push(record);
            }
            byKey.get(key).surfaces.push(surfaceAudit.surface);
          }
        }
        return records;
      };
      const violations = {
        duplicateIds: collect('duplicateIds'),
        unlabeledControls: collect('unlabeledControls'),
        namelessInteractive: collect('namelessInteractive'),
        touchTargets: collect('touchViolations'),
        contrast: collect('contrastViolations'),
        horizontalOverflow: surfaceAudits.filter(item => item.audit.overflow.excessPixels > 1).map(item => ({
          surface: item.surface,
          ...item.audit.overflow,
        })),
      };
      const checks = {
        duplicateIds: violations.duplicateIds.length === 0,
        labels: violations.unlabeledControls.length === 0,
        accessibleNames: violations.namelessInteractive.length === 0,
        touchTargets44px: violations.touchTargets.length === 0,
        wcagTextContrast: violations.contrast.length === 0,
        horizontalOverflow: violations.horizontalOverflow.length === 0,
      };
      const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
      const shot = await screenshot(page, 'desktop-accessibility-layout-audit', true);
      if (failedChecks.length > 0) {
        throw new EvidenceError('Accessibility and layout audit failed: ' + failedChecks.join(', ') + '.', {
          checks,
          failedChecks,
          thresholds: { touchTargetCssPixels: 44, normalTextContrast: 4.5, largeTextContrast: 3, overflowToleranceCssPixels: 1 },
          violations,
          auditedSurfaces: surfaceAudits.map(item => ({
            surface: item.surface,
            interactiveCount: item.audit.visibleInteractiveCount,
            controlCount: item.audit.controlCount,
            overflow: item.audit.overflow,
          })),
          screenshot: shot,
        });
      }
      return {
        checks,
        thresholds: { touchTargetCssPixels: 44, normalTextContrast: 4.5, largeTextContrast: 3, overflowToleranceCssPixels: 1 },
        auditedSurfaces: surfaceAudits.map(item => item.surface),
        screenshot: shot,
      };
    }, page);

    await runGate(report, 'mobile-viewport', 'Mobile UI loads at 390x844 without beta products or horizontal overflow', async () => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        acceptDownloads: false,
        locale: 'nl-NL',
        colorScheme: 'light',
        isMobile: true,
        hasTouch: true,
      });
      const mobile = await context.newPage();
      mobile.setDefaultTimeout(15000);
      attachTelemetry(mobile, telemetry, 'mobile');
      try {
        const loadMs = await waitForRuntime(mobile, server.baseUrl);
        report.timings.mobileLoadMs = loadMs;
        assert(loadMs <= BUDGETS.loadMs, 'Mobile load exceeded timing budget.', {
          actualMs: loadMs,
          budgetMs: BUDGETS.loadMs,
        });
        const viewport = mobile.viewportSize();
        assert(viewport && viewport.width === 390 && viewport.height === 844, 'Mobile viewport is incorrect.', { viewport });
        const ids = await mobile.locator('#productCatalog [role="radio"][data-product-id]').evaluateAll(nodes => nodes.map(node => node.dataset.productId));
        assert(JSON.stringify([...ids].sort()) === JSON.stringify([...VISIBLE_PRODUCT_IDS].sort()), 'Mobile product set differs from the active and release-candidate products.', { ids });
        assert(ids.every(id => !BETA_PRODUCT_IDS.includes(id)), 'Mobile catalog exposes a beta product.', { ids });
        assert(await mobile.locator('#stepNavigation button').count() === 12, 'Mobile step navigation does not contain twelve steps.');
        const audit = await auditDocument(mobile);
        assert(audit.overflow.excessPixels <= 1, 'Mobile page has horizontal overflow.', audit.overflow);
        const shot = await screenshot(mobile, 'mobile-390x844', true);
        return { loadMs, budgetMs: BUDGETS.loadMs, viewport, activeProductIds: ids, overflow: audit.overflow, screenshot: shot };
      } finally {
        await context.close();
      }
    }, page);

    await runGate(report, 'reduced-motion', 'Reduced-motion preference disables meaningful animation and smooth scrolling', async () => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        locale: 'nl-NL',
        colorScheme: 'light',
        reducedMotion: 'reduce',
      });
      const reduced = await context.newPage();
      reduced.setDefaultTimeout(15000);
      attachTelemetry(reduced, telemetry, 'reduced-motion');
      try {
        await waitForRuntime(reduced, server.baseUrl);
        const observation = await reduced.evaluate(() => {
          const seconds = list => String(list).split(',').map(value => {
            const trimmed = value.trim();
            if (trimmed.endsWith('ms')) return Number.parseFloat(trimmed) / 1000;
            if (trimmed.endsWith('s')) return Number.parseFloat(trimmed);
            return 0;
          }).filter(Number.isFinite);
          let maxAnimationSeconds = 0;
          let maxTransitionSeconds = 0;
          const offenders = [];
          for (const element of document.querySelectorAll('body *')) {
            const style = getComputedStyle(element);
            const animation = Math.max(0, ...seconds(style.animationDuration));
            const transition = Math.max(0, ...seconds(style.transitionDuration));
            maxAnimationSeconds = Math.max(maxAnimationSeconds, animation);
            maxTransitionSeconds = Math.max(maxTransitionSeconds, transition);
            if (animation > 0.02 || transition > 0.02) {
              offenders.push({
                tag: element.tagName.toLowerCase(),
                id: element.id || null,
                className: typeof element.className === 'string' ? element.className.slice(0, 100) : '',
                animationSeconds: animation,
                transitionSeconds: transition,
              });
            }
          }
          return {
            mediaMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
            scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
            maxAnimationSeconds,
            maxTransitionSeconds,
            offenders: offenders.slice(0, 100),
          };
        });
        assert(observation.mediaMatches, 'Reduced-motion media query does not match.', observation);
        assert(observation.offenders.length === 0, 'Meaningful animation remains enabled under reduced motion.', observation);
        assert(observation.scrollBehavior === 'auto', 'Smooth scrolling remains enabled under reduced motion.', observation);
        const shot = await screenshot(reduced, 'reduced-motion', false);
        return { observation, screenshot: shot };
      } finally {
        await context.close();
      }
    }, page);

    await runGate(report, 'backup-recovery', 'Draft backup export, duplicate, import and confirmed reset recover state', async () => {
      await page.locator('#openSettings').click();
      await page.locator('#settingsPanel').waitFor({ state: 'visible' });
      const originalTitle = await page.locator('#productTitle').inputValue();
      const backupDownload = await downloadTo(page, () => page.locator('#exportDraft').click(), 'finance-product-factory-draft.json', 30000);
      const backup = JSON.parse(backupDownload.bytes.toString('utf8'));
      assert(backup && backup.configuration && backup.configuration.productId === 'budget-planner-basic', 'Exported draft does not contain the active Basic configuration.', {
        productId: backup && backup.configuration ? backup.configuration.productId : null,
      });
      await page.locator('#duplicateDraft').click();
      const duplicatedTitle = await page.locator('#productTitle').inputValue();
      assert(duplicatedTitle && duplicatedTitle !== originalTitle, 'Duplicate action did not create a distinct title.', {
        originalTitle,
        duplicatedTitle,
      });
      await page.locator('#importDraft').setInputFiles(backupDownload.path);
      await page.waitForFunction(title => document.getElementById('productTitle').value === title, originalTitle);
      const importedTitle = await page.locator('#productTitle').inputValue();
      assert(importedTitle === originalTitle, 'Imported backup did not restore the exported title.', {
        originalTitle,
        importedTitle,
      });
      report.artifacts.push({ type: 'draft-json', path: backupDownload.evidencePath, bytes: backupDownload.size, sha256: backupDownload.sha256 });
      const beforeReset = await screenshot(page, 'backup-import-restored', true);
      await page.locator('#resetDraft').click();
      await page.locator('#confirmDialog').waitFor({ state: 'visible' });
      const confirmFocus = await page.evaluate(() => ({
        open: document.getElementById('confirmDialog').open,
        focusInside: document.getElementById('confirmDialog').contains(document.activeElement),
      }));
      assert(confirmFocus.open && confirmFocus.focusInside, 'Reset confirmation dialog did not contain focus.', confirmFocus);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        page.locator('#confirmAction').click(),
      ]);
      await page.locator('#connectionStatus[data-state="ready"]').waitFor({ state: 'visible', timeout: 15000 });
      const afterResetProduct = await page.locator('#productCatalog [role="radio"][aria-checked="true"]').getAttribute('data-product-id');
      const afterResetTitle = await page.locator('#productTitle').inputValue();
      assert(afterResetProduct === 'budget-planner-basic', 'Reset did not restore the default Basic product.', { afterResetProduct });
      assert(afterResetTitle !== duplicatedTitle, 'Reset retained the duplicated title.', { duplicatedTitle, afterResetTitle });
      const afterReset = await screenshot(page, 'backup-reset-complete', true);
      return {
        backup: { evidencePath: backupDownload.evidencePath, bytes: backupDownload.size, sha256: backupDownload.sha256 },
        originalTitle,
        duplicatedTitle,
        importedTitle,
        confirmFocus,
        afterResetProduct,
        afterResetTitle,
        screenshots: [beforeReset, afterReset],
      };
    }, page);

    await runGate(report, 'runtime-errors-and-network', 'No console errors, page errors, external requests, request failures or HTTP errors occurred', async () => {
      report.telemetry = telemetry;
      assert(telemetry.consoleErrors.length === 0, 'Console errors occurred during E2E.', { errors: telemetry.consoleErrors });
      assert(telemetry.pageErrors.length === 0, 'Unhandled page errors occurred during E2E.', { errors: telemetry.pageErrors });
      assert(telemetry.externalRequests.length === 0, 'External network requests occurred during the offline application run.', { requests: telemetry.externalRequests });
      assert(telemetry.requestFailures.length === 0, 'Network requests failed during E2E.', { failures: telemetry.requestFailures });
      assert(telemetry.httpErrors.length === 0, 'HTTP error responses occurred during E2E.', { errors: telemetry.httpErrors });
      return {
        consoleErrors: 0,
        pageErrors: 0,
        externalRequests: 0,
        requestFailures: 0,
        httpErrors: 0,
      };
    }, page);
  } catch (error) {
    await runGate(report, 'environment', 'Runner environment and browser runtime are available', async () => {
      throw error instanceof EnvironmentBlockedError ? error : new EnvironmentBlockedError(error.message, {
        cause: serializeError(error),
      });
    }, page);
  } finally {
    if (desktopContext) await desktopContext.close().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
    if (server) {
      serverOutput = server.getOutput();
      await stopChild(server.child);
    }
    report.environment.serverOutput = serverOutput;
    report.finishedAt = new Date().toISOString();
    const counts = report.gates.reduce((result, gate) => {
      result[gate.status] = (result[gate.status] || 0) + 1;
      return result;
    }, { PASS: 0, FAIL: 0, BLOCKED: 0 });
    report.status = counts.BLOCKED > 0 ? 'BLOCKED' : counts.FAIL > 0 ? 'FAIL' : 'PASS';
    report.summary = { ...counts, total: report.gates.length };
    await writeReport(report);
    process.stdout.write('Evidence: ' + REPORT_PATH + '\n');
    process.stdout.write('Verdict: ' + report.status + ' (' + counts.PASS + ' PASS, ' + counts.FAIL + ' FAIL, ' + counts.BLOCKED + ' BLOCKED)\n');
    process.exitCode = report.status === 'PASS' ? 0 : report.status === 'BLOCKED' ? 2 : 1;
  }
}

if (require.main === module) {
  main().catch(async error => {
    process.stderr.write((error && error.stack ? error.stack : String(error)) + '\n');
    process.exitCode = 2;
  });
}
