# AI Workforce Control Center Architecture

## Positionering

De module is een nieuwe Studio OS control-plane cockpit, geen nieuw platform. Zij consumeert governance-, readiness- en toekomstige execution-projecties en bezit geen business rules die al in Phase 9/10-services thuishoren.

De organisatiehiërarchie is `NumberNinjaDesigns` → `Digital Production` en `Physical Production`. Studio OS is de gedeelde control plane voor beide producttakken en is geen zelfstandig klantmerk.

## Slimste architectuur

```text
Browser module
  ├─ Presentation (shell, graph, editor, inspector)
  ├─ Local definition store (versioned, recoverable)
  └─ Control-plane client (future)
       ├─ Agent Registry API
       ├─ Workflow API
       ├─ Task Command API
       ├─ Approval API
       └─ EventStream projection
              ↓
Existing Governance + Readiness boundaries
              ↓
Future authorized Execution Plane
              ├─ Orchestrator / queues / workers
              ├─ Provider + MCP adapter registry
              ├─ Vault / RBAC / policy engine
              └─ Immutable audit + telemetry storage
```

## Datamodel

- AgentDefinition: identiteit, team, rol, prompt, expertise, tools, providerbinding en statusprojectie.
- ToolManifest: capability, transport, authmode, configuratieschema en healthcheck.
- WorkflowDefinition: versioned DAG met start, decision, approval, loop, condition, parallel, retry, error, timeout en webhook-nodes.
- Task: queue-item met status `Queued|Running|Waiting|Blocked|Completed|Failed|Cancelled`, priority, assignee en timestamps.
- Approval: risiconiveau, policyreferentie, requester, approver, beslissing en motivatie.
- AuditEvent: actor, action, timestamp, correlation/causation, prompt/response/tool/API/MCP-gegevens, tokens, kosten, runtime, error en retry.
- TelemetrySnapshot: agent health, queue depth, latency, token/cost/error/success counters en freshness.

## API-contract (toekomstige runtime)

Alle requests gebruiken OAuth2/OIDC access tokens, `Idempotency-Key`, `X-Correlation-Id` en server-side RBAC.

| Method | Route | Functie |
|---|---|---|
| GET/POST | `/v1/agents` | lijst/registreer agent |
| GET/PATCH | `/v1/agents/{id}` | detail/configuratie |
| POST | `/v1/agents/{id}:start` | start na policycheck |
| POST | `/v1/agents/{id}:stop` | graceful stop |
| GET/POST | `/v1/workflows` | lijst/registreer workflow |
| POST | `/v1/workflows/{id}:execute` | readiness + execution request |
| GET/POST | `/v1/tasks` | queues en taaktoewijzing |
| POST | `/v1/approvals/{id}:decide` | menselijke beslissing |
| GET | `/v1/audit-events` | cursor-paginated audittrail |
| GET | `/v1/telemetry/snapshot` | actuele KPI-projectie |
| GET | `/v1/events` | SSE/WebSocket eventstream |

Mutaties retourneren `202 Accepted` met een operation-id. Retries zijn alleen veilig met dezelfde idempotency-key. Rate limits gebruiken `429` plus `Retry-After`; clients gebruiken capped exponential backoff met jitter. Tokenexpiry leidt tot één refreshpoging en daarna fail-closed logout.

## Eventmodel

CloudEvents-compatibele envelopes met `id`, `source`, `type`, `subject`, `time`, `correlationId`, `causationId`, `schemaVersion` en `data`. Kern-events: `agent.registered`, `agent.status.changed`, `task.queued`, `task.started`, `task.completed`, `task.failed`, `workflow.started`, `workflow.step.changed`, `approval.requested`, `approval.decided`, `tool.called`, `provider.called`, `audit.recorded`.

## CEO-orchestrator

De toekomstige CEO planner produceert uitsluitend een declaratief execution plan: specialistselectie op capabilities, dependency-DAG, parallelle branches, policygedreven approvals, retrybudget, timeout en stopcriteria. Governance en readiness valideren het plan vóór dispatch. De CEO kan policies niet omzeilen.

## State management

De huidige module gebruikt één versioned state-envelope met recoverable parsing en immutable audit-events. Productie vervangt lokale persistence door server snapshots + eventstream reconciliation. Server state blijft authoritative; optimistic updates worden alleen gebruikt voor omkeerbare cockpitvoorkeuren.

## Security

- OIDC + korte access tokens; server-side RBAC/ABAC en least privilege.
- Secrets in een KMS-backed vault, nooit in frontend/localStorage/logs.
- TLS, encrypted storage, rotatie en per-adapter service identities.
- Approval separation-of-duties en signed immutable auditrecords.
- CSP, outputencoding, requestvalidatie, rate limiting en egress allowlists.
- Prompt/tool isolation, capability allowlists en menselijke approval voor high-impact acties.

## Migratieplan

1. Phase 12: cockpit en contracten read-only activeren (deze levering).
2. Agent/tool registries server-side invoeren en lokale definities importeren.
3. Audit/eventstore en telemetryprojecties koppelen; cockpit blijft read-only.
4. OIDC/RBAC/vault en approval-service valideren.
5. Execution plane in shadow mode met dry-run en policy evidence.
6. Gefaseerde write-acties per capability activeren met kill switch en rollback.
7. CEO-orchestrator eerst voor lage-risico workflows; daarna gecontroleerd uitbreiden.

## Schalen naar honderden agents

Gebruik partitioned queues per tenant/team, stateless workers, eventstream backpressure, cursorpagination, server-side graph aggregatie, telemetry rollups, TTL-caches en virtualized tables. Scheid orchestration, execution, telemetry en audit storage zodat elk onafhankelijk schaalt.
