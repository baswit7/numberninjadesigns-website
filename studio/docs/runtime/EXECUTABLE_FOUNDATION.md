# Studio OS Executable Foundation

## Purpose
This layer converts the documented Studio OS direction into deterministic local runtime contracts. It does not add business features, UI polish or external side effects. It creates the minimum executable substrate for configuration, provider status, events, telemetry, health and agent contracts.

## Architecture
The foundation is dependency-free and PowerShell-native so it works on the current Windows repository without build tools.

```text
config/                 Runtime configuration and environment profiles
shared/schemas/         Machine-readable validation contracts
shared/contracts/       Agent, event and workflow contracts
scripts/lib/            Shared runtime utilities
scripts/events/         Event append-only writer
scripts/telemetry/      Telemetry append-only writer
scripts/health/         Provider and Studio OS health reports
scripts/validation/     Config, architecture and full pipeline checks
runtime/                Generated local reports and JSONL stores
```

## Runtime Flow
1. `scripts/validation/validate-config.ps1` validates required JSON configs and provider contracts.
2. `scripts/events/emit-event.ps1` appends schema-shaped events to `runtime/events/events.ndjson`.
3. `scripts/telemetry/write-telemetry.ps1` appends machine-readable metrics to `runtime/telemetry/telemetry.ndjson`.
4. `scripts/health/studio-health.ps1` checks docs, branch safety, provider credential presence and forbidden placeholder markers.
5. `scripts/validation/validate-studio-os.ps1` runs the complete local validation pipeline.

## Integration Points
- Provider Manager owns `config/providers.config.json`.
- Event Bus owns `shared/contracts/events.contract.json`.
- Telemetry Core owns `config/telemetry.config.json`.
- Documentation Engine owns `scripts/documentation/sync-runtime-docs.ps1`.
- Health Monitor owns `scripts/health/studio-health.ps1`.
- Agent contracts live in `shared/contracts/agents.contract.json`.

## Scaling Considerations
The JSONL event and telemetry stores are intentionally local append-only files. They can later be replaced by queues, object storage or analytics pipelines without changing event contracts. Provider health currently checks credential presence only, avoiding unsafe calls before OAuth and permissions are approved.

## Debugging Instructions
Run these commands from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-studio-os.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\health\provider-health.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\events\emit-event.ps1 -Type runtime.validation.started -Source codex-agent
```

Generated diagnostics are written under `runtime/`, which stays local.

## Validation Rules
- No direct implementation work on protected branches.
- No committed secrets; provider configs contain only environment variable names.
- No forbidden placeholder markers in `.md`, `.ps1` or `.json` files.
- Every event family must have an owning service or agent directory.
- Every agent validation hook must point to an existing script.

## Failure Scenarios
- Missing config file: config validation fails before health checks run.
- Missing provider credential: provider status becomes `not-configured`; it blocks only when the provider is marked core-required.
- Protected branch: health fails to prevent direct runtime implementation on `main` or `master`.
- Dead contract reference: architecture validation fails on missing owner or hook path.

## Future Extensibility
The next phase can add HTTP probes, OAuth reconnect flows, provider SDK adapters, queue-backed event replay and Vercel deployment gates. Those additions must keep the same centralized provider and event contracts.
