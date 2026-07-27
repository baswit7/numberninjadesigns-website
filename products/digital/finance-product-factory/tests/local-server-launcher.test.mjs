import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');

test('one-click launcher starts the verified local app without user-specific paths', async () => {
  const command = await readFile(resolve(root, 'Open Finance Product Factory.cmd'), 'utf8');
  const launcher = await readFile(resolve(root, 'scripts/start-finance-product-factory.ps1'), 'utf8');
  const server = await readFile(resolve(root, 'scripts/serve.mjs'), 'utf8');

  assert.match(command, /start-finance-product-factory\.ps1/i);
  assert.match(launcher, /http:\/\/127\.0\.0\.1:\$port\/api\/health/);
  assert.match(launcher, /http:\/\/127\.0\.0\.1:\$port\/apps\/product-factory\//);
  assert.match(launcher, /\$serverScript = Join-Path \$projectRoot 'scripts\\serve\.mjs'/);
  assert.match(launcher, /\$startedProcess = Start-Process/);
  assert.match(launcher, /Start-Process -FilePath \$appUrl/);
  assert.doesNotMatch(launcher, /C:\\Users\\|C:\\AI\\/i);
  assert.match(server, /decoded === '\/api\/health'/);
  assert.match(server, /service: 'finance-product-factory'/);
  assert.match(
    server,
    /document:\s*'application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document'/,
  );
});
