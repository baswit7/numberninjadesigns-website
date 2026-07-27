(() => {
  "use strict";

  const CONSENT_KEY = "nnd_privacy_consent_v1";
  const CONSENT_VERSION = 1;
  const PINTEREST_TAG_ID = "2613073368837";
  const CONSENT_SCRIPT_URL = document.currentScript?.src || document.baseURI;
  const PRODUCTION_HOSTS = new Set([
    "numberninjadesigns.com",
    "www.numberninjadesigns.com"
  ]);
  const PINTEREST_COOKIE_NAMES = [
    "_epik",
    "_derived_epik",
    "_pin_unauth",
    "_pinterest_ct",
    "_pinterest_ct_rt",
    "_pinterest_ct_ua",
    "_pin_aem"
  ];

  let consent = readConsent();
  let pinterestLoaded = false;

  function debug(message, detail) {
    if (detail === undefined) {
      console.info(`[NND Consent] ${message}`);
      return;
    }
    console.info(`[NND Consent] ${message}`, detail);
  }

  function readConsent() {
    try {
      const value = window.localStorage.getItem(CONSENT_KEY);
      if (!value) return null;

      const parsed = JSON.parse(value);
      if (
        parsed &&
        parsed.version === CONSENT_VERSION &&
        typeof parsed.pinterest === "boolean"
      ) {
        return parsed;
      }
    } catch (error) {
      debug("Stored preference could not be read; asking again.");
    }
    return null;
  }

  function persistConsent(pinterest) {
    const previous = consent;
    consent = {
      version: CONSENT_VERSION,
      pinterest,
      updatedAt: new Date().toISOString()
    };

    try {
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    } catch (error) {
      debug("Preference could not be stored in this browser.");
    }

    window.dispatchEvent(
      new CustomEvent("nnd:consent", {
        detail: { pinterest }
      })
    );

    if (pinterest) {
      loadPinterest();
    } else {
      clearPinterestCookies();
      if (previous?.pinterest && window.pintrk) {
        window.location.reload();
        return;
      }
    }

    renderConsentControls();
  }

  function privacyPolicyUrl() {
    try {
      return new URL("privacy.html#cookies-and-pinterest", CONSENT_SCRIPT_URL).href;
    } catch (error) {
      return "/privacy.html#cookies-and-pinterest";
    }
  }

  function createButton(label, className, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }

  function renderConsentControls() {
    document.getElementById("nnd-consent-root")?.remove();

    const root = document.createElement("div");
    root.id = "nnd-consent-root";
    document.body.append(root);

    if (!consent) {
      root.append(createBanner(root));
      return;
    }

    const preferencesButton = createButton(
      "Privacy choices",
      "nnd-consent-reopen",
      () => openPreferences(root)
    );
    preferencesButton.setAttribute("aria-label", "Review privacy and Pinterest measurement choices");
    root.append(preferencesButton);
  }

  function createBanner(root) {
    const banner = document.createElement("section");
    banner.className = "nnd-consent-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-modal", "true");
    banner.setAttribute("aria-labelledby", "nnd-consent-title");
    banner.setAttribute("aria-describedby", "nnd-consent-description");

    const copy = document.createElement("div");
    copy.className = "nnd-consent-copy";

    const title = document.createElement("h2");
    title.id = "nnd-consent-title";
    title.textContent = "Your privacy. Your call.";

    const description = document.createElement("p");
    description.id = "nnd-consent-description";
    description.textContent =
      "We use optional Pinterest measurement only with your permission. Necessary storage remembers your choice; no advertising tag loads before consent.";

    const policyLink = document.createElement("a");
    policyLink.href = privacyPolicyUrl();
    policyLink.textContent = "Read the privacy details";

    copy.append(title, description, policyLink);

    const actions = document.createElement("div");
    actions.className = "nnd-consent-actions";
    actions.append(
      createButton("Reject optional", "nnd-consent-button nnd-consent-button-secondary", () =>
        persistConsent(false)
      ),
      createButton("Manage choices", "nnd-consent-button nnd-consent-button-secondary", () =>
        openPreferences(root)
      ),
      createButton("Accept Pinterest", "nnd-consent-button nnd-consent-button-primary", () =>
        persistConsent(true)
      )
    );

    banner.append(copy, actions);
    return banner;
  }

  function openPreferences(root) {
    root.querySelector(".nnd-consent-modal-backdrop")?.remove();

    const backdrop = document.createElement("div");
    backdrop.className = "nnd-consent-modal-backdrop";

    const modal = document.createElement("section");
    modal.className = "nnd-consent-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "nnd-preferences-title");

    const title = document.createElement("h2");
    title.id = "nnd-preferences-title";
    title.textContent = "Privacy choices";

    const necessary = document.createElement("div");
    necessary.className = "nnd-consent-option";
    necessary.innerHTML =
      "<div><strong>Necessary storage</strong><p>Remembers this preference and supports essential site operation.</p></div><span>Always on</span>";

    const optional = document.createElement("label");
    optional.className = "nnd-consent-option";
    optional.htmlFor = "nnd-pinterest-consent";

    const optionalCopy = document.createElement("div");
    optionalCopy.innerHTML =
      "<strong>Pinterest measurement</strong><p>Measures permitted page visits for Pinterest analytics and campaign attribution. No automatic enhanced matching.</p>";

    const toggle = document.createElement("input");
    toggle.id = "nnd-pinterest-consent";
    toggle.type = "checkbox";
    toggle.checked = consent?.pinterest === true;
    optional.append(optionalCopy, toggle);

    const policyLink = document.createElement("a");
    policyLink.href = privacyPolicyUrl();
    policyLink.textContent = "Privacy policy and withdrawal information";

    const actions = document.createElement("div");
    actions.className = "nnd-consent-actions";
    const close = () => {
      backdrop.remove();
      root.querySelector(".nnd-consent-reopen")?.focus();
    };
    actions.append(
      createButton("Cancel", "nnd-consent-button nnd-consent-button-secondary", close),
      createButton("Save choices", "nnd-consent-button nnd-consent-button-primary", () =>
        persistConsent(toggle.checked)
      )
    );

    modal.append(title, necessary, optional, policyLink, actions);
    backdrop.append(modal);
    root.append(backdrop);
    toggle.focus();

    backdrop.addEventListener("click", event => {
      if (event.target === backdrop) close();
    });
    modal.addEventListener("keydown", event => {
      if (event.key === "Escape") close();
    });
  }

  function createEventId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `nnd-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadPinterest() {
    if (pinterestLoaded || !PRODUCTION_HOSTS.has(window.location.hostname)) {
      if (!PRODUCTION_HOSTS.has(window.location.hostname)) {
        debug("Pinterest measurement skipped outside production.");
      }
      return;
    }

    pinterestLoaded = true;
    if (!window.pintrk) {
      window.pintrk = function () {
        window.pintrk.queue.push(Array.prototype.slice.call(arguments));
      };
      window.pintrk.queue = [];
      window.pintrk.version = "3.0";

      const script = document.createElement("script");
      script.async = true;
      script.src = "https://s.pinimg.com/ct/core.js";
      script.onerror = () => {
        pinterestLoaded = false;
        debug("Pinterest script failed to load.");
      };
      document.head.append(script);
    }

    window.pintrk("load", PINTEREST_TAG_ID);
    window.pintrk("page");
    window.pintrk("track", "pagevisit", {
      event_id: createEventId()
    });
    debug("Pinterest PageVisit queued with consent.");
  }

  function clearPinterestCookies() {
    const domains = ["", window.location.hostname, ".numberninjadesigns.com"];
    for (const name of PINTEREST_COOKIE_NAMES) {
      for (const domain of domains) {
        const domainPart = domain ? `; domain=${domain}` : "";
        document.cookie = `${name}=; Max-Age=0; path=/${domainPart}; SameSite=Lax`;
      }
    }
  }

  function initialize() {
    if (navigator.globalPrivacyControl === true && !consent) {
      persistConsent(false);
      debug("Global Privacy Control detected; optional measurement disabled.");
      return;
    }

    renderConsentControls();
    if (consent?.pinterest) loadPinterest();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
