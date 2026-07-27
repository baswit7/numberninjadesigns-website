const severityAliases = {
  ok: "success",
  success: "success",
  ready: "success",
  healthy: "success",
  warning: "warning",
  "not-configured": "warning",
  error: "error",
  failed: "error",
  critical: "critical",
  info: "info",
  unknown: "unknown"
};

const viewNames = [
  "summary",
  "projects",
  "providers",
  "health",
  "telemetry",
  "events",
  "contracts",
  "deployments",
  "documentation",
  "operationalHealth",
  "trends",
  "changes",
  "risk",
  "maturity",
  "governance",
  "executiveSummary",
  "explainability",
  "confidence",
  "governanceScore",
  "compliance",
  "releaseReadiness",
  "qualityGates",
  "exceptions",
  "governanceDrift",
  "executionReadiness",
  "authority",
  "authorityProjectionMonitoring",
  "authorityMonitoringEvidence",
  "apiGovernance",
  "marketIntelligence"
];

function normalizeSeverity(value, fallback = "unknown") {
  const key = String(value || fallback).toLowerCase();
  return severityAliases[key] || fallback;
}

function normalizeCard(card, index, viewName) {
  const safeCard = card && typeof card === "object" ? card : {};
  const details = safeCard.details && typeof safeCard.details === "object" ? safeCard.details : {};
  const status = String(safeCard.status || details.status || "unknown");
  const severity = normalizeSeverity(safeCard.severity || status);

  return {
    id: String(safeCard.id || `${viewName}.${index}`),
    title: String(safeCard.title || "Unknown item"),
    status,
    severity,
    description: String(safeCard.description || "No description available from dashboard adapter."),
    sourceFile: String(safeCard.sourceFile || "runtime/dashboard"),
    lastUpdated: String(safeCard.lastUpdated || ""),
    actionHint: String(safeCard.actionHint || details.nextAction || "No dashboard action available."),
    details,
    raw: safeCard
  };
}

function createUnknownView(viewName, errorMessage) {
  return {
    name: viewName,
    generatedAt: "",
    source: `studio-dashboard:${viewName}`,
    status: "unknown",
    severity: "unknown",
    summary: errorMessage || "Dashboard view model is missing or unreadable.",
    cards: [],
    warnings: errorMessage ? [errorMessage] : [],
    errors: [],
    nextRecommendedAction: "Regenerate dashboard view models through the Runtime Console.",
    loaded: false,
    error: errorMessage || ""
  };
}

function normalizeView(viewName, payload, loadError) {
  if (loadError || !payload || typeof payload !== "object") {
    return createUnknownView(viewName, loadError || "Invalid dashboard view model.");
  }

  const cards = Array.isArray(payload.cards)
    ? payload.cards.map((card, index) => normalizeCard(card, index, viewName))
    : [];

  const status = String(payload.status || "unknown");
  return {
    name: viewName,
    generatedAt: String(payload.generatedAt || ""),
    source: String(payload.source || `studio-dashboard:${viewName}`),
    status,
    severity: normalizeSeverity(payload.severity || status),
    summary: String(payload.summary || "No summary available from dashboard adapter."),
    cards,
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map(String) : [],
    errors: Array.isArray(payload.errors) ? payload.errors.map(String) : [],
    nextRecommendedAction: String(payload.nextRecommendedAction || "No recommended action available."),
    loaded: true,
    error: "",
    raw: payload
  };
}

export function createDashboardState() {
  const state = {
    views: {},
    errors: [],
    filter: "all",
    lastLoadStartedAt: "",
    lastLoadCompletedAt: ""
  };

  viewNames.forEach((viewName) => {
    state.views[viewName] = createUnknownView(viewName);
  });

  return state;
}

export function setLoadedViews(state, loadedViews) {
  state.errors = [];
  state.lastLoadCompletedAt = new Date().toISOString();

  viewNames.forEach((viewName) => {
    if (!Object.prototype.hasOwnProperty.call(loadedViews, viewName)) {
      state.views[viewName] = createUnknownView(viewName);
      return;
    }

    const loaded = loadedViews[viewName] || {};
    const normalized = normalizeView(viewName, loaded.data, loaded.error);
    state.views[viewName] = normalized;
    if (normalized.error) {
      state.errors.push(`${viewName}: ${normalized.error}`);
    }
  });

  return state;
}

export function setFilter(state, filter) {
  state.filter = filter || "all";
  return state;
}

export function getFilteredCards(state, viewName) {
  const view = state.views[viewName] || createUnknownView(viewName);
  if (state.filter === "all") {
    return view.cards;
  }
  return view.cards.filter((card) => card.severity === state.filter || card.status === state.filter);
}

export function getGlobalStatus(state) {
  const summary = state.views.summary;
  const summaryCards = summary.cards || [];
  const cardDetails = summaryCards.reduce((accumulator, card) => {
    accumulator[card.id] = card.details || {};
    return accumulator;
  }, {});

  const totals = Object.values(state.views).reduce(
    (accumulator, view) => {
      accumulator.warnings += view.warnings.length;
      accumulator.errors += view.errors.length;
      view.cards.forEach((card) => {
        if (card.severity === "warning") accumulator.warnings += 1;
        if (card.severity === "error" || card.severity === "critical") accumulator.errors += 1;
      });
      return accumulator;
    },
    { warnings: 0, errors: 0 }
  );

  const projectCount = state.views.projects.cards.length || cardDetails["summary.projects"]?.cards || 0;
  const providerCount = state.views.providers.cards.length || cardDetails["summary.providers"]?.cards || 0;

  return {
    status: summary.status || "unknown",
    generatedAt: summary.generatedAt || "",
    runtimeVersion: summary.raw?.runtimeVersion || "not reported",
    warnings: totals.warnings,
    errors: totals.errors,
    providers: providerCount,
    projects: projectCount
  };
}

export function getLoaderSummary(state) {
  const loadedCount = Object.values(state.views).filter((view) => view.loaded).length;
  const totalCount = viewNames.length;
  if (state.errors.length > 0) {
    return `${loadedCount}/${totalCount} view models loaded. ${state.errors.length} loader issue(s).`;
  }
  return `${loadedCount}/${totalCount} view models loaded. Read-only mode active.`;
}

export { viewNames, normalizeSeverity };
