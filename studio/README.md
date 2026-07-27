# NumberNinjaDesigns Studio OS / Studio OS

NumberNinjaDesigns Studio OS, kort Studio OS, is de AI-first ontwikkelstudio voor de projecten van Bas. De repo organiseert strategie, implementatie, runtime-inzicht, kwaliteitscontrole en releasevoorbereiding zonder lokale chaos of onveilige automatisering.

## Operating Model

| Rol | Verantwoordelijkheid |
| --- | --- |
| ChatGPT | Architect, reviewer en strategie |
| Codex | Developer en implementatie-engine |
| GitHub | Centrale waarheid en versiebeheer |
| Notion | Geheugen en operating system |
| VS Code | Hoofd-IDE |
| Vercel | Hosting en previews waar relevant |

## Architectuurpipeline

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
-> toekomstige execution authority
```

## Veiligheidsregels

- Geen commits, pushes of deploys zonder expliciete toestemming.
- Geen provider calls zonder expliciete approval.
- Geen secrets in repositorybestanden, runtime output of documentatie.
- Geen deletes zonder expliciete toestemming.
- Werk op feature branches, nooit direct op `main`.
- Documentatie-first: contracts en docs voor runtimegedrag.
- Runtime-output blijft lokaal en wordt niet als broncode behandeld.

## Huidige status

- Studio OS heeft een primaire lokale productie-ingang in `apps/command-center/index.html`.
- Phase 1 t/m Phase 6 zijn gebouwd.
- Phase 7 is gesloten als non-executing Studio Command Preparation Layer.
- Phase 8 is compleet als non-executing AI Coordination Layer.
- Phase 9 is toegevoegd als non-executing Execution Governance Layer.
- Phase 10 is toegevoegd als non-executing Execution Readiness Layer.
- Phase 11 is toegevoegd als read-only Execution Readiness Dashboard Center.
- Phase 12 is toegevoegd als dashboard runtime boundary design; dashboard blijft passieve read-only consument.
- Phase 13 is toegevoegd als projection contract en no-write validator interface layer.
- Phase 14 is toegevoegd als read-only projection fixture validation en stale-projection detection layer.
- FIELD FLOW AI staat apart en is geen onderdeel meer van deze repo-baseline.
- Execution authority, provider calls, deployments en autonomous workflow handoff blijven future scope.

## Belangrijkste mappen

| Map | Doel |
| --- | --- |
| `agents/` | Agentrollen en uitvoeringsgrenzen |
| `apps/command-center/` | Primaire productieomgeving en startpagina voor Bas |
| `apps/public-site/` | Publieke website/marketingoppervlak |
| `apps/studio-dashboard/` | Technisch runtime-, governance- en diagnostiekdashboard |
| `apps/runtime-console/` | Runtime console documentatie |
| `config/` | Studio, provider, project, deployment en telemetry config |
| `docs/` | Architectuur, governance, runtime en operating model |
| `packages/` | Toekomstige gedeelde SDK- en packagegrenzen |
| `projects/` | Portfolio/registry-context voor Bas' projecten |
| `scripts/` | Lokale runtime-, validatie-, telemetry- en maintenance scripts |
| `services/` | Runtime, governance, intelligence en provider service boundaries |
| `shared/contracts/` | Machine-readable contracts |
| `shared/schemas/` | Runtime-validatie schemas |

## Workflow

1. Leg doel, scope en risico vast in documentatie.
2. Werk op een taakgerichte feature branch.
3. Pas alleen de relevante modules aan.
4. Controleer output, security, performance en documentatie-impact.
5. Laat baseline/release review doen voordat er wordt gecommit of gepusht.

## Handmatige validatie

Voer deze commando's alleen handmatig uit wanneer daar toestemming voor is. Sommige commando's kunnen runtime-output schrijven.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-architecture.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-config.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-command-contracts.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-coordination-contracts.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-execution-contracts.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-approval-registry.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-rollback-plans.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-idempotency-records.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-readiness-contracts.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-execution-plans.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-preflight-checks.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-approval-chains.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-readiness-boundaries.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-agent-registry.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-workflow-registry.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\services\coordination\generate-coordination-graph.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-coordination-graph.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\command\generate-command-classification.ps1 -InputPath .\shared\contracts\command\examples\command-classification.input.example.json
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\command\generate-codex-prompt.ps1 -InputPath .\shared\contracts\command\examples\codex-prompt.input.example.json
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\command\generate-action-plan.ps1 -InputPath .\shared\contracts\command\examples\action-plan.input.example.json
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\command\generate-release-checklist.ps1 -InputPath .\shared\contracts\command\examples\release-checklist.input.example.json
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\runtime\studio-console.ps1 -Command contracts -Output json
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\runtime\studio-console.ps1 -Command dashboard -Output json
```

## Git Waarschuwing

Werk altijd op taakgerichte feature branches. Deployments en provider calls blijven geblokkeerd totdat daarvoor een expliciete governance-approval en aparte execution-architectuur bestaan.
