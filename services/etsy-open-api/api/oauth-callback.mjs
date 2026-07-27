import { requireMethod, sendJson } from '../src/vercel-disabled.mjs';

export default function oauthCallback(request, response) {
  if (!requireMethod(request, response, 'GET')) return;
  sendJson(response, 503, {
    provider: 'etsy',
    state: 'error',
    executionEnabled: false,
    providerCallsAllowed: false,
    errorCode: 'EXECUTION_DISABLED',
    message: 'OAuth callback handling is disabled until Etsy approval and go-live review.'
  });
}
