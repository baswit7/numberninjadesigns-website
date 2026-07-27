import {
  disabledStatus,
  requireMethod,
  sendJson
} from '../src/vercel-disabled.mjs';

export default function status(request, response) {
  if (!requireMethod(request, response, 'GET')) return;
  sendJson(response, 200, disabledStatus);
}
