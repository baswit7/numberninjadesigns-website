const HTML_HEADERS = Object.freeze({
  'cache-control': 'no-store, max-age=0, must-revalidate',
  'content-security-policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
  'content-type': 'text/html; charset=utf-8',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'camera=(), clipboard-read=(), clipboard-write=(self), geolocation=(), microphone=(), payment=()',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'x-robots-tag': 'noindex, nofollow, noarchive'
});

const MAX_CALLBACK_VALUE_LENGTH = 4096;

function sendHtml(response, statusCode, body, extraHeaders = {}) {
  response.statusCode = statusCode;
  for (const [name, value] of Object.entries({ ...HTML_HEADERS, ...extraHeaders })) {
    response.setHeader(name, value);
  }
  response.end(body);
}

function hasSafeSingleValue(searchParams, name) {
  const values = searchParams.getAll(name);
  if (values.length !== 1) return false;

  const value = values[0];
  return value.length > 0 &&
    value.length <= MAX_CALLBACK_VALUE_LENGTH &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

function renderPage({ success }) {
  const heading = success
    ? 'Pinterest-toestemming ontvangen'
    : 'Pinterest-koppeling niet voltooid';
  const message = success
    ? 'Kopieer de beveiligde callback en ga daarna terug naar Finance OS om de koppeling af te ronden.'
    : 'Start de Pinterest-koppeling opnieuw vanuit Finance OS. Er zijn geen geldige autorisatiegegevens verwerkt.';
  const action = success
    ? '<button id="copy-callback" type="button">Callback veilig kopiëren</button>'
    : '';
  const script = success
    ? `<script>
        (() => {
          const button = document.getElementById('copy-callback');
          const status = document.getElementById('copy-status');
          const callbackUri = window.location.href;
          button.addEventListener('click', async () => {
            button.disabled = true;
            try {
              await navigator.clipboard.writeText(callbackUri);
              window.history.replaceState({}, document.title, window.location.pathname);
              status.textContent = 'Gekopieerd. De gevoelige parameters zijn uit de adresbalk verwijderd.';
            } catch {
              status.textContent = 'Automatisch kopiëren werd geblokkeerd. Kopieer de volledige adresbalk handmatig en sluit dit tabblad daarna.';
              button.disabled = false;
            }
          });
        })();
      </script>`
    : `<script>
        window.history.replaceState({}, document.title, window.location.pathname);
      </script>`;

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>${heading}</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        background: #07090C;
        color: #F3F5F7;
        font-family: system-ui, sans-serif;
      }
      main {
        width: min(640px, 100%);
        padding: clamp(28px, 7vw, 56px);
        border: 1px solid #151B23;
        border-radius: 20px;
        background: #11151B;
      }
      .eyebrow {
        margin: 0 0 12px;
        color: #6EE7FF;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      h1 { margin: 0; font-size: clamp(2rem, 8vw, 3.5rem); line-height: 1; }
      p { margin: 20px 0 0; color: #8B96A5; line-height: 1.65; }
      button {
        width: 100%;
        margin-top: 28px;
        padding: 16px 20px;
        border: 0;
        border-radius: 12px;
        background: #00E891;
        color: #07090C;
        font: inherit;
        font-weight: 850;
        cursor: pointer;
      }
      button:disabled { cursor: progress; }
      #copy-status { min-height: 1.65em; font-size: 0.92rem; }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">NumberNinjaDesigns · Secure OAuth</p>
      <h1>${heading}</h1>
      <p>${message}</p>
      ${action}
      <p id="copy-status" role="status" aria-live="polite"></p>
    </main>
    ${script}
  </body>
</html>`;
}

export default function pinterestOAuthCallback(request, response) {
  if (request.method !== 'GET') {
    sendHtml(response, 405, renderPage({ success: false }), { allow: 'GET' });
    return;
  }

  const callbackUrl = new URL(request.url, 'https://api.numberninjadesigns.com');
  const hasProviderError = callbackUrl.searchParams.has('error');
  const validCallback = !hasProviderError &&
    hasSafeSingleValue(callbackUrl.searchParams, 'code') &&
    hasSafeSingleValue(callbackUrl.searchParams, 'state');

  sendHtml(response, validCallback ? 200 : 400, renderPage({ success: validCallback }));
}
