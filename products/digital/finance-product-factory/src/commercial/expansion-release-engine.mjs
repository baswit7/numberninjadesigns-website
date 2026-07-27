const TAGS_BY_PRODUCT = Object.freeze({
  'monthly-budget-planner': ['budget spreadsheet', 'monthly budget', 'budget planner', 'finance tracker', 'expense tracker', 'income tracker', 'budget template', 'money planner', 'cash flow tracker', 'household budget', 'excel budget', 'digital budget', 'simple budget'],
  'annual-budget-spreadsheet': ['annual budget', 'yearly budget', 'budget spreadsheet', 'monthly budget', 'finance dashboard', 'cash flow planner', 'bill tracker', 'savings tracker', 'expense tracker', 'income tracker', 'budget template', 'excel spreadsheet', 'money management'],
  'budget-planner-ultimate': ['finance dashboard', 'budget dashboard', 'net worth tracker', 'debt payoff plan', 'savings planner', 'bill tracker', 'expense tracker', 'income tracker', 'annual budget', 'monthly budget', 'cash flow tracker', 'excel finance', 'finance spreadsheet'],
  'paycheck-budget-planner': ['paycheck budget', 'biweekly budget', 'pay period planner', 'bill tracker', 'cash flow planner', 'budget spreadsheet', 'expense tracker', 'savings tracker', 'money planner', 'income tracker', 'excel budget', 'budget template', 'payday planner'],
  'debt-savings-bundle': ['debt payoff tracker', 'debt snowball', 'savings tracker', 'savings goals', 'sinking funds', 'money planner', 'finance tracker', 'budget spreadsheet', 'debt spreadsheet', 'savings planner', 'payoff planner', 'excel finance', 'debt free planner'],
  'project-management-spreadsheet': ['project management', 'project planner', 'task tracker', 'gantt planner', 'kanban board', 'eisenhower matrix', 'project dashboard', 'risk register', 'timeline planner', 'team task tracker', 'status dashboard', 'excel project', 'project spreadsheet'],
  'small-business-bookkeeping': ['small business', 'bookkeeping sheet', 'income expense', 'profit loss', 'sales tracker', 'invoice tracker', 'payment tracker', 'cash flow tracker', 'business dashboard', 'expense tracker', 'excel bookkeeping', 'business planner', 'finance tracker'],
  'wedding-planner-release-candidate': ['wedding planner', 'wedding budget', 'guest list', 'rsvp tracker', 'vendor tracker', 'wedding timeline', 'wedding checklist', 'seating plan', 'payment schedule', 'event planner', 'wedding spreadsheet', 'bridal planner', 'wedding bundle'],
});

const PRODUCT_POSITIONING = Object.freeze({
  'monthly-budget-planner': ['Simple Monthly Budget', 'A focused monthly workflow for first-time and low-friction budgeting.'],
  'annual-budget-spreadsheet': ['Annual Budget Spreadsheet', 'A year-round budget system connecting monthly planning, bills, goals and cash flow.'],
  'budget-planner-ultimate': ['Ultimate Finance Dashboard', 'A complete personal-finance operating system with multi-dashboard analysis, debt, savings and net-worth workflows.'],
  'paycheck-budget-planner': ['Paycheck Budget Spreadsheet', 'A pay-period workflow for paycheck and biweekly planning with bill allocation.'],
  'debt-savings-bundle': ['Debt and Savings Bundle', 'A coordinated debt-payoff, savings-goal and sinking-fund system.'],
  'project-management-spreadsheet': ['Project Management Spreadsheet', 'A practical project command center covering tasks, timeline, risks, status and ownership.'],
  'small-business-bookkeeping': ['Small Business Bookkeeping Spreadsheet', 'A neutral record-keeping workflow for income, expenses, invoices, payments and profit visibility.'],
  'wedding-planner-release-candidate': ['Wedding Planning Spreadsheet', 'An elegant planning workspace for budget, guests, vendors, payments, timeline and seating data.'],
});

const FAMILY_BY_PRODUCT = Object.freeze({
  'monthly-budget-planner': 'personal-finance',
  'annual-budget-spreadsheet': 'personal-finance',
  'budget-planner-ultimate': 'personal-finance',
  'paycheck-budget-planner': 'personal-finance',
  'debt-savings-bundle': 'personal-finance',
  'project-management-spreadsheet': 'projects-productivity',
  'small-business-bookkeeping': 'small-business',
  'wedding-planner-release-candidate': 'wedding-event',
});

const INTENT_BY_FAMILY = Object.freeze({
  'personal-finance': ['budget spreadsheet', 'finance tracker', 'money planner'],
  'projects-productivity': ['project management spreadsheet', 'task and timeline tracker', 'project dashboard'],
  'small-business': ['small business bookkeeping spreadsheet', 'income and expense tracker', 'business finance dashboard'],
  'wedding-event': ['wedding planning spreadsheet', 'wedding budget and guest tracker', 'wedding vendor timeline'],
});

const IMAGE_PLAN = Object.freeze([
  ['01-hero', 'Primary thumbnail', 'Show the product name, one clear outcome and a real workbook dashboard crop.'],
  ['02-dashboard', 'Dashboard overview', 'Show KPI cards and charts from the generated workbook at readable scale.'],
  ['03-workflow', 'Core workflow', 'Show the main data-entry and analysis flow in three connected steps.'],
  ['04-features', 'Feature summary', 'Show only features present in the product definition.'],
  ['05-sheets', 'What is included', 'List the actual generated sheet names and workbook count.'],
  ['06-light-dark', 'Appearance options', 'Compare generated light and dark variants where both are supported.'],
  ['07-locales', 'Language and currency', 'Show supported product locales and currency formats without a Google Sheets claim.'],
  ['08-how-it-works', 'How it works', 'Explain download, open, customize and enter data in four concise steps.'],
  ['09-detail', 'Niche detail', 'Show the niche-specific tracker, timeline or planning module.'],
  ['10-digital', 'Digital download notice', 'State that this is an instant digital spreadsheet download and no physical item ships.'],
]);

const PLACEHOLDER_PATTERN = /\b(?:todo|tbd|lorem ipsum|placeholder)\b/iu;
const UNSUPPORTED_GOOGLE_CLAIM = /\b(?:fully compatible with google sheets|verified google sheets compatible|dual[- ]platform compatible)\b/iu;

function unique(values) {
  return [...new Set(values)];
}

function slug(value) {
  return String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
}

function titleCase(value) {
  return String(value).replace(/\b\w/gu, character => character.toUpperCase());
}

function familyFor(definition) {
  return FAMILY_BY_PRODUCT[definition.id] ?? definition.productFamily ?? 'personal-finance';
}

function tierFor(definition) {
  return String(definition.extensions?.tier ?? 'professional').toUpperCase();
}

function verifiedExcel(result) {
  return result.compatibilityReport?.targets?.some(target => target.target === 'excel-desktop' && target.status === 'PASS');
}

function safeMarketPhrases(report, tags) {
  const available = new Set(tags);
  return (report?.recurringTitlePhrases ?? [])
    .filter(item => available.has(String(item.value).toLowerCase()))
    .slice(0, 8)
    .map(item => ({ phrase: item.value, count: item.count }));
}

function pricing(report, tier) {
  const band = report?.bands?.price ?? {};
  const minimum = Number.isFinite(band.p25) ? band.p25 : 4;
  const median = Number.isFinite(band.median) ? band.median : 9;
  const maximum = Number.isFinite(band.p75) ? band.p75 : 17;
  const multiplier = tier === 'ULTIMATE' ? 1.35 : tier === 'BASIC' ? 0.8 : 1;
  const introductory = Number(Math.max(minimum, median * multiplier).toFixed(2));
  return {
    currency: 'USD',
    observedRelevantMarketBand: { minimum, median, maximum },
    recommendedBand: { minimum: Number(Math.max(minimum, introductory * 0.8).toFixed(2)), maximum: Number(Math.max(introductory, maximum * multiplier).toFixed(2)) },
    introductoryPrice: introductory,
    evidenceCaveat: 'ListingView observations are market signals, not exact Etsy accounting or a pricing guarantee.',
  };
}

function imagePlan(definition) {
  return IMAGE_PLAN.map(([id, purpose, requirement], index) => ({
    index: index + 1,
    id,
    purpose,
    filename: `${String(index + 1).padStart(2, '0')}-${slug(id)}.png`,
    dimensions: { width: 2400, height: 1600 },
    requirement,
    source: 'Generated workbook and product definition; competitor artwork is not copied.',
    productId: definition.id,
  }));
}

function listingPackage(definition, result, marketReport) {
  const [name, positioning] = PRODUCT_POSITIONING[definition.id] ?? [definition.id.replaceAll('-', ' '), definition.descriptionKey];
  const family = familyFor(definition);
  const tier = tierFor(definition);
  const tags = TAGS_BY_PRODUCT[definition.id];
  if (!tags) throw new Error(`No verified tag profile exists for ${definition.id}.`);
  const excelPass = verifiedExcel(result);
  const platform = excelPass ? 'Microsoft Excel 2019 or later' : 'XLSX spreadsheet; native Excel verification pending';
  const sheets = result.definition.sheets.map(sheet => sheet.id);
  const featureLabels = result.definition.features.map(feature => feature.replaceAll('-', ' '));
  const description = `${positioning} Use the guided instructions, sample data and controlled inputs to customize the ${name.toLowerCase()} for your own workflow. The download includes one ${platform} workbook plus documentation and validation evidence. This is an organizational tool; results depend on the data entered.`;
  return {
    schemaVersion: '1.0.0',
    productId: definition.id,
    productName: name,
    marketPositioning: positioning,
    primarySearchIntent: INTENT_BY_FAMILY[family][0],
    secondarySearchIntents: INTENT_BY_FAMILY[family].slice(1),
    title: `${name} | ${titleCase(tags[0])} | ${excelPass ? 'Excel Spreadsheet' : 'Digital Spreadsheet'}`.slice(0, 140),
    alternateTitle: `${titleCase(tags[1])} and ${titleCase(tags[2])} | ${name}`.slice(0, 140),
    tags,
    categoryAdvice: 'Digital products / templates / spreadsheets',
    attributeAdvice: { delivery: 'digital', madeToOrder: false, physicalItem: false, software: excelPass ? 'Microsoft Excel' : 'XLSX reader' },
    description,
    shortDescription: `${positioning} Includes a real XLSX workbook, instructions and release evidence.`,
    featureBullets: featureLabels.slice(0, 10),
    whatYouReceive: [`1 ${result.configuration.filename}`, 'README and quick-start guide', 'Customer instructions and FAQ', 'Compatibility and validation manifests', 'License, disclaimer and support notes'],
    compatibility: {
      excel: excelPass ? 'Verified with structural OOXML checks and a native Excel open/save smoke test.' : 'Structural XLSX checks passed; native Excel evidence is pending.',
      googleSheets: 'PROVISIONAL — import checklist supplied; do not advertise Google Sheets compatibility until the checklist is executed with retained evidence.',
      macros: 'No macros.',
      externalLinks: 'No external workbook links.',
    },
    idealFor: INTENT_BY_FAMILY[family],
    notFor: ['Users seeking bank synchronization or live external data feeds', 'Users seeking tax, legal, accounting, medical or investment advice', 'Users requiring proven Google Sheets behavior before manual import verification'],
    faq: [
      { question: 'Is this a physical product?', answer: 'No. This is a digital download; no physical item is shipped.' },
      { question: 'Can I edit the workbook?', answer: `Yes. The input cells and settings are designed for customization in ${platform}.` },
      { question: 'Does it work in Google Sheets?', answer: 'A provisional import checklist is included, but Google Sheets compatibility is not claimed until that checklist is completed with evidence.' },
      { question: 'Is professional advice included?', answer: 'No. The workbook is an organizational tool and does not provide financial, tax, legal, accounting, medical or investment advice.' },
    ],
    pricing: pricing(marketReport, tier),
    imagePlan: imagePlan(definition),
    thumbnailHeadline: name,
    badges: unique([tier, 'INSTANT DOWNLOAD', excelPass ? 'EXCEL VERIFIED' : 'XLSX', `${result.summary.sheets} SHEETS`]),
    mockupRequirements: ['Use screenshots from the generated workbook.', 'Keep worksheet text readable.', 'Do not reproduce competitor artwork, titles or listing layouts.', 'Show digital-download status clearly.'],
    videoStoryboard: ['Open on the hero/dashboard view.', 'Enter one safe example record.', 'Show an automatic formula or KPI update.', 'Navigate through the included sheets.', 'End on the digital-download and compatibility notice.'],
    pinterestText: `${name}: a structured digital spreadsheet for ${INTENT_BY_FAMILY[family][0]}.`,
    socialCaptions: [`Turn ${INTENT_BY_FAMILY[family][0]} into a clear, repeatable workflow with the ${name}.`, `${name}: real workbook, guided setup and evidence-based platform notes.`],
    marketEvidence: {
      source: 'ListingView source set 2026-07-20',
      matchedRecurringPhrases: safeMarketPhrases(marketReport, tags),
      limitations: 'Competitor wording and creative assets were not copied. Wedding evidence remains limited to shop/screenshot signals.',
    },
  };
}

function compatibilityManifest(definition, result) {
  const formulas = unique(definition.formulas.map(item => item.operation)).sort();
  return {
    schemaVersion: '1.0.0',
    productId: definition.id,
    workbookSha256: null,
    excel: {
      target: 'Microsoft Excel desktop 2019 or later',
      status: verifiedExcel(result) ? 'PASS' : 'PARTIAL',
      evidence: result.compatibilityReport.targets.find(target => target.target === 'excel-desktop') ?? null,
    },
    googleSheets: {
      status: 'PROVISIONAL',
      salesClaimAllowed: false,
      checkedFunctions: formulas,
      importInstructions: ['Upload the generated XLSX to a controlled Google Drive test location.', 'Open the XLSX with Google Sheets and save as a Google Sheets file.', 'Compare sheet count, visible formulas, dropdowns, dates, currency formats and charts with the manifest.', 'Enter one controlled record per input sheet and compare calculated outputs.', 'Record date, tester, observed differences and screenshots before changing sales metadata.'],
      warnings: ['Native Google Sheets runtime validation was not available locally.', 'Styling, charts, dropdowns and formula recalculation may change during import.', 'Do not use “Google Sheets compatible” in sales metadata until the checklist passes with retained evidence.'],
    },
  };
}

function gapAnalysis(definition, result, marketReport) {
  const tags = TAGS_BY_PRODUCT[definition.id];
  const marketPhrases = safeMarketPhrases(marketReport, tags);
  return {
    productId: definition.id,
    marketFunctionsCovered: marketPhrases.map(item => item.phrase),
    intentionallyExcluded: ['Live bank synchronization', 'Tax filing or accounting certification', 'Guaranteed outcomes', 'Unverified Google Sheets sales claim'],
    uniqueImprovements: ['Configuration-driven generation', 'Stable language-neutral identifiers', 'Guided onboarding and safe fictional sample data', 'Automated formula/reference validation', 'Native Excel open/save evidence when status is PASS', 'Complete release and Etsy metadata package'],
    provenClaims: [`${result.summary.sheets} generated sheets`, `${result.summary.formulas} generated formula cells`, `${result.summary.validations} data validations`, `Workbook inspection status ${result.validationReport.status}`, `Excel compatibility status ${result.compatibilityReport.status}`],
    limitations: familyFor(definition) === 'wedding-event'
      ? ['Broad wedding variant generation remains MARKET_VALIDATION_REQUIRED pending dedicated keyword exports.', 'Google Sheets remains provisional.']
      : ['Google Sheets remains provisional until an evidenced import checklist passes.'],
    tierRationale: `${tierFor(definition)} reflects the implemented workflow depth, sheet count, dashboard coverage and analysis modules; no necessary core feature is artificially disabled.`,
  };
}

function markdownDocument(title, paragraphs, sections = []) {
  return [`# ${title}`, '', ...paragraphs, ...sections.flatMap(section => ['', `## ${section.title}`, '', ...section.lines]), ''].join('\n');
}

function stringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function validateExpansionReleasePackage(files, listing) {
  const errors = [];
  if (listing.tags.length !== 13) errors.push({ code: 'ETSY_TAG_COUNT', actual: listing.tags.length });
  if (unique(listing.tags).length !== 13) errors.push({ code: 'ETSY_TAG_DUPLICATE' });
  for (const tag of listing.tags) {
    if (!tag || tag.length > 20) errors.push({ code: 'ETSY_TAG_LENGTH', tag });
  }
  if (listing.title.length > 140) errors.push({ code: 'ETSY_TITLE_LENGTH', actual: listing.title.length });
  if (listing.imagePlan.length !== 10 || listing.imagePlan.some(item => !item.filename || !item.requirement || !item.dimensions?.width || !item.dimensions?.height)) errors.push({ code: 'IMAGE_PLAN_INCOMPLETE' });
  for (const [path, content] of files) {
    if (!content || !String(content).trim()) errors.push({ code: 'EMPTY_RELEASE_FILE', path });
    if (PLACEHOLDER_PATTERN.test(String(content))) errors.push({ code: 'PLACEHOLDER_FOUND', path });
    if (UNSUPPORTED_GOOGLE_CLAIM.test(String(content))) errors.push({ code: 'UNSUPPORTED_GOOGLE_CLAIM', path });
  }
  const required = ['manifest/product-manifest.json', 'manifest/compatibility-manifest.json', 'manifest/validation-report.json', 'listing/etsy-listing.json', 'listing/image-plan.json', 'docs/README.md', 'docs/quick-start.md', 'docs/customer-instructions.md', 'docs/FAQ.md', 'docs/digital-download-notice.md', 'docs/LICENSE.md', 'docs/DISCLAIMER.md', 'docs/support-notes.md', 'docs/CHANGELOG.md', 'reports/gap-analysis.json'];
  for (const path of required) if (!files.has(path)) errors.push({ code: 'REQUIRED_RELEASE_FILE_MISSING', path });
  return { schemaVersion: '1.0.0', status: errors.length ? 'FAIL' : 'PASS', errorCount: errors.length, errors };
}

export function buildExpansionReleasePackage({ definition, result, marketReport, workbookSha256 }) {
  const listing = listingPackage(definition, result, marketReport);
  const compatibility = compatibilityManifest(definition, result);
  compatibility.workbookSha256 = workbookSha256;
  const family = familyFor(definition);
  const tier = tierFor(definition);
  const releaseStatus = result.validationReport.status === 'PASS' && verifiedExcel(result) ? 'READY_FOR_EXCEL_RELEASE' : 'VALIDATION_REQUIRED';
  const manifest = {
    schemaVersion: '1.0.0',
    productId: definition.id,
    version: definition.version,
    sku: `NND-${slug(definition.id).replaceAll('-', '').slice(0, 16).toUpperCase()}-${definition.version.replaceAll('.', '')}`,
    productFamily: family,
    tier,
    theme: result.configuration.themeId,
    appearance: result.configuration.extensions?.productAppearance ?? 'light',
    locale: result.configuration.locale,
    currency: result.configuration.currency,
    platform: 'excel',
    releaseStatus,
    workbook: { filename: result.configuration.filename, sha256: workbookSha256, bytes: result.workbook.bytes.byteLength },
    features: definition.features,
    sheets: definition.sheets.map(sheet => ({ id: sheet.id, type: sheet.type, order: sheet.order })),
    compatibility: { excel: compatibility.excel.status, googleSheets: compatibility.googleSheets.status },
    validation: { workbook: result.validationReport.status, quality: result.qualityReport.status, compatibility: result.compatibilityReport.status },
    evidenceStatus: definition.extensions?.evidenceStatus ?? 'LISTINGVIEW_SUPPORTED',
  };
  const gap = gapAnalysis(definition, result, marketReport);
  const files = new Map();
  files.set('manifest/product-manifest.json', stringify(manifest));
  files.set('manifest/compatibility-manifest.json', stringify(compatibility));
  files.set('manifest/validation-report.json', stringify(result.validationReport));
  files.set('manifest/quality-report.json', stringify(result.qualityReport));
  files.set('listing/etsy-listing.json', stringify(listing));
  files.set('listing/image-plan.json', stringify(listing.imagePlan));
  files.set('reports/gap-analysis.json', stringify(gap));
  files.set('docs/README.md', markdownDocument(listing.productName, [listing.shortDescription, `Release status: ${releaseStatus}.`, `Workbook: ${result.configuration.filename}.`], [
    { title: 'Included', lines: listing.whatYouReceive.map(item => `- ${item}`) },
    { title: 'Compatibility', lines: [`- Excel: ${listing.compatibility.excel}`, `- Google Sheets: ${listing.compatibility.googleSheets}`, `- ${listing.compatibility.macros}`, `- ${listing.compatibility.externalLinks}`] },
  ]));
  files.set('docs/quick-start.md', markdownDocument('Quick-start guide', ['1. Extract the downloaded ZIP.', `2. Open ${result.configuration.filename} in the supported Excel version.`, '3. Read the Instructions sheet before replacing the safe sample data.', '4. Update settings and controlled input cells only.', '5. Save a working copy before entering production data.']));
  files.set('docs/customer-instructions.md', markdownDocument('Customer instructions', ['Use the workbook locally and keep a backup copy. Input cells are visually distinguished from calculated cells. Do not paste over formula columns. Review validation messages before relying on summaries.', 'For Google Sheets evaluation, follow the compatibility manifest and retain evidence before treating the import as supported.']));
  files.set('docs/FAQ.md', markdownDocument('Frequently asked questions', [], listing.faq.map(item => ({ title: item.question, lines: [item.answer] }))));
  files.set('docs/digital-download-notice.md', markdownDocument('Digital-download notice', ['This purchase is a digital spreadsheet download. No physical item is shipped. Software is not included.']));
  files.set('docs/LICENSE.md', markdownDocument('Personal-use license', ['The purchaser may use and customize the supplied workbook for their own personal or internal business records. Redistribution, resale, sublicensing, template extraction and sharing of the source files are prohibited.']));
  files.set('docs/DISCLAIMER.md', markdownDocument('Disclaimer', ['This workbook is an organizational tool only. It does not provide financial, tax, legal, accounting, medical or investment advice. Verify important decisions and classifications with an appropriately qualified professional.']));
  files.set('docs/support-notes.md', markdownDocument('Support notes', ['When requesting support, provide the product ID, version, locale, Excel version, operating system and the exact validation message. Do not send credentials, bank data, personal identifiers or confidential records.']));
  files.set('docs/CHANGELOG.md', markdownDocument('Changelog', [`## ${definition.version} — 2026-07-20`, '', '- Added configuration-driven release candidate.', '- Added workbook validation and compatibility evidence.', '- Added evidence-based Etsy listing package and gap analysis.']));
  const validation = validateExpansionReleasePackage(files, listing);
  files.set('manifest/release-package-validation.json', stringify(validation));
  return { manifest, compatibility, listing, gap, files, validation };
}

export { TAGS_BY_PRODUCT };
