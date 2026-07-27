# Phase 4 Visual Dashboard Governance

## Decision
Phase 4 introduces the first visual runtime dashboard for Studio OS as a local, read-only, adapter-driven command center.

The dashboard is approved only as a visualization layer. It is not a runtime system, provider integration, validation engine or deployment controller.

## Architecture Boundary
The approved boundary is:

```text
Runtime Console
  -> runtime/*.json
  -> Dashboard Adapter
  -> runtime/dashboard/*.json
  -> Visual Dashboard
```

No shortcut is allowed from the visual dashboard to raw runtime reports, provider configs, provider APIs or deployment scripts.

## Implemented Surface
Phase 4 adds:

- `apps/studio-dashboard/index.html`
- `apps/studio-dashboard/css/dashboard.css`
- `apps/studio-dashboard/js/dashboard.js`
- `apps/studio-dashboard/js/dashboard-loader.js`
- `apps/studio-dashboard/js/dashboard-renderers.js`
- `apps/studio-dashboard/js/dashboard-state.js`
- `apps/studio-dashboard/assets/`

The app is dependency-free and can run without npm, build tools or framework runtime.

## Allowed Interactions
The visual dashboard may:

- load generated `runtime/dashboard/*.json`
- import the same generated dashboard JSON files through a browser file picker when direct `file://` fetch is blocked
- sort or filter already-loaded state
- collapse panels
- reload generated JSON files
- render missing files as `unknown`
- render Phase 11 execution-readiness visibility from `execution-readiness.view.json`

## Prohibited Interactions
The visual dashboard may not:

- regenerate dashboard files
- run validations
- perform health checks
- call providers
- edit provider settings
- expose secrets
- execute deployments
- mutate runtime state
- write to localStorage
- become a second runtime console
- grant execution permission

## Operational Rule
Runtime refresh remains:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\runtime\studio-console.ps1 -Command dashboard
```

The visual refresh button only re-fetches existing dashboard view models.

## Risk Controls
| Risk | Control |
| --- | --- |
| Runtime logic duplication | Renderers consume adapter cards only |
| Provider credential exposure | Provider renderer displays env var names only |
| Missing JSON hard crash | Loader isolates failures per view |
| Browser-side mutation drift | No write APIs, localStorage or provider endpoints |
| Deployment activation | Deployment module renders profile metadata only |
| Readiness mistaken for execution approval | Phase 11 renderer displays `executionAllowed=false` and remains read-only |

## Phase 5 Eligibility
Phase 5 may extend the visual system with richer charts, trend comparisons or saved view preferences only if those features remain read-only or are routed through explicit governed runtime commands.
