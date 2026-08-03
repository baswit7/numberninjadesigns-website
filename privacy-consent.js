(() => {
  'use strict';

  const STORAGE_KEY = 'nnd_privacy_consent_v1';
  const TAG_ID = '2613073368837';
  const CONSENT_VERSION = 1;
  const SCRIPT_URL = 'https://s.pinimg.com/ct/core.js';
  const scriptElement = document.currentScript;
  const privacyUrl = new URL('privacy.html', scriptElement?.src || document.baseURI).href;
  let tagLoaded = false;

  const log = (message, detail = {}) => {
    console.info('[NND Privacy]', message, detail);
  };

  const readConsent = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return value?.version === CONSENT_VERSION && typeof value.marketing === 'boolean'
        ? value
        : null;
    } catch (error) {
      console.warn('[NND Privacy] Consent recovery failed.', error);
      return null;
    }
  };

  const writeConsent = (marketing) => {
    const value = {
      version: CONSENT_VERSION,
      necessary: true,
      marketing,
      updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
      console.warn('[NND Privacy] Consent persistence failed.', error);
    }
    return value;
  };

  const loadPinterestTag = () => {
    if (tagLoaded || window.pintrk) return;

    window.pintrk = function pintrk() {
      window.pintrk.queue.push(Array.from(arguments));
    };
    window.pintrk.queue = [];
    window.pintrk.version = '3.0';

    const tagScript = document.createElement('script');
    tagScript.async = true;
    tagScript.src = SCRIPT_URL;
    tagScript.addEventListener('load', () => log('Pinterest tag connected.'));
    tagScript.addEventListener('error', () => {
      console.warn('[NND Privacy] Pinterest tag could not be loaded.');
    });
    document.head.appendChild(tagScript);

    window.pintrk('load', TAG_ID);
    window.pintrk('page');
    window.pintrk('track', 'pagevisit', { page_name: document.title });
    tagLoaded = true;
  };

  const sendEvent = (name, payload = {}) => {
    if (readConsent()?.marketing !== true) {
      log(`Event ${name} suppressed: no marketing consent.`);
      return false;
    }
    loadPinterestTag();
    window.pintrk('track', name, payload);
    return true;
  };

  const removeDialog = () => {
    document.querySelector('[data-nnd-consent]')?.remove();
  };

  const renderDialog = () => {
    removeDialog();
    const dialog = document.createElement('section');
    dialog.className = 'nnd-consent';
    dialog.dataset.nndConsent = '';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'nnd-consent-title');
    dialog.innerHTML = `
      <div class="nnd-consent__copy">
        <strong id="nnd-consent-title">Privacykeuze</strong>
        <p>We gebruiken noodzakelijke opslag voor je voorkeuren. Pinterest-marketingmeting laden we alleen met jouw toestemming.</p>
        <a href="${privacyUrl}">Privacybeleid</a>
      </div>
      <div class="nnd-consent__actions">
        <button type="button" data-consent="necessary">Alleen noodzakelijk</button>
        <button type="button" class="nnd-consent__allow" data-consent="marketing">Marketing toestaan</button>
      </div>`;

    dialog.addEventListener('click', (event) => {
      const button = event.target.closest('[data-consent]');
      if (!button) return;
      const previous = readConsent();
      const consent = writeConsent(button.dataset.consent === 'marketing');
      removeDialog();
      if (consent.marketing) loadPinterestTag();
      document.dispatchEvent(new CustomEvent('nnd:consent-changed', { detail: consent }));
      log('Consent preference updated.', { marketing: consent.marketing });
      if (previous?.marketing === true && consent.marketing === false) {
        window.location.reload();
      }
    });
    document.body.appendChild(dialog);
  };

  const installStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
      .nnd-consent{position:fixed;z-index:2147483000;right:1rem;bottom:1rem;left:1rem;display:flex;gap:1rem;align-items:center;justify-content:space-between;max-width:72rem;margin:auto;padding:1rem 1.1rem;border:1px solid rgba(110,231,255,.24);border-radius:1rem;background:#11151b;color:#f3f5f7;box-shadow:0 1.5rem 4rem rgba(7,9,12,.55);font:500 .92rem/1.5 system-ui,sans-serif}
      .nnd-consent strong{display:block;margin-bottom:.2rem;color:#6ee7ff;font-size:1rem}
      .nnd-consent p{max-width:52rem;margin:0;color:#f3f5f7}
      .nnd-consent a{color:#6ee7ff;text-underline-offset:.2em}
      .nnd-consent__actions{display:flex;flex:0 0 auto;gap:.65rem}
      .nnd-consent button{min-height:2.75rem;padding:.65rem .9rem;border:1px solid rgba(110,231,255,.24);border-radius:.7rem;background:#151b23;color:#f3f5f7;font:700 .82rem/1 system-ui,sans-serif;cursor:pointer}
      .nnd-consent button:hover,.nnd-consent button:focus-visible{border-color:#6ee7ff;outline:2px solid transparent}
      .nnd-consent .nnd-consent__allow{border-color:#00e891;background:#00e891;color:#07090c}
      @media(max-width:720px){.nnd-consent{align-items:stretch;flex-direction:column}.nnd-consent__actions{display:grid;grid-template-columns:1fr}.nnd-consent button{width:100%}}
      @media(prefers-reduced-motion:reduce){.nnd-consent *{scroll-behavior:auto!important}}
    `;
    document.head.appendChild(style);
  };

  window.NNDTracking = Object.freeze({
    pageVisit: (payload = {}) => sendEvent('pagevisit', payload),
    addToCart: (payload) => sendEvent('addtocart', payload),
    checkout: (payload) => sendEvent('checkout', payload)
  });
  window.NNDConsent = Object.freeze({
    current: readConsent,
    open: renderDialog
  });

  const initialize = () => {
    installStyles();
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-nnd-open-consent]')) renderDialog();
    });
    const consent = readConsent();
    if (!consent) {
      renderDialog();
    } else if (consent.marketing) {
      loadPinterestTag();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
