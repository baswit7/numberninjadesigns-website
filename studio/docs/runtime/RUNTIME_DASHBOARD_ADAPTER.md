# Runtime Dashboard Adapter

## Doel
De Runtime Dashboard Adapter is de Phase 3 read-only laag tussen de Runtime Console en toekomstige dashboards. De adapter maakt stabiele JSON view models op basis van bestaande runtime-output.

De Runtime Console blijft de bron van waarheid. De adapter normaliseert alleen bestaande status, config, contracts, logs en documentatie naar dashboard-ready JSON.

## Read-Only Boundaries
De adapter leest uitsluitend lokale Studio OS-bronnen:

- `runtime/runtime-index.json`
- `runtime/reports/*.json`
- `config/projects.config.json`
- `config/providers.config.json`
- `config/studio.config.json`
- `config/deployment.config.json`
- `shared/contracts/*.json`
- `shared/schemas/*.json`
- `runtime/execution/*.json`
- `runtime/readiness/*.json`

De adapter voert geen provider-calls uit, start geen deployments, schrijft geen secrets, valideert geen providers direct en maakt geen fake online-statussen.

## Generated Outputs
Output wordt lokaal gegenereerd onder `runtime/dashboard/`:

| Output | Functie |
| --- | --- |
| `dashboard-summary.json` | Top-level dashboardstatus over alle views |
| `projects.view.json` | Project registry read model |
| `providers.view.json` | Provider readiness zonder credentialwaarden |
| `health.view.json` | Mirror van bestaande health/status reports |
| `contracts.view.json` | Contract- en schema-inventory |
| `telemetry.view.json` | Laatste telemetry-read model |
| `events.view.json` | Laatste event-read model |
| `deployments.view.json` | Deployment profile readiness zonder deploymentactie |
| `documentation.view.json` | Runtime documentatiebeschikbaarheid |
| `execution-readiness.view.json` | Read-only Phase 9 governance en Phase 10 readiness zichtbaarheid |

Alle bestanden zijn JSON, machine-readable en human-inspectable. `runtime/` blijft ignored.

## Console Integration
De Runtime Console ondersteunt:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\runtime\studio-console.ps1 -Command dashboard
```

Deze command voert `apps/studio-dashboard/dashboard-adapter.ps1` uit, schrijft dashboardbestanden, werkt `runtime/runtime-index.json` bij en print een korte samenvatting.

## Security
Provider cards tonen alleen environment variable namen, nooit waarden. De adapter gebruikt bestaande provider-statusrapporten en configmetadata. Niet-geconfigureerde providers blijven toegestaan en non-blocking wanneer de providerconfig dat aangeeft.

## Future Compatibility
De view models zijn geschikt als input voor:

- CLI dashboard
- web dashboard
- Notion sync
- GitHub status summary
- Vercel preview dashboard
- AI agent review summaries

Toekomstige UI-lagen moeten deze JSON lezen en mogen runtime-health, provider-health of contractvalidatie niet opnieuw implementeren.

## Phase 11 Execution Readiness View

`execution-readiness.view.json` wordt gemaakt uit bestaande lokale JSON-output:

- `runtime/execution/execution-contract-validation.json`
- `runtime/execution/approval-registry-validation.json`
- `runtime/execution/rollback-plan-validation.json`
- `runtime/execution/idempotency-record-validation.json`
- `runtime/readiness/execution-plan.sample.json`
- `runtime/readiness/readiness-report.sample.json`

Ontbrekende of onleesbare bronnen worden als `unknown` dashboard cards weergegeven. De adapter start geen validators en voert geen herstelactie uit.

## Debugging
1. Run `studio-console.ps1 -Command status`.
2. Run `studio-console.ps1 -Command dashboard`.
3. Inspect `runtime/dashboard/dashboard-summary.json`.
4. Controleer per kaart `sourceFile`.
5. Refresh ontbrekende bronrapporten via bestaande consolecommands zoals `health`, `providers`, `contracts`, `events` of `telemetry`.
