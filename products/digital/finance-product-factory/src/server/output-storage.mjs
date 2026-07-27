import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import JSZip from 'jszip';

import { SECURITY_LIMITS, validateZipPath } from '../engines/security.js';

export const OUTPUT_STORAGE_LIMIT_BYTES = 75_000_000;
export const OUTPUT_ROOT_SEGMENTS = Object.freeze(['output', 'generated-products']);

const IDENTIFIER = /^[a-z0-9][a-z0-9-]{0,63}$/;
const LOCALE = /^[a-z]{2}-[A-Z]{2}$/;
const CURRENCY = /^[A-Z]{3}$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/;
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,79}$/;
const APPEARANCE = /^(?:light|dark)$/;
const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const EXTRACTABLE_ZIP_KINDS = new Set(['package', 'images', 'batch']);
const KINDS = Object.freeze({
  workbook: '.xlsx',
  document: '.docx',
  package: '.zip',
  images: '.zip',
  image: '.png',
  batch: '.zip',
});

function requireParameter(searchParams, name, expression) {
  const value = searchParams.get(name) ?? '';
  if (!expression.test(value)) throw new OutputStorageError(400, `Ongeldige parameter: ${name}.`);
  return value;
}

function validateFilename(value, expectedExtension) {
  if (!value || value.length > 120 || value !== basename(value)) {
    throw new OutputStorageError(400, 'Ongeldige bestandsnaam.');
  }
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(value) || /[. ]$/.test(value) || WINDOWS_DEVICE.test(value)) {
    throw new OutputStorageError(400, 'Onveilige bestandsnaam geweigerd.');
  }
  if (extname(value).toLowerCase() !== expectedExtension) {
    throw new OutputStorageError(400, `Verwacht bestandstype ${expectedExtension}.`);
  }
  return value;
}

function assertWithin(root, target) {
  const normalizedRoot = resolve(root);
  const normalizedTarget = resolve(target);
  if (normalizedTarget !== normalizedRoot && !normalizedTarget.startsWith(`${normalizedRoot}${sep}`)) {
    throw new OutputStorageError(403, 'Uitvoerpad valt buiten de toegestane projectmap.');
  }
  return normalizedTarget;
}

function assertZipContainer(bytes) {
  if (bytes.byteLength < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || ![0x03, 0x05, 0x07].includes(bytes[2])) {
    throw new OutputStorageError(400, 'Bestand is geen geldige ZIP/XLSX-container.');
  }
}

function outputRelativePath(projectRoot, absolutePath) {
  return relative(projectRoot, absolutePath).split(sep).join('/');
}

async function inspectExistingTarget(path, expectedType, errorMessage) {
  try {
    const existing = await lstat(path);
    const matches = expectedType === 'file' ? existing.isFile() : existing.isDirectory();
    if (existing.isSymbolicLink() || !matches) throw new OutputStorageError(403, errorMessage);
    return true;
  } catch (error) {
    if (error instanceof OutputStorageError) throw error;
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function unixEntryMode(entry) {
  if (typeof entry.unixPermissions === 'number') return entry.unixPermissions;
  if (typeof entry.unixPermissions === 'string' && /^[0-7]+$/.test(entry.unixPermissions)) {
    return Number.parseInt(entry.unixPermissions, 8);
  }
  return null;
}

function safeZipEntryPath(path, entry) {
  const original = String(entry.unsafeOriginalName ?? path);
  if (!original || original.includes('\\')) throw new OutputStorageError(400, 'ZIP bevat een onveilig intern pad.');
  const candidate = entry.dir ? original.replace(/\/+$/g, '') : original;
  try {
    return validateZipPath(candidate);
  } catch {
    throw new OutputStorageError(400, 'ZIP bevat een onveilig intern pad.');
  }
}

async function stageZipExtraction(bytes, stagingRoot, outputRoot) {
  let zip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new OutputStorageError(400, 'ZIP-container kan niet worden gelezen.');
  }

  const entries = Object.entries(zip.files);
  if (!entries.length || entries.length > SECURITY_LIMITS.zipEntries) {
    throw new OutputStorageError(400, `ZIP moet tussen 1 en ${SECURITY_LIMITS.zipEntries} onderdelen bevatten.`);
  }

  const planned = [];
  const caseInsensitivePaths = new Set();
  const directories = new Set();
  let declaredBytes = 0;
  for (const [path, entry] of entries) {
    const safePath = safeZipEntryPath(path, entry);
    const pathKey = safePath.toLocaleLowerCase('en-US');
    if (caseInsensitivePaths.has(pathKey)) {
      throw new OutputStorageError(400, 'ZIP bevat dubbele paden die op Windows conflicteren.');
    }
    caseInsensitivePaths.add(pathKey);

    const mode = unixEntryMode(entry);
    if (mode !== null && (mode & 0o170000) === 0o120000) {
      throw new OutputStorageError(400, 'Symbolische koppelingen in ZIP-bestanden zijn niet toegestaan.');
    }

    const uncompressedSize = Number(entry?._data?.uncompressedSize ?? 0);
    if (!entry.dir && (!Number.isSafeInteger(uncompressedSize) || uncompressedSize < 0)) {
      throw new OutputStorageError(400, 'ZIP bevat ongeldige grootte-informatie.');
    }
    declaredBytes += uncompressedSize;
    if (declaredBytes > SECURITY_LIMITS.zipUncompressedBytes) {
      throw new OutputStorageError(413, `Uitgepakte ZIP overschrijdt ${SECURITY_LIMITS.zipUncompressedBytes} bytes.`);
    }

    const target = assertWithin(stagingRoot, resolve(stagingRoot, ...safePath.split('/')));
    assertWithin(outputRoot, target);
    const segments = safePath.split('/');
    const directoryDepth = entry.dir ? segments.length : segments.length - 1;
    for (let index = 1; index <= directoryDepth; index += 1) directories.add(segments.slice(0, index).join('/'));
    planned.push({ entry, safePath, target });
  }

  await mkdir(stagingRoot, { recursive: false });
  let extractedBytes = 0;
  let fileCount = 0;
  try {
    for (const item of planned) {
      if (item.entry.dir) {
        await mkdir(item.target, { recursive: true });
        continue;
      }
      const fileBytes = await item.entry.async('uint8array');
      extractedBytes += fileBytes.byteLength;
      if (extractedBytes > SECURITY_LIMITS.zipUncompressedBytes) {
        throw new OutputStorageError(413, `Uitgepakte ZIP overschrijdt ${SECURITY_LIMITS.zipUncompressedBytes} bytes.`);
      }
      await mkdir(dirname(item.target), { recursive: true });
      await writeFile(item.target, fileBytes, { flag: 'wx' });
      fileCount += 1;
    }
    if (!fileCount) throw new OutputStorageError(400, 'ZIP bevat geen uitpakbare bestanden.');
    return Object.freeze({
      bytes: extractedBytes,
      directoryCount: directories.size,
      fileCount,
      status: 'EXTRACTED',
    });
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

async function replaceZipAndExtraction({
  archiveBytes,
  archiveTarget,
  archiveTemporary,
  extractionTarget,
  extractionTemporary,
  targetDirectory,
}) {
  const archiveExists = await inspectExistingTarget(archiveTarget, 'file', 'Onveilig bestaand ZIP-doel geweigerd.');
  const extractionExists = await inspectExistingTarget(extractionTarget, 'directory', 'Onveilige bestaande uitpakmap geweigerd.');
  const operationId = randomUUID();
  const archiveBackup = assertWithin(targetDirectory, resolve(targetDirectory, `.${basename(archiveTarget)}.previous-${operationId}`));
  const extractionBackup = assertWithin(targetDirectory, resolve(targetDirectory, `.${basename(extractionTarget)}.previous-${operationId}`));
  let archiveBackedUp = false;
  let extractionBackedUp = false;
  let archiveInstalled = false;
  let extractionInstalled = false;

  try {
    await writeFile(archiveTemporary, archiveBytes, { flag: 'wx' });
    if (archiveExists) {
      await rename(archiveTarget, archiveBackup);
      archiveBackedUp = true;
    }
    if (extractionExists) {
      await rename(extractionTarget, extractionBackup);
      extractionBackedUp = true;
    }
    await rename(archiveTemporary, archiveTarget);
    archiveInstalled = true;
    await rename(extractionTemporary, extractionTarget);
    extractionInstalled = true;
  } catch (error) {
    if (extractionInstalled) await rm(extractionTarget, { recursive: true, force: true });
    if (archiveInstalled) await rm(archiveTarget, { force: true });
    if (extractionBackedUp) await rename(extractionBackup, extractionTarget);
    if (archiveBackedUp) await rename(archiveBackup, archiveTarget);
    await rm(archiveTemporary, { force: true });
    await rm(extractionTemporary, { recursive: true, force: true });
    throw error;
  }

  await Promise.allSettled([
    archiveBackedUp ? rm(archiveBackup, { force: true }) : Promise.resolve(),
    extractionBackedUp ? rm(extractionBackup, { recursive: true, force: true }) : Promise.resolve(),
  ]);
}

function assertPngContainer(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.byteLength < 33 || signature.some((value, index) => bytes[index] !== value)) {
    throw new OutputStorageError(400, 'Bestand is geen geldige PNG-container.');
  }
  if (String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') {
    throw new OutputStorageError(400, 'PNG mist een geldige IHDR-header.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(16) < 1 || view.getUint32(20) < 1) {
    throw new OutputStorageError(400, 'PNG heeft ongeldige afmetingen.');
  }
}

async function assertDocxContainer(bytes) {
  assertZipContainer(bytes);
  let zip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new OutputStorageError(400, 'DOCX-container kan niet worden gelezen.');
  }
  const required = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels', 'word/styles.xml'];
  for (const path of required) if (!zip.file(path)) throw new OutputStorageError(400, `DOCX mist verplicht onderdeel: ${path}.`);
  for (const [path, entry] of Object.entries(zip.files)) {
    const original = entry.unsafeOriginalName ?? path;
    if (original.startsWith('/') || original.includes('\\') || original.split('/').some(segment => segment === '..' || segment === '.')) throw new OutputStorageError(400, 'DOCX bevat een onveilig intern pad.');
  }
  const relationshipParts = Object.keys(zip.files).filter(path => path.endsWith('.rels'));
  for (const path of relationshipParts) {
    const xml = await zip.file(path).async('string');
    if (/TargetMode="External"|Target="(?:file:|[A-Za-z]:[\\/]|\\\\|\/)/i.test(xml)) throw new OutputStorageError(400, 'DOCX bevat een externe of absolute relatie.');
  }
}

export class OutputStorageError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'OutputStorageError';
    this.statusCode = statusCode;
  }
}

export function assertKnownOutputMetadata(requestUrl, { products, locales, currencies, themes }) {
  if (requestUrl.searchParams.get('kind') === 'batch') return true;
  const productId = requestUrl.searchParams.get('productId') ?? '';
  const definition = products?.[productId];
  if (!definition) throw new OutputStorageError(400, 'Onbekend product geweigerd.');
  const version = requestUrl.searchParams.get('version') ?? '';
  const locale = requestUrl.searchParams.get('locale') ?? '';
  const currency = requestUrl.searchParams.get('currency') ?? '';
  const themeId = requestUrl.searchParams.get('themeId') ?? '';
  if (version !== definition.version) throw new OutputStorageError(409, 'Productversie komt niet overeen met de catalogus.');
  if (!locales?.[locale] || !definition.supportedLocales?.includes(locale)) throw new OutputStorageError(400, 'Onbekende producttaal geweigerd.');
  if (!currencies?.[currency] || !definition.supportedCurrencies?.includes(currency)) throw new OutputStorageError(400, 'Onbekende valuta geweigerd.');
  if (!themes?.[themeId] || !definition.supportedThemes?.includes(themeId)) throw new OutputStorageError(400, 'Onbekend productpalet geweigerd.');
  return true;
}

export function resolveOutputDestination(projectRoot, requestUrl) {
  const outputRoot = resolve(projectRoot, ...OUTPUT_ROOT_SEGMENTS);
  const kind = requestUrl.searchParams.get('kind') ?? '';
  const expectedExtension = KINDS[kind];
  if (!expectedExtension) throw new OutputStorageError(400, 'Onbekend uitvoertype.');
  const filename = validateFilename(requestUrl.searchParams.get('filename') ?? '', expectedExtension);

  let targetDirectory;
  if (kind === 'batch') {
    const runId = requireParameter(requestUrl.searchParams, 'runId', RUN_ID);
    targetDirectory = resolve(outputRoot, 'batches', runId);
  } else {
    const productId = requireParameter(requestUrl.searchParams, 'productId', IDENTIFIER);
    const locale = requireParameter(requestUrl.searchParams, 'locale', LOCALE);
    const currency = requireParameter(requestUrl.searchParams, 'currency', CURRENCY);
    const themeId = requireParameter(requestUrl.searchParams, 'themeId', IDENTIFIER);
    const version = requireParameter(requestUrl.searchParams, 'version', VERSION);
    const appearance = requestUrl.searchParams.has('appearance')
      ? requireParameter(requestUrl.searchParams, 'appearance', APPEARANCE)
      : 'light';
    const variantDirectory = resolve(outputRoot, productId, locale, currency, themeId, appearance, `v${version}`);
    targetDirectory = kind === 'image' ? resolve(variantDirectory, 'listing', 'images') : variantDirectory;
  }

  assertWithin(outputRoot, targetDirectory);
  const absolutePath = assertWithin(outputRoot, resolve(targetDirectory, filename));
  const relativePath = relative(projectRoot, absolutePath).split(sep).join('/');
  return Object.freeze({ absolutePath, filename, kind, outputRoot, relativePath, targetDirectory });
}

export async function readBoundedRequestBody(request, maximumBytes = OUTPUT_STORAGE_LIMIT_BYTES) {
  const declaredLength = Number(request.headers['content-length']);
  if (!Number.isFinite(declaredLength) || declaredLength < 1 || declaredLength > maximumBytes) {
    throw new OutputStorageError(413, `Bestand moet tussen 1 en ${maximumBytes} bytes groot zijn.`);
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.byteLength;
    if (total > maximumBytes) throw new OutputStorageError(413, `Bestand overschrijdt ${maximumBytes} bytes.`);
    chunks.push(chunk);
  }
  if (total !== declaredLength) throw new OutputStorageError(400, 'Onvolledige upload ontvangen.');
  return Buffer.concat(chunks, total);
}

export async function saveOutputBytes(projectRoot, requestUrl, bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > OUTPUT_STORAGE_LIMIT_BYTES) {
    throw new OutputStorageError(413, 'Ongeldige bestandsgrootte.');
  }
  const destination = resolveOutputDestination(projectRoot, requestUrl);
  if (destination.kind === 'image') assertPngContainer(bytes);
  else if (destination.kind === 'document') await assertDocxContainer(bytes);
  else assertZipContainer(bytes);
  await mkdir(destination.targetDirectory, { recursive: true });
  const canonicalProjectRoot = await realpath(resolve(projectRoot));
  const canonicalOutputRoot = await realpath(destination.outputRoot);
  const canonicalTargetDirectory = await realpath(destination.targetDirectory);
  assertWithin(canonicalProjectRoot, canonicalOutputRoot);
  assertWithin(canonicalOutputRoot, canonicalTargetDirectory);
  const canonicalTarget = assertWithin(canonicalOutputRoot, resolve(canonicalTargetDirectory, destination.filename));
  if (EXTRACTABLE_ZIP_KINDS.has(destination.kind)) {
    const operationId = randomUUID();
    const extractionName = basename(destination.filename, extname(destination.filename));
    const extractionTarget = assertWithin(canonicalTargetDirectory, resolve(canonicalTargetDirectory, extractionName));
    const extractionTemporary = assertWithin(canonicalTargetDirectory, resolve(canonicalTargetDirectory, `.${extractionName}.extract-${operationId}`));
    const archiveTemporary = assertWithin(canonicalTargetDirectory, resolve(canonicalTargetDirectory, `.${destination.filename}.upload-${operationId}`));
    const extraction = await stageZipExtraction(bytes, extractionTemporary, canonicalOutputRoot);
    try {
      await replaceZipAndExtraction({
        archiveBytes: bytes,
        archiveTarget: canonicalTarget,
        archiveTemporary,
        extractionTarget,
        extractionTemporary,
        targetDirectory: canonicalTargetDirectory,
      });
    } catch (error) {
      await rm(archiveTemporary, { force: true });
      await rm(extractionTemporary, { recursive: true, force: true });
      throw error;
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    return Object.freeze({
      absolutePath: canonicalTarget,
      bytes: bytes.byteLength,
      extracted: Object.freeze({
        ...extraction,
        absolutePath: extractionTarget,
        relativePath: outputRelativePath(canonicalProjectRoot, extractionTarget),
      }),
      filename: destination.filename,
      kind: destination.kind,
      relativePath: outputRelativePath(canonicalProjectRoot, canonicalTarget),
      sha256,
    });
  }
  try {
    const existing = await lstat(canonicalTarget);
    if (existing.isSymbolicLink() || !existing.isFile()) {
      throw new OutputStorageError(403, 'Onveilig bestaand uitvoerdoel geweigerd.');
    }
  } catch (error) {
    if (error instanceof OutputStorageError) throw error;
    if (error?.code !== 'ENOENT') throw error;
  }
  await writeFile(canonicalTarget, bytes, { flag: 'w' });
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return Object.freeze({
    absolutePath: canonicalTarget,
    bytes: bytes.byteLength,
    filename: destination.filename,
    kind: destination.kind,
    relativePath: destination.relativePath,
    sha256,
  });
}
