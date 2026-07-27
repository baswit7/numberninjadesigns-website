import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTutorialContent, resolveTutorialLanguage } from '../src/media/tutorial-language.mjs';
import { synthesizeElevenLabs, testElevenLabsConnection } from '../src/media/elevenlabs-client.mjs';

test('resolves the required tutorial-language mapping with English fallback', () => {
  assert.equal(resolveTutorialLanguage('es-ES'), 'es');
  assert.equal(resolveTutorialLanguage('de-DE'), 'de');
  assert.equal(resolveTutorialLanguage('fr-FR'), 'fr');
  assert.equal(resolveTutorialLanguage('nl-NL'), 'nl');
  assert.equal(resolveTutorialLanguage('en-US'), 'en');
  assert.equal(resolveTutorialLanguage('it-IT'), 'en');
  assert.equal(resolveTutorialLanguage('xx-XX'), 'en');
  assert.equal(resolveTutorialLanguage(''), 'en');
  assert.equal(resolveTutorialLanguage(), 'en');
});

test('builds complete localized scripts, subtitles and YouTube metadata', () => {
  for (const locale of ['en-US', 'es-ES', 'de-DE', 'fr-FR', 'nl-NL']) {
    const content = buildTutorialContent(locale);
    assert.equal(content.steps.length, 15);
    assert.match(content.subtitles, /^WEBVTT/u);
    assert.match(content.srt, /^1\n00:00:00,000 -->/u);
    assert.equal(content.chapters.length, 15);
    assert.ok(content.narration.length > 1_000);
    assert.ok(content.tags.length >= 5);
  }
  const fallback = buildTutorialContent('it-IT');
  assert.equal(fallback.language, 'en');
  assert.equal(fallback.title, buildTutorialContent('en-US').title);
});

test('uses authenticated ElevenLabs endpoints without exposing secrets', async () => {
  const connection = await testElevenLabsConnection({ apiKey: 'secret', fetchImpl: async () => ({ ok: true, json: async () => ({ user_id: 'user', subscription: { tier: 'creator' } }) }) });
  assert.equal(connection.status, 'PASS');
  const audio = await synthesizeElevenLabs({
    apiKey: 'secret', voiceId: 'voice_12345678', text: 'Test voice-over',
    fetchImpl: async (url, request) => {
      assert.match(url, /\/v1\/text-to-speech\/voice_12345678\/stream/u);
      assert.equal(request.headers['xi-api-key'], 'secret');
      return { ok: true, arrayBuffer: async () => Uint8Array.from([0x49, 0x44, 0x33, ...new Array(600).fill(0)]).buffer };
    },
  });
  assert.equal(audio.status, 'PASS');
});
