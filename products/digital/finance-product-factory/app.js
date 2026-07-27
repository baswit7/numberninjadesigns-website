const {
  CHANNELS,
  CONTEXTS,
  OBJECTIVES,
  buildContentDraft,
} = globalThis.NumberNinjaContentStudio;

const STORAGE_KEY = 'nnd-content-studio-v1';
const MAX_DRAFTS = 30;
const state = {
  tab: 'studio',
  productType: 'digital',
  channel: 'facebook',
  contextId: 'numberninjadesigns',
  draft: null,
  drafts: [],
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const statusNode = $('#app-status');
const contextSelect = $('#product-context');
const contextName = $('#context-name');
const contextSummary = $('#context-summary');
const contextType = $('#context-type');
const contentContext = $('#content-context');
const resultNode = $('#content-result');
const draftActions = $('#draft-actions');
const savedDrafts = $('#saved-drafts');
const debugEnabled = new URLSearchParams(location.search).get('debug') === '1';

const debug = (event, details = {}) => {
  if (debugEnabled) console.debug(`[NumberNinjaDesigns] ${event}`, details);
};

const isSavedDraft = draft => Boolean(
  draft
  && typeof draft === 'object'
  && typeof draft.id === 'string'
  && typeof draft.generatedAt === 'string'
  && typeof draft.topic === 'string'
  && draft.content
  && typeof draft.content === 'object'
  && CONTEXTS[draft.context?.id]
  && CHANNELS[draft.channel?.id],
);

const announce = (message, tone = 'neutral') => {
  statusNode.textContent = message;
  statusNode.dataset.tone = tone;
};

const create = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const loadState = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (CONTEXTS[stored.contextId]) state.contextId = stored.contextId;
    if (CHANNELS[stored.channel]) state.channel = stored.channel;
    if (Array.isArray(stored.drafts)) state.drafts = stored.drafts.filter(isSavedDraft).slice(0, MAX_DRAFTS);
  } catch {
    announce('Lokale voorkeuren konden niet worden gelezen; veilige standaardwaarden zijn geladen.', 'warning');
  }
};

const persistState = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      contextId: state.contextId,
      channel: state.channel,
      drafts: state.drafts.slice(0, MAX_DRAFTS),
    }));
  } catch {
    announce('De browser kon deze concepten niet lokaal opslaan.', 'error');
  }
};

const configureTablist = (selector, activeValue, valueAttribute, panelPrefix) => {
  const buttons = $$(selector);
  buttons.forEach(button => {
    const value = button.dataset[valueAttribute];
    const selected = value === activeValue;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(`${panelPrefix}${value}`);
    if (panel) panel.hidden = !selected;
  });
};

const activateTab = (tab, moveFocus = false) => {
  if (!document.getElementById(`panel-${tab}`)) return;
  state.tab = tab;
  configureTablist('[data-tab]', tab, 'tab', 'panel-');
  const active = $(`[data-tab="${tab}"]`);
  if (moveFocus) active?.focus();
  history.replaceState(null, '', `#${tab}`);
  debug('tab_changed', { tab });
};

const activateProductType = (type, moveFocus = false) => {
  if (!['digital', 'physical'].includes(type)) return;
  state.productType = type;
  configureTablist('[data-product-type]', type, 'productType', 'product-');
  if (moveFocus) $(`[data-product-type="${type}"]`)?.focus();
};

const activateChannel = (channel, moveFocus = false) => {
  if (!CHANNELS[channel]) return;
  state.channel = channel;
  configureTablist('[data-channel]', channel, 'channel', 'channel-help-');
  if (moveFocus) $(`[data-channel="${channel}"]`)?.focus();
  resultNode.replaceChildren(create('p', 'empty-state', `Klaar voor een ${CHANNELS[channel].name}-concept. Vul het onderwerp in en kies Genereren.`));
  state.draft = null;
  draftActions.hidden = true;
  persistState();
};

const populateSelect = (select, entries, selectedId) => {
  const fragment = document.createDocumentFragment();
  Object.values(entries).forEach(entry => {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.name;
    option.selected = entry.id === selectedId;
    fragment.append(option);
  });
  select.replaceChildren(fragment);
};

const updateContext = contextId => {
  const context = CONTEXTS[contextId];
  if (!context) return;
  state.contextId = contextId;
  contextSelect.value = contextId;
  contextName.textContent = context.name;
  contextSummary.textContent = `${context.label} actief · gedeelde context ${context.id}`;
  contextType.textContent = context.label;
  contentContext.textContent = context.name;
  $('#context-guardrail').textContent = context.guardrail;
  persistState();
  debug('context_changed', { contextId });
};

const appendValue = (container, label, value) => {
  const group = create('div', 'result-item');
  group.append(create('dt', '', label));
  const definition = create('dd');
  if (Array.isArray(value)) {
    const list = create('ul', 'plain-list');
    value.forEach(item => list.append(create('li', '', String(item))));
    definition.append(list);
  } else {
    definition.textContent = String(value);
  }
  group.append(definition);
  container.append(group);
};

const renderDraft = draft => {
  const wrapper = create('div', 'draft-preview');
  const header = create('div', 'draft-preview-header');
  const heading = create('h3', '', `${draft.channel.name} · ${draft.context.name}`);
  const stamp = create('span', 'badge', draft.objective);
  header.append(heading, stamp);

  const meta = create('p', 'preview-meta', `${draft.topic} · ${draft.locale}`);
  const values = create('dl', 'result-list');
  Object.entries(draft.content).forEach(([label, value]) => appendValue(values, label, value));
  const guardrail = create('p', 'guardrail');
  guardrail.append(create('strong', '', 'Publicatiecontrole: '), document.createTextNode(draft.guardrail));
  wrapper.append(header, meta, values, guardrail);
  resultNode.replaceChildren(wrapper);
  draftActions.hidden = false;
};

const renderSavedDrafts = () => {
  savedDrafts.replaceChildren();
  if (!state.drafts.length) {
    savedDrafts.append(create('p', 'empty-state compact', 'Nog geen lokaal opgeslagen concepten.'));
    return;
  }
  state.drafts.forEach(draft => {
    const item = create('article', 'saved-draft');
    const copy = create('div');
    copy.append(
      create('strong', '', `${draft.channel.name} · ${draft.context.name}`),
      create('span', '', `${draft.topic} · ${new Date(draft.generatedAt).toLocaleString('nl-NL')}`),
    );
    const open = create('button', 'text-button', 'Open');
    open.type = 'button';
    open.dataset.openDraft = draft.id;
    const remove = create('button', 'text-button danger', 'Verwijder');
    remove.type = 'button';
    remove.dataset.deleteDraft = draft.id;
    const controls = create('div', 'saved-controls');
    controls.append(open, remove);
    item.append(copy, controls);
    savedDrafts.append(item);
  });
};

const draftAsText = draft => {
  const lines = [`${draft.channel.name} · ${draft.context.name}`, `${draft.topic}`, ''];
  Object.entries(draft.content).forEach(([label, value]) => {
    lines.push(`${label}:`, Array.isArray(value) ? value.join('\n') : String(value), '');
  });
  lines.push(`Publicatiecontrole: ${draft.guardrail}`);
  return lines.join('\n');
};

const copyText = async text => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.className = 'clipboard-fallback';
  document.body.append(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('Kopiëren wordt niet ondersteund.');
};

const downloadDraft = draft => {
  const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${draft.context.id}-${draft.channel.id}-${draft.generatedAt.slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const handleKeyboardTabs = event => {
  const current = event.target.closest('[role="tab"]');
  if (!current || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...current.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
  const position = tabs.indexOf(current);
  let next = position;
  if (event.key === 'ArrowLeft') next = (position - 1 + tabs.length) % tabs.length;
  if (event.key === 'ArrowRight') next = (position + 1) % tabs.length;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = tabs.length - 1;
  event.preventDefault();
  tabs[next].click();
  tabs[next].focus();
};

const bindEvents = () => {
  document.addEventListener('keydown', handleKeyboardTabs);
  document.addEventListener('click', async event => {
    const tab = event.target.closest('[data-tab]');
    if (tab) activateTab(tab.dataset.tab);

    const opener = event.target.closest('[data-open-tab]');
    if (opener) activateTab(opener.dataset.openTab, true);

    const productType = event.target.closest('[data-product-type]');
    if (productType) activateProductType(productType.dataset.productType);

    const channel = event.target.closest('[data-channel]');
    if (channel) activateChannel(channel.dataset.channel);

    const openDraft = event.target.closest('[data-open-draft]');
    if (openDraft) {
      const draft = state.drafts.find(item => item.id === openDraft.dataset.openDraft);
      if (draft) {
        state.draft = draft;
        updateContext(draft.context.id);
        activateChannel(draft.channel.id);
        state.draft = draft;
        renderDraft(draft);
        announce('Opgeslagen concept geopend.', 'success');
      }
    }

    const deleteDraft = event.target.closest('[data-delete-draft]');
    if (deleteDraft) {
      state.drafts = state.drafts.filter(item => item.id !== deleteDraft.dataset.deleteDraft);
      persistState();
      renderSavedDrafts();
      announce('Lokaal concept verwijderd.', 'success');
    }
  });

  contextSelect.addEventListener('change', () => updateContext(contextSelect.value));

  $('#new-product').addEventListener('click', () => activateTab('products', true));

  $('#content-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      state.draft = buildContentDraft({
        contextId: state.contextId,
        channelId: state.channel,
        objectiveId: $('#content-objective').value,
        topic: $('#content-topic').value,
        locale: $('#content-locale').value,
      });
      renderDraft(state.draft);
      announce(`${state.draft.channel.name}-concept gegenereerd. Controleer het vóór publicatie.`, 'success');
      debug('draft_generated', { channel: state.channel, contextId: state.contextId });
    } catch (error) {
      announce(error.message, 'error');
      $('#content-topic').focus();
    }
  });

  $('#save-draft').addEventListener('click', () => {
    if (!state.draft) return;
    state.drafts = [state.draft, ...state.drafts.filter(item => item.id !== state.draft.id)].slice(0, MAX_DRAFTS);
    persistState();
    renderSavedDrafts();
    announce('Concept lokaal opgeslagen. Er zijn geen API-sleutels of tokens bewaard.', 'success');
  });

  $('#copy-draft').addEventListener('click', async () => {
    if (!state.draft) return;
    try {
      await copyText(draftAsText(state.draft));
      announce('Concept naar het klembord gekopieerd.', 'success');
    } catch (error) {
      announce(error.message, 'error');
    }
  });

  $('#download-draft').addEventListener('click', () => {
    if (!state.draft) return;
    downloadDraft(state.draft);
    announce('Concept als JSON gedownload.', 'success');
  });
};

const checkRuntime = async () => {
  const indicator = $('#runtime-indicator');
  const label = $('#runtime-label');
  if (location.protocol === 'file:') {
    indicator.dataset.state = 'local';
    label.textContent = 'bestandsmodus';
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch('/api/health', { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    indicator.dataset.state = 'connected';
    label.textContent = 'verbonden';
  } catch {
    indicator.dataset.state = 'error';
    label.textContent = 'runtime niet bereikbaar';
  } finally {
    clearTimeout(timeout);
  }
};

const initialise = () => {
  loadState();
  populateSelect(contextSelect, CONTEXTS, state.contextId);
  populateSelect($('#content-objective'), OBJECTIVES, 'awareness');
  updateContext(state.contextId);
  activateProductType('digital');
  activateChannel(state.channel);
  const requestedTab = location.hash.slice(1);
  activateTab(document.getElementById(`panel-${requestedTab}`) ? requestedTab : 'studio');
  renderSavedDrafts();
  bindEvents();
  checkRuntime();
};

initialise();
