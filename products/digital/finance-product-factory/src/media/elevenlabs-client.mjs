const ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech';

function safeError(status, body) {
  const detail = typeof body?.detail === 'string' ? body.detail : body?.detail?.message;
  return `ElevenLabs request failed with status ${status}${detail ? `: ${detail}` : ''}.`;
}

function isMp3(bytes) {
  return bytes.length > 512 && ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
}

export async function testElevenLabsConnection({ apiKey, fetchImpl = fetch }) {
  if (!String(apiKey ?? '').trim()) throw new Error('ElevenLabs API key is required.');
  const response = await fetchImpl('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': apiKey } });
  if (!response.ok) throw new Error(safeError(response.status, await response.json().catch(() => null)));
  const payload = await response.json();
  return Object.freeze({ status: 'PASS', authenticated: Boolean(payload.user_id), tier: payload.subscription?.tier ?? 'unknown' });
}

export async function synthesizeElevenLabs({ apiKey, voiceId, text, modelId = 'eleven_multilingual_v2', fetchImpl = fetch, retries = 3 }) {
  if (!String(apiKey ?? '').trim()) throw new Error('ElevenLabs API key is required.');
  if (!/^[A-Za-z0-9_-]{8,128}$/u.test(String(voiceId ?? ''))) throw new Error('A valid ElevenLabs voice ID is required.');
  if (!String(text ?? '').trim()) throw new Error('Voice-over text is required.');
  const url = `${ENDPOINT}/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`;
  let lastError;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
        body: JSON.stringify({ text, model_id: modelId }),
      });
      if (!response.ok) {
        const error = new Error(safeError(response.status, await response.json().catch(() => null)));
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!isMp3(bytes)) throw new Error('ElevenLabs returned an empty or invalid MP3 stream.');
      return Object.freeze({ status: 'PASS', bytes, modelId, outputFormat: 'mp3_44100_128' });
    } catch (error) {
      lastError = error;
      if (!error.retryable || attempt === retries - 1) break;
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}

export async function transcribeElevenLabs({ apiKey, audioBytes, filename = 'voice-over.mp3', fetchImpl = fetch }) {
  if (!String(apiKey ?? '').trim()) throw new Error('ElevenLabs API key is required.');
  if (!(audioBytes instanceof Uint8Array) || audioBytes.length < 512) throw new Error('A physical audio file is required for transcription.');
  const body = new FormData();
  body.set('model_id', 'scribe_v2');
  body.set('file', new Blob([audioBytes], { type: 'audio/mpeg' }), filename);
  const response = await fetchImpl('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': apiKey }, body });
  if (!response.ok) throw new Error(safeError(response.status, await response.json().catch(() => null)));
  const payload = await response.json();
  return Object.freeze({ status: 'PASS', languageCode: String(payload.language_code ?? '').toLowerCase(), text: String(payload.text ?? '') });
}
