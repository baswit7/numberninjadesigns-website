const requiredDashboardFiles = {
  authority: "authority.view.json",
  authorityProjectionMonitoring: "authority-projection-monitoring.view.json",
  authorityMonitoringEvidence: "authority-monitoring-evidence.view.json",
  apiGovernance: "api-governance.view.json",
  marketIntelligence: "market-intelligence.view.json"
};

const optionalDashboardFiles = {
  summary: "dashboard-summary.json",
  projects: "projects.view.json",
  providers: "providers.view.json",
  health: "health.view.json",
  telemetry: "telemetry.view.json",
  events: "events.view.json",
  contracts: "contracts.view.json",
  deployments: "deployments.view.json",
  documentation: "documentation.view.json",
  executionReadiness: "execution-readiness.view.json",
  operationalHealth: "operational-health.view.json",
  trends: "trend-intelligence.view.json",
  changes: "change-intelligence.view.json",
  risk: "risk-intelligence.view.json",
  maturity: "maturity.view.json",
  governance: "governance.view.json",
  executiveSummary: "executive-summary.view.json",
  explainability: "intelligence-explainability.view.json",
  confidence: "confidence.view.json",
  governanceScore: "governance-score.view.json",
  compliance: "compliance.view.json",
  releaseReadiness: "release-readiness.view.json",
  qualityGates: "quality-gates.view.json",
  exceptions: "exceptions.view.json",
  governanceDrift: "governance-drift.view.json"
};

const dashboardFiles = { ...requiredDashboardFiles, ...optionalDashboardFiles };
const dashboardRoot = "../../runtime/dashboard/";

async function listAvailableDashboardFiles() {
  const response = await fetch(dashboardRoot, {
    cache: "no-store",
    credentials: "same-origin"
  });

  if (!response.ok) return null;

  const html = await response.text();
  const document = new DOMParser().parseFromString(html, "text/html");
  const names = Array.from(document.querySelectorAll("a[href]"))
    .map((link) => decodeURIComponent(link.getAttribute("href") || "").split("/").pop())
    .filter(Boolean);

  return new Set(names);
}

async function loadJsonFile(viewName, fileName) {
  const response = await fetch(`${dashboardRoot}${fileName}`, {
    cache: "no-store",
    credentials: "same-origin"
  });

  if (!response.ok) {
    throw new Error(`${fileName} returned HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data || typeof data !== "object") {
    throw new Error(`${fileName} did not contain a JSON object`);
  }

  return {
    viewName,
    fileName,
    data,
    error: ""
  };
}

function readSelectedFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsText(file);
  });
}

export async function loadDashboardViews() {
  const entries = Object.entries(requiredDashboardFiles);
  const availableFiles = await listAvailableDashboardFiles();
  const results = await Promise.all(
    entries.map(async ([viewName, fileName]) => {
      if (availableFiles && !availableFiles.has(fileName)) {
        return {
          viewName,
          fileName,
          data: null,
          error: `${fileName} is not available`
        };
      }

      try {
        return await loadJsonFile(viewName, fileName);
      } catch (error) {
        return {
          viewName,
          fileName,
          data: null,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    })
  );

  return results.reduce((accumulator, result) => {
    accumulator[result.viewName] = result;
    return accumulator;
  }, {});
}

export async function loadDashboardViewsFromFiles(fileList) {
  const files = Array.from(fileList || []);
  const results = {};

  await Promise.all(Object.entries(dashboardFiles).map(async ([viewName, fileName]) => {
    const file = files.find((candidate) => candidate.name === fileName);
    if (!file) {
      results[viewName] = {
        viewName,
        fileName,
        data: null,
        error: `${fileName} was not selected`
      };
      return;
    }

    try {
      const rawJson = await readSelectedFile(file);
      const data = JSON.parse(rawJson);
      results[viewName] = {
        viewName,
        fileName,
        data,
        error: ""
      };
    } catch (error) {
      results[viewName] = {
        viewName,
        fileName,
        data: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }));

  return results;
}

export { dashboardFiles };
