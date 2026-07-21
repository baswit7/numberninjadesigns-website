(function initializeCommerce() {
  "use strict";

  var LOG_PREFIX = "[NumberNinjaDesigns Commerce]";

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

  function buildWorkbookPreview(product) {
    var frame = element("div", "workbook-preview workbook-preview-card");
    frame.setAttribute("aria-label", "Derived preview of the validated Budget Planner workbook structure");

    var heading = element("div", "workbook-heading");
    heading.appendChild(element("strong", "workbook-title", product.name));
    heading.appendChild(element("span", "workbook-status", product.statusLabel));
    frame.appendChild(heading);

    var tabs = element("div", "workbook-tabs");
    product.sheets.forEach(function addSheet(sheet, index) {
      var tab = element("span", index === 0 ? "is-active" : "", sheet);
      tabs.appendChild(tab);
    });
    frame.appendChild(tabs);

    var grid = element("div", "workbook-grid workbook-grid-compact");
    ["Total Income", "Total Expenses", "Net Savings", "Savings Rate", "Categorized Expenses", "Expenses by Category"].forEach(function addRow(label, index) {
      grid.appendChild(element("span", "workbook-row-number", String(index + 1)));
      grid.appendChild(element("span", "workbook-label", label));
      grid.appendChild(element("span", "workbook-cell", ""));
    });
    frame.appendChild(grid);
    frame.appendChild(element("p", "workbook-formulas", product.formulaFamilies.join("  ·  ")));
    return frame;
  }

  function buildProductStory(product) {
    var story = element("article", "product-story");
    story.dataset.productId = product.id;

    var copy = element("div", "product-story-copy");
    copy.appendChild(element("p", "product-status", product.statusLabel));
    copy.appendChild(element("h3", "product-story-title", product.name));
    copy.appendChild(element("p", "product-story-description", product.shortDescription));

    var featureList = element("ul", "feature-list");
    product.features.forEach(function addFeature(feature) {
      featureList.appendChild(element("li", "", feature));
    });
    copy.appendChild(featureList);

    var link = element("a", "commerce-button commerce-button-outline", product.cta.label);
    link.href = product.cta.href;
    link.appendChild(arrowIcon());
    copy.appendChild(link);

    story.appendChild(copy);
    story.appendChild(buildWorkbookPreview(product));
    return story;
  }

  function renderProducts(catalog) {
    document.querySelectorAll("[data-product-feature]").forEach(function renderMount(mount) {
      var productId = mount.getAttribute("data-product-feature");
      var product = catalog.products.find(function findProduct(item) {
        return item.id === productId;
      });
      if (!product) throw new Error("Product configuration not found: " + productId);
      mount.replaceChildren(buildProductStory(product));
      mount.removeAttribute("aria-busy");
    });
  }

  function renderBundles(catalog) {
    document.querySelectorAll("[data-bundle-list]").forEach(function renderMount(mount) {
      var fragment = document.createDocumentFragment();
      catalog.bundles.forEach(function addBundle(bundle, index) {
        var item = element("article", "bundle-item");
        item.appendChild(element("span", "bundle-index", String(index + 1).padStart(2, "0")));
        item.appendChild(element("h3", "", bundle.name));
        item.appendChild(element("p", "bundle-status", bundle.statusLabel));
        fragment.appendChild(item);
      });
      mount.replaceChildren(fragment);
      mount.removeAttribute("aria-busy");
    });
  }

  function renderRecovery(mount, error) {
    var message = element("div", "catalog-recovery");
    message.setAttribute("role", "status");
    message.appendChild(element("p", "", "Product information could not be loaded on this page."));
    var link = element("a", "commerce-button commerce-button-outline", "Open Budget Planner preview");
    link.href = "budget-planner-basic.html";
    link.appendChild(arrowIcon());
    message.appendChild(link);
    mount.replaceChildren(message);
    mount.removeAttribute("aria-busy");
    log("error", "Catalog recovery state activated.", error);
  }

  function setupMobileMenus() {
    document.querySelectorAll("[data-mobile-menu]").forEach(function setupMenu(menu) {
      menu.querySelectorAll("a").forEach(function closeOnNavigate(link) {
        link.addEventListener("click", function closeMenu() {
          menu.removeAttribute("open");
        });
      });
    });
  }

  function start() {
    setupMobileMenus();
    var catalog = window.NumberNinjaDesignsCatalog;
    var mounts = document.querySelectorAll("[data-product-feature], [data-bundle-list]");
    if (!mounts.length) {
      log("info", "Static commerce page ready.");
      return;
    }

    try {
      if (!catalog || !Array.isArray(catalog.products) || !Array.isArray(catalog.bundles)) {
        throw new Error("Catalog configuration is unavailable or invalid.");
      }
      renderProducts(catalog);
      renderBundles(catalog);
      log("info", "Catalog rendered successfully.");
    } catch (error) {
      document.querySelectorAll("[data-product-feature]").forEach(function recover(mount) {
        renderRecovery(mount, error);
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
