const STORAGE_KEY = 'numberninjadesigns.listing-intelligence.dashboard.v1';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const elements = {
  cards: document.querySelector('#cards'),
  drop: document.querySelector('#drop'),
  files: document.querySelector('#files'),
  imports: document.querySelector('#imports'),
  pipeline: document.querySelector('#pipeline'),
  status: document.querySelector('#status')
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
    ['Research files', state.imports.length],
    ['Imported rows', totalRows],
    ['Recognized datasets', known],
    ['Unknown schemas', unknown],
    ['Latest import', latest],
    ['Storage', 'LOCAL'],
    ['API', 'NOT CONFIGURED'],
    ['MCP', 'NOT CONFIGURED']
  ];

  elements.cards.innerHTML = cards.map(([label, value]) => (
    `<article class="card"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></article>`
  )).join('');
}

function renderPipeline() {
  const stages = ['NO LISTING', 'DRAFT', 'BLOCKED', 'REVIEW', 'READY'];
  elements.pipeline.innerHTML = stages.map(stage => (
    `<div class="stage"><small>${stage}</small><strong>—</strong><span>NO PACKAGE SOURCE</span></div>`
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
  renderCards();
  renderPipeline();
  renderImports();
}

async function processFiles(files) {
  const candidates = Array.from(files);
  if (!candidates.length) return;

  setStatus('PROCESSING', 'loading');
  let blocked = 0;

  for (const file of candidates) {
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Only CSV files are supported.');
      if (file.size > MAX_FILE_BYTES) throw new Error('CSV exceeds the 5 MB local limit.');

      const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ''));
      if (!rows.length) throw new Error('CSV is empty.');

      const type = detectExport(rows[0]);
      if (type === 'UNKNOWN') blocked += 1;
      state.imports.unshift({
        name: file.name,
        type,
        fields: rows[0].length,
        rows: Math.max(0, rows.length - 1),
        status: type === 'UNKNOWN' ? 'BLOCKED' : 'READY',
        importedAt: new Date().toISOString()
      });
    } catch (error) {
      blocked += 1;
      console.error(`[NumberNinjaDesigns Listing Intelligence] ${file.name} was not imported.`, error);
    }
  }

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
