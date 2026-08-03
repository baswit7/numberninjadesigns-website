import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.NNSP_PREVIEW_PORT || 4174);
const csrfToken = 'browser-qa-csrf-placeholder';
const contextId = '55555555-5555-4555-8555-555555555555';
const mediaPaths = new Map([
  ['/social-publisher/', ['social-publisher/index.html', 'text/html; charset=utf-8']],
  ['/social-publisher/index.html', ['social-publisher/index.html', 'text/html; charset=utf-8']],
  ['/social-publisher/styles.css', ['social-publisher/styles.css', 'text/css; charset=utf-8']],
  ['/social-publisher/vendor/fix-webm-duration.js', ['social-publisher/vendor/fix-webm-duration.js', 'text/javascript; charset=utf-8']],
  ['/social-publisher/app.js', ['social-publisher/app.js', 'text/javascript; charset=utf-8']],
  ['/social-publisher/media.js', ['social-publisher/media.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
]);

function json(response, status, body) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

async function api(request, response, url) {
  const action = url.searchParams.get('action');
  if (action === 'session') {
    json(response, 200, {
      ok: true,
      session: {
        authenticated: true,
        csrfToken,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        etsy: { connected: true, shopName: 'NumberNinjaDesigns QA' },
        tiktok: { connected: true },
        mode: 'review',
      },
      config: { mode: 'review', origin: `http://127.0.0.1:${port}`, maximumVideoBytes: 4_000_000, videoSeconds: 10, videoFps: 24 },
    });
    return;
  }
  if (action === 'listings') {
    json(response, 200, {
      ok: true,
      listings: [{
        listingId: '7001',
        revision: 'browser-qa-revision-1',
        title: 'Data Driven Unisex Tee — Original NumberNinjaDesigns Gift',
        description: 'Browser QA fixture for the authenticated owned-listing flow.',
        price: { amount: 2495, divisor: 100, currencyCode: 'EUR' },
        listingUrl: 'https://www.etsy.com/listing/7001/browser-qa',
        imageCount: 1,
        imageUrl: '/api/social-publisher?action=image&listingId=7001&index=0',
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
      }],
    });
    return;
  }
  if (action === 'image') {
    const image = await readFile(`${root}/assets/designs/13-kpi-hunter.png`);
    response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': 'image/png', 'Content-Length': String(image.byteLength), 'X-Content-Type-Options': 'nosniff' });
    response.end(image);
    return;
  }
  if (action === 'creator' && request.method === 'POST') {
    json(response, 200, {
      ok: true,
      creator: {
        id: contextId,
        hash: 'a'.repeat(64),
        creatorUsername: 'numberninjadesigns',
        creatorNickname: 'NumberNinjaDesigns',
        privacyOptions: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
        commentDisabled: false,
        duetDisabled: false,
        stitchDisabled: true,
        maxDurationSeconds: 180,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      },
    });
    return;
  }
  json(response, 409, { ok: false, error: { code: 'QA_WRITE_DISABLED', message: 'Provider writes are disabled in browser QA.', retryable: false, reconnect: false } });
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/api/social-publisher') {
      await api(request, response, url);
      return;
    }
    const asset = mediaPaths.get(url.pathname);
    if (!asset) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    const bytes = await readFile(`${root}/${asset[0]}`);
    response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': asset[1], 'X-Content-Type-Options': 'nosniff' });
    response.end(bytes);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Preview server error');
  }
});

server.listen(port, '127.0.0.1', () => process.stdout.write(`READY http://127.0.0.1:${port}/social-publisher/\n`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
