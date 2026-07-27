# Phase 16 Authority Read Model & Query Layer

## Architecture Decisions

1. The read model is fully derived.
   It consumes Phase 15 authority contracts and writes only read-only projections under `runtime/authority/`.

2. Phase 15 sources remain authoritative.
   Constitution remains the source of truth for boundaries. Authority Registry remains the source of truth for ownership.

3. Query responses are report artifacts.
   Phase 16 materializes common authority questions as static JSON reports rather than introducing an interactive service or runtime decision engine.

4. No authority is created by Phase 16.
   The read model owns no authority, writes no authority decisions and does not change registry or constitution contracts.

5. Validation is boundary-first.
   `validate-authority-read-model.ps1` regenerates derived reports, checks source references, validates required query responses and scans Phase 16 artifacts for forbidden capability patterns.

## Delivered Artifacts

- `shared/contracts/authority/read-model/authority-read-model.schema.json`
- `shared/contracts/authority/read-model/authority-query-response.schema.json`
- `shared/contracts/authority/read-model/read-model.manifest.json`
- `services/authority-read-model/README.md`
- `services/authority-read-model/generate-authority-read-model.ps1`
- `runtime/authority/authority-read-model.report.json`
- `runtime/authority/authority-query-responses.report.json`
- `runtime/authority/authority-read-model-validation.report.json`
- `scripts/validation/validate-authority-read-model.ps1`
- `docs/governance/AUTHORITY_READ_MODEL.md`
- `docs/governance/PHASE_16_AUTHORITY_READ_MODEL.md`
- `docs/governance/PHASE_16_BOUNDARY_AUDIT.md`

## Success Criteria Mapping

- Studio OS can answer who owns an authority: yes.
- Studio OS can answer which layers consume an authority: yes.
- Studio OS can list denied authorities: yes.
- Studio OS can answer which decision references an authority: yes.
- Studio OS can answer which constitutional rules govern an authority: yes.
- Studio OS can answer which contracts support an authority answer: yes.
- No execution introduced: yes.
- No deployment introduced: yes.
- No provider invocation introduced: yes.
- No credential or secret access introduced: yes.
- No runtime authority expansion introduced: yes.

## Validation

Run:

```powershell
scripts/validation/validate-authority-read-model.ps1
```

The validator writes only `runtime/authority/authority-read-model-validation.report.json`.
