# Executive Data Pipeline V1

Read-only projection service for the Executive Cockpit.

The cockpit does not own business truth. This service bundles existing runtime reports into dashboard-ready executive reports under `runtime/executive-cockpit/`.

Boundaries:
- no provider calls
- no publishing
- no scheduling
- no OAuth
- no credentials
- no autonomous agent execution
- no external mutation
