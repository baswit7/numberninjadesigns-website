import {
  requireBearer,
  requireMethod,
  sendError,
  sendJson,
} from '../src/nn115/http-security.mjs';
import { createProjectManagerRuntime } from '../src/nn115/projectmanager-runtime.mjs';

export function createProjectManagerStatusHandler({
  env = process.env,
  runtimeFactory = () => createProjectManagerRuntime(env),
} = {}) {
  return async function projectManagerStatus(request, response) {
    try {
      requireMethod(request, 'GET');
      requireBearer(request, env.PROJECTMANAGER_ADMIN_SECRET);
      const runtime = await runtimeFactory();
      const status = await runtime.status();
      sendJson(response, status.ok ? 200 : 503, status);
    } catch (error) {
      if (error?.code === 'METHOD_NOT_ALLOWED') error.allowedMethod = 'GET';
      sendError(response, error);
    }
  };
}

export default createProjectManagerStatusHandler();
