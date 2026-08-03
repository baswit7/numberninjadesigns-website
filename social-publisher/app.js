(function bootstrapPublisher(global, document) {
  'use strict';

  const API_PATH = '/api/social-publisher';
  const TERMINAL_STATES = new Set(['COMPLETE', 'FAILED']);
  const POLLABLE_STATES = new Set(['PROCESSING', 'UPLOAD_UNCERTAIN']);
  const PRIVACY_LABELS = Object.freeze({
    PUBLIC_TO_EVERYONE: 'Everyone',
    MUTUAL_FOLLOW_FRIENDS: 'Friends',
    FOLLOWER_OF_CREATOR: 'Followers',
    SELF_ONLY: 'Only me',
  });
  const OAUTH_HOSTS = Object.freeze({
    etsy: new Set(['www.etsy.com']),
    tiktok: new Set(['www.tiktok.com']),
  });

  class ApiError extends Error {
    constructor(status, payload) {
      super(payload?.message || 'The request could not be completed.');
      this.name = 'ApiError';
      this.status = status;
      this.code = payload?.code || 'REQUEST_FAILED';
      this.retryable = payload?.retryable === true;
      this.reconnect = payload?.reconnect === true;
    }
  }

  const byId = (id) => document.getElementById(id);
  const elements = Object.freeze({
    main: byId('publisher-main'),
    environmentLabel: byId('environmentLabel'),
    runtimeState: byId('runtimeState'),
    notice: byId('notice'),
    noticeTitle: byId('noticeTitle'),
    noticeMessage: byId('noticeMessage'),
    noticeDismiss: byId('noticeDismiss'),
    etsyConnectPanel: byId('etsyConnectPanel'),
    connectEtsyButton: byId('connectEtsyButton'),
    listingSection: byId('listingSection'),
    listingStrip: byId('listingStrip'),
    refreshListingsButton: byId('refreshListingsButton'),
    selectedListing: byId('selectedListing'),
    selectedListingImage: byId('selectedListingImage'),
    selectedListingTitle: byId('selectedListingTitle'),
    selectedListingMeta: byId('selectedListingMeta'),
    changeListingButton: byId('changeListingButton'),
    generateButton: byId('generateButton'),
    previewStage: byId('previewStage'),
    previewEmpty: byId('previewEmpty'),
    videoPreview: byId('videoPreview'),
    renderCanvas: byId('renderCanvas'),
    renderProgress: byId('renderProgress'),
    renderProgressText: byId('renderProgressText'),
    renderProgressBar: byId('renderProgressBar'),
    mediaProof: byId('mediaProof'),
    mediaHash: byId('mediaHash'),
    mediaSize: byId('mediaSize'),
    downloadPreviewButton: byId('downloadPreviewButton'),
    activityList: byId('activityList'),
    refreshStatusButton: byId('refreshStatusButton'),
    etsyDot: byId('etsyDot'),
    tiktokDot: byId('tiktokDot'),
    etsyAccountLabel: byId('etsyAccountLabel'),
    tiktokAccountLabel: byId('tiktokAccountLabel'),
    manageDataButton: byId('manageDataButton'),
    creatorCard: byId('creatorCard'),
    creatorName: byId('creatorName'),
    creatorUsername: byId('creatorUsername'),
    connectTikTokButton: byId('connectTikTokButton'),
    refreshCreatorButton: byId('refreshCreatorButton'),
    publishControls: byId('publishControls'),
    captionInput: byId('captionInput'),
    captionCount: byId('captionCount'),
    privacySelect: byId('privacySelect'),
    privacyHelp: byId('privacyHelp'),
    allowComment: byId('allowComment'),
    allowDuet: byId('allowDuet'),
    allowStitch: byId('allowStitch'),
    commentAvailability: byId('commentAvailability'),
    duetAvailability: byId('duetAvailability'),
    stitchAvailability: byId('stitchAvailability'),
    previewAcknowledged: byId('previewAcknowledged'),
    publishConsent: byId('publishConsent'),
    publishGate: byId('publishGate'),
    publishGateText: byId('publishGateText'),
    publishButton: byId('publishButton'),
    publishModeBadge: byId('publishModeBadge'),
    reviewNote: byId('reviewNote'),
    dataDialog: byId('dataDialog'),
    disconnectEtsyButton: byId('disconnectEtsyButton'),
    disconnectTikTokButton: byId('disconnectTikTokButton'),
    deleteConfirm: byId('deleteConfirm'),
    deleteDataButton: byId('deleteDataButton'),
  });

  const state = {
    session: null,
    config: null,
    listings: [],
    selected: null,
    media: null,
    creator: null,
    job: null,
    objectUrl: null,
    renderController: null,
    pollingTimer: null,
    pollingStartedAt: 0,
    busy: new Set(),
  };

  function setBusy(key, active) {
    if (active) state.busy.add(key);
    else state.busy.delete(key);
    elements.main.setAttribute('aria-busy', state.busy.size ? 'true' : 'false');
    renderGate();
  }

  function showNotice(title, message, kind = 'info') {
    elements.noticeTitle.textContent = title;
    elements.noticeMessage.textContent = message;
    elements.notice.dataset.state = kind;
    elements.notice.hidden = false;
  }

  function hideNotice() {
    elements.notice.hidden = true;
  }

  function friendlyError(error) {
    if (error?.name === 'AbortError') return 'The operation was cancelled.';
    if (error instanceof ApiError || (global.NNPromoMedia?.MediaError && error instanceof global.NNPromoMedia.MediaError)) return error.message;
    return 'The operation could not be completed safely. Check your connection and try again.';
  }

  async function request(action, options = {}) {
    const method = options.method || 'GET';
    const url = new URL(API_PATH, global.location.origin);
    url.searchParams.set('action', action);
    for (const [key, value] of Object.entries(options.query || {})) {
      if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    }
    const headers = new Headers(options.headers || {});
    const init = {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    };
    if (method !== 'GET' && action !== 'oauth-callback') {
      if (!state.session?.csrfToken) throw new ApiError(401, { code: 'SESSION_REQUIRED', message: 'Refresh this page to open a secure session.' });
      headers.set('X-NN-CSRF', state.session.csrfToken);
    }
    if (options.video) {
      headers.set('Content-Type', 'video/webm');
      init.body = options.video;
    } else if (method !== 'GET') {
      headers.set('Content-Type', 'application/json');
      init.body = JSON.stringify(options.body || {});
    }

    const controller = new AbortController();
    const timer = global.setTimeout(() => controller.abort(), options.timeoutMs || 30_000);
    init.signal = controller.signal;
    let response;
    try {
      response = await fetch(url, init);
    } catch {
      const message = controller.signal.aborted
        ? 'The secure publisher request timed out. Do not create a duplicate; use status readback or retry the same guarded action.'
        : 'The secure publisher service is unreachable. Check your connection and try again.';
      throw new ApiError(0, { code: 'NETWORK_ERROR', message, retryable: true });
    } finally {
      global.clearTimeout(timer);
    }
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    let payload = null;
    if (contentType.includes('application/json')) {
      try { payload = await response.json(); } catch { payload = null; }
    }
    if (!response.ok || payload?.ok !== true) throw new ApiError(response.status, payload?.error);
    return payload;
  }

  function validateAuthorizationUrl(provider, value) {
    let parsed;
    try { parsed = new URL(String(value)); } catch { parsed = null; }
    if (!parsed || parsed.protocol !== 'https:' || parsed.username || parsed.password || !OAUTH_HOSTS[provider]?.has(parsed.hostname)) {
      throw new ApiError(502, { code: 'OAUTH_URL_REJECTED', message: 'The provider returned an untrusted authorization destination.' });
    }
    return parsed.href;
  }

  function codePointLength(value) {
    return Array.from(String(value)).length;
  }

  function formatBytes(value) {
    const bytes = Number(value);
    return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1_000))} KB`;
  }

  function formatPrice(price) {
    if (!price || !Number.isFinite(Number(price.amount)) || !Number.isFinite(Number(price.divisor)) || Number(price.divisor) <= 0) return '';
    const amount = Number(price.amount) / Number(price.divisor);
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: String(price.currencyCode) }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${String(price.currencyCode || '').trim()}`.trim();
    }
  }

  function defaultCaption(listing) {
    const suffix = '\n\nDiscover this original Etsy find from NumberNinjaDesigns. #EtsyFinds #SmallBusiness #NumberNinjaDesigns';
    const room = 2_200 - codePointLength(suffix);
    return `${Array.from(listing.title).slice(0, Math.max(1, room)).join('')}${suffix}`;
  }

  function setStep(name, status, label) {
    const item = document.querySelector(`[data-step="${name}"]`);
    if (item) item.dataset.state = status;
    const labelElement = byId(`${name}StepState`);
    if (labelElement) labelElement.textContent = label;
  }

  function renderSteps() {
    const etsy = state.session?.etsy?.connected === true;
    const listing = Boolean(state.selected);
    const preview = Boolean(state.media);
    const tiktok = state.session?.tiktok?.connected === true && Boolean(state.creator);
    const ready = publishGate().ready;
    setStep('etsy', etsy ? 'complete' : 'current', etsy ? 'Connected' : 'Required');
    setStep('listing', listing ? 'complete' : (etsy ? 'current' : 'locked'), listing ? 'Selected' : (etsy ? 'Choose listing' : 'Locked'));
    setStep('preview', preview ? 'complete' : (listing ? 'current' : 'locked'), preview ? 'Generated' : (listing ? 'Generate' : 'Locked'));
    setStep('tiktok', tiktok ? 'complete' : (etsy && preview ? 'current' : 'locked'), tiktok ? 'Verified' : (etsy && preview ? 'Connect' : 'Locked'));
    setStep('publish', ready ? 'current' : 'locked', ready ? 'Ready' : 'Review required');
  }

  function renderConnections() {
    const etsyConnected = state.session?.etsy?.connected === true;
    const tiktokConnected = state.session?.tiktok?.connected === true;
    elements.etsyDot.dataset.state = etsyConnected ? 'on' : 'off';
    elements.tiktokDot.dataset.state = tiktokConnected ? 'on' : 'off';
    elements.etsyAccountLabel.textContent = etsyConnected ? `Etsy · ${state.session.etsy.shopName || 'owned shop'}` : 'Etsy not connected';
    elements.tiktokAccountLabel.textContent = tiktokConnected ? (state.creator?.creatorUsername ? `TikTok · @${state.creator.creatorUsername.replace(/^@/u, '')}` : 'TikTok connected · readback required') : 'TikTok not connected';
    elements.etsyConnectPanel.hidden = etsyConnected;
    elements.listingSection.hidden = !etsyConnected;
    elements.connectTikTokButton.disabled = !etsyConnected || tiktokConnected || state.busy.has('oauth');
    elements.connectTikTokButton.textContent = tiktokConnected ? 'Connected' : 'Connect';
    elements.refreshCreatorButton.disabled = !tiktokConnected || state.busy.has('creator');
    elements.disconnectEtsyButton.disabled = !etsyConnected || state.busy.has('data');
    elements.disconnectTikTokButton.disabled = !tiktokConnected || state.busy.has('data');
  }

  function listingCard(listing) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'listing-card';
    button.dataset.listingId = listing.listingId;
    button.setAttribute('aria-pressed', String(state.selected?.listingId === listing.listingId));
    const image = document.createElement('img');
    image.src = listing.imageUrl || '../favicon.svg';
    image.alt = '';
    image.width = 72;
    image.height = 72;
    image.loading = 'lazy';
    image.decoding = 'async';
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = listing.title;
    const price = document.createElement('small');
    price.textContent = formatPrice(listing.price) || 'Active Etsy listing';
    copy.append(title, price);
    button.append(image, copy);
    button.addEventListener('click', () => selectListing(listing));
    return button;
  }

  function renderListings() {
    elements.listingStrip.replaceChildren();
    if (!state.listings.length) {
      const empty = document.createElement('p');
      empty.className = 'field-help';
      empty.textContent = 'No active listings were returned for this owned Etsy shop.';
      elements.listingStrip.append(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    state.listings.forEach((listing) => fragment.append(listingCard(listing)));
    elements.listingStrip.append(fragment);
  }

  function renderListingSelection() {
    const listing = state.selected;
    elements.selectedListing.hidden = !listing;
    elements.generateButton.disabled = !listing || state.busy.has('render');
    if (!listing) return;
    elements.selectedListingImage.src = listing.imageUrl || '../favicon.svg';
    elements.selectedListingImage.alt = `Preview of ${listing.title}`;
    elements.selectedListingTitle.textContent = listing.title;
    elements.selectedListingMeta.textContent = `${formatPrice(listing.price) || 'Active listing'} · Etsy ID ${listing.listingId}`;
    document.querySelectorAll('.listing-card').forEach((card) => card.setAttribute('aria-pressed', String(card.dataset.listingId === listing.listingId)));
  }

  function revokePreviewUrl() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }

  function clearMedia() {
    revokePreviewUrl();
    state.media = null;
    elements.videoPreview.removeAttribute('src');
    elements.videoPreview.load();
    elements.videoPreview.hidden = true;
    elements.previewEmpty.hidden = false;
    elements.previewStage.dataset.state = 'empty';
    elements.mediaProof.hidden = true;
    invalidateConsent(true);
    renderGate();
  }

  function attachMedia(media) {
    revokePreviewUrl();
    state.media = media;
    state.objectUrl = URL.createObjectURL(media.blob);
    elements.videoPreview.src = state.objectUrl;
    elements.videoPreview.hidden = false;
    elements.previewEmpty.hidden = true;
    elements.previewStage.dataset.state = 'ready';
    elements.mediaProof.hidden = false;
    elements.mediaHash.textContent = `${media.sha256.slice(0, 12)}…${media.sha256.slice(-8)}`;
    elements.mediaHash.title = media.sha256;
    elements.mediaSize.textContent = formatBytes(media.bytes);
    invalidateConsent(true);
    renderAll();
  }

  function invalidateConsent(includePreview = false) {
    if (includePreview) elements.previewAcknowledged.checked = false;
    elements.publishConsent.checked = false;
  }

  function disclosureValue() {
    return document.querySelector('input[name="disclosure"]:checked')?.value || '';
  }

  function publishGate() {
    const captionLength = codePointLength(elements.captionInput.value);
    const activeJob = state.job && !TERMINAL_STATES.has(state.job.state) && state.job.state !== 'AWAITING_UPLOAD';
    const contextCurrent = state.creator && Date.parse(state.creator.expiresAt) > Date.now();
    const checks = [
      [state.session?.etsy?.connected === true, 'Connect your owned Etsy shop.'],
      [Boolean(state.selected), 'Select an active Etsy listing.'],
      [Boolean(state.media), 'Generate and review the exact video preview.'],
      [state.session?.tiktok?.connected === true, 'Connect the destination TikTok account.'],
      [Boolean(contextCurrent), 'Refresh the current TikTok creator settings.'],
      [captionLength > 0 && captionLength <= 2_200 && Boolean(elements.captionInput.value.trim()), 'Enter a caption of no more than 2,200 characters.'],
      [Boolean(elements.privacySelect.value), 'Choose a privacy setting; no option is preselected.'],
      [state.config?.mode !== 'review' || elements.privacySelect.value === 'SELF_ONLY', 'Review mode permits Only me posts exclusively.'],
      [Boolean(disclosureValue()), 'Choose the applicable commercial-content disclosure.'],
      [elements.previewAcknowledged.checked, 'Confirm that you reviewed the exact upload preview.'],
      [elements.publishConsent.checked, 'Give explicit consent for this TikTok publication.'],
      [!activeJob, 'The current publication is still being processed.'],
      [state.busy.size === 0, 'Wait for the current operation to finish.'],
    ];
    const failure = checks.find(([accepted]) => !accepted);
    return { ready: !failure, reason: failure?.[1] || 'Every publication gate is satisfied.' };
  }

  function renderGate() {
    const gate = publishGate();
    elements.captionCount.textContent = `${codePointLength(elements.captionInput.value)} / 2200`;
    elements.captionCount.dataset.state = codePointLength(elements.captionInput.value) > 2_200 ? 'error' : 'ready';
    elements.publishButton.disabled = !gate.ready;
    elements.publishGateText.textContent = gate.reason;
    elements.publishGate.dataset.state = gate.ready ? 'ready' : 'locked';
    const mode = state.config?.mode || 'unknown';
    elements.publishModeBadge.textContent = mode === 'review' ? 'Review · Only me' : (gate.ready ? 'Ready' : 'Production');
    elements.publishModeBadge.dataset.state = mode === 'review' ? 'review' : (gate.ready ? 'ready' : 'locked');
    elements.reviewNote.textContent = mode === 'review'
      ? 'TikTok review mode is fail-closed to Only me. Nothing is posted until you press Publish.'
      : 'Nothing is posted until you press Publish and the server confirms every gate.';
    renderSteps();
  }

  function renderCreator() {
    const connected = state.session?.tiktok?.connected === true;
    const creator = state.creator;
    elements.creatorCard.dataset.state = creator ? 'ready' : 'locked';
    elements.creatorName.textContent = creator?.creatorNickname || (connected ? 'Readback required' : 'Connect TikTok');
    elements.creatorUsername.textContent = creator?.creatorUsername ? `@${creator.creatorUsername.replace(/^@/u, '')}` : (connected ? 'Refresh current creator settings' : 'Account readback required');
    elements.publishControls.disabled = !creator || !state.media;

    const currentValue = elements.privacySelect.value;
    elements.privacySelect.replaceChildren(new Option('Choose privacy', '', true, false));
    const options = (creator?.privacyOptions || []).filter((option) => state.config?.mode !== 'review' || option === 'SELF_ONLY');
    options.forEach((option) => elements.privacySelect.add(new Option(PRIVACY_LABELS[option] || option, option)));
    if (options.includes(currentValue)) elements.privacySelect.value = currentValue;
    else elements.privacySelect.value = '';
    elements.privacyHelp.textContent = state.config?.mode === 'review'
      ? 'Review mode exposes the provider-approved Only me option without preselecting it.'
      : 'Options are loaded from the connected TikTok creator and are never preselected.';

    const interactionConfiguration = [
      [elements.allowComment, elements.commentAvailability, creator?.commentDisabled, 'Available', 'Disabled by creator'],
      [elements.allowDuet, elements.duetAvailability, creator?.duetDisabled, 'Available', 'Disabled by creator'],
      [elements.allowStitch, elements.stitchAvailability, creator?.stitchDisabled, 'Available', 'Disabled by creator'],
    ];
    interactionConfiguration.forEach(([input, label, disabled, availableText, disabledText]) => {
      input.disabled = !creator || disabled === true;
      if (disabled === true) input.checked = false;
      label.textContent = creator ? (disabled ? disabledText : availableText) : '';
    });
    renderConnections();
    renderGate();
  }

  function activityItem(status, title, detail) {
    const item = document.createElement('li');
    item.dataset.state = status;
    const dot = document.createElement('i');
    dot.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    const heading = document.createElement('strong');
    heading.textContent = title;
    const description = document.createElement('small');
    description.textContent = detail;
    copy.append(heading, description);
    item.append(dot, copy);
    return item;
  }

  function renderActivity() {
    elements.activityList.replaceChildren();
    if (!state.job) {
      elements.activityList.append(activityItem(state.media ? 'complete' : 'waiting', state.media ? 'Exact preview generated' : 'Waiting for an approved preview', state.media ? 'No provider write has been performed.' : 'Select a listing and generate its original video.'));
      elements.refreshStatusButton.disabled = true;
      return;
    }
    const job = state.job;
    elements.activityList.append(activityItem('complete', 'Publication request reserved', `Job ${job.id.slice(0, 8)} · duplicate protection active`));
    const uploadComplete = ['PROCESSING', 'UPLOAD_UNCERTAIN', 'COMPLETE', 'FAILED'].includes(job.state);
    elements.activityList.append(activityItem(uploadComplete ? 'complete' : (job.state === 'AWAITING_UPLOAD' ? 'active' : 'error'), uploadComplete ? 'Media accepted for processing' : (job.state === 'AWAITING_UPLOAD' ? 'Awaiting exact media upload' : 'Upload unavailable'), job.state === 'AWAITING_UPLOAD' ? 'Press Publish again after reconfirming if this page was restored.' : `State: ${job.state}`));
    const finalState = job.state === 'COMPLETE' ? 'complete' : (job.state === 'FAILED' || job.state === 'INIT_UNCERTAIN' ? 'error' : 'active');
    const finalTitle = job.state === 'COMPLETE' ? 'TikTok publication complete' : (job.state === 'FAILED' ? 'TikTok publication failed' : (job.state === 'INIT_UNCERTAIN' ? 'Initialization outcome is uncertain' : 'TikTok is processing the upload'));
    const finalDetail = job.state === 'COMPLETE'
      ? `Provider readback confirmed${job.providerPostId ? ` · post ${job.providerPostId}` : ''}`
      : (job.failureCode ? `Safe code: ${job.failureCode}` : `Provider status: ${job.providerStatus || 'pending'}`);
    elements.activityList.append(activityItem(finalState, finalTitle, finalDetail));
    elements.refreshStatusButton.disabled = !job.id || state.busy.has('status');
  }

  function renderAll() {
    renderConnections();
    renderListings();
    renderListingSelection();
    renderCreator();
    renderActivity();
    renderGate();
  }

  async function loadSession() {
    const result = await request('session');
    state.session = result.session;
    state.config = result.config;
    elements.environmentLabel.textContent = result.config.mode === 'review' ? 'TikTok review mode' : 'Production safeguards active';
    elements.runtimeState.dataset.state = 'ready';
    elements.runtimeState.querySelector('span').textContent = 'Secure service ready';
    renderAll();
  }

  async function loadListings(force = false) {
    if (!state.session?.etsy?.connected) return;
    setBusy('listings', true);
    elements.refreshListingsButton.disabled = true;
    elements.listingStrip.replaceChildren(...Array.from({ length: 3 }, () => {
      const skeleton = document.createElement('span');
      skeleton.className = 'listing-skeleton';
      skeleton.setAttribute('aria-hidden', 'true');
      return skeleton;
    }));
    try {
      const result = await request('listings', { query: { refresh: force ? 1 : 0 } });
      state.listings = Array.isArray(result.listings) ? result.listings : [];
      if (state.selected) {
        const current = state.listings.find((listing) => listing.listingId === state.selected.listingId && listing.revision === state.selected.revision);
        if (!current) {
          state.selected = null;
          clearMedia();
        } else state.selected = current;
      }
      renderAll();
    } catch (error) {
      state.listings = [];
      renderListings();
      showNotice('Listings unavailable', friendlyError(error), 'error');
    } finally {
      elements.refreshListingsButton.disabled = false;
      setBusy('listings', false);
    }
  }

  async function selectListing(listing) {
    if (state.selected?.listingId === listing.listingId && state.selected?.revision === listing.revision) return;
    state.selected = listing;
    clearMedia();
    state.job = null;
    state.creator = state.session?.tiktok?.connected ? state.creator : null;
    elements.captionInput.value = defaultCaption(listing);
    renderAll();
    elements.selectedListing.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    try {
      const cached = await global.NNPromoMedia.loadVideo(listing.listingId, listing.revision);
      if (cached && state.selected?.listingId === listing.listingId && state.selected?.revision === listing.revision) {
        attachMedia(cached);
        showNotice('Preview restored', 'The locally cached exact video was restored. Review it again before publishing.', 'info');
      }
    } catch {
      // IndexedDB is an optional recovery layer; generation remains available.
    }
  }

  async function startOAuth(provider) {
    setBusy('oauth', true);
    try {
      const result = await request('oauth-start', { method: 'POST', body: { provider } });
      global.location.assign(validateAuthorizationUrl(provider, result.oauth?.authorizationUrl));
    } catch (error) {
      showNotice(`${provider === 'etsy' ? 'Etsy' : 'TikTok'} connection stopped`, friendlyError(error), 'error');
      setBusy('oauth', false);
    }
  }

  async function generatePreview() {
    if (!state.selected || state.busy.has('render')) return;
    state.renderController?.abort();
    state.renderController = new AbortController();
    setBusy('render', true);
    hideNotice();
    clearMedia();
    elements.renderProgress.hidden = false;
    elements.previewEmpty.hidden = true;
    elements.previewStage.dataset.state = 'rendering';
    elements.generateButton.disabled = true;
    try {
      const media = await global.NNPromoMedia.generate({
        canvas: elements.renderCanvas,
        listing: { ...state.selected, priceLabel: formatPrice(state.selected.price) },
        imageUrl: state.selected.imageUrl,
        signal: state.renderController.signal,
        onProgress: (progress, message) => {
          const percent = Math.round(progress * 100);
          elements.renderProgress.setAttribute('aria-valuenow', String(percent));
          elements.renderProgressText.textContent = message;
          elements.renderProgressBar.style.width = `${percent}%`;
        },
      });
      attachMedia(media);
      try { await global.NNPromoMedia.saveVideo(media, state.selected); } catch {
        showNotice('Preview ready without recovery cache', 'The video is ready, but this browser could not persist it for crash recovery. Keep this tab open.', 'warning');
      }
      if (state.session?.tiktok?.connected) await refreshCreator({ quiet: true });
    } catch (error) {
      if (error?.name !== 'AbortError') showNotice('Video generation stopped', friendlyError(error), 'error');
      clearMedia();
    } finally {
      elements.renderProgress.hidden = true;
      state.renderController = null;
      setBusy('render', false);
      renderAll();
    }
  }

  async function refreshCreator({ quiet = false } = {}) {
    if (!state.session?.tiktok?.connected || state.busy.has('creator')) return;
    setBusy('creator', true);
    try {
      const result = await request('creator', { method: 'POST', body: {} });
      state.creator = result.creator;
      invalidateConsent(false);
      renderCreator();
      if (!quiet) showNotice('TikTok controls refreshed', 'Creator identity, privacy and interaction availability were read back directly from TikTok.', 'info');
    } catch (error) {
      state.creator = null;
      renderCreator();
      showNotice('TikTok readback failed', friendlyError(error), 'error');
    } finally {
      setBusy('creator', false);
      renderAll();
    }
  }

  function publicationPayload() {
    return {
      listingId: state.selected.listingId,
      listingRevision: state.selected.revision,
      mediaSha256: state.media.sha256,
      mediaBytes: state.media.bytes,
      mediaType: 'video/webm',
      durationSeconds: 10,
      contextId: state.creator.id,
      contextHash: state.creator.hash,
      caption: elements.captionInput.value,
      privacyLevel: elements.privacySelect.value,
      allowComment: elements.allowComment.checked,
      allowDuet: elements.allowDuet.checked,
      allowStitch: elements.allowStitch.checked,
      disclosure: disclosureValue(),
      previewAcknowledged: elements.previewAcknowledged.checked,
      consent: elements.publishConsent.checked,
      consentedAt: new Date().toISOString(),
    };
  }

  async function persistActiveJob() {
    if (!state.job) return;
    try {
      await global.NNPromoMedia.saveActiveJob({
        jobId: state.job.id,
        listingId: state.job.listingId,
        mediaSha256: state.media?.sha256 || null,
        state: state.job.state,
      });
    } catch {
      showNotice('Recovery cache unavailable', 'The server still tracks this publication. Keep this tab open until provider readback completes.', 'warning');
    }
  }

  async function publish() {
    if (!publishGate().ready) return;
    const payload = publicationPayload();
    setBusy('publish', true);
    invalidateConsent(false);
    renderGate();
    try {
      const initialized = await request('publish-init', { method: 'POST', body: payload });
      const previousJobId = state.job?.id;
      state.job = initialized.job;
      if (previousJobId !== state.job.id) state.pollingStartedAt = 0;
      await persistActiveJob();
      renderActivity();
      if (!initialized.uploadNonce) {
        if (POLLABLE_STATES.has(state.job.state)) startPolling();
        if (state.job.state === 'INIT_UNCERTAIN') showNotice('Publication outcome uncertain', 'Do not create another post. Provider acceptance could not be proven; use status readback or support.', 'warning');
        else if (state.job.state === 'FAILED') showNotice('Publication rejected safely', `TikTok did not accept the request (${state.job.failureCode || 'provider error'}).`, 'error');
        return;
      }

      const uploaded = await request('upload', {
        method: 'POST',
        query: { jobId: state.job.id },
        headers: { 'X-NN-Upload': initialized.uploadNonce },
        video: state.media.blob,
        timeoutMs: 120_000,
      });
      state.job = uploaded.job;
      await persistActiveJob();
      showNotice('Upload accepted', 'The exact reviewed media passed its SHA-256 check and TikTok is processing it.', 'info');
      renderActivity();
      startPolling();
    } catch (error) {
      showNotice('Publication not confirmed', friendlyError(error), error?.retryable ? 'warning' : 'error');
      if (state.job?.id) {
        await persistActiveJob();
        startPolling();
      }
    } finally {
      setBusy('publish', false);
      renderAll();
    }
  }

  async function refreshStatus({ quiet = false, propagate = false } = {}) {
    if (!state.job?.id || state.busy.has('status')) return;
    setBusy('status', true);
    try {
      const result = await request('status', { query: { jobId: state.job.id } });
      state.job = result.job;
      await persistActiveJob();
      renderActivity();
      if (state.job.state === 'COMPLETE') {
        stopPolling(true);
        showNotice('Publication confirmed', 'TikTok readback confirms that the post is complete.', 'info');
      } else if (state.job.state === 'FAILED') {
        stopPolling(true);
        showNotice('Publication failed', `TikTok returned ${state.job.failureCode || 'a provider failure'}. No blind retry was performed.`, 'error');
      } else if (!quiet && state.job.state === 'INIT_UNCERTAIN') {
        showNotice('Provider status remains uncertain', 'No duplicate attempt will be made without authoritative evidence.', 'warning');
      }
    } catch (error) {
      if (propagate) throw error;
      if (!quiet) showNotice('Status readback unavailable', friendlyError(error), 'warning');
    } finally {
      setBusy('status', false);
      renderAll();
    }
  }

  function stopPolling(reset = false) {
    if (state.pollingTimer) global.clearTimeout(state.pollingTimer);
    state.pollingTimer = null;
    if (reset) state.pollingStartedAt = 0;
  }

  function startPolling() {
    stopPolling();
    if (!state.job || !POLLABLE_STATES.has(state.job.state)) return;
    if (!state.pollingStartedAt) state.pollingStartedAt = Date.now();
    if (Date.now() - state.pollingStartedAt > 15 * 60 * 1000) {
      showNotice('Automatic readback paused', 'Use Refresh to check this long-running publication without exceeding provider limits.', 'warning');
      return;
    }
    state.pollingTimer = global.setTimeout(async () => {
      await refreshStatus({ quiet: true });
      if (state.job && POLLABLE_STATES.has(state.job.state)) startPolling();
    }, 4_000);
  }

  async function restoreActiveJob() {
    try {
      const saved = await global.NNPromoMedia.loadActiveJob();
      if (!saved?.jobId) return;
      state.pollingStartedAt = 0;
      state.job = { id: saved.jobId, listingId: saved.listingId, state: saved.state || 'PROCESSING', providerStatus: null };
      renderActivity();
      await refreshStatus({ quiet: true, propagate: true });
      if (state.job && POLLABLE_STATES.has(state.job.state)) startPolling();
    } catch (error) {
      if (error instanceof ApiError && [401, 404].includes(error.status)) {
        state.job = null;
        try { await global.NNPromoMedia.clearActiveJob(); } catch { /* Optional local recovery cleanup. */ }
      }
    }
  }

  async function disconnect(provider) {
    const label = provider === 'etsy' ? 'Etsy' : 'TikTok';
    if (!global.confirm(`Disconnect ${label} from this publisher?`)) return;
    setBusy('data', true);
    try {
      await request('disconnect', { method: 'POST', body: { provider } });
      if (provider === 'etsy') {
        state.listings = [];
        state.selected = null;
        clearMedia();
      } else {
        state.creator = null;
        stopPolling(true);
      }
      await loadSession();
      showNotice(`${label} disconnected`, `${label} access was removed from this publisher.`, 'info');
      elements.dataDialog.close();
    } catch (error) {
      showNotice(`${label} disconnect failed`, friendlyError(error), 'error');
    } finally {
      setBusy('data', false);
      renderAll();
    }
  }

  async function deleteData() {
    if (!elements.deleteConfirm.checked || !global.confirm('Permanently delete this publisher workspace and its server-side data?')) return;
    setBusy('data', true);
    try {
      await request('delete-data', { method: 'POST', body: { confirmed: true } });
      stopPolling(true);
      state.listings = [];
      state.selected = null;
      state.creator = null;
      state.job = null;
      clearMedia();
      try { await global.NNPromoMedia.clearAll(); } catch { /* Server deletion remains authoritative. */ }
      elements.deleteConfirm.checked = false;
      elements.deleteDataButton.disabled = true;
      elements.dataDialog.close();
      await loadSession();
      showNotice('Publisher data deleted', 'A new empty secure session has been opened.', 'info');
    } catch (error) {
      showNotice('Deletion could not be confirmed', friendlyError(error), 'error');
    } finally {
      setBusy('data', false);
      renderAll();
    }
  }

  function bindEvents() {
    elements.noticeDismiss.addEventListener('click', hideNotice);
    elements.connectEtsyButton.addEventListener('click', () => startOAuth('etsy'));
    elements.connectTikTokButton.addEventListener('click', () => startOAuth('tiktok'));
    elements.refreshListingsButton.addEventListener('click', () => loadListings(true));
    elements.changeListingButton.addEventListener('click', () => elements.listingSection.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    elements.generateButton.addEventListener('click', generatePreview);
    elements.downloadPreviewButton.addEventListener('click', () => {
      if (state.media) global.NNPromoMedia.download(state.media.blob, `numberninja-etsy-${state.selected?.listingId || 'promo'}.webm`);
    });
    elements.refreshCreatorButton.addEventListener('click', () => refreshCreator());
    elements.refreshStatusButton.addEventListener('click', () => refreshStatus());
    elements.publishButton.addEventListener('click', publish);
    elements.manageDataButton.addEventListener('click', () => elements.dataDialog.showModal());
    elements.disconnectEtsyButton.addEventListener('click', () => disconnect('etsy'));
    elements.disconnectTikTokButton.addEventListener('click', () => disconnect('tiktok'));
    elements.deleteConfirm.addEventListener('change', () => { elements.deleteDataButton.disabled = !elements.deleteConfirm.checked; });
    elements.deleteDataButton.addEventListener('click', deleteData);

    elements.captionInput.addEventListener('input', () => { invalidateConsent(false); renderGate(); });
    elements.privacySelect.addEventListener('change', () => { invalidateConsent(false); renderGate(); });
    [elements.allowComment, elements.allowDuet, elements.allowStitch].forEach((input) => input.addEventListener('change', () => { invalidateConsent(false); renderGate(); }));
    document.querySelectorAll('input[name="disclosure"]').forEach((input) => input.addEventListener('change', () => { invalidateConsent(false); renderGate(); }));
    elements.previewAcknowledged.addEventListener('change', renderGate);
    elements.publishConsent.addEventListener('change', renderGate);

    global.addEventListener('beforeunload', () => {
      stopPolling();
      state.renderController?.abort();
      revokePreviewUrl();
    });
  }

  function consumeReturnNotice() {
    const params = new URLSearchParams(global.location.search);
    const connected = params.get('connected');
    const error = params.get('oauthError');
    if (connected === 'etsy' || connected === 'tiktok') showNotice(`${connected === 'etsy' ? 'Etsy' : 'TikTok'} connected`, 'Authorization completed. Current account details are being read back.', 'info');
    else if (error) showNotice('Connection not completed', 'The authorization callback was rejected or expired. Start the connection again.', 'error');
    if (connected || error) global.history.replaceState({}, '', '/social-publisher/');
  }

  async function initialize() {
    bindEvents();
    consumeReturnNotice();
    setBusy('startup', true);
    try {
      await loadSession();
      if (state.session.etsy.connected) await loadListings(false);
      if (state.session.tiktok.connected) await refreshCreator({ quiet: true });
      await restoreActiveJob();
      elements.runtimeState.dataset.state = 'ready';
      elements.runtimeState.querySelector('span').textContent = 'Secure service ready';
    } catch (error) {
      elements.runtimeState.dataset.state = 'error';
      elements.runtimeState.querySelector('span').textContent = 'Service unavailable';
      showNotice('Publisher startup failed', friendlyError(error), 'error');
    } finally {
      setBusy('startup', false);
      renderAll();
    }
  }

  initialize();
})(window, document);
