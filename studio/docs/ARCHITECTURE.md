# Studio OS Architecture

## Projectdoel

NumberNinjaDesigns Studio OS / Studio OS is de AI-first ontwikkelstudio voor Bas' projecten. Het systeem bewaakt projectcontext, runtime-inzicht, agentgrenzen, governance, documentatiekwaliteit en releasevoorbereiding zonder automatische gevaarlijke acties.

## Architectuurprincipes

- GitHub is centrale waarheid.
- Notion is operationeel geheugen.
- ChatGPT is architect, reviewer en strategie.
- Codex is developer en implementatie-engine.
- Documentatie en contracts gaan voor runtimegedrag.
- Runtime-output is lokaal bewijs, geen broncode.
- Providers, secrets, deploys en Git-mutaties vereisen expliciete approval.
- Modules blijven klein, traceerbaar en uitbreidbaar.

## Pipeline

```text
Foundation
-> Runtime Console
-> Runtime Reports
-> Dashboard Adapter
-> Dashboard ViewModels
-> Visual Dashboard
-> Operational Intelligence
-> Confidence / Explainability
-> Governance & Release Control
-> Studio Command Preparation Layer
-> AI Coordination Layer
-> Execution Governance Layer
-> Execution Readiness Layer
-> Read-only Execution Readiness Dashboard Center
-> Dashboard Runtime Boundary Design
-> Projection Contract & No-Write Validator Interface Layer
-> Projection Fixture Validation & Stale Detection Layer
-> toekomstige execution authority, niet geimplementeerd
```

## Foundationlaag

De foundation bestaat uit config, contracts, schemas, projectregistratie, agentgrenzen en documentatie. Deze laag definieert wat Studio OS mag lezen, rapporteren en valideren voordat er uitvoerbare workflowlogica ontstaat.

Belangrijke onderdelen:

- `config/*.config.json`
- `shared/contracts/*.json`
- `shared/schemas/*.json`
- `agents/`
- `projects/`
- `docs/`

## Runtime Console

De Runtime Console is de lokale ingang voor gecontroleerde status-, config-, contract-, provider-, deployment-, docs- en projectinspectie. Consolecommands mogen runtime reports schrijven, maar niet deployen, provider calls doen, secrets lezen of Git-mutaties uitvoeren.

Belangrijk pad:

- `scripts/runtime/studio-console.ps1`

## Dashboard Adapter

De Dashboard Adapter vertaalt bestaande runtime reports, config en contracts naar dashboard view models. De adapter is read-only richting providers en voert geen nieuwe validatielogica of deploymentlogica uit.

Belangrijk pad:

- `apps/studio-dashboard/dashboard-adapter.ps1`

## Visual Dashboard

Het Visual Runtime Dashboard leest alleen gegenereerde dashboard JSON. Het is een consument, geen executor. Browser-refresh mag bestaande JSON opnieuw laden, maar geen runtime state muteren.

Belangrijke paden:

- `apps/studio-dashboard/index.html`
- `apps/studio-dashboard/js/`
- `apps/studio-dashboard/css/`

## Operational Intelligence

Operational Intelligence beoordeelt dashboard state en history deterministisch. De laag maakt scores, trends, risico's, maturity, governance-intelligence en executive summaries zonder AI-provider calls.

Belangrijk pad:

- `services/operational-intelligence/`

## Confidence / Explainability

Confidence en Explainability maken inzichtelijk hoeveel vertrouwen de runtime in outputs heeft en welke inputs, weights en regels tot scores leiden. Dit voorkomt magic scoring en maakt governance controleerbaar.

Belangrijke outputs:

- `confidence.view.json`
- `intelligence-explainability.view.json`

## Governance & Release Control

Governance beoordeelt release readiness, quality gates, exceptions, compliance, governance score en drift. Governance is advisory en mag eligibility blokkeren, maar nooit zelf goedkeuren, mergen, committen, pushen of deployen.

Belangrijk pad:

- `services/governance/`

## Phase 7: Studio Command Preparation Layer

Phase 7 is afgerond als non-executing Studio Command Preparation Layer. Deze laag bereidt veilige acties voor, genereert Codex-prompts, maakt release-checklists en classificeert acties zonder execution authority.

De ontwerpboundary ligt vast in `docs/governance/PHASE_7_STUDIO_COMMAND_LAYER.md` en `docs/adr/ADR-007-STUDIO-COMMAND-NON-EXECUTION.md`. Phase 7 is command preparation, geen execution authority.

Phase 7 mag nooit zelfstandig:

- committen
- pushen
- deployen
- provider calls doen
- secrets lezen
- bestanden verwijderen
- projectstructuur herschrijven
- governance score herberekenen
- runtime-validatie dupliceren
- dashboard adapterlogica dupliceren

## Phase 8: AI Coordination Layer

Phase 8 voegt een declaratieve AI Coordination Layer toe. Deze laag zet goedgekeurde command- en planningmetadata om naar een coordination graph met agents, stages, dependencies en gates.

Belangrijke paden:

- `shared/contracts/coordination/`
- `services/coordination/`
- `docs/coordination/`
- `runtime/coordination/`

Phase 8 mag:

- declaratieve agent- en workflowregistries lezen
- goedgekeurde planningmetadata lezen
- een coordination graph genereren
- lokale read-only coordination reports schrijven onder `runtime/coordination/`
- dashboardconsumptie documenteren als read-only future boundary

Phase 8 mag nooit:

- agents uitvoeren
- commands uitvoeren
- providers aanroepen
- deployments starten
- schedulers of background services starten
- bestaande runtime-, dashboard-, governance-, provider-, deployment- of commandlagen muteren
- source code voor andere projecten genereren

Execution authority blijft toekomstige scope en vereist aparte approval enforcement, audit logging, idempotency storage en rollback execution.

## Phase 9: Execution Governance Layer

Phase 9 voegt een non-executing Execution Governance Layer toe bovenop Phase 8. Deze laag beoordeelt toekomstige execution requests op approval, risk, rollback readiness, idempotency en execution policy.

Belangrijke paden:

- `shared/contracts/execution/`
- `services/execution-governance/`
- `docs/governance/PHASE_9_EXECUTION_GOVERNANCE.md`
- `runtime/execution/`

Phase 9 mag:

- execution requests modelleren
- approval state modelleren
- risk assessments modelleren
- rollback readiness modelleren
- idempotency policy modelleren
- execution policy decisions modelleren
- governance-only runtime reports schrijven onder `runtime/execution/`

Phase 9 mag nooit:

- workflows uitvoeren
- agents uitvoeren
- providers aanroepen
- OpenAI of Anthropic aanroepen
- GitHub APIs aanroepen
- deploys starten
- queues, schedulers, workers of executors toevoegen
- secrets of credentials lezen
- dashboard UI bouwen
- runtime-, command-, coordination-, provider-, dashboard- of healthlogica dupliceren

Execution authority blijft toekomstige scope en vereist aparte approval enforcement, audit logging, rollback execution, provider boundaries en idempotency storage.


## Phase 10: Execution Readiness Layer

Phase 10 voegt een non-executing Execution Readiness Layer toe bovenop Phase 9. Deze laag modelleert execution plans, execution steps, dependency checks, preflight checks, approval-chain readiness, rollback readiness, idempotency readiness, readiness decisions en sanitized readiness reports.

Belangrijke paden:

- `shared/contracts/readiness/`
- `services/execution-readiness/`
- `docs/governance/PHASE_10_EXECUTION_READINESS.md`
- `runtime/readiness/`

Phase 10 mag:

- execution plans modelleren
- execution steps modelleren
- dependency checks modelleren
- preflight checks modelleren
- approval-chain readiness modelleren
- rollback readiness modelleren
- idempotency readiness modelleren
- readiness decisions modelleren
- readiness-only sample output leveren onder `runtime/readiness/`

Phase 10 mag nooit:

- workflows uitvoeren
- agents uitvoeren
- providers aanroepen
- model APIs aanroepen
- GitHub APIs aanroepen
- deploys starten
- queues, schedulers, workers of executors toevoegen
- secrets of credentials lezen
- dashboard UI bouwen
- business features toevoegen

Readiness is nooit execution permission.

## Phase 11: Read-only Execution Readiness Dashboard Center

Phase 11 voegt een read-only dashboard center toe aan de bestaande Visual Runtime Dashboard architectuur. De laag visualiseert Phase 9 execution governance en Phase 10 execution readiness via een adapter-view model.

Belangrijke paden:

- `apps/studio-dashboard/dashboard-adapter.ps1`
- `apps/studio-dashboard/js/`
- `apps/studio-dashboard/index.html`
- `runtime/dashboard/execution-readiness.view.json`
- `docs/governance/PHASE_11_READINESS_DASHBOARD_CENTER.md`

Phase 11 mag:

- bestaande Phase 9 en Phase 10 JSON-output lezen via de dashboard adapter
- een read-only dashboard view model schrijven onder `runtime/dashboard/`
- missing source JSON als veilige `unknown` state tonen
- executionAllowed, readinessOnly, blocked-state en source visibility tonen

Phase 11 mag nooit:

- workflows uitvoeren
- agents uitvoeren
- providers aanroepen
- model APIs aanroepen
- GitHub APIs aanroepen
- deploys starten
- queues, schedulers, workers, executors of background runners toevoegen
- secrets of credentials lezen
- config muteren
- validatorlogica dupliceren
- readiness of governance business rules dupliceren
- execution permission verlenen

## Phase 12: Dashboard Runtime Boundary Design

Phase 12 legt de dashboard/runtime boundary vast na de Phase 11 read-only dashboard center. De fase definieert runtime truth, adapter-derived dashboard view models, passieve dashboardconsumptie en validator ownership zonder nieuw runtimegedrag toe te voegen.

Belangrijke paden:

- `docs/governance/DASHBOARD_RUNTIME_BOUNDARY.md`
- `docs/governance/PHASE_12_DASHBOARD_RUNTIME_BOUNDARY_DESIGN.md`
- `apps/studio-dashboard/dashboard-adapter.ps1`
- `runtime/dashboard/`

Phase 12 mag:

- dashboard read-only verantwoordelijkheden documenteren
- dashboard adapter projection boundaries documenteren
- validator ownership buiten dashboard UI vastleggen
- composite refresh orchestration als future scope begrenzen
- execution readiness labels als non-permission definieren

Phase 12 mag nooit:

- workflows uitvoeren
- agents uitvoeren
- providers aanroepen
- model APIs aanroepen
- GitHub APIs aanroepen
- deploys starten
- queues, schedulers, workers, executors of background runners toevoegen
- secrets, tokens, API keys of credentials lezen
- dashboard writes of UI-originated runtime writes toevoegen
- runtime state vanuit dashboard muteren
- `localStorage` of `sessionStorage` als runtime authority gebruiken
- validatorlogica dupliceren
- execution permission verlenen

Runtime evidence blijft source of truth. Dashboard view models blijven derived read models.

## Phase 13: Projection Contract & No-Write Validator Interface Layer

Phase 13 voegt contracten toe voor dashboard projections en een no-write validator interface. De fase maakt expliciet welke data een projection mag bevatten en hoe validators structurele grenzen controleren zonder runtime-, dashboard-, provider-, deployment- of config-mutatie.

Belangrijke paden:

- `shared/contracts/projections/`
- `scripts/validation/validate-projection-contracts.ps1`
- `docs/governance/PROJECTION_CONTRACT.md`
- `docs/governance/PHASE_13_PROJECTION_CONTRACT_REPORT.md`

Phase 13 mag:

- read-only projection schemas definieren
- adapter-only projection producer ownership vastleggen
- dashboard passive consumer semantics vastleggen
- no-write structural validator interfaces definieren
- forbidden capability patterns in projection contracts blokkeren

Phase 13 mag nooit:

- workflows uitvoeren
- agents uitvoeren
- providers aanroepen
- model APIs aanroepen
- GitHub APIs aanroepen
- deploys starten
- queues, schedulers, workers, executors of background runners toevoegen
- secrets, tokens, API keys of credentials lezen of opslaan
- dashboard writes toevoegen
- runtime state vanuit dashboard muteren
- `localStorage` of `sessionStorage` als runtime authority gebruiken
- business features toevoegen
- command execution vanuit UI toevoegen

Runtime truth blijft eigenaar van bewijs. De dashboard adapter blijft projection producer. Het dashboard blijft passieve visual consumer.

## Phase 14: Projection Fixture Validation & Stale Detection Layer

Phase 14 voegt read-only fixture validation toe bovenop de Phase 13 projection contracts. De fase valideert committed dashboard projection fixtures, detecteert stale projections via deterministische timestampvergelijking en legt machine-readable validation reports vast zonder runtime-, dashboard-, provider-, deployment- of config-mutatie.

Belangrijke paden:

- `shared/contracts/projections/fixtures/`
- `shared/contracts/projections/validation-reports/`
- `scripts/validation/validate-projection-fixtures.ps1`
- `docs/governance/PHASE_14_PROJECTION_FIXTURE_VALIDATION_REPORT.md`

Phase 14 mag:

- dashboard projection fixtures valideren tegen de Phase 13 contractvorm
- stale projection fixtures detecteren via `generatedAt` versus `sourceEvidenceObservedAt`
- machine-readable validation reports als committed evidence controleren
- fresh en stale coverage afdwingen

Phase 14 mag nooit:

- workflows uitvoeren
- agents uitvoeren
- providers aanroepen
- model APIs aanroepen
- GitHub APIs aanroepen
- deploys starten
- queues, schedulers, workers, executors of background runners toevoegen
- credentials, secrets of browser storage authority introduceren
- runtime reports wijzigen
- dashboard state wijzigen
- UI command execution toevoegen

Runtime truth blijft source of truth. Phase 14 leest committed fixture evidence en valideert alleen structuur en stale status.

## Safety Boundaries

- Geen provider calls zonder expliciete approval.
- Geen secrets in repo, logs, runtime-output of docs.
- Geen deletes zonder expliciete approval.
- Geen Git-mutaties zonder expliciete approval.
- Geen deploys zonder expliciete approval.
- Geen runtime-output als broncode behandelen.

## Non-Execution Policy

Studio OS mag observeren, meten, rapporteren, classificeren en adviseren. Uitvoerende acties blijven mens-goedgekeurd. Advisory output is geen toestemming.

## Contract-First Model

Nieuwe runtime- of governancefunctionaliteit krijgt eerst een contract of schema. Implementatie volgt pas nadat velden, eigenaar, traceability en safety boundary duidelijk zijn.

## Runtime Output Policy

Deze output blijft lokaal en hoort standaard niet in Git:

- `runtime/events/`
- `runtime/telemetry/`
- `runtime/history/`
- `runtime/reports/`
- `runtime/dashboard/`
- `runtime/coordination/`
- `runtime/execution/`
- `runtime/readiness/`
- `runtime/runtime-index.json`

Sanitized samples mogen later alleen expliciet en apart worden toegevoegd.

## Dashboard Read-Only Policy

Dashboard UI en adapter mogen geen providers inspecteren, deployments starten, secrets lezen, raw credentials renderen of runtime-validatie dupliceren.

## Provider Boundary

Providerintegraties blijven achter config, contracts en toekomstige provider-manager boundaries. Geen provider SDK, token handling of live API-call mag lekken naar dashboard, Operational Intelligence of Governance.

## Git / Branch Workflow

- Werk op taakgerichte feature branches.
- Geen directe ontwikkeling op `main`.
- Geen commits of pushes zonder expliciete toestemming.
- Een commit moet een coherent baseline-, docs-, runtime- of featuredoel hebben.
- Generated output blijft buiten commits.

## Documentatie-First Regels

- Rootdocs beschrijven Studio OS.
- Projectdocs beschrijven projectcontext.
- ADR's leggen blijvende architectuurbesluiten vast.
- Governance docs beschrijven safety boundaries.
- Runtime docs beschrijven hoe output ontstaat en wat niet automatisch uitgevoerd mag worden.
