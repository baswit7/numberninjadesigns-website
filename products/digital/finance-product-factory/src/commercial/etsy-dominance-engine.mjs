const DOMINANCE_PRODUCT_ID = 'budget-planner-ultimate';

const DIGITAL_UPLOAD_POLICY = Object.freeze({
  maximumFiles: 5,
  maximumBytesPerFile: 20 * 1024 * 1024,
  filenameMaxCharacters: 70,
  allowedExtensions: Object.freeze(['.xlsx', '.zip']),
});

const IMAGE_FUNNEL = Object.freeze([
  ['hero', 'thumbnail', 'Outcome-first hero with the product, audience and dual-platform promise.'],
  ['dashboard-overview', 'feature', 'Executive dashboard proof using the real generated workbook.'],
  ['monthly-budget', 'detail', 'Monthly planning workflow and budget-versus-actual view.'],
  ['key-features', 'feature', 'Six high-value capabilities translated into shopper benefits.'],
  ['light-dark-comparison', 'comparison', 'Light and dark editions shown side by side.'],
  ['whats-included', 'contents', 'Exact files, guides and platform editions included.'],
  ['language-currency-options', 'compatibility', 'English-first localization and currency configuration.'],
  ['how-it-works', 'instructions', 'Three-step path from download to decision-ready dashboard.'],
  ['workbook-previews', 'bundle', 'Connected workbook system across planning, debt, goals and net worth.'],
  ['digital-download', 'trust', 'Instant digital delivery, local data and no subscription.'],
  ['excel-google-sheets', 'compatibility', 'Excel and Google Sheets workflow with honest verification labels.'],
  ['paycheck-planning', 'feature', 'Pay-period planning for variable and fixed income.'],
  ['debt-payoff', 'feature', 'Debt snowball and avalanche planning proof.'],
  ['savings-goals', 'feature', 'Savings goals, sinking funds and emergency-fund tracking.'],
  ['net-worth', 'feature', 'Assets, liabilities and net-worth trend visibility.'],
  ['bill-subscriptions', 'feature', 'Bills, recurring transactions and subscription control.'],
  ['privacy-no-account', 'trust', 'Local-first privacy with no account or recurring fee.'],
  ['support-promise', 'trust', 'One-business-day human-response promise and self-service route.'],
  ['buyer-fit', 'target-customer', 'Clear ideal-customer and not-for-you qualification.'],
  ['value-stack', 'call-to-action', 'Premium value stack and launch offer without fake urgency.'],
].map(([id, purpose, objective], index) => Object.freeze({ id, order: index + 1, purpose, objective })));

const VIDEO_SPECS = Object.freeze([
  Object.freeze({
    id: 'product-tour',
    filename: '01-product-tour.mp4',
    durationSeconds: 15,
    width: 1080,
    height: 1080,
    audio: false,
    storyboardImageIds: Object.freeze(['hero', 'dashboard-overview', 'debt-payoff', 'net-worth']),
    objective: 'Cursor-guided workbook tour from the all-in-one promise to dashboard, debt and net-worth proof.',
  }),
  Object.freeze({
    id: 'three-step-workflow',
    filename: '02-three-step-workflow.mp4',
    durationSeconds: 15,
    width: 1080,
    height: 1080,
    audio: false,
    storyboardImageIds: Object.freeze(['how-it-works', 'excel-google-sheets', 'support-promise', 'value-stack']),
    objective: 'Cursor-guided setup and trust tour covering workflow, compatibility, human support and delivered value.',
  }),
]);

const COPY = Object.freeze({
  en: Object.freeze({
    title: 'Ultimate Budget Spreadsheet for Excel & Google Sheets | Debt, Savings, Paycheck & Net Worth Tracker',
    alternativeTitle: 'Digital Budget Planner for Excel and Google Sheets | Monthly Money Dashboard & Expense Tracker',
    shortDescription: 'Run your complete personal-finance system in one premium workbook: budget, cashflow, bills, debt, savings and net worth—built for Excel and Google Sheets.',
    audience: Object.freeze(['Households ready to replace scattered trackers', 'Paycheck and variable-income budgeters', 'Goal-driven savers and debt payoff planners']),
    features: Object.freeze([
      '24 connected planning and analysis sheets',
      'Executive, monthly and cashflow dashboards',
      'Budget, paycheck and transaction planning',
      'Debt snowball and avalanche calculators',
      'Savings goals, sinking funds and emergency fund',
      'Bills, subscriptions and recurring transactions',
      'Assets, liabilities and net-worth tracking',
      'Excel edition plus Google Sheets import-ready edition',
      'English-first setup with localized currency formats',
      'Light and premium dark visual editions',
    ]),
    tags: Object.freeze(['budget spreadsheet', 'monthly budget', 'expense tracker', 'google sheets budget', 'excel budget', 'debt payoff tracker', 'savings tracker', 'net worth tracker', 'paycheck budget', 'budget dashboard', 'finance spreadsheet', 'digital budget', 'money planner']),
    opening: 'Stop managing money across disconnected tabs, notes and apps. This premium finance command center turns your budget, cashflow, bills, debt, goals and net worth into one clear operating system.',
    compatibility: 'COMPATIBILITY: includes the Excel XLSX build and a Google Sheets import-ready XLSX build. Core calculations use cross-platform formulas; the included compatibility report states exactly what was verified.',
    support: 'SUPPORT: personal reply within one business day, Monday–Friday (Central European Time). Instant setup and troubleshooting guides are included in your download.',
    notFor: 'NOT FOR: buyers seeking financial advice, bank syncing, a mobile app or multi-user cloud permissions. This is a private spreadsheet system you control.',
    supportHeadline: 'Personal reply within one business day',
    supportDetail: 'Monday–Friday, Central European Time. Messages received on weekends or public holidays are handled the next business day.',
    supportSteps: Object.freeze(['Use QUICK_START.html for setup.', 'Include your platform, version and screenshot in the message.', 'Compatibility defects are reproduced first; a corrected file or safe workaround follows after confirmation.']),
    legal: 'DIGITAL DOWNLOAD: no physical item is shipped. Financial information stays in files you control. This product is a planning tool, not financial advice.',
  }),
  nl: Object.freeze({
    title: 'Ultieme Budget Spreadsheet voor Excel & Google Sheets | Budget, Schulden, Sparen en Vermogen',
    alternativeTitle: 'Digitaal Huishoudboekje voor Excel en Google Sheets | Maandbudget en Uitgaven Tracker',
    shortDescription: 'Beheer je volledige financiële systeem in één premium werkmap: budget, cashflow, rekeningen, schulden, sparen en vermogen—voor Excel en Google Sheets.',
    audience: Object.freeze(['Huishoudens die losse trackers willen vervangen', 'Budgetteerders met salaris of wisselend inkomen', 'Spaarders en mensen die gericht schulden aflossen']),
    features: Object.freeze([
      '24 gekoppelde werkbladen voor planning en analyse',
      'Executive-, maand- en cashflowdashboards',
      'Budget-, salaris- en transactieplanning',
      'Schuldensneeuwbal en lawinemethode',
      'Spaardoelen, potjes en noodfonds',
      'Rekeningen, abonnementen en herhaaltransacties',
      'Bezittingen, schulden en nettovermogen',
      'Excel-editie plus Google Sheets importklare editie',
      'Nederlandse inrichting met lokale valutanotatie',
      'Lichte en premium donkere visuele editie',
    ]),
    tags: Object.freeze(['budget spreadsheet', 'huishoudboekje', 'maandbudget', 'uitgaven tracker', 'excel budget', 'google sheets budget', 'schulden aflossen', 'spaardoelen', 'vermogen tracker', 'salaris budget', 'budget dashboard', 'geld planner', 'financieel overzicht']),
    opening: 'Stop met geld beheren in losse tabbladen, notities en apps. Dit premium financiële commandocentrum maakt van budget, cashflow, rekeningen, schulden, doelen en vermogen één helder systeem.',
    compatibility: 'COMPATIBILITEIT: bevat de Excel XLSX-build en een Google Sheets importklare XLSX-build. De kernberekeningen gebruiken platformoverstijgende formules; het meegeleverde rapport vermeldt exact wat is gecontroleerd.',
    support: 'SUPPORT: persoonlijk antwoord binnen één werkdag, maandag–vrijdag (Midden-Europese tijd). Directe installatie- en probleemoplossingsgidsen zitten in de download.',
    notFor: 'NIET VOOR: kopers die financieel advies, bankkoppeling, een mobiele app of cloudrechten voor meerdere gebruikers zoeken. Dit is een privé-spreadsheetsysteem onder eigen beheer.',
    supportHeadline: 'Persoonlijk antwoord binnen één werkdag',
    supportDetail: 'Maandag–vrijdag, Midden-Europese tijd. Berichten in het weekend of op feestdagen worden de eerstvolgende werkdag behandeld.',
    supportSteps: Object.freeze(['Gebruik QUICK_START.html voor installatie.', 'Vermeld platform, versie en voeg een schermafbeelding toe.', 'Compatibiliteitsfouten worden eerst gereproduceerd; na bevestiging volgt een gecorrigeerd bestand of veilige oplossing.']),
    legal: 'DIGITALE DOWNLOAD: er wordt niets fysieks verzonden. Financiële informatie blijft in bestanden onder eigen beheer. Dit product is een planningstool en geen financieel advies.',
  }),
});

function languageFor(locale) {
  return String(locale).toLowerCase().startsWith('nl') ? 'nl' : 'en';
}

function money(currency, amount) {
  const symbols = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$' };
  return `${symbols[currency] ?? `${currency} `}${amount}`;
}

function assertEtsyCopy(copy) {
  if (copy.title.length > 140 || copy.alternativeTitle.length > 140) throw new Error('Etsy dominance title exceeds 140 characters.');
  if (copy.tags.length !== 13 || copy.tags.some(tag => tag.length > 20)) throw new Error('Etsy dominance tags must contain exactly 13 values of at most 20 characters.');
}

export function validateEtsyDigitalUploadPlan(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > DIGITAL_UPLOAD_POLICY.maximumFiles) {
    throw new Error(`Etsy digital upload plan must contain between 1 and ${DIGITAL_UPLOAD_POLICY.maximumFiles} files.`);
  }
  const filenames = new Set();
  for (const file of files) {
    const filename = String(file?.filename ?? '');
    const bytes = Number(file?.bytes);
    const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    if (!filename || filename.length > DIGITAL_UPLOAD_POLICY.filenameMaxCharacters || !/^[A-Za-z0-9._-]+$/.test(filename)) {
      throw new Error(`Etsy upload filename is invalid: ${filename || '(empty)'}.`);
    }
    if (filenames.has(filename.toLowerCase())) throw new Error(`Etsy upload filename is duplicated: ${filename}.`);
    if (!DIGITAL_UPLOAD_POLICY.allowedExtensions.includes(extension)) throw new Error(`Etsy upload extension is unsupported: ${extension || '(none)'}.`);
    if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > DIGITAL_UPLOAD_POLICY.maximumBytesPerFile) {
      throw new Error(`Etsy upload file exceeds the size policy: ${filename}.`);
    }
    filenames.add(filename.toLowerCase());
  }
  return Object.freeze({
    status: 'PASS',
    policy: DIGITAL_UPLOAD_POLICY,
    fileCount: files.length,
    files: Object.freeze(files.map(file => Object.freeze({ ...file }))),
  });
}

export function isDominanceProduct(definition) {
  return definition?.id === DOMINANCE_PRODUCT_ID;
}

export function buildEtsyDominanceProfile({ definition, configuration, generatedAt = null } = {}) {
  if (!isDominanceProduct(definition)) return null;
  const locale = configuration?.locale ?? 'en-US';
  if (!/^(?:en|nl)(?:-|$)/i.test(locale)) return null;
  const currency = configuration?.currency ?? (languageFor(locale) === 'nl' ? 'EUR' : 'USD');
  const copy = COPY[languageFor(locale)];
  assertEtsyCopy(copy);
  const excelFilename = String(configuration?.filename ?? 'ultimate-budget-planner.xlsx');
  const googleSheetsFilename = `${excelFilename.replace(/\.xlsx$/i, '')}-google-sheets-import.xlsx`;
  const priceExperiment = Object.freeze({
    id: 'price-only-001',
    hypothesis: `A ${money(currency, 29)} launch price will maximize revenue per qualified visit versus ${money(currency, 34)} without materially increasing support or refund pressure.`,
    control: Object.freeze({ price: 29, currency, bundle: 'core', label: 'A' }),
    challenger: Object.freeze({ price: 34, currency, bundle: 'core', label: 'B' }),
    constants: Object.freeze(['Same title, images, description, tags and included files', 'No artificial countdown or unsubstantiated reference price']),
    primaryMetric: 'revenue-per-qualified-visit',
    secondaryMetrics: Object.freeze(['conversion-rate', 'favorites-per-view', 'support-contacts-per-order', 'refund-or-resolution-rate']),
    minimumRun: Object.freeze({ qualifiedViewsPerVariant: 500, minimumDays: 14 }),
    decisionRule: 'Choose the higher revenue-per-qualified-visit only when support and resolution rates remain within 20% of the other variant.',
  });
  const bundleLadder = Object.freeze([
    Object.freeze({ id: 'core', status: 'AVAILABLE', name: 'Ultimate Budget OS', launchPrice: 29, currency, includes: Object.freeze(['Excel edition', 'Google Sheets import-ready edition', 'Light and dark editions', 'Quick start', 'One-business-day support']) }),
    Object.freeze({ id: 'power', status: 'ROADMAP_NOT_FOR_SALE', name: 'Ultimate Budget OS + Payoff & Goals Power Pack', launchPrice: 49, currency, includes: Object.freeze(['Everything in Core', 'Debt payoff action pack', 'Savings and sinking-fund action pack', 'Annual review worksheets']) }),
    Object.freeze({ id: 'vault', status: 'ROADMAP_NOT_FOR_SALE', name: 'Complete Personal Finance Vault', launchPrice: 79, currency, includes: Object.freeze(['Everything in Power', 'Standalone specialist trackers', 'Printable review pack', 'Lifetime file updates for this edition']) }),
  ]);
  const supportPromise = Object.freeze({
    publicPromise: copy.supportHeadline,
    schedule: copy.supportDetail,
    scope: Object.freeze(['Download access', 'Setup', 'Formula or file defect triage', 'Excel and Google Sheets import guidance']),
    exclusions: Object.freeze(['Personal financial advice', 'Custom bookkeeping', 'Bank integrations', 'Unsupported third-party modifications']),
    intakeChecklist: copy.supportSteps,
    severityTargets: Object.freeze({ blockedDownload: 'same business day when reported before 16:00 CET', compatibilityIssue: 'triage within one business day', usageQuestion: 'reply within one business day' }),
  });
  const fullDescription = [
    copy.opening,
    '',
    'WHAT YOU GET',
    ...copy.features.map(feature => `• ${feature}`),
    '',
    copy.compatibility,
    '',
    copy.support,
    '',
    copy.notFor,
    '',
    copy.legal,
  ].join('\n');
  return Object.freeze({
    schemaVersion: '1.0.0',
    strategyId: 'etsy-dominance-v2',
    productId: definition.id,
    locale,
    primaryLocale: 'en-US',
    secondaryLocale: 'nl-NL',
    generatedAt,
    title: copy.title,
    alternativeTitle: copy.alternativeTitle,
    shortDescription: copy.shortDescription,
    fullDescription,
    audience: copy.audience,
    features: copy.features,
    tags: copy.tags,
    priceExperiment,
    bundleLadder,
    supportPromise,
    delivery: Object.freeze({ excelFilename, googleSheetsFilename, guides: Object.freeze(['README.html', 'QUICK_START.html', 'SUPPORT.html', 'LICENSE.txt']) }),
    imageFunnel: IMAGE_FUNNEL,
    videos: VIDEO_SPECS,
    compliance: Object.freeze({ titleMaxCharacters: 140, tagCount: 13, tagMaxCharacters: 20, imageSlots: 20, videoSlots: 2, videoDurationSeconds: Object.freeze([3, 15]), noFakeDiscounts: true }),
  });
}

export function applyEtsyDominanceListing(baseListing, profile) {
  if (!profile) return baseListing;
  const dutch = languageFor(profile.locale) === 'nl';
  const faq = baseListing.faq.map(item => item.id === 'compatibility' ? {
    ...item,
    question: dutch ? 'Werkt dit in Excel én Google Sheets?' : 'Does this work in both Excel and Google Sheets?',
    answer: dutch ? 'Ja. Je ontvangt een Excel XLSX-bestand en een Google Sheets importklare XLSX-editie. Controleer het compatibiliteitsrapport voor de exacte vrijgavebewijzen.' : 'Yes. You receive an Excel XLSX file and a Google Sheets import-ready XLSX edition. See the compatibility report for the exact release evidence.',
  } : item);
  faq.push({ id: 'support', question: dutch ? 'Hoe snel krijg ik hulp?' : 'How quickly will I get help?', answer: profile.supportPromise.publicPromise + `. ${profile.supportPromise.schedule}` });
  return {
    ...baseListing,
    status: 'GENERATED_DRAFT',
    primaryTitle: profile.title,
    alternativeTitle: profile.alternativeTitle,
    shortDescription: profile.shortDescription,
    fullDescription: profile.fullDescription,
    first160Characters: profile.fullDescription.replace(/\s+/g, ' ').slice(0, 160),
    targetAudience: [...profile.audience],
    features: [...profile.features],
    keywords: [...profile.tags],
    tags: [...profile.tags],
    useCases: [...profile.audience],
    faq,
    pricePositioning: {
      status: 'TEST_PLAN_READY',
      currency: profile.priceExperiment.control.currency,
      tier: 'PREMIUM_VALUE',
      suggestedAmount: profile.priceExperiment.control.price,
      rationale: profile.priceExperiment.hypothesis,
    },
    bundleSuggestions: profile.bundleLadder.filter(bundle => bundle.status === 'AVAILABLE').map(bundle => `${bundle.name}: ${money(bundle.currency, bundle.launchPrice)}`),
    upsellSuggestions: profile.bundleLadder.filter(bundle => bundle.status === 'AVAILABLE' && bundle.id !== 'core').map(bundle => bundle.name),
    commercialStrategy: profile,
    includedFiles: [profile.delivery.excelFilename, profile.delivery.googleSheetsFilename, ...profile.delivery.guides],
    reviewRequired: true,
  };
}

export function renderSupportHtml(profile) {
  if (!profile) return null;
  const promise = profile.supportPromise;
  const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  return `<!doctype html><html lang="${languageFor(profile.locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(promise.publicPromise)}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:780px;margin:auto;padding:32px;background:#0b1020;color:#eef2ff}main{background:#151c2f;border:1px solid #55e6a5;border-radius:16px;padding:32px}h1{color:#55e6a5}li{margin:.6rem 0}.muted{color:#aab5ca}</style></head><body><main><h1>${escape(promise.publicPromise)}</h1><p>${escape(promise.schedule)}</p><h2>Fastest route to a solution</h2><ol>${promise.intakeChecklist.map(item => `<li>${escape(item)}</li>`).join('')}</ol><h2>Included support</h2><ul>${promise.scope.map(item => `<li>${escape(item)}</li>`).join('')}</ul><p class="muted">${escape(`Not included: ${promise.exclusions.join(', ')}.`)}</p></main></body></html>`;
}

export {
  DIGITAL_UPLOAD_POLICY as ETSY_DIGITAL_UPLOAD_POLICY,
  DOMINANCE_PRODUCT_ID,
  IMAGE_FUNNEL as ETSY_IMAGE_FUNNEL,
  VIDEO_SPECS as ETSY_VIDEO_SPECS,
};
