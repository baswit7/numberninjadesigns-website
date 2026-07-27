const PRODUCTIONS = Object.freeze({
  digital: {
    id: 'digital',
    label: 'Digital Production',
    description: 'Templates, workbooks and downloadable listing packages',
    catalog: '../../../index.html#digital-products',
    stages: ['NO LISTING', 'DRAFT', 'BLOCKED', 'REVIEW', 'READY']
  },
  physical: {
    id: 'physical',
    label: 'Physical Production',
    description: 'Apparel, source artwork, mockups and physical listing packages',
    catalog: '../../../designs.html',
    stages: ['SOURCE ART', 'MOCKUP', 'PRODUCT', 'REVIEW', 'READY']
  }
});
const requestedProduction = new URLSearchParams(location.search).get('production');
const production = PRODUCTIONS[requestedProduction] || PRODUCTIONS.digital;
const STORAGE_KEY = `numberninjadesigns.listing-intelligence.${production.id}.v1`;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const elements = {
  cards: document.querySelector('#cards'),
  branchDescription: document.querySelector('#branchDescription'),
  branchName: document.querySelector('#branchName'),
  catalogLink: document.querySelector('#catalogLink'),
  drop: document.querySelector('#drop'),
  files: document.querySelector('#files'),
  imports: document.querySelector('#imports'),
  pipeline: document.querySelector('#pipeline'),
  selection: document.querySelector('#selection'),
  status: document.querySelector('#status'),
  productionLabel: document.querySelector('#productionLabel')
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"imports":[]}');
    return { imports: Array.isArray(saved.imports) ? saved.imports : [] };
  } catch (error) {
    console.warn('[NumberNinjaDesigns Listing Intelligence] Recovered invalid local state.', error);
    return { imports: [] };
  }
}

const state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('[NumberNinjaDesigns Listing Intelligence] Local state could not be saved.', error);
    setStatus('STORAGE ERROR', 'error');
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character]);
}

function setStatus(message, mode = 'ready') {
  elements.status.textContent = message;
  elements.status.dataset.mode = mode;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderSelection(items) {
  if (!items.length) {
    elements.selection.hidden = true;
    elements.selection.innerHTML = '';
    return;
  }

  const hasErrors = items.some(item => item.status === 'ERROR' || item.status === 'REVIEW');
  const isProcessing = items.some(item => item.status === 'PROCESSING');
  elements.selection.hidden = false;
  elements.selection.dataset.mode = hasErrors ? 'warning' : isProcessing ? 'loading' : 'ready';
  elements.selection.innerHTML = `
    <div class="selection-heading">
      <small>${items.length === 1 ? 'SELECTED CSV' : 'SELECTED CSV FILES'}</small>
      <span>${items.length} ${items.length === 1 ? 'file' : 'files'}</span>
    </div>
    <ul>
      ${items.map(item => `
        <li>
          <div>
            <b>${escapeHtml(item.name)}</b>
            <span>${escapeHtml(formatFileSize(item.size))} · ${escapeHtml(item.detail)}</span>
          </div>
          <strong data-state="${escapeHtml(item.status)}">${escapeHtml(item.status)}</strong>
        </li>
      `).join('')}
    </ul>
  `;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function detectExport(headers) {
  const normalized = headers.map(normalizeHeader);
  if (normalized.includes('search term') || normalized.includes('searches')) return 'SIMILAR KEYWORDS';
  if (normalized.includes('listing count') || normalized.includes('volume')) return 'TOP LISTINGS';
  if (normalized.includes('listing id') || normalized.includes('estimated sales') || normalized.includes('search volume')) return 'LISTINGS';
  return 'UNKNOWN';
}

function renderCards() {
  const totalRows = state.imports.reduce((sum, item) => sum + item.rows, 0);
  const known = state.imports.filter(item => item.type !== 'UNKNOWN').length;
  const unknown = state.imports.length - known;
  const latest = state.imports[0]?.importedAt
    ? new Date(state.imports[0].importedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
    : '—';
  const cards = [
    ['Production', production.label],
    ['Research files', state.imports.length],
    ['Imported rows', totalRows],
    ['Recognized datasets', known],
    ['Unknown schemas', unknown],
    ['Latest import', latest],
    ['Storage', 'LOCAL'],
    ['Review gate', 'HUMAN']
  ];

  elements.cards.innerHTML = cards.map(([label, value]) => (
    `<article class="card"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></article>`
  )).join('');
}

function renderPipeline() {
  elements.pipeline.innerHTML = production.stages.map(stage => (
    `<div class="stage"><small>${stage}</small><strong>—</strong><span>${production.id === 'physical' ? 'AWAITING PRODUCT EVIDENCE' : 'NO PACKAGE SOURCE'}</span></div>`
  )).join('');
}

function renderImports() {
  elements.imports.innerHTML = state.imports.length
    ? state.imports.map(item => (
      `<div class="row"><b>${escapeHtml(item.name)}</b><span>${escapeHtml(item.type)}</span><span>${item.fields} fields</span><span>${item.rows} rows</span></div>`
    )).join('')
    : '<p>No CSV imports processed in this browser.</p>';
}

function render() {
  document.title = `Listing Intelligence · ${production.label} | NumberNinjaDesigns`;
  elements.productionLabel.textContent = `NUMBERNINJADESIGNS / ${production.label.toUpperCase()}`;
  elements.branchName.textContent = production.label;
  elements.branchDescription.textContent = production.description;
  elements.catalogLink.href = production.catalog;
  document.querySelectorAll('[data-production-link]').forEach(link => {
    const active = link.dataset.productionLink === production.id;
    link.classList.toggle('active', active);
    link.setAttribute('aria-current', active ? 'page' : 'false');
  });
  renderCards();
  renderPipeline();
  renderImports();
}

async function processFiles(files) {
  const candidates = Array.from(files);
  if (!candidates.length) return;

  const selection = candidates.map(file => ({
    name: file.name,
    size: file.size,
    status: 'PROCESSING',
    detail: 'Reading locally…'
  }));
  renderSelection(selection);
  setStatus('PROCESSING', 'loading');
  let blocked = 0;

  for (const [index, file] of candidates.entries()) {
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Only CSV files are supported.');
      if (file.size > MAX_FILE_BYTES) throw new Error('CSV exceeds the 5 MB local limit.');

      const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ''));
      if (!rows.length) throw new Error('CSV is empty.');

      const type = detectExport(rows[0]);
      if (type === 'UNKNOWN') blocked += 1;
      selection[index].status = type === 'UNKNOWN' ? 'REVIEW' : 'IMPORTED';
      selection[index].detail = `${type} · ${Math.max(0, rows.length - 1)} rows`;
      state.imports.unshift({
        name: file.name,
        production: production.id,
        type,
        fields: rows[0].length,
        rows: Math.max(0, rows.length - 1),
        status: type === 'UNKNOWN' ? 'BLOCKED' : 'READY',
        importedAt: new Date().toISOString()
      });
    } catch (error) {
      blocked += 1;
      selection[index].status = 'ERROR';
      selection[index].detail = error.message;
      console.error(`[NumberNinjaDesigns Listing Intelligence] ${file.name} was not imported.`, error);
    }
  }

  renderSelection(selection);
  saveState();
  render();
  elements.files.value = '';
  setStatus(blocked ? `REVIEW ${blocked}` : 'READY', blocked ? 'warning' : 'ready');
}

elements.files.addEventListener('change', () => processFiles(elements.files.files));
elements.drop.addEventListener('dragover', event => {
  event.preventDefault();
  elements.drop.classList.add('over');
});
elements.drop.addEventListener('dragleave', () => elements.drop.classList.remove('over'));
elements.drop.addEventListener('drop', event => {
  event.preventDefault();
  elements.drop.classList.remove('over');
  processFiles(event.dataTransfer.files);
});

render();
