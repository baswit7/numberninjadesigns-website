import { createBatchPlan, resumeBatch, runBatch } from '../../src/engines/batch-engine.js';
import { configurationHash } from '../../src/engines/configuration-engine.js';
import {
  exportDraft as serializeDraft,
  importDraft as parseDraft,
  loadDraft,
  loadUiPreferences,
  resetDraft,
  saveDraft,
  saveUiPreferences,
} from '../../src/engines/persistence-engine.js';
import { SECURITY_LIMITS, sanitizeFilename, validateZipPath } from '../../src/engines/security.js';
import { createFactoryRuntime } from '../../src/factory-runtime.js';
import { LISTING_IMAGE_PATHS } from '../../src/commercial/listing-image-engine.js';
import { currencyCatalog } from '../../src/currencies/index.mjs';
import { localeCatalog, productionLocaleIds } from '../../src/locales/index.mjs';
import { productDefinitions } from '../../src/products/index.mjs';
import { themeCatalog } from '../../src/themes/index.mjs';

const STEPS = Object.freeze([
  ['ui.step.product', 'ui.stepDescription.product'],
  ['ui.step.market', 'ui.stepDescription.market'],
  ['ui.step.locale', 'ui.stepDescription.locale'],
  ['ui.step.configuration', 'ui.stepDescription.configuration'],
  ['ui.step.categories', 'ui.stepDescription.categories'],
  ['ui.step.theme', 'ui.stepDescription.theme'],
  ['ui.step.preview', 'ui.stepDescription.preview'],
  ['ui.step.validation', 'ui.stepDescription.validation'],
  ['ui.step.generation', 'ui.stepDescription.generation'],
  ['ui.step.quality', 'ui.stepDescription.quality'],
  ['ui.step.export', 'ui.stepDescription.export'],
  ['ui.step.approval', 'ui.stepDescription.approval'],
]);

const GENERATION_STAGE_KEYS = Object.freeze({
  VALIDATED: 'ui.generation.stage.validated',
  WORKBOOK_GENERATED: 'ui.generation.stage.workbookGenerated',
  WORKBOOK_REREAD: 'ui.generation.stage.workbookReread',
  DOCUMENTS_GENERATED: 'ui.generation.stage.documentsGenerated',
  COMPATIBILITY_VERIFIED: 'ui.generation.stage.compatibilityVerified',
  QUALITY_SCORED: 'ui.generation.stage.qualityScored',
  PACKAGE_BUILT: 'ui.generation.stage.packageBuilt',
  COMPLETE: 'ui.generation.stage.complete',
});

const PRODUCT_FAMILY_KEYS = Object.freeze({
  'bill-management': 'ui.family.billManagement',
  'debt-repayment': 'ui.family.debtRepayment',
  'micro-business': 'ui.family.microBusiness',
  'net-worth': 'ui.family.netWorth',
  'personal-budgeting': 'ui.family.personalBudgeting',
  'personal-finance-os': 'ui.family.personalBudgeting',
  'career-job-application': 'ui.family.careerJobApplication',
  'project-management': 'ui.family.projectManagement',
  'recurring-expenses': 'ui.family.recurringExpenses',
  savings: 'ui.family.savings',
  'small-business': 'ui.family.smallBusiness',
  'wedding-planning': 'ui.family.weddingPlanning',
});

const GENERATOR_LOCALE = 'nl-NL';
const DEFAULT_GENERATOR_APPEARANCE = 'light';
const TUTORIAL_SETTINGS_KEY = 'finance-product-factory:tutorial-settings:v1';
const REQUIRED_LISTING_IMAGE_PATHS = Object.freeze([...LISTING_IMAGE_PATHS]);
const EXTRACTED_ZIP_KINDS = new Set(['package', 'images', 'batch']);

const $ = id => document.getElementById(id);
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const activeProducts = productDefinitions.filter(definition => definition.status === 'active' || definition.extensions?.releaseCandidate === true);
const factory = createFactoryRuntime({ definitions: productDefinitions, locales: localeCatalog, currencies: currencyCatalog, themes: themeCatalog });
const debugEntries = [];

let suppressFormEvents = false;
let draftTimer = null;
let activePreviewSheet = null;
let batchController = null;
let currentBatchPlan = null;
let summaryRenderVersion = 0;
let listingImageSource = null;
let listingImageUrls = [];
let draftStatusKey = 'ui.status.saved';
let runtimeStatus = { status: 'busy', key: 'ui.shell.runtimeLoading', parameters: {} };
let tutorialPolling = false;

const state = {
  step: 1,
  configuration: null,
  audience: '',
  preview: null,
  validation: null,
  generation: null,
  approval: { status: 'DRAFT', reason: '', decidedAt: null },
  batchRun: null,
  batchArchive: null,
  generatorAppearance: DEFAULT_GENERATOR_APPEARANCE,
  savedOutputs: { workbook: null, package: null, images: null, image: null, batch: null },
};

function element(tag, options = {}, text = null) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.type) node.type = options.type;
  if (options.role) node.setAttribute('role', options.role);
  if (options.value !== undefined) node.value = options.value;
  if (options.name) node.name = options.name;
  if (options.id) node.id = options.id;
  if (text !== null) node.textContent = text;
  return node;
}

function moveCompositeFocus(event, itemRole) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  const groupRole = itemRole === 'tab' ? 'tablist' : 'radiogroup';
  const group = event.currentTarget.closest(`[role="${groupRole}"]`);
  const items = [...(group?.querySelectorAll(`[role="${itemRole}"]:not(:disabled)`) ?? [])];
  if (!items.length) return;
  const currentIndex = Math.max(0, items.indexOf(event.currentTarget));
  let nextIndex;
  if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = items.length - 1;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + items.length) % items.length;
  else nextIndex = (currentIndex + 1) % items.length;
  event.preventDefault();
  const target = items[nextIndex];
  const identity = target.dataset.themeId ?? target.dataset.productId ?? target.id;
  target.click();
  const replacement = [...(group?.querySelectorAll(`[role="${itemRole}"]:not(:disabled)`) ?? [])]
    .find(item => (item.dataset.themeId ?? item.dataset.productId ?? item.id) === identity);
  replacement?.focus();
}

function debug(message, data = null) {
  const entry = `${new Date().toISOString()} ${message}${data === null ? '' : ` ${JSON.stringify(data)}`}`;
  debugEntries.push(entry);
  if (debugEntries.length > 100) debugEntries.shift();
  $('debugLog').textContent = debugEntries.join('\n');
}

function announce(message) {
  $('liveRegion').textContent = '';
  requestAnimationFrame(() => { $('liveRegion').textContent = message; });
}

function alertUser(message) {
  $('globalAlert').textContent = String(message);
  $('globalAlert').hidden = false;
  announce(message);
}

function clearAlert() {
  $('globalAlert').hidden = true;
  $('globalAlert').textContent = '';
}

function setRuntimeStatus(status, key, parameters = {}) {
  runtimeStatus = { status, key, parameters };
  $('connectionStatus').dataset.state = status;
  $('connectionText').textContent = translate(key, key, parameters);
}

function currentDefinition() {
  return state.configuration ? factory.resolveProduct(state.configuration.productId, { version: state.configuration.productVersion, allowBeta: true }) : null;
}

function declaredOutputTypes(definition = currentDefinition()) {
  return definition?.outputTypes ?? ['xlsx', 'zip'];
}

function supportsOutput(type, definition = currentDefinition()) {
  return declaredOutputTypes(definition).includes(type);
}

function primaryExtension(definition = currentDefinition()) {
  return supportsOutput('xlsx', definition) ? '.xlsx' : '.docx';
}

function localizedDocumentTemplates(definition = currentDefinition(), locale = state.configuration?.locale) {
  const language = String(locale ?? 'nl-NL').split('-')[0];
  return (definition?.documentTemplates ?? []).filter(template => template.language === language);
}

function interpolate(template, parameters) {
  return String(template).replace(/\{([a-zA-Z][\w]*)\}/g, (token, name) => Object.hasOwn(parameters, name) ? String(parameters[name]) : token);
}

function translate(key, fallback = key, parameters = {}) {
  const template = localeCatalog[GENERATOR_LOCALE]?.messages?.[key] ?? fallback;
  return interpolate(template, parameters);
}

function friendlyError(error) {
  const rawCode = typeof error?.code === 'string' ? error.code : 'ONBEKEND';
  const code = rawCode.replace(/[^A-Z0-9_-]/gi, '').slice(0, 40).toUpperCase() || 'ONBEKEND';
  return translate('ui.error.genericWithCode', '', { code });
}

function number(value, options = {}) {
  return new Intl.NumberFormat(GENERATOR_LOCALE, options).format(value);
}

function displayName(type, code) {
  try {
    return new Intl.DisplayNames([GENERATOR_LOCALE], { type }).of(code) ?? code;
  } catch {
    return code;
  }
}

function productFamilyLabel(id) {
  return translate(PRODUCT_FAMILY_KEYS[id] ?? 'ui.family.other', id.replaceAll('-', ' '));
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${number(value)} bytes`;
  if (value < 1024 ** 2) return `${number(value / 1024, { maximumFractionDigits: 1 })} KiB`;
  return `${number(value / 1024 ** 2, { maximumFractionDigits: 1 })} MiB`;
}

function statusLabel(status) {
  const key = {
    PASS: 'validation.pass',
    PASS_WITH_WARNINGS: 'validation.passWithWarnings',
    PASS_WITH_FAILURES: 'ui.status.passWithFailures',
    FAIL: 'validation.fail',
    BLOCKED: 'validation.blocked',
    RUNNING: 'ui.status.running',
    CANCELLED: 'ui.status.cancelled',
    DRAFT: 'ui.status.draft',
    READY_FOR_REVIEW: 'ui.status.readyForReview',
    REVIEW_REQUIRED: 'ui.status.reviewRequired',
    APPROVED: 'ui.approval.status.approved',
    REJECTED: 'ui.approval.status.rejected',
  }[status];
  return key ? translate(key, status) : status;
}

function localizedAudience(definition) {
  if (!definition) return translate('ui.audience.default');
  const formatter = new Intl.ListFormat(GENERATOR_LOCALE, { style: 'long', type: 'conjunction' });
  return formatter.format(definition.commercialMetadata.targetAudience.map(id => translate(`ui.audience.${id}`, id)));
}

function setDraftStatus(key) {
  draftStatusKey = key;
  $('draftState').textContent = translate(key);
}

function renderGateState() {
  const status = packageReleaseReady(state.generation, state.generation?.package)
    ? 'PASS'
    : state.generation?.package?.generatedManifest.releaseStatus
    ?? (state.validation ? (state.validation.valid ? 'PASS' : 'FAIL') : null);
  $('gateState').textContent = status ? statusLabel(status) : translate('ui.status.notStarted');
}

function applyStaticTranslations() {
  document.documentElement.lang = GENERATOR_LOCALE;
  document.title = translate('app.title', 'Finance Product Factory');
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = translate(node.dataset.i18n, node.textContent); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(node => { node.placeholder = translate(node.dataset.i18nPlaceholder, node.placeholder); });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(node => { node.setAttribute('aria-label', translate(node.dataset.i18nAriaLabel, node.getAttribute('aria-label') ?? '')); });
  [...$('market').options].forEach(option => { option.textContent = displayName('region', option.value); });
  [...$('inputCapacity').options].forEach(option => { option.textContent = translate('ui.batch.rowCount', option.textContent, { count: number(Number(option.value)) }); });
  setDraftStatus(draftStatusKey);
  setRuntimeStatus(runtimeStatus.status, runtimeStatus.key, runtimeStatus.parameters);
  if (!currentBatchPlan) $('batchSummary').textContent = translate('ui.batch.selectionEmpty');
}

function renderGeneratorAppearance() {
  const appearance = state.generatorAppearance === 'dark' ? 'dark' : DEFAULT_GENERATOR_APPEARANCE;
  document.documentElement.dataset.generatorAppearance = appearance;
  document.querySelectorAll('input[name="generatorAppearance"]').forEach(input => {
    input.checked = input.value === appearance;
  });
  document.querySelectorAll('[data-generator-appearance-value]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.generatorAppearanceValue === appearance));
  });
}

function restoreGeneratorAppearance() {
  const loaded = loadUiPreferences();
  loaded.warnings.forEach(warning => debug(warning));
  state.generatorAppearance = loaded.preferences.appearance;
  renderGeneratorAppearance();
}

function updateGeneratorAppearance(event) {
  const radio = event.target.matches('input[name="generatorAppearance"]') ? event.target : null;
  const quickButton = event.target.closest?.('[data-generator-appearance-value]');
  if (!quickButton && (!radio || !radio.checked)) return;
  try {
    const requested = quickButton?.dataset.generatorAppearanceValue ?? radio.value;
    state.generatorAppearance = requested === 'dark' ? 'dark' : DEFAULT_GENERATOR_APPEARANCE;
    saveUiPreferences({ schemaVersion: '1.0.0', appearance: state.generatorAppearance });
    renderGeneratorAppearance();
    announce(translate('ui.settings.appearanceSaved', '', {
      appearance: translate(`ui.settings.appearance${state.generatorAppearance === 'dark' ? 'Dark' : 'Light'}`),
    }));
  } catch (error) {
    state.generatorAppearance = DEFAULT_GENERATOR_APPEARANCE;
    renderGeneratorAppearance();
    debug('Generatorweergave kon niet worden opgeslagen', { message: error.message });
    alertUser(translate('ui.settings.appearanceError'));
  }
}

function draftState() {
  return {
    schemaVersion: '2.0.0',
    step: state.step,
    configuration: state.configuration,
    audience: state.audience,
    approval: state.approval,
    lastGeneration: state.generation?.summary ?? null,
  };
}

function scheduleDraftSave() {
  setDraftStatus('ui.status.saving');
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try {
      saveDraft(draftState());
      setDraftStatus('ui.status.saved');
    } catch (error) {
      setDraftStatus('ui.status.storageError');
      debug('Concept kon niet worden opgeslagen', { message: error.message });
      alertUser(friendlyError(error));
    }
  }, 250);
}

function invalidateGenerated(reason = 'Configuratie gewijzigd') {
  if (state.generation) debug(reason);
  state.preview = null;
  state.validation = null;
  state.generation = null;
  state.savedOutputs = { workbook: null, package: null, images: null, image: null, batch: state.savedOutputs.batch };
  state.approval = { status: 'DRAFT', reason: '', decidedAt: null };
  $('downloadWorkbook').disabled = true;
  $('downloadPackage').disabled = true;
  renderGateState();
  $('generationProgress').hidden = true;
  $('generationProgress').setAttribute('aria-valuenow', '0');
  $('generationProgressBar').style.width = '0%';
  $('generationStatus').textContent = '';
  renderPreview();
  renderGeneration();
  renderValidation();
  renderQuality();
  renderPackage();
  renderApproval();
}

function selectedProductName(definition = currentDefinition()) {
  return definition ? translate(definition.nameKey, definition.id) : translate('ui.status.noSelection');
}

function variantWorkbookFilename(definition, configuration) {
  const tierPrefix = {
    basic: 'basic-budget-planner',
    professional: 'professional-budget-planner',
    ultimate: 'ultimate-budget-planner',
  }[definition?.extensions?.tier] ?? definition?.id ?? 'finance-workbook';
  const appearance = configuration?.extensions?.productAppearance === 'dark' ? 'dark' : 'light';
  return `${sanitizeFilename(`${tierPrefix}-${configuration.locale}-${configuration.year}-${appearance}`)}.xlsx`;
}

function variantPrimaryFilename(definition, configuration) {
  if (supportsOutput('xlsx', definition)) return variantWorkbookFilename(definition, configuration);
  const appearance = configuration?.extensions?.productAppearance === 'dark' ? 'dark' : 'light';
  return `${sanitizeFilename(`${definition?.id ?? 'digital-product'}-${configuration.locale}-${appearance}`)}.docx`;
}

function setSelectOptions(select, entries, selectedValue) {
  const nodes = entries.map(([value, label]) => {
    const option = element('option', { value }, label);
    option.selected = value === selectedValue;
    return option;
  });
  select.replaceChildren(...nodes);
}

function syncDependentControls() {
  const definition = currentDefinition();
  if (!definition) return;
  const localeEntries = definition.supportedLocales
    .filter(id => productionLocaleIds.includes(id))
    .map(id => [id, `${id} · ${displayName('language', id.split('-')[0])}`]);
  setSelectOptions($('locale'), localeEntries, state.configuration.locale);
  setSelectOptions($('currency'), definition.supportedCurrencies.map(id => [id, `${id} · ${displayName('currency', id)}`]), state.configuration.currency);
  const platformEntries = [];
  if (supportsOutput('xlsx', definition)) {
    platformEntries.push(['excel', 'Excel · gevalideerde release-output'], ['google-sheets-compatible', 'Google Sheets · importprofiel']);
  }
  if (supportsOutput('docx', definition)) platformEntries.push(['word-google-docs-import', 'Word · Google Docs-import']);
  const selectedPlatform = platformEntries.some(([id]) => id === state.configuration.extensions?.platformProfile)
    ? state.configuration.extensions.platformProfile
    : platformEntries[0]?.[0] ?? 'excel';
  if (selectedPlatform !== state.configuration.extensions?.platformProfile) {
    state.configuration = {
      ...state.configuration,
      extensions: { ...state.configuration.extensions, platformProfile: selectedPlatform },
    };
  }
  setSelectOptions($('platformProfile'), platformEntries, selectedPlatform);
}

function renderProductFilters() {
  const families = [...new Set(activeProducts.map(product => product.productFamily))].sort();
  const current = $('familyFilter').value;
  setSelectOptions($('familyFilter'), [['', translate('ui.filter.allFamilies')], ...families.map(value => [value, productFamilyLabel(value)])], current);
}

function filteredProducts() {
  const locale = GENERATOR_LOCALE;
  const query = $('productSearch').value.trim().toLocaleLowerCase(locale);
  const family = $('familyFilter').value;
  const products = activeProducts.filter(definition => {
    const haystack = `${definition.id} ${definition.productFamily} ${translate(definition.nameKey, '')} ${translate(definition.descriptionKey, '')}`.toLocaleLowerCase(locale);
    return (!query || haystack.includes(query)) && (!family || definition.productFamily === family);
  });
  const sort = $('productSort').value;
  products.sort((left, right) => {
    if (sort === 'recommended' && left.recommended !== right.recommended) return Number(right.recommended) - Number(left.recommended);
    if (sort === 'family') return productFamilyLabel(left.productFamily).localeCompare(productFamilyLabel(right.productFamily), locale) || left.id.localeCompare(right.id, locale);
    return translate(left.nameKey, left.id).localeCompare(translate(right.nameKey, right.id), locale);
  });
  return products;
}

function renderProducts() {
  const products = filteredProducts();
  $('catalogCount').textContent = translate('ui.catalog.count', '', { count: number(products.length) });
  const hasSelectedProduct = products.some(definition => state.configuration?.productId === definition.id);
  const cards = products.map((definition, index) => {
    const card = element('button', { className: 'product-card', type: 'button', role: 'radio' });
    card.dataset.productId = definition.id;
    const selected = state.configuration?.productId === definition.id;
    card.setAttribute('aria-checked', String(selected));
    card.tabIndex = selected || (!hasSelectedProduct && index === 0) ? 0 : -1;
    const top = element('div', { className: 'card-top' });
    top.append(element('span', { className: 'product-code' }, productFamilyLabel(definition.productFamily)), element('span', { className: 'product-status' }, definition.extensions?.releaseCandidate ? translate('ui.catalog.releaseCandidate', 'Releasecandidate') : translate('ui.catalog.active')));
    const content = element('div');
    content.append(element('h3', {}, translate(definition.nameKey, definition.id)), element('p', {}, translate(definition.descriptionKey, definition.descriptionKey)));
    const meta = element('div', { className: 'card-meta' });
    const formats = declaredOutputTypes(definition).filter(type => type !== 'zip').map(type => type.toUpperCase()).join(' + ');
    const documentCount = definition.documentTemplates?.length ?? 0;
    const sheetCount = definition.sheets?.length ?? 0;
    meta.append(
      element('span', {}, formats || 'ZIP'),
      element('span', {}, documentCount ? `${number(documentCount)} documenten` : translate('ui.catalog.sheetCount', '', { count: number(sheetCount) })),
      element('span', {}, sheetCount ? `${number(sheetCount)} sheets` : 'DOCX-pakket'),
      element('span', {}, translate(`ui.difficulty.${definition.difficulty}`, definition.difficulty)),
    );
    card.append(top, content, meta);
    card.addEventListener('keydown', event => moveCompositeFocus(event, 'radio'));
    card.addEventListener('click', () => {
      selectProduct(definition.id);
      requestAnimationFrame(() => {
        [...$('productCatalog').querySelectorAll('[role="radio"]')].find(node => node.dataset.productId === definition.id)?.focus();
      });
    });
    return card;
  });
  $('productCatalog').replaceChildren(...(cards.length ? cards : [element('p', { className: 'empty-state' }, translate('ui.catalog.empty'))]));
}

function selectProduct(productId) {
  if (state.configuration?.productId === productId) return;
  const definition = factory.resolveProduct(productId, { allowBeta: true });
  state.configuration = factory.configuration(productId, definition.defaultConfiguration);
  state.audience = localizedAudience(definition);
  invalidateGenerated('Product gewijzigd');
  syncDependentControls();
  renderForm();
  renderProducts();
  renderThemes();
  renderSummary();
  renderStepNavigation();
  scheduleDraftSave();
  clearAlert();
}

function renderThemes() {
  const definition = currentDefinition();
  if (!definition) return;
  const cards = definition.supportedThemes.map((id, index) => {
    const theme = themeCatalog[id];
    const button = element('button', { className: 'theme-card', type: 'button', role: 'radio' });
    const selected = state.configuration.themeId === id;
    button.setAttribute('aria-checked', String(selected));
    button.tabIndex = selected || (!definition.supportedThemes.includes(state.configuration.themeId) && index === 0) ? 0 : -1;
    button.dataset.themeId = id;
    const preview = element('span', { className: 'theme-preview' });
    preview.style.setProperty('--theme-bg', theme.colors.background);
    preview.style.setProperty('--theme-primary', theme.colors.primary);
    preview.style.setProperty('--theme-accent', theme.colors.accent);
    preview.style.setProperty('--theme-muted', theme.colors.muted);
    const label = element('span', { className: 'theme-label' });
    label.append(element('strong', {}, translate(theme.nameKey, id)), element('small', {}, `${theme.fonts.heading} · ${theme.version}`));
    button.append(preview, label);
    button.addEventListener('keydown', event => moveCompositeFocus(event, 'radio'));
    button.addEventListener('click', () => {
      if (state.configuration.themeId !== id) {
        state.configuration = factory.configuration(state.configuration.productId, { ...state.configuration, themeId: id });
        invalidateGenerated('Thema gewijzigd');
        renderThemes();
        renderSummary();
        scheduleDraftSave();
      }
      requestAnimationFrame(() => {
        [...$('themeGrid').querySelectorAll('[role="radio"]')].find(node => node.dataset.themeId === id)?.focus();
      });
    });
    return button;
  });
  $('themeGrid').replaceChildren(...cards);
}

function renderRegionalPreview() {
  const configuration = state.configuration;
  if (!configuration) return;
  const values = [
    [translate('ui.regional.amount'), new Intl.NumberFormat(configuration.locale, { style: 'currency', currency: configuration.currency }).format(1234.56)],
    [translate('ui.regional.date'), new Intl.DateTimeFormat(configuration.locale, { dateStyle: 'long' }).format(new Date(Date.UTC(configuration.year, 0, 15, 12)))],
    [translate('ui.regional.workWeek'), translate(localeCatalog[configuration.locale]?.formats?.paperSize === 'Letter' ? 'ui.regional.sundayLetter' : 'ui.regional.mondayA4')],
  ];
  $('regionalPreview').replaceChildren(...values.map(([label, value]) => {
    const card = element('div');
    card.append(element('span', {}, label), element('strong', {}, value));
    return card;
  }));
}

function commitRenderedConfigurationDefaults() {
  const currentExtensions = state.configuration?.extensions ?? {};
  const renderedStartMonth = Number($('startMonth').value);
  const startMonth = Number.isInteger(currentExtensions.startMonth)
    && currentExtensions.startMonth >= 1
    && currentExtensions.startMonth <= 12
    ? currentExtensions.startMonth
    : (Number.isInteger(renderedStartMonth) && renderedStartMonth >= 1 && renderedStartMonth <= 12 ? renderedStartMonth : 1);
  const renderedOutputProfile = $('outputProfile').value;
  const outputProfile = ['repository-release', 'browser-download'].includes(currentExtensions.outputProfile)
    ? currentExtensions.outputProfile
    : (['repository-release', 'browser-download'].includes(renderedOutputProfile) ? renderedOutputProfile : 'repository-release');
  if (currentExtensions.startMonth === startMonth && currentExtensions.outputProfile === outputProfile) return;
  state.configuration = {
    ...state.configuration,
    extensions: {
      ...currentExtensions,
      startMonth,
      outputProfile,
    },
  };
}

function renderForm() {
  if (!state.configuration) return;
  suppressFormEvents = true;
  syncDependentControls();
  $('market').value = state.configuration.market;
  $('audience').value = state.audience;
  $('locale').value = state.configuration.locale;
  $('currency').value = state.configuration.currency;
  $('platformProfile').value = state.configuration.extensions?.platformProfile ?? 'excel';
  $('productTitle').value = state.configuration.title;
  const extension = primaryExtension();
  $('filenameExtension').textContent = extension;
  $('filename').value = state.configuration.filename.replace(/\.(?:xlsx|docx)$/i, '');
  $('year').value = String(state.configuration.year);
  $('startMonth').value = String(state.configuration.extensions?.startMonth ?? 1);
  $('inputCapacity').value = String(state.configuration.inputCapacity);
  $('outputProfile').value = state.configuration.extensions?.outputProfile ?? 'repository-release';
  commitRenderedConfigurationDefaults();
  $('sampleDataEnabled').checked = state.configuration.sampleDataEnabled;
  $('carryOver').checked = Boolean(state.configuration.featureFlags.carryOver);
  const productAppearance = state.configuration.extensions?.productAppearance === 'dark' ? 'dark' : 'light';
  const supportedAppearances = currentDefinition()?.extensions?.supportedAppearances ?? ['light', 'dark'];
  for (const input of $('productAppearance').querySelectorAll('input[name="productAppearance"]')) {
    input.checked = input.value === productAppearance;
    input.disabled = !supportedAppearances.includes(input.value);
  }
  $('categories').value = state.configuration.categoryOverrides.join('\n');
  $('categoryCount').textContent = translate('ui.category.count', '', { count: number(state.configuration.categoryOverrides.length) });
  renderProductContent();
  suppressFormEvents = false;
  renderRegionalPreview();
  renderGeneration();
}

function renderProductContent() {
  const definition = currentDefinition();
  const templates = localizedDocumentTemplates(definition);
  $('workbookCategoriesEditor').hidden = false;
  $('categoryCount').hidden = false;
  $('documentContent').hidden = templates.length === 0;
  $('documentTemplateCount').textContent = `${number(templates.length)} DOCX`;
  $('documentTemplateList').replaceChildren(...templates.map(template => {
    const row = element('article', { className: 'document-template-row' });
    const copy = element('div');
    copy.append(element('strong', {}, template.title), element('span', {}, template.filename));
    row.append(copy, element('span', { className: 'document-template-sections' }, `${number(template.sections.length)} secties`));
    return row;
  }));
}

function categoriesFromText() {
  const raw = $('categories').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  const unique = [];
  const seen = new Set();
  let duplicate = false;
  for (const value of raw) {
    const key = value.toLocaleLowerCase(state.configuration?.locale ?? 'nl-NL');
    if (seen.has(key)) duplicate = true;
    else { seen.add(key); unique.push(value); }
  }
  $('categories').setCustomValidity(
    duplicate
      ? translate('ui.category.errorDuplicate')
      : unique.length > 100
        ? translate('ui.category.errorMaximum')
        : unique.length < 10
          ? translate('ui.category.errorMinimum')
          : '',
  );
  return unique;
}

function updateConfigurationFromForm(event) {
  if (suppressFormEvents || !state.configuration) return;
  const targetId = event.target.id;
  const previous = state.configuration;
  const previousDefinition = currentDefinition();
  const previousDefaultAudience = localizedAudience(previousDefinition);
  const previousVariantFilename = variantPrimaryFilename(previousDefinition, previous);
  const previousLocalizedTitle = factory.translator(previous.locale)(previousDefinition.nameKey, previousDefinition.defaultConfiguration.title);
  let next = { ...previous };
  if (targetId === 'market') next.market = $('market').value;
  else if (targetId === 'audience') state.audience = $('audience').value.trim();
  else if (targetId === 'locale') next.locale = $('locale').value;
  else if (targetId === 'currency') next.currency = $('currency').value;
  else if (targetId === 'platformProfile') next.extensions = { ...next.extensions, platformProfile: $('platformProfile').value };
  else if (targetId === 'productTitle') next.title = $('productTitle').value.trim();
  else if (targetId === 'filename') {
    const sanitized = sanitizeFilename($('filename').value);
    $('filename').value = sanitized;
    next.filename = `${sanitized}${primaryExtension(previousDefinition)}`;
  }
  else if (targetId === 'year') next.year = Number($('year').value);
  else if (targetId === 'startMonth') next.extensions = { ...next.extensions, startMonth: Number($('startMonth').value) };
  else if (targetId === 'inputCapacity') next.inputCapacity = Number($('inputCapacity').value);
  else if (targetId === 'outputProfile') next.extensions = { ...next.extensions, outputProfile: $('outputProfile').value };
  else if (targetId === 'sampleDataEnabled') next.sampleDataEnabled = $('sampleDataEnabled').checked;
  else if (targetId === 'carryOver') next.featureFlags = { ...next.featureFlags, carryOver: $('carryOver').checked };
  else if (targetId === 'productAppearanceLight' || targetId === 'productAppearanceDark') {
    next.extensions = { ...next.extensions, productAppearance: event.target.value };
  }
  else if (targetId === 'categories') {
    next.categoryOverrides = categoriesFromText();
    next.extensions = {
      ...next.extensions,
      categoryResolution: {
        ...(next.extensions?.categoryResolution ?? {}),
        source: next.categoryOverrides.length ? 'MANUAL' : 'AUTO',
      },
    };
  }
  if (['locale', 'year', 'productAppearanceLight', 'productAppearanceDark'].includes(targetId)
    && [previousVariantFilename, previousDefinition?.defaultConfiguration.filename].includes(previous.filename)) {
    next.filename = variantPrimaryFilename(previousDefinition, next);
    $('filename').value = next.filename.replace(/\.(?:xlsx|docx)$/i, '');
  }
  if (targetId !== 'audience') {
    const resolveImmediately = ['market', 'locale', 'currency', 'platformProfile', 'startMonth', 'inputCapacity', 'outputProfile', 'sampleDataEnabled', 'carryOver', 'productAppearanceLight', 'productAppearanceDark', 'categories'].includes(targetId);
    state.configuration = resolveImmediately ? factory.configuration(next.productId, next) : next;
    if ((targetId === 'locale' && state.configuration.extensions?.categoryResolution?.source === 'AUTO')
      || (targetId === 'categories' && next.categoryOverrides.length === 0)) {
      $('categories').value = state.configuration.categoryOverrides.join('\n');
    }
  }
  if (targetId === 'locale') {
    if ([previousLocalizedTitle, previousDefinition.defaultConfiguration.title].includes(previous.title)) {
      state.configuration = {
        ...state.configuration,
        title: factory.translator(state.configuration.locale)(previousDefinition.nameKey, previousDefinition.defaultConfiguration.title),
      };
      $('productTitle').value = state.configuration.title;
    }
    const rawAudience = previousDefinition?.commercialMetadata.targetAudience.join(', ');
    if (state.audience === previousDefaultAudience || state.audience === rawAudience) state.audience = localizedAudience(previousDefinition);
    $('audience').value = state.audience;
    syncDependentControls();
  }
  $('categoryCount').textContent = translate('ui.category.count', '', { count: number(state.configuration.categoryOverrides.length) });
  invalidateGenerated('Configuratie gewijzigd');
  renderRegionalPreview();
  renderProductContent();
  renderSummary();
  renderStepChrome();
  scheduleDraftSave();
}

const STEP_CONTROL_IDS = Object.freeze({
  2: ['market', 'audience'],
  3: ['locale', 'currency', 'platformProfile'],
  4: ['productTitle', 'filename', 'year', 'startMonth', 'inputCapacity', 'outputProfile'],
  5: ['categories'],
});

function stepControlsValid(step) {
  return (STEP_CONTROL_IDS[step] ?? []).every(id => $(id).checkValidity());
}

function reportFirstInvalidControl(step) {
  const control = (STEP_CONTROL_IDS[step] ?? []).map($).find(node => !node.checkValidity());
  if (!control) return;
  control.reportValidity();
  control.focus();
}

function stepComplete(step) {
  const configuration = state.configuration;
  if (step === 1) return Boolean(configuration);
  if (step === 2) return stepControlsValid(step) && Boolean(configuration?.market && state.audience);
  if (step === 3) return stepControlsValid(step) && Boolean(configuration?.locale && configuration?.currency && configuration?.extensions?.platformProfile);
  if (step === 4) return stepControlsValid(step) && Boolean(configuration?.title && configuration?.filename && Number.isInteger(configuration?.year) && Number.isInteger(configuration?.extensions?.startMonth) && configuration?.inputCapacity && configuration?.extensions?.outputProfile);
  if (step === 5) return stepControlsValid(step);
  if (step === 6) return Boolean(configuration?.themeId && ['light', 'dark'].includes(configuration?.extensions?.productAppearance));
  if (step === 7) return Boolean(state.preview);
  if (step === 8) return state.validation?.valid === true;
  if (step === 9) return Boolean(state.generation);
  if (step === 10) return state.generation?.qualityReport?.status === 'PASS';
  if (step === 11) return packageReleaseReady(state.generation, state.generation?.package);
  if (step === 12) return ['APPROVED', 'REJECTED'].includes(state.approval.status);
  return false;
}

function renderStepNavigation() {
  const buttons = STEPS.map(([titleKey], index) => {
    const step = index + 1;
    const button = element('button', { className: 'step-button', type: 'button' });
    button.dataset.state = stepComplete(step) ? 'complete' : state.step === step && $('globalAlert').hidden === false ? 'error' : 'idle';
    if (state.step === step) button.setAttribute('aria-current', 'step');
    button.append(element('span', { className: 'step-index' }, String(step).padStart(2, '0')), element('span', { className: 'step-label' }, translate(titleKey)), element('span', { className: 'step-state' }));
    button.addEventListener('click', () => goToStep(step));
    return button;
  });
  $('stepNavigation').replaceChildren(...buttons);
}

function renderStepChrome() {
  document.querySelectorAll('.step-panel').forEach(panel => { panel.hidden = Number(panel.dataset.step) !== state.step; });
  $('stepEyebrow').textContent = translate('ui.step.position', '', { current: number(state.step), total: number(STEPS.length) });
  $('stepTitle').textContent = translate(STEPS[state.step - 1][0]);
  $('stepDescription').textContent = translate(STEPS[state.step - 1][1]);
  $('progressBar').style.width = `${state.step / STEPS.length * 100}%`;
  $('previousStep').disabled = state.step === 1;
  $('nextStep').textContent = translate(state.step === STEPS.length ? 'ui.common.finish' : 'ui.common.next');
  $('stepHint').textContent = translate(stepComplete(state.step) ? 'ui.step.complete' : 'ui.step.incomplete');
  renderStepNavigation();
}

function goToStep(step) {
  state.step = clamp(step, 1, STEPS.length);
  renderStepChrome();
  if (state.step === 7) refreshPreview();
  if (state.step === 8) renderValidation();
  if (state.step === 10) renderQuality();
  if (state.step === 11) renderPackage();
  if (state.step === 12) renderApproval();
  scheduleDraftSave();
  $('workspace').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function nextStep() {
  clearAlert();
  if (state.step <= 6 && !stepComplete(state.step)) {
    alertUser(translate('ui.step.errorIncomplete'));
    reportFirstInvalidControl(state.step);
    renderStepNavigation();
    return;
  }
  if (state.step === 7 && !state.preview) refreshPreview();
  if (state.step === 8 && !state.validation?.valid) {
    runPreflight();
    if (!state.validation?.valid) return;
  }
  if (state.step === 9 && !state.generation) {
    alertUser(translate('ui.step.errorGenerationRequired'));
    return;
  }
  if (state.step === 10 && state.generation?.qualityReport?.status !== 'PASS') {
    alertUser(translate('ui.step.errorQualityRequired'));
    return;
  }
  if (state.step === 11 && !packageReleaseReady(state.generation, state.generation?.package)) {
    alertUser(translate('ui.step.errorPackageRequired'));
    return;
  }
  if (state.step === 12) {
    announce(translate('ui.step.flowComplete'));
    return;
  }
  goToStep(state.step + 1);
}

function refreshPreview() {
  try {
    state.configuration = factory.configuration(state.configuration.productId, state.configuration);
    state.preview = factory.preview(state.configuration);
    activePreviewSheet = state.preview.type === 'document'
      ? null
      : activePreviewSheet && state.preview.sheets.some(sheet => sheet.id === activePreviewSheet) ? activePreviewSheet : state.preview.sheets[0]?.id;
    renderPreview();
    renderStepChrome();
  } catch (error) {
    state.preview = null;
    debug('Preview kon niet worden opgebouwd', { code: error.code ?? 'ERROR', message: error.message });
    alertUser(friendlyError(error));
    renderStepChrome();
  }
}

function renderPreview() {
  if (!state.preview) {
    $('workbookPreview').replaceChildren(element('p', {}, translate('ui.preview.unavailable')));
    $('previewSpec').replaceChildren();
    return;
  }
  if (state.preview.type === 'document') {
    const documentList = element('div', { className: 'document-preview-list' });
    for (const document of state.preview.documents) {
      const row = element('article', { className: 'document-preview-row' });
      const copy = element('div');
      copy.append(element('strong', {}, document.title), element('span', {}, document.filename));
      row.append(copy, element('span', { className: 'document-template-sections' }, `${number(document.sections)} secties`));
      documentList.append(row);
    }
    $('workbookPreview').replaceChildren(documentList);
    const details = [
      ['Product', state.preview.productId],
      ['Taal', state.preview.locale],
      ['Formaat', 'DOCX'],
      ['Documenten', number(state.preview.documents.length)],
      ['Validatie', 'OOXML + placeholders + paden'],
    ];
    const dl = element('dl');
    for (const [term, value] of details) {
      const row = element('div');
      row.append(element('dt', {}, term), element('dd', {}, value));
      dl.append(row);
    }
    $('previewSpec').replaceChildren(dl);
    return;
  }
  const tabs = element('div', { className: 'preview-tabs', role: 'tablist' });
  tabs.setAttribute('aria-label', translate('ui.a11y.previewTabs'));
  for (const sheet of state.preview.sheets) {
    const button = element('button', { type: 'button', role: 'tab' }, sheet.name);
    const selected = sheet.id === activePreviewSheet;
    const tabId = `preview-tab-${sheet.id}`;
    button.id = tabId;
    button.tabIndex = selected ? 0 : -1;
    button.setAttribute('aria-selected', String(selected));
    button.setAttribute('aria-controls', 'preview-sheet-panel');
    button.addEventListener('keydown', event => moveCompositeFocus(event, 'tab'));
    button.addEventListener('click', () => {
      activePreviewSheet = sheet.id;
      renderPreview();
      $(tabId)?.focus();
    });
    tabs.append(button);
  }
  const selected = state.preview.sheets.find(sheet => sheet.id === activePreviewSheet) ?? state.preview.sheets[0];
  const sheetContainer = element('div', { className: 'preview-sheet', role: 'tabpanel', id: 'preview-sheet-panel' });
  sheetContainer.tabIndex = 0;
  sheetContainer.setAttribute('aria-labelledby', `preview-tab-${selected.id}`);
  const table = element('table');
  const head = element('thead');
  const header = element('tr');
  selected.columns.forEach(column => {
    const heading = element('th', {}, column.label);
    heading.scope = 'col';
    header.append(heading);
  });
  head.append(header);
  const body = element('tbody');
  const rows = selected.rows.length ? selected.rows : [Object.fromEntries(selected.columns.map(column => [column.id, column.role === 'calculated' ? '=…' : '']))];
  rows.slice(0, 3).forEach(row => {
    const tr = element('tr');
    selected.columns.forEach(column => {
      const cell = element('td', {}, String(row[column.id] ?? ''));
      cell.dataset.role = column.role === 'calculated' ? 'formula' : column.role;
      tr.append(cell);
    });
    body.append(tr);
  });
  table.append(head, body);
  const colors = state.preview.theme.colors;
  table.style.setProperty('--sheet-bg', colors.background);
  table.style.setProperty('--sheet-primary', colors.primary);
  table.style.setProperty('--sheet-input', colors.inputFill);
  table.style.setProperty('--sheet-formula', colors.formulaFill);
  sheetContainer.append(table);
  $('workbookPreview').replaceChildren(tabs, sheetContainer);
  const details = [
    [translate('ui.preview.product'), state.preview.productId], [translate('ui.preview.version'), state.preview.productVersion], [translate('ui.preview.sheets'), number(state.preview.sheets.length)],
    [translate('ui.preview.formulas'), number(state.preview.formulaCount)], [translate('ui.preview.currency'), state.preview.currencyExample], [translate('ui.preview.capacity'), number(state.configuration.inputCapacity)],
  ];
  const dl = element('dl');
  for (const [term, value] of details) {
    const row = element('div');
    row.append(element('dt', {}, term), element('dd', {}, value));
    dl.append(row);
  }
  $('previewSpec').replaceChildren(dl);
}

function runPreflight() {
  clearAlert();
  try {
    state.configuration = factory.configuration(state.configuration.productId, state.configuration);
    state.validation = factory.validate(state.configuration);
    renderValidation();
    renderStepChrome();
    renderGateState();
    announce(translate(state.validation.valid ? 'ui.validation.passed' : 'ui.validation.failed'));
  } catch (error) {
    state.validation = null;
    debug('Validatie kon niet worden uitgevoerd', { code: error.code ?? 'ERROR', message: error.message });
    alertUser(`${translate('ui.validation.failed')} ${friendlyError(error)}`);
    renderStepChrome();
  }
}

function renderValidation() {
  if (!state.validation) {
    $('validationSummary').dataset.state = 'idle';
    $('validationSummary').replaceChildren(element('p', {}, translate('ui.validation.notRun')));
    $('validationReport').replaceChildren();
    return;
  }
  $('validationSummary').dataset.state = state.validation.valid ? 'pass' : 'fail';
  $('validationSummary').replaceChildren(element('p', {}, state.validation.valid
    ? translate('ui.validation.allPassed')
    : translate('ui.validation.blocked', '', { count: number(state.validation.findings.length) })));
  const rows = state.validation.reports.map(({ id, report }) => {
    const row = element('div', { className: 'report-row' });
    row.dataset.state = report.status.toLocaleLowerCase('en-US');
    row.append(
      element('code', {}, id),
      element('span', {}, translate(`ui.validation.report.${id}`, translate('ui.validation.noFindings'))),
      element('span', { className: 'report-state' }, statusLabel(report.status)),
    );
    return row;
  });
  $('validationReport').replaceChildren(...rows);
}

function renderGeneration() {
  const definition = currentDefinition();
  const appearance = state.configuration?.extensions?.productAppearance === 'dark' ? translate('ui.productAppearance.dark') : translate('ui.productAppearance.light');
  const formats = declaredOutputTypes(definition).map(type => type.toUpperCase()).join(' · ');
  const documentCount = localizedDocumentTemplates(definition).length;
  $('generationVariant').textContent = definition ? `${selectedProductName(definition)} · ${formats} · ${state.configuration.locale} · ${appearance}` : '—';
  $('generationEstimate').textContent = state.generation
    ? translate('ui.generation.measured', '', {
      duration: number(Math.round(state.generation.durationMs)),
      bytes: number(state.generation.summary.workbookBytes + state.generation.summary.documentBytes),
    })
    : translate('ui.generation.notMeasured');
  if (!definition) {
    $('generateProduct').textContent = 'Genereer en valideer bestanden';
  } else if (supportsOutput('docx', definition) && supportsOutput('xlsx', definition)) {
    $('generateProduct').textContent = `Genereer XLSX + ${number(documentCount)} DOCX-bestanden + ZIP`;
  } else if (supportsOutput('docx', definition)) {
    $('generateProduct').textContent = `Genereer ${number(documentCount)} DOCX-bestanden + ZIP`;
  } else {
    $('generateProduct').textContent = 'Genereer en herlees XLSX + ZIP';
  }
}

async function generateProduct() {
  clearAlert();
  runPreflight();
  if (!state.validation?.valid) return;
  state.savedOutputs = { workbook: null, package: null, images: null, image: null, batch: state.savedOutputs.batch };
  const button = $('generateProduct');
  button.disabled = true;
  $('generationProgress').hidden = false;
  $('generationProgress').setAttribute('aria-valuenow', '0');
  $('generationProgressBar').style.width = '0%';
  $('generationStatus').textContent = translate('ui.generation.preparing');
  setRuntimeStatus('busy', 'ui.generation.runtimeActive');
  try {
    state.generation = await factory.generate(state.configuration, {
      ExcelJS: globalThis.ExcelJS,
      JSZip: globalThis.JSZip,
      listingImageProvider: nativeListingImageProvider,
      onProgress: event => {
        const percentage = Math.round(clamp(Number(event.progress) || 0, 0, 1) * 100);
        $('generationProgressBar').style.width = `${percentage}%`;
        $('generationProgress').setAttribute('aria-valuenow', String(percentage));
        const message = translate(GENERATION_STAGE_KEYS[event.stage] ?? 'ui.generation.preparing');
        $('generationStatus').textContent = message;
        announce(message);
      },
    });
    $('downloadWorkbook').disabled = !state.generation.workbook;
    $('downloadPackage').disabled = !state.generation.package;
    $('generationProgress').setAttribute('aria-valuenow', '100');
    $('generationProgressBar').style.width = '100%';
    renderGateState();
    renderGeneration();
    renderQuality();
    renderPackage();
    renderSummary();
    renderStepChrome();
    const primaryOutputsSaved = await persistGeneratedPrimaryOutputs(state.generation);
    scheduleDraftSave();
    setRuntimeStatus(
      primaryOutputsSaved ? 'ready' : 'error',
      primaryOutputsSaved ? 'ui.generation.runtimeReady' : 'ui.output.saveFailed',
      primaryOutputsSaved ? {} : { code: 'AUTO_SAVE_INCOMPLETE' },
    );
    debug('Generatie geslaagd', state.generation.summary);
  } catch (error) {
    state.generation = null;
    setRuntimeStatus('error', 'ui.generation.runtimeError');
    const message = friendlyError(error);
    $('generationStatus').textContent = translate('ui.generation.failed', '', { message });
    alertUser(translate('ui.generation.failed', '', { message }));
    renderPackage();
    renderStepChrome();
    debug('Generatie mislukt', { code: error.code ?? 'ERROR', message: error.message });
  } finally {
    button.disabled = false;
  }
}

function renderQuality() {
  const report = state.generation?.qualityReport;
  if (!report) {
    $('qualityScore').textContent = '—';
    $('qualityScoreLarge').textContent = '—';
    $('qualityStatus').textContent = translate('ui.quality.notCalculated');
    $('qualityVerdict').textContent = translate('ui.quality.generateFirst');
    $('qualityDimensions').replaceChildren();
    $('qualityOrb').dataset.state = 'idle';
    $('qualityOrb').setAttribute('aria-label', translate('ui.a11y.qualityNotCalculated'));
    return;
  }
  $('qualityScore').textContent = String(Math.round(report.score));
  $('qualityScoreLarge').textContent = String(Math.round(report.score));
  $('qualityStatus').textContent = statusLabel(report.status);
  $('qualityVerdict').textContent = translate(report.status === 'PASS' ? 'ui.quality.passVerdict' : 'ui.quality.reviewRequired');
  $('qualityOrb').dataset.state = report.status === 'PASS' ? 'ready' : 'idle';
  $('qualityOrb').setAttribute('aria-label', translate('ui.quality.ariaScore', '', { score: number(report.score) }));
  const rows = report.components.map(component => {
    const row = element('div', { className: 'dimension-row' });
    const track = element('span', { className: 'dimension-track' });
    const indicator = element('i');
    indicator.style.width = `${component.score}%`;
    track.append(indicator);
    row.append(
      element('span', {}, translate(`ui.quality.component.${component.id}`, component.id.replaceAll('-', ' '))),
      track,
      element('strong', {}, `${component.score}`),
    );
    return row;
  });
  $('qualityDimensions').replaceChildren(...rows);
}

function bytesView(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return new Uint8Array();
}

function bytesToBase64(value) {
  const bytes = bytesView(value);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength)));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  if (typeof value !== 'string' || !value.length) throw new Error('Native beeldgeneratie leverde lege afbeeldingsdata op.');
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function nativeListingImageProvider({
  plannedManifest,
  configuration,
  workbookBytes,
}) {
  const response = await fetch('/api/native-listing-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      configuration,
      plannedManifest,
      generatedAt: plannedManifest.generatedAt,
      workbookBase64: bytesToBase64(workbookBytes),
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.error || 'Microsoft Excel kon de brongetrouwe listingbeelden niet genereren.');
  }
  if (!Array.isArray(payload.images) || payload.images.length !== REQUIRED_LISTING_IMAGE_PATHS.length) {
    throw new Error(`Native beeldgeneratie moet exact ${REQUIRED_LISTING_IMAGE_PATHS.length} afbeeldingen opleveren.`);
  }
  const images = payload.images.map((image, index) => {
    if (image.path !== REQUIRED_LISTING_IMAGE_PATHS[index]) {
      throw new Error(`Native beeld ${index + 1} wijkt af van het vereiste pad.`);
    }
    const { bytesBase64, ...metadata } = image;
    return Object.freeze({ ...metadata, bytes: base64ToBytes(bytesBase64) });
  });
  return Object.freeze({
    images: Object.freeze(images),
    manifest: Object.freeze(payload.manifest),
    validation: Object.freeze(payload.validation),
    rendererResult: Object.freeze(payload.rendererResult),
  });
}

function rasterDimensions(value) {
  const bytes = bytesView(value);
  if (bytes.byteLength >= 24 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20), type: 'image/png' };
  }
  if (bytes.byteLength >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    while (offset + 8 < bytes.byteLength) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const length = view.getUint16(offset + 2);
      if (length < 2 || offset + length + 2 > bytes.byteLength) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5), type: 'image/jpeg' };
      }
      offset += length + 2;
    }
  }
  return null;
}

function listingImageFiles(commercialPackage) {
  if (!(commercialPackage?.files instanceof Map)) return [];
  return [...commercialPackage.files.entries()]
    .filter(([path, file]) => /^listing\/images\/[^/]+\.(?:png|jpe?g)$/i.test(path) && /^image\/(?:png|jpeg)$/.test(file.mediaType ?? ''))
    .sort(([left], [right]) => left.localeCompare(right, 'en-US'));
}

function disposeListingImagePreviews() {
  for (const url of listingImageUrls) URL.revokeObjectURL(url);
  listingImageUrls = [];
  listingImageSource = null;
}

function imageAssetFor(commercialPackage, path) {
  const filename = path.split('/').at(-1);
  return commercialPackage.imageManifest?.assets?.find(asset => asset.filename === filename || asset.path === path || asset.packagePath === path) ?? null;
}

function hasExactListingImagePaths(evidence) {
  return evidence.length === REQUIRED_LISTING_IMAGE_PATHS.length
    && evidence.every((item, index) => item.path === REQUIRED_LISTING_IMAGE_PATHS[index]);
}

function listingImageEvidence(commercialPackage) {
  return listingImageFiles(commercialPackage).map(([path, file]) => {
    const bytes = bytesView(file.bytes);
    const dimensions = rasterDimensions(bytes);
    const asset = imageAssetFor(commercialPackage, path);
    const hashMatches = !asset?.sha256 || asset.sha256 === file.sha256;
    const dimensionsMatch = !asset || !dimensions || (asset.width === dimensions.width && asset.height === dimensions.height);
    const valid = Boolean(
      bytes.byteLength > 0
      && dimensions?.width >= 2_000
      && dimensions.height > 0
      && dimensions.type === file.mediaType
      && /^[a-f0-9]{64}$/.test(file.sha256 ?? '')
      && hashMatches
      && dimensionsMatch
    );
    return { path, file, bytes, dimensions, asset, valid };
  });
}

function renderSavedOutputLocation(location, saved) {
  location.hidden = !saved;
  if (!saved) {
    location.replaceChildren();
    return;
  }
  const lines = [
    element('span', { className: 'output-saved-path' }, translate('ui.output.savedAt', '', { path: saved.relativePath })),
  ];
  if (saved.extracted?.status === 'EXTRACTED') {
    lines.push(element('span', { className: 'output-extracted-path' }, translate('ui.output.extractedAt', '', {
      path: saved.extracted.relativePath,
      count: number(saved.extracted.fileCount),
    })));
  }
  location.replaceChildren(...lines);
}

function renderListingImages(commercialPackage) {
  const section = $('listingImages');
  const evidence = listingImageEvidence(commercialPackage);
  const ready = hasExactListingImagePaths(evidence) && evidence.every(item => item.valid);
  section.hidden = evidence.length === 0;
  $('downloadImages').disabled = !ready;
  $('downloadImages').textContent = state.savedOutputs.images
    ? translate('ui.images.rebuildArchive')
    : translate('ui.images.downloadArchive');
  $('listingImageCount').textContent = translate('ui.images.count', '', { count: number(evidence.length) });
  renderSavedOutputLocation($('imagesOutputLocation'), state.savedOutputs.images);
  if (!evidence.length) {
    disposeListingImagePreviews();
    $('listingImageGrid').replaceChildren();
    return ready;
  }
  if (listingImageSource === commercialPackage && $('listingImageGrid').children.length === evidence.length) return ready;
  disposeListingImagePreviews();
  listingImageSource = commercialPackage;
  const cards = evidence.map(item => {
    const filename = item.path.split('/').at(-1);
    const card = element('figure', { className: 'listing-image-card' });
    card.dataset.state = item.valid ? 'validated' : 'rejected';
    const caption = element('figcaption');
    const status = element('span', { className: 'listing-image-status' }, translate(item.valid ? 'ui.images.validated' : 'ui.images.rejected'));
    caption.append(
      element('strong', {}, filename),
      element('small', {}, item.dimensions ? `${number(item.dimensions.width)} × ${number(item.dimensions.height)} px · ${formatBytes(item.bytes.byteLength)}` : formatBytes(item.bytes.byteLength)),
      status,
    );
    if (item.valid) {
      const url = URL.createObjectURL(new Blob([item.bytes], { type: item.file.mediaType }));
      listingImageUrls.push(url);
      const image = element('img');
      image.src = url;
      image.alt = item.asset?.altText ?? commercialPackage.imageManifest?.extensions?.briefs?.[item.asset?.id]?.altText ?? filename;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.width = item.dimensions.width;
      image.height = item.dimensions.height;
      image.addEventListener('error', () => {
        card.dataset.state = 'rejected';
        status.textContent = translate('ui.images.rejected');
        $('downloadPackage').disabled = true;
        $('downloadImages').disabled = true;
      }, { once: true });
      card.append(image);
    }
    const saveButton = element('button', { className: 'button button-quiet', type: 'button' }, translate('ui.images.saveOne'));
    saveButton.disabled = !item.valid;
    saveButton.addEventListener('click', async () => {
      const saved = await persistOutput({
        bytes: item.bytes,
        filename,
        kind: 'image',
        mediaType: item.file.mediaType,
        generation: state.generation,
        button: saveButton,
      });
      if (saved) saveButton.textContent = translate('ui.images.saved');
    });
    caption.append(saveButton);
    card.append(caption);
    return card;
  });
  $('listingImageGrid').replaceChildren(...cards);
  return ready;
}

function packageReleaseReady(generation, commercialPackage) {
  if (!commercialPackage?.zipBytes || !(commercialPackage.files instanceof Map)) return false;
  const outputs = declaredOutputTypes(generation?.definition);
  const paths = new Set(commercialPackage.files.keys());
  const imageEvidence = listingImageEvidence(commercialPackage);
  const rootImagePaths = commercialPackage.rootManifest?.listingImages?.map(image => image.path) ?? [];
  const imageManifestsRequired = generation.configuration?.outputOptions?.imageManifests !== false;
  const requiredListing = [
    'listing/title.txt',
    'listing/description.txt',
    'listing/tags.txt',
    'listing/features.txt',
    'listing/faq.txt',
    ...(imageManifestsRequired ? ['listing/alt-texts.txt'] : []),
  ];
  const reportsPass = generation.validationReport?.status === 'PASS'
    && generation.qualityReport?.status === 'PASS'
    && ['PASS', 'PARTIAL'].includes(generation.compatibilityReport?.status);
  const workbookReady = !outputs.includes('xlsx') || [...paths].some(path => /^product\/[^/]+\.xlsx$/i.test(path));
  const generatedDocuments = generation.documents?.artifacts ?? [];
  const documentsReady = !outputs.includes('docx') || (generatedDocuments.length > 0
    && generatedDocuments.every(artifact => paths.has(`product/${artifact.packagePath}`) && artifact.validationReport?.status === 'PASS'));
  const imagesReady = !imageManifestsRequired || (
    commercialPackage.packageValidation?.imageValidation?.status === 'PASS'
    && commercialPackage.imageValidation?.status === 'PASS'
    && commercialPackage.rootManifest?.imageValidation?.status === 'PASS'
    && rootImagePaths.length === REQUIRED_LISTING_IMAGE_PATHS.length
    && rootImagePaths.every((path, index) => path === REQUIRED_LISTING_IMAGE_PATHS[index])
    && hasExactListingImagePaths(imageEvidence)
    && imageEvidence.every(item => item.valid)
  );
  return reportsPass
    && commercialPackage.packageValidation?.status === 'PASS'
    && commercialPackage.rootManifest?.status === 'VALIDATED_PACKAGE_INDEX'
    && workbookReady
    && documentsReady
    && requiredListing.every(path => paths.has(path) && commercialPackage.files.get(path)?.size > 0)
    && imagesReady;
}

function packageDownloadReady(commercialPackage) {
  return Boolean(
    commercialPackage?.zipBytes?.byteLength > 0
    && typeof commercialPackage.packageFilename === 'string'
    && commercialPackage.packageFilename.trim()
  );
}

function renderDocumentOutputs(generation) {
  const artifacts = generation?.documents?.artifacts ?? [];
  $('documentOutputs').hidden = artifacts.length === 0;
  $('documentOutputCount').textContent = `${number(artifacts.length)} bestanden`;
  $('documentOutputList').replaceChildren(...artifacts.map(artifact => {
    const row = element('article', { className: 'document-output-row' });
    const identity = element('div', { className: 'document-output-identity' });
    identity.append(element('span', { className: 'output-icon output-icon-docx' }, 'W'));
    const copy = element('div');
    copy.append(element('strong', {}, artifact.filename), element('span', {}, `${artifact.templateId} · ${formatBytes(artifact.byteLength)}`));
    identity.append(copy);
    const status = element('span', { className: 'document-output-status' }, artifact.validationReport?.status === 'PASS' ? '✓ Gevalideerd' : 'Geblokkeerd');
    status.dataset.state = artifact.validationReport?.status === 'PASS' ? 'pass' : 'fail';
    const button = element('button', { className: 'button button-quiet', type: 'button' }, 'DOCX opslaan');
    button.disabled = artifact.validationReport?.status !== 'PASS';
    button.addEventListener('click', async () => {
      const saved = await persistOutput({
        bytes: artifact.bytes,
        filename: artifact.filename,
        kind: 'document',
        mediaType: artifact.mediaType,
        generation,
        button,
      });
      if (saved) button.textContent = 'Opgeslagen';
    });
    row.append(identity, status, button);
    return row;
  }));
}

function renderPackage() {
  const commercialPackage = state.generation?.package;
  const generation = state.generation;
  const workbookReady = Boolean(generation?.workbook?.bytes);
  renderListingImages(commercialPackage);
  renderDocumentOutputs(generation);
  const packageGenerated = packageDownloadReady(commercialPackage);
  const packageReady = packageReleaseReady(generation, commercialPackage);
  const workbookSaved = Boolean(state.savedOutputs.workbook);
  const packageSaved = Boolean(state.savedOutputs.package);
  $('workbookOutputCard').hidden = !supportsOutput('xlsx', generation?.definition ?? currentDefinition());
  $('workbookOutputCard').dataset.state = workbookReady ? 'ready' : 'idle';
  $('packageOutputCard').dataset.state = packageReady ? 'ready' : packageGenerated ? 'review' : 'idle';
  $('workbookOutputName').textContent = generation?.configuration?.filename ?? state.configuration?.filename ?? translate('ui.output.notGenerated');
  $('workbookOutputStatus').textContent = translate(workbookSaved ? 'ui.status.saved' : workbookReady ? 'ui.output.ready' : 'ui.output.notGenerated');
  $('workbookOutputSize').textContent = workbookReady ? formatBytes(generation.workbook.byteLength) : '—';
  $('packageOutputName').textContent = commercialPackage?.packageFilename ?? translate('ui.output.notGenerated');
  $('packageOutputStatus').textContent = packageSaved
    ? `${translate('ui.status.saved')} · ${translate(packageReady ? 'ui.output.ready' : 'ui.output.reviewRequired')}`
    : translate(packageReady ? 'ui.output.ready' : packageGenerated ? 'ui.output.reviewRequired' : 'ui.output.notGenerated');
  $('packageOutputSize').textContent = packageGenerated ? formatBytes(commercialPackage.zipBytes.byteLength) : '—';
  $('downloadWorkbook').disabled = !workbookReady;
  $('downloadPackage').disabled = !packageGenerated;
  $('downloadWorkbook').textContent = workbookSaved ? 'XLSX opnieuw opslaan' : translate('ui.action.downloadWorkbook');
  $('downloadPackage').textContent = packageSaved ? translate('ui.output.rebuildArchive') : translate('ui.action.downloadPackage');
  for (const kind of ['workbook', 'package']) {
    const saved = state.savedOutputs[kind];
    renderSavedOutputLocation($(`${kind}OutputLocation`), saved);
  }
  $('packageContents').hidden = !packageGenerated;
  if (!packageGenerated) {
    $('packageFileList').replaceChildren();
    return;
  }
  const rows = [...commercialPackage.files.entries()].sort(([left], [right]) => left.localeCompare(right, 'en-US')).map(([path, file]) => {
    const row = element('li');
    row.append(element('code', {}, path), element('span', {}, `${file.role} · ${formatBytes(file.size)}`));
    return row;
  });
  $('packageFileList').replaceChildren(...rows);
}

function offerBrowserDownload(bytes, filename, mediaType) {
  const blob = new Blob([bytes], { type: mediaType });
  const url = URL.createObjectURL(blob);
  const anchor = element('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
  announce(translate('ui.download.offered', '', { filename }));
}

function outputSaveError(message, unavailable = false) {
  const error = new Error(message);
  error.code = unavailable ? 'OUTPUT_STORAGE_UNAVAILABLE' : 'OUTPUT_STORAGE_FAILED';
  error.storageUnavailable = unavailable;
  return error;
}

async function saveToProject({ bytes, filename, kind, mediaType, generation = state.generation, runId = null }) {
  const endpoint = new URL('/api/output', window.location.origin);
  endpoint.searchParams.set('kind', kind);
  endpoint.searchParams.set('filename', filename);
  if (kind === 'batch') {
    endpoint.searchParams.set('runId', runId);
  } else {
    endpoint.searchParams.set('productId', generation.definition.id);
    endpoint.searchParams.set('locale', generation.configuration.locale);
    endpoint.searchParams.set('currency', generation.configuration.currency);
    endpoint.searchParams.set('themeId', generation.configuration.themeId);
    endpoint.searchParams.set('appearance', generation.configuration.extensions?.productAppearance ?? 'light');
    endpoint.searchParams.set('version', generation.definition.version);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTRACTED_ZIP_KINDS.has(kind) ? 90_000 : 15_000);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': mediaType },
      body: bytes,
      signal: controller.signal,
    });
  } catch (error) {
    throw outputSaveError(error?.name === 'AbortError' ? 'Lokale opslagservice reageerde niet op tijd.' : 'Lokale opslagservice is niet bereikbaar.', true);
  } finally {
    clearTimeout(timeout);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // A non-JSON response means this is not the local output-storage service.
  }
  if (!response.ok) {
    throw outputSaveError(payload?.error ?? `Lokale opslagservice antwoordde met status ${response.status}.`, [404, 405, 501].includes(response.status));
  }
  if (!payload?.ok || typeof payload.relativePath !== 'string' || !/^[a-f0-9]{64}$/.test(payload.sha256 ?? '')) {
    throw outputSaveError('Lokale opslagservice gaf geen verifieerbare opslagbevestiging.');
  }
  if (EXTRACTED_ZIP_KINDS.has(kind) && (
    payload.extracted?.status !== 'EXTRACTED'
    || typeof payload.extracted.relativePath !== 'string'
    || !Number.isSafeInteger(payload.extracted.fileCount)
    || payload.extracted.fileCount < 1
  )) {
    throw outputSaveError('Lokale opslagservice bevestigde de automatische ZIP-extractie niet.');
  }
  return payload;
}

async function persistOutput({
  bytes,
  filename,
  kind,
  mediaType,
  generation,
  runId,
  button,
  allowBrowserFallback = true,
  clearExistingAlert = true,
  renderAfterSave = true,
}) {
  if (clearExistingAlert) clearAlert();
  const originalLabel = button.textContent;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = translate('ui.output.saving');
  try {
    if (state.configuration?.extensions?.outputProfile === 'browser-download') {
      offerBrowserDownload(bytes, filename, mediaType);
      debug('Uitvoer aangeboden via de gekozen browserdownloadmap', { kind, filename, bytes: bytes.byteLength });
      return null;
    }
    const saved = await saveToProject({ bytes, filename, kind, mediaType, generation, runId });
    state.savedOutputs[kind] = saved;
    if (renderAfterSave && (kind === 'workbook' || kind === 'package')) renderPackage();
    announce(translate(saved.extracted ? 'ui.output.extractedAt' : 'ui.output.savedAt', '', saved.extracted
      ? { path: saved.extracted.relativePath, count: number(saved.extracted.fileCount) }
      : { path: saved.relativePath }));
    debug('Uitvoer opgeslagen in projectmap', {
      kind,
      path: saved.relativePath,
      extractedPath: saved.extracted?.relativePath ?? null,
      extractedFiles: saved.extracted?.fileCount ?? 0,
      bytes: saved.bytes,
      sha256: saved.sha256,
    });
    return saved;
  } catch (error) {
    debug('Uitvoer kon niet in de projectmap worden opgeslagen', { kind, code: error.code, message: error.message });
    if (error.storageUnavailable && allowBrowserFallback) {
      offerBrowserDownload(bytes, filename, mediaType);
      alertUser(translate('ui.output.browserFallback', '', { filename }));
      return null;
    }
    alertUser(translate('ui.output.saveFailed', '', { code: error.code ?? 'OUTPUT_STORAGE_FAILED' }));
    return null;
  } finally {
    button.removeAttribute('aria-busy');
    button.textContent = originalLabel;
    button.disabled = false;
  }
}

async function persistGeneratedPrimaryOutputs(generation) {
  if (generation?.configuration?.extensions?.outputProfile !== 'repository-release') return true;
  const outputs = [];
  if (generation.workbook?.bytes) {
    outputs.push({
      bytes: generation.workbook.bytes,
      filename: generation.configuration.filename,
      kind: 'workbook',
      mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      button: $('downloadWorkbook'),
    });
  }
  if (packageDownloadReady(generation.package)) {
    outputs.push({
      bytes: generation.package.zipBytes,
      filename: generation.package.packageFilename,
      kind: 'package',
      mediaType: 'application/zip',
      button: $('downloadPackage'),
    });
    const imageArchive = await createListingImagesArchive(generation.package, generation);
    if (imageArchive) {
      outputs.push({
        ...imageArchive,
        kind: 'images',
        mediaType: 'application/zip',
        button: $('downloadImages'),
      });
    }
  }
  if (!outputs.length) return true;

  clearAlert();
  const saved = [];
  for (const output of outputs) {
    saved.push(await persistOutput({
      ...output,
      generation,
      allowBrowserFallback: false,
      clearExistingAlert: false,
      renderAfterSave: false,
    }));
  }
  renderPackage();
  const complete = saved.every(Boolean);
  debug(complete ? 'Primaire uitvoer automatisch opgeslagen' : 'Automatische opslag van primaire uitvoer is onvolledig', {
    expected: outputs.map(output => output.kind),
    saved: saved.filter(Boolean).map(result => result.relativePath),
  });
  return complete;
}

async function downloadWorkbook() {
  if (!state.generation?.workbook) return;
  await persistOutput({
    bytes: state.generation.workbook.bytes,
    filename: state.generation.configuration.filename,
    kind: 'workbook',
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    generation: state.generation,
    button: $('downloadWorkbook'),
  });
}

async function downloadPackage() {
  const commercialPackage = state.generation?.package;
  if (!packageDownloadReady(commercialPackage)) return alertUser(translate('ui.output.notGenerated'));
  await persistOutput({
    bytes: commercialPackage.zipBytes,
    filename: commercialPackage.packageFilename,
    kind: 'package',
    mediaType: 'application/zip',
    generation: state.generation,
    button: $('downloadPackage'),
  });
}

async function createListingImagesArchive(commercialPackage, generation = state.generation) {
  const evidence = listingImageEvidence(commercialPackage);
  if (!hasExactListingImagePaths(evidence) || evidence.some(item => !item.valid)) return null;
  const zip = new globalThis.JSZip();
  const createdAt = commercialPackage.releaseManifest?.createdAt ?? generation?.generatedAt ?? '2026-01-01T00:00:00.000Z';
  const date = new Date(createdAt);
  for (const item of evidence) zip.file(item.path, item.bytes, { binary: true, createFolders: false, date });
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE', platform: 'DOS', streamFiles: false });
  const base = sanitizeFilename(commercialPackage.packageFilename.replace(/\.zip$/i, '')).slice(0, 96);
  return Object.freeze({ bytes, filename: `${base}-etsy-images.zip` });
}

async function downloadImagesArchive() {
  const commercialPackage = state.generation?.package;
  try {
    const archive = await createListingImagesArchive(commercialPackage);
    if (!archive) {
      alertUser(translate('ui.images.archiveBlocked'));
      return;
    }
    await persistOutput({
      ...archive,
      kind: 'images',
      mediaType: 'application/zip',
      generation: state.generation,
      button: $('downloadImages'),
    });
    renderListingImages(commercialPackage);
  } catch (error) {
    debug('Etsy-afbeeldingenarchief kon niet worden opgebouwd', { code: error.code ?? 'ERROR', message: error.message });
    alertUser(translate('ui.images.archiveBlocked'));
  }
}

function renderApproval() {
  const receipt = $('decisionReceipt');
  if (!['APPROVED', 'REJECTED'].includes(state.approval.status)) {
    document.querySelectorAll('input[name="decision"]').forEach(input => { input.checked = false; });
    $('decisionReason').value = '';
    receipt.hidden = true;
    receipt.textContent = '';
    return;
  }
  const selected = document.querySelector(`input[name="decision"][value="${state.approval.status}"]`);
  if (selected) selected.checked = true;
  $('decisionReason').value = state.approval.reason;
  receipt.hidden = false;
  const decisionDate = new Date(state.approval.decidedAt);
  receipt.textContent = translate('ui.approval.receipt', '', {
    status: statusLabel(state.approval.status),
    date: Number.isNaN(decisionDate.valueOf()) ? String(state.approval.decidedAt) : new Intl.DateTimeFormat(GENERATOR_LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(decisionDate),
    reason: state.approval.reason || translate('ui.approval.noReason'),
  });
}

function saveDecision() {
  clearAlert();
  if (!packageReleaseReady(state.generation, state.generation?.package)) return alertUser(translate('ui.approval.errorPackage'));
  const decision = document.querySelector('input[name="decision"]:checked')?.value;
  const reason = $('decisionReason').value.trim();
  if (!decision) {
    alertUser(translate('ui.approval.errorDecision'));
    document.querySelector('input[name="decision"]')?.focus();
    return;
  }
  if (decision === 'REJECTED' && !reason) {
    alertUser(translate('ui.approval.errorReason'));
    $('decisionReason').focus();
    return;
  }
  if (decision === 'APPROVED' && (state.generation.validationReport.status !== 'PASS' || state.generation.qualityReport.status !== 'PASS')) return alertUser(translate('ui.approval.errorGates'));
  state.approval = { status: decision, reason, decidedAt: new Date().toISOString() };
  renderApproval();
  renderStepChrome();
  scheduleDraftSave();
  announce(translate('ui.approval.saved', '', { decision: statusLabel(decision).toLocaleLowerCase(GENERATOR_LOCALE) }));
}

async function renderSummary() {
  const renderVersion = ++summaryRenderVersion;
  const configuration = state.configuration;
  if (!configuration) return;
  const definition = currentDefinition();
  $('summaryProduct').textContent = selectedProductName(definition);
  const values = [
    [translate('ui.label.locale'), configuration.locale],
    [translate('ui.label.currency'), configuration.currency],
    [translate('ui.label.theme'), translate(themeCatalog[configuration.themeId]?.nameKey, configuration.themeId)],
    [translate('ui.label.productAppearance'), translate(configuration.extensions?.productAppearance === 'dark' ? 'ui.productAppearance.dark' : 'ui.productAppearance.light')],
    [translate('ui.label.inputCapacity'), number(configuration.inputCapacity)],
  ];
  const dl = $('runSummary');
  dl.replaceChildren(...values.map(([term, value]) => {
    const row = element('div');
    row.append(element('dt', {}, term), element('dd', {}, value));
    return row;
  }));
  const indicators = $('checksMini').querySelectorAll('i');
  indicators[0].dataset.state = state.validation?.valid ? 'pass' : 'idle';
  indicators[1].dataset.state = state.generation?.validationReport.status === 'PASS' ? 'pass' : state.generation ? 'fail' : 'idle';
  indicators[2].dataset.state = packageReleaseReady(state.generation, state.generation?.package) ? 'pass' : state.generation?.package ? 'fail' : 'idle';
  try {
    const hash = (await configurationHash(configuration)).slice(0, 10).toUpperCase();
    if (renderVersion === summaryRenderVersion && configuration === state.configuration) $('runId').textContent = hash;
  } catch {
    if (renderVersion === summaryRenderVersion) $('runId').textContent = translate('ui.status.draft');
  }
}

function addChecklist(container, options, selected) {
  container.replaceChildren(...options.map(({ value, label, disabled = false }) => {
    const input = element('input', { type: 'checkbox', value });
    input.checked = selected.has(value);
    input.disabled = disabled;
    const wrapper = element('label');
    wrapper.append(input, element('span', {}, label));
    input.addEventListener('change', updateBatchPlan);
    return wrapper;
  }));
}

function checkedValues(container) {
  return [...container.querySelectorAll('input:checked')].map(input => input.value);
}

function populateBatchDialog() {
  const configuration = state.configuration;
  addChecklist($('batchProducts'), activeProducts.map(product => ({ value: product.id, label: translate(product.nameKey, product.id) })), new Set([configuration.productId]));
  addChecklist($('batchLocales'), productionLocaleIds.map(id => ({ value: id, label: `${id} · ${new Intl.DisplayNames([GENERATOR_LOCALE], { type: 'language' }).of(id.split('-')[0]) ?? id}` })), new Set([configuration.locale]));
  addChecklist($('batchCurrencies'), Object.keys(currencyCatalog).map(id => ({ value: id, label: `${id} · ${displayName('currency', id)}` })), new Set([configuration.currency]));
  addChecklist($('batchThemes'), Object.keys(themeCatalog).map(id => ({ value: id, label: translate(themeCatalog[id].nameKey, id) })), new Set([configuration.themeId]));
  addChecklist($('batchAppearances'), [
    { value: 'light', label: translate('ui.productAppearance.light') },
    { value: 'dark', label: translate('ui.productAppearance.dark') },
  ], new Set([configuration.extensions?.productAppearance ?? 'light']));
  addChecklist($('batchCapacities'), [50, 100, 250, 500, 1000].map(value => ({ value: String(value), label: translate('ui.batch.rowCount', '', { count: number(value) }) })), new Set([String(configuration.inputCapacity)]));
  addChecklist($('batchOutputs'), [{ value: 'workbook', label: translate('ui.batch.outputWorkbook') }, { value: 'package', label: translate('ui.batch.outputPackage') }], new Set(['workbook', 'package']));
  $('batchSampleData').checked = configuration.sampleDataEnabled;
  $('batchSampleData').onchange = updateBatchPlan;
  state.batchRun = null;
  state.batchArchive = null;
  state.savedOutputs.batch = null;
  updateBatchPlan();
}

function batchSelection() {
  return {
    productIds: checkedValues($('batchProducts')),
    locales: checkedValues($('batchLocales')),
    currencies: checkedValues($('batchCurrencies')),
    themeIds: checkedValues($('batchThemes')),
    appearances: checkedValues($('batchAppearances')),
    capacities: checkedValues($('batchCapacities')).map(Number),
    outputs: checkedValues($('batchOutputs')),
    sampleDataEnabled: $('batchSampleData').checked,
  };
}

function updateBatchPlan() {
  if (batchController) return;
  try {
    currentBatchPlan = createBatchPlan(batchSelection());
    const warnings = currentBatchPlan.warnings.length
      ? ` · ${currentBatchPlan.warnings.map(warning => warning === 'Duration estimate unavailable until a successful generation has been measured.'
        ? translate('ui.batch.warning.noHistoricalDuration')
        : warning).join(' ')}`
      : '';
    $('batchSummary').textContent = translate('ui.batch.plan', '', {
      variants: number(currentBatchPlan.count),
      files: number(currentBatchPlan.expectedFiles),
      size: number(Math.round(currentBatchPlan.estimatedBytes / 1024)),
      warnings,
    });
    $('runBatch').disabled = false;
    $('runBatch').textContent = translate(state.batchRun?.resumable ? 'ui.batch.resume' : 'ui.batch.start');
  } catch (error) {
    currentBatchPlan = null;
    debug('Batchplan geweigerd', { message: error.message });
    $('batchSummary').textContent = translate('ui.batch.error', '', { message: friendlyError(error) });
    $('runBatch').disabled = true;
  }
}

async function runBatchProduction() {
  if (batchController) {
    batchController.abort();
    return;
  }
  if (!currentBatchPlan) return;
  batchController = new AbortController();
  $('runBatch').textContent = translate('ui.batch.cancel');
  $('batchResults').hidden = false;
  $('batchResults').textContent = translate('ui.batch.started');
  const runner = state.batchRun?.resumable ? resumeBatch : runBatch;
  try {
    const generate = async variant => {
      const definition = factory.resolveProduct(variant.productId, { allowBeta: true });
      const wantsWorkbook = supportsOutput('xlsx', definition) && variant.outputs.includes('workbook');
      const wantsDocuments = supportsOutput('docx', definition);
      const outputOptions = {
        workbook: wantsWorkbook,
        documents: wantsDocuments,
        package: variant.outputs.includes('package'),
        customerDocs: variant.outputs.includes('package'),
        listing: variant.outputs.includes('package'),
        imageManifests: supportsOutput('xlsx', definition) && variant.outputs.includes('package'),
      };
      const configuration = factory.configuration(definition.id, {
        ...definition.defaultConfiguration,
        locale: variant.locale,
        market: localeCatalog[variant.locale]?.extensions?.market ?? definition.defaultConfiguration.market,
        currency: variant.currency,
        year: state.configuration.year,
        themeId: variant.themeId,
        extensions: { ...definition.defaultConfiguration.extensions, productAppearance: variant.productAppearance },
        filename: variantPrimaryFilename(definition, {
          ...definition.defaultConfiguration,
          locale: variant.locale,
          year: state.configuration.year,
          extensions: { ...definition.defaultConfiguration.extensions, productAppearance: variant.productAppearance },
        }),
        inputCapacity: variant.inputCapacity,
        sampleDataEnabled: variant.sampleDataEnabled,
        outputOptions,
      });
      return factory.generate(configuration, {
        ExcelJS: globalThis.ExcelJS,
        JSZip: globalThis.JSZip,
        listingImageProvider: nativeListingImageProvider,
      });
    };
    const options = {
      signal: batchController.signal,
      retainValues: true,
      onProgress: progress => {
        $('batchResults').textContent = translate('ui.batch.progress', '', {
          completed: number(progress.completed), total: number(progress.total), status: statusLabel(progress.result.status), product: progress.result.variant.productId,
        });
      },
    };
    state.batchRun = runner === resumeBatch
      ? await resumeBatch(currentBatchPlan, state.batchRun, generate, options)
      : await runBatch(currentBatchPlan, generate, options);
    $('batchResults').textContent = translate('ui.batch.result', '', {
      status: statusLabel(state.batchRun.status), passed: number(state.batchRun.passed ?? 0), failed: number(state.batchRun.failed ?? 0),
    });
    if (state.batchRun.results.some(result => result.status === 'PASS' && result.value)) await buildBatchArchive();
  } catch (error) {
    debug('Batchproductie mislukt', { message: error.message });
    $('batchResults').textContent = translate('ui.batch.error', '', { message: friendlyError(error) });
  } finally {
    batchController = null;
    updateBatchPlan();
  }
}

async function buildBatchArchive() {
  const zip = new globalThis.JSZip();
  let entries = 0;
  for (const result of state.batchRun.results) {
    if (result.status !== 'PASS' || !result.value) continue;
    const generated = result.value;
    const directory = validateZipPath(`${generated.definition.id}/${generated.configuration.locale}-${generated.configuration.currency}-${generated.configuration.themeId}-${generated.configuration.extensions?.productAppearance ?? 'light'}`);
    if (result.variant.outputs.includes('workbook') && generated.workbook) {
      zip.file(validateZipPath(`${directory}/${generated.configuration.filename}`), generated.workbook.bytes);
      entries += 1;
    }
    if (result.variant.outputs.includes('package') && generated.package) {
      zip.file(validateZipPath(`${directory}/${generated.package.packageFilename}`), generated.package.zipBytes);
      entries += 1;
    }
  }
  state.batchArchive = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const button = element('button', { className: 'button button-accent', type: 'button' }, translate('ui.batch.downloadArchive', '', { count: number(entries) }));
  const location = element('p', { className: 'batch-save-location', hidden: true });
  const runId = String(currentBatchPlan?.createdAt ?? new Date().toISOString()).replace(/[^A-Za-z0-9-]/g, '').slice(0, 80) || 'batch';
  const saveArchive = async () => {
    const saved = await persistOutput({ bytes: state.batchArchive, filename: 'finance-product-factory-batch.zip', kind: 'batch', mediaType: 'application/zip', runId, button });
    renderSavedOutputLocation(location, saved);
    if (saved) button.textContent = translate('ui.output.rebuildArchive');
    return saved;
  };
  button.addEventListener('click', saveArchive);
  $('batchResults').append(document.createTextNode(' '), button, location);
  if (state.configuration?.extensions?.outputProfile === 'repository-release') await saveArchive();
}

function toggleSettings(open) {
  $('settingsPanel').hidden = !open;
  $('openSettings').setAttribute('aria-expanded', String(open));
  if (open) $('closeSettings').focus(); else $('openSettings').focus();
}

function confirmAction(message) {
  const dialog = $('confirmDialog');
  $('confirmMessage').textContent = message;
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
  });
}

async function duplicateConfiguration() {
  const title = translate('ui.draft.copyTitle', '', { title: state.configuration.title });
  const extension = primaryExtension();
  state.configuration = factory.configuration(state.configuration.productId, {
    ...state.configuration,
    title,
    filename: `${sanitizeFilename(`${state.configuration.filename.replace(/\.(?:xlsx|docx)$/i, '')}-copy`)}${extension}`,
  });
  invalidateGenerated('Configuratie gedupliceerd');
  renderForm();
  renderSummary();
  scheduleDraftSave();
  announce(translate('ui.draft.duplicated'));
}

function exportDraftFile() {
  offerBrowserDownload(new TextEncoder().encode(serializeDraft(draftState())), 'finance-product-factory-draft.json', 'application/json');
}

async function importDraftFile(file) {
  if (!file) return;
  if (file.size > SECURITY_LIMITS.importBytes) return alertUser(translate('ui.import.tooLarge', '', { bytes: number(SECURITY_LIMITS.importBytes) }));
  try {
    const imported = parseDraft(await file.text());
    const candidate = factory.configuration(imported.configuration.productId, {}, { persistedState: imported.configuration });
    const report = factory.validate(candidate);
    if (!report.valid) throw new Error(report.findings[0]?.message ?? translate('ui.import.invalid'));
    state.configuration = candidate;
    state.step = clamp(Number(imported.step ?? 1), 1, STEPS.length);
    state.audience = imported.audience ?? state.audience;
    state.approval = imported.approval ?? state.approval;
    invalidateGenerated('Back-up geïmporteerd');
    renderAll();
    goToStep(state.step);
    scheduleDraftSave();
    announce(translate('ui.import.success'));
  } catch (error) {
    debug('Back-upimport geweigerd', { message: error.message });
    alertUser(translate('ui.import.rejected', '', { message: friendlyError(error) }));
  } finally {
    $('importDraft').value = '';
  }
}

async function resetApplication() {
  if (!await confirmAction(translate('ui.reset.confirm'))) return;
  resetDraft();
  location.reload();
}

function setTutorialStatus(stateName, message) {
  const status = $('tutorialConnectionStatus');
  status.dataset.state = stateName;
  status.textContent = message;
}

async function initializeTutorialSecurity() {
  localStorage.removeItem(TUTORIAL_SETTINGS_KEY);
  $('elevenlabsApiKey').value = '';
  $('elevenlabsVoiceId').value = '';
  try {
    const status = await tutorialRequest('/api/elevenlabs/status');
    $('elevenlabsApiKey').disabled = false;
    $('elevenlabsVoiceId').disabled = false;
    $('saveElevenLabs').disabled = false;
    const provider = status.protection === 'SERVER_ENVIRONMENT' ? '.env' : 'Windows DPAPI';
    setTutorialStatus(status.configured && status.voiceMode !== 'INCOMPLETE' ? 'connected' : 'error', status.configured ? `${provider} · ${status.voiceMode}` : 'Niet geconfigureerd');
  } catch (error) {
    setTutorialStatus('error', 'Configuratiestatus onbekend');
    debug('Tutorialconfiguratiestatus mislukt', { message: error.message });
  }
}

async function saveSecureTutorialSettings() {
  const apiKey = $('elevenlabsApiKey').value.trim();
  const voiceId = $('elevenlabsVoiceId').value.trim();
  if (!apiKey || !voiceId) {
    alertUser('Vul een nieuwe API-key en multilingual voice-ID in om deze veilig op te slaan.');
    return;
  }
  const button = $('saveElevenLabs');
  button.disabled = true;
  setTutorialStatus('reconnecting', 'Versleuteld opslaan…');
  try {
    const status = await tutorialRequest('/api/elevenlabs/configure', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, voiceId }),
    });
    $('elevenlabsApiKey').value = '';
    $('elevenlabsVoiceId').value = '';
    localStorage.removeItem(TUTORIAL_SETTINGS_KEY);
    setTutorialStatus('connected', `Veilig geconfigureerd · ${status.voiceMode}`);
  } catch (error) {
    setTutorialStatus('error', 'Veilig opslaan mislukt');
    alertUser('De ElevenLabs-configuratie kon niet veilig worden opgeslagen.');
    debug('Veilige tutorialconfiguratie mislukt', { message: error.message });
  } finally {
    button.disabled = false;
    await initializeTutorialSecurity();
  }
}

async function tutorialRequest(path, options = {}) {
  const allowedTutorialRoute = path === '/api/elevenlabs/test'
    || path === '/api/elevenlabs/status'
    || path === '/api/elevenlabs/configure'
    || path === '/api/tutorial'
    || /^\/api\/tutorial\/status\?id=[A-Za-z0-9_-]+$/.test(path);
  if (!allowedTutorialRoute) throw new Error('Niet-toegestane lokale tutorialroute.');
  const endpoint = new URL(path, window.location.origin);
  if (endpoint.origin !== window.location.origin) throw new Error('Externe tutorialroutes zijn geblokkeerd.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(endpoint, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? `Lokale tutorialservice antwoordde met status ${response.status}.`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function testElevenLabs() {
  clearAlert();
  const button = $('testElevenLabs');
  button.disabled = true;
  setTutorialStatus('reconnecting', 'Verbinden…');
  try {
    const result = await tutorialRequest('/api/elevenlabs/test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    setTutorialStatus('connected', `Verbonden · ${result.tier}`);
  } catch (error) {
    setTutorialStatus('error', 'Verbindingsfout');
    alertUser('ElevenLabs-verbinding mislukt. Controleer de API-key en lokale service.');
    debug('ElevenLabs-verbinding mislukt', { message: error.message });
  } finally {
    button.disabled = false;
  }
}

async function createTutorialVideo() {
  if (tutorialPolling) return;
  clearAlert();
  const button = $('createTutorialVideo');
  button.disabled = true;
  tutorialPolling = true;
  setTutorialStatus('reconnecting', 'Productie gestart…');
  $('tutorialOutputLocation').hidden = true;
  try {
    const started = await tutorialRequest('/api/tutorial', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: state.configuration?.locale ?? 'en-US' }),
    });
    let job = started.job;
    for (let attempt = 0; attempt < 900 && job.status === 'RUNNING'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 2_000));
      job = (await tutorialRequest(`/api/tutorial/status?id=${encodeURIComponent(job.id)}`)).job;
    }
    if (job.status !== 'PASS') throw new Error(job.error ?? 'Tutorialproductie is niet geslaagd.');
    setTutorialStatus('connected', `Gereed · ${job.language.toUpperCase()}`);
    $('tutorialOutputLocation').textContent = `Projectmap: ${job.outputPath}`;
    $('tutorialOutputLocation').hidden = false;
    announce('Instructievideo is volledig gegenereerd.');
  } catch (error) {
    setTutorialStatus('error', 'Productiefout');
    alertUser('Instructievideo kon niet volledig worden gemaakt. Controleer ElevenLabs, Chrome en de lokale service.');
    debug('Tutorialproductie mislukt', { message: error.message });
  } finally {
    tutorialPolling = false;
    button.disabled = false;
  }
}

function bindEvents() {
  $('productSearch').addEventListener('input', renderProducts);
  $('familyFilter').addEventListener('change', renderProducts);
  $('productSort').addEventListener('change', renderProducts);
  for (const id of ['market', 'audience', 'locale', 'currency', 'platformProfile', 'productTitle', 'filename', 'year', 'startMonth', 'inputCapacity', 'outputProfile', 'sampleDataEnabled', 'carryOver', 'productAppearanceLight', 'productAppearanceDark', 'categories']) {
    $(id).addEventListener(id === 'productTitle' || id === 'audience' || id === 'categories' ? 'input' : 'change', updateConfigurationFromForm);
  }
  $('previousStep').addEventListener('click', () => goToStep(state.step - 1));
  $('nextStep').addEventListener('click', nextStep);
  $('refreshPreview').addEventListener('click', refreshPreview);
  $('runValidation').addEventListener('click', runPreflight);
  $('generateProduct').addEventListener('click', generateProduct);
  $('downloadWorkbook').addEventListener('click', downloadWorkbook);
  $('downloadPackage').addEventListener('click', downloadPackage);
  $('downloadImages').addEventListener('click', downloadImagesArchive);
  $('saveElevenLabs').addEventListener('click', saveSecureTutorialSettings);
  $('testElevenLabs').addEventListener('click', testElevenLabs);
  $('createTutorialVideo').addEventListener('click', createTutorialVideo);
  $('saveDecision').addEventListener('click', saveDecision);
  $('openSettings').addEventListener('click', () => toggleSettings($('settingsPanel').hidden));
  $('closeSettings').addEventListener('click', () => toggleSettings(false));
  $('generatorAppearance').addEventListener('change', updateGeneratorAppearance);
  document.querySelectorAll('[data-generator-appearance-value]').forEach(button => button.addEventListener('click', updateGeneratorAppearance));
  $('openManual').addEventListener('click', () => $('manualDialog').showModal());
  $('duplicateDraft').addEventListener('click', duplicateConfiguration);
  $('exportDraft').addEventListener('click', exportDraftFile);
  $('importDraft').addEventListener('change', event => importDraftFile(event.target.files?.[0]));
  $('resetDraft').addEventListener('click', resetApplication);
  $('openBatch').addEventListener('click', () => { populateBatchDialog(); $('batchDialog').showModal(); });
  $('runBatch').addEventListener('click', runBatchProduction);
  $('batchDialog').addEventListener('close', () => batchController?.abort());
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('settingsPanel').hidden) toggleSettings(false); });
}

function restoreOrDefault() {
  const loaded = loadDraft();
  for (const warning of loaded.warnings) debug(warning);
  if (loaded.state?.configuration) {
    try {
      state.configuration = factory.configuration(loaded.state.configuration.productId, {}, { persistedState: loaded.state.configuration });
      if (!factory.validate(state.configuration).valid) throw new Error('Stored configuration failed current validation.');
      state.step = clamp(Number(loaded.state.step ?? 1), 1, STEPS.length);
      state.audience = loaded.state.audience ?? state.audience;
      const rawAudience = currentDefinition()?.commercialMetadata.targetAudience.join(', ');
      if (!state.audience || state.audience === rawAudience) state.audience = localizedAudience(currentDefinition());
      state.approval = loaded.state.approval ?? state.approval;
      return;
    } catch (error) {
      debug('Opgeslagen concept geweigerd', { message: error.message });
    }
  }
  const definition = activeProducts.find(product => product.recommended) ?? activeProducts[0];
  if (!definition) throw new Error(translate('ui.runtime.noActiveProducts'));
  state.configuration = factory.configuration(definition.id, definition.defaultConfiguration);
  state.audience = localizedAudience(definition);
}

function renderAll() {
  renderGeneratorAppearance();
  applyStaticTranslations();
  renderProductFilters();
  renderProducts();
  renderForm();
  renderThemes();
  renderPreview();
  renderValidation();
  renderQuality();
  renderPackage();
  renderApproval();
  renderSummary();
  renderStepChrome();
}

function initialize() {
  try {
    if (!globalThis.ExcelJS?.Workbook || typeof globalThis.JSZip !== 'function') throw new Error(translate('ui.runtime.dependenciesMissing'));
    restoreGeneratorAppearance();
    restoreOrDefault();
    bindEvents();
    renderAll();
    void initializeTutorialSecurity();
    goToStep(state.step);
    setRuntimeStatus('ready', 'ui.generation.runtimeReady');
    debug('Runtime gereed', { products: activeProducts.length, locales: productionLocaleIds.length, currencies: Object.keys(currencyCatalog).length, themes: Object.keys(themeCatalog).length });
  } catch (error) {
    setRuntimeStatus('error', 'ui.runtime.initializationError');
    alertUser(translate('ui.runtime.initializationFailed', '', { message: friendlyError(error) }));
    debug('Initialisatie mislukt', { message: error.message });
  }
}

window.addEventListener('load', initialize, { once: true });
