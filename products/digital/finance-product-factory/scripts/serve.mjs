import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OutputStorageError,
  assertKnownOutputMetadata,
  readBoundedRequestBody,
  saveOutputBytes,
} from '../src/server/output-storage.mjs';
import { currencyCatalog } from '../src/currencies/index.mjs';
import { localeCatalog } from '../src/locales/index.mjs';
import { productDefinitionById } from '../src/products/index.mjs';
import { themeCatalog } from '../src/themes/index.mjs';
import { startTutorialJob, testTutorialConnection, tutorialJobStatus } from '../src/server/tutorial-jobs.mjs';
import { saveSecureElevenLabsConfiguration, secureElevenLabsStatus } from '../src/server/secure-elevenlabs-settings.mjs';
import {
  NativeListingImageError,
  renderNativeListingImages,
} from '../src/server/native-listing-image-service.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const canonicalRoot = await realpath(root);
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const types = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.csv', 'text/csv; charset=utf-8'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['.zip', 'application/zip'],
]);

const securityHeaders = Object.freeze({
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
});

function json(response, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  response.writeHead(statusCode, {
    ...securityHeaders,
    'Cache-Control': 'no-store',
    'Content-Length': body.byteLength,
    'Content-Type': 'application/json; charset=utf-8',
  }).end(body);
}

function assertSameOrigin(request) {
  const origin = request.headers.origin;
  const allowed = new Set([`http://${host}:${port}`, `http://localhost:${port}`]);
  if (!new Set([`${host}:${port}`, `localhost:${port}`]).has(request.headers.host)) {
    throw new OutputStorageError(403, 'Onbekende lokale host geweigerd.');
  }
  if (origin && !allowed.has(origin)) throw new OutputStorageError(403, 'Cross-origin opslagverzoek geweigerd.');
  if (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'same-origin') {
    throw new OutputStorageError(403, 'Niet-lokaal opslagverzoek geweigerd.');
  }
}

function assertOutputMediaType(request, requestUrl) {
  const expected = {
    workbook: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    document: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    package: 'application/zip',
    images: 'application/zip',
    image: 'image/png',
    batch: 'application/zip',
  }[requestUrl.searchParams.get('kind') ?? ''];
  const supplied = String(request.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
  if (!expected || supplied !== expected) throw new OutputStorageError(415, 'Bestandstype komt niet overeen met het uitvoertype.');
}

async function readJsonBody(request, maximumBytes = 32 * 1024) {
  const supplied = String(request.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
  if (supplied !== 'application/json') throw new OutputStorageError(415, 'JSON-verzoek vereist.');
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maximumBytes) throw new OutputStorageError(413, 'Verzoek is te groot.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new OutputStorageError(400, 'Ongeldige JSON.'); }
}

createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${host}:${port}`);
    const decoded = decodeURIComponent(requestUrl.pathname);
    if (decoded === '/api/health') {
      if (request.method !== 'GET') { response.writeHead(405, { ...securityHeaders, Allow: 'GET' }).end(); return; }
      assertSameOrigin(request);
      json(response, 200, { ok: true, service: 'finance-product-factory', version: '1.1.0' });
      return;
    }
    if (decoded === '/api/elevenlabs/status') {
      if (request.method !== 'GET') { response.writeHead(405, { ...securityHeaders, Allow: 'GET' }).end(); return; }
      assertSameOrigin(request);
      json(response, 200, { ok: true, ...(await secureElevenLabsStatus()) });
      return;
    }
    if (decoded === '/api/elevenlabs/configure') {
      if (request.method !== 'POST') { response.writeHead(405, { ...securityHeaders, Allow: 'POST' }).end(); return; }
      assertSameOrigin(request);
      await saveSecureElevenLabsConfiguration(await readJsonBody(request));
      json(response, 200, { ok: true, ...(await secureElevenLabsStatus()) });
      return;
    }
    if (decoded === '/api/elevenlabs/test') {
      if (request.method !== 'POST') { response.writeHead(405, { ...securityHeaders, Allow: 'POST' }).end(); return; }
      assertSameOrigin(request);
      await readJsonBody(request);
      const result = await testTutorialConnection();
      json(response, 200, { ok: true, ...result });
      return;
    }
    if (decoded === '/api/tutorial') {
      if (request.method !== 'POST') { response.writeHead(405, { ...securityHeaders, Allow: 'POST' }).end(); return; }
      assertSameOrigin(request);
      const job = await startTutorialJob(root, await readJsonBody(request));
      json(response, 202, { ok: true, job });
      return;
    }
    if (decoded === '/api/tutorial/status') {
      if (request.method !== 'GET') { response.writeHead(405, { ...securityHeaders, Allow: 'GET' }).end(); return; }
      assertSameOrigin(request);
      const job = tutorialJobStatus(requestUrl.searchParams.get('id'));
      if (!job) { json(response, 404, { ok: false, error: 'Onbekende tutorialtaak.' }); return; }
      json(response, 200, { ok: true, job });
      return;
    }
    if (decoded === '/api/native-listing-images') {
      if (request.method !== 'POST') { response.writeHead(405, { ...securityHeaders, Allow: 'POST' }).end(); return; }
      assertSameOrigin(request);
      const result = await renderNativeListingImages(await readJsonBody(request, 72 * 1024 * 1024));
      json(response, 200, result);
      return;
    }
    if (decoded === '/api/output') {
      if (request.method !== 'POST') {
        response.writeHead(405, { ...securityHeaders, Allow: 'POST' }).end();
        return;
      }
      assertSameOrigin(request);
      assertOutputMediaType(request, requestUrl);
      assertKnownOutputMetadata(requestUrl, {
        products: productDefinitionById,
        locales: localeCatalog,
        currencies: currencyCatalog,
        themes: themeCatalog,
      });
      const bytes = await readBoundedRequestBody(request);
      const saved = await saveOutputBytes(root, requestUrl, bytes);
      json(response, 201, { ok: true, ...saved });
      return;
    }
    if (decoded === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    const relative = normalize(decoded).replace(/^([/\\])+/, '');
    let target = resolve(join(root, relative));

    if (target !== root && !target.startsWith(`${root}\\`) && !target.startsWith(`${root}/`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    let info = await stat(target);
    if (info.isDirectory()) {
      target = join(target, 'index.html');
      info = await stat(target);
    }
    if (!info.isFile()) throw new Error('Not a file');
    target = await realpath(target);
    if (target !== canonicalRoot && !target.startsWith(`${canonicalRoot}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    response.writeHead(200, {
      ...securityHeaders,
      'Cache-Control': 'no-store',
      'Content-Length': info.size,
      'Content-Type': types.get(extname(target).toLowerCase()) || 'application/octet-stream',
    });
    createReadStream(target).pipe(response);
  } catch (error) {
    if (error instanceof NativeListingImageError) {
      json(response, error.statusCode, { ok: false, error: error.message });
      return;
    }
    if (error instanceof OutputStorageError) {
      json(response, error.statusCode, { ok: false, error: error.message });
      return;
    }
    if (String(request.url ?? '').startsWith('/api/')) {
      json(response, 400, {
        ok: false,
        error: String(error?.message || 'De API-aanvraag kon niet worden verwerkt.').slice(0, 500),
      });
      return;
    }
    response.writeHead(404, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(port, host, () => {
  console.log(`Finance Product Factory: http://${host}:${port}/`);
});
