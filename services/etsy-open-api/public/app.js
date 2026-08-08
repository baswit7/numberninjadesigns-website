const loginPanel = document.querySelector('#login-panel');
const connectionPanel = document.querySelector('#connection-panel');
const publicationPanel = document.querySelector('#publication-panel');
const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');
const statusLabel = document.querySelector('#status-label');
const statusDot = document.querySelector('#status-dot');
const statusDetail = document.querySelector('#status-detail');
const lastCheck = document.querySelector('#last-check');
const controls = [...document.querySelectorAll('#connection-panel button')];
const refreshListingsButton = document.querySelector('#refresh-listings');
const publishAllButton = document.querySelector('#publish-all');
const publicationDetail = document.querySelector('#publication-detail');
const listingRows = document.querySelector('#listing-rows');
const activeCount = document.querySelector('#active-count');
const eligibleCount = document.querySelector('#eligible-count');
const blockedCount = document.querySelector('#blocked-count');
const publishDialog = document.querySelector('#publish-dialog');
const publishForm = document.querySelector('#publish-form');
const publishConfirmation = document.querySelector('#publish-confirmation');
const confirmPublishButton = document.querySelector('#confirm-publish');
const publishSummary = document.querySelector('#publish-summary');
let csrfToken = null;
let pollTimer = null;
let connectionState = 'error';
let listingOverview = null;
let publishing = false;

function setBusy(busy) {
  for (const control of controls) control.disabled = busy;
}

function safeError(errorCode) {
  const messages = {
    EXECUTION_DISABLED: 'Uitvoering is geblokkeerd totdat de Etsy-goedkeuring en go-livecontrole zijn afgerond.',
    NOT_CONNECTED: 'Er is geen Etsy-shop verbonden.',
    REAUTHORIZATION_REQUIRED: 'De autorisatie is verlopen of ingetrokken. Verbind de shop opnieuw.',
    SCOPE_MISMATCH: 'De verleende Etsy-scopes komen niet overeen met de goedgekeurde configuratie.',
    AUTHENTICATION_REQUIRED: 'De eigenaarssessie is verlopen. Ontgrendel het paneel opnieuw.',
    CATALOG_CHANGED: 'De listingcatalogus is gewijzigd. Vernieuw de wachtrij en controleer opnieuw.',
    CATALOG_INVALID: 'De listingcatalogus is ongeldig en is veilig geblokkeerd.',
    CATALOG_NOT_FOUND: 'De geconfigureerde listingcatalogus is niet gevonden.',
    NO_ELIGIBLE_LISTINGS: 'Er zijn geen actieve, volledig goedgekeurde listings om te plaatsen.',
    CONFIRMATION_REQUIRED: 'De vereiste bulkbevestiging ontbreekt.',
    TAXONOMY_NOT_FOUND: 'Een Product Studio-categorie bestaat niet in de actuele Etsy-taxonomie.',
    TAXONOMY_AMBIGUOUS: 'Een Product Studio-categorie past op meerdere Etsy-categorieën en vereist controle.'
  };
  return messages[errorCode] || 'De actie is veilig gestopt. Controleer de serveraudit voor de foutcode.';
}

function render(status) {
  const state = ['connected', 'reconnecting', 'error'].includes(status.state)
    ? status.state
    : 'error';
  statusLabel.textContent = state.toUpperCase();
  connectionState = state;
  statusDot.className = `status-dot ${state}`;
  statusDetail.textContent = state === 'connected'
    ? status.scopeVerification === 'token-accepted-no-enumeration'
      ? 'Token geaccepteerd. Etsy gaf geen scopes terug; controleer het toestemmingsscherm handmatig.'
      : 'Applicatiesleutel, token en Etsy-verbinding zijn geldig.'
    : state === 'reconnecting'
      ? 'Autorisatie wordt vernieuwd. De service blijft niet onbeperkt herhalen.'
      : safeError(status.errorCode);
  lastCheck.textContent = status.lastCheckedAt
    ? new Date(status.lastCheckedAt).toLocaleString()
    : 'Nog niet uitgevoerd';
  updatePublishAvailability();
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.errorCode || 'REQUEST_FAILED');
    error.code = body.errorCode || 'REQUEST_FAILED';
    throw error;
  }
  return body;
}

async function refreshStatus() {
  try {
    const status = await request('/api/etsy/status');
    csrfToken = status.csrfToken;
    loginPanel.hidden = true;
    connectionPanel.hidden = false;
    publicationPanel.hidden = false;
    render(status);
    return true;
  } catch (error) {
    if (error.code === 'AUTHENTICATION_REQUIRED') {
      csrfToken = null;
      loginPanel.hidden = false;
      connectionPanel.hidden = true;
      publicationPanel.hidden = true;
    }
    return false;
  }
}

function updatePublishAvailability() {
  const eligible = Number(listingOverview?.eligible || 0);
  publishAllButton.disabled = publishing || connectionState !== 'connected' || eligible === 0;
}

function renderListingOverview(overview) {
  listingOverview = overview;
  activeCount.textContent = String(overview.active);
  eligibleCount.textContent = String(overview.eligible);
  blockedCount.textContent = String(overview.blocked);
  publicationDetail.textContent = overview.eligible
    ? `${overview.eligible} listing${overview.eligible === 1 ? '' : 's'} voldoen aan alle publicatievoorwaarden.`
    : 'Geen listings voldoen momenteel aan alle publicatievoorwaarden.';
  listingRows.replaceChildren();
  const blockerMessages = {
    NOT_ACTIVE: 'niet actief',
    NOT_PUBLICATION_READY: 'publicatiecontrole niet gereed',
    QUALITY_STANDARD_MISMATCH: 'onjuiste kwaliteitsstandaard',
    VISUAL_QUALITY_NOT_APPROVED: 'visuele kwaliteit niet goedgekeurd',
    OWNER_APPROVAL_REQUIRED: 'eigenaarstoestemming vereist',
    IMAGE_REQUIRED: 'afbeelding vereist',
    DIGITAL_FILE_REQUIRED: 'digitaal bestand vereist',
    PHYSICAL_PROFILE_REQUIRED: 'Etsy-verzendprofiel vereist',
    LISTING_TYPE_INVALID: 'listingtype ongeldig',
    ASSET_MISSING: 'asset ontbreekt',
    ASSET_INVALID: 'asset ongeldig',
    ASSET_TOO_LARGE: 'digitaal bestand groter dan 20 MB',
    ALREADY_PUBLISHED: 'al gepubliceerd'
  };
  for (const listing of overview.listings) {
    const row = document.createElement('div');
    row.className = 'listing-row';
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = listing.title;
    const detail = document.createElement('small');
    detail.textContent = listing.eligible
      ? 'Klaar voor Etsy'
      : listing.blockers.map((code) => blockerMessages[code] || 'veilig geblokkeerd').join(' · ');
    copy.append(title, detail);
    const state = document.createElement('b');
    state.className = listing.eligible ? 'listing-state ready' : 'listing-state blocked';
    state.textContent = listing.eligible ? 'KLAAR' : 'BLOK';
    row.append(copy, state);
    listingRows.append(row);
  }
  updatePublishAvailability();
}

async function refreshListings() {
  refreshListingsButton.disabled = true;
  publicationDetail.textContent = 'Actieve listings en assets controleren…';
  try {
    renderListingOverview(await request('/api/etsy/listings'));
  } catch (error) {
    listingOverview = null;
    activeCount.textContent = '—';
    eligibleCount.textContent = '—';
    blockedCount.textContent = '—';
    listingRows.replaceChildren();
    publicationDetail.textContent = safeError(error.code);
    updatePublishAvailability();
  } finally {
    refreshListingsButton.disabled = false;
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  const input = document.querySelector('#admin-token');
  const adminToken = input.value;
  input.value = '';
  try {
    await request('/etsy-admin/session', {
      method: 'POST',
      body: JSON.stringify({ adminToken })
    });
    await refreshStatus();
    await refreshListings();
  } catch {
    loginError.textContent = 'Access denied. Check the server-side admin token.';
  }
});

document.querySelector('#test').addEventListener('click', async () => {
  setBusy(true);
  statusDetail.textContent = 'Testing the Etsy application key and OAuth token…';
  try {
    render(await request('/api/etsy/test-connection', { method: 'POST' }));
  } catch (error) {
    render({ state: 'error', errorCode: error.code, lastCheckedAt: new Date().toISOString() });
  } finally {
    setBusy(false);
  }
});

document.querySelector('#connect').addEventListener('click', async () => {
  setBusy(true);
  try {
    const result = await request('/api/etsy/connect', { method: 'POST' });
    window.location.assign(result.authorizationUrl);
  } catch (error) {
    render({ state: 'error', errorCode: error.code, lastCheckedAt: new Date().toISOString() });
    setBusy(false);
  }
});

document.querySelector('#disconnect').addEventListener('click', async () => {
  if (!window.confirm('Etsy ontkoppelen en het opgeslagen OAuth-token verwijderen?')) return;
  setBusy(true);
  try {
    render(await request('/api/etsy/disconnect', { method: 'POST' }));
  } catch (error) {
    render({ state: 'error', errorCode: error.code, lastCheckedAt: new Date().toISOString() });
  } finally {
    setBusy(false);
  }
});

refreshListingsButton.addEventListener('click', refreshListings);

publishAllButton.addEventListener('click', () => {
  if (!listingOverview?.eligible || connectionState !== 'connected') return;
  publishConfirmation.value = '';
  confirmPublishButton.disabled = true;
  publishSummary.textContent = `${listingOverview.eligible} actieve listing${listingOverview.eligible === 1 ? '' : 's'} worden als Etsy-draft opgebouwd, inclusief assets, en daarna geactiveerd.`;
  publishDialog.showModal();
  publishConfirmation.focus();
});

publishConfirmation.addEventListener('input', () => {
  confirmPublishButton.disabled = publishConfirmation.value !== 'PLAATSEN' || publishing;
});

function closePublishDialog() {
  if (!publishing) publishDialog.close();
}

document.querySelector('#close-dialog').addEventListener('click', closePublishDialog);
document.querySelector('#cancel-publish').addEventListener('click', closePublishDialog);

publishForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (
    publishing ||
    publishConfirmation.value !== 'PLAATSEN' ||
    !listingOverview?.revision
  ) return;
  publishing = true;
  confirmPublishButton.disabled = true;
  publishConfirmation.disabled = true;
  publicationDetail.textContent = 'Etsy-publicatie wordt uitgevoerd. Sluit dit venster niet…';
  updatePublishAvailability();
  try {
    const result = await request('/api/etsy/listings/publish-all', {
      method: 'POST',
      body: JSON.stringify({
        confirmation: 'PUBLISH_ALL_ACTIVE',
        revision: listingOverview.revision
      })
    });
    publishDialog.close();
    const resultMessage = result.failed
      ? `${result.published} geplaatst, ${result.failed} veilig gestopt. Controleer de serveraudit voor de foutcode.`
      : `${result.published} listing${result.published === 1 ? '' : 's'} succesvol op Etsy geplaatst.`;
    await refreshListings();
    publicationDetail.textContent = resultMessage;
  } catch (error) {
    publishDialog.close();
    publicationDetail.textContent = safeError(error.code);
  } finally {
    publishing = false;
    publishConfirmation.disabled = false;
    updatePublishAvailability();
  }
});

function schedulePoll() {
  clearTimeout(pollTimer);
  if (!document.hidden) {
    pollTimer = setTimeout(async () => {
      await refreshStatus();
      schedulePoll();
    }, 15_000);
  }
}

document.addEventListener('visibilitychange', schedulePoll);
window.addEventListener('pagehide', () => clearTimeout(pollTimer), { once: true });
const authenticated = await refreshStatus();
if (authenticated) await refreshListings();
schedulePoll();
