(() => {
  'use strict';

  const EXPECTED_FILE = 'api-registry.json';
  const HANDLE_DB = 'nnd-api-registry-manager';
  const HANDLE_STORE = 'handles';
  const HANDLE_KEY = 'registry';
  const POLL_INTERVAL_MS = 2000;
  const MAX_FILE_BYTES = 512 * 1024;
  const ARRAY_FIELDS = Object.freeze({
    projectsUsing: '#field-projects',
    requiredEnvVars: '#field-env-vars',
    requiredScopes: '#field-required-scopes',
    grantedScopes: '#field-granted-scopes',
    requiredPermissions: '#field-required-permissions',
    grantedPermissions: '#field-granted-permissions',
  });
  const TEXT_FIELDS = Object.freeze({
    name: '#field-name',
    provider: '#field-provider',
    owner: '#field-owner',
    status: '#field-status',
    criticality: '#field-criticality',
    lastValidation: '#field-last-validation',
  });
  const PROHIBITED_KEYS = new Set(['apikey', 'accesstoken', 'refreshtoken', 'clientsecret', 'password', 'credentialvalue', 'secretvalue']);
  const PROHIBITED_STRUCTURE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  const SECRET_VALUE_PATTERNS = Object.freeze([
    /^sk-[a-z0-9_-]{16,}$/iu,
    /^gh[pousr]_[a-z0-9]{20,}$/iu,
    /^AIza[0-9A-Za-z_-]{20,}$/u,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  ]);

  const state = {
    registry: null,
    baseline: null,
    handle: null,
    writable: false,
    fallbackMode: false,
    lastModified: 0,
    sourceText: '',
    selectedId: '',
    dirty: false,
    conflict: false,
    pollTimer: 0,
  };

  const $ = selector => document.querySelector(selector);
  const elements = {
    connect: $('#connect-source'),
    reload: $('#reload-source'),
    save: $('#save-source'),
    export: $('#export-source'),
    fallbackFile: $('#fallback-file'),
    status: $('#manager-status'),
    dot: $('#connection-dot'),
    connectionLabel: $('#connection-label'),
    sourceName: $('#source-name'),
    search: $('#api-search'),
    count: $('#api-count'),
    list: $('#api-list'),
    empty: $('#editor-empty'),
    editor: $('#api-editor'),
    selectedName: $('#selected-api-name'),
    selectedStatus: $('#selected-api-status'),
    reset: $('#reset-api'),
    id: $('#field-id'),
  };

  const announce = (message, tone = 'neutral') => {
    elements.status.textContent = message;
    elements.status.dataset.tone = tone;
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  const splitList = value => [...new Set(String(value || '').split(',').map(item => item.trim()).filter(Boolean))];
  const joinList = value => Array.isArray(value) ? value.join(', ') : '';

  const updateControls = () => {
    const loaded = Boolean(state.registry);
    elements.reload.disabled = !loaded || !state.handle;
    elements.export.disabled = !loaded;
    elements.search.disabled = !loaded;
    elements.save.disabled = !loaded || !state.dirty || !state.writable || state.conflict;
    elements.save.textContent = state.conflict ? 'Conflict oplossen' : state.dirty ? 'Opslaan naar bron' : 'Bron is actueel';
    elements.dot.dataset.state = state.conflict ? 'warning' : loaded ? 'connected' : 'disconnected';
    elements.connectionLabel.textContent = state.conflict
      ? 'Extern bestand gewijzigd'
      : loaded
        ? state.writable ? 'Tweerichtingssync actief' : 'Alleen-lezen import'
        : 'Geen bron gekoppeld';
  };

  const inspectForSecrets = (value, path = 'registry') => {
    if (typeof value === 'string' && SECRET_VALUE_PATTERNS.some(pattern => pattern.test(value.trim()))) {
      throw new TypeError(`Mogelijke secretwaarde gevonden in ${path}.`);
    }
    if (!value || typeof value !== 'object') return;
    Object.entries(value).forEach(([key, child]) => {
      if (PROHIBITED_STRUCTURE_KEYS.has(key)) throw new TypeError(`Verboden structuurveld gevonden: ${path}.${key}`);
      const normalized = key.replace(/[^a-z]/gi, '').toLowerCase();
      if (PROHIBITED_KEYS.has(normalized)) throw new TypeError(`Verboden secretveld gevonden: ${path}.${key}`);
      inspectForSecrets(child, `${path}.${key}`);
    });
  };

  const validateRegistry = registry => {
    if (!registry || typeof registry !== 'object' || Array.isArray(registry)) throw new TypeError('De registry moet een JSON-object zijn.');
    if (registry.contractId !== 'studio-os-api-governance-registry') throw new TypeError('Dit is niet de NumberNinjaDesigns API-governance registry.');
    if (!Array.isArray(registry.apis) || !Array.isArray(registry.allowedStatuses) || !Array.isArray(registry.requiredFields)) {
      throw new TypeError('De registry mist apis, allowedStatuses of requiredFields.');
    }
    const ids = new Set();
    registry.apis.forEach((api, index) => {
      if (!api || typeof api !== 'object' || Array.isArray(api)) throw new TypeError(`API ${index + 1} is ongeldig.`);
      if (typeof api.id !== 'string' || !/^[a-z0-9][a-z0-9.-]*$/u.test(api.id)) throw new TypeError(`API ${index + 1} heeft een ongeldig id.`);
      if (ids.has(api.id)) throw new TypeError(`Dubbel API-id: ${api.id}`);
      ids.add(api.id);
      registry.requiredFields.forEach(field => {
        if (!(field in api)) throw new TypeError(`${api.id} mist vereist veld ${field}.`);
      });
      if (!registry.allowedStatuses.includes(api.status)) throw new TypeError(`${api.id} heeft een niet-toegestane status.`);
      ['projectsUsing', 'requiredEnvVars', 'requiredScopes', 'grantedScopes', 'requiredPermissions', 'grantedPermissions'].forEach(field => {
        if (!Array.isArray(api[field])) throw new TypeError(`${api.id}.${field} moet een lijst zijn.`);
      });
      if (api.lastValidation !== 'unknown' && !Number.isFinite(Date.parse(api.lastValidation))) {
        throw new TypeError(`${api.id}.lastValidation moet een ISO-datum of "unknown" zijn.`);
      }
    });
    inspectForSecrets(registry);
    return registry;
  };

  const parseRegistry = text => {
    if (new Blob([text]).size > MAX_FILE_BYTES) throw new TypeError('De registry is groter dan 512 KB.');
    try {
      return validateRegistry(JSON.parse(text));
    } catch (error) {
      if (error instanceof SyntaxError) throw new TypeError('Het bronbestand bevat ongeldige JSON.');
      throw error;
    }
  };

  const selectedApi = () => state.registry?.apis.find(api => api.id === state.selectedId) || null;
  const baselineApi = () => state.baseline?.apis.find(api => api.id === state.selectedId) || null;

  const renderStatusOptions = () => {
    const select = $(TEXT_FIELDS.status);
    const current = selectedApi()?.status || '';
    select.replaceChildren();
    state.registry.allowedStatuses.forEach(status => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      option.selected = status === current;
      select.append(option);
    });
  };

  const renderEditor = () => {
    const api = selectedApi();
    elements.empty.hidden = Boolean(api);
    elements.editor.hidden = !api;
    if (!api) return;
    elements.id.value = api.id;
    elements.selectedName.textContent = api.name;
    elements.selectedStatus.textContent = api.status;
    elements.selectedStatus.dataset.status = api.status;
    renderStatusOptions();
    Object.entries(TEXT_FIELDS).forEach(([field, selector]) => {
      if (field !== 'status') $(selector).value = String(api[field] ?? '');
    });
    Object.entries(ARRAY_FIELDS).forEach(([field, selector]) => {
      $(selector).value = joinList(api[field]);
    });
  };

  const renderList = () => {
    const query = elements.search.value.trim().toLowerCase();
    const apis = state.registry?.apis || [];
    const visible = apis.filter(api => `${api.name} ${api.provider} ${api.id}`.toLowerCase().includes(query));
    elements.count.textContent = String(apis.length);
    elements.list.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = apis.length ? 'Geen connectors gevonden.' : 'Nog geen registry geladen.';
      elements.list.append(empty);
      return;
    }
    visible.forEach(api => {
      const button = document.createElement('button');
      button.className = 'api-item';
      button.type = 'button';
      button.dataset.apiId = api.id;
      button.setAttribute('aria-current', String(api.id === state.selectedId));
      const name = document.createElement('strong');
      name.textContent = api.name;
      const provider = document.createElement('span');
      provider.textContent = `${api.provider} · ${api.status}`;
      const dot = document.createElement('i');
      dot.dataset.status = api.status;
      dot.setAttribute('aria-hidden', 'true');
      button.append(name, provider, dot);
      elements.list.append(button);
    });
  };

  const render = () => {
    renderList();
    renderEditor();
    updateControls();
  };

  const applyRegistry = (registry, {
    handle = state.handle,
    lastModified = 0,
    sourceText = JSON.stringify(registry),
    writable = state.writable,
    fallbackMode = false,
  } = {}) => {
    state.registry = registry;
    state.baseline = clone(registry);
    state.handle = handle;
    state.lastModified = lastModified;
    state.sourceText = sourceText;
    state.writable = writable;
    state.fallbackMode = fallbackMode;
    state.dirty = false;
    state.conflict = false;
    if (!registry.apis.some(api => api.id === state.selectedId)) state.selectedId = registry.apis[0]?.id || '';
    elements.sourceName.textContent = handle?.name || EXPECTED_FILE;
    elements.search.value = '';
    render();
  };

  const readHandle = async (handle, options = {}) => {
    const file = await handle.getFile();
    const sourceText = await file.text();
    const registry = parseRegistry(sourceText);
    applyRegistry(registry, {
      handle,
      lastModified: file.lastModified,
      sourceText,
      writable: options.writable ?? state.writable,
      fallbackMode: false,
    });
    announce(options.message || `Bron geladen: ${file.name}.`, 'success');
  };

  const openHandleDatabase = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(HANDLE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const storeHandle = async handle => {
    try {
      const database = await openHandleDatabase();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(HANDLE_STORE, 'readwrite');
        transaction.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    } catch {
      // Persistent handles are an enhancement; current-session sync remains available.
    }
  };

  const restoreHandle = async () => {
    if (!('indexedDB' in window) || !('showOpenFilePicker' in window)) return;
    try {
      const database = await openHandleDatabase();
      const handle = await new Promise((resolve, reject) => {
        const transaction = database.transaction(HANDLE_STORE, 'readonly');
        const request = transaction.objectStore(HANDLE_STORE).get(HANDLE_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      database.close();
      if (!handle) return;
      const readPermission = await handle.queryPermission({ mode: 'read' });
      if (readPermission !== 'granted') {
        elements.sourceName.textContent = handle.name;
        announce('Eerder bronbestand gevonden. Klik op Bronbestand koppelen om toestemming te herstellen.', 'warning');
        return;
      }
      const writePermission = await handle.queryPermission({ mode: 'readwrite' });
      await readHandle(handle, { writable: writePermission === 'granted', message: 'Gekoppelde registry automatisch hersteld.' });
    } catch {
      announce('Koppel het registrybestand om te beginnen.', 'neutral');
    }
  };

  const connectSource = async () => {
    if (!('showOpenFilePicker' in window)) {
      elements.fallbackFile.click();
      return;
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        id: 'numberninjadesigns-api-registry',
        multiple: false,
        types: [{ description: 'API registry JSON', accept: { 'application/json': ['.json'] } }],
      });
      const permission = await handle.requestPermission({ mode: 'readwrite' });
      await readHandle(handle, { writable: permission === 'granted' });
      await storeHandle(handle);
      if (permission !== 'granted') announce('Registry geladen met alleen-lezen toegang; opslaan is uitgeschakeld.', 'warning');
    } catch (error) {
      if (error?.name !== 'AbortError') announce(error.message || 'Bronbestand kon niet worden gekoppeld.', 'error');
    }
  };

  const importFallback = async file => {
    if (!file) return;
    try {
      const sourceText = await file.text();
      const registry = parseRegistry(sourceText);
      applyRegistry(registry, {
        handle: null,
        lastModified: file.lastModified,
        sourceText,
        writable: false,
        fallbackMode: true,
      });
      announce('Registry geïmporteerd in alleen-lezenmodus. Gebruik een Chromium-browser voor direct terugschrijven.', 'warning');
    } catch (error) {
      announce(error.message, 'error');
    } finally {
      elements.fallbackFile.value = '';
    }
  };

  const syncFormToRegistry = event => {
    const api = selectedApi();
    if (!api || !event.target.name) return;
    const field = event.target.name;
    if (field === 'id') return;
    api[field] = field in ARRAY_FIELDS ? splitList(event.target.value) : event.target.value.trim();
    state.dirty = JSON.stringify(state.registry) !== JSON.stringify(state.baseline);
    state.conflict = false;
    elements.selectedName.textContent = api.name || api.id;
    elements.selectedStatus.textContent = api.status;
    elements.selectedStatus.dataset.status = api.status;
    renderList();
    updateControls();
    announce(state.dirty ? 'Lokale conceptwijzigingen nog niet opgeslagen.' : 'Bron en editor zijn gelijk.', state.dirty ? 'warning' : 'success');
  };

  const resetSelected = () => {
    const original = baselineApi();
    const index = state.registry?.apis.findIndex(api => api.id === state.selectedId) ?? -1;
    if (!original || index < 0) return;
    state.registry.apis[index] = clone(original);
    state.dirty = JSON.stringify(state.registry) !== JSON.stringify(state.baseline);
    render();
    announce('De geselecteerde connector is hersteld naar de laatst geladen bron.', 'success');
  };

  const reloadSource = async () => {
    if (!state.handle) return;
    try {
      await readHandle(state.handle, { writable: state.writable, message: 'Bron opnieuw geladen; lokale conceptwijzigingen zijn verworpen.' });
    } catch (error) {
      announce(error.message, 'error');
    }
  };

  const saveSource = async () => {
    if (!state.handle || !state.writable || !state.registry || state.conflict) return;
    try {
      validateRegistry(state.registry);
      const currentFile = await state.handle.getFile();
      const currentText = await currentFile.text();
      if (currentFile.lastModified !== state.lastModified || currentText !== state.sourceText) {
        state.conflict = true;
        updateControls();
        announce('Opslaan geblokkeerd: VS Code of een ander proces heeft het bronbestand gewijzigd. Herlaad eerst.', 'warning');
        return;
      }
      const serialized = `${JSON.stringify(state.registry, null, 2)}\n`;
      const writable = await state.handle.createWritable({ keepExistingData: false });
      try {
        await writable.write(serialized);
        await writable.close();
      } catch (error) {
        await writable.abort();
        throw error;
      }
      const savedFile = await state.handle.getFile();
      state.lastModified = savedFile.lastModified;
      state.sourceText = serialized;
      state.baseline = clone(state.registry);
      state.dirty = false;
      state.conflict = false;
      render();
      announce('Registry opgeslagen. De wijziging is direct zichtbaar in VS Code.', 'success');
    } catch (error) {
      announce(error.message || 'Opslaan is mislukt.', 'error');
    }
  };

  const exportSource = () => {
    if (!state.registry) return;
    const blob = new Blob([`${JSON.stringify(state.registry, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = EXPECTED_FILE;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    announce('Backup JSON gedownload.', 'success');
  };

  const pollForExternalChanges = async () => {
    if (!state.handle || document.hidden) return;
    try {
      const file = await state.handle.getFile();
      if (file.lastModified === state.lastModified) return;
      if (state.dirty) {
        state.conflict = true;
        updateControls();
        announce('Externe wijziging gedetecteerd terwijl lokale conceptwijzigingen openstaan. Herlaad of download eerst een backup.', 'warning');
        return;
      }
      await readHandle(state.handle, { writable: state.writable, message: 'Wijziging uit VS Code automatisch geladen.' });
    } catch (error) {
      elements.dot.dataset.state = 'error';
      announce(error.message || 'Broncontrole is mislukt.', 'error');
    }
  };

  const bindEvents = () => {
    elements.connect.addEventListener('click', connectSource);
    elements.reload.addEventListener('click', reloadSource);
    elements.save.addEventListener('click', saveSource);
    elements.export.addEventListener('click', exportSource);
    elements.fallbackFile.addEventListener('change', () => importFallback(elements.fallbackFile.files?.[0]));
    elements.search.addEventListener('input', renderList);
    elements.list.addEventListener('click', event => {
      const button = event.target.closest('[data-api-id]');
      if (!button) return;
      state.selectedId = button.dataset.apiId;
      render();
    });
    elements.editor.addEventListener('input', syncFormToRegistry);
    elements.editor.addEventListener('submit', event => event.preventDefault());
    elements.reset.addEventListener('click', resetSelected);
    window.addEventListener('pagehide', () => clearInterval(state.pollTimer), { once: true });
  };

  bindEvents();
  updateControls();
  restoreHandle();
  state.pollTimer = window.setInterval(pollForExternalChanges, POLL_INTERVAL_MS);
})();
