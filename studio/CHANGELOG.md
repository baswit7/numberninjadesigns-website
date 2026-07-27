# Changelog

## Unreleased

### Added

- Post-split baseline recovery voor NumberNinjaDesigns Studio OS / Studio OS.
- Studio OS-specifieke rootdocumentatie na scheiding van FIELD FLOW AI.
- Studio OS-specifieke `.gitignore` voor runtime-output, logs, lokale env-bestanden en buildartefacten.
- Herstelde Studio OS-architectuurdocumentatie als baseline voor verdere phases.
- Phase 7 ontwerpdocument voor de Studio Command & Automation Layer.
- Phase 7 contract schema conventions voor toekomstige command-layer JSON schemas.
- Phase 7 command classification JSON schema voor command-layer contractvoorbereiding.
- Phase 7 action plan, Codex prompt en release checklist JSON schemas voor command-layer contractvoorbereiding.
- ADR-007 voor non-executing command preparation en approval boundaries.
- Phase 7 command preparation design voor non-executing, reviewable command artifacts.
- Phase 7 command schema examples en dependency-free invariant validator voor non-executing contractchecks.
- Phase 7 command contract validator opgenomen in de Studio OS validatiepipeline.
- Phase 7 dependency-free Codex prompt generator voor non-executing command preparation.
- Phase 7 dependency-free action-plan generator voor non-executing command preparation.
- Phase 7 dependency-free command-classification en release-checklist generators voor non-executing command preparation.
- Phase 7 completion report voor afsluiting van de non-executing command preparation layer.
- Phase 7 HOLD-resolutie door verouderde validatie- en configuratiereferenties te redirecten naar canonieke architectuurdocumentatie.
- Phase 8 AI Coordination Layer met declaratieve agent/workflow registries, coordination contracts, non-executing graph generator, validators en safety/compatibility documentatie.
- Phase 8 closeout report met release readiness, hardening proof, compatibility verdict en merge recommendation.
- Phase 8 merge report en baseline update na squash merge naar `main`.
- Phase 9 Execution Governance Layer met approval, risk, rollback, idempotency en execution policy contracts, validators en safety-boundary documentatie.
- Phase 10 Execution Readiness Layer met readiness contracts, preflight/dependency/approval-chain modellen, boundary validators en sanitized readiness samples.
- Phase 11 Read-only Execution Readiness Dashboard Center voor zichtbaarheid op Phase 9 governance en Phase 10 readiness via bestaande dashboard view models.
- Phase 12 Dashboard Runtime Boundary Design voor scheiding tussen runtime truth, adapter-derived dashboard view models, passieve dashboardconsumptie en validator ownership.
- Phase 13 Projection Contract & No-Write Validator Interface Layer met read-only projection schemas, manifest, boundary validator en governance report.
- Phase 14 Projection Fixture Validation & Stale Detection Layer met read-only fixtures, deterministic stale detection, machine-readable validation reports en boundary validator.
- Phase 15 Constitution & Authority Control Plane met machine-readable constitution, authority registry, classifications, decision model, validation report en deterministic authority validator.
- Phase 16 Authority Read Model & Query Layer met afgeleide authority projections, read-only query responses, validation report en boundary audit.
- Phase 17 Authority Dashboard Projection Integration met passieve authority visibility in bestaande dashboard projections, read-only validator en boundary audit.
- Phase 18 Authority Projection Monitoring met drift-, freshness-, lineage-, completeness- en structural mismatch-detectie plus passieve dashboard visibility.
- Production Command Center onder `apps/command-center/` als primaire lokale Studio OS-ingang voor Bas.

### Restored

- Strategic Studio OS documents uit de split-backup:
  - Commercial Operating Model
  - Compound Intelligence Engine
  - Cross-Project Intelligence
  - Enterprise AI Governance
  - Knowledge Graph Strategy
  - Project Governance
  - Revenue Engine
  - Scaling Strategy
  - Self-Improving Operations
  - Self-Improving System
- Shared boundary README-scaffolds voor analytics, APIs, automation, prompts, templates en UI.

### Changed

- Projectscheiding uitgevoerd tussen Studio OS en FIELD FLOW AI.
- FIELD FLOW AI staat nu apart in `C:\AI\Active\Operationele systemen sales - FIELD FLOW AI`.
- Deze repo-baseline richt zich niet langer op FIELD FLOW AI-productcode.

### Status

- Phase 1 t/m Phase 6 zijn gebouwd:
  - Foundation
  - Runtime Console
  - Runtime Reports
  - Dashboard Adapter
  - Visual Runtime Dashboard
  - Operational Intelligence
  - Confidence / Explainability
  - Governance & Release Control
- Phase 7 is gesloten als non-executing Studio Command Preparation Layer.
- Phase 8 is compleet op `main` als non-executing AI Coordination Layer; execution blijft future scope.
- Phase 9 is klaar als non-executing Execution Governance Layer; execution authority blijft future scope.
- Phase 10 is klaar als non-executing Execution Readiness Layer; readiness blijft reviewbaar bewijs en geen execution permission.
- Phase 11 is klaar als read-only dashboard center; visualisatie blijft consument van bestaande JSON en voegt geen execution authority toe.
- Phase 12 is klaar als documentation-only dashboard/runtime boundary; geen execution, providers, deployments, dashboard writes, schedulers, workers, queues, secrets of browser-storage authority toegevoegd.
- Phase 13 is klaar als contract-only projection boundary; runtime blijft source of truth, adapter blijft projection producer en dashboard blijft passieve consument.
- Phase 14 is klaar als read-only projection fixture validation layer; stale detection blijft deterministisch, committed en non-mutating.
- Phase 15 is klaar als non-executing constitutional authority layer; forbidden authorities blijven expliciet denied en geen subsystem krijgt impliciete authority.
- Phase 16 is klaar als non-executing authority observability layer; read models blijven afgeleid en verhogen geen operationele bevoegdheid.
- Phase 17 is klaar als passive authority dashboard visibility layer; dashboard blijft consument van afgeleide projections en krijgt geen authority, execution, provider, deployment of secret capability.
- Geen deploy uitgevoerd tijdens baseline recovery of Phase 8 coordination work.
