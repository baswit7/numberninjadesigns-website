const statusColorMap = {
  success: "var(--success)",
  warning: "var(--warning)",
  error: "var(--error)",
  critical: "var(--critical)",
  info: "var(--info)",
  unknown: "var(--unknown)"
};

function clear(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function text(value, fallback = "unknown") {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function setStatusColor(node, severity) {
  node.style.setProperty("--status-color", statusColorMap[severity] || statusColorMap.unknown);
}

function createStatusBadge(card) {
  const badge = document.createElement("span");
  badge.className = "status-badge";
  badge.textContent = card.status || card.severity || "unknown";
  setStatusColor(badge, card.severity);
  return badge;
}

function createMeta(label, value) {
  const item = document.createElement("div");
  item.className = "meta-item";

  const labelNode = document.createElement("span");
  labelNode.className = "meta-label";
  labelNode.textContent = label;

  const valueNode = document.createElement("span");
  valueNode.className = "meta-value";
  valueNode.title = text(value);
  valueNode.textContent = text(value);

  item.append(labelNode, valueNode);
  return item;
}

function createEmptyState(message) {
  const template = document.getElementById("empty-state-template");
  const node = template.content.firstElementChild.cloneNode(true);
  if (message) {
    node.querySelector("strong").textContent = message;
  }
  return node;
}

function renderCard(target, card, fields) {
  const article = document.createElement("article");
  article.className = "state-card";
  article.dataset.severity = card.severity;
  setStatusColor(article, card.severity);

  const head = document.createElement("div");
  head.className = "card-head";

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = card.title;
  head.append(title, createStatusBadge(card));

  const description = document.createElement("p");
  description.className = "description";
  description.textContent = card.description;

  const metaGrid = document.createElement("div");
  metaGrid.className = "meta-grid";
  fields.forEach(([label, value]) => metaGrid.appendChild(createMeta(label, value(card))));

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = card.actionHint;

  article.append(head, description, metaGrid, hint);
  target.appendChild(article);
}

function renderMetric(target, label, value, severity = "info") {
  const card = document.createElement("article");
  card.className = "metric-card";
  setStatusColor(card, severity);
  card.append(createMeta(label, value));
  target.appendChild(card);
}

function renderListRow(target, card, fields) {
  const row = document.createElement("article");
  row.className = "list-row";
  setStatusColor(row, card.severity);

  const main = document.createElement("div");
  main.className = "row-main";
  const title = document.createElement("h3");
  title.textContent = card.title;
  main.append(title, createStatusBadge(card));

  const metaGrid = document.createElement("div");
  metaGrid.className = "meta-grid";
  fields.forEach(([label, value]) => metaGrid.appendChild(createMeta(label, value(card))));

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = card.actionHint;

  row.append(main, metaGrid, hint);
  target.appendChild(row);
}

export function renderGlobalStatus(target, globalStatus) {
  clear(target);
  [
    ["Status", globalStatus.status, globalStatus.status === "ok" ? "success" : globalStatus.status],
    ["Generated", globalStatus.generatedAt || "unknown", "info"],
    ["Runtime", globalStatus.runtimeVersion, "info"],
    ["Warnings", globalStatus.warnings, globalStatus.warnings > 0 ? "warning" : "success"],
    ["Errors", globalStatus.errors, globalStatus.errors > 0 ? "error" : "success"],
    ["Registry", `${globalStatus.projects} projects / ${globalStatus.providers} providers`, "info"]
  ].forEach(([label, value, severity]) => {
    const pill = document.createElement("div");
    pill.className = "status-pill";
    setStatusColor(pill, severity);

    const labelNode = document.createElement("span");
    labelNode.textContent = label;
    const valueNode = document.createElement("strong");
    valueNode.textContent = text(value);
    valueNode.title = text(value);
    pill.append(labelNode, valueNode);
    target.appendChild(pill);
  });
}

export function renderSummary(target, view) {
  clear(target);
  if (!view.loaded && view.cards.length === 0) {
    target.appendChild(createEmptyState("Summary view is unavailable."));
    return;
  }

  renderMetric(target, "Studio OS status", view.status, view.severity);
  renderMetric(target, "Generated at", view.generatedAt || "unknown", "info");
  renderMetric(target, "Warnings", view.warnings.length, view.warnings.length ? "warning" : "success");
  renderMetric(target, "Errors", view.errors.length, view.errors.length ? "error" : "success");
  renderMetric(target, "Source", view.source, "info");
  renderMetric(target, "Next action", view.nextRecommendedAction, view.severity);
}

export function renderProjects(target, cards) {
  clear(target);
  if (!cards.length) {
    target.appendChild(createEmptyState("No project cards match the current filter."));
    return;
  }
  cards.forEach((card) => renderCard(target, card, [
    ["Type", (item) => item.details.type],
    ["Branch", (item) => item.details.activeBranch],
    ["Deploy target", (item) => item.details.deploymentTarget],
    ["Docs", (item) => item.details.documentationStatus],
    ["Warnings", (item) => item.details.warnings || 0],
    ["Next", (item) => item.details.nextAction]
  ]));
}

export function renderProviders(target, cards) {
  clear(target);
  if (!cards.length) {
    target.appendChild(createEmptyState("No provider cards match the current filter."));
    return;
  }
  cards.forEach((card) => renderCard(target, card, [
    ["Configured", (item) => item.details.configuredStatus],
    ["Blocking", (item) => item.details.blocking],
    ["Health", (item) => item.details.healthState],
    ["Env vars", (item) => item.details.credentialEnvVarCount ?? 0],
    ["Core", (item) => item.details.requiredForCoreRuntime],
    ["Next", (item) => item.details.nextAction]
  ]));
}

export function renderHealth(target, cards) {
  clear(target);
  if (!cards.length) {
    target.appendChild(createEmptyState("No health cards match the current filter."));
    return;
  }
  cards.forEach((card) => renderListRow(target, card, [
    ["State", (item) => item.status],
    ["Source", (item) => item.details.reportSource || item.sourceFile],
    ["Updated", (item) => item.lastUpdated],
    ["Summary", (item) => item.description]
  ]));
}

export function renderTelemetry(target, cards) {
  clear(target);
  if (!cards.length) {
    target.appendChild(createEmptyState("No telemetry metrics match the current filter."));
    return;
  }
  cards.forEach((card) => {
    renderMetric(target, "Metric", card.details.latest?.metric || card.title, card.severity);
    renderMetric(target, "Value", card.details.latest?.value ?? card.details.count ?? "unknown", card.severity);
    renderMetric(target, "Category", card.details.type || "unknown", "info");
    renderMetric(target, "Source", card.details.source || card.sourceFile, "info");
    renderMetric(target, "Timestamp", card.details.timestamp || card.lastUpdated, "info");
    renderMetric(target, "Count", card.details.count ?? "unknown", card.severity);
  });
}

export function renderEvents(target, cards) {
  clear(target);
  if (!cards.length) {
    target.appendChild(createEmptyState("No events match the current filter."));
    return;
  }

  const timelineCards = [...cards].sort((left, right) => {
    const leftTime = Date.parse(left.details.timestamp || left.lastUpdated || "");
    const rightTime = Date.parse(right.details.timestamp || right.lastUpdated || "");
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });

  timelineCards.forEach((card) => {
    const event = document.createElement("article");
    event.className = "timeline-event";
    setStatusColor(event, card.severity);

    const main = document.createElement("div");
    main.className = "row-main";
    const title = document.createElement("h3");
    title.textContent = card.details.type || card.title;
    main.append(title, createStatusBadge(card));

    const metaGrid = document.createElement("div");
    metaGrid.className = "meta-grid";
    [
      ["Timestamp", card.details.timestamp || card.lastUpdated],
      ["Source", card.details.source || card.sourceFile],
      ["Count", card.details.count ?? "unknown"],
      ["Event ID", card.details.latest?.eventId || card.id]
    ].forEach(([label, value]) => metaGrid.appendChild(createMeta(label, value)));

    event.append(main, metaGrid);
    target.appendChild(event);
  });
}

export function renderContracts(target, cards) {
  clear(target);
  if (!cards.length) {
    target.appendChild(createEmptyState("No contract cards match the current filter."));
    return;
  }
  cards.forEach((card) => renderListRow(target, card, [
    ["Type", (item) => item.details.contractType],
    ["Validation", (item) => item.details.reportStatus],
    ["JSON known", (item) => item.details.validJsonKnown],
    ["Updated", (item) => item.lastUpdated]
  ]));
}

export function renderDeployments(target, cards) {
  clear(target);
  if (!cards.length) {
    target.appendChild(createEmptyState("No deployment profiles match the current filter."));
    return;
  }
  cards.forEach((card) => renderCard(target, card, [
    ["Target", (item) => item.details.profileId],
    ["Enabled", (item) => item.details.enabledState],
    ["Mode", (item) => item.details.targetStatus],
    ["Safety", (item) => item.details.safetyState],
    ["Approval", (item) => item.details.requiresManualApproval],
    ["Next", (item) => item.details.nextAction]
  ]));
}

export function renderDocumentation(target, cards) {
  clear(target);
  if (!cards.length) {
    target.appendChild(createEmptyState("No documentation cards match the current filter."));
    return;
  }
  cards.forEach((card) => renderListRow(target, card, [
    ["Available", (item) => item.details.exists],
    ["Missing", (item) => item.details.missing],
    ["Updated", (item) => item.lastUpdated],
    ["Source", (item) => item.sourceFile]
  ]));
}

export function renderOperationalIntelligence(target, views) {
  clear(target);
  const health = views.operationalHealth?.raw || {};
  const risk = views.risk?.raw || {};
  const maturity = views.maturity?.raw || {};
  const governance = views.governance?.raw || {};
  const executive = views.executiveSummary?.raw || {};
  const trends = Array.isArray(views.trends?.raw?.trends) ? views.trends.raw.trends : [];
  const changes = Array.isArray(views.changes?.raw?.changes) ? views.changes.raw.changes : [];

  [
    ["Studio Health Score", health.studioHealthScore ?? "unknown", health.studioHealthScore >= 90 ? "success" : health.studioHealthScore >= 75 ? "warning" : "error"],
    ["Risk Level", risk.riskLevel || "unknown", risk.riskLevel === "LOW" ? "success" : risk.riskLevel === "MEDIUM" ? "warning" : "error"],
    ["Trend Status", trends.map((item) => `${item.metric}: ${item.status}`).join(" | ") || "limited history", "info"],
    ["Maturity Status", maturity.maturityStatus ? `L${maturity.maturityLevel} ${maturity.maturityStatus}` : "unknown", maturity.maturityLevel >= 4 ? "success" : "warning"],
    ["Governance Score", governance.governanceScore ?? "unknown", governance.governanceScore >= 90 ? "success" : "warning"],
    ["Snapshot Delta", changes.map((item) => `${item.name}: ${item.delta}`).join(" | ") || "limited history", "info"]
  ].forEach(([label, value, severity]) => renderMetric(target, label, value, severity));

  const summaryCard = document.createElement("article");
  summaryCard.className = "intelligence-summary";
  setStatusColor(summaryCard, risk.riskLevel === "LOW" ? "success" : risk.riskLevel === "MEDIUM" ? "warning" : "error");
  const title = document.createElement("h3");
  title.textContent = "Executive Summary";
  const body = document.createElement("p");
  body.textContent = executive.summary || "Executive summary view is unavailable.";
  summaryCard.append(title, body);
  target.appendChild(summaryCard);

  const trendList = document.createElement("div");
  trendList.className = "oi-list";
  trends.slice(0, 6).forEach((item) => {
    const row = document.createElement("span");
    row.textContent = `${item.metric}: ${item.status} (${item.delta})`;
    trendList.appendChild(row);
  });
  if (trendList.childElementCount > 0) target.appendChild(trendList);
}

export function renderConfidence(target, view) {
  clear(target);
  const items = Array.isArray(view?.raw?.items) ? view.raw.items : [];
  if (!items.length) {
    target.appendChild(createEmptyState("Confidence view is unavailable."));
    return;
  }

  items.forEach((item) => {
    const confidence = String(item.confidence || "unknown");
    const severity = confidence === "VERY HIGH" || confidence === "HIGH" ? "success" : confidence === "MEDIUM" ? "warning" : "error";
    const row = document.createElement("article");
    row.className = "trust-row";
    setStatusColor(row, severity);

    const head = document.createElement("div");
    head.className = "row-main";
    const title = document.createElement("h3");
    title.textContent = item.output || "Intelligence output";
    head.append(title, createStatusBadge({ status: confidence, severity }));

    const metaGrid = document.createElement("div");
    metaGrid.className = "meta-grid";
    [
      ["Value", item.value],
      ["Sample", item.sampleSize],
      ["Reason", item.reason],
      ["Rule", item.rule]
    ].forEach(([label, value]) => metaGrid.appendChild(createMeta(label, value)));

    row.append(head, metaGrid);
    target.appendChild(row);
  });
}

export function renderExplainability(target, view) {
  clear(target);
  const items = Array.isArray(view?.raw?.items) ? view.raw.items : [];
  if (!items.length) {
    target.appendChild(createEmptyState("Explainability view is unavailable."));
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("article");
    row.className = "trust-row";
    setStatusColor(row, "info");

    const title = document.createElement("h3");
    title.textContent = item.question || item.outputName || "Score explanation";

    const metaGrid = document.createElement("div");
    metaGrid.className = "meta-grid";
    [
      ["Output", item.outputName],
      ["Result", item.finalOutput],
      ["Class", item.classification],
      ["Inputs", Array.isArray(item.inputs) ? item.inputs.length : "n/a"]
    ].forEach(([label, value]) => metaGrid.appendChild(createMeta(label, value)));

    const path = document.createElement("div");
    path.className = "calculation-path";
    (Array.isArray(item.calculationPath) ? item.calculationPath : []).slice(0, 5).forEach((step) => {
      const span = document.createElement("span");
      span.textContent = step;
      path.appendChild(span);
    });

    row.append(title, metaGrid, path);
    target.appendChild(row);
  });
}

function createTrustRow(titleText, badgeText, severity, fields) {
  const row = document.createElement("article");
  row.className = "trust-row";
  setStatusColor(row, severity);

  const head = document.createElement("div");
  head.className = "row-main";
  const title = document.createElement("h3");
  title.textContent = titleText;
  head.append(title, createStatusBadge({ status: badgeText, severity }));

  const metaGrid = document.createElement("div");
  metaGrid.className = "meta-grid";
  fields.forEach(([label, value]) => metaGrid.appendChild(createMeta(label, value)));

  row.append(head, metaGrid);
  return row;
}

export function renderGovernanceCenter(target, views) {
  clear(target);
  const score = views.governanceScore?.raw || {};
  const compliance = views.compliance?.raw || {};
  const exceptions = views.exceptions?.raw || {};
  const drift = views.governanceDrift?.raw || {};

  if (!views.governanceScore?.loaded && !views.compliance?.loaded) {
    target.appendChild(createEmptyState("Governance views are unavailable."));
    return;
  }

  target.appendChild(createTrustRow(
    "Governance Score",
    score.classification || "unknown",
    (score.governanceScore ?? 0) >= 75 ? "success" : (score.governanceScore ?? 0) >= 60 ? "warning" : "error",
    [
      ["Score", score.governanceScore ?? "unknown"],
      ["Class", score.classification || "unknown"],
      ["Findings", Array.isArray(score.checks) ? score.checks.filter((item) => item.score < 100).length : 0],
      ["Next", score.nextRecommendedAction || "No guidance available."]
    ]
  ));

  target.appendChild(createTrustRow(
    "Compliance Status",
    compliance.complianceStatus || "unknown",
    compliance.complianceStatus === "PASS" ? "success" : compliance.complianceStatus === "WARNING" ? "warning" : "error",
    [
      ["Status", compliance.complianceStatus || "unknown"],
      ["Findings", Array.isArray(compliance.findings) ? compliance.findings.filter((item) => item.status !== "PASS").length : 0],
      ["Source", compliance.source || "unknown"],
      ["Next", compliance.nextRecommendedAction || "No guidance available."]
    ]
  ));

  target.appendChild(createTrustRow(
    "Exceptions",
    (exceptions.expiredExceptions || []).length ? "violations" : "clear",
    (exceptions.expiredExceptions || []).length ? "error" : "success",
    [
      ["Active", Array.isArray(exceptions.activeExceptions) ? exceptions.activeExceptions.length : 0],
      ["Expired", Array.isArray(exceptions.expiredExceptions) ? exceptions.expiredExceptions.length : 0],
      ["Registered", Array.isArray(exceptions.exceptions) ? exceptions.exceptions.length : 0],
      ["Next", exceptions.nextRecommendedAction || "No guidance available."]
    ]
  ));

  target.appendChild(createTrustRow(
    "Governance Drift",
    drift.status || "unknown",
    drift.status === "ok" ? "success" : drift.status === "warning" ? "warning" : "error",
    [
      ["Sample", drift.sampleSize ?? "unknown"],
      ["Signals", Array.isArray(drift.drift) ? drift.drift.length : 0],
      ["Degrading", Array.isArray(drift.drift) ? drift.drift.filter((item) => item.trend === "Degrading").length : 0],
      ["Next", drift.nextRecommendedAction || "No guidance available."]
    ]
  ));
}

export function renderReleaseControl(target, views) {
  clear(target);
  const readiness = views.releaseReadiness?.raw || {};
  const gates = views.qualityGates?.raw || {};

  if (!views.releaseReadiness?.loaded && !views.qualityGates?.loaded) {
    target.appendChild(createEmptyState("Release control views are unavailable."));
    return;
  }

  target.appendChild(createTrustRow(
    "Release Readiness",
    readiness.classification || "unknown",
    (readiness.releaseReadiness ?? 0) >= 75 ? "success" : (readiness.releaseReadiness ?? 0) >= 50 ? "warning" : "error",
    [
      ["Score", readiness.releaseReadiness ?? "unknown"],
      ["Class", readiness.classification || "unknown"],
      ["Inputs", Array.isArray(readiness.inputs) ? readiness.inputs.length : 0],
      ["Next", readiness.nextRecommendedAction || "No guidance available."]
    ]
  ));

  target.appendChild(createTrustRow(
    "Quality Gates",
    gates.gateStatus || "unknown",
    gates.gateStatus === "PASS" ? "success" : gates.gateStatus === "WARNING" ? "warning" : "error",
    [
      ["Status", gates.gateStatus || "unknown"],
      ["Blocked", Array.isArray(gates.gates) ? gates.gates.filter((item) => item.status === "BLOCKED").length : 0],
      ["Warning", Array.isArray(gates.gates) ? gates.gates.filter((item) => item.status === "WARNING").length : 0],
      ["Next", gates.nextRecommendedAction || "No guidance available."]
    ]
  ));

  (Array.isArray(gates.gates) ? gates.gates : []).filter((gate) => gate.status !== "PASS").slice(0, 4).forEach((gate) => {
    target.appendChild(createTrustRow(
      gate.id || "Gate finding",
      gate.status || "unknown",
      gate.status === "WARNING" ? "warning" : "error",
      [
        ["Reason", gate.reason],
        ["Impact", gate.impact],
        ["Remediation", gate.remediation],
        ["Status", gate.status]
      ]
    ));
  });
}

export function renderExecutionReadinessCenter(target, view) {
  clear(target);
  const cards = Array.isArray(view?.cards) ? view.cards : [];
  if (!cards.length) {
    target.appendChild(createEmptyState("Execution readiness view is unavailable."));
    return;
  }

  cards.forEach((card) => renderListRow(target, card, [
    ["Area", (item) => item.details.kind],
    ["Allowed", (item) => item.details.allowedState],
    ["Blocked", (item) => item.details.blockedState],
    ["Readiness only", (item) => item.details.readinessOnly],
    ["Checks", (item) => item.details.checks ?? 0],
    ["Source", (item) => item.sourceFile]
  ]));
}

export function renderAuthorityCenter(target, view) {
  clear(target);
  const cards = Array.isArray(view?.cards) ? view.cards : [];
  if (!cards.length) {
    target.appendChild(createEmptyState("Authority visibility is unavailable."));
    return;
  }

  cards.forEach((card) => renderListRow(target, card, [
    ["Authority", (item) => item.details.authorityId || item.details.classification || item.id],
    ["Owner", (item) => item.details.owner || "derived"],
    ["Decision", (item) => item.details.decision || item.status],
    ["Count", (item) => item.details.count ?? item.details.authorityCount ?? "n/a"],
    ["Can execute", (item) => item.details.canExecute],
    ["Can mutate", (item) => item.details.canMutate]
  ]));
}

export function renderAuthorityProjectionMonitoring(target, view) {
  clear(target);
  const cards = Array.isArray(view?.cards) ? view.cards : [];
  if (!cards.length) {
    target.appendChild(createEmptyState("Authority projection monitoring is unavailable."));
    return;
  }

  cards.forEach((card) => renderListRow(target, card, [
    ["Type", (item) => item.details.type || item.id],
    ["Source", (item) => item.details.source || item.sourceFile],
    ["Projection", (item) => item.details.projection || item.sourceFile],
    ["Findings", (item) => item.details.findingCount ?? item.details.missingProjectionCount ?? "n/a"],
    ["Can repair", (item) => item.details.canRepair],
    ["Can synchronize", (item) => item.details.canSynchronize],
    ["Can execute", (item) => item.details.canExecute],
    ["Can mutate", (item) => item.details.canMutate]
  ]));
}

export function renderAuthorityMonitoringEvidence(target, view) {
  clear(target);
  const cards = Array.isArray(view?.cards) ? view.cards : [];
  if (!cards.length) {
    target.appendChild(createEmptyState("Authority monitoring evidence is unavailable."));
    return;
  }

  cards.forEach((card) => renderListRow(target, card, [
    ["Evidence", (item) => item.details.kind || item.details.group || item.id],
    ["Verdict", (item) => item.details.verdict || item.status],
    ["Counts", (item) => item.details.passCount === undefined ? "n/a" : `pass=${item.details.passCount}; fail=${item.details.failCount}; unknown=${item.details.unknownCount}`],
    ["Source", (item) => item.details.source || item.sourceFile],
    ["Projection", (item) => item.details.projection || item.details.path || item.sourceFile],
    ["Can repair", (item) => item.details.canRepair],
    ["Can synchronize", (item) => item.details.canSynchronize],
    ["Can execute", (item) => item.details.canExecute],
    ["Can mutate", (item) => item.details.canMutate]
  ]));
}

function renderReadonlyMetricGroup(target, metrics) {
  const group = document.createElement("section");
  group.className = "dashboard-subsection";
  const title = document.createElement("h3");
  title.textContent = "Readiness Metrics";
  const grid = document.createElement("div");
  grid.className = "metric-grid";
  group.append(title, grid);

  [
    ["Total APIs", metrics.totalApis, "info"],
    ["Configured", metrics.configured, metrics.configured > 0 ? "success" : "unknown"],
    ["Connected", metrics.connected, metrics.connected > 0 ? "success" : "warning"],
    ["Partially Configured", metrics.partiallyConfigured, metrics.partiallyConfigured > 0 ? "warning" : "success"],
    ["Invalid", metrics.invalid, metrics.invalid > 0 ? "error" : "success"],
    ["Expired", metrics.expired, metrics.expired > 0 ? "error" : "success"],
    ["Missing Scopes", metrics.missingScopes, metrics.missingScopes > 0 ? "warning" : "success"],
    ["Missing Permissions", metrics.missingPermissions, metrics.missingPermissions > 0 ? "warning" : "success"],
    ["Unknown", metrics.unknown, metrics.unknown > 0 ? "unknown" : "success"],
    ["Readiness Percentage", `${metrics.readinessPercentage ?? "unknown"}%`, metrics.readinessPercentage >= 75 ? "success" : metrics.readinessPercentage >= 50 ? "warning" : "error"]
  ].forEach(([label, value, severity]) => renderMetric(grid, label, value ?? "unknown", severity));

  target.appendChild(group);
}

function renderCriticalFailures(target, failures) {
  const group = document.createElement("section");
  group.className = "dashboard-subsection";
  const title = document.createElement("h3");
  title.textContent = "Top Critical Failures";
  const list = document.createElement("div");
  list.className = "stack-list compact";
  group.append(title, list);

  if (!failures.length) {
    list.appendChild(createEmptyState("No critical API failures reported."));
  } else {
    failures.forEach((failure) => renderListRow(list, {
      title: failure.name || failure.apiId || "Unknown API",
      status: failure.status || "unknown",
      severity: failure.criticality === "critical" ? "critical" : failure.readinessScore >= 75 ? "warning" : "error",
      actionHint: "Projection only. Resolve missing scopes, permissions, or configuration outside the dashboard.",
      details: failure
    }, [
      ["Provider", (item) => item.details.provider],
      ["Owner", (item) => item.details.owner],
      ["Readiness", (item) => item.details.readinessScore],
      ["Missing scopes", (item) => item.details.missingScopes],
      ["Missing permissions", (item) => item.details.missingPermissions],
      ["Last validation", (item) => item.details.lastValidation]
    ]));
  }

  target.appendChild(group);
}

function renderDependencyMap(target, dependencyMap) {
  const group = document.createElement("section");
  group.className = "dashboard-subsection";
  const title = document.createElement("h3");
  title.textContent = "Dependency Map";
  const list = document.createElement("div");
  list.className = "stack-list compact";
  group.append(title, list);

  if (!dependencyMap.length) {
    list.appendChild(createEmptyState("No API dependency map reported."));
  } else {
    dependencyMap.forEach((item) => {
      list.appendChild(createTrustRow(
        item.project || "Unknown project",
        `${Array.isArray(item.apis) ? item.apis.length : 0} APIs`,
        "info",
        [
          ["Project", item.project],
          ["APIs", item.apis],
          ["Source", "runtime/dashboard/api-governance.view.json"],
          ["Mode", "read-only"]
        ]
      ));
    });
  }

  target.appendChild(group);
}

export function renderApiGovernanceCenter(target, view) {
  clear(target);
  if (!view?.loaded) {
    target.appendChild(createEmptyState("API governance projection is unavailable."));
    return;
  }

  const raw = view.raw || {};
  const metrics = raw.metrics && typeof raw.metrics === "object" ? raw.metrics : {};
  const failures = Array.isArray(raw.topCriticalFailures) ? raw.topCriticalFailures : [];
  const dependencyMap = Array.isArray(raw.dependencyMap) ? raw.dependencyMap : [];
  const boundaries = raw.boundaries && typeof raw.boundaries === "object" ? raw.boundaries : {};
  const isReadOnly = raw.readOnly === true && boundaries.dashboardWritesAllowed === false;

  renderReadonlyMetricGroup(target, metrics);
  renderCriticalFailures(target, failures);
  renderDependencyMap(target, dependencyMap);
  target.appendChild(createTrustRow(
    "Boundary Audit",
    isReadOnly ? "read-only" : "unknown",
    isReadOnly ? "success" : "warning",
    [
      ["Read only", raw.readOnly],
      ["Stores secrets", boundaries.storesSecrets],
      ["Exposes tokens", boundaries.exposesTokens],
      ["Provider calls", boundaries.callsProviders],
      ["API calls", boundaries.performsApiCalls],
      ["Dashboard writes", boundaries.dashboardWritesAllowed]
    ]
  ));
}

export function renderMarketIntelligenceCenter(target, view) {
  clear(target);
  const cards = Array.isArray(view?.cards) ? view.cards : [];
  if (!cards.length) {
    target.appendChild(createEmptyState("Market intelligence visibility is unavailable."));
    return;
  }

  const sections = [
    "Provider Health",
    "Signal Sources",
    "Opportunity Ranking",
    "Recommendation Center",
    "Approval Queue"
  ];

  sections.forEach((section) => {
    const sectionCards = cards.filter((card) => card.details.section === section);
    if (!sectionCards.length) return;

    const group = document.createElement("section");
    group.className = "dashboard-subsection";
    const title = document.createElement("h3");
    title.textContent = section;
    group.appendChild(title);

    const list = document.createElement("div");
    list.className = "stack-list compact";
    sectionCards.forEach((card) => renderListRow(list, card, [
      ["Status", (item) => item.details.approvalStatus || item.details.providerStatus || item.status],
      ["Class", (item) => item.details.classification || "n/a"],
      ["Confidence", (item) => item.details.confidence ?? "n/a"],
      ["Evidence", (item) => item.details.evidenceCount ?? item.details.signalCount ?? "n/a"],
      ["Can publish", (item) => item.details.canPublish],
      ["Source", (item) => item.sourceFile]
    ]));

    group.appendChild(list);
    target.appendChild(group);
  });
}
