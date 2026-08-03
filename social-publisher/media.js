(function bootstrapPromoMedia(global) {
  'use strict';

  const WIDTH = 720;
  const HEIGHT = 1280;
  const FPS = 24;
  const DURATION_MS = 10_000;
  const VIDEO_BITS_PER_SECOND = 1_800_000;
  const MAX_VIDEO_BYTES = 4_000_000;
  const DATABASE_NAME = 'nnsp-media-v1';
  const DATABASE_VERSION = 1;
  const VIDEO_STORE = 'videos';
  const STATE_STORE = 'state';

  class MediaError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'MediaError';
      this.code = code;
    }
  }

  function invariant(condition, code, message) {
    if (!condition) throw new MediaError(code, message);
  }

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function ease(value) {
    const bounded = clamp(value);
    return bounded * bounded * (3 - (2 * bounded));
  }

  function roundedPath(context, x, y, width, height, radius) {
    const corner = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + corner, y);
    context.arcTo(x + width, y, x + width, y + height, corner);
    context.arcTo(x + width, y + height, x, y + height, corner);
    context.arcTo(x, y + height, x, y, corner);
    context.arcTo(x, y, x + width, y, corner);
    context.closePath();
  }

  function drawCover(context, image, x, y, width, height, zoom = 1, panX = 0, panY = 0) {
    const sourceWidth = Number(image.width ?? image.naturalWidth);
    const sourceHeight = Number(image.height ?? image.naturalHeight);
    const scale = Math.max(width / sourceWidth, height / sourceHeight) * zoom;
    const visibleWidth = width / scale;
    const visibleHeight = height / scale;
    const sourceX = clamp(((sourceWidth - visibleWidth) / 2) + panX, 0, Math.max(0, sourceWidth - visibleWidth));
    const sourceY = clamp(((sourceHeight - visibleHeight) / 2) + panY, 0, Math.max(0, sourceHeight - visibleHeight));
    context.drawImage(image, sourceX, sourceY, visibleWidth, visibleHeight, x, y, width, height);
  }

  function wrapText(context, text, maximumWidth, maximumLines) {
    const words = String(text ?? '').trim().split(/\s+/u).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maximumWidth || !line) {
        line = candidate;
        continue;
      }
      lines.push(line);
      line = word;
      if (lines.length === maximumLines - 1) break;
    }
    if (line && lines.length < maximumLines) lines.push(line);
    const consumed = lines.join(' ').split(/\s+/u).filter(Boolean).length;
    if (consumed < words.length && lines.length) {
      let finalLine = lines.at(-1);
      while (finalLine && context.measureText(`${finalLine}…`).width > maximumWidth) {
        finalLine = finalLine.slice(0, -1).trimEnd();
      }
      lines[lines.length - 1] = `${finalLine}…`;
    }
    return lines;
  }

  function drawTextBlock(context, listing, progress) {
    const reveal = ease(clamp((progress - 0.14) / 0.16));
    const exit = 1 - ease(clamp((progress - 0.83) / 0.12));
    const alpha = reveal * exit;
    context.save();
    context.globalAlpha = alpha;
    context.translate(0, (1 - reveal) * 36);

    context.fillStyle = '#00E891';
    context.font = '700 24px Arial, sans-serif';
    context.letterSpacing = '4px';
    context.fillText('FRESH FROM ETSY', 58, 900);

    context.fillStyle = '#F3F5F7';
    context.font = '800 54px Arial, sans-serif';
    const lines = wrapText(context, listing.title, 604, 3);
    lines.forEach((line, index) => context.fillText(line, 58, 970 + (index * 62)));

    if (listing.priceLabel) {
      const priceY = Math.min(1165, 995 + (lines.length * 62));
      context.fillStyle = '#00E891';
      context.font = '800 34px Arial, sans-serif';
      context.fillText(listing.priceLabel, 58, priceY);
    }
    context.restore();
  }

  function drawCallToAction(context, progress) {
    const reveal = ease(clamp((progress - 0.78) / 0.13));
    context.save();
    context.globalAlpha = reveal;
    context.translate(0, (1 - reveal) * 24);
    roundedPath(context, 58, 1112, 604, 104, 24);
    context.fillStyle = '#00E891';
    context.fill();
    context.fillStyle = '#07090C';
    context.font = '800 30px Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText('DISCOVER THE FULL LISTING', WIDTH / 2, 1175);
    context.textAlign = 'start';
    context.restore();
  }

  function drawBrand(context, progress) {
    const pulse = 0.94 + (Math.sin(progress * Math.PI * 4) * 0.03);
    context.save();
    context.translate(58, 54);
    context.scale(pulse, pulse);
    roundedPath(context, 0, 0, 76, 76, 19);
    context.fillStyle = '#00E891';
    context.fill();
    context.fillStyle = '#07090C';
    context.font = '900 29px Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText('NN', 38, 49);
    context.textAlign = 'start';
    context.fillStyle = '#F3F5F7';
    context.font = '700 22px Arial, sans-serif';
    context.fillText('NUMBER NINJA DESIGNS', 96, 34);
    context.fillStyle = 'rgba(243, 245, 247, .62)';
    context.font = '500 18px Arial, sans-serif';
    context.fillText('Independent Etsy seller', 96, 62);
    context.restore();
  }

  function drawFrame(context, image, listing, elapsedMs) {
    const progress = clamp(elapsedMs / DURATION_MS);
    context.save();
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = '#07090C';
    context.fillRect(0, 0, WIDTH, HEIGHT);

    const zoom = 1.03 + (progress * 0.1);
    const sourceWidth = Number(image.width ?? image.naturalWidth);
    const sourceHeight = Number(image.height ?? image.naturalHeight);
    drawCover(context, image, 0, 0, WIDTH, HEIGHT, zoom, Math.sin(progress * Math.PI) * sourceWidth * 0.015, progress * sourceHeight * 0.02);

    const wash = context.createLinearGradient(0, 0, 0, HEIGHT);
    wash.addColorStop(0, 'rgba(7, 9, 12, .24)');
    wash.addColorStop(0.48, 'rgba(7, 9, 12, .08)');
    wash.addColorStop(0.72, 'rgba(7, 9, 12, .68)');
    wash.addColorStop(1, 'rgba(7, 9, 12, .96)');
    context.fillStyle = wash;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    const accent = context.createLinearGradient(0, 0, WIDTH, 0);
    accent.addColorStop(0, 'rgba(0, 232, 145, .92)');
    accent.addColorStop(1, 'rgba(0, 232, 145, 0)');
    context.fillStyle = accent;
    context.fillRect(0, 846, WIDTH, 4);

    drawBrand(context, progress);
    drawTextBlock(context, listing, progress);
    drawCallToAction(context, progress);

    context.fillStyle = 'rgba(243, 245, 247, .7)';
    context.font = '500 17px Arial, sans-serif';
    context.fillText('numberninjadesigns.com', 58, 1250);
    context.restore();
  }

  function sameOriginImageUrl(value) {
    let parsed;
    try { parsed = new URL(String(value), global.location.href); } catch { parsed = null; }
    invariant(parsed && parsed.origin === global.location.origin && parsed.pathname === '/api/social-publisher' && parsed.searchParams.get('action') === 'image', 'IMAGE_URL_REJECTED', 'The listing image URL is not trusted.');
    return parsed.href;
  }

  async function loadImage(url, signal) {
    const response = await fetch(sameOriginImageUrl(url), {
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      signal,
    });
    invariant(response.ok, 'IMAGE_LOAD_FAILED', 'The Etsy listing image could not be loaded.');
    const contentType = String(response.headers.get('content-type') ?? '').split(';', 1)[0].toLowerCase();
    invariant(['image/jpeg', 'image/png', 'image/webp'].includes(contentType), 'IMAGE_TYPE_UNSUPPORTED', 'The Etsy listing image format is not supported.');
    const blob = await response.blob();
    invariant(blob.size > 0 && blob.size <= 3_500_000, 'IMAGE_TOO_LARGE', 'The Etsy listing image exceeds the safe limit.');
    if ('createImageBitmap' in global) return global.createImageBitmap(blob);
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new MediaError('IMAGE_DECODE_FAILED', 'The Etsy listing image could not be decoded.'));
        image.src = objectUrl;
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  function supportedMimeType() {
    invariant('MediaRecorder' in global && HTMLCanvasElement.prototype.captureStream, 'VIDEO_UNSUPPORTED', 'This browser cannot create the secure video preview. Use the latest Chrome, Edge, Firefox or Safari.');
    const candidates = ['video/webm;codecs=vp8', 'video/webm'];
    const supported = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
    invariant(supported, 'VIDEO_UNSUPPORTED', 'This browser cannot encode the required WebM video. Use the latest Chrome, Edge or Firefox.');
    return supported;
  }

  async function sha256Hex(blob) {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async function waitForFonts() {
    if (!document.fonts?.ready) return;
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => global.setTimeout(resolve, 1_500)),
    ]);
  }

  async function generate({ canvas, listing, imageUrl, onProgress = () => {}, signal }) {
    invariant(canvas instanceof HTMLCanvasElement, 'CANVAS_REQUIRED', 'The video renderer is unavailable.');
    invariant(listing && typeof listing.title === 'string' && listing.title.trim(), 'LISTING_REQUIRED', 'Select an Etsy listing first.');
    const mimeType = supportedMimeType();
    onProgress(0.02, 'Loading authenticated Etsy artwork…');
    const image = await loadImage(imageUrl, signal);
    await waitForFonts();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext('2d', { alpha: false, desynchronized: false });
    invariant(context, 'CANVAS_REQUIRED', 'The video renderer is unavailable.');
    drawFrame(context, image, listing, 0);
    onProgress(0.08, 'Starting the 10-second render…');

    const stream = canvas.captureStream(FPS);
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
    });
    const chunks = [];
    let frameRequest = 0;
    let stopped = false;
    let hiddenDuringRender = false;
    const startedAt = performance.now();

    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (frameRequest) cancelAnimationFrame(frameRequest);
      if (recorder.state !== 'inactive') recorder.stop();
    };
    const onVisibility = () => {
      if (document.hidden) {
        hiddenDuringRender = true;
        stop();
      }
    };
    const onAbort = () => stop();

    const completed = new Promise((resolve, reject) => {
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data?.size) chunks.push(event.data);
      });
      recorder.addEventListener('error', () => reject(new MediaError('VIDEO_ENCODE_FAILED', 'The browser could not encode the video preview.')), { once: true });
      recorder.addEventListener('stop', resolve, { once: true });
    });

    document.addEventListener('visibilitychange', onVisibility);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      recorder.start(500);
      const render = (timestamp) => {
        const elapsed = Math.min(DURATION_MS, timestamp - startedAt);
        drawFrame(context, image, listing, elapsed);
        onProgress(0.08 + ((elapsed / DURATION_MS) * 0.84), elapsed < 8_000 ? 'Animating listing artwork…' : 'Finishing the exact upload file…');
        if (elapsed >= DURATION_MS || signal?.aborted) stop();
        else frameRequest = requestAnimationFrame(render);
      };
      frameRequest = requestAnimationFrame(render);
      await completed;
    } finally {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      signal?.removeEventListener('abort', onAbort);
      stream.getTracks().forEach((track) => track.stop());
      if (typeof image.close === 'function') image.close();
    }

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    invariant(!hiddenDuringRender, 'RENDER_INTERRUPTED', 'Keep this tab visible while the ten-second preview is generated.');
    const recordedBlob = new Blob(chunks, { type: 'video/webm' });
    invariant(recordedBlob.size > 0, 'VIDEO_ENCODE_FAILED', 'The generated video is empty.');
    invariant(typeof global.ysFixWebmDuration === 'function', 'VIDEO_METADATA_UNAVAILABLE', 'The WebM metadata finalizer is unavailable. Reload the publisher and generate again.');
    onProgress(0.94, 'Finalizing exact duration metadata…');
    let fixedBlob;
    try {
      fixedBlob = await global.ysFixWebmDuration(recordedBlob, DURATION_MS, { logger: false });
    } catch {
      throw new MediaError('VIDEO_METADATA_FAILED', 'The browser could not finalize the exact WebM duration. Generate the preview again.');
    }
    const blob = fixedBlob.type === 'video/webm' ? fixedBlob : new Blob([fixedBlob], { type: 'video/webm' });
    invariant(blob.size <= MAX_VIDEO_BYTES, 'VIDEO_TOO_LARGE', 'The generated preview exceeded 4 MB. Close other heavy tabs and generate it again.');
    onProgress(0.96, 'Verifying media integrity…');
    const sha256 = await sha256Hex(blob);
    onProgress(1, 'Preview ready');
    return Object.freeze({ blob, sha256, bytes: blob.size, mediaType: 'video/webm', durationSeconds: 10, fps: FPS, width: WIDTH, height: HEIGHT });
  }

  function openDatabase() {
    invariant('indexedDB' in global, 'CACHE_UNAVAILABLE', 'Browser recovery storage is unavailable.');
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(VIDEO_STORE)) {
          const store = database.createObjectStore(VIDEO_STORE, { keyPath: 'sha256' });
          store.createIndex('listingRevision', ['listingId', 'listingRevision'], { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!database.objectStoreNames.contains(STATE_STORE)) database.createObjectStore(STATE_STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new MediaError('CACHE_UNAVAILABLE', 'Browser recovery storage could not be opened.'));
      request.onblocked = () => reject(new MediaError('CACHE_BLOCKED', 'Close other copies of this publisher and try again.'));
    });
  }

  async function transaction(storeName, mode, operation) {
    const database = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const tx = database.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result;
        try { result = operation(store); } catch (error) { reject(error); return; }
        tx.oncomplete = () => resolve(result?.result);
        tx.onerror = () => reject(new MediaError('CACHE_FAILED', 'Browser recovery storage failed.'));
        tx.onabort = () => reject(new MediaError('CACHE_FAILED', 'Browser recovery storage was interrupted.'));
      });
    } finally {
      database.close();
    }
  }

  async function saveVideo(media, listing) {
    const record = {
      sha256: media.sha256,
      listingId: String(listing.listingId),
      listingRevision: String(listing.revision),
      blob: media.blob,
      bytes: media.bytes,
      mediaType: media.mediaType,
      durationSeconds: media.durationSeconds,
      createdAt: new Date().toISOString(),
    };
    await transaction(VIDEO_STORE, 'readwrite', (store) => store.put(record));
    return record;
  }

  async function loadVideo(listingId, listingRevision) {
    const database = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const tx = database.transaction(VIDEO_STORE, 'readonly');
        const index = tx.objectStore(VIDEO_STORE).index('listingRevision');
        const request = index.getAll(IDBKeyRange.only([String(listingId), String(listingRevision)]));
        request.onsuccess = () => {
          const records = request.result.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
          resolve(records[0] ?? null);
        };
        request.onerror = () => reject(new MediaError('CACHE_FAILED', 'The saved preview could not be restored.'));
      });
    } finally {
      database.close();
    }
  }

  async function saveActiveJob(job) {
    await transaction(STATE_STORE, 'readwrite', (store) => store.put({ key: 'activeJob', ...job, savedAt: new Date().toISOString() }));
  }

  async function loadActiveJob() {
    return transaction(STATE_STORE, 'readonly', (store) => store.get('activeJob'));
  }

  async function clearActiveJob() {
    await transaction(STATE_STORE, 'readwrite', (store) => store.delete('activeJob'));
  }

  async function clearAll() {
    await Promise.all([
      transaction(VIDEO_STORE, 'readwrite', (store) => store.clear()),
      transaction(STATE_STORE, 'readwrite', (store) => store.clear()),
    ]);
  }

  function download(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = String(filename || 'numberninja-etsy-promo.webm').replace(/[^a-z0-9._-]+/giu, '-').slice(0, 120);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    global.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
  }

  global.NNPromoMedia = Object.freeze({
    MediaError,
    constants: Object.freeze({ WIDTH, HEIGHT, FPS, DURATION_MS, MAX_VIDEO_BYTES }),
    generate,
    saveVideo,
    loadVideo,
    saveActiveJob,
    loadActiveJob,
    clearActiveJob,
    clearAll,
    download,
  });
})(window);
