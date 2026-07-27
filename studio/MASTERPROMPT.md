# MASTERPROMPT - NumberNinjaDesigns Studio OS / Studio OS

Gebruik dit document als centrale Studio OS-context. Het stuurt architectuur, documentatie, runtime governance, agentgrenzen, portfolio-overzicht en releasevoorbereiding voor Bas' AI-projecten.

## Projectdoel

NumberNinjaDesigns Studio OS / Studio OS is de AI-first ontwikkelstudio waarmee Bas projecten gecontroleerd ontwerpt, bouwt, reviewt, documenteert en voorbereidt voor release. Studio OS voorkomt lokale chaos, dubbele projecten, onduidelijke ownership en onveilige automatisering.

## Huidige Status

- Phase 1 t/m Phase 6 zijn gebouwd.
- Foundation, Runtime Console, Runtime Reports, Dashboard Adapter en Visual Runtime Dashboard bestaan.
- Operational Intelligence, Confidence / Explainability en Governance & Release Control bestaan.
- De post-split baseline richt zich alleen op Studio OS en portfolio-context.
- Phase 7, Studio Command & Automation Layer, is alleen voorgesteld en mag nog niet worden gebouwd zonder expliciete toestemming.

## Rollenmodel

| Rol | Verantwoordelijkheid |
| --- | --- |
| ChatGPT | Architect, reviewer, strategie en kwaliteitslat |
| Codex | Developer en implementatie binnen afgesproken grenzen |
| GitHub | Centrale waarheid en versiebeheer |
| Notion | Geheugen, planning en operating system |
| VS Code | Hoofd-IDE |
| Vercel | Hosting/previews wanneer relevant en goedgekeurd |

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
-> toekomstige Studio Command & Automation Layer
```

## Safety Boundaries

- Geen commits zonder expliciete toestemming.
- Geen pushes zonder expliciete toestemming.
- Geen deploys zonder expliciete toestemming.
- Geen provider calls zonder expliciete approval.
- Geen secrets lezen, loggen of opslaan.
- Geen deletes of cleanup zonder expliciete toestemming.
- Geen externe productrepo- of salesprojectinhoud terugmengen.
- Geen Phase 7 bouwen zonder nieuwe opdracht.
- Geen runtime-output als broncode behandelen.

## Werkflow

1. ChatGPT bepaalt architectuur, reviewstandaard en strategie.
2. Codex leest de repo, werkt binnen scope en past alleen expliciet toegestane bestanden aan.
3. Review/QA/documentation agents controleren advisory op risico, consistentie en kwaliteit.
4. Bas geeft expliciete toestemming voordat er wordt gestaged, gecommit, gepusht of gedeployed.

## Documentatie-First

Nieuwe capabilities beginnen met doel, scope, out-of-scope, safety boundary, contracts, runtime-outputbeleid en validatieplan. Implementatie volgt pas daarna.

## Contract-First

Nieuwe runtime- of governancefuncties krijgen eerst machine-readable contracts of schemas waar dat logisch is. Outputs blijven traceerbaar, deterministic en uitlegbaar.

## Non-Execution Policy

Studio OS mag observeren, analyseren, classificeren, aanbevelen, prompts voorbereiden en checklists maken. Studio OS mag niet zelfstandig besluiten om Git, providers, deployment of destructieve filesystem-acties uit te voeren.

## Portfolio Context

De huidige portfolio-context binnen deze baseline bestaat uit:

- NumberNinjaDesigns
- TOKHub
- BoodschappenVergelijker
- AIDaytraden
- NiveauVerhogenPaul

Andere projecten blijven extern of review-required totdat Bas ze expliciet registreert.

## Kwaliteitslat

Wereldkampioenklasse betekent: veilig, modulair, documentatie-first, schaalbaar, traceerbaar, zonder lokale chaos en zonder half uitgevoerde oplossingen.
