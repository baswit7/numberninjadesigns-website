# Visual Runtime Dashboard

## Purpose
The Visual Runtime Dashboard is the Phase 4 local command center for Studio OS. It visualizes generated runtime dashboard view models and does not participate in runtime execution.

The dashboard is intentionally read-only:

```text
Runtime Console
  -> runtime/*.json
  -> Dashboard Adapter
  -> runtime/dashboard/*.json
  -> Visual Dashboard
```

The Runtime Console remains the source of truth. The Dashboard Adapter remains the transformation layer. The Visual Dashboard is only a consumer.

## Location
- App shell: `apps/studio-dashboard/index.html`
- Styles: `apps/studio-dashboard/css/dashboard.css`
- App bootstrap: `apps/studio-dashboard/js/dashboard.js`
- Loader: `apps/studio-dashboard/js/dashboard-loader.js`
- State normalization: `apps/studio-dashboard/js/dashboard-state.js`
- Renderers: `apps/studio-dashboard/js/dashboard-renderers.js`

## Data Sources
The visual dashboard loads only these files from `runtime/dashboard/`:

- `dashboard-summary.json`
- `projects.view.json`
- `providers.view.json`
- `health.view.json`
- `telemetry.view.json`
- `events.view.json`
- `contracts.view.json`
- `deployments.view.json`
- `documentation.view.json`
- `execution-readiness.view.json`

It does not read `runtime/reports/`, `config/`, `shared/contracts/` or provider-specific state directly.

## Dashboard Modules
| Module | View model | Responsibility |
| --- | --- | --- |
| Global Status Bar | `dashboard-summary.json` | Studio OS status, timestamp, warning/error totals and registry summaries |
| Project Control Center | `projects.view.json` | Project cards with status, branch, deployment target, docs and next action |
| Provider Status Center | `providers.view.json` | Provider cards with configured state, blocking state, health and env var names only |
| Health Center | `health.view.json` | Runtime, config, provider, docs, contract and runtime folder health |
| Telemetry Center | `telemetry.view.json` | Latest telemetry metrics, categories, timestamps and counts |
| Event Timeline | `events.view.json` | Newest-first runtime events with source, timestamp and severity |
| Contract Center | `contracts.view.json` | Contract/schema inventory and validation state mirrored from adapter output |
| Deployment Center | `deployments.view.json` | Read-only deployment profile readiness and safety state |
| Documentation Center | `documentation.view.json` | Documentation availability, status, missing state and next action |
| Execution Readiness Dashboard Center | `execution-readiness.view.json` | Phase 9 governance and Phase 10 readiness visibility without execution authority |

## Refresh Flow
The dashboard refresh button only reloads already-generated JSON files. It does not regenerate runtime state.

When a browser blocks `fetch()` from `file://`, use the import control to select the generated dashboard JSON files from `runtime/dashboard/`. The importer accepts only the known dashboard view model file names and still performs no runtime mutation.

To regenerate dashboard data, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\runtime\studio-console.ps1 -Command dashboard
```

Then open or reload:

```text
apps/studio-dashboard/index.html
```

## Loader Behavior
`dashboard-loader.js` loads each dashboard file independently. A missing or invalid file is reported for that view only.

Missing files render as `unknown` state and do not crash the dashboard.

The Execution Readiness Dashboard Center follows the same rule. Missing Phase 9 or Phase 10 source outputs appear as safe `unknown` cards in the generated view model and never trigger browser-side regeneration.

## State Handling
`dashboard-state.js` centralizes:

- loaded view model storage
- status and severity normalization
- missing-state normalization
- filtered card access
- loader error aggregation
- global status calculation

Renderers consume normalized state instead of raw files.

## Security Boundaries
The visual dashboard must never:

- call providers
- inspect provider credentials
- execute runtime validations
- perform health checks
- deploy
- mutate runtime state
- write local credentials
- store secrets in browser storage
- parse raw runtime/config files directly
- run validators from the browser
- grant execution permission

Provider cards may display environment variable names because they are non-secret identifiers. Credential values must never appear in adapter output or dashboard rendering.

## Extensibility
Future dashboard modules should be added by first extending the Dashboard Adapter view models. The visual dashboard may only render the new `runtime/dashboard/*.json` output.

Any feature requiring provider calls, validation, mutations or deployments belongs outside the visual dashboard and must be routed through governed runtime workflows.
