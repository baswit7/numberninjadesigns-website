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
  var LIVE_LISTING_IDS = [
    "4545118638",
    "4545117498",
    "4545117926",
    "4545118486",
    "4545118344",
    "4545100025",
    "4545099893",
    "4545099579",
    "4545117616",
    "4545099189"
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

  function validateLiveListings(listings) {
    if (!Array.isArray(listings) || listings.length !== LIVE_LISTING_IDS.length) {
      throw new Error("The live Etsy catalog must contain exactly " + LIVE_LISTING_IDS.length + " listings.");
    }

    var seen = new Set();
    listings.forEach(function validateListing(listing) {
      if (!listing || typeof listing !== "object") throw new Error("Invalid live Etsy listing record.");
      if (!LIVE_LISTING_IDS.includes(listing.listingId)) throw new Error("Unexpected Etsy listing: " + listing.listingId);
      if (seen.has(listing.listingId)) throw new Error("Duplicate Etsy listing: " + listing.listingId);
      seen.add(listing.listingId);
      if (!listing.name || !listing.title || !listing.category || !listing.priceDisplay) {
        throw new Error("Incomplete Etsy listing: " + listing.listingId);
      }
      if (listing.status !== "live" || listing.kind !== "Digital download") {
        throw new Error("Non-live or non-digital Etsy listing: " + listing.listingId);
      }

      var listingUrl = new URL(listing.url);
      var imageUrl = new URL(listing.image);
      if (
        listingUrl.protocol !== "https:" ||
        listingUrl.hostname !== "www.etsy.com" ||
        listingUrl.pathname !== "/listing/" + listing.listingId + "/"
      ) {
        throw new Error("Invalid Etsy URL for listing " + listing.listingId);
      }
      if (imageUrl.protocol !== "https:" || imageUrl.hostname !== "i.etsystatic.com") {
        throw new Error("Invalid Etsy image URL for listing " + listing.listingId);
      }
    });

    LIVE_LISTING_IDS.forEach(function requireListing(listingId) {
      if (!seen.has(listingId)) throw new Error("Missing Etsy listing: " + listingId);
    });
  }

  function externalListingLink(className, label, listing) {
    var link = element("a", className, label);
    link.href = listing.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  function buildLiveListingCard(listing) {
    var cardClass = "live-listing-card" + (listing.featuredRank ? " is-featured" : "");
    var card = element("article", cardClass);
    card.dataset.listingId = listing.listingId;

    var media = externalListingLink("live-listing-media", "", listing);
    media.setAttribute("aria-label", "View on Etsy: " + listing.title);
    var image = element("img", "live-listing-image");
    image.src = listing.image;
    image.alt = listing.title;
    image.width = 800;
    image.height = 800;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", function recoverListingImage() {
      image.hidden = true;
      media.classList.add("is-unavailable");
      media.appendChild(element("span", "live-listing-image-fallback", "Product image available on Etsy"));
    }, { once: true });
    media.appendChild(image);

    var badges = element("div", "live-listing-badges");
    badges.appendChild(element("span", "live-listing-status", "Live on Etsy"));
    if (listing.featuredRank) {
      badges.appendChild(element("span", "live-listing-featured", "Featured " + String(listing.featuredRank).padStart(2, "0")));
    }
    media.appendChild(badges);
    card.appendChild(media);

    var copy = element("div", "live-listing-copy");
    copy.appendChild(element("p", "live-listing-category", listing.category));
    copy.appendChild(element("h3", "live-listing-name", listing.name));
    copy.appendChild(element("p", "live-listing-title", listing.title));

    var facts = element("div", "live-listing-facts");
    var price = element("strong", "live-listing-price", listing.priceDisplay);
    price.setAttribute("aria-label", "Public Etsy price observed in the Netherlands: " + listing.priceDisplay);
    facts.appendChild(price);
    facts.appendChild(element("span", "live-listing-kind", listing.kind));
    copy.appendChild(facts);

    var link = externalListingLink("commerce-button commerce-button-primary", "View on Etsy", listing);
    link.setAttribute("aria-label", "View on Etsy: " + listing.name);
    link.appendChild(arrowIcon());
    copy.appendChild(link);
    card.appendChild(copy);
    return card;
  }

  function buildLiveListingRecovery(sync, error) {
    var card = element("article", "live-listing-recovery");
    card.setAttribute("role", "status");
    card.appendChild(element("p", "product-status", "Catalog recovery"));
    card.appendChild(element("h3", "product-story-title", "Live Etsy catalog"));
    card.appendChild(element("p", "", "The listing overview is temporarily unavailable. Open the Etsy shop to see the current catalog."));
    var link = element("a", "commerce-button commerce-button-outline", "Open Etsy shop");
    link.href = sync && sync.shopUrl ? sync.shopUrl : "https://www.etsy.com/shop/NumberNinjaDesigns";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.appendChild(arrowIcon());
    card.appendChild(link);
    log("error", "Live Etsy catalog recovery activated.", error);
    return card;
  }

  function renderLiveListings(catalog) {
    document.querySelectorAll("[data-live-listing-catalog]").forEach(function renderMount(mount) {
      var fragment = document.createDocumentFragment();
      try {
        var listings = catalog && catalog.liveListings;
        validateLiveListings(listings);
        listings.forEach(function renderListing(listing) {
          fragment.appendChild(buildLiveListingCard(listing));
        });
      } catch (error) {
        fragment.appendChild(buildLiveListingRecovery(catalog && catalog.liveListingSync, error));
      }
      mount.replaceChildren(fragment);
      mount.removeAttribute("aria-busy");
    });
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
    renderLiveListings(window.NumberNinjaCatalog);
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
