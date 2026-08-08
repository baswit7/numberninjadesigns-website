import { randomUUID } from 'node:crypto';

import {
  HttpBoundaryError,
  header,
  readStrictJson,
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

const PILOT_ID = /^nn115-live-pilot-[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function validateBody(value, request) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpBoundaryError('REQUEST_SCHEMA_INVALID', 400);
  const keys = Object.keys(value);
  if (value.ownerIntent !== OWNER_INTENT) {
    throw new HttpBoundaryError('OWNER_INTENT_REJECTED', 400);
  }
  if (keys.length === 1 && keys[0] === 'ownerIntent') return Object.freeze({ ownerIntent: value.ownerIntent, pilotId: null });
  if (
    keys.length === 3
    && keys.every(key => ['ownerIntent', 'pilotMode', 'pilotId'].includes(key))
    && value.pilotMode === 'CONTROLLED_INTERRUPTION_V1'
    && typeof value.pilotId === 'string'
    && value.pilotId.length <= 80
    && PILOT_ID.test(value.pilotId)
    && header(request, 'x-nn115-pilot') === 'CONTROLLED_INTERRUPTION_V1'
  ) return Object.freeze({ ownerIntent: value.ownerIntent, pilotId: value.pilotId });
  throw new HttpBoundaryError('EXECUTION_CONTROL_REJECTED', 400);
}

export function createProjectManagerExecutionsHandler({
  env = process.env,
  runtimeFactory = () => createProjectManagerRuntime(env),
  clock = Date.now,
  uuid = randomUUID,
} = {}) {
  return async function projectManagerExecutions(request, response) {
    try {
      requireMethod(request, 'POST');
      requireBearer(request, env.ETSY_ADMIN_TOKEN);
      const body = validateBody(await readStrictJson(request), request);
      const now = new Date(clock());
      const runtime = await runtimeFactory();
      const recoveryPilot = body.pilotId !== null;
      const result = await runtime.execute({
        ownerIntent: body.ownerIntent,
        idempotencyKey: recoveryPilot
          ? `NN-115:etsy-intelligence:interruption:v1:${body.pilotId}`
          : dailyExecutionKey(now),
        invocationId: `${recoveryPilot ? 'recovery-pilot' : 'owner-request'}-${uuid()}`,
        control: recoveryPilot ? Object.freeze({ controlledInterruption: true }) : null,
      });
      sendJson(response, result.reason ? 202 : 200, result);
    } catch (error) {
      if (error?.code === 'METHOD_NOT_ALLOWED') error.allowedMethod = 'POST';
      sendError(response, error);
    }
  };
}

export default createProjectManagerExecutionsHandler();
