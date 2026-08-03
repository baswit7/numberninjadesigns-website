(function completeOAuthCallback(global, document) {
  'use strict';

  const provider = document.body.dataset.provider;
  const status = document.getElementById('callbackStatus');
  const detail = document.getElementById('callbackDetail');
  const returnLink = document.getElementById('callbackReturn');
  const allowedProviders = new Set(['etsy', 'tiktok']);

  function fail() {
    status.textContent = 'Connection not completed';
    detail.textContent = 'The authorization response was rejected or expired. Return to the publisher and start the connection again.';
    returnLink.hidden = false;
  }

  async function complete() {
    const params = new URLSearchParams(global.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const providerError = params.get('error');

    global.history.replaceState({}, '', global.location.pathname);
    if (!allowedProviders.has(provider) || !state || !/^[A-Za-z0-9_-]{40,100}$/u.test(state)) {
      fail();
      return;
    }
    if (!providerError && (!code || code.length > 2_048)) {
      fail();
      return;
    }

    try {
      const response = await fetch('/api/social-publisher?action=oauth-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          state,
          ...(providerError ? { error: providerError.slice(0, 80) } : { code }),
        }),
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
      });
      const payload = String(response.headers.get('content-type') || '').includes('application/json')
        ? await response.json().catch(() => null)
        : null;
      if (!response.ok || payload?.ok !== true) throw new Error('callback-rejected');
      global.location.replace(`/social-publisher/?connected=${encodeURIComponent(provider)}`);
    } catch {
      fail();
    }
  }

  complete();
})(window, document);
