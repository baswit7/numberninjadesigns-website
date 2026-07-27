# Runtime Console

## Purpose
The Studio OS runtime console is the local operational control interface for inspecting the executable foundation. It keeps Studio OS observable without adding a web dashboard, deployment flow, provider activation or external dependency.

The console entry point is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\runtime\studio-console.ps1 -Command status
```

## Commands
| Command | Purpose | Primary report |
| --- | --- | --- |
| `status` | Inspect complete local runtime state. | `runtime/reports/studio-status.json` |
| `validate` | Run structure and config validation through existing scripts. | `runtime/reports/validation-status.json` |
| `health` | Inspect core, provider, config, runtime folder, docs and contract health. | `runtime/reports/health-report.json` |
| `providers` | Inspect provider configuration without external API calls. | `runtime/reports/provider-status.json` |
| `events` | Inspect event log existence, count and latest entry. | `runtime/reports/event-status.json` |
| `telemetry` | Inspect telemetry log existence, count and latest entry. | `runtime/reports/telemetry-status.json` |
| `docs` | Inspect required governance and runtime documentation. | `runtime/reports/documentation-status.json` |
| `contracts` | Inspect agent, event, workflow and schema contracts. | `runtime/reports/contract-status.json` |
| `deployments` | Inspect deployment profiles without running deployments. | `runtime/reports/deployment-status.json` |
| `projects` | Inspect registered project slots. | Console output and `runtime/runtime-index.json` |
| `help` | Show command reference. | Console output |

## Output Modes
Human-readable output is the default:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\runtime\studio-console.ps1 -Command health
```

Machine-readable output can be printed directly:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\runtime\studio-console.ps1 -Command health -Output json
```

All operational reports are written under `runtime/`, which remains ignored by Git.

## Validation Flow
Use this flow before extending runtime behavior:

1. Run `status` to create a full baseline.
2. Run `validate` to execute structure and config checks.
3. Run `health` to verify operational separation between core, providers, config, runtime folder, docs and contracts.
4. Inspect `runtime/runtime-index.json` for the latest report pointers.

## Debugging Flow
When a command reports `failed` or `blocked`:

1. Open the matching report under `runtime/reports/`.
2. Inspect `errors` first, then `warnings`.
3. Fix the first structural or config error.
4. Rerun the exact command.
5. Rerun `status` when the targeted command is clean.

Provider status `not-configured` is allowed while providers are not core-required. The console reports it as a warning with `blocking: false`.

## Dashboard Compatibility
The console writes deterministic JSON reports and a runtime index so a future dashboard can read local state without reimplementing inspection logic. The future dashboard should consume report files and should not duplicate provider, contract or validation logic.
