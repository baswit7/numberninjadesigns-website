# Phase 7: Studio Command & Automation Layer

## Doel

Phase 7 definieert de Studio Command & Automation Layer als veilige voorbereidingslaag tussen Governance & Release Control en toekomstige workflow-integraties.

De laag mag bestaande runtime-, dashboard- en governance-output lezen, acties classificeren, risico's samenvatten, Codex-prompts voorbereiden, release-checklists genereren en workflowstappen klaarzetten voor menselijke beoordeling.

Phase 7 voert geen acties uit. Het ontwerp is bewust non-executing totdat contracts, approval boundaries en auditregels volwassen genoeg zijn.

## Scope

Phase 7 mag:

- bestaande runtime reports lezen
- bestaande dashboard view models lezen
- bestaande governance outputs lezen
- aanbevolen acties genereren
- Codex-prompts genereren
- release-checklists genereren
- risk-based action plans maken
- workflowstappen voorbereiden voor Notion, GitHub en Vercel
- acties classificeren als `SAFE_READ`, `SAFE_WRITE_DOCS`, `SAFE_GENERATE_PROMPT`, `REQUIRES_APPROVAL` of `BLOCKED`
- expliciet rapporteren waarom een actie wel of niet veilig is

## Out Of Scope

Phase 7 mag niet:

- committen
- pushen
- mergen
- deployen
- provider calls doen
- secrets lezen
- credentials opslaan
- bestanden verwijderen
- projectstructuur herschrijven
- governance score herberekenen
- runtime-validatie dupliceren
- dashboard adapter dupliceren
- business features bouwen
- runtime console uitvoeren
- generated runtime output maken of muteren

## Architectuurpositie

Phase 7 komt na Governance & Release Control en voor toekomstige externe workflow-automatisering.

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
-> Studio Command & Automation Layer
-> Human Approval Boundary
-> Future Notion / GitHub / Vercel workflow handoff
```

De laag is een command-preparation layer, geen command-execution layer. Governance blijft de bron voor eligibility. Runtime en dashboard blijven de bron voor observed state.

## Command Classification Model

| Classification | Betekenis | Toegestaan gedrag |
| --- | --- | --- |
| `SAFE_READ` | Alleen lezen van bestaande repositorydocs, contracts of bestaande generated reports | Samenvatten, vergelijken, status rapporteren |
| `SAFE_WRITE_DOCS` | Alleen documentatievoorstellen of documentatiebestanden aanpassen binnen expliciete scope | Docs maken of wijzigen na taakcontext, zonder runtime-output |
| `SAFE_GENERATE_PROMPT` | Prompt, checklist, reviewplan of handoff-instructie maken | Codex-prompts, PR-reviewprompts, release-checklists voorbereiden |
| `REQUIRES_APPROVAL` | Actie kan nuttig zijn maar raakt Git, deploy, provider, workflowmutatie of externe systemen | Alleen rapporteren en approvaltekst voorbereiden |
| `BLOCKED` | Actie schendt safety boundary of mist noodzakelijke context | Niet uitvoeren; blocker en veilig alternatief rapporteren |

### Default Classification Rules

- Onbekende actie: `BLOCKED`
- Provider-gerelateerde actie zonder expliciete approval: `REQUIRES_APPROVAL`
- Secret- of credential-gerelateerde actie: `BLOCKED`
- Delete, prune, reset of destructive filesystem intent: `BLOCKED`
- Git commit, push, merge of branch mutation: `REQUIRES_APPROVAL`
- Deploy of promote: `REQUIRES_APPROVAL`
- Documentatie-only ontwerpwijziging binnen expliciete scope: `SAFE_WRITE_DOCS`
- Prompt of checklist zonder execution side effect: `SAFE_GENERATE_PROMPT`

## Safety Boundaries

Phase 7 is gebonden aan dezelfde safety posture als Governance, met een extra command boundary:

- advisory output is geen toestemming
- recommended action is geen execution authority
- generated prompt is geen instructie om automatisch uit te voeren
- workflow handoff is geen API call
- release checklist is geen release approval
- approval moet expliciet, menselijk en traceerbaar zijn
- gevaarlijke of onbekende intent valt terug naar `BLOCKED`

## Non-Execution Policy

Phase 7 mag acties voorbereiden, maar niet uitvoeren. De laag maakt van systeemstatus een gecontroleerd actievoorstel met risico, classificatie, evidence en benodigde approval.

Niet toegestaan:

- shellcommands uitvoeren als onderdeel van command planning
- runtime console starten
- live providers inspecteren
- tickets, issues, deployments of Notion pages aanmaken
- Git-state muteren
- files buiten de expliciete documentatiescope wijzigen
- bestaande runtime- of governance-engines opnieuw implementeren

## Inputbronnen

Phase 7 mag alleen lezen uit bestaande, toegestane bronnen:

- `docs/`
- `agents/`
- `projects/`
- `config/*.config.json`
- `shared/contracts/*.json`
- `shared/schemas/*.json`
- bestaande `runtime/reports/*.json` wanneer lokaal aanwezig
- bestaande `runtime/dashboard/*.json` wanneer lokaal aanwezig
- bestaande governance view models wanneer lokaal aanwezig

Runtime-output blijft lokale evidence. Het ontbreken van runtime-output moet als ontbrekende input worden gerapporteerd, niet door nieuwe runtime-uitvoering worden opgelost.

## Outputvoorstellen

Toekomstige Phase 7-output kan bestaan uit:

- command classification report
- recommended action plan
- Codex prompt package
- release checklist proposal
- GitHub handoff proposal
- Notion handoff proposal
- Vercel handoff proposal
- approval request summary
- blocked action report

Deze outputs zijn voorstellen. Ze mogen geen side effects hebben.

## Contractvoorstel

Een toekomstig contract kan `studio-command-plan.contract.json` heten en minimaal deze velden bevatten:

| Field | Doel |
| --- | --- |
| `commandPlanId` | Stabiele identificatie van het voorstel |
| `createdAt` | Tijdstip van generatie |
| `sourceInputs` | Gebruikte docs, reports en view models |
| `intent` | Korte beschrijving van de gevraagde actie |
| `classification` | Een van de vijf command classifications |
| `riskLevel` | `low`, `medium`, `high` of `critical` |
| `evidence` | Verwijzingen naar gebruikte input |
| `recommendedSteps` | Niet-uitvoerende stappen of handoff |
| `forbiddenSteps` | Expliciet geblokkeerde acties |
| `approvalRequired` | Boolean voor menselijke approval |
| `approvalReason` | Waarom approval nodig is |
| `safePrompt` | Optionele Codex-prompt zonder execution side effects |
| `checklist` | Optionele release- of reviewchecklist |
| `status` | `proposed`, `blocked`, `ready_for_review` of `approved_by_human` |

Het contract mag pas worden toegevoegd wanneer Phase 7 implementatie start. Deze fase legt alleen het ontwerp vast.

Het command-plan ontwerp wordt later opgesplitst naar minimaal vier schemafamilies:

| Schemafamilie | Doel |
| --- | --- |
| `action-plan.schema.json` | Voor aanbevolen acties, blockers, risk level, approval requirements en traceability. |
| `command-classification.schema.json` | Voor classificatie per actie: `SAFE_READ`, `SAFE_WRITE_DOCS`, `SAFE_GENERATE_PROMPT`, `REQUIRES_APPROVAL`, `BLOCKED`. |
| `codex-prompt.schema.json` | Voor gegenereerde Codex-prompts inclusief allowed actions, forbidden actions, expected output en approval gates. |
| `release-checklist.schema.json` | Voor release gates, manual signoff, blockers en non-execution release preparation. |

Deze schemafamilies zijn future design boundaries. Phase 7 design maakt ze nog niet aan en bouwt geen implementatie.

## Dashboardvoorstel

Een toekomstig dashboardpaneel mag alleen bestaande command proposal output tonen:

- totaal aantal voorgestelde acties
- verdeling per classification
- hoogste risico's
- acties die approval vereisen
- geblokkeerde acties met reden
- gegenereerde prompts en checklists als copy-only tekst

Het dashboardpaneel mag geen knoppen bevatten die acties uitvoeren, providers bellen, Git muteren, deployments starten of runtime commands triggeren.

## Implementatievolgorde

1. Leg ADR en governance design vast.
2. Definieer command classification contract.
3. Definieer read-only input boundary.
4. Maak een deterministic planner die alleen bestaande input leest.
5. Maak output als voorstelbestand, niet als runtime execution.
6. Voeg validatie toe die forbidden actions detecteert.
7. Voeg dashboard-only rendering toe voor proposal output.
8. Voeg pas daarna optionele handoff templates toe voor Notion, GitHub en Vercel.

## Acceptatiecriteria

Phase 7 is pas acceptabel wanneer:

- elke actie een classification heeft
- onbekende acties standaard blokkeren
- provider calls onmogelijk blijven
- Git-mutaties niet automatisch kunnen plaatsvinden
- deploys niet automatisch kunnen plaatsvinden
- secrets niet gelezen of weergegeven worden
- governance score niet opnieuw berekend wordt
- runtime-validatie niet wordt gedupliceerd
- dashboard adapterlogica niet wordt gedupliceerd
- outputs aantoonbaar advisory blijven
- approval boundaries expliciet in docs en contracts staan

## Risico's

| Risico | Impact | Mitigatie |
| --- | --- | --- |
| Recommendations worden als toestemming behandeld | Onveilige uitvoering | Iedere output bevat classification, risk en approval status |
| Scope creep naar agent execution | Architectuurgrens vervaagt | ADR-007 verbiedt execution first |
| Duplicatie van governance scoring | Conflicterende truth source | Phase 7 leest governance output alleen |
| Duplicatie van dashboard adapter | Inconsistent view model | Phase 7 leest bestaande dashboard output alleen |
| Provider leakage | Secrets of live calls in command layer | Geen provider SDKs, geen tokens, geen live calls |
| Workflow side effects | Onbedoelde GitHub/Notion/Vercel-mutaties | Handoff proposals zijn tekstueel en copy-only |

## Verdict

Phase 7 mag starten als documentatie-first en contract-first ontwerp. Implementatie blijft geblokkeerd totdat het non-execution model en approval contract expliciet zijn goedgekeurd.
