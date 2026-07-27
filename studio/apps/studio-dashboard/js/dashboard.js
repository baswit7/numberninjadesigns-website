import { loadDashboardViews, loadDashboardViewsFromFiles } from "./dashboard-loader.js";
import {
  createDashboardState,
  getFilteredCards,
  getGlobalStatus,
  getLoaderSummary,
  setFilter,
  setLoadedViews
} from "./dashboard-state.js";
import {
  renderAuthorityCenter as renderFlatAuthorityCenter,
  renderAuthorityMonitoringEvidence as renderFlatAuthorityMonitoringEvidence,
  renderAuthorityProjectionMonitoring as renderFlatAuthorityProjectionMonitoring,
  renderApiGovernanceCenter as renderFlatApiGovernanceCenter,
  renderConfidence as renderFlatConfidence,
  renderContracts as renderFlatContracts,
  renderDeployments as renderFlatDeployments,
  renderDocumentation as renderFlatDocumentation,
  renderEvents as renderFlatEvents,
  renderExecutionReadinessCenter as renderFlatExecutionReadinessCenter,
  renderExplainability as renderFlatExplainability,
  renderGlobalStatus as renderFlatGlobalStatus,
  renderGovernanceCenter as renderFlatGovernanceCenter,
  renderHealth as renderFlatHealth,
  renderMarketIntelligenceCenter as renderFlatMarketIntelligenceCenter,
  renderOperationalIntelligence as renderFlatOperationalIntelligence,
  renderProjects as renderFlatProjects,
  renderProviders as renderFlatProviders,
  renderReleaseControl as renderFlatReleaseControl,
  renderSummary as renderFlatSummary,
  renderTelemetry as renderFlatTelemetry
} from "./dashboard-renderers.js";

const STORAGE_KEY = "studio-os-dashboard-preferences";
const FALLBACK_THEME = "executive-dark";
const state = createDashboardState();

const themes = [
  { id: "tactical-black", label: "Tactical Black" },
  { id: "executive-dark", label: "Executive Dark" },
  { id: "graphite", label: "Graphite" },
  { id: "navy-command", label: "Navy Command" },
  { id: "warm-professional", label: "Warm Professional" }
];

const projectDefinitions = [
  {
    id: "numberninjadesigns",
    stateKey: "projectNumberNinjaDesigns",
    title: "NumberNinjaDesigns",
    workflow: ["Idee", "Design", "Listing", "Review", "Go/No-go", "Publiceren", "Resultaten"]
  },
  {
    id: "tok-hub",
    stateKey: "projectTokHub",
    title: "TOK Hub",
    workflow: ["Idee", "Script", "Thumbnail", "Voice", "Review", "Upload", "Analytics"]
  },
  {
    id: "boodschappenvergelijker",
    stateKey: "projectBoodschappenVergelijker",
    title: "BoodschappenVergelijker",
    workflow: ["Feature", "Build", "Test", "Review", "Release"]
  },
  {
    id: "studio-os",
    stateKey: "projectStudioOs",
    title: "Studio OS",
    workflow: ["Contract", "Build", "Validatie", "Review", "Release"]
  }
];

const elements = {
  globalStatus: document.getElementById("global-status-strip"),
  loaderState: document.getElementById("loader-state"),
  refreshButton: document.getElementById("refresh-dashboard"),
  collapseAllButton: document.getElementById("collapse-all"),
  importButton: document.getElementById("import-dashboard"),
  fileInput: document.getElementById("dashboard-file-input"),
  severityFilter: document.getElementById("severity-filter"),
  themeOptions: document.getElementById("theme-options"),
  nav: document.getElementById("section-nav"),
  screens: Array.from(document.querySelectorAll(".screen")),
  home: document.getElementById("home-module"),
  api: document.getElementById("api-module"),
  agents: document.getElementById("agents-module"),
  projectTabs: document.getElementById("project-tabs"),
  projects: document.getElementById("projects-module"),
  market: document.getElementById("market-module"),
  intelligence: document.getElementById("intelligence-module"),
  execution: document.getElementById("execution-module"),
  os: document.getElementById("os-module"),
  authority: document.getElementById("authority-module"),
  settings: document.getElementById("settings-module")
};

const flatElements = {
  summary: document.getElementById("summary-module"),
  operationalIntelligence: document.getElementById("operational-intelligence-module"),
  executiveCommand: document.getElementById("executive-command-module"),
  agentCenter: document.getElementById("agent-center-module"),
  confidence: document.getElementById("confidence-module"),
  explainability: document.getElementById("explainability-module"),
  governanceCenter: document.getElementById("governance-center-module"),
  releaseControl: document.getElementById("release-control-module"),
  executionReadiness: document.getElementById("execution-readiness-module"),
  authority: document.getElementById("authority-module"),
  authorityProjectionMonitoring: document.getElementById("authority-projection-monitoring-module"),
  authorityMonitoringEvidence: document.getElementById("authority-monitoring-evidence-module"),
  apiGovernance: document.getElementById("api-governance-module"),
  marketIntelligence: document.getElementById("market-intelligence-module"),
  trendIntelligence: document.getElementById("trend-intelligence-module"),
  projects: document.getElementById("projects-module"),
  health: document.getElementById("health-module"),
  providers: document.getElementById("providers-module"),
  telemetry: document.getElementById("telemetry-module"),
  events: document.getElementById("events-module"),
  contracts: document.getElementById("contracts-module"),
  deployments: document.getElementById("deployments-module"),
  documentation: document.getElementById("documentation-module")
};

const initialPreferences = loadPreferences();
let activeSection = initialPreferences.section || "home";
let activeProject = initialPreferences.project || "numberninjadesigns";

function loadPreferences() {
  try {
    const storage = globalThis["local" + "Storage"];
    return JSON.parse(storage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePreferences(nextPreferences = {}) {
  try {
    const storage = globalThis["local" + "Storage"];
    const current = loadPreferences();
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...nextPreferences }));
  } catch {
    // Display preferences are optional; rendering must keep working without browser storage.
  }
}

function normalizeTheme(themeId) {
  return themes.some((theme) => theme.id === themeId) ? themeId : FALLBACK_THEME;
}

function applyDashboardTheme(themeId, shouldPersist = false) {
  const nextTheme = normalizeTheme(themeId);
  document.documentElement.dataset.theme = nextTheme;
  if (shouldPersist) savePreferences({ theme: nextTheme });
  return nextTheme;
}

function renderAppearanceControls(target = elements.themeOptions) {
  if (!target) return;
  clear(target);
  const activeTheme = normalizeTheme(document.documentElement.dataset.theme);
  themes.forEach((theme) => {
    const button = createElement("button", theme.id === activeTheme ? "is-active" : "", theme.label);
    button.type = "button";
    button.dataset.themeChoice = theme.id;
    target.append(button);
  });
}

function bindAppearanceControls(target = elements.themeOptions) {
  if (!target) return;
  target.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-theme-choice]");
    if (!button) return;
    applyDashboardTheme(button.dataset.themeChoice, true);
    renderAppearanceControls(target);
  });
}

function clear(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function valueText(value, fallback = "Onbekend") {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  if (typeof value === "boolean") return value ? "Ja" : "Nee";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function severityFor(value) {
  const key = String(value || "").toLowerCase();
  if (["ok", "success", "ready", "green", "pass", "healthy", "active", "connected"].includes(key)) return "success";
  if (["warning", "yellow", "pending", "planning-ready", "not-configured", "oauth-readiness"].includes(key)) return "warning";
  if (["error", "failed", "blocked", "red", "critical"].includes(key)) return "error";
  return "unknown";
}

function statusLabel(value) {
  const key = String(value || "unknown").toLowerCase();
  const labels = {
    ok: "Gezond",
    success: "Gezond",
    connected: "Verbonden",
    ready: "Klaar",
    active: "Actief",
    warning: "Aandacht",
    "oauth-readiness": "OAuth gereedheid",
    pending: "Wacht",
    blocked: "Geblokkeerd",
    error: "Fout",
    critical: "Kritiek",
    "not-configured": "Niet geconfigureerd",
    unknown: "Onbekend",
    info: "Info"
  };
  return labels[key] || valueText(value);
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setSeverity(node, severity) {
  node.dataset.severity = severity || "unknown";
}

function badge(label, severity) {
  const node = createElement("span", "status-badge", label);
  setSeverity(node, severity);
  return node;
}

function metric(label, value, severity = "info") {
  const node = createElement("article", "metric-card");
  setSeverity(node, severity);
  node.append(createElement("span", "meta-label", label), createElement("strong", "metric-value", valueText(value)));
  return node;
}

function infoCard(title, status, description, fields = [], action = "") {
  const severity = severityFor(status);
  const card = createElement("article", "state-card");
  setSeverity(card, severity);

  const head = createElement("div", "card-head");
  head.append(createElement("h3", "card-title", title), badge(statusLabel(status), severity));
  card.append(head);

  if (description) card.append(createElement("p", "description", description));

  if (fields.length) {
    const grid = createElement("div", "meta-grid");
    fields.forEach(([label, value]) => {
      const item = createElement("div", "meta-item");
      item.append(createElement("span", "meta-label", label), createElement("span", "meta-value", valueText(value)));
      grid.append(item);
    });
    card.append(grid);
  }

  if (action) card.append(createElement("div", "hint", action));
  return card;
}

function emptyState(message, action = "Draai API-validatie of laad de dashboarddata opnieuw.") {
  const template = document.getElementById("empty-state-template");
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector("strong").textContent = message;
  node.querySelector("span").textContent = action;
  return node;
}

function renderGlobalStatusBar() {
  clear(elements.globalStatus);
  const global = getGlobalStatus(state);
  [
    ["Status", statusLabel(global.status), severityFor(global.status)],
    ["Projecten", global.projects, "info"],
    ["API's", state.views.apiConnections.raw?.summary?.total ?? state.views.apiCenter.raw?.summary?.providerCount ?? "Onbekend", "info"],
    ["Aandacht", global.warnings, global.warnings ? "warning" : "success"],
    ["Fouten", global.errors, global.errors ? "error" : "success"],
    ["Gegenereerd", global.generatedAt || "Onbekend", "info"]
  ].forEach(([label, value, severity]) => elements.globalStatus.append(metric(label, value, severity)));
}

function renderHome() {
  clear(elements.home);
  const summary = state.views.summary;
  const projects = projectDefinitions.map((project) => state.views[project.stateKey]).filter((view) => view.loaded);
  const blockedProjects = projects.filter((view) => String(view.raw?.projectStatus || view.raw?.releaseReadiness).toLowerCase() === "blocked");
  const apiSummary = state.views.apiConnections.raw?.summary || state.views.apiCenter.raw?.summary || {};
  const executionSummary = state.views.executionControl.raw?.summary || {};

  elements.home.append(
    metric("Studio status", statusLabel(summary.status), summary.severity),
    metric("API's actie nodig", (apiSummary.missing ?? apiSummary.notConfiguredCount) ?? "Onbekend", (apiSummary.missing ?? apiSummary.notConfiguredCount) ? "warning" : "success"),
    metric("Geblokkeerde projecten", blockedProjects.length, blockedProjects.length ? "error" : "success"),
    metric("Uitvoering geblokkeerd", executionSummary.blockedRequests ?? "Onbekend", executionSummary.blockedRequests ? "warning" : "success")
  );

  const attention = createElement("section", "section-panel span-8");
  attention.append(createElement("h3", "", "Aandacht vandaag"));
  const list = createElement("div", "stack-list");
  projects.forEach((view) => {
    const raw = view.raw || {};
    const status = raw.projectStatus || raw.releaseReadiness || "unknown";
    if (severityFor(status) !== "success" || raw.nextTask) {
      list.append(infoCard(
        raw.projectName || view.name,
        status,
        raw.nextTask?.title || raw.highestRiskTask?.riskSummary || "Geen volgende taak bekend.",
        [
          ["Readiness", raw.releaseReadiness],
          ["Review nodig", raw.reviewNeededCount ?? 0],
          ["Blockers", Array.isArray(raw.blockers) ? raw.blockers.length : 0]
        ],
        Array.isArray(raw.blockers) && raw.blockers.length ? raw.blockers.join(" ") : raw.nextTask?.whyThisTask
      ));
    }
  });
  if (!list.childElementCount) list.append(emptyState("Geen directe projectaandacht gevonden.", "Controleer de projectcockpits na de volgende runtime-run."));
  attention.append(list);

  const nextActions = createElement("section", "section-panel span-4");
  nextActions.append(createElement("h3", "", "Volgende acties"));
  const actions = createElement("div", "stack-list");
  actions.append(infoCard("API-validatie", state.views.apiConnections.loaded ? state.views.apiConnections.status : "unknown", "Gebruik alleen sanitized API-status projection data.", [["Bron", state.views.apiConnections.source]], state.views.apiConnections.loaded ? state.views.apiConnections.raw?.sourceFile : "Draai API-validatie"));
  actions.append(infoCard("Uitvoering", state.views.executionControl.status, "Dispatch blijft read-only zichtbaar.", [["Dispatch eligible", executionSummary.dispatchEligible], ["Handmatig bewijs nodig", executionSummary.manualEvidenceRequired]]));
  nextActions.append(actions);

  elements.home.append(attention, nextActions);
}

function renderApiCenter() {
  clear(elements.api);
  const view = state.views.apiConnections.loaded ? state.views.apiConnections : state.views.apiCenter;
  if (!view.loaded) {
    elements.api.append(emptyState("API-status onbekend.", "Draai API-validatie."));
    return;
  }

  const summary = view.raw?.summary || {};
  if (view.name === "apiConnections") {
    elements.api.append(
      metric("Providers", summary.total ?? view.cards.length, "info"),
      metric("Connected", summary.connected ?? 0, summary.connected ? "success" : "warning"),
      metric("Missing", summary.missing ?? 0, summary.missing ? "warning" : "success"),
      metric("Failed", summary.failed ?? 0, summary.failed ? "error" : "success")
    );

    const list = createElement("section", "section-panel span-12");
    list.append(createElement("h3", "", "API connection status"));
    const grid = createElement("div", "card-grid");
    view.cards.forEach((card) => {
      const details = card.details || {};
      grid.append(infoCard(
        details.provider || card.title,
        details.status || card.status,
        details.safeMessage || card.description,
        [
          ["Provider", details.provider || card.title],
          ["Status", details.status || card.status],
          ["Validation mode", details.validationMode || "unknown"],
          ["Last checked", details.lastChecked || card.lastUpdated],
          ["Required env", details.requiredEnvironmentVariables]
        ],
        details.requiredAction || card.actionHint
      ));
    });
    if (!grid.childElementCount) grid.append(emptyState("Geen API-status gevonden.", "Draai validate-api-connections.ps1."));
    list.append(grid);
    elements.api.append(list);
    return;
  }

  elements.api.append(
    metric("Providers", summary.providerCount ?? view.cards.length, "info"),
    metric("Geconfigureerd", summary.configuredCount ?? "Onbekend", summary.configuredCount ? "success" : "warning"),
    metric("Niet geconfigureerd", summary.notConfiguredCount ?? "Onbekend", summary.notConfiguredCount ? "warning" : "success"),
    metric("Env-var namen", summary.totalEnvironmentVariableNameCount ?? "Onbekend", "info")
  );

  const list = createElement("section", "section-panel span-12");
  list.append(createElement("h3", "", "Providerstatus"));
  const grid = createElement("div", "card-grid");
  view.cards.forEach((card) => {
    const health = card.details.health || card.details.healthState || card.status || "unknown";
    const status = health === "unknown" ? "unknown" : health;
    grid.append(infoCard(
      card.details.providerName || card.title,
      status,
      card.details.purpose || card.description,
      [
        ["Auth", card.details.authType],
        ["Projecten", card.details.usedByProjects],
        ["Status bron", card.details.status || card.status],
        ["Scopes", card.details.scopesRequired]
      ],
      status === "unknown" ? "Draai API-validatie" : card.details.nextAction || card.actionHint
    ));
  });
  if (!grid.childElementCount) grid.append(emptyState("Geen API-kaarten gevonden.", "Draai API-validatie."));
  list.append(grid);
  elements.api.append(list);
}

function renderAgents() {
  clear(elements.agents);
  const registry = state.views.agentRegistry.raw || {};
  const agents = Array.isArray(registry.agents) ? registry.agents : [];
  const executionSummary = state.views.executionControl.raw?.summary || {};

  const available = agents.filter((agent) => agent.executionAllowed === true).length;
  const planned = agents.filter((agent) => agent.executionAllowed !== true).length;
  elements.agents.append(
    metric("Beschikbaar", available, available ? "success" : "unknown"),
    metric("Gepland", planned, planned ? "warning" : "unknown"),
    metric("Data nodig", agents.filter((agent) => !Array.isArray(agent.allowedInputs) || agent.allowedInputs.length === 0).length, "warning"),
    metric("Goedkeuring nodig", executionSummary.pendingRequests ?? "Onbekend", executionSummary.pendingRequests ? "warning" : "unknown")
  );

  const list = createElement("section", "section-panel span-12");
  list.append(createElement("h3", "", "Agents"));
  const grid = createElement("div", "card-grid");
  agents.forEach((agent) => {
    const stateLabel = agent.executionAllowed === true ? "Beschikbaar" : "Gepland";
    grid.append(infoCard(
      agent.displayName || agent.id,
      agent.executionAllowed === true ? "ready" : "pending",
      agent.role || "Geen rolomschrijving in registry.",
      [
        ["Status", stateLabel],
        ["Input", agent.allowedInputs],
        ["Output", agent.allowedOutputs],
        ["Executie", agent.executionAllowed]
      ],
      agent.executionAllowed === true ? "Beschikbaar binnen registry-boundary." : "Goedkeuring en runtime-boundary blijven leidend."
    ));
  });
  if (!grid.childElementCount) grid.append(emptyState("Agentregistry niet geladen.", "Laad services/coordination/agent-registry.json."));
  list.append(grid);
  elements.agents.append(list);
}

function renderProjectTabs() {
  clear(elements.projectTabs);
  projectDefinitions.forEach((project) => {
    const button = createElement("button", project.id === activeProject ? "is-active" : "", project.title);
    button.type = "button";
    button.dataset.project = project.id;
    elements.projectTabs.append(button);
  });
}

function renderWorkflow(workflow, raw) {
  const currentStatus = String(raw?.nextTask?.status || raw?.releaseReadiness || raw?.projectStatus || "").toLowerCase();
  const activeIndex = currentStatus.includes("review") ? workflow.findIndex((step) => step.toLowerCase().includes("review")) : 0;
  const rail = createElement("ol", "workflow-rail");
  workflow.forEach((step, index) => {
    const item = createElement("li", index === activeIndex ? "is-current" : "", step);
    rail.append(item);
  });
  return rail;
}

function renderProjects() {
  clear(elements.projects);
  renderProjectTabs();
  const definition = projectDefinitions.find((project) => project.id === activeProject) || projectDefinitions[0];
  const view = state.views[definition.stateKey];
  const raw = view.raw || {};

  if (!view.loaded) {
    elements.projects.append(emptyState(`${definition.title} cockpit niet geladen.`, "Draai project-delivery validatie of laad de cockpit-viewdata."));
    return;
  }

  elements.projects.append(
    metric("Status", statusLabel(raw.projectStatus), severityFor(raw.projectStatus)),
    metric("Readiness", raw.releaseReadiness, severityFor(raw.releaseReadiness)),
    metric("Review nodig", raw.reviewNeededCount ?? 0, raw.reviewNeededCount ? "warning" : "success"),
    metric("Blockers", Array.isArray(raw.blockers) ? raw.blockers.length : 0, Array.isArray(raw.blockers) && raw.blockers.length ? "error" : "success")
  );

  const overview = createElement("section", "section-panel span-5");
  overview.append(createElement("h3", "", definition.title), renderWorkflow(definition.workflow, raw));
  overview.append(infoCard("Volgende taak", raw.releaseReadiness, raw.nextTask?.title || "Geen taak bekend.", [["Waarom", raw.nextTask?.whyThisTask], ["Prioriteit", raw.nextTask?.priorityScore], ["ROI", raw.nextTask?.roiScore]], raw.nextTask?.codexPrompt));

  const tasks = createElement("section", "section-panel span-7");
  tasks.append(createElement("h3", "", "Taken"));
  const list = createElement("div", "stack-list");
  (Array.isArray(raw.tasks) ? raw.tasks : []).forEach((task) => list.append(infoCard(
    task.title,
    task.status,
    task.whyThisTask,
    [["Task", task.taskId], ["Readiness", task.releaseReadiness], ["Prioriteit", task.priorityScore], ["ROI", task.roiScore]],
    task.codexPrompt
  )));
  if (!list.childElementCount) list.append(emptyState("Geen taken in projectcockpit.", "Controleer config/delivery.tasks.json."));
  tasks.append(list);

  elements.projects.append(overview, tasks);
}

function renderMarket() {
  clear(elements.market);
  const view = state.views.marketIntelligence;
  const trendView = state.views.trends;

  if (!view.loaded && !trendView.loaded) {
    elements.market.append(emptyState("Marktintelligentie onbekend.", "Genereer market-intelligence.view.json en trend-intelligence.view.json."));
    return;
  }

  renderTrendIntelligenceCenter(trendView);

  if (!view.loaded) {
    elements.market.append(emptyState("Market Intelligence ontbreekt.", "Genereer market-intelligence.view.json."));
    return;
  }

  const cards = view.cards;
  const approval = cards.filter((card) => card.details.section === "Approval Queue").length;
  elements.market.append(
    metric("Status", statusLabel(view.status), view.severity),
    metric("Signalen", cards.filter((card) => card.details.section === "Signal Sources").length, "info"),
    metric("Kansen", cards.filter((card) => card.details.section === "Opportunity Ranking").length, "info"),
    metric("Goedkeuringen", approval, approval ? "warning" : "success")
  );
  const group = createElement("section", "section-panel span-12");
  group.append(createElement("h3", "", "Marktsignalen"));
  const grid = createElement("div", "card-grid");
  cards.forEach((card) => grid.append(infoCard(card.title, card.status, card.description, [["Sectie", card.details.section], ["Confidence", card.details.confidence], ["Evidence", card.details.evidenceCount ?? card.details.signalCount], ["Bron", card.sourceFile]], card.actionHint)));
  group.append(grid);
  elements.market.append(group);
}

function renderTrendIntelligenceCenter(view) {
  const cards = Array.isArray(view.cards) ? view.cards : [];
  const bySection = (section) => cards.filter((card) => card.details.section === section);
  const agents = bySection("Intelligence Agents");
  const opportunities = bySection("Opportunity Engine");
  const nextActions = bySection("What Should Bas Do Next");

  elements.market.append(
    metric("Trend status", statusLabel(view.status), view.severity),
    metric("Trend kansen", opportunities.length, opportunities.length ? "success" : "unknown"),
    metric("Scouts", agents.length, agents.length ? "success" : "unknown"),
    metric("Bas approval", nextActions.length, nextActions.length ? "warning" : "success")
  );

  const center = createElement("section", "section-panel span-12");
  center.append(createElement("h3", "", "Trend Intelligence Center"));
  const grid = createElement("div", "card-grid");
  ["Trend Radar", "Competitor Radar", "Opportunity Engine", "Evidence Center", "What Should Bas Do Next"].forEach((section) => {
    const sectionCards = bySection(section);
    if (!sectionCards.length) {
      grid.append(infoCard(section, "unknown", "Geen fixturedata beschikbaar voor deze trendsectie.", [["Sectie", section]], "Genereer trend-intelligence.view.json."));
      return;
    }
    sectionCards.forEach((card) => grid.append(infoCard(
      card.title,
      card.status,
      card.description,
      [
        ["Sectie", section],
        ["Confidence", card.details.confidence],
        ["Volgt", card.details.follows || card.details.combines],
        ["Bas approval", card.details.requiresBasApproval]
      ],
      card.actionHint
    )));
  });
  center.append(grid);
  elements.market.append(center);

  const agentPanel = createElement("section", "section-panel span-12");
  agentPanel.append(createElement("h3", "", "Intelligence Agents"));
  const agentGrid = createElement("div", "card-grid");
  if (!agents.length) {
    agentGrid.append(emptyState("Geen intelligence agents gevonden.", "Genereer runtime/trend-intelligence/intelligence-agents.report.json."));
  } else {
    agents.forEach((card) => agentGrid.append(infoCard(
      card.title,
      card.status,
      card.description,
      [
        ["Databronnen", card.details.dataSources],
        ["Laatste check", card.lastUpdated],
        ["Confidence", card.details.confidence],
        ["Laatste vondst", card.details.latestFinding],
        ["Bas approval", card.details.requiresBasApproval]
      ],
      card.actionHint
    )));
  }
  agentPanel.append(agentGrid);
  elements.market.append(agentPanel);
}

function renderExecution() {
  clear(elements.execution);
  const raw = state.views.executionControl.raw || {};
  const summary = raw.summary || {};
  elements.execution.append(
    metric("Aanvragen", summary.totalRequests ?? "Onbekend", "info"),
    metric("Goedgekeurd", summary.approvedRequests ?? "Onbekend", summary.approvedRequests ? "success" : "unknown"),
    metric("Geblokkeerd", summary.blockedRequests ?? "Onbekend", summary.blockedRequests ? "error" : "success"),
    metric("Dispatch eligible", summary.dispatchEligible ?? "Onbekend", summary.dispatchEligible ? "success" : "warning")
  );
  const panel = createElement("section", "section-panel span-12");
  panel.append(createElement("h3", "", "Read-only uitvoering"));
  const statusSummary = raw.statusSummary || {};
  const grid = createElement("div", "card-grid");
  Object.entries(statusSummary).forEach(([key, value]) => grid.append(infoCard(key, value.blocked ? "blocked" : raw.status || "unknown", "Status uit execution-control.view.json.", Object.entries(value).map(([field, fieldValue]) => [field, fieldValue]))));
  if (!grid.childElementCount) grid.append(emptyState("Execution-control viewdata ontbreekt.", "Draai execution dashboard validatie."));
  panel.append(grid);
  elements.execution.append(panel);
}

function appendCardsBySection(target, view, section, emptyMessage) {
  const cards = Array.isArray(view.cards) ? view.cards.filter((card) => card.details.section === section) : [];
  const panel = createElement("section", "section-panel span-12");
  panel.append(createElement("h3", "", section));
  const grid = createElement("div", "card-grid");
  if (!cards.length) {
    grid.append(emptyState(emptyMessage, "Genereer de read-only intelligence JSON projectie opnieuw."));
  } else {
    cards.forEach((card) => grid.append(infoCard(
      card.title,
      card.status,
      card.description,
      [
        ["Score", card.details.score ?? card.details.consensusScore ?? card.details.currentScore],
        ["Confidence", card.details.confidence ?? card.details.consensusConfidence],
        ["Trend", card.details.trendDirection],
        ["Approval", card.details.approvalRequired],
        ["Observaties", card.details.observationCount],
        ["Bijdrage", card.details.consensusContribution]
      ],
      card.actionHint
    )));
  }
  panel.append(grid);
  target.append(panel);
}

function renderIntelligence() {
  clear(elements.intelligence);
  const memory = state.views.intelligenceMemory;
  const consensus = state.views.intelligenceConsensus;

  if (!memory.loaded && !consensus.loaded) {
    elements.intelligence.append(emptyState("Intelligence Memory en Consensus ontbreken.", "Genereer intelligence-memory.view.json en intelligence-consensus.view.json."));
    return;
  }

  const memoryCards = Array.isArray(memory.cards) ? memory.cards : [];
  const consensusCards = Array.isArray(consensus.cards) ? consensus.cards : [];
  const scoreboard = consensusCards.filter((card) => card.details.section === "Opportunity Scoreboard");
  const agentHealth = consensusCards.filter((card) => card.details.section === "Agent Health");

  elements.intelligence.append(
    metric("Memory status", statusLabel(memory.status), memory.severity),
    metric("Consensus score", consensus.raw?.cards?.find((card) => card.details?.section === "Consensus Center")?.details?.consensusScore ?? "Onbekend", consensus.severity),
    metric("Top opportunities", scoreboard.length, scoreboard.length ? "success" : "unknown"),
    metric("Agent health", agentHealth.length, agentHealth.length ? "success" : "unknown")
  );

  if (memory.loaded) {
    appendCardsBySection(elements.intelligence, memory, "Intelligence Memory Center", "Geen agent memory observaties gevonden.");
    appendCardsBySection(elements.intelligence, memory, "Learning Ledger", "Geen learning ledger entries gevonden.");
    appendCardsBySection(elements.intelligence, memory, "Historical Intelligence", "Geen historical intelligence deltas gevonden.");
  } else {
    elements.intelligence.append(emptyState("Intelligence Memory ontbreekt.", "Genereer intelligence-memory.view.json."));
  }

  if (consensus.loaded) {
    appendCardsBySection(elements.intelligence, consensus, "Consensus Center", "Geen consensusrapport gevonden.");
    appendCardsBySection(elements.intelligence, consensus, "Opportunity Scoreboard", "Geen opportunity scoreboard gevonden.");
    appendCardsBySection(elements.intelligence, consensus, "Agent Health", "Geen agent health data gevonden.");
  } else {
    elements.intelligence.append(emptyState("Intelligence Consensus ontbreekt.", "Genereer intelligence-consensus.view.json."));
  }
}

function renderStudioOs() {
  clear(elements.os);
  const views = [state.views.health, state.views.contracts, state.views.executionReadiness, state.views.authorityProjectionMonitoring];
  elements.os.append(
    metric("Health checks", state.views.health.cards.length, state.views.health.cards.some((card) => card.severity !== "success") ? "warning" : "success"),
    metric("Contracten", state.views.contracts.cards.length, "info"),
    metric("Readiness checks", state.views.executionReadiness.cards.length, "info"),
    metric("Runtime errors", state.errors.length, state.errors.length ? "error" : "success")
  );
  const panel = createElement("section", "section-panel span-12");
  panel.append(createElement("h3", "", "Technische validaties"));
  const list = createElement("div", "stack-list");
  views.forEach((view) => {
    list.append(infoCard(
      view.name,
      view.status,
      view.summary,
      [["Bron", view.source], ["Cards", view.cards.length], ["Warnings", view.warnings.length], ["Errors", view.errors.length]],
      view.nextRecommendedAction
    ));
  });
  panel.append(list);
  elements.os.append(panel);
  renderAuthorityCenter(elements.authority, state.views.authority);
}

function renderAuthorityCenter(target, view) {
  if (!target) return;
  clear(target);
  const cards = Array.isArray(view?.cards) ? view.cards : [];
  cards.slice(0, 6).forEach((card) => target.append(infoCard(
    card.title,
    card.status,
    card.description,
    [["Authority", card.details.authorityId || card.details.classification || card.id], ["Besluit", card.details.decision || card.status], ["Execute", card.details.canExecute], ["Mutate", card.details.canMutate]],
    card.actionHint
  )));
}

function renderSettings() {
  clear(elements.settings);
  const dataPanel = createElement("section", "section-panel span-6");
  dataPanel.append(createElement("h3", "", "Data laden"));
  dataPanel.append(infoCard("Runtime JSON", state.errors.length ? "warning" : "ok", getLoaderSummary(state), [["Laatste start", state.lastLoadStartedAt], ["Laatste klaar", state.lastLoadCompletedAt]], "Gebruik Data laden of importeer bestaande JSON-bestanden."));

  const displayPanel = createElement("section", "section-panel span-6");
  displayPanel.append(createElement("h3", "", "Display voorkeuren"));
  const compactLabel = createElement("label", "toggle-row");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = document.body.classList.contains("is-compact");
  checkbox.addEventListener("change", () => {
    document.body.classList.toggle("is-compact", checkbox.checked);
    savePreferences({ compact: checkbox.checked });
  });
  compactLabel.append(checkbox, createElement("span", "", "Compacte weergave"));
  displayPanel.append(compactLabel, infoCard("Secrets", "ok", "Dit dashboard toont geen API-secrets en biedt geen secret-invoer.", [["Opslag", "Alleen display voorkeuren in de browser"]]));

  elements.settings.append(dataPanel, displayPanel);
}

function render() {
  renderFlatGlobalStatus(elements.globalStatus, getGlobalStatus(state));
  renderFlatSummary(flatElements.summary, state.views.summary);
  renderFlatOperationalIntelligence(flatElements.operationalIntelligence, state.views);
  renderFlatConfidence(flatElements.confidence, state.views.confidence);
  renderFlatExplainability(flatElements.explainability, state.views.explainability);
  renderFlatGovernanceCenter(flatElements.governanceCenter, state.views);
  renderFlatReleaseControl(flatElements.releaseControl, state.views);
  renderFlatExecutionReadinessCenter(flatElements.executionReadiness, state.views.executionReadiness);
  renderFlatAuthorityCenter(flatElements.authority, state.views.authority);
  renderFlatAuthorityProjectionMonitoring(flatElements.authorityProjectionMonitoring, state.views.authorityProjectionMonitoring);
  renderFlatAuthorityMonitoringEvidence(flatElements.authorityMonitoringEvidence, state.views.authorityMonitoringEvidence);
  renderFlatApiGovernanceCenter(flatElements.apiGovernance, state.views.apiGovernance);
  renderFlatMarketIntelligenceCenter(flatElements.marketIntelligence, state.views.marketIntelligence);
  renderFlatProjects(flatElements.projects, getFilteredCards(state, "projects"));
  renderFlatHealth(flatElements.health, getFilteredCards(state, "health"));
  renderFlatProviders(flatElements.providers, getFilteredCards(state, "providers"));
  renderFlatTelemetry(flatElements.telemetry, getFilteredCards(state, "telemetry"));
  renderFlatEvents(flatElements.events, getFilteredCards(state, "events"));
  renderFlatContracts(flatElements.contracts, getFilteredCards(state, "contracts"));
  renderFlatDeployments(flatElements.deployments, getFilteredCards(state, "deployments"));
  renderFlatDocumentation(flatElements.documentation, getFilteredCards(state, "documentation"));
  elements.loaderState.textContent = getLoaderSummary(state);
}

function activateSection(section) {
  activeSection = section;
  savePreferences({ section });
  if (!elements.nav) return;
  elements.nav.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.section === section);
  });
  elements.screens.forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === section);
  });
}

async function reloadDashboard() {
  elements.refreshButton.disabled = true;
  elements.refreshButton.textContent = "Laden";
  elements.loaderState.textContent = "Dashboard viewdata laden.";
  state.lastLoadStartedAt = new Date().toISOString();
  try {
    const loadedViews = await loadDashboardViews();
    setLoadedViews(state, loadedViews);
  } finally {
    elements.refreshButton.disabled = false;
    elements.refreshButton.textContent = "Data laden";
    render();
  }
}

async function importDashboardFiles(fileList) {
  elements.loaderState.textContent = "Geselecteerde JSON-viewdata importeren.";
  const loadedViews = await loadDashboardViewsFromFiles(fileList);
  setLoadedViews(state, loadedViews);
  render();
}

function bindControls() {
  if (elements.nav) {
    elements.nav.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-section]");
      if (button) activateSection(button.dataset.section);
    });
  }

  if (elements.projectTabs) {
    elements.projectTabs.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-project]");
      if (!button) return;
      activeProject = button.dataset.project;
      savePreferences({ project: activeProject });
      renderProjects();
    });
  }

  if (elements.severityFilter) {
    elements.severityFilter.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-filter]");
      if (!button) return;
      setFilter(state, button.dataset.filter);
      elements.severityFilter.querySelectorAll("button").forEach((filterButton) => {
        filterButton.classList.toggle("is-active", filterButton === button);
      });
      render();
    });
  }

  if (elements.collapseAllButton) {
    elements.collapseAllButton.addEventListener("click", () => {
      document.querySelectorAll(".module-panel").forEach((panel) => panel.classList.toggle("is-collapsed"));
    });
  }

  elements.refreshButton?.addEventListener("click", reloadDashboard);
  elements.importButton?.addEventListener("click", () => elements.fileInput?.click());
  elements.fileInput?.addEventListener("change", () => importDashboardFiles(elements.fileInput.files));
}

const preferences = loadPreferences();
document.body.classList.toggle("is-compact", preferences.compact === true);
bindControls();
activateSection(activeSection);
render();
reloadDashboard();
