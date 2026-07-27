const BASE_HEADERS = Object.freeze({
  'cache-control': 'no-store, max-age=0',
  'content-type': 'application/json; charset=utf-8',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff'
});

export const disabledStatus = Object.freeze({
  provider: 'etsy',
  state: 'error',
  executionEnabled: false,
  providerCallsAllowed: false,
  lastCheckedAt: null,
  errorCode: 'EXECUTION_DISABLED',
  reconnectRequired: false
});

export function sendJson(response, statusCode, body, extraHeaders = {}) {
  response.statusCode = statusCode;
  for (const [name, value] of Object.entries({ ...BASE_HEADERS, ...extraHeaders })) {
    response.setHeader(name, value);
  }
  response.end(JSON.stringify(body));
}

export function requireMethod(request, response, method) {
  if (request.method === method) return true;
  sendJson(response, 405, { errorCode: 'METHOD_NOT_ALLOWED' }, { allow: method });
  return false;
}
