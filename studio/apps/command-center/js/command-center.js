const projects = [
  {
    name: "NumberNinjaDesigns",
    goal: "Omzet via designs, listings en verkoopkanalen",
    next: "Listing/productiepakket voorbereiden",
    risk: "Verkoopkanalen/API's nog niet overal stabiel",
    recommendation: "Maak eerst een verkoopklaar listingpakket met titel, mockup, tags en kanaalkeuze."
  },
  {
    name: "TOK Hub",
    goal: "YouTube-content over psychologie, ouderschap en jeugd",
    next: "Script/contentpakket voorbereiden",
    risk: "Factcheck en medische claimgrenzen bewaken",
    recommendation: "Start met een scriptbrief, bronkader en claimcheck voordat productie begint."
  },
  {
    name: "Boodschappen Vergelijker",
    goal: "Simpele persoonlijke prijsvergelijker",
    next: "Productmatching en winkeldata verbeteren",
    risk: "Databronnen verschillen per winkel",
    recommendation: "Leg productmatching-regels vast voordat nieuwe winkeldata wordt toegevoegd."
  },
  {
    name: "Studio OS",
    goal: "AI development studio als besturingssysteem",
    next: "Productie-interface hard maken",
    risk: "Technische dashboards mogen hoofdinterface niet vervangen",
    recommendation: "Gebruik Command Center als startpunt en verwijs technische controles naar Technical Area."
  }
];

const workflows = [
  {
    title: "Idee naar product",
    explanation: "Zet een ruwe kans om naar een concreet productiepakket.",
    output: "Productbrief met doelgroep, aanbod, kanaal en eerste actie",
    status: "Ready to prepare"
  },
  {
    title: "Etsy listing maken",
    explanation: "Bereid titel, tags, beschrijving, visuals en productkeuze voor.",
    output: "Listingpakket voor handmatige publicatie",
    status: "Needs input"
  },
  {
    title: "SEO verbeteren",
    explanation: "Versterk zoekintentie, titels, interne termen en kanaalfit.",
    output: "SEO-aanpassingslijst",
    status: "Ready to prepare"
  },
  {
    title: "Social post maken",
    explanation: "Maak een kanaalklaar postconcept met hook, caption en visualrichting.",
    output: "Postpakket per kanaal",
    status: "Ready to prepare"
  },
  {
    title: "YouTube script maken",
    explanation: "Maak structuur, intro, segmenten, bronnen en risico-notities.",
    output: "Scriptbrief en reviewpunten",
    status: "Review required"
  },
  {
    title: "API-koppeling controleren",
    explanation: "Bekijk menselijke status en bepaal of technische validatie nodig is.",
    output: "Controleadvies zonder provider-call",
    status: "Needs attention"
  },
  {
    title: "Codex opdracht voorbereiden",
    explanation: "Maak een afgebakende opdracht met scope, verboden zones en checks.",
    output: "Codex-ready opdracht",
    status: "Ready to prepare"
  },
  {
    title: "Reviewpakket maken",
    explanation: "Bundel bewijs, risico's en acceptatiecriteria voor besluitvorming.",
    output: "Reviewpakket voor Bas",
    status: "Ready to prepare"
  }
];

const agents = [
  {
    name: "ChatGPT Architect",
    role: "Architectuur, analyse en besliskader",
    when: "Gebruik bij scope, strategie, systeemontwerp en productbeslissingen.",
    output: "Architectuurbesluit, risicoanalyse en uitvoerbare opdracht"
  },
  {
    name: "Codex Developer",
    role: "Implementatie in repository",
    when: "Gebruik bij afgebakende code-, documentatie- of validatietaken.",
    output: "Branch, commit, validaties en wijzigingsrapport"
  },
  {
    name: "Reviewer",
    role: "Kwaliteitscontrole en regressierisico",
    when: "Gebruik voor PR-review, scopecontrole en releasebesluit.",
    output: "Findings, blocking issues en mergeadvies"
  },
  {
    name: "QA Checker",
    role: "Functionele en visuele verificatie",
    when: "Gebruik na implementatie of bij twijfel over browsergedrag.",
    output: "Smoke test, foutlijst en pass/fail"
  },
  {
    name: "Documentation Agent",
    role: "Documentatie, changelog en kennisborging",
    when: "Gebruik bij nieuwe grenzen, workflows of overdraagbare kennis.",
    output: "Docs-update, samenvatting en onderhoudsnotities"
  },
  {
    name: "Release Reviewer",
    role: "Go/no-go voor publicatie",
    when: "Gebruik voor merge, deploymentvoorbereiding en rollbackcheck.",
    output: "Releaseadvies met risico's en vervolgstap"
  }
];

const apis = [
  { name: "OpenAI", status: "Connected", note: "Beschikbaar voor AI-productie en analyse." },
  { name: "GitHub", status: "Connected", note: "Beschikbaar voor repositorywerk en PR-flow." },
  { name: "Notion", status: "Needs attention", note: "Gebruik afhankelijk van actuele workspace-inrichting." },
  { name: "Vercel", status: "Connected", note: "Hosting is beschikbaar; routing blijft aparte taak." },
  { name: "Etsy", status: "Needs attention", note: "Verkoopkanaal vraagt gerichte controle voor listingflow." },
  { name: "Printify", status: "Pending", note: "Productiepad voorbereiden voordat live koppeling nodig is." },
  { name: "Meta", status: "Pending", note: "Social distributie voorbereiden met handmatige controle." },
  { name: "Pinterest", status: "Not configured", note: "Nog niet gebruiken voor productie zonder setup-besluit." },
  { name: "TikTok", status: "Blocked", note: "Niet gebruiken voor automatische publicatie." },
  { name: "Reddit", status: "Not configured", note: "Alleen handmatige contentvoorbereiding." }
];

const projectGrid = document.getElementById("project-grid");
const focusPanel = document.getElementById("focus-panel");
const workflowGrid = document.getElementById("workflow-grid");
const workflowDetail = document.getElementById("workflow-detail");
const agentGrid = document.getElementById("agent-grid");
const apiGrid = document.getElementById("api-grid");
const apiFilters = document.getElementById("api-filters");
const projectControl = document.getElementById("project-control");

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderProjectCards() {
  projectGrid.innerHTML = "";
  projects.forEach((project, index) => {
    const card = createElement("article", "card");
    card.append(
      createElement("h3", "", project.name),
      createElement("p", "", project.goal)
    );

    const list = createElement("ul", "meta-list");
    [
      ["Eerstvolgende actie", project.next],
      ["Risico", project.risk]
    ].forEach(([label, value]) => {
      const item = createElement("li");
      item.append(createElement("span", "", label), document.createTextNode(` ${value}`));
      list.append(item);
    });

    const button = createElement("button", "prepare-button", "Focus kiezen");
    button.type = "button";
    button.addEventListener("click", () => selectProject(index));
    card.append(list, button);
    projectGrid.append(card);
  });
}

function selectProject(index) {
  const project = projects[index];
  focusPanel.innerHTML = "";
  focusPanel.append(
    createElement("span", "panel-label", "Geselecteerde focus"),
    createElement("strong", "", project.name),
    createElement("p", "", project.next)
  );
}

function renderWorkflows(selectedIndex = 0) {
  workflowGrid.innerHTML = "";
  workflows.forEach((workflow, index) => {
    const card = createElement("article", "card");
    card.append(
      createElement("h3", "", workflow.title),
      createElement("p", "", workflow.explanation),
      createElement("span", "status-pill", workflow.status)
    );

    const output = createElement("p", "", `Output: ${workflow.output}`);
    const button = createElement("button", index === selectedIndex ? "prepare-button is-selected" : "prepare-button", "Voorbereiden");
    button.type = "button";
    button.addEventListener("click", () => renderWorkflows(index));
    card.append(output, button);
    workflowGrid.append(card);
  });

  const selected = workflows[selectedIndex];
  workflowDetail.innerHTML = "";
  workflowDetail.append(
    createElement("span", "panel-label", "Workflow detail"),
    createElement("h3", "", selected.title),
    createElement("p", "", selected.explanation),
    createElement("p", "", `Output: ${selected.output}`),
    createElement("span", "status-pill", selected.status)
  );
}

function renderAgents() {
  agentGrid.innerHTML = "";
  agents.forEach((agent) => {
    const card = createElement("article", "card");
    card.append(
      createElement("h3", "", agent.name),
      createElement("p", "", agent.role),
      createElement("p", "", `Wanneer gebruiken: ${agent.when}`),
      createElement("span", "status-pill", `Output: ${agent.output}`)
    );
    agentGrid.append(card);
  });
}

function renderApis(filter = "all") {
  apiGrid.innerHTML = "";
  apis
    .filter((api) => filter === "all" || api.status === filter)
    .forEach((api) => {
      const card = createElement("article", "card api-card");
      card.dataset.status = api.status;
      card.append(
        createElement("h3", "", api.name),
        createElement("span", "status-pill", api.status),
        createElement("p", "", api.note)
      );
      apiGrid.append(card);
    });
}

function bindApiFilters() {
  apiFilters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    apiFilters.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
    renderApis(button.dataset.filter);
  });
}

function renderProjectControl() {
  projectControl.innerHTML = "";
  projects.forEach((project) => {
    const row = createElement("article", "project-row");
    [
      ["Project", project.name],
      ["Businessdoel", project.goal],
      ["Volgende actie", project.next],
      ["Blokkade", project.risk],
      ["Aanbevolen actie", project.recommendation]
    ].forEach(([label, value]) => {
      const cell = createElement("div");
      cell.append(createElement("span", "", label), createElement("strong", "", value));
      row.append(cell);
    });
    projectControl.append(row);
  });
}

renderProjectCards();
renderWorkflows();
renderAgents();
renderApis();
renderProjectControl();
bindApiFilters();
