import { requireMethod, sendJson } from '../src/vercel-disabled.mjs';

export default function health(request, response) {
  if (!requireMethod(request, response, 'GET')) return;
  sendJson(response, 200, {
    ok: true,
    service: 'numberninjadesigns-etsy-api',
    executionEnabled: false,
    providerCallsAllowed: false
  });
}
