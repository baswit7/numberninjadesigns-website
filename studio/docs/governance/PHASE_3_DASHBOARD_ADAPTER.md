# Phase 3 Dashboard Adapter Governance

## Scope
Phase 3 adds a read-only Runtime Dashboard Adapter for Studio OS. It converts existing runtime reports and config into dashboard-ready JSON view models.

This phase does not create a visual dashboard, business features, provider activation, deployment automation or new validation authority.

## Architecture Decision
The adapter is intentionally thin:

- Runtime Console remains source of truth.
- Existing reports remain authoritative.
- Dashboard outputs are read models under `runtime/dashboard/`.
- Console integration is a command route, not a logic migration.

## Allowed Inputs
The adapter may consume only local runtime and contract sources:

- `runtime/runtime-index.json`
- `runtime/reports/*.json`
- `config/*.config.json` needed for registered runtime state
- `shared/contracts/*.json`
- `shared/schemas/*.json`

## Prohibited Behavior
The adapter must not:

- call external providers;
- check OAuth/token validity;
- output credential values;
- run deployments;
- create provider success states;
- duplicate provider, config or contract validation rules;
- write outside `runtime/dashboard/` except through the console's runtime-index update.

## Runtime Index
`runtime/runtime-index.json` now references the latest dashboard summary, generated timestamp, dashboard status and generated dashboard output files. This makes the dashboard adapter discoverable by future tooling without turning it into the runtime source of truth.

## Quality Gates
Phase 3 is acceptable when:

- all required dashboard JSON files are generated;
- outputs are valid JSON;
- secret values are absent;
- provider status remains read-only;
- validation and health scripts still pass;
- `studio-console.ps1 -Command dashboard` works from the root.

## Phase 4 Readiness
Phase 4 may build a visual dashboard only after it consumes these view models directly. It should not add live provider polling, deployment controls or hidden health logic without a separate governance phase.
