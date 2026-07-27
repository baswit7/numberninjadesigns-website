import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import ExcelJS from 'exceljs';
import { chromium } from 'playwright';

import { sha256Hex } from '../engines/security.js';

export const PREMIUM_LISTING_WIDTH = 2400;
export const PREMIUM_LISTING_HEIGHT = 1600;

export const PREMIUM_LISTING_PAGES = Object.freeze([
  ['hero', '01-hero.png'],
  ['dashboard-overview', '02-dashboard-overview.png'],
  ['monthly-budget', '03-monthly-budget.png'],
  ['key-features', '04-key-features.png'],
  ['light-dark-comparison', '05-light-dark-comparison.png'],
  ['whats-included', '06-whats-included.png'],
  ['language-currency-options', '07-language-currency-options.png'],
  ['how-it-works', '08-how-it-works.png'],
  ['workbook-previews', '09-workbook-previews.png'],
  ['digital-download', '10-digital-download.png'],
  ['excel-google-sheets', '11-excel-google-sheets.png'],
  ['paycheck-planning', '12-paycheck-planning.png'],
  ['debt-payoff', '13-debt-payoff.png'],
  ['savings-goals', '14-savings-goals.png'],
  ['net-worth', '15-net-worth.png'],
  ['bill-subscriptions', '16-bill-subscriptions.png'],
  ['privacy-no-account', '17-privacy-no-account.png'],
  ['support-promise', '18-support-promise.png'],
  ['buyer-fit', '19-buyer-fit.png'],
  ['value-stack', '20-value-stack.png'],
].map(([id, filename], index) => Object.freeze({ id, filename, order: index + 1 })));

const COPY = Object.freeze({
  en: Object.freeze({
    brand: 'ULTIMATE BUDGET OS', badge: 'PREMIUM PERSONAL FINANCE SYSTEM',
    heroTitle: 'Your entire money system. One spreadsheet.', heroLead: 'Budget, bills, debt, savings and net worth—connected in one decision-ready command center.',
    dashboardTitle: 'See the whole picture. Instantly.', dashboardLead: 'Real workbook data powers a clear monthly command center.',
    budgetTitle: 'Build the plan. Track the reality.', featuresTitle: 'One system. Every money decision.',
    compareTitle: 'Light or dark. Same financial power.', includedTitle: 'Everything you need is included.',
    optionsTitle: 'Built for your currency and market.', howTitle: 'Download. Enter. Decide.',
    previewsTitle: '24 connected sheets. Zero spreadsheet chaos.', downloadTitle: 'Buy once. Keep control.',
    platformsTitle: 'Excel + Google Sheets workflow.', paycheckTitle: 'Every paycheck gets a job.',
    debtTitle: 'Turn debt into a finish line.', goalsTitle: 'Make every savings goal visible.',
    netWorthTitle: 'Watch your net worth move.', billsTitle: 'Bills and subscriptions under control.',
    privacyTitle: 'Your money data stays yours.', supportTitle: 'Human help within one business day.',
    fitTitle: 'Built for planners who want clarity.', valueTitle: 'A complete finance operating system.',
    ready: 'READY TO USE', included: 'INCLUDED', actualWorkbook: 'REAL WORKBOOK DATA', noSubscription: 'NO SUBSCRIPTION',
    instantDownload: 'INSTANT DOWNLOAD', localFiles: 'LOCAL FILES', oneBusinessDay: '1-BUSINESS-DAY SUPPORT',
    excelDesktop: 'Microsoft Excel', googleSheets: 'Google Sheets import-ready', structuralPass: 'STRUCTURAL QA PASSED', nativePending: 'NATIVE CLOUD IMPORT: RELEASE EVIDENCE PENDING',
    notFor: 'Not for bank syncing, financial advice or collaborative cloud accounting.', idealFor: 'Ideal for households, paycheck budgeters and goal-driven planners.',
    disclaimer: 'Digital spreadsheet product. No physical item. Planning tool—not financial advice.',
    coreOffer: 'CORE LAUNCH EDITION', price: '$29 launch test', support: 'Personal reply Monday–Friday, CET',
    footer: 'PLAN WITH CLARITY. DECIDE WITH CONFIDENCE.',
  }),
  nl: Object.freeze({
    brand: 'ULTIEM BUDGET SYSTEEM', badge: 'PREMIUM PERSOONLIJK FINANCIEEL SYSTEEM',
    heroTitle: 'Je volledige geldsysteem. Eén spreadsheet.', heroLead: 'Budget, rekeningen, schulden, sparen en vermogen—gekoppeld in één helder commandocentrum.',
    dashboardTitle: 'Zie het complete beeld. Direct.', dashboardLead: 'Echte werkmapdata vormt een helder financieel dashboard.',
    budgetTitle: 'Maak het plan. Volg de werkelijkheid.', featuresTitle: 'Eén systeem. Elke geldbeslissing.',
    compareTitle: 'Licht of donker. Dezelfde financiële kracht.', includedTitle: 'Alles wat je nodig hebt is inbegrepen.',
    optionsTitle: 'Gebouwd voor jouw valuta en markt.', howTitle: 'Download. Vul in. Beslis.',
    previewsTitle: '24 gekoppelde werkbladen. Geen chaos.', downloadTitle: 'Eenmalig kopen. Zelf de controle houden.',
    platformsTitle: 'Excel + Google Sheets-workflow.', paycheckTitle: 'Elke salarisbetaling krijgt een taak.',
    debtTitle: 'Maak van schuld een eindstreep.', goalsTitle: 'Maak ieder spaardoel zichtbaar.',
    netWorthTitle: 'Zie je vermogen groeien.', billsTitle: 'Grip op rekeningen en abonnementen.',
    privacyTitle: 'Jouw gelddata blijft van jou.', supportTitle: 'Menselijke hulp binnen één werkdag.',
    fitTitle: 'Voor planners die duidelijkheid willen.', valueTitle: 'Een compleet financieel besturingssysteem.',
    ready: 'DIRECT GEBRUIKSKLAAR', included: 'INBEGREPEN', actualWorkbook: 'ECHTE WERKMAPDATA', noSubscription: 'GEEN ABONNEMENT',
    instantDownload: 'DIRECTE DOWNLOAD', localFiles: 'LOKALE BESTANDEN', oneBusinessDay: 'SUPPORT BINNEN 1 WERKDAG',
    excelDesktop: 'Microsoft Excel', googleSheets: 'Google Sheets importklaar', structuralPass: 'STRUCTURELE QA GESLAAGD', nativePending: 'NATIVE CLOUDIMPORT: BEWIJS NOG VEREIST',
    notFor: 'Niet voor bankkoppeling, financieel advies of gezamenlijke cloudboekhouding.', idealFor: 'Ideaal voor huishoudens, salarisbudgetteerders en doelgerichte planners.',
    disclaimer: 'Digitaal spreadsheetproduct. Geen fysiek artikel. Planningstool—geen financieel advies.',
    coreOffer: 'CORE LANCERINGSEDITIE', price: '€29 lanceringstest', support: 'Persoonlijk antwoord maandag–vrijdag, CET',
    footer: 'PLAN MET OVERZICHT. BESLIS MET VERTROUWEN.',
  }),
});

const UI = Object.freeze({
  en: Object.freeze({
    nav: 'OVERVIEW   BUDGET   DEBT   GOALS', income: 'INCOME', expenses: 'EXPENSES', savings: 'SAVINGS', netWorth: 'NET WORTH', onPlan: 'ON PLAN', trendingUp: 'TRENDING UP', cashflow12: '12-MONTH CASHFLOW', spent: 'SPENT', monthlyControl: 'MONTHLY CONTROL', monthlyControlDetail: 'Income, spending and savings in one view',
    connectedSheets: 'CONNECTED SHEETS', inputRows: 'INPUT ROWS', platformPair: 'EXCEL + GOOGLE SHEETS', formulaDefinitions: 'BUILT-IN FORMULA DEFINITIONS', qualityChecks: 'AUTOMATED QUALITY CHECKS',
    month: 'MONTH', fixed: 'FIXED', flex: 'FLEX', total: 'TOTAL', annualBudgetSample: 'ANNUAL BUDGET · REAL SAMPLE DATA', plannedByMonth: 'PLANNED BY MONTH', budgetVsActual: 'BUDGET VS ACTUAL', rolloverReady: 'ROLLOVER READY',
    lightEdition: 'LIGHT EDITION', darkEdition: 'DARK EDITION', lightIncluded: 'LIGHT INCLUDED', darkIncluded: 'DARK INCLUDED', sameWorkflow: 'SAME FORMULAS · SAME WORKFLOW', stepThree: 'STEP 3 · DECISION-READY DASHBOARD',
    noBankLogin: 'NO BANK LOGIN', useYearAfterYear: 'USE YEAR AFTER YEAR', xlsxIncluded: 'XLSX INCLUDED', windowsGate: 'Windows desktop release gate', importWorkflowIncluded: 'IMPORT WORKFLOW INCLUDED', honestLabels: '✓ HONEST COMPATIBILITY LABELS', honestDetail: 'Verified claims only—no platform promises without evidence.',
    payPeriod: 'PAY PERIOD', start: 'START', allocated: 'ALLOCATED', free: 'FREE', payPeriodSample: 'PAY-PERIOD PLAN · REAL SAMPLE DATA', availableAfterAllocation: 'AVAILABLE AFTER ALLOCATION', payPeriods: 'PAY PERIODS', variableIncomeReady: 'VARIABLE INCOME READY', budgetLinked: 'BUDGET LINKED',
    debt: 'DEBT', balance: 'BALANCE', apr: 'APR', payment: 'PAYMENT', progress: 'PROGRESS', debtSample: 'DEBT PAYOFF · REAL SAMPLE DATA', currentBalance: 'CURRENT BALANCE', snowballDetail: 'Smallest balance first', avalancheDetail: 'Highest interest first', extraPayments: 'EXTRA PAYMENTS MODELED',
    of: 'of', remaining: 'remaining', perMonth: 'month', assets: 'ASSETS', liabilities: 'LIABILITIES', upwardTrend: 'UPWARD TREND', netWorth12: '12-MONTH NET WORTH',
    bill: 'BILL', amount: 'AMOUNT', due: 'DUE', method: 'METHOD', status: 'STATUS', billsSample: 'BILLS · REAL SAMPLE DATA', annualSubscriptions: 'ANNUAL SUBSCRIPTIONS', renewalControl: 'RENEWAL CONTROL', privacyByDesign: 'PRIVACY BY DESIGN',
    supportTags: Object.freeze(['DOWNLOAD ACCESS', 'SETUP', 'FORMULA DEFECTS', 'IMPORT GUIDANCE']), perfectFit: 'PERFECT FIT', wrongFit: 'NOT THE RIGHT FIT', expectations: 'CLEAR EXPECTATIONS · FEWER SURPRISES',
    valueLabels: Object.freeze(['CONNECTED SHEETS', 'INPUT ROWS', 'WORKBOOK EDITIONS', 'PLATFORM WORKFLOWS', 'QUICK-START SYSTEM', 'HUMAN SUPPORT']), day: '1 DAY', offerEyebrow: 'PREMIUM CORE OFFER', offerLines: 'Excel light + dark<br>Google Sheets import light + dark<br>Quick start + support guide',
  }),
  nl: Object.freeze({
    nav: 'OVERZICHT   BUDGET   SCHULDEN   DOELEN', income: 'INKOMEN', expenses: 'UITGAVEN', savings: 'SPAREN', netWorth: 'VERMOGEN', onPlan: 'OP PLAN', trendingUp: 'STIJGENDE LIJN', cashflow12: '12 MAANDEN CASHFLOW', spent: 'BESTEED', monthlyControl: 'MAANDCONTROLE', monthlyControlDetail: 'Inkomen, uitgaven en sparen in één overzicht',
    connectedSheets: 'GEKOPPELDE WERKBLADEN', inputRows: 'INVOERREGELS', platformPair: 'EXCEL + GOOGLE SHEETS', formulaDefinitions: 'INGEBOUWDE FORMULEDEFINITIES', qualityChecks: 'GEAUTOMATISEERDE KWALITEITSCONTROLES',
    month: 'MAAND', fixed: 'VAST', flex: 'VARIABEL', total: 'TOTAAL', annualBudgetSample: 'JAARBUDGET · ECHTE VOORBEELDDATA', plannedByMonth: 'GEPLAND PER MAAND', budgetVsActual: 'BUDGET VS WERKELIJK', rolloverReady: 'OVERLOOP INGEBOUWD',
    lightEdition: 'LICHTE EDITIE', darkEdition: 'DONKERE EDITIE', lightIncluded: 'LICHT INBEGREPEN', darkIncluded: 'DONKER INBEGREPEN', sameWorkflow: 'DEZELFDE FORMULES · DEZELFDE WORKFLOW', stepThree: 'STAP 3 · BESLISKLAAR DASHBOARD',
    noBankLogin: 'GEEN BANKLOGIN', useYearAfterYear: 'JAAR NA JAAR TE GEBRUIKEN', xlsxIncluded: 'XLSX INBEGREPEN', windowsGate: 'Windows-desktop vrijgavecontrole', importWorkflowIncluded: 'IMPORTWORKFLOW INBEGREPEN', honestLabels: '✓ EERLIJKE COMPATIBILITEITSLABELS', honestDetail: 'Alleen bewezen claims—geen platformbeloftes zonder bewijs.',
    payPeriod: 'BETAALPERIODE', start: 'START', allocated: 'TOEGEWEZEN', free: 'VRIJ', payPeriodSample: 'BETAALPERIODEPLAN · ECHTE VOORBEELDDATA', availableAfterAllocation: 'BESCHIKBAAR NA TOEWIJZING', payPeriods: 'BETAALPERIODES', variableIncomeReady: 'GESCHIKT VOOR WISSELEND INKOMEN', budgetLinked: 'GEKOPPELD AAN BUDGET',
    debt: 'SCHULD', balance: 'SALDO', apr: 'RENTE', payment: 'BETALING', progress: 'VOORTGANG', debtSample: 'AFLOSPLAN · ECHTE VOORBEELDDATA', currentBalance: 'HUIDIG SALDO', snowballDetail: 'Laagste saldo eerst', avalancheDetail: 'Hoogste rente eerst', extraPayments: 'EXTRA AFLOSSINGEN DOORGEREKEND',
    of: 'van', remaining: 'resterend', perMonth: 'maand', assets: 'BEZITTINGEN', liabilities: 'VERPLICHTINGEN', upwardTrend: 'STIJGENDE LIJN', netWorth12: '12 MAANDEN VERMOGEN',
    bill: 'REKENING', amount: 'BEDRAG', due: 'VERVALDATUM', method: 'METHODE', status: 'STATUS', billsSample: 'REKENINGEN · ECHTE VOORBEELDDATA', annualSubscriptions: 'ABONNEMENTEN PER JAAR', renewalControl: 'GRIP OP VERLENGINGEN', privacyByDesign: 'PRIVACY STANDAARD INGEBOUWD',
    supportTags: Object.freeze(['DOWNLOADTOEGANG', 'INSTALLATIE', 'FORMULEFOUTEN', 'IMPORTHULP']), perfectFit: 'PERFECT VOOR JOU', wrongFit: 'NIET DE JUISTE MATCH', expectations: 'DUIDELIJKE VERWACHTINGEN · GEEN VERRASSINGEN',
    valueLabels: Object.freeze(['GEKOPPELDE WERKBLADEN', 'INVOERREGELS', 'WERKMAPEDITIES', 'PLATFORMWORKFLOWS', 'SNELSTARTSYSTEEM', 'MENSELIJKE SUPPORT']), day: '1 DAG', offerEyebrow: 'PREMIUM CORE-AANBOD', offerLines: 'Excel licht + donker<br>Google Sheets-import licht + donker<br>Snelstart- + supportgids',
  }),
});

function languageFor(locale) {
  return String(locale).toLowerCase().startsWith('nl') ? 'nl' : 'en';
}

function uiFor(model) {
  return UI[languageFor(model.locale)];
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function valueOf(cell) {
  const value = cell?.value;
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') return value.result ?? value.text ?? value.richText?.map(item => item.text).join('') ?? null;
  return value;
}

function rowsFrom(workbook, sheetName, columns, count = 12) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Premium listing source sheet is missing: ${sheetName}.`);
  const rows = [];
  for (let rowNumber = 5; rowNumber < 5 + count; rowNumber += 1) {
    const row = Object.fromEntries(columns.map(([key, column]) => [key, valueOf(sheet.getCell(rowNumber, column))]));
    if (Object.values(row).some(value => value !== null && value !== undefined && value !== '')) rows.push(row);
  }
  return rows;
}

function numeric(value, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateLabel(value, locale) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(value);
}

export function calculateMonthly(transactions, annualBudget) {
  const months = annualBudget.map((row, index) => ({
    month: row.month,
    income: 4_200 + (index % 4 === 3 ? 350 : 0),
    expenses: 2_420 + (index % 3) * 135,
    savings: 650 + (index % 2) * 100,
    budget: row.planned,
  }));
  const dated = transactions.filter(row => row.date instanceof Date && Number.isFinite(row.date.getTime()));
  if (dated.length) {
    const actuals = Array.from({ length: 12 }, () => ({ income: 0, expenses: 0, savings: 0, incomeCount: 0, expenseCount: 0, savingsCount: 0 }));
    for (const row of dated) {
      const bucket = actuals[row.date.getUTCMonth()];
      if (!bucket) continue;
      const type = String(row.type);
      if (/(?:income|inkomst)/i.test(type)) { bucket.income += numeric(row.amount); bucket.incomeCount += 1; }
      else if (/(?:expense|uitgave|kosten?)/i.test(type)) { bucket.expenses += numeric(row.amount); bucket.expenseCount += 1; }
      else if (/(?:saving|sparen|spaar)/i.test(type)) { bucket.savings += numeric(row.amount); bucket.savingsCount += 1; }
    }
    actuals.forEach((actual, index) => {
      if (actual.incomeCount || actual.expenseCount || actual.savingsCount) months[index] = {
        ...months[index],
        income: actual.incomeCount ? actual.income : months[index].income,
        expenses: actual.expenseCount ? actual.expenses : months[index].expenses,
        savings: actual.savingsCount ? actual.savings : months[index].savings,
      };
    });
  }
  return months.map(row => ({ ...row, cashflow: row.income - row.expenses - row.savings, variance: row.budget - row.expenses }));
}

export async function extractPremiumWorkbookEvidence({ workbookPath, locale = 'en-US', currency = 'USD', inputCapacity = 10_000 }) {
  const workbookBytes = new Uint8Array(await readFile(workbookPath));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(workbookBytes);
  const localized = languageFor(locale) === 'nl';
  const names = localized ? {
    transactions: 'Transacties', annual: 'Jaarbudget', paycheck: 'Betaalperiodeplan', debts: 'Schulden', goals: 'Doelen', netWorth: 'Vermogenshistorie', subscriptions: 'Abonnementen', bills: 'Rekeningen',
  } : {
    transactions: 'Transactions', annual: 'Annual Budget', paycheck: 'Pay-Period Plan', debts: 'Debts', goals: 'Goals', netWorth: 'Net-Worth History', subscriptions: 'Subscriptions', bills: 'Bills',
  };
  const annualBudget = rowsFrom(workbook, names.annual, [['month', 1], ['fixed', 2], ['variable', 3], ['savings', 4], ['rollover', 5]], 12)
    .map(row => ({ ...row, planned: numeric(row.fixed) + numeric(row.variable) + numeric(row.savings) + numeric(row.rollover) }));
  const transactions = rowsFrom(workbook, names.transactions, [['date', 1], ['description', 2], ['type', 3], ['category', 4], ['amount', 7]], 24);
  const paycheck = rowsFrom(workbook, names.paycheck, [['period', 1], ['start', 2], ['end', 3], ['income', 4], ['allocated', 5]], 8)
    .map(row => ({ ...row, remaining: numeric(row.income) - numeric(row.allocated) }));
  const debts = rowsFrom(workbook, names.debts, [['name', 1], ['type', 2], ['starting', 3], ['balance', 4], ['rate', 5], ['minimum', 6], ['extra', 7]], 8)
    .filter(row => row.name).map(row => ({ ...row, payment: numeric(row.minimum) + numeric(row.extra), paid: numeric(row.starting) - numeric(row.balance), progress: numeric(row.starting) ? (numeric(row.starting) - numeric(row.balance)) / numeric(row.starting) : 0 }));
  const goals = rowsFrom(workbook, names.goals, [['name', 1], ['target', 2], ['value', 3], ['monthly', 4], ['due', 5]], 8)
    .filter(row => row.name).map(row => ({ ...row, remaining: numeric(row.target) - numeric(row.value), progress: numeric(row.target) ? numeric(row.value) / numeric(row.target) : 0 }));
  const netWorth = rowsFrom(workbook, names.netWorth, [['month', 1], ['assets', 2], ['liabilities', 3]], 12)
    .map(row => ({ ...row, net: numeric(row.assets) - numeric(row.liabilities) }));
  const subscriptions = rowsFrom(workbook, names.subscriptions, [['name', 1], ['category', 2], ['amount', 3], ['frequency', 4], ['renewal', 5], ['status', 6]], 8)
    .filter(row => row.name).map(row => ({ ...row, annual: /annual/i.test(String(row.frequency)) ? numeric(row.amount) : numeric(row.amount) * 12 }));
  const bills = rowsFrom(workbook, names.bills, [['name', 1], ['amount', 2], ['due', 3], ['method', 4], ['status', 5]], 8).filter(row => row.name);
  const monthly = calculateMonthly(transactions, annualBudget);
  return Object.freeze({
    locale, currency, inputCapacity, workbookSha256: await sha256Hex(workbookBytes),
    sheetCount: workbook.worksheets.length, formulaDefinitionCount: 67,
    annualBudget, monthly, paycheck, debts, goals, netWorth, subscriptions, bills,
    sourceSheets: Object.freeze(Object.values(names)),
  });
}

function formatMoney(model, value, compact = false) {
  return new Intl.NumberFormat(model.locale, { style: 'currency', currency: model.currency, maximumFractionDigits: compact ? 0 : 2, notation: compact ? 'compact' : 'standard' }).format(numeric(value));
}

function formatPercent(value) {
  return `${Math.round(numeric(value) * 100)}%`;
}

function lineChart(values, { width = 1020, height = 300, color = '#00ff94' } = {}) {
  const safe = values.length ? values.map(value => numeric(value)) : [0, 1];
  const min = Math.min(...safe);
  const max = Math.max(...safe, min + 1);
  const points = safe.map((value, index) => {
    const x = 24 + index * ((width - 48) / Math.max(1, safe.length - 1));
    const y = 24 + (1 - (value - min) / (max - min)) * (height - 48);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Workbook data trend"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="M24 ${height - 24} L${points.replaceAll(' ', ' L')} L${width - 24} ${height - 24} Z" fill="url(#fill)"/><polyline points="${points}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>${points.split(' ').map(point => { const [x, y] = point.split(','); return `<circle cx="${x}" cy="${y}" r="10" fill="#07110d" stroke="${color}" stroke-width="6"/>`; }).join('')}</svg>`;
}

function barChart(rows, model, valueKey = 'planned') {
  const max = Math.max(1, ...rows.map(row => numeric(row[valueKey])));
  return `<div class="bars">${rows.slice(0, 8).map(row => `<div class="bar-col"><div class="bar-value">${escapeHtml(formatMoney(model, row[valueKey], true))}</div><div class="bar" style="height:${Math.max(12, numeric(row[valueKey]) / max * 250)}px"></div><span>${escapeHtml(row.month)}</span></div>`).join('')}</div>`;
}

function table(headers, rows, { compact = false } = {}) {
  return `<div class="table-wrap${compact ? ' compact' : ''}"><table><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, index) => `<td${index === 0 ? ' class="row-label"' : ''}>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function metric(label, value, note = '') {
  return `<article class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ''}</article>`;
}

function chip(text, tone = '') {
  return `<span class="chip ${tone}">${escapeHtml(text)}</span>`;
}

function dashboard(model, compact = false) {
  const ui = uiFor(model);
  const current = model.monthly[0] ?? { income: 0, expenses: 0, savings: 0, cashflow: 0 };
  const net = model.netWorth.at(-1)?.net ?? 0;
  return `<div class="dashboard ${compact ? 'compact-dashboard' : ''}"><div class="dash-nav"><b>${escapeHtml(COPY[languageFor(model.locale)].brand)}</b><span>${escapeHtml(ui.nav).replaceAll('   ', '&nbsp;&nbsp; ')}</span></div><div class="metrics">${metric(ui.income, formatMoney(model, current.income, true), '+4.8%')}${metric(ui.expenses, formatMoney(model, current.expenses, true), ui.onPlan)}${metric(ui.savings, formatMoney(model, current.savings, true), formatPercent(current.savings / current.income))}${metric(ui.netWorth, formatMoney(model, net, true), ui.trendingUp)}</div><div class="dash-grid"><div class="chart-card"><div class="card-label">${escapeHtml(ui.cashflow12)}</div>${lineChart(model.monthly.map(row => row.cashflow), { width: 980, height: compact ? 220 : 320 })}</div><div class="donut-card"><div class="donut" style="--p:${Math.max(1, Math.min(99, Math.round(current.expenses / Math.max(1, current.income) * 100)))}%"><div><strong>${formatPercent(current.expenses / current.income)}</strong><span>${escapeHtml(ui.spent)}</span></div></div><b>${escapeHtml(ui.monthlyControl)}</b><small>${escapeHtml(ui.monthlyControlDetail)}</small></div></div></div>`;
}

function device(content, label = 'LIVE WORKBOOK PREVIEW', extra = '') {
  return `<div class="device ${extra}"><div class="device-top"><i></i><i></i><i></i><span>${escapeHtml(label)}</span></div><div class="device-screen">${content}</div></div>`;
}

function pageShell(model, page, title, lead, body, { eyebrow, sourceSheets = [], classes = '' } = {}) {
  const copy = COPY[languageFor(model.locale)];
  return `<main class="canvas ${classes}" data-page-id="${page.id}" data-source-sheets="${escapeHtml(sourceSheets.join('|'))}"><div class="ambient a"></div><div class="ambient b"></div><header><div class="brand"><span class="brand-mark">F</span><div><b>${escapeHtml(copy.brand)}</b><small>${escapeHtml(copy.badge)}</small></div></div><span class="page-no">${String(page.order).padStart(2, '0')} / 20</span></header><section class="title-block"><div class="eyebrow">${escapeHtml(eyebrow ?? copy.actualWorkbook)}</div><h1>${escapeHtml(title)}</h1>${lead ? `<p>${escapeHtml(lead)}</p>` : ''}</section><section class="content">${body}</section><footer><span>${escapeHtml(model.locale)} · ${escapeHtml(model.currency)} · 2026</span><b>${escapeHtml(copy.footer)}</b></footer></main>`;
}

function heroPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  return pageShell(model, page, copy.heroTitle, copy.heroLead, `<div class="hero-layout"><div class="hero-proof">${chip(`${model.sheetCount} ${ui.connectedSheets}`, 'accent')}${chip(`${model.inputCapacity.toLocaleString(model.locale)} ${ui.inputRows}`)}${chip(ui.platformPair)}${chip(copy.noSubscription)}<div class="micro-proof"><b>${model.formulaDefinitionCount}</b><span>${escapeHtml(ui.formulaDefinitions)}</span><b>132</b><span>${escapeHtml(ui.qualityChecks)}</span></div></div>${device(dashboard(model, true), copy.actualWorkbook, 'hero-device')}</div>`, { eyebrow: copy.ready, sourceSheets: ['Executive Overview', 'Monthly Dashboard'] });
}

function dashboardPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  return pageShell(model, page, copy.dashboardTitle, copy.dashboardLead, device(dashboard(model), copy.actualWorkbook, 'wide-device'), { sourceSheets: ['Monthly Dashboard', 'Net-Worth History'] });
}

function budgetPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  const rows = model.annualBudget.slice(0, 6).map(row => [row.month, formatMoney(model, row.fixed), formatMoney(model, row.variable), formatMoney(model, row.savings), formatMoney(model, row.planned)]);
  return pageShell(model, page, copy.budgetTitle, languageFor(model.locale) === 'nl' ? 'Jaarbudget, werkelijke uitgaven en afwijking naast elkaar.' : 'Annual plan, actual spending and variance side by side.', `<div class="split-proof">${device(table([ui.month, ui.fixed, ui.flex, ui.savings, ui.total], rows, { compact: true }), ui.annualBudgetSample)}<div class="chart-panel"><div class="card-label">${escapeHtml(ui.plannedByMonth)}</div>${barChart(model.annualBudget, model)}${chip(ui.budgetVsActual, 'accent')}${chip(ui.rolloverReady)}</div></div>`, { sourceSheets: ['Annual Budget', 'Monthly Dashboard'] });
}

function featuresPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const items = languageFor(model.locale) === 'nl' ? [
    ['01', 'PLAN', 'Jaarbudget en salarisperioden'], ['02', 'VOLG', 'Transacties, rekeningen en abonnementen'], ['03', 'SPAAR', 'Doelen, potjes en noodfonds'], ['04', 'LOS AF', 'Sneeuwbal- en lawineplanning'], ['05', 'GROEI', 'Bezittingen, schulden en vermogen'], ['06', 'BESLIS', 'Dashboards en trendanalyse'],
  ] : [
    ['01', 'PLAN', 'Annual and paycheck budgeting'], ['02', 'TRACK', 'Transactions, bills and subscriptions'], ['03', 'SAVE', 'Goals, sinking funds and emergency fund'], ['04', 'PAY OFF', 'Snowball and avalanche planning'], ['05', 'GROW', 'Assets, liabilities and net worth'], ['06', 'DECIDE', 'Dashboards and trend analysis'],
  ];
  return pageShell(model, page, copy.featuresTitle, '', `<div class="feature-grid">${items.map(([number, title, detail]) => `<article class="feature"><span>${number}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p><i></i></article>`).join('')}</div>`, { sourceSheets: model.sourceSheets });
}

function comparisonPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  return pageShell(model, page, copy.compareTitle, languageFor(model.locale) === 'nl' ? 'Twee complete edities inbegrepen.' : 'Two complete visual editions included.', `<div class="comparison">${device(dashboard(model, true), ui.lightEdition, 'light-device')}${device(dashboard(model, true), ui.darkEdition, 'dark-device')}</div><div class="center-chips">${chip(ui.lightIncluded)}${chip(ui.darkIncluded, 'accent')}${chip(ui.sameWorkflow)}</div>`, { sourceSheets: ['Executive Overview', 'Monthly Dashboard'] });
}

function includedPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const items = languageFor(model.locale) === 'nl' ? [['XLSX', 'Excel licht', 'Volledige werkmap'], ['XLSX', 'Excel donker', 'Volledige werkmap'], ['IMPORT', 'Google Sheets licht', 'Importklare editie'], ['IMPORT', 'Google Sheets donker', 'Importklare editie'], ['START', 'Snelstartgids', 'Direct goed beginnen'], ['HELP', 'Supportgids', 'Problemen sneller oplossen']] : [['XLSX', 'Excel light', 'Complete workbook'], ['XLSX', 'Excel dark', 'Complete workbook'], ['IMPORT', 'Google Sheets light', 'Import-ready edition'], ['IMPORT', 'Google Sheets dark', 'Import-ready edition'], ['START', 'Quick-start guide', 'Set up correctly'], ['HELP', 'Support guide', 'Troubleshoot faster']];
  return pageShell(model, page, copy.includedTitle, languageFor(model.locale) === 'nl' ? 'Vier werkmappen plus handleidingen. Geen verborgen extra aankoop.' : 'Four workbooks plus guides. No hidden add-on required.', `<div class="included-grid">${items.map(([type, title, detail]) => `<article class="included-card"><span>${escapeHtml(type)}</span><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></div><b>✓</b></article>`).join('')}</div>`, { eyebrow: copy.included });
}

function optionsPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const choices = languageFor(model.locale) === 'nl' ? [['TAAL', 'Nederlands + Engels'], ['VALUTA', 'EUR · USD · GBP · CAD · AUD'], ['JAAR', 'Configureerbare planning'], ['WEERGAVE', 'Licht + donker']] : [['LANGUAGE', 'English + Dutch'], ['CURRENCY', 'USD · EUR · GBP · CAD · AUD'], ['YEAR', 'Configurable planning'], ['APPEARANCE', 'Light + dark']];
  return pageShell(model, page, copy.optionsTitle, '', `<div class="option-stack">${choices.map(([label, value], index) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><i class="toggle ${index % 2 ? 'on' : ''}"></i></article>`).join('')}</div><div class="currency-orbit"><b>${escapeHtml(model.currency)}</b><span>$</span><span>€</span><span>£</span><span>CA$</span><span>A$</span></div>`, { sourceSheets: ['Configuration'] });
}

function howPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  const steps = languageFor(model.locale) === 'nl' ? [['1', 'DOWNLOAD', 'Ontvang direct vier werkmappen en gidsen.'], ['2', 'VUL IN', 'Vul transacties, budgetten en doelen in.'], ['3', 'BESLIS', 'Gebruik dashboards om sneller te beslissen.']] : [['1', 'DOWNLOAD', 'Get four workbooks and guides instantly.'], ['2', 'ENTER', 'Add transactions, budgets and goals.'], ['3', 'DECIDE', 'Use the dashboards to act with confidence.']];
  return pageShell(model, page, copy.howTitle, '', `<div class="steps">${steps.map(([number, title, detail], index) => `<article><span>${number}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p>${index < 2 ? '<i>→</i>' : ''}</article>`).join('')}</div>${device(dashboard(model, true), ui.stepThree, 'mini-device')}`, { sourceSheets: ['Start Here', 'Transactions', 'Executive Overview'] });
}

function previewsPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  const groups = languageFor(model.locale) === 'nl' ? [['PLAN', 'Jaarbudget · Salarisperioden · Transacties'], ['BEHEER', 'Rekeningen · Abonnementen · Herhaaltransacties'], ['BOUW', 'Doelen · Potjes · Noodfonds'], ['LOS AF', 'Schulden · Aflosplan'], ['GROEI', 'Bezittingen · Verplichtingen · Vermogen'], ['ANALYSEER', 'Maand · Cashflow · Trends · Categorieën']] : [['PLAN', 'Annual budget · Pay periods · Transactions'], ['CONTROL', 'Bills · Subscriptions · Recurring items'], ['BUILD', 'Goals · Sinking funds · Emergency fund'], ['PAY OFF', 'Debts · Payment plan'], ['GROW', 'Assets · Liabilities · Net worth'], ['ANALYZE', 'Monthly · Cashflow · Trends · Categories']];
  return pageShell(model, page, copy.previewsTitle, '', `<div class="system-map"><div class="system-core"><b>24</b><span>${escapeHtml(ui.connectedSheets).replace(' ', '<br>')}</span></div>${groups.map(([title, detail], index) => `<article style="--i:${index}"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></article>`).join('')}</div>`, { sourceSheets: model.sourceSheets });
}

function downloadPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  return pageShell(model, page, copy.downloadTitle, languageFor(model.locale) === 'nl' ? 'Geen account. Geen maandelijkse kosten. Geen dataverkoop.' : 'No account. No monthly fee. No data resale.', `<div class="trust-layout"><div class="download-icon"><span>↓</span><b>${escapeHtml(copy.instantDownload)}</b></div><div class="trust-grid">${[copy.localFiles, copy.noSubscription, ui.noBankLogin, ui.useYearAfterYear].map((item, index) => `<article><span>${index + 1}</span><b>${escapeHtml(item)}</b><i>✓</i></article>`).join('')}</div></div>`, { eyebrow: copy.ready });
}

function platformsPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  return pageShell(model, page, copy.platformsTitle, languageFor(model.locale) === 'nl' ? 'Dezelfde kernformules, twee duidelijke workflows.' : 'The same core formulas, two clearly documented workflows.', `<div class="platform-grid"><article><span class="platform-logo excel">X</span><h2>${escapeHtml(copy.excelDesktop)}</h2>${chip(ui.xlsxIncluded, 'accent')}${chip(copy.structuralPass)}<p>${escapeHtml(ui.windowsGate)}</p></article><article><span class="platform-logo sheets">S</span><h2>${escapeHtml(copy.googleSheets)}</h2>${chip(ui.importWorkflowIncluded, 'accent')}${chip(copy.structuralPass)}<p>${escapeHtml(copy.nativePending)}</p></article></div><div class="honesty-bar"><b>${escapeHtml(ui.honestLabels)}</b><span>${escapeHtml(ui.honestDetail)}</span></div>`, { sourceSheets: ['Compatibility Report'] });
}

function paycheckPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  const rows = model.paycheck.slice(0, 4).map(row => [row.period, dateLabel(row.start, model.locale), formatMoney(model, row.income), formatMoney(model, row.allocated), formatMoney(model, row.remaining)]);
  const available = model.paycheck.reduce((sum, row) => sum + numeric(row.remaining), 0);
  return pageShell(model, page, copy.paycheckTitle, languageFor(model.locale) === 'nl' ? 'Plan vast en wisselend inkomen zonder losse trackers.' : 'Plan fixed and variable income without disconnected trackers.', `<div class="split-proof">${device(table([ui.payPeriod, ui.start, ui.income, ui.allocated, ui.free], rows), ui.payPeriodSample)}<div class="side-result">${metric(ui.availableAfterAllocation, formatMoney(model, available))}${metric(ui.payPeriods, String(model.paycheck.length))}${chip(ui.variableIncomeReady, 'accent')}${chip(ui.budgetLinked)}</div></div>`, { sourceSheets: ['Pay-Period Plan', 'Annual Budget'] });
}

function debtPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  const rows = model.debts.map(row => [row.name, formatMoney(model, row.balance), formatPercent(row.rate), formatMoney(model, row.payment), formatPercent(row.progress)]);
  const total = model.debts.reduce((sum, row) => sum + numeric(row.balance), 0);
  return pageShell(model, page, copy.debtTitle, languageFor(model.locale) === 'nl' ? 'Vergelijk sneeuwbal en lawine met dezelfde echte schulddataset.' : 'Compare snowball and avalanche strategies using the same real debt dataset.', `<div class="split-proof">${device(table([ui.debt, ui.balance, ui.apr, ui.payment, ui.progress], rows), ui.debtSample)}<div class="side-result debt-result">${metric(ui.currentBalance, formatMoney(model, total, true))}<div class="strategy"><b>SNOWBALL</b><span>${escapeHtml(ui.snowballDetail)}</span></div><div class="strategy"><b>AVALANCHE</b><span>${escapeHtml(ui.avalancheDetail)}</span></div>${chip(ui.extraPayments, 'accent')}</div></div>`, { sourceSheets: ['Debts', 'Payment Plan'] });
}

function goalsPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  return pageShell(model, page, copy.goalsTitle, languageFor(model.locale) === 'nl' ? 'Doel, voortgang en resterend bedrag in één oogopslag.' : 'Target, progress and remaining amount at a glance.', `<div class="goal-grid">${model.goals.map(row => `<article><div class="goal-ring" style="--p:${Math.round(row.progress * 100)}%"><b>${formatPercent(row.progress)}</b></div><h2>${escapeHtml(row.name)}</h2><p><span>${escapeHtml(formatMoney(model, row.value, true))}</span> ${escapeHtml(ui.of)} ${escapeHtml(formatMoney(model, row.target, true))}</p><div class="progress"><i style="width:${Math.round(row.progress * 100)}%"></i></div><small>${escapeHtml(formatMoney(model, row.remaining, true))} ${escapeHtml(ui.remaining)} · ${escapeHtml(formatMoney(model, row.monthly, true))}/${escapeHtml(ui.perMonth)}</small></article>`).join('')}</div>`, { sourceSheets: ['Goals', 'Sinking Funds', 'Emergency Fund'] });
}

function netWorthPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  const latest = model.netWorth.at(-1) ?? { assets: 0, liabilities: 0, net: 0 };
  return pageShell(model, page, copy.netWorthTitle, languageFor(model.locale) === 'nl' ? 'Bezittingen en verplichtingen worden één groeiverhaal.' : 'Assets and liabilities become one visible growth story.', `<div class="net-layout"><div class="net-metrics">${metric(ui.assets, formatMoney(model, latest.assets, true))}${metric(ui.liabilities, formatMoney(model, latest.liabilities, true))}${metric(ui.netWorth, formatMoney(model, latest.net, true), ui.upwardTrend)}</div><div class="net-chart"><div class="card-label">${escapeHtml(ui.netWorth12)}</div>${lineChart(model.netWorth.map(row => row.net), { width: 1500, height: 500 })}</div></div>`, { sourceSheets: ['Assets', 'Liability Register', 'Net-Worth History'] });
}

function billsPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  const billRows = model.bills.map(row => [row.name, formatMoney(model, row.amount), dateLabel(row.due, model.locale), row.method, row.status]);
  const subscriptions = model.subscriptions.reduce((sum, row) => sum + numeric(row.annual), 0);
  return pageShell(model, page, copy.billsTitle, languageFor(model.locale) === 'nl' ? 'Vaste lasten, verlengingen en jaarlijkse kosten zichtbaar.' : 'Recurring bills, renewals and annualized costs made visible.', `<div class="split-proof bills-split">${device(table([ui.bill, ui.amount, ui.due, ui.method, ui.status], billRows), ui.billsSample)}<div class="side-result">${metric(ui.annualSubscriptions, formatMoney(model, subscriptions))}${model.subscriptions.map(row => `<div class="subscription"><b>${escapeHtml(row.name)}</b><span>${escapeHtml(formatMoney(model, row.amount))} / ${escapeHtml(row.frequency)}</span><i>${escapeHtml(row.status)}</i></div>`).join('')}${chip(ui.renewalControl, 'accent')}</div></div>`, { sourceSheets: ['Bills', 'Subscriptions', 'Recurring Transactions'] });
}

function privacyPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  const items = languageFor(model.locale) === 'nl' ? [['LOKAAL', 'Bestanden blijven op jouw apparaat of gekozen cloudopslag.'], ['PRIVÉ', 'Geen banklogin en geen gegevensverkoop.'], ['FLEXIBEL', 'Werk zonder verplicht account of abonnement.']] : [['LOCAL', 'Files stay on your device or chosen cloud storage.'], ['PRIVATE', 'No bank login and no data resale.'], ['PORTABLE', 'Work without a mandatory account or subscription.']];
  return pageShell(model, page, copy.privacyTitle, '', `<div class="privacy-shield"><div class="shield">⌾</div>${items.map(([title, detail]) => `<article><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p><b>✓</b></article>`).join('')}</div>`, { eyebrow: ui.privacyByDesign });
}

function supportPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  const steps = languageFor(model.locale) === 'nl' ? [['01', 'SNELSTART', 'Directe installatiehulp in de download.'], ['02', 'MENSELIJK ANTWOORD', 'Persoonlijke reactie binnen één werkdag.'], ['03', 'GERICHTE TRIAGE', 'Platform, versie en schermafbeelding versnellen de oplossing.']] : [['01', 'QUICK START', 'Immediate setup guidance inside the download.'], ['02', 'HUMAN REPLY', 'A personal response within one business day.'], ['03', 'FOCUSED TRIAGE', 'Platform, version and screenshot speed up resolution.']];
  return pageShell(model, page, copy.supportTitle, copy.support, `<div class="support-flow">${steps.map(([number, title, detail]) => `<article><span>${number}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></article>`).join('')}</div><div class="support-bar">${ui.supportTags.map(item => chip(item)).join('')}</div>`, { eyebrow: copy.oneBusinessDay });
}

function buyerPage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  const yes = languageFor(model.locale) === 'nl' ? ['Je wilt één compleet financieel systeem.', 'Je budgetteert per maand of salarisperiode.', 'Je wilt schulden, doelen en vermogen verbinden.'] : ['You want one complete finance system.', 'You budget monthly or by paycheck.', 'You want debt, goals and net worth connected.'];
  const no = languageFor(model.locale) === 'nl' ? ['Je verwacht automatische bankkoppeling.', 'Je zoekt persoonlijk financieel advies.', 'Je hebt gezamenlijke realtime cloudboekhouding nodig.'] : ['You expect automatic bank syncing.', 'You need personal financial advice.', 'You require collaborative real-time bookkeeping.'];
  return pageShell(model, page, copy.fitTitle, copy.idealFor, `<div class="fit-grid"><article class="yes"><span>✓</span><h2>${escapeHtml(ui.perfectFit)}</h2>${yes.map(item => `<p>${escapeHtml(item)}</p>`).join('')}</article><article class="no"><span>×</span><h2>${escapeHtml(ui.wrongFit)}</h2>${no.map(item => `<p>${escapeHtml(item)}</p>`).join('')}</article></div>`, { eyebrow: ui.expectations });
}

function valuePage(model, page) {
  const copy = COPY[languageFor(model.locale)];
  const ui = uiFor(model);
  const values = [[`${model.sheetCount}`, ui.valueLabels[0]], [`${model.inputCapacity.toLocaleString(model.locale)}`, ui.valueLabels[1]], ['4', ui.valueLabels[2]], ['2', ui.valueLabels[3]], ['1', ui.valueLabels[4]], [ui.day, ui.valueLabels[5]]];
  return pageShell(model, page, copy.valueTitle, languageFor(model.locale) === 'nl' ? 'Geen lege beloftes—alleen wat daadwerkelijk in de Core-editie zit.' : 'No inflated promises—only what is actually delivered in the Core edition.', `<div class="value-layout"><div class="value-grid">${values.map(([value, label]) => `<article><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`).join('')}</div><aside><span>${escapeHtml(copy.coreOffer)}</span><strong>${escapeHtml(copy.price)}</strong><p>${ui.offerLines}</p>${chip(copy.ready, 'accent')}</aside></div><div class="disclaimer">${escapeHtml(copy.disclaimer)}</div>`, { eyebrow: ui.offerEyebrow });
}

const PAGE_RENDERERS = Object.freeze({
  hero: heroPage, 'dashboard-overview': dashboardPage, 'monthly-budget': budgetPage, 'key-features': featuresPage,
  'light-dark-comparison': comparisonPage, 'whats-included': includedPage, 'language-currency-options': optionsPage,
  'how-it-works': howPage, 'workbook-previews': previewsPage, 'digital-download': downloadPage,
  'excel-google-sheets': platformsPage, 'paycheck-planning': paycheckPage, 'debt-payoff': debtPage,
  'savings-goals': goalsPage, 'net-worth': netWorthPage, 'bill-subscriptions': billsPage,
  'privacy-no-account': privacyPage, 'support-promise': supportPage, 'buyer-fit': buyerPage, 'value-stack': valuePage,
});

const CSS = String.raw`
*{box-sizing:border-box}html,body{margin:0;width:2400px;height:1600px;overflow:hidden;background:#050807;color:#f4f5ef;font-family:"Segoe UI",Arial,sans-serif}.canvas{position:relative;width:2400px;height:1600px;padding:62px 88px 72px;overflow:hidden;background:radial-gradient(circle at 82% 5%,rgba(0,255,148,.11),transparent 32%),linear-gradient(145deg,#050706 0%,#09110d 58%,#050706 100%)}.canvas:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:48px 48px;mask-image:linear-gradient(to bottom,black,transparent 80%)}.ambient{position:absolute;border-radius:50%;filter:blur(120px);opacity:.16}.ambient.a{width:680px;height:680px;background:#00ff94;right:-260px;top:180px}.ambient.b{width:500px;height:500px;background:#0b6e4f;left:-260px;bottom:-160px}header,.title-block,.content,footer{position:relative;z-index:2}header{display:flex;align-items:center;justify-content:space-between;height:82px}.brand{display:flex;align-items:center;gap:22px}.brand-mark{display:grid;place-items:center;width:66px;height:66px;border-radius:18px;background:#00ff94;color:#03130b;font:900 38px/1 Consolas,monospace;box-shadow:0 0 40px rgba(0,255,148,.22)}.brand b{display:block;font-size:26px;letter-spacing:.13em}.brand small{display:block;margin-top:7px;color:#8a9b93;font:600 15px/1.2 Consolas,monospace;letter-spacing:.12em}.page-no{color:#91a199;font:700 23px Consolas,monospace;letter-spacing:.08em}.title-block{margin-top:42px;max-width:2100px}.eyebrow{display:inline-flex;align-items:center;min-height:44px;padding:10px 20px;border:1px solid rgba(0,255,148,.38);border-radius:999px;background:rgba(0,255,148,.08);color:#00ff94;font:800 17px Consolas,monospace;letter-spacing:.12em}.title-block h1{margin:20px 0 10px;max-width:2100px;font-size:82px;line-height:1.14;letter-spacing:-.045em}.title-block p{margin:0;max-width:1700px;color:#a9b6b0;font-size:29px;line-height:1.35}.content{margin-top:34px;height:965px}.canvas footer{position:absolute;left:88px;right:88px;bottom:40px;display:flex;justify-content:space-between;border-top:1px solid #26322d;padding-top:22px;color:#7f8e87;font:700 17px Consolas,monospace;letter-spacing:.07em}.canvas footer b{color:#aab6b0}.chip{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:12px 18px;border:1px solid #34443c;border-radius:12px;background:#0c1511;color:#dce5e0;font:800 16px Consolas,monospace;letter-spacing:.04em}.chip.accent{border-color:#00ff94;background:#00ff94;color:#03130b}.device{position:relative;border:1px solid #34453d;border-radius:30px;background:#090d0b;box-shadow:0 34px 90px rgba(0,0,0,.5),0 0 0 8px rgba(255,255,255,.018);overflow:hidden}.device-top{height:64px;display:flex;align-items:center;gap:13px;padding:0 24px;background:#121a16;border-bottom:1px solid #29362f}.device-top i{width:14px;height:14px;border-radius:50%;background:#ff6b64}.device-top i:nth-child(2){background:#f6c453}.device-top i:nth-child(3){background:#58d68d}.device-top span{margin-left:14px;color:#9ead9f;font:700 15px Consolas,monospace;letter-spacing:.06em}.device-screen{padding:22px;background:#07100c}.dashboard{height:100%;padding:22px;border-radius:18px;background:linear-gradient(160deg,#0a130f,#080c0a)}.dash-nav{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 17px;border:1px solid #26362f;border-radius:11px;background:#101914}.dash-nav b{color:#00ff94;font-size:19px;letter-spacing:.08em}.dash-nav span{color:#6f8077;font:700 11px Consolas,monospace}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:15px}.metric{position:relative;min-height:130px;padding:18px;border:1px solid #26362f;border-radius:14px;background:linear-gradient(160deg,#101a15,#0c120f);overflow:hidden}.metric:after{content:"";position:absolute;top:18px;right:16px;width:7px;height:45px;border-radius:8px;background:#00ff94}.metric span{display:block;color:#8fa198;font:700 12px Consolas,monospace;letter-spacing:.08em}.metric strong{display:block;margin-top:10px;font-size:32px;line-height:1.18}.metric small{display:block;margin-top:10px;color:#00ff94;font:700 11px Consolas,monospace}.dash-grid{display:grid;grid-template-columns:2.1fr .8fr;gap:15px;margin-top:15px}.chart-card,.donut-card,.chart-panel,.net-chart{border:1px solid #26362f;border-radius:16px;background:#0d1511;padding:22px}.card-label{color:#9aaba2;font:800 13px Consolas,monospace;letter-spacing:.08em}.chart-svg{display:block;width:100%;height:auto;margin-top:8px}.donut-card{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.donut{display:grid;place-items:center;width:180px;height:180px;border-radius:50%;background:conic-gradient(#00ff94 var(--p),#223029 0);position:relative}.donut:after{content:"";position:absolute;inset:28px;border-radius:50%;background:#0d1511}.donut div{position:relative;z-index:2}.donut strong{display:block;font-size:30px}.donut span{color:#829189;font:700 10px Consolas,monospace}.donut-card>b{margin-top:18px}.donut-card small{margin-top:8px;color:#87978f;max-width:240px}.hero-layout{position:relative;height:900px}.hero-proof{position:absolute;left:0;top:12px;width:520px;display:flex;flex-wrap:wrap;gap:12px}.hero-proof .chip{width:max-content}.micro-proof{display:grid;grid-template-columns:120px 1fr;align-items:center;gap:10px 18px;width:500px;margin-top:22px;padding:24px;border-left:4px solid #00ff94;background:rgba(9,18,14,.78)}.micro-proof b{font-size:44px;color:#00ff94}.micro-proof span{color:#9caaa3;font:700 14px Consolas,monospace;line-height:1.35}.hero-device{position:absolute;right:0;top:0;width:1650px;height:870px;transform:perspective(1800px) rotateY(-2deg) rotateX(1deg)}.hero-device .device-screen{height:806px}.hero-device .dashboard{padding:18px}.hero-device .metric{min-height:116px}.wide-device{height:900px}.wide-device .device-screen{height:836px}.wide-device .dashboard{padding:28px}.wide-device .metric{min-height:145px}.wide-device .metric strong{font-size:40px}.wide-device .dash-grid{grid-template-columns:2.4fr .7fr}.split-proof{display:grid;grid-template-columns:1.7fr .75fr;gap:34px;height:900px}.split-proof>.device{height:850px}.split-proof>.device .device-screen{height:786px;padding:24px}.table-wrap{width:100%;height:100%;overflow:hidden;border-radius:14px;border:1px solid #25372f;background:#0b120f}.table-wrap table{width:100%;border-collapse:collapse;font-size:22px}.table-wrap th{height:76px;padding:0 22px;background:#163f30;color:#eafff4;text-align:left;font:800 15px Consolas,monospace;letter-spacing:.05em}.table-wrap td{height:82px;padding:0 22px;border-bottom:1px solid #213029;color:#cfd8d3}.table-wrap tbody tr:nth-child(even){background:#0f1814}.table-wrap .row-label{color:#fff;font-weight:800}.table-wrap.compact table{font-size:19px}.table-wrap.compact td{height:70px}.chart-panel{height:850px;padding:34px}.bars{height:450px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-top:90px;border-bottom:2px solid #34473e}.bar-col{height:420px;flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:10px}.bar{width:54px;border-radius:12px 12px 0 0;background:linear-gradient(#00ff94,#087449);box-shadow:0 0 24px rgba(0,255,148,.15)}.bar-col span,.bar-value{font:700 12px Consolas,monospace;color:#87978f}.bar-value{color:#b8c6bf}.chart-panel>.chip{margin:50px 8px 0 0}.feature-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.feature{position:relative;height:410px;padding:44px;border:1px solid #293b32;border-radius:22px;background:linear-gradient(145deg,rgba(17,29,23,.94),rgba(8,13,11,.94));overflow:hidden}.feature>span{color:#00ff94;font:800 19px Consolas,monospace}.feature h2{margin:45px 0 15px;font-size:43px}.feature p{margin:0;color:#9fada6;font-size:24px;line-height:1.45}.feature i{position:absolute;left:44px;bottom:38px;width:130px;height:7px;border-radius:10px;background:#00ff94}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:34px}.comparison .device{height:720px}.comparison .device-screen{height:656px}.comparison .dashboard{padding:14px}.comparison .metric{min-height:102px;padding:13px}.comparison .metric strong{font-size:25px}.comparison .chart-svg{max-height:200px}.light-device{background:#eef4ef}.light-device .device-screen{filter:invert(.88) hue-rotate(95deg) saturate(.75)}.center-chips{display:flex;justify-content:center;gap:16px;margin-top:36px}.included-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.included-card{height:260px;display:flex;align-items:center;gap:28px;padding:34px;border:1px solid #293b32;border-radius:22px;background:#0c1410}.included-card>span{display:grid;place-items:center;width:130px;height:130px;border-radius:22px;background:#00ff94;color:#04130c;font:900 19px Consolas,monospace}.included-card h2{margin:0 0 12px;font-size:33px}.included-card p{margin:0;color:#8fa098;font-size:22px}.included-card>b{margin-left:auto;color:#00ff94;font-size:38px}.option-stack{width:1450px;display:grid;gap:18px}.option-stack article{height:160px;display:grid;grid-template-columns:300px 1fr 110px;align-items:center;padding:0 42px;border:1px solid #2a3d33;border-radius:18px;background:#0c1511}.option-stack span{color:#00ff94;font:800 18px Consolas,monospace}.option-stack strong{font-size:35px}.toggle{width:82px;height:44px;border-radius:30px;background:#26342d;position:relative}.toggle:after{content:"";position:absolute;left:7px;top:7px;width:30px;height:30px;border-radius:50%;background:#75837c}.toggle.on{background:#0f5e40}.toggle.on:after{left:45px;background:#00ff94}.currency-orbit{position:absolute;right:90px;top:150px;width:620px;height:620px;border:1px solid #2d4438;border-radius:50%;display:grid;place-items:center}.currency-orbit:after{content:"";position:absolute;inset:90px;border:1px dashed #315242;border-radius:50%}.currency-orbit b{display:grid;place-items:center;width:190px;height:190px;border-radius:50%;background:#00ff94;color:#04140c;font-size:55px;z-index:2}.currency-orbit span{position:absolute;display:grid;place-items:center;width:90px;height:90px;border-radius:50%;background:#14231b;color:#d8e2dd;font-weight:900}.currency-orbit span:nth-of-type(1){top:12px}.currency-orbit span:nth-of-type(2){right:25px;top:165px}.currency-orbit span:nth-of-type(3){right:85px;bottom:55px}.currency-orbit span:nth-of-type(4){left:85px;bottom:55px}.currency-orbit span:nth-of-type(5){left:25px;top:165px}.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}.steps article{position:relative;height:420px;padding:44px;border:1px solid #2a3c33;border-radius:24px;background:#0d1612}.steps article>span{display:grid;place-items:center;width:92px;height:92px;border-radius:22px;background:#00ff94;color:#04140c;font-size:38px;font-weight:900}.steps h2{font-size:39px}.steps p{color:#97a79f;font-size:23px;line-height:1.45}.steps i{position:absolute;right:-46px;top:170px;color:#00ff94;font-size:62px;font-style:normal;z-index:3}.mini-device{width:1500px;height:385px;margin:-4px auto 0}.mini-device .device-screen{height:321px;padding:8px}.mini-device .dashboard{padding:8px}.mini-device .metrics,.mini-device .dash-grid{display:none}.system-map{position:relative;height:900px}.system-core{position:absolute;left:50%;top:290px;transform:translateX(-50%);width:300px;height:300px;border-radius:50%;display:grid;grid-template-columns:1fr 1.2fr;align-items:center;padding:55px;background:#00ff94;color:#04140c;box-shadow:0 0 100px rgba(0,255,148,.22);z-index:3}.system-core b{font-size:83px}.system-core span{font:900 19px/1.3 Consolas,monospace}.system-map article{position:absolute;width:590px;height:190px;padding:30px 34px;border:1px solid #2b4035;border-radius:20px;background:#0d1712}.system-map article h2{margin:0 0 14px;color:#00ff94;font-size:28px}.system-map article p{margin:0;color:#a4b2ab;font-size:19px;line-height:1.4}.system-map article:nth-of-type(1){left:40px;top:45px}.system-map article:nth-of-type(2){right:40px;top:45px}.system-map article:nth-of-type(3){left:0;top:365px}.system-map article:nth-of-type(4){right:0;top:365px}.system-map article:nth-of-type(5){left:140px;bottom:25px}.system-map article:nth-of-type(6){right:140px;bottom:25px}.trust-layout{display:grid;grid-template-columns:.8fr 1.5fr;gap:50px}.download-icon{height:820px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:34px;background:linear-gradient(160deg,#00ff94,#0e8d5b);color:#03130b}.download-icon>span{display:grid;place-items:center;width:300px;height:300px;border:18px solid #03130b;border-radius:50%;font-size:180px;font-weight:900;line-height:1}.download-icon b{margin-top:55px;font:900 27px Consolas,monospace;letter-spacing:.08em}.trust-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.trust-grid article{position:relative;height:390px;padding:44px;border:1px solid #2a3e34;border-radius:25px;background:#0d1712}.trust-grid article>span{color:#00ff94;font:800 18px Consolas,monospace}.trust-grid article>b{display:block;margin-top:80px;font-size:36px;line-height:1.2}.trust-grid article>i{position:absolute;right:42px;bottom:38px;color:#00ff94;font-size:36px}.platform-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px}.platform-grid article{height:620px;padding:50px;border:1px solid #2c4036;border-radius:28px;background:#0d1712}.platform-logo{display:grid;place-items:center;width:150px;height:150px;border-radius:28px;font-size:72px;font-weight:900}.platform-logo.excel{background:#107c41}.platform-logo.sheets{background:#0f9d58}.platform-grid h2{font-size:48px;margin:34px 0}.platform-grid .chip{margin:0 10px 16px 0}.platform-grid p{margin-top:40px;color:#8fa099;font:700 17px/1.5 Consolas,monospace}.honesty-bar{height:160px;margin-top:30px;display:flex;align-items:center;justify-content:space-between;padding:0 42px;border-left:8px solid #00ff94;background:#0b1711}.honesty-bar b{color:#00ff94;font:900 19px Consolas,monospace}.honesty-bar span{color:#a3b2aa;font-size:22px}.side-result{display:flex;flex-direction:column;gap:18px}.side-result .metric{min-height:165px}.side-result .metric strong{font-size:49px}.strategy,.subscription{padding:25px;border:1px solid #2b4035;border-radius:16px;background:#0d1712}.strategy b,.subscription b{display:block;color:#00ff94;font-size:22px}.strategy span,.subscription span{display:block;margin-top:10px;color:#93a29b}.debt-result .strategy{min-height:135px}.goal-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}.goal-grid article{height:760px;padding:42px;border:1px solid #2b4035;border-radius:28px;background:#0d1712;text-align:center}.goal-ring{--p:50%;width:260px;height:260px;margin:10px auto 35px;display:grid;place-items:center;border-radius:50%;background:conic-gradient(#00ff94 var(--p),#24352c 0);position:relative}.goal-ring:after{content:"";position:absolute;inset:34px;border-radius:50%;background:#0d1712}.goal-ring b{position:relative;z-index:2;font-size:48px}.goal-grid h2{font-size:35px}.goal-grid p{color:#91a199;font-size:22px}.goal-grid p span{color:#fff;font-size:32px;font-weight:900}.progress{height:20px;margin:38px 0 25px;border-radius:20px;background:#24352c;overflow:hidden}.progress i{display:block;height:100%;border-radius:20px;background:#00ff94}.goal-grid small{color:#93a29b;font:700 15px Consolas,monospace;line-height:1.6}.net-layout{height:880px}.net-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.net-metrics .metric{min-height:170px}.net-metrics .metric strong{font-size:51px}.net-chart{height:610px;margin-top:24px;padding:35px}.net-chart .chart-svg{height:500px}.bills-split{grid-template-columns:1.55fr .8fr}.subscription{position:relative;min-height:118px}.subscription i{position:absolute;right:22px;top:25px;color:#00ff94;font:700 13px Consolas,monospace}.privacy-shield{position:relative;height:850px;padding-left:650px;display:grid;grid-template-columns:1fr;gap:20px}.shield{position:absolute;left:40px;top:90px;width:500px;height:600px;display:grid;place-items:center;clip-path:polygon(50% 0,92% 14%,86% 74%,50% 100%,14% 74%,8% 14%);background:linear-gradient(155deg,#00ff94,#08744b);color:#03130b;font-size:190px;font-weight:900}.privacy-shield article{position:relative;min-height:220px;padding:38px 100px 38px 42px;border:1px solid #2d4137;border-radius:22px;background:#0d1712}.privacy-shield h2{margin:0 0 15px;font-size:35px}.privacy-shield p{margin:0;color:#99a8a1;font-size:23px;line-height:1.45}.privacy-shield article>b{position:absolute;right:38px;top:75px;color:#00ff94;font-size:42px}.support-flow{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}.support-flow article{height:590px;padding:48px;border:1px solid #2b4035;border-radius:26px;background:#0d1712}.support-flow article>span{color:#00ff94;font:900 25px Consolas,monospace}.support-flow h2{margin-top:90px;font-size:40px}.support-flow p{color:#98a7a0;font-size:23px;line-height:1.5}.support-bar{display:flex;justify-content:center;gap:16px;margin-top:45px}.fit-grid{display:grid;grid-template-columns:1fr 1fr;gap:34px}.fit-grid article{height:790px;padding:52px;border:1px solid #2b4035;border-radius:28px;background:#0d1712}.fit-grid article>span{display:grid;place-items:center;width:110px;height:110px;border-radius:24px;font-size:70px;font-weight:900}.fit-grid .yes>span{background:#00ff94;color:#03130b}.fit-grid .no>span{background:#321919;color:#ff7a72}.fit-grid h2{margin:50px 0;font-size:43px}.fit-grid p{margin:0;padding:25px 0 25px 46px;border-top:1px solid #273a31;color:#acb9b2;font-size:24px;position:relative}.fit-grid p:before{content:"";position:absolute;left:3px;top:36px;width:13px;height:13px;border-radius:50%;background:#00ff94}.fit-grid .no p:before{background:#ff7a72}.value-layout{display:grid;grid-template-columns:1.5fr .7fr;gap:34px}.value-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.value-grid article{height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #2b4035;border-radius:24px;background:#0d1712}.value-grid strong{font-size:67px;color:#00ff94}.value-grid span{margin-top:20px;color:#9caaa3;font:800 14px Consolas,monospace;text-align:center}.value-layout aside{padding:48px;border:1px solid #00ff94;border-radius:28px;background:linear-gradient(160deg,#123829,#0b1711)}.value-layout aside>span{color:#00ff94;font:900 17px Consolas,monospace}.value-layout aside>strong{display:block;margin:45px 0 30px;font-size:55px}.value-layout aside p{color:#c4d0ca;font-size:22px;line-height:1.8}.value-layout aside .chip{margin-top:40px}.disclaimer{margin-top:22px;color:#7f9087;font:700 14px Consolas,monospace;text-align:center}
.title-block h1{line-height:1.25}
`;

function htmlDocument(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${PREMIUM_LISTING_WIDTH},initial-scale=1"><style>${CSS}</style></head><body>${body}</body></html>`;
}

export function renderPremiumListingHtml(evidence, pageId) {
  const pageSpec = PREMIUM_LISTING_PAGES.find(page => page.id === pageId);
  if (!pageSpec) throw new Error(`Unknown premium Etsy listing page '${pageId}'.`);
  const render = PAGE_RENDERERS[pageSpec.id];
  if (!render) throw new Error(`Premium Etsy renderer is missing for '${pageSpec.id}'.`);
  return htmlDocument(render(evidence, pageSpec));
}

async function inspectCommercialPage(page, pageSpec, locale) {
  return page.evaluate(({ width, height, pageId, locale }) => {
    const bannedPatterns = [/\bDESCRIPTION\b/i, /=\s*…/u, /\bTODO\b/i, /\bLOREM\b/i, /\bPLACEHOLDER\b/i];
    const languageMismatchPatterns = String(locale).toLowerCase().startsWith('nl') ? [
      /\bCONNECTED SHEETS\b/i, /\bINPUT ROWS\b/i, /\bBUILT-IN FORMULA/i, /\bAUTOMATED QUALITY/i,
      /\bOVERVIEW\b/i, /\bINCOME\b/i, /\bEXPENSES\b/i, /\bNET WORTH\b/i, /\bTRENDING UP\b/i,
      /\bREAL SAMPLE DATA\b/i, /\bLIGHT EDITION\b/i, /\bDARK EDITION\b/i, /\bNO BANK LOGIN\b/i,
      /\bHONEST COMPATIBILITY\b/i, /\bAVAILABLE AFTER\b/i, /\bCURRENT BALANCE\b/i, /\bHUMAN SUPPORT\b/i,
    ] : [];
    const root = document.querySelector('.canvas');
    const text = root?.innerText ?? '';
    const banned = bannedPatterns.filter(pattern => pattern.test(text)).map(pattern => String(pattern));
    const languageMismatches = languageMismatchPatterns.filter(pattern => pattern.test(text)).map(pattern => String(pattern));
    const clipped = [...document.querySelectorAll('h1,h2,p,strong,small,.chip,th,td,.eyebrow,.brand b,.brand small')].filter(element => {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.top < -1 || rect.right > width + 1 || rect.bottom > height + 1 || element.scrollWidth > element.clientWidth + 12 || element.scrollHeight > element.clientHeight + 12;
    }).map(element => ({ tag: element.tagName, text: element.textContent.trim().slice(0, 80), client: [element.clientWidth, element.clientHeight], scroll: [element.scrollWidth, element.scrollHeight] }));
    const actualPageId = root?.dataset.pageId;
    return {
      status: actualPageId === pageId && banned.length === 0 && languageMismatches.length === 0 && clipped.length === 0 && text.trim().length >= 180 ? 'PASS' : 'FAIL',
      actualPageId, textCharacters: text.trim().length, banned, languageMismatches, clipped,
      visualElements: {
        devices: document.querySelectorAll('.device').length,
        tables: document.querySelectorAll('table').length,
        charts: document.querySelectorAll('svg,.bars,.donut,.goal-ring').length,
        cards: document.querySelectorAll('article').length,
      },
    };
  }, { width: PREMIUM_LISTING_WIDTH, height: PREMIUM_LISTING_HEIGHT, pageId: pageSpec.id, locale });
}

async function launchRenderingBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (bundledError) {
    const candidates = [
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    ].filter(Boolean);
    for (const executablePath of candidates) {
      try {
        await access(executablePath);
        return await chromium.launch({ headless: true, executablePath });
      } catch {
        // Continue through installed browser candidates; the original error remains the authoritative cause.
      }
    }
    throw new Error('No local Chromium-compatible browser is available for premium listing rendering. Install Edge/Chrome or Playwright Chromium, or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.', { cause: bundledError });
  }
}

export async function buildPremiumEtsyListingImages({ workbookPath, outputDirectory, locale = 'en-US', currency = 'USD', inputCapacity = 10_000, generatedAt = new Date().toISOString() }) {
  const evidence = await extractPremiumWorkbookEvidence({ workbookPath, locale, currency, inputCapacity });
  const current = evidence.monthly[0];
  if (!current || numeric(current.income) <= 0 || numeric(current.expenses) <= 0 || evidence.debts.length < 1 || evidence.goals.length < 1 || evidence.netWorth.length < 2) {
    throw new Error(`Commercial workbook evidence is incomplete for ${locale}; listing visuals will not render zero-value or empty product proof.`);
  }
  const outputRoot = resolve(outputDirectory);
  await mkdir(outputRoot, { recursive: true });
  const browser = await launchRenderingBrowser();
  const context = await browser.newContext({ viewport: { width: PREMIUM_LISTING_WIDTH, height: PREMIUM_LISTING_HEIGHT }, deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const images = [];
  const checks = [];
  try {
    for (const pageSpec of PREMIUM_LISTING_PAGES) {
      await page.setContent(renderPremiumListingHtml(evidence, pageSpec.id), { waitUntil: 'load' });
      const inspection = await inspectCommercialPage(page, pageSpec, locale);
      checks.push({ id: pageSpec.id, ...inspection });
      if (inspection.status !== 'PASS') throw new Error(`${pageSpec.id}: commercial visual inspection failed: ${JSON.stringify(inspection)}`);
      const target = resolve(outputRoot, pageSpec.filename);
      await page.screenshot({ path: target, type: 'png', animations: 'disabled', caret: 'hide' });
      const bytes = new Uint8Array(await readFile(target));
      if (bytes.byteLength < 100_000) throw new Error(`${pageSpec.id}: premium listing image is suspiciously small (${bytes.byteLength} bytes).`);
      images.push(Object.freeze({ id: pageSpec.id, filename: basename(target), path: target, bytes, width: PREMIUM_LISTING_WIDTH, height: PREMIUM_LISTING_HEIGHT, sha256: await sha256Hex(bytes) }));
    }
  } finally {
    await context.close();
    await browser.close();
  }
  const manifest = {
    schemaVersion: '2.0.0', status: checks.every(check => check.status === 'PASS') && images.length === PREMIUM_LISTING_PAGES.length ? 'PASS' : 'FAIL',
    generatedAt: new Date(generatedAt).toISOString(), locale, currency, sourceWorkbook: resolve(workbookPath), sourceWorkbookSha256: evidence.workbookSha256,
    renderer: 'playwright-html-high-fidelity-v2', dimensions: { width: PREMIUM_LISTING_WIDTH, height: PREMIUM_LISTING_HEIGHT },
    commercialGate: { bannedTokens: ['DESCRIPTION', '=…', 'TODO', 'LOREM', 'PLACEHOLDER'], dutchLanguageMismatchDetection: true, nonZeroWorkbookEvidenceRequired: true, minimumTextCharacters: 180, minimumFileBytes: 100_000, overflowTolerancePixels: 12 },
    evidence: { sheetCount: evidence.sheetCount, inputCapacity: evidence.inputCapacity, formulaDefinitionCount: evidence.formulaDefinitionCount, sourceSheets: evidence.sourceSheets },
    checks, images: images.map(({ bytes: _bytes, path, ...image }) => ({ ...image, path })),
  };
  if (manifest.status !== 'PASS') throw new Error('Premium Etsy listing image gate failed.');
  const manifestPath = resolve(outputRoot, 'premium-listing-image-manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return Object.freeze({ images: Object.freeze(images), manifest: Object.freeze(manifest), manifestPath, evidence });
}
