import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const EMPTY_VALUES = new Set(['', 'n/a', 'na', '-', 'null', 'undefined']);
const NUMERIC_HEADERS = /(?:price|revenue|sales|conversion|trend|reviews?|favorites?|views?|rating|length|rank|count|listings?|shops?|score|age in months|avg age|#)$/i;
const MONEY_HEADERS = /(?:price|revenue|gross sales)$/i;
const PERCENT_HEADERS = /(?:conversion|trend|review rate)$/i;
const INTEGER_HEADERS = /(?:sales|reviews?|favorites?|views?|title length|feature rank|tags count|variants|digital listings|shop sales|listings|new listings|age in months|total listings|total shops|#)$/i;

const SCREENSHOT_EVIDENCE = Object.freeze({
  b35bacf08511f1955f6f41f5c47b35460ef6f2be34149cddaa84c7f7727783c8: { classification: 'irrelevant-general', confidence: 'low', observations: ['Unfiltered ListingView database results with predominantly physical products.'] },
  d58b3bef72bde2f4e79a0b981096dc9e8e33032509ed73bc72e028764faf6f7c: { classification: 'finance-dashboard', confidence: 'high', observations: ['Finance dashboard listing', 'Google Sheets positioning', 'Annual budget, monthly budget, debt, savings, bills and paycheck tags', 'Exactly 13 listing tags shown'] },
  '32adf45294bdf1989aa9a31358eb87ad27a6688743aa1cb03d6786fb652ec073': { classification: 'project-management', confidence: 'high', observations: ['Project manager workbook', 'Excel and Google Sheets positioning', 'Gantt, Kanban, Eisenhower and task tracking features', 'Exactly 13 listing tags shown'] },
  '0d488c2285a5d81d3555638086de67b7f6e54551d445341a6b48eeab7ad122a0': { classification: 'paycheck-biweekly', confidence: 'high', observations: ['Monthly savings and expenses workbook', 'Weekly income, bills, debt and biweekly positioning', 'Excel and Google Sheets positioning'] },
  '4741c43f971170a62db7689a6f6e2bc00cc15eb56a0d4fba5d5224a1a1d1dd40': { classification: 'paycheck-biweekly', confidence: 'high', observations: ['Weekly, monthly and paycheck budget', 'Google Sheets positioning', 'Beginner, family, savings, debt and bill tag coverage'] },
  '03027c56a0c2d96cc5474c9a7bed295c0019814abb17bdb5a5677264da7b7c8b': { classification: 'life-planning', confidence: 'high', observations: ['ADHD-friendly budget positioning', 'Low-friction weekly and paycheck workflow', 'No evidence supporting a medical claim'] },
  e7bd4bbfda1b69e2721fcfa33a872b89c2c31dc84266a9ffb4aff7422a4ccbcd: { classification: 'irrelevant-general', confidence: 'low', observations: ['General reMarkable planner; not spreadsheet-market evidence.'] },
  ed998505bac6bb492507eb32bb858bae6593bc4d7ee32314d2c8937d01d1b3cd: { classification: 'paycheck-biweekly', confidence: 'high', observations: ['Paycheck budgeting workbook', 'Bills, savings and debt tracking', 'Excel and Google Sheets positioning', 'Exactly 13 listing tags shown'] },
  '3e80f9ffd896007e3f835bdb6345e8b6c2027c3a22be89fb09b468cb53313700': { classification: 'multi-family-shop', confidence: 'high', observations: ['Shop portfolio includes wedding planner, project planner, small-business bookkeeping, task tracker, co-parenting, pricing calculator and content planner products.'] },
  '445d0de786181e4a964c0f6dc2edfe5960eeb56b01d4b90ac4c849f610f9589b': { classification: 'multi-family-shop', confidence: 'high', observations: ['Shop portfolio includes biweekly/paycheck budget, debt payoff, business bookkeeping, task tracking and project planning products.'] },
  f081668b58cba60cb3f662dc5e66a5741de477ac13513e81e9cb97ffc019432a: { classification: 'personal-finance', confidence: 'high', observations: ['Budget tag market', 'Google Sheets, Excel budget, monthly budget, expense tracker and personal-finance related tags.'] },
  '65673a4585a1a2d8d6522e61a940f6b8760af45a25c24a3cab3be644b6077ee2': { classification: 'annual-monthly-budget', confidence: 'high', observations: ['Excel budget tag market', 'Biweekly, monthly, couples, family, dashboard and beginner budget sub-intents.'] },
  '1ee10869ddd4dc333ddcf8edc075e8eaf077fe389b589fb16adfaa6f4d337d41': { classification: 'platform-positioning', confidence: 'high', observations: ['Extracted tags include Google Sheets budget, Excel budget, paycheck, biweekly, debt, monthly and spreadsheet template.'] },
});

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const cleanText = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalizedText = value => cleanText(value).toLocaleLowerCase('en-US');

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1];
    if (current === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (current === '"') {
      quoted = !quoted;
    } else if (current === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((current === '\n' || current === '\r') && !quoted) {
      if (current === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some(cell => cell.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += current;
    }
  }
  row.push(field);
  if (row.some(cell => cell.trim())) rows.push(row);
  return rows;
}

function inferNumericKind(header) {
  if (MONEY_HEADERS.test(header)) return 'money';
  if (PERCENT_HEADERS.test(header)) return 'percentage';
  if (INTEGER_HEADERS.test(header)) return 'integer';
  return 'decimal';
}

function separatorPattern(value) {
  const dotCount = (value.match(/\./g) ?? []).length;
  const commaCount = (value.match(/,/g) ?? []).length;
  if (dotCount && commaCount) {
    return value.lastIndexOf('.') > value.lastIndexOf(',') ? 'us-mixed' : 'eu-mixed';
  }
  if (dotCount > 1) return 'dot-grouped';
  if (commaCount > 1) return 'comma-grouped';
  if (dotCount === 1) return 'single-dot';
  if (commaCount === 1) return 'single-comma';
  return 'plain';
}

export function normalizeListingViewNumber(raw, { kind = 'decimal' } = {}) {
  const rawValue = raw == null ? '' : String(raw).trim();
  if (EMPTY_VALUES.has(rawValue.toLowerCase())) {
    return { raw: rawValue, value: null, kind, detectedFormat: 'empty', status: 'EMPTY', warnings: [] };
  }

  const warnings = [];
  const hadPercent = rawValue.includes('%');
  const negativeParentheses = /^\(.*\)$/.test(rawValue);
  let cleaned = rawValue
    .replace(/[\s\u00a0]/g, '')
    .replace(/[$€£¥]/g, '')
    .replace(/%/g, '')
    .replace(/^\((.*)\)$/, '$1');
  if (!/^[+-]?[0-9][0-9.,]*$/.test(cleaned)) {
    return { raw: rawValue, value: null, kind, detectedFormat: 'invalid', status: 'INVALID', warnings: ['NON_NUMERIC_VALUE'] };
  }

  const sign = negativeParentheses ? -1 : 1;
  const unsigned = cleaned.replace(/^[+-]/, '');
  const explicitSign = cleaned.startsWith('-') ? -1 : 1;
  const pattern = separatorPattern(unsigned);
  let detectedFormat = pattern;
  let normalized = cleaned;
  let ambiguous = false;

  if (pattern === 'us-mixed') {
    if (!/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(unsigned)) ambiguous = true;
    normalized = cleaned.replaceAll(',', '');
    detectedFormat = 'decimal-dot-thousands-comma';
  } else if (pattern === 'eu-mixed') {
    if (!/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(unsigned)) ambiguous = true;
    normalized = cleaned.replaceAll('.', '').replace(',', '.');
    detectedFormat = 'decimal-comma-thousands-dot';
  } else if (pattern === 'dot-grouped') {
    if (/^\d{1,3}(\.\d{3})+$/.test(unsigned)) {
      normalized = cleaned.replaceAll('.', '');
      detectedFormat = 'thousands-dot';
    } else {
      ambiguous = true;
    }
  } else if (pattern === 'comma-grouped') {
    if (/^\d{1,3}(,\d{3})+$/.test(unsigned)) {
      normalized = cleaned.replaceAll(',', '');
      detectedFormat = 'thousands-comma';
    } else {
      ambiguous = true;
    }
  } else if (pattern === 'single-dot' || pattern === 'single-comma') {
    const separator = pattern === 'single-dot' ? '.' : ',';
    const [whole, fraction] = unsigned.split(separator);
    const groupingSemantic = ['integer', 'money'].includes(kind) && fraction.length === 3 && whole.length <= 3;
    if (groupingSemantic) {
      normalized = cleaned.replace(separator, '');
      detectedFormat = separator === '.' ? 'thousands-dot' : 'thousands-comma';
    } else if (kind === 'integer' && fraction.length !== 3) {
      ambiguous = true;
    } else {
      normalized = separator === ',' ? cleaned.replace(',', '.') : cleaned;
      detectedFormat = separator === ',' ? 'decimal-comma' : 'decimal-dot';
    }
  } else {
    detectedFormat = 'integer-plain';
  }

  if (ambiguous) {
    return { raw: rawValue, value: null, kind, detectedFormat: 'ambiguous', status: 'AMBIGUOUS', warnings: ['AMBIGUOUS_LOCALE_NUMBER'] };
  }

  let value = Number(normalized) * sign;
  if (!Number.isFinite(value)) {
    return { raw: rawValue, value: null, kind, detectedFormat, status: 'INVALID', warnings: ['NON_FINITE_NUMBER'] };
  }
  if (negativeParentheses && explicitSign < 0) value = Math.abs(value);
  if (kind === 'percentage') {
    value /= 100;
    if (!hadPercent) warnings.push('PERCENT_SYMBOL_MISSING_FIELD_SEMANTIC_USED');
  }
  return { raw: rawValue, value, kind, detectedFormat, status: warnings.length ? 'REVIEW' : 'PASS', warnings };
}

function detectCsvType(headers) {
  const set = new Set(headers.map(normalizedText));
  if (set.has('title') && set.has('shop') && (set.has('monthly sales') || set.has('6mo sales'))) return 'listings';
  if (set.has('shop name') && set.has('primary category')) return 'shops';
  if (set.has('tag') && set.has('opportunity score')) return 'tags';
  if (set.has('keywords') && set.has('competing listings')) return 'similar-keywords';
  if (set.has('listing title') && set.has('gross sales')) return 'top-listings';
  return 'unknown';
}

export function classifyMarketText(value) {
  const text = normalizedText(value);
  if (!text) return 'irrelevant-general';
  const spreadsheetSignal = /spreadsheet|google sheets|excel|dashboard|tracker|template|planner|workbook|calculator|crm/.test(text);
  if (/wedding/.test(text) && spreadsheetSignal && /planner|budget|guest|rsvp|vendor|timeline|checklist|seating|payment/.test(text)) return 'wedding-planning';
  if (/project management|project manager|project planner|project dashboard|gantt|kanban|risk register|project timeline|project cost/.test(text) && spreadsheetSignal) return 'project-management';
  if (/task tracker|task planner|team task|eisenhower|workload planner|meeting action|launch planner|content planner|social media content/.test(text) && spreadsheetSignal) return 'task-management';
  if (/small business|bookkeeping|profit and loss|sales and profit|pricing calculator|invoice|business crm|cashflow forecast|freelancer finance|self-employed income|client project profitability/.test(text) && spreadsheetSignal) return 'small-business-bookkeeping';
  if (/co-parent|custody|shared expense|child support|household management|home maintenance|moving planner|travel budget|student budget|college finance|life planner|adhd|habit tracker|family schedule/.test(text) && spreadsheetSignal) return 'life-planning';
  if (/debt|snowball|avalanche|savings|sinking fund|bill tracker|bill calendar|emergency fund/.test(text) && spreadsheetSignal) return 'debt-savings-bills';
  if (/paycheck|biweekly|bi-weekly|fortnightly/.test(text) && spreadsheetSignal) return 'paycheck-biweekly';
  if (/finance dashboard|financial dashboard/.test(text) && spreadsheetSignal) return 'finance-dashboard';
  if (/annual budget|yearly budget|monthly budget/.test(text) && spreadsheetSignal) return 'annual-monthly-budget';
  if (/personal finance|budget spreadsheet|budget planner|income and expense|expense tracker|financial planner/.test(text) && spreadsheetSignal) return 'personal-finance';
  if (/google sheets|excel/.test(text) && spreadsheetSignal) return 'platform-positioning';
  return 'irrelevant-general';
}

function recordText(headers, row) {
  const fields = headers
    .map((header, index) => ({ header: normalizedText(header), value: row[index] }))
    .filter(item => /title|category|keyword|tag|shop name/.test(item.header))
    .map(item => item.value);
  return fields.join(' ');
}

function classifyCsv(headers, rows, csvType) {
  const classifications = rows.map(row => classifyMarketText(recordText(headers, row)));
  const counts = Object.fromEntries([...new Set(classifications)].sort().map(key => [key, classifications.filter(value => value === key).length]));
  const relevant = classifications.filter(value => value !== 'irrelevant-general');
  if (csvType === 'tags' || csvType === 'shops') {
    const relevantRatio = relevant.length / Math.max(1, classifications.length);
    if (relevantRatio < 0.2) return { classification: 'irrelevant-general', confidence: 'low', counts };
  }
  if (!relevant.length) return { classification: 'irrelevant-general', confidence: 'low', counts };
  const ranked = Object.entries(counts)
    .filter(([key]) => key !== 'irrelevant-general')
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'en-US'));
  const [dominant, count] = ranked[0];
  const share = count / relevant.length;
  return { classification: share >= 0.6 ? dominant : 'mixed-relevant', confidence: share >= 0.6 && count >= 5 ? 'high' : 'medium', counts };
}

async function walkFiles(root) {
  const files = [];
  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en-US'));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  await visit(root);
  return files;
}

function normalizeRecord(headers, row, source) {
  const rawRecord = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
  const normalizedRecord = {};
  for (const [header, raw] of Object.entries(rawRecord)) {
    normalizedRecord[header] = NUMERIC_HEADERS.test(header)
      ? normalizeListingViewNumber(raw, { kind: inferNumericKind(header) })
      : { raw, value: raw, kind: 'text', detectedFormat: 'text', status: 'PASS', warnings: [] };
  }
  return { ...source, classification: classifyMarketText(recordText(headers, row)), rawRecord, normalizedRecord };
}

function pngDimensions(bytes) {
  if (bytes.length < 24 || bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function valueFor(record, matcher) {
  const entry = Object.entries(record.normalizedRecord).find(([header]) => matcher.test(header));
  return entry?.[1]?.status === 'PASS' || entry?.[1]?.status === 'REVIEW' ? entry[1].value : null;
}

function textFor(record, headerName) {
  const entry = Object.entries(record.rawRecord).find(([header]) => normalizedText(header) === headerName);
  return cleanText(entry?.[1]);
}

function quantile(values, percentile) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const remainder = position - lower;
  return sorted[lower + 1] === undefined ? sorted[lower] : sorted[lower] + remainder * (sorted[lower + 1] - sorted[lower]);
}

function bands(values) {
  const clean = values.filter(Number.isFinite);
  return { count: clean.length, minimum: clean.length ? Math.min(...clean) : null, p25: quantile(clean, 0.25), median: quantile(clean, 0.5), p75: quantile(clean, 0.75), maximum: clean.length ? Math.max(...clean) : null };
}

function topCounts(values, limit = 20) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'en-US')).slice(0, limit).map(([value, count]) => ({ value, count }));
}

function titlePhrases(titles) {
  const stop = new Set(['and', 'for', 'the', 'with', 'your', 'digital', 'download', 'template', 'spreadsheet', 'google', 'sheets', 'excel']);
  const phrases = [];
  for (const title of titles) {
    const words = normalizedText(title).replace(/[^a-z0-9 -]/g, ' ').split(/\s+/).filter(word => word.length > 2 && !stop.has(word));
    for (let index = 0; index < words.length - 1; index += 1) phrases.push(`${words[index]} ${words[index + 1]}`);
  }
  return topCounts(phrases, 20).filter(item => item.count >= 2);
}

function featureSignals(titles) {
  const catalog = ['dashboard', 'monthly budget', 'annual budget', 'paycheck', 'biweekly', 'debt', 'savings', 'sinking funds', 'bill tracker', 'bookkeeping', 'profit and loss', 'pricing calculator', 'invoice', 'task tracker', 'gantt', 'kanban', 'eisenhower', 'wedding planner', 'guest list', 'vendor', 'co-parenting', 'adhd', 'tutorial'];
  return catalog.map(feature => ({ feature, count: titles.filter(title => normalizedText(title).includes(feature)).length })).filter(item => item.count > 0).sort((left, right) => right.count - left.count || left.feature.localeCompare(right.feature, 'en-US'));
}

function marketGaps(clusterCounts, screenshotEvidence) {
  const screenshotClasses = new Set(screenshotEvidence.map(item => item.classification));
  const count = id => clusterCounts[id] ?? 0;
  return [
    { product: 'Simple Monthly Budget', evidenceStatus: count('annual-monthly-budget') || count('personal-finance') ? 'SUPPORTED' : 'INSUFFICIENT', differentiators: ['low-friction onboarding', 'visible checks', 'Excel-native formulas'] },
    { product: 'Annual Budget Spreadsheet', evidenceStatus: count('annual-monthly-budget') ? 'SUPPORTED' : 'INSUFFICIENT', differentiators: ['12-month rollup', 'variance analysis', 'clear input/formula roles'] },
    { product: 'Ultimate Finance Dashboard', evidenceStatus: count('finance-dashboard') || screenshotClasses.has('finance-dashboard') ? 'SUPPORTED' : 'INSUFFICIENT', differentiators: ['auditable KPIs', 'trend views', 'debt and savings integration'] },
    { product: 'Paycheck Budget', evidenceStatus: count('paycheck-biweekly') || screenshotClasses.has('paycheck-biweekly') ? 'SUPPORTED' : 'INSUFFICIENT', differentiators: ['pay-period workflow', 'bill allocation', 'roll-forward checks'] },
    { product: 'Debt and Savings Bundle', evidenceStatus: count('debt-savings-bills') ? 'SUPPORTED' : 'INSUFFICIENT', differentiators: ['debt and savings checks', 'goal progress', 'no outcome guarantees'] },
    { product: 'Project Management Spreadsheet', evidenceStatus: count('project-management') || screenshotClasses.has('project-management') ? 'SUPPORTED' : 'INSUFFICIENT', differentiators: ['Gantt, Kanban and risk views', 'task ownership', 'status dashboard'] },
    { product: 'Small Business Bookkeeping', evidenceStatus: count('small-business-bookkeeping') ? 'SUPPORTED' : 'INSUFFICIENT', differentiators: ['income/expense audit trail', 'profitability KPIs', 'neutral accounting disclaimer'] },
    { product: 'Wedding Planner', evidenceStatus: screenshotClasses.has('multi-family-shop') ? 'MARKET_VALIDATION_REQUIRED' : 'INSUFFICIENT', differentiators: ['wedding-specific guest, vendor and payment workflow', 'warm professional theme', 'no renamed budget-only experience'] },
  ];
}

export async function analyzeListingViewSourceSet(sourceRoot, { analyzedAt = '2026-07-20T00:00:00.000Z' } = {}) {
  const absoluteRoot = path.resolve(sourceRoot);
  const stat = await fs.stat(absoluteRoot);
  if (!stat.isDirectory()) throw new Error(`ListingView source root is not a directory: ${absoluteRoot}`);
  const files = await walkFiles(absoluteRoot);
  const hashOwners = new Map();
  const fileRegister = [];
  const normalizedRecords = [];
  const csvFiles = [];
  const screenshotEvidence = [];

  for (const absolutePath of files) {
    const bytes = await fs.readFile(absolutePath);
    const hash = sha256(bytes);
    const relativePath = path.relative(absoluteRoot, absolutePath).split(path.sep).join('/');
    const duplicateOf = hashOwners.get(hash) ?? null;
    if (!duplicateOf) hashOwners.set(hash, relativePath);
    const extension = path.extname(absolutePath).toLowerCase();
    const entry = { relativePath, extension, bytes: bytes.length, sha256: hash, readable: bytes.length > 0, duplicateOf };

    if (extension === '.csv') {
      const rows = parseCsv(bytes.toString('utf8').replace(/^\uFEFF/, ''));
      const headers = rows[0] ?? [];
      const dataRows = rows.slice(1);
      const csvType = detectCsvType(headers);
      const classification = classifyCsv(headers, dataRows, csvType);
      Object.assign(entry, { sourceType: csvType, records: dataRows.length, ...classification });
      csvFiles.push(entry);
      dataRows.forEach((row, index) => normalizedRecords.push(normalizeRecord(headers, row, { sourceFile: relativePath, sourceSha256: hash, sourceRow: index + 2, sourceType: csvType, duplicateSourceFile: Boolean(duplicateOf) })));
    } else if (extension === '.png') {
      const evidence = SCREENSHOT_EVIDENCE[hash] ?? { classification: 'unreviewed-screenshot', confidence: 'low', observations: ['No curated content review is registered for this exact screenshot hash.'] };
      Object.assign(entry, { sourceType: 'screenshot', dimensions: pngDimensions(bytes), ...evidence });
      screenshotEvidence.push({ sourceFile: relativePath, sha256: hash, duplicateOf, ...evidence });
    } else {
      Object.assign(entry, { sourceType: 'documentation', classification: 'source-documentation', confidence: 'high' });
    }
    fileRegister.push(entry);
  }

  const uniqueRelevantListings = [];
  const seenListings = new Set();
  for (const record of normalizedRecords) {
    if (record.sourceType !== 'listings' && record.sourceType !== 'top-listings') continue;
    if (record.classification === 'irrelevant-general' || record.duplicateSourceFile) continue;
    const title = textFor(record, record.sourceType === 'top-listings' ? 'listing title' : 'title');
    const shop = textFor(record, 'shop');
    const key = `${normalizedText(title)}|${normalizedText(shop)}`;
    if (!title || seenListings.has(key)) continue;
    seenListings.add(key);
    uniqueRelevantListings.push(record);
  }

  const titles = uniqueRelevantListings.map(record => textFor(record, record.sourceType === 'top-listings' ? 'listing title' : 'title'));
  const clusterCounts = Object.fromEntries(topCounts(uniqueRelevantListings.map(record => record.classification), 50).map(item => [item.value, item.count]));
  const duplicateListingRows = normalizedRecords.filter(record => {
    if (record.sourceType !== 'listings') return false;
    const title = textFor(record, 'title');
    const shop = textFor(record, 'shop');
    return title && shop;
  }).length - new Set(normalizedRecords.filter(record => record.sourceType === 'listings').map(record => `${normalizedText(textFor(record, 'title'))}|${normalizedText(textFor(record, 'shop'))}`)).size;
  const ambiguousCells = normalizedRecords.flatMap(record => Object.entries(record.normalizedRecord).filter(([, value]) => value.status === 'AMBIGUOUS').map(([field, value]) => ({ sourceFile: record.sourceFile, sourceRow: record.sourceRow, field, raw: value.raw })));
  const invalidCells = normalizedRecords.flatMap(record => Object.entries(record.normalizedRecord).filter(([, value]) => value.status === 'INVALID').map(([field, value]) => ({ sourceFile: record.sourceFile, sourceRow: record.sourceRow, field, raw: value.raw })));

  const marketReport = {
    schemaVersion: '1.0.0',
    analyzedAt,
    sourceRoot: absoluteRoot,
    sourceSummary: {
      totalFiles: fileRegister.length,
      csvFiles: csvFiles.length,
      pngScreenshots: screenshotEvidence.length,
      duplicateFiles: fileRegister.filter(file => file.duplicateOf).length,
      totalCsvRecords: csvFiles.reduce((sum, file) => sum + file.records, 0),
      relevantCsvRecords: normalizedRecords.filter(record => record.classification !== 'irrelevant-general').length,
      irrelevantCsvRecords: normalizedRecords.filter(record => record.classification === 'irrelevant-general').length,
      uniqueRelevantListings: uniqueRelevantListings.length,
      duplicateListingRows: Math.max(0, duplicateListingRows),
    },
    numericNormalization: {
      policy: 'Field semantics and explicit separator patterns are used. Dot-grouped integers and money values are treated as thousands only when the grouping pattern is valid. Ambiguous values return null and are reported fail-closed.',
      rawValuesPreserved: true,
      ambiguousCellCount: ambiguousCells.length,
      invalidNumericCellCount: invalidCells.length,
      ambiguousCells,
      invalidCells: invalidCells.slice(0, 100),
    },
    fileRegister,
    productClusters: topCounts(uniqueRelevantListings.map(record => record.classification), 50),
    bands: {
      price: bands(uniqueRelevantListings.map(record => valueFor(record, /^price$/i))),
      sales: bands(uniqueRelevantListings.map(record => valueFor(record, /(?:monthly|6mo|total) sales$/i))),
      revenue: bands(uniqueRelevantListings.map(record => valueFor(record, /(?:monthly|6mo|total|gross) revenue$|gross sales$/i))),
      conversion: bands(uniqueRelevantListings.map(record => valueFor(record, /^conversion$/i))),
    },
    dominantShops: topCounts(uniqueRelevantListings.map(record => textFor(record, 'shop')), 15),
    recurringTitlePhrases: titlePhrases(titles),
    recurringFeatures: featureSignals(titles),
    platforms: { excel: titles.filter(title => /excel/i.test(title)).length, googleSheets: titles.filter(title => /google sheets/i.test(title)).length, dualPlatform: titles.filter(title => /excel/i.test(title) && /google sheets/i.test(title)).length },
    themes: { dark: titles.filter(title => /dark/i.test(title)).length, minimalist: titles.filter(title => /minimal/i.test(title)).length, adhdFriendly: titles.filter(title => /adhd/i.test(title)).length, beginnerFriendly: titles.filter(title => /beginner|easy/i.test(title)).length },
    screenshotEvidence,
    opportunities: marketGaps(clusterCounts, screenshotEvidence),
    warnings: [
      'ListingView metrics are market signals and estimates, not exact Etsy accounting.',
      ...(fileRegister.some(file => file.duplicateOf) ? ['Exact duplicate source files are retained in the source register and excluded from duplicate-sensitive conclusions.'] : []),
      ...(csvFiles.some(file => file.classification === 'irrelevant-general') ? ['Irrelevant or generally filtered exports are retained in the source register and excluded from niche conclusions.'] : []),
      ...(ambiguousCells.length ? ['Ambiguous locale numbers were fail-closed and excluded from aggregates.'] : []),
      'Wedding evidence is limited to shop-portfolio and screenshot signals; broad wedding-market claims remain MARKET_VALIDATION_REQUIRED.',
      'Google Sheets support cannot be claimed from competitor positioning; runtime import evidence is required per generated product.',
    ],
  };

  return { sourceRegister: { schemaVersion: '1.0.0', analyzedAt, sourceRoot: absoluteRoot, files: fileRegister }, normalizedRecords: { schemaVersion: '1.0.0', analyzedAt, records: normalizedRecords }, marketReport };
}

const formatBand = band => band.count ? `${band.minimum} / ${band.p25} / ${band.median} / ${band.p75} / ${band.maximum}` : 'no reliable values';

export function renderMarketReportMarkdown(report) {
  const fileRows = report.fileRegister.map(file => `| ${file.relativePath} | ${file.sourceType} | ${file.records ?? '-'} | ${file.classification} | ${file.confidence} | ${file.duplicateOf ?? '-'} |`).join('\n');
  const clusterRows = report.productClusters.map(item => `| ${item.value} | ${item.count} |`).join('\n');
  const opportunityRows = report.opportunities.map(item => `| ${item.product} | ${item.evidenceStatus} | ${item.differentiators.join('; ')} |`).join('\n');
  return `# ListingView market report — 20 July 2026

Generated: ${report.analyzedAt}

## Scope and data quality

- Files: ${report.sourceSummary.totalFiles} (${report.sourceSummary.csvFiles} CSV, ${report.sourceSummary.pngScreenshots} PNG)
- CSV records: ${report.sourceSummary.totalCsvRecords}
- Relevant / irrelevant records: ${report.sourceSummary.relevantCsvRecords} / ${report.sourceSummary.irrelevantCsvRecords}
- Unique relevant listings: ${report.sourceSummary.uniqueRelevantListings}
- Exact duplicate files: ${report.sourceSummary.duplicateFiles}
- Duplicate listing rows across exports: ${report.sourceSummary.duplicateListingRows}
- Ambiguous numeric cells: ${report.numericNormalization.ambiguousCellCount}

All raw values are preserved. Locale-ambiguous values are excluded fail-closed. ListingView metrics are treated as estimated market signals.

## Source register

| File | Type | Records | Content classification | Confidence | Duplicate of |
| --- | --- | ---: | --- | --- | --- |
${fileRows}

## Product clusters

| Cluster | Unique relevant listings |
| --- | ---: |
${clusterRows}

## Metric bands

The order is minimum / p25 / median / p75 / maximum.

- Price: ${formatBand(report.bands.price)}
- Sales: ${formatBand(report.bands.sales)}
- Revenue: ${formatBand(report.bands.revenue)}
- Conversion: ${formatBand(report.bands.conversion)}

## Market patterns

- Platforms: Excel ${report.platforms.excel}, Google Sheets ${report.platforms.googleSheets}, dual-positioned ${report.platforms.dualPlatform}
- Recurring features: ${report.recurringFeatures.slice(0, 12).map(item => `${item.feature} (${item.count})`).join(', ') || 'none'}
- Dominant shops: ${report.dominantShops.slice(0, 10).map(item => `${item.value} (${item.count})`).join(', ') || 'none'}
- Recurring title phrases: ${report.recurringTitlePhrases.slice(0, 12).map(item => `${item.value} (${item.count})`).join(', ') || 'none'}

## Flagship gap analysis

| Product | Evidence status | Planned differentiation |
| --- | --- | --- |
${opportunityRows}

## Warnings

${report.warnings.map(warning => `- ${warning}`).join('\n')}
`;
}
