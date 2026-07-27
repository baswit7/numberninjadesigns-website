import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

test('stores ElevenLabs configuration outside the repository with Windows DPAPI', async () => {
  const settingsPath = join(tmpdir(), `fpf-secure-settings-${process.pid}-${Date.now()}.json`);
  process.env.FPF_SECURE_SETTINGS_PATH = settingsPath;
  const settings = await import(`../src/server/secure-elevenlabs-settings.mjs?test=${Date.now()}`);
  try {
    await settings.saveSecureElevenLabsConfiguration({ apiKey: 'test-only-placeholder', voiceId: 'testVoiceId123456' });
    const status = await settings.secureElevenLabsStatus();
    const loaded = await settings.loadSecureElevenLabsConfiguration();
    assert.equal(status.configured, true);
    assert.equal(status.protection, 'WINDOWS_DPAPI_CURRENT_USER');
    assert.equal(status.voiceMode, 'MULTILINGUAL_DEFAULT');
    assert.equal(loaded.apiKey, 'test-only-placeholder');
    assert.equal(loaded.voiceId, 'testVoiceId123456');
  } finally {
    delete process.env.FPF_SECURE_SETTINGS_PATH;
    await rm(settingsPath, { force: true });
  }
});
