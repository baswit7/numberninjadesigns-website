(function () {
  "use strict";

  var data = window.NumberNinjaSupportData;
  var state = { products: [], responseTimer: null };
  var $ = function (id) { return document.getElementById(id); };

  var copy = {
    "nl-NL": {
      ready: "Productkennis beschikbaar",
      readyDetail: "{products} producten · {profiles} gecontroleerde profielen · zonder externe AI-API",
      profile: "Brongebonden profiel · versie {version} · {sources} productbronnen · {platform}",
      questions: {
        contents: "Wat zit er in dit product?",
        compatibility: "Werkt dit in Google Sheets?",
        configuration: "Welke talen, valuta en thema’s zijn beschikbaar?",
        download: "Hoe open ik mijn download?"
      },
      statusReady: "Klaar om gecontroleerde productkennis te raadplegen.",
      statusLoading: "Productbronnen controleren…",
      statusDone: "Brongebonden antwoord beschikbaar.",
      high: "Hoge zekerheid",
      medium: "Gemiddelde zekerheid",
      escalated: "Opvolging nodig",
      contents: "{name} — {description}\n\nFuncties:\n• {features}\n\nWerkbladen:\n• {sheets}",
      compatibility: "{name} is gecontroleerd voor {platform}. Google Sheets-ondersteuning: nee.\n\n{boundary}",
      configuration: "{name} ondersteunt de talen Nederlands, Engels (VS/VK) en Duits; valuta {currencies}; thema’s {themes}; en de weergaven {appearances}.",
      download: "Dit is een digitaal downloadproduct. Download de bestanden via je Etsy-aankoop, pak een ZIP-bestand eerst uit en open het .xlsx-bestand in Microsoft Excel Desktop 2019 of nieuwer. Ontbreekt een bestand of opent het niet, laat dan een supportverzoek voorbereiden.",
      privacy: "Deze supportpagina uploadt geen werkmappen en bewaart je vraag niet in browseropslag. Deel geen persoonlijke financiële informatie. Voor een privacy- of beveiligingsincident is persoonlijke opvolging vereist.",
      insufficient: "Ik kan dit niet betrouwbaar beantwoorden uit de gecontroleerde productinformatie. Er is een supportverzoek voorbereid met referentie {reference}.",
      sensitive: "Deze vraag vereist persoonlijke opvolging. Er is een supportverzoek voorbereid met referentie {reference}.",
      escalationText: "Referentie {reference}. Controleer de vooraf ingevulde e-mail en verstuur deze zelf om het supportverzoek in te dienen.",
      sourceProduct: "Canonical product definition",
      sourceLocale: "Reviewed Dutch listing and product locale",
      sourceBoundary: "Verified compatibility and support boundary"
    },
    "en-US": {
      ready: "Product knowledge available",
      readyDetail: "{products} products · {profiles} verified profiles · no external AI API",
      profile: "Source-bound profile · version {version} · {sources} product sources · {platform}",
      questions: {
        contents: "What is included in this product?",
        compatibility: "Does this work in Google Sheets?",
        configuration: "Which languages, currencies and themes are available?",
        download: "How do I open my download?"
      },
      statusReady: "Ready to check verified product knowledge.",
      statusLoading: "Checking product sources…",
      statusDone: "Source-bound answer available.",
      high: "High confidence",
      medium: "Medium confidence",
      escalated: "Follow-up needed",
      contents: "{name} — {description}\n\nFeatures:\n• {features}\n\nWorksheets:\n• {sheets}",
      compatibility: "{name} is verified for {platform}. Google Sheets support: no.\n\n{boundary}",
      configuration: "{name} supports Dutch, English (US/UK) and German; currencies {currencies}; themes {themes}; and appearances {appearances}.",
      download: "This is a digital download. Download the files from your Etsy purchase, extract a ZIP archive first, and open the .xlsx file in Microsoft Excel Desktop 2019 or later. If a file is missing or will not open, prepare a support request.",
      privacy: "This support page does not upload workbooks or persist your question in browser storage. Do not share personal financial information. Privacy or security incidents require personal follow-up.",
      insufficient: "I cannot answer this reliably from the verified product information. A support request has been prepared with reference {reference}.",
      sensitive: "This question requires personal follow-up. A support request has been prepared with reference {reference}.",
      escalationText: "Reference {reference}. Review the pre-filled email and send it yourself to submit the support request.",
      sourceProduct: "Canonical product definition",
      sourceLocale: "Reviewed English listing and product locale",
      sourceBoundary: "Verified compatibility and support boundary"
    },
    "de-DE": {
      ready: "Produktwissen verfügbar",
      readyDetail: "{products} Produkte · {profiles} geprüfte Profile · ohne externe KI-API",
      profile: "Quellengebundenes Profil · Version {version} · {sources} Produktquellen · {platform}",
      questions: {
        contents: "Was ist in diesem Produkt enthalten?",
        compatibility: "Funktioniert das in Google Sheets?",
        configuration: "Welche Sprachen, Währungen und Designs sind verfügbar?",
        download: "Wie öffne ich meinen Download?"
      },
      statusReady: "Bereit, geprüftes Produktwissen zu durchsuchen.",
      statusLoading: "Produktquellen werden geprüft…",
      statusDone: "Quellengebundene Antwort verfügbar.",
      high: "Hohe Sicherheit",
      medium: "Mittlere Sicherheit",
      escalated: "Nachverfolgung erforderlich",
      contents: "{name} — {description}\n\nFunktionen:\n• {features}\n\nArbeitsblätter:\n• {sheets}",
      compatibility: "{name} ist für {platform} geprüft. Google-Sheets-Unterstützung: nein.\n\n{boundary}",
      configuration: "{name} unterstützt Niederländisch, Englisch (US/UK) und Deutsch; Währungen {currencies}; Designs {themes}; und Darstellungen {appearances}.",
      download: "Dies ist ein digitaler Download. Lade die Dateien über deinen Etsy-Kauf herunter, entpacke zuerst ein ZIP-Archiv und öffne die .xlsx-Datei in Microsoft Excel Desktop 2019 oder neuer. Wenn eine Datei fehlt oder sich nicht öffnen lässt, bereite eine Supportanfrage vor.",
      privacy: "Diese Supportseite lädt keine Arbeitsmappen hoch und speichert deine Frage nicht im Browser. Teile keine persönlichen Finanzdaten. Datenschutz- oder Sicherheitsvorfälle erfordern persönliche Bearbeitung.",
      insufficient: "Ich kann dies nicht zuverlässig aus den geprüften Produktinformationen beantworten. Eine Supportanfrage mit der Referenz {reference} wurde vorbereitet.",
      sensitive: "Diese Frage erfordert persönliche Bearbeitung. Eine Supportanfrage mit der Referenz {reference} wurde vorbereitet.",
      escalationText: "Referenz {reference}. Prüfe die vorausgefüllte E-Mail und sende sie selbst, um die Supportanfrage einzureichen.",
      sourceProduct: "Kanonische Produktdefinition",
      sourceLocale: "Geprüfter deutscher Listing- und Produkttext",
      sourceBoundary: "Geprüfte Kompatibilitäts- und Supportgrenze"
    }
  };
  copy["en-GB"] = copy["en-US"];

  function format(template, values) {
    return Object.keys(values).reduce(function (result, key) {
      return result.replaceAll("{" + key + "}", String(values[key]));
    }, template);
  }

  function normalized(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/g, " ")
      .trim();
  }

  function includesAny(text, terms) {
    return terms.some(function (term) { return text.includes(term); });
  }

  function selectedProduct() {
    return state.products.find(function (product) { return product.id === $("product").value; }) || null;
  }

  function selectedLocale() {
    var locale = $("locale").value;
    return copy[locale] ? locale : "en-US";
  }

  function localizedProduct(product, locale) {
    return product.locales[locale] || product.locales["en-US"];
  }

  function createReference() {
    var date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    var bytes = new Uint32Array(2);
    crypto.getRandomValues(bytes);
    return "NND-WEB-" + date + "-" + Array.from(bytes).map(function (value) {
      return value.toString(16).toUpperCase().padStart(8, "0");
    }).join("").slice(0, 10);
  }

  function buildSources(locale, includeBoundary) {
    var t = copy[locale];
    var rows = [t.sourceProduct, t.sourceLocale];
    if (includeBoundary) rows.push(t.sourceBoundary);
    return rows;
  }

  function classify(question) {
    var text = normalized(question);
    if (includesAny(text, ["ignore previous", "system prompt", "api key", "secret", "wachtwoord", "passwort"])) return "unsafe";
    if (includesAny(text, ["refund", "chargeback", "order", "bestelling", "retour", "terugbetaling", "human", "persoon", "medewerker", "mensch", "erstattung"])) return "sensitive";
    if (includesAny(text, ["privacy", "security", "beveilig", "gegevens", "data loss", "kwijt", "corrupt", "datenschutz", "sicherheit", "verloren"])) return "privacy";
    if (includesAny(text, ["google sheets", "libreoffice", "excel", "compatible", "compatib", "werkt", "funktioniert", "unterstützt"])) return "compatibility";
    if (includesAny(text, ["what is included", "contains", "features", "worksheets", "sheets", "tabs", "wat zit", "onderdelen", "functies", "werkbladen", "tabbladen", "enthalten", "funktionen", "arbeitsblatter"])) return "contents";
    if (includesAny(text, ["language", "locale", "currency", "theme", "appearance", "dark", "light", "taal", "valuta", "thema", "weergave", "sprache", "wahrung", "design", "darstellung"])) return "configuration";
    if (includesAny(text, ["download", "open", "install", "zip", "xlsx", "bestand", "openen", "installeren", "herunterladen", "offnen", "entpacken"])) return "download";
    return "unknown";
  }

  function createEscalation(product, locale, question, reason) {
    var reference = createReference();
    var productText = localizedProduct(product, locale);
    var subject = "NumberNinjaDesigns support request [" + reference + "]";
    var body = [
      "Reference: " + reference,
      "Product: " + productText.name + " (" + product.id + ")",
      "Version: " + product.version,
      "Language: " + locale,
      "Reason: " + reason,
      "",
      "Question:",
      question.slice(0, 800),
      "",
      "Please remove personal, payment and financial information before sending."
    ].join("\n");
    return {
      reference: reference,
      href: "mailto:support@numberninjadesigns.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body)
    };
  }

  function resolveAnswer(product, locale, question) {
    var t = copy[locale];
    var item = localizedProduct(product, locale);
    var intent = classify(question);
    var base = {
      name: item.name,
      description: item.description,
      features: item.features.join("\n• "),
      sheets: item.sheets.join("\n• "),
      platform: product.platforms.join(", "),
      boundary: product.compatibility.boundary,
      currencies: product.currencies.join(", "),
      themes: product.themes.join(", "),
      appearances: product.appearances.join(", ")
    };

    if (intent === "contents") return { answer: format(t.contents, base), confidence: "high", sources: buildSources(locale, false) };
    if (intent === "compatibility") return { answer: format(t.compatibility, base), confidence: "high", sources: buildSources(locale, true) };
    if (intent === "configuration") return { answer: format(t.configuration, base), confidence: "high", sources: buildSources(locale, false) };
    if (intent === "download") return { answer: t.download, confidence: "medium", sources: buildSources(locale, true) };
    if (intent === "privacy") {
      var privacyEscalation = createEscalation(product, locale, question, "privacy_or_security");
      return {
        answer: t.privacy + "\n\n" + format(t.sensitive, privacyEscalation),
        confidence: "escalated",
        sources: buildSources(locale, true),
        escalation: privacyEscalation
      };
    }

    var escalation = createEscalation(product, locale, question, intent === "sensitive" ? "order_refund_or_human" : "insufficient_product_evidence");
    return {
      answer: format(intent === "sensitive" ? t.sensitive : t.insufficient, escalation),
      confidence: "escalated",
      sources: buildSources(locale, true),
      escalation: escalation
    };
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function renderSources(sources) {
    clearNode($("source-list"));
    sources.forEach(function (source) {
      var item = document.createElement("li");
      item.textContent = source;
      $("source-list").appendChild(item);
    });
  }

  function renderAnswer(result, locale) {
    clearTimeout(state.responseTimer);
    $("loading-state").hidden = true;
    $("answer-content").hidden = false;
    $("answer-text").textContent = result.answer;
    $("confidence").textContent = copy[locale][result.confidence];
    $("answer-panel").dataset.state = result.escalation ? "escalated" : "ready";
    renderSources(result.sources);
    if (result.escalation) {
      $("escalation").hidden = false;
      $("escalation-text").textContent = format(copy[locale].escalationText, result.escalation);
      $("email-support").href = result.escalation.href;
    } else {
      $("escalation").hidden = true;
      $("email-support").removeAttribute("href");
    }
    $("form-status").textContent = copy[locale].statusDone;
    $("submit-question").disabled = false;
    $("live-region").textContent = copy[locale].statusDone;
  }

  function updateProductOptions() {
    clearNode($("product"));
    var locale = selectedLocale();
    state.products
      .slice()
      .sort(function (left, right) {
        return localizedProduct(left, locale).name.localeCompare(localizedProduct(right, locale), locale);
      })
      .forEach(function (product) {
        var option = document.createElement("option");
        option.value = product.id;
        option.textContent = localizedProduct(product, locale).name;
        $("product").appendChild(option);
      });
  }

  function updateProfile() {
    var product = selectedProduct();
    var locale = selectedLocale();
    if (!product) return;
    document.documentElement.lang = locale;
    $("profile-status").textContent = format(copy[locale].profile, {
      version: product.version,
      sources: 3,
      platform: product.platforms[0]
    });
    $("form-status").textContent = copy[locale].statusReady;
    var buttons = document.querySelectorAll("[data-question]");
    buttons.forEach(function (button) {
      button.textContent = copy[locale].questions[button.dataset.question];
    });
  }

  function handleLocaleChange() {
    var previousProduct = $("product").value;
    updateProductOptions();
    if (state.products.some(function (product) { return product.id === previousProduct; })) {
      $("product").value = previousProduct;
    }
    updateProfile();
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!$("support-form").reportValidity()) return;
    var product = selectedProduct();
    var locale = selectedLocale();
    var question = $("question").value.trim();
    if (!product || question.length < 8) return;
    $("submit-question").disabled = true;
    $("empty-state").hidden = true;
    $("answer-content").hidden = true;
    $("loading-state").hidden = false;
    $("answer-panel").dataset.state = "loading";
    $("confidence").textContent = copy[locale].statusLoading;
    $("form-status").textContent = copy[locale].statusLoading;
    var result = resolveAnswer(product, locale, question);
    state.responseTimer = window.setTimeout(function () { renderAnswer(result, locale); }, 260);
  }

  function initialize() {
    if (!data || !Array.isArray(data.products) || data.products.length === 0) {
      $("availability").dataset.state = "error";
      $("availabilityTitle").textContent = "Product knowledge unavailable";
      $("availabilityDetail").textContent = "Use the contact page for personal support.";
      $("submit-question").disabled = true;
      return;
    }
    state.products = data.products.slice();
    updateProductOptions();
    updateProfile();
    var locale = selectedLocale();
    $("availability").dataset.state = "ready";
    $("availabilityTitle").textContent = copy[locale].ready;
    $("availabilityDetail").textContent = format(copy[locale].readyDetail, {
      products: state.products.length,
      profiles: state.products.length * 4
    });
    $("support-form").addEventListener("submit", handleSubmit);
    $("locale").addEventListener("change", function () {
      handleLocaleChange();
      var currentLocale = selectedLocale();
      $("availabilityTitle").textContent = copy[currentLocale].ready;
      $("availabilityDetail").textContent = format(copy[currentLocale].readyDetail, {
        products: state.products.length,
        profiles: state.products.length * 4
      });
    });
    $("product").addEventListener("change", updateProfile);
    document.querySelectorAll("[data-question]").forEach(function (button) {
      button.addEventListener("click", function () {
        $("question").value = copy[selectedLocale()].questions[button.dataset.question];
        $("support-form").requestSubmit();
      });
    });
  }

  window.addEventListener("pagehide", function () {
    clearTimeout(state.responseTimer);
    $("question").value = "";
  });

  initialize();
}());
