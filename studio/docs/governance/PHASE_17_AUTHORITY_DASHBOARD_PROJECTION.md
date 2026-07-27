# Phase 17 Authority Dashboard Projection Integration

## Architecture Decisions

1. Dashboard becomes a passive authority consumer.
   It reads Phase 16 authority reports and renders derived cards only.

2. Dashboard adapter remains a projection producer.
   It consumes `runtime/authority/*.json` and writes only `runtime/dashboard/authority.view.json`.

3. Phase 15 and Phase 16 remain authoritative.
   Constitution, Authority Registry and Authority Read Model continue to own the facts. Dashboard output is display-only.

4. Missing authority reports produce safe unknown state.
   The adapter cannot infer authority when source files are absent or unreadable.

5. UI remains passive.
   The Visual Dashboard renders authority cards and cannot modify authority data or trigger services.

## Delivered Artifacts

- `runtime/dashboard/authority.view.json`
- `runtime/dashboard/authority-dashboard-validation.report.json`
- `scripts/validation/validate-authority-dashboard-projection.ps1`
- `docs/governance/AUTHORITY_DASHBOARD_PROJECTION.md`
- `docs/governance/PHASE_17_AUTHORITY_DASHBOARD_PROJECTION.md`
- `docs/governance/PHASE_17_BOUNDARY_AUDIT.md`

## Modified Artifacts

- `apps/studio-dashboard/dashboard-adapter.ps1`
- `apps/studio-dashboard/index.html`
- `apps/studio-dashboard/js/dashboard-loader.js`
- `apps/studio-dashboard/js/dashboard-state.js`
- `apps/studio-dashboard/js/dashboard-renderers.js`
- `apps/studio-dashboard/js/dashboard.js`
- `scripts/validation/validate-architecture.ps1`
- `scripts/validation/validate-studio-os.ps1`
- `CHANGELOG.md`

## Success Criteria Mapping

- Dashboard can display authority intelligence: yes.
- Dashboard owns no authority: yes.
- Dashboard performs no execution: yes.
- Dashboard performs no deployment: yes.
- Dashboard performs no approval: yes.
- Dashboard performs no provider invocation: yes.
- Visibility increases without operational power: yes.

## Validation

Run:

```powershell
scripts/validation/validate-authority-dashboard-projection.ps1
```

The validator writes only `runtime/dashboard/authority-dashboard-validation.report.json`.
