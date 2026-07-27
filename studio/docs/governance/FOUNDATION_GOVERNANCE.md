# Foundation Governance

## Purpose
The executable foundation keeps Studio OS modular, reviewable and safe while it grows from documentation into runtime infrastructure.

## Architecture
Governance is enforced through branch checks, config validation, architecture references, health reporting and documentation synchronization. GitHub remains the source of truth; Notion remains operating memory.

## Runtime Flow
1. Work starts on a feature branch.
2. Runtime configs and contracts are validated.
3. Health checks verify branch safety, docs and placeholder markers.
4. Documentation sync updates generated project status and changelog notes.
5. Review decides whether runtime changes can proceed.

## Integration Points
- `config/studio.config.json` defines protected branch and required docs.
- `scripts/validation/validate-studio-os.ps1` is the local quality gate.
- `scripts/documentation/sync-runtime-docs.ps1` keeps generated docs consistent.

## Scaling Considerations
Governance should move from local scripts to CI only after the contracts are stable. The same scripts can run in GitHub Actions without changing architecture.

## Debugging Instructions
Run the full validation pipeline after each subsystem change:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-studio-os.ps1
```

## Validation Rules
- No direct runtime implementation on protected branches.
- No missing owner directories for event families.
- No missing validation hooks for agents.
- No forbidden placeholder markers.

## Failure Scenarios
- A generated report exists but health fails: inspect `runtime/reports/health-report.json`.
- Architecture validation fails: fix the dead owner or validation hook reference.
- Config validation fails: fix JSON or contract fields before changing scripts.

## Future Extensibility
Promote validation scripts into CI, add PR annotations, publish health reports as build artifacts and enforce deployment gates before Vercel production releases.
