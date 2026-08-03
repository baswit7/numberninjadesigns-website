import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('publisher frontend has no dynamic-code or HTML injection sinks', async () => {
  const scripts = await Promise.all(['social-publisher/app.js', 'social-publisher/media.js', 'social-publisher/callback.js'].map(read));
  const source = scripts.join('\n');
  for (const forbidden of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'localStorage', 'eval(', 'new Function']) {
    assert.equal(source.includes(forbidden), false, `forbidden client sink or storage: ${forbidden}`);
  }
  assert.equal(source.includes('access_token'), false);
  assert.equal(source.includes('client_secret'), false);
});

test('publisher renders fixed media constraints and hashes the exact blob', async () => {
  const media = await read('social-publisher/media.js');
  assert.match(media, /const WIDTH = 720;/u);
  assert.match(media, /const HEIGHT = 1280;/u);
  assert.match(media, /const FPS = 24;/u);
  assert.match(media, /const DURATION_MS = 10_000;/u);
  assert.match(media, /const MAX_VIDEO_BYTES = 4_000_000;/u);
  assert.match(media, /crypto\.subtle\.digest\('SHA-256', await blob\.arrayBuffer\(\)\)/u);
  assert.match(media, /video\/webm;codecs=vp8/u);
  assert.match(media, /indexedDB\.open/u);
});

test('OAuth callback scrubs query secrets before its network exchange', async () => {
  const callback = await read('social-publisher/callback.js');
  assert.ok(callback.indexOf('history.replaceState') < callback.indexOf("fetch('/api/social-publisher?action=oauth-callback'"));
  assert.match(callback, /\^\[A-Za-z0-9_-\]\{40,100\}\$/u);
  assert.equal(callback.includes('console.'), false);

  for (const path of ['etsy/callback/index.html', 'tiktok/callback/index.html']) {
    const html = await read(path);
    assert.match(html, /meta name="robots" content="noindex,nofollow,noarchive"/u);
    assert.match(html, /social-publisher\/callback\.js/u);
    assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/iu.test(html), false);
  }
});

test('publish UI requires no-default privacy, disclosure and two explicit approvals', async () => {
  const [html, app] = await Promise.all([read('social-publisher/index.html'), read('social-publisher/app.js')]);
  assert.match(html, /<option value="" selected>Choose privacy<\/option>/u);
  assert.match(html, /name="disclosure" value="own_brand"/u);
  assert.match(html, /id="previewAcknowledged" type="checkbox"/u);
  assert.match(html, /id="publishConsent" type="checkbox"/u);
  assert.match(app, /state\.config\?\.mode !== 'review' \|\| elements\.privacySelect\.value === 'SELF_ONLY'/u);
  assert.ok(app.indexOf('const payload = publicationPayload();') < app.indexOf("invalidateConsent(false);", app.indexOf('async function publish()')));
});

test('deployment headers isolate publisher and callback surfaces', async () => {
  const config = JSON.parse(await read('vercel.json'));
  const serialized = JSON.stringify(config);
  assert.match(serialized, /script-src 'self'/u);
  assert.match(serialized, /object-src 'none'/u);
  assert.match(serialized, /frame-ancestors 'none'/u);
  assert.match(serialized, /media-src 'self' blob:/u);
  assert.match(serialized, /noindex, nofollow, noarchive/u);
});

test('database contract is tenant-scoped and stores no raw video payload', async () => {
  const [repository, migration] = await Promise.all([
    read('server/social-publisher/repository.mjs'),
    read('server/social-publisher/migration.sql'),
  ]);
  assert.match(repository, /session_id = \$3::uuid AND tenant_id = \$4::uuid/u);
  assert.match(repository, /WHERE tenant_id = \$1::uuid AND id = \$2::uuid/u);
  assert.match(migration, /UNIQUE \(tenant_id, media_sha256, settings_sha256\)/u);
  assert.match(migration, /tenant_id uuid REFERENCES publisher_tenants\(id\) ON DELETE CASCADE/u);
  assert.equal(/\bbytea\b/iu.test(migration), false);
  assert.match(repository, /completed_at < now\(\) - interval '90 days'/u);
  assert.match(repository, /tenant\.updated_at < now\(\) - interval '31 days'/u);
});

test('migration runner executes bounded idempotent statements instead of a multi-command prepared query', async () => {
  const migrationRunner = await read('scripts/migrate-social-publisher.mjs');
  assert.match(migrationRunner, /\.split\(';'\)/u);
  assert.match(migrationRunner, /for \(const statement of statements\) await sql\.query\(statement, \[\]\);/u);
  assert.equal(migrationRunner.includes('sql.query(migration'), false);
});
