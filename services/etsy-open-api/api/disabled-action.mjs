import {
  disabledStatus,
  requireMethod,
  sendJson
} from '../src/vercel-disabled.mjs';

export default function disabledAction(request, response) {
  if (!requireMethod(request, response, 'POST')) return;
  sendJson(response, 503, {
    ...disabledStatus,
    message: 'Etsy operations are disabled until approval and go-live review.'
  });
}
