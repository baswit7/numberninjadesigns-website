const LOCALES = Object.freeze(['en-US', 'en-GB', 'nl-NL', 'de-DE']);
const PLATFORM_PROFILES = Object.freeze(['excel', 'google-sheets-compatible']);
const THEMES = Object.freeze(['light', 'dark', 'neutral', 'warm-professional', 'niche-specific']);

const FAMILY_PROFILES = Object.freeze({
  'personal-finance': Object.freeze({
    modules: ['onboarding', 'settings', 'dashboard', 'income', 'expenses', 'bills', 'savings', 'debt', 'goals', 'categories', 'charts', 'validation', 'instructions'],
    sheets: ['Start Here', 'Dashboard', 'Income', 'Expenses', 'Bills', 'Savings', 'Debt', 'Goals', 'Categories', 'Instructions'],
    categories: ['Income', 'Housing', 'Utilities', 'Food', 'Transport', 'Insurance', 'Savings', 'Debt'],
    disclaimers: ['Organizational tool only; not financial, tax, legal or investment advice.'],
  }),
  'small-business': Object.freeze({
    modules: ['onboarding', 'settings', 'dashboard', 'transactions', 'customers', 'accounts', 'invoices', 'payments', 'profitability', 'reports', 'categories', 'validation', 'instructions'],
    sheets: ['Start Here', 'Dashboard', 'Transactions', 'Customers', 'Invoices', 'Payments', 'Profit and Loss', 'Categories', 'Instructions'],
    categories: ['Sales', 'Services', 'Materials', 'Software', 'Marketing', 'Travel', 'Professional Fees', 'Other'],
    disclaimers: ['Record-keeping tool only; not tax, legal or accounting advice. Verify classifications with a qualified professional.'],
  }),
  'projects-productivity': Object.freeze({
    modules: ['onboarding', 'settings', 'dashboard', 'project-register', 'task-register', 'timeline', 'calendar', 'charts', 'reports', 'validation', 'instructions'],
    sheets: ['Start Here', 'Dashboard', 'Projects', 'Tasks', 'Timeline', 'Risk Register', 'Status Summary', 'Instructions'],
    categories: ['Planning', 'Delivery', 'Review', 'Operations', 'Marketing', 'Administration'],
    disclaimers: ['Planning tool only; outcomes depend on the user’s data and execution.'],
  }),
  'wedding-event': Object.freeze({
    modules: ['onboarding', 'settings', 'dashboard', 'budget', 'people-contacts', 'vendors', 'payments', 'timeline', 'calendar', 'task-register', 'reports', 'validation', 'instructions'],
    sheets: ['Start Here', 'Dashboard', 'Budget', 'Guests', 'Vendors', 'Payments', 'Timeline', 'Checklist', 'Seating Plan', 'Instructions'],
    categories: ['Venue', 'Catering', 'Attire', 'Photography', 'Music', 'Flowers', 'Stationery', 'Transport', 'Other'],
    disclaimers: ['Planning estimates are user-provided and do not constitute vendor, legal or financial advice.'],
  }),
  'life-family': Object.freeze({
    modules: ['onboarding', 'settings', 'dashboard', 'people-contacts', 'calendar', 'expenses', 'task-register', 'goals', 'reports', 'validation', 'instructions'],
    sheets: ['Start Here', 'Dashboard', 'Schedule', 'Expenses', 'Tasks', 'Goals', 'Contacts', 'Instructions'],
    categories: ['Household', 'Children', 'Food', 'Travel', 'Education', 'Health', 'Maintenance', 'Other'],
    disclaimers: ['Organizational tool only; not medical, legal or financial advice.'],
  }),
});

const PORTFOLIO_ROWS = Object.freeze([
  ['simple-monthly-budget', 'personal-finance', 'Simple Monthly Budget', 'BASIC'],
  ['annual-budget-spreadsheet', 'personal-finance', 'Annual Budget Spreadsheet', 'PROFESSIONAL'],
  ['ultimate-finance-dashboard', 'personal-finance', 'Ultimate Finance Dashboard', 'ULTIMATE'],
  ['paycheck-budget-spreadsheet', 'personal-finance', 'Paycheck Budget Spreadsheet', 'PROFESSIONAL'],
  ['biweekly-budget-planner', 'personal-finance', 'Biweekly Budget Planner', 'PROFESSIONAL'],
  ['irregular-income-budget', 'personal-finance', 'Irregular Income Budget', 'PROFESSIONAL'],
  ['family-budget', 'personal-finance', 'Family Budget', 'PROFESSIONAL'],
  ['couples-budget', 'personal-finance', 'Couples Budget', 'PROFESSIONAL'],
  ['beginner-budget', 'personal-finance', 'Beginner Budget', 'BASIC'],
  ['adhd-friendly-budget', 'personal-finance', 'ADHD-Friendly Budget', 'PROFESSIONAL'],
  ['debt-payoff-tracker', 'personal-finance', 'Debt Payoff Tracker', 'PROFESSIONAL'],
  ['debt-snowball-planner', 'personal-finance', 'Debt Snowball Planner', 'PROFESSIONAL'],
  ['savings-goal-tracker', 'personal-finance', 'Savings Goal Tracker', 'PROFESSIONAL'],
  ['sinking-funds-tracker', 'personal-finance', 'Sinking Funds Tracker', 'PROFESSIONAL'],
  ['bill-calendar-tracker', 'personal-finance', 'Bill Calendar and Bill Tracker', 'PROFESSIONAL'],
  ['net-worth-tracker', 'personal-finance', 'Net Worth Tracker', 'PROFESSIONAL'],
  ['income-expense-tracker', 'personal-finance', 'Income and Expense Tracker', 'BASIC'],
  ['financial-goals-planner', 'personal-finance', 'Financial Goals Planner', 'PROFESSIONAL'],
  ['subscription-tracker', 'personal-finance', 'Subscription Tracker', 'BASIC'],
  ['emergency-fund-planner', 'personal-finance', 'Emergency Fund Planner', 'PROFESSIONAL'],
  ['small-business-bookkeeping', 'small-business', 'Small Business Bookkeeping Spreadsheet', 'PROFESSIONAL'],
  ['business-income-expense-tracker', 'small-business', 'Business Income and Expense Tracker', 'BASIC'],
  ['profit-loss-dashboard', 'small-business', 'Profit and Loss Dashboard', 'PROFESSIONAL'],
  ['sales-tracker', 'small-business', 'Sales Tracker', 'BASIC'],
  ['sales-profit-tracker', 'small-business', 'Sales and Profit Tracker', 'PROFESSIONAL'],
  ['pricing-calculator', 'small-business', 'Pricing Calculator', 'PROFESSIONAL'],
  ['invoice-payment-tracker', 'small-business', 'Invoice and Payment Tracker', 'PROFESSIONAL'],
  ['multiple-account-bookkeeping', 'small-business', 'Multiple Account Bookkeeping', 'ULTIMATE'],
  ['freelancer-finance-dashboard', 'small-business', 'Freelancer Finance Dashboard', 'PROFESSIONAL'],
  ['self-employed-income-tracker', 'small-business', 'Self-Employed Income Tracker', 'PROFESSIONAL'],
  ['client-project-profitability', 'small-business', 'Client and Project Profitability Tracker', 'ULTIMATE'],
  ['cashflow-forecast', 'small-business', 'Cashflow Forecast', 'PROFESSIONAL'],
  ['expense-categorization-workbook', 'small-business', 'Expense Categorization Workbook', 'PROFESSIONAL'],
  ['business-budget-planner', 'small-business', 'Business Budget Planner', 'PROFESSIONAL'],
  ['simple-business-crm', 'small-business', 'Simple Business CRM Spreadsheet', 'PROFESSIONAL'],
  ['project-management-spreadsheet', 'projects-productivity', 'Project Management Spreadsheet', 'ULTIMATE'],
  ['project-planner', 'projects-productivity', 'Project Planner', 'PROFESSIONAL'],
  ['task-tracker', 'projects-productivity', 'Task Tracker', 'BASIC'],
  ['daily-task-planner', 'projects-productivity', 'Daily Task Planner', 'BASIC'],
  ['team-task-tracker', 'projects-productivity', 'Team Task Tracker', 'PROFESSIONAL'],
  ['gantt-chart-planner', 'projects-productivity', 'Gantt Chart Planner', 'PROFESSIONAL'],
  ['kanban-project-board', 'projects-productivity', 'Kanban Project Board', 'PROFESSIONAL'],
  ['eisenhower-priority-matrix', 'projects-productivity', 'Eisenhower Priority Matrix', 'BASIC'],
  ['project-timeline', 'projects-productivity', 'Project Timeline', 'PROFESSIONAL'],
  ['project-budget-cost-tracker', 'projects-productivity', 'Project Budget and Cost Tracker', 'PROFESSIONAL'],
  ['project-risk-register', 'projects-productivity', 'Project Risk Register', 'PROFESSIONAL'],
  ['project-status-dashboard', 'projects-productivity', 'Project Status Dashboard', 'PROFESSIONAL'],
  ['content-planner', 'projects-productivity', 'Content Planner', 'PROFESSIONAL'],
  ['social-media-content-calendar', 'projects-productivity', 'Social Media Content Calendar', 'PROFESSIONAL'],
  ['habit-tracker', 'projects-productivity', 'Habit Tracker', 'BASIC'],
  ['goal-planner', 'projects-productivity', 'Goal Planner', 'BASIC'],
  ['weekly-productivity-planner', 'projects-productivity', 'Weekly Productivity Planner', 'BASIC'],
  ['workload-planner', 'projects-productivity', 'Workload Planner', 'PROFESSIONAL'],
  ['meeting-action-tracker', 'projects-productivity', 'Meeting and Action Tracker', 'PROFESSIONAL'],
  ['launch-planner', 'projects-productivity', 'Launch Planner', 'PROFESSIONAL'],
  ['wedding-planning-spreadsheet', 'wedding-event', 'Wedding Planning Spreadsheet', 'ULTIMATE'],
  ['wedding-budget-planner', 'wedding-event', 'Wedding Budget Planner', 'PROFESSIONAL'],
  ['wedding-guest-list', 'wedding-event', 'Wedding Guest List', 'BASIC'],
  ['wedding-rsvp-tracker', 'wedding-event', 'Wedding RSVP Tracker', 'BASIC'],
  ['wedding-vendor-tracker', 'wedding-event', 'Wedding Vendor Tracker', 'PROFESSIONAL'],
  ['wedding-timeline', 'wedding-event', 'Wedding Timeline', 'PROFESSIONAL'],
  ['wedding-checklist', 'wedding-event', 'Wedding Checklist', 'BASIC'],
  ['seating-plan-data-workbook', 'wedding-event', 'Seating Plan Data Workbook', 'PROFESSIONAL'],
  ['wedding-payment-schedule', 'wedding-event', 'Wedding Payment Schedule', 'PROFESSIONAL'],
  ['complete-wedding-planner-bundle', 'wedding-event', 'Complete Wedding Planner Bundle', 'ULTIMATE'],
  ['event-planning-spreadsheet', 'wedding-event', 'Event Planning Spreadsheet', 'PROFESSIONAL'],
  ['party-planning-budget', 'wedding-event', 'Party Planning Budget', 'BASIC'],
  ['event-guest-rsvp-tracker', 'wedding-event', 'Event Guest and RSVP Tracker', 'PROFESSIONAL'],
  ['vendor-comparison-workbook', 'wedding-event', 'Vendor Comparison Workbook', 'PROFESSIONAL'],
  ['event-timeline-checklist', 'wedding-event', 'Event Timeline and Checklist', 'PROFESSIONAL'],
  ['co-parenting-planner', 'life-family', 'Co-Parenting Planner', 'PROFESSIONAL'],
  ['custody-schedule', 'life-family', 'Custody Schedule', 'PROFESSIONAL'],
  ['shared-expense-tracker', 'life-family', 'Shared Expense Tracker', 'PROFESSIONAL'],
  ['child-support-payment-log', 'life-family', 'Child Support Payment Log', 'BASIC'],
  ['household-management-planner', 'life-family', 'Household Management Planner', 'ULTIMATE'],
  ['home-maintenance-tracker', 'life-family', 'Home Maintenance Tracker', 'PROFESSIONAL'],
  ['meal-grocery-budget-planner', 'life-family', 'Meal and Grocery Budget Planner', 'PROFESSIONAL'],
  ['family-schedule', 'life-family', 'Family Schedule', 'PROFESSIONAL'],
  ['moving-planner', 'life-family', 'Moving Planner', 'PROFESSIONAL'],
  ['travel-budget-planner', 'life-family', 'Travel Budget Planner', 'PROFESSIONAL'],
  ['christmas-budget-planner', 'life-family', 'Christmas Budget Planner', 'PROFESSIONAL'],
  ['student-budget-planner', 'life-family', 'Student Budget Planner', 'BASIC'],
  ['college-finance-planner', 'life-family', 'College Finance Planner', 'PROFESSIONAL'],
  ['adhd-friendly-life-planner', 'life-family', 'ADHD-Friendly Life Planner', 'PROFESSIONAL'],
  ['personal-organization-dashboard', 'life-family', 'Personal Organization Dashboard', 'ULTIMATE'],
]);

const ACTIVE_RUNTIME_PRODUCTS = Object.freeze(new Set([
  'simple-monthly-budget',
  'annual-budget-spreadsheet',
  'ultimate-finance-dashboard',
  'paycheck-budget-spreadsheet',
  'debt-payoff-tracker',
  'debt-snowball-planner',
  'savings-goal-tracker',
  'subscription-tracker',
  'small-business-bookkeeping',
  'project-management-spreadsheet',
  'wedding-planning-spreadsheet',
]));

const familyFeatureProfiles = Object.freeze({
  'personal-finance': ['auditable-formulas', 'budget-vs-actual', 'goal-progress', 'visible-checks'],
  'small-business': ['transaction-register', 'profitability-kpis', 'invoice-controls', 'visible-checks'],
  'projects-productivity': ['ownership', 'status-controls', 'timeline', 'risk-visibility'],
  'wedding-event': ['guest-workflow', 'vendor-workflow', 'payment-schedule', 'wedding-timeline'],
  'life-family': ['shared-planning', 'schedule', 'expense-visibility', 'low-friction-onboarding'],
});

const freeze = value => Object.freeze(value);
const deepFreeze = value => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

function buildDefinition([id, family, productName, tier]) {
  const profile = FAMILY_PROFILES[family];
  const weddingStatus = family === 'wedding-event' && id !== 'wedding-planning-spreadsheet' ? 'MARKET_VALIDATION_REQUIRED' : null;
  return deepFreeze({
    id,
    family,
    productName,
    slug: id,
    tier,
    locales: [...LOCALES],
    platformProfiles: [...PLATFORM_PROFILES],
    themes: [...THEMES],
    modules: [...profile.modules],
    sheets: [...profile.sheets],
    features: [...familyFeatureProfiles[family]],
    formulas: ['formula-driven-calculations', 'bounded-cross-sheet-references', 'division-by-zero-guards'],
    validations: ['required-inputs', 'typed-dates-and-amounts', 'controlled-status-values', 'formula-reference-integrity'],
    charts: tier === 'BASIC' ? [] : ['dashboard-kpi-summary', 'status-or-trend-visual'],
    categories: [...profile.categories],
    sampleDataProfile: 'fictional-safe-domain-examples-v1',
    onboardingProfile: tier === 'ULTIMATE' ? 'guided-onboarding-extended-v1' : 'guided-onboarding-core-v1',
    compatibilityProfile: { excel: 'STRUCTURAL_VALIDATION_REQUIRED', googleSheets: 'PROVISIONAL_IMPORT_CHECKLIST_REQUIRED', dualPlatformClaimAllowed: false },
    listingProfile: `listingview-2026-07-20-${family}-v1`,
    pricingProfile: `evidence-band-${tier.toLowerCase()}-v1`,
    imagePlanProfile: tier === 'ULTIMATE' ? 'etsy-ten-image-ultimate-v1' : 'etsy-ten-image-core-v1',
    disclaimers: [...profile.disclaimers],
    releaseStatus: weddingStatus ?? (ACTIVE_RUNTIME_PRODUCTS.has(id) ? 'RELEASE_CANDIDATE' : 'PLANNED'),
  });
}

export const portfolioProductDefinitions = freeze(PORTFOLIO_ROWS.map(buildDefinition));
export const portfolioProductById = freeze(Object.fromEntries(portfolioProductDefinitions.map(definition => [definition.id, definition])));
export const portfolioFamilies = freeze(Object.keys(FAMILY_PROFILES));

const REQUIRED_FIELDS = Object.freeze(['id', 'family', 'productName', 'slug', 'tier', 'locales', 'platformProfiles', 'themes', 'modules', 'sheets', 'features', 'formulas', 'validations', 'charts', 'categories', 'sampleDataProfile', 'onboardingProfile', 'compatibilityProfile', 'listingProfile', 'pricingProfile', 'imagePlanProfile', 'disclaimers', 'releaseStatus']);

export function validatePortfolioCatalog(definitions = portfolioProductDefinitions) {
  const errors = [];
  const ids = new Set();
  for (const definition of definitions) {
    for (const field of REQUIRED_FIELDS) if (!(field in definition)) errors.push({ code: 'MISSING_FIELD', productId: definition.id ?? null, field });
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(definition.id ?? '')) errors.push({ code: 'INVALID_ID', productId: definition.id ?? null });
    if (ids.has(definition.id)) errors.push({ code: 'DUPLICATE_ID', productId: definition.id });
    ids.add(definition.id);
    if (!FAMILY_PROFILES[definition.family]) errors.push({ code: 'UNKNOWN_FAMILY', productId: definition.id, family: definition.family });
    if (!['BASIC', 'PROFESSIONAL', 'ULTIMATE'].includes(definition.tier)) errors.push({ code: 'INVALID_TIER', productId: definition.id, tier: definition.tier });
    if (definition.platformProfiles.includes('dual-platform') && !definition.compatibilityProfile.dualPlatformClaimAllowed) errors.push({ code: 'UNPROVEN_DUAL_PLATFORM_CLAIM', productId: definition.id });
    if (!definition.modules.length || !definition.sheets.length || !definition.validations.length) errors.push({ code: 'INCOMPLETE_DEFINITION', productId: definition.id });
  }
  return freeze({ status: errors.length ? 'FAIL' : 'PASS', productCount: definitions.length, familyCount: new Set(definitions.map(definition => definition.family)).size, errors: freeze(errors) });
}

export default portfolioProductDefinitions;
