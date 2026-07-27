# Studio Dashboard

## Purpose
`apps/studio-dashboard` contains the Phase 3 read-only Runtime Dashboard Adapter and the Phase 4 Visual Runtime Dashboard.

The adapter prepares dashboard-ready JSON view models from existing Studio OS runtime outputs and config files. The visual dashboard consumes only those generated view models.

## Boundary
The adapter may read:

- `runtime/runtime-index.json`
- `runtime/reports/*.json`
- `config/projects.config.json`
- `config/providers.config.json`
- `config/studio.config.json`
- `config/deployment.config.json`
- `shared/contracts/*.json`
- `shared/schemas/*.json`

The adapter must not call providers, validate providers directly, deploy, write secrets, create fake online states or duplicate Runtime Console logic.

The visual dashboard may read only:

- `runtime/dashboard/*.json`

It must not parse raw reports, configs, contracts or provider state directly.

## Usage
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\apps\studio-dashboard\dashboard-adapter.ps1
```

Preferred console route:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\runtime\studio-console.ps1 -Command dashboard
```

Open the visual dashboard locally:

```text
apps/studio-dashboard/index.html
```

The dashboard reload button only reloads existing JSON files. Regenerate runtime data through the Runtime Console command above.

## Outputs
The adapter writes local read models under `runtime/dashboard/`:

- `dashboard-summary.json`
- `projects.view.json`
- `providers.view.json`
- `health.view.json`
- `contracts.view.json`
- `telemetry.view.json`
- `events.view.json`
- `deployments.view.json`
- `documentation.view.json`

`runtime/` remains ignored by Git because these files are local runtime output.

## View Model Contract
Every generated view contains:

- `generatedAt`
- `source`
- `status`
- `summary`
- `cards`
- `warnings`
- `errors`
- `nextRecommendedAction`

Every card contains:

- `id`
- `title`
- `status`
- `severity`
- `description`
- `sourceFile`
- `lastUpdated`
- `actionHint`

Optional `details` fields are machine-readable and must not contain secret values.

## Debugging
1. Refresh source reports through the Runtime Console.
2. Run the adapter directly.
3. Inspect `runtime/dashboard/dashboard-summary.json`.
4. If a view is `unknown`, inspect the source file named in the card.
5. If provider state is unexpected, run the existing provider health command instead of adding provider logic here.
