# Phase 2 Runtime Hardening

## Purpose
Phase 2 turns the executable Studio OS foundation into an inspectable local runtime control layer. The scope is runtime hardening, operational reporting and contract inspection. It does not introduce business features, a visual dashboard, provider activation or deployments.

## Architecture Decision
The runtime console is implemented as dependency-free PowerShell and JSON:

- `scripts/runtime/studio-console.ps1` is the command entry point.
- `scripts/lib/StudioRuntime.psm1` owns shared runtime helpers.
- `config/projects.config.json` registers known project slots.
- `runtime/reports/*.json` stores generated machine-readable reports.
- `runtime/runtime-index.json` stores latest report pointers and known runtime entities.

This keeps the console close to the foundation and avoids a second implementation of runtime logic.

## Command Governance
Console commands may inspect local files, run existing validations and summarize local logs. They may not:

- call external provider APIs
- write provider-side data
- deploy applications
- store secrets
- report success for missing runtime evidence

## Health Model
Health output separates:

- core health
- provider health
- config health
- runtime folder health
- documentation health
- contract health

Provider status `not-configured` is acceptable while `requiredForCoreRuntime` is false. It must remain explicit as `blocking: false`.

## Validation Model
The `validate` command runs existing validation scripts in child PowerShell processes and records their exit codes and output. This makes validation output inspectable from JSON reports and prevents a child script from terminating the console without a report.

## Future Dashboard Compatibility
The future dashboard should read `runtime/runtime-index.json` first, then resolve individual reports. Dashboard code should not duplicate contract checks, provider checks or validation orchestration. The console remains the local source for runtime inspection.

## Security Notes
Runtime reports are local generated output. They must remain under `runtime/` and ignored by Git. Reports may include missing environment variable names, but never secret values.
