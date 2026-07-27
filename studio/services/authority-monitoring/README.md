# Authority Projection Monitoring

Phase 18 adds read-only monitoring for authority projection drift and freshness.

The service consumes existing authority sources and dashboard projections:

- `shared/contracts/authority/constitution.rules.json`
- `shared/contracts/authority/authority-registry.json`
- `runtime/authority/authority-read-model.report.json`
- `runtime/authority/authority-query-responses.report.json`
- `runtime/dashboard/authority.view.json`

It writes derived reports only:

- `runtime/authority/authority-projection-monitoring.report.json`

It does not repair projections, synchronize projections, execute workflows, invoke providers, deploy, access credentials, access secrets, or mutate authority contracts.
