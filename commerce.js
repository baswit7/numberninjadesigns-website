(function initializeCommerce() {
  "use strict";

  var LOG_PREFIX = "[NumberNinjaDesigns Commerce]";
  var REQUIRED_PRODUCTS = [
    {
      id: "budget-planner-basic",
      name: "Budget Planner",
      href: "budget-planner-basic.html",
      tabCount: 7,
      formulaCount: "104+",
      summary: "Plan versus actual budgeting, savings goals, cash-flow review and model checks."
    },
    {
      id: "debt-payoff-tracker",
      name: "Debt Payoff Tracker",
      href: "debt-payoff-tracker.html",
      tabCount: 5,
      formulaCount: "141+",
      summary: "Balance and APR planning, payment logging, payoff progress and sustainability checks."
    },
    {
      id: "net-worth-tracker",
      name: "Net Worth Tracker",
      href: "net-worth-tracker.html",
      tabCount: 6,
      formulaCount: "150+",
      summary: "Assets, liabilities, monthly history, net-worth trends and integrity checks."
    }
  ];

  function log(level, message, detail) {
    if (!window.console || typeof window.console[level] !== "function") return;
    if (detail === undefined) window.console[level](LOG_PREFIX, message);
    else window.console[level](LOG_PREFIX, message, detail);
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function slugify(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function arrowIcon() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("button-icon");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M5 12h14M13 6l6 6-6 6");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  }

  function appendPreviewRows(panel, product, sheet) {
    var grid = element("div", "workbook-grid workbook-grid-compact");
    var families = safeArray(product.formulaFamilies);
    var rows = [
      [sheet, "Active"],
      ["Workbook structure", "Verified"],
      ["Formula logic", families.length ? families.slice(0, 2).join(" / ") : "Review"]
    ];
    rows.forEach(function addRow(row, index) {
      grid.appendChild(element("span", "workbook-row-number", String(index + 1)));
      grid.appendChild(element("strong", "workbook-label", row[0]));
      grid.appendChild(element("span", "workbook-cell", row[1]));
    });
    panel.appendChild(grid);
  }

  function buildWorkbookPreview(product, truth) {
    var frame = element("div", "workbook-preview workbook-preview-card");
    frame.dataset.workbookPreview = "";
    frame.setAttribute("aria-label", "Interactive preview of " + product.name + " workbook sheets");

    var heading = element("div", "workbook-heading");
    heading.appendChild(element("strong", "workbook-title", product.name));
    heading.appendChild(element("span", "workbook-status", product.statusLabel));
    frame.appendChild(heading);

    var sheets = safeArray(product.sheets);
    if (!sheets.length) throw new Error("No workbook sheets configured for " + product.id);

    var shownSheets = sheets.slice(0, 4);
    var tabList = element("div", "workbook-tabs");
    tabList.setAttribute("role", "tablist");
    tabList.setAttribute("aria-label", product.name + " preview sheets");
    frame.appendChild(tabList);

    shownSheets.forEach(function addSheet(sheet, index) {
      var controlId = "catalog-" + slugify(product.id) + "-tab-" + index;
      var panelId = "catalog-" + slugify(product.id) + "-panel-" + index;
      var tab = element("button", "", sheet);
      tab.type = "button";
      tab.id = controlId;
      tab.dataset.sheetTab = sheet;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", panelId);
      tab.setAttribute("aria-selected", index === 0 ? "true" : "false");
      tab.tabIndex = index === 0 ? 0 : -1;
      tabList.appendChild(tab);

      var panel = element("div", "workbook-panel");
      panel.id = panelId;
      panel.dataset.sheetPanel = sheet;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", controlId);
      panel.hidden = index !== 0;
      appendPreviewRows(panel, product, sheet);
      frame.appendChild(panel);
    });

    var status = element("p", "preview-status", "Showing " + shownSheets[0] + " sheet");
    status.dataset.previewStatus = "";
    status.setAttribute("aria-live", "polite");
    frame.appendChild(status);

    var facts = element("p", "workbook-formulas", truth.tabCount + " tabs  ·  " + truth.formulaCount + " formulas");
    frame.appendChild(facts);
    return frame;
  }

  function buildProductCard(product, truth) {
    if (!product || product.id !== truth.id) throw new Error("Invalid catalog entry: " + truth.id);
    if (!product.name || !product.statusLabel || !product.cta) throw new Error("Incomplete catalog entry: " + truth.id);

    var card = element("article", "catalog-product");
    card.dataset.productId = product.id;

    var copy = element("div", "product-story-copy");
    copy.appendChild(element("p", "product-status", product.statusLabel));
    copy.appendChild(element("h3", "product-story-title", product.name));
    copy.appendChild(element("p", "product-story-description", truth.summary));

    var metrics = element("dl", "catalog-metrics");
    [
      ["Tabs", String(truth.tabCount)],
      ["Formulas", truth.formulaCount],
      ["Gate", "Owner approved"]
    ].forEach(function addMetric(metric) {
      var wrapper = element("div", "");
      wrapper.appendChild(element("dt", "", metric[0]));
      wrapper.appendChild(element("dd", "", metric[1]));
      metrics.appendChild(wrapper);
    });
    copy.appendChild(metrics);

    var featureList = element("ul", "feature-list");
    safeArray(product.features).slice(0, 4).forEach(function addFeature(feature) {
      featureList.appendChild(element("li", "", feature));
    });
    copy.appendChild(featureList);

    var href = product.detailHref || product.cta.href || truth.href;
    var label = product.cta.label || "Inspect product details";
    var link = element("a", "commerce-button commerce-button-outline", label);
    link.href = href;
    link.setAttribute("aria-label", label + ": " + product.name);
    link.appendChild(arrowIcon());
    copy.appendChild(link);

    card.appendChild(copy);
    card.appendChild(buildWorkbookPreview(product, truth));
    return card;
  }

  function buildRecoveryCard(truth, error) {
    var card = element("article", "catalog-product catalog-recovery");
    card.dataset.productId = truth.id;
    card.setAttribute("role", "status");
    card.appendChild(element("p", "product-status", "Preview recovery"));
    card.appendChild(element("h3", "product-story-title", truth.name));
    card.appendChild(element("p", "", "The live catalog facts are temporarily unavailable. The static product detail remains accessible."));
    var link = element("a", "commerce-button commerce-button-outline", "Inspect product details");
    link.href = truth.href;
    link.setAttribute("aria-label", "Inspect product details: " + truth.name);
    link.appendChild(arrowIcon());
    card.appendChild(link);
    log("error", "Recovery state activated for " + truth.id + ".", error);
    return card;
  }

  function renderCatalog(catalog) {
    document.querySelectorAll("[data-product-catalog]").forEach(function renderMount(mount) {
      var fragment = document.createDocumentFragment();
      var products = catalog && Array.isArray(catalog.products) ? catalog.products : [];

      REQUIRED_PRODUCTS.forEach(function renderProduct(truth) {
        try {
          var product = products.find(function findProduct(item) {
            return item && item.id === truth.id;
          });
          fragment.appendChild(buildProductCard(product, truth));
        } catch (error) {
          fragment.appendChild(buildRecoveryCard(truth, error));
        }
      });

      mount.replaceChildren(fragment);
      mount.removeAttribute("aria-busy");
    });
  }

  function activateTab(preview, selectedTab, moveFocus) {
    var tabs = Array.from(preview.querySelectorAll("[data-sheet-tab]"));
    var selectedSheet = selectedTab.dataset.sheetTab;
    tabs.forEach(function updateTab(tab) {
      var active = tab === selectedTab;
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.tabIndex = active ? 0 : -1;
    });
    preview.querySelectorAll("[data-sheet-panel]").forEach(function updatePanel(panel) {
      panel.hidden = panel.dataset.sheetPanel !== selectedSheet;
    });
    var status = preview.querySelector("[data-preview-status]");
    if (status) status.textContent = "Showing " + selectedSheet + " sheet";
    if (moveFocus) selectedTab.focus();
  }

  function setupTabPreviews() {
    document.querySelectorAll("[data-workbook-preview]").forEach(function setupPreview(preview) {
      if (preview.dataset.previewReady === "true") return;
      preview.dataset.previewReady = "true";

      preview.addEventListener("click", function handlePreviewClick(event) {
        var tab = event.target.closest("[data-sheet-tab]");
        if (tab && preview.contains(tab)) activateTab(preview, tab, false);
      });

      preview.addEventListener("keydown", function handlePreviewKeydown(event) {
        var currentTab = event.target.closest("[data-sheet-tab]");
        if (!currentTab) return;
        var tabs = Array.from(preview.querySelectorAll("[data-sheet-tab]"));
        var index = tabs.indexOf(currentTab);
        var nextIndex = index;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = tabs.length - 1;
        else return;
        event.preventDefault();
        activateTab(preview, tabs[nextIndex], true);
      });
    });
  }

  function setupMobileMenus() {
    document.querySelectorAll("[data-mobile-menu]").forEach(function setupMenu(menu) {
      menu.addEventListener("click", function closeAfterNavigation(event) {
        if (event.target.closest("a")) menu.removeAttribute("open");
      });
    });
  }

  function start() {
    setupMobileMenus();
    renderCatalog(window.NumberNinjaCatalog);
    setupTabPreviews();
    log("info", "Commerce interface ready.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
