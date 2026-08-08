import { randomUUID } from 'node:crypto';

import {
  requireBearer,
  requireMethod,
  sendError,
  sendJson,
} from '../src/nn115/http-security.mjs';
import {
  createProjectManagerRuntime,
  dailyExecutionKey,
  OWNER_INTENT,
} from '../src/nn115/projectmanager-runtime.mjs';

export function createProjectManagerCronHandler({
  env = process.env,
  runtimeFactory = () => createProjectManagerRuntime(env),
  clock = Date.now,
  uuid = randomUUID,
} = {}) {
  return async function projectManagerCron(request, response) {
    try {
      requireMethod(request, 'GET');
      requireBearer(request, env.CRON_SECRET);
      const now = new Date(clock());
      const runtime = await runtimeFactory();
      const result = await runtime.execute({
        ownerIntent: OWNER_INTENT,
        idempotencyKey: dailyExecutionKey(now),
        invocationId: `vercel-cron-${uuid()}`,
      });
      sendJson(response, result.reason ? 202 : 200, result);
    } catch (error) {
      if (error?.code === 'METHOD_NOT_ALLOWED') error.allowedMethod = 'GET';
      sendError(response, error);
    }
  };
}

export default createProjectManagerCronHandler();
