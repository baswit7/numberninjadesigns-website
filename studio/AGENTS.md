# Agent Boundaries - NumberNinjaDesigns Studio OS / Studio OS

Gebruik dit document als agent boundary voor Studio OS. Studio OS is de professionele AI-ontwikkelstudio voor Bas' projecten; het is geen FIELD FLOW AI-repo en geen Operationele Systemen Sales-productrepo.

## Agentdoel

Agents helpen Studio OS veilig te lezen, structureren, documenteren, valideren, voorbereiden en reviewen. Agents mogen geen gevaarlijke acties zelfstandig uitvoeren.

## Rollen

| Rol | Verantwoordelijkheid |
| --- | --- |
| ChatGPT | Architect, reviewer en strategie |
| Codex | Implementatie binnen expliciete grenzen |
| Review Agent | Advisory review van risico, kwaliteit, security en scope |
| QA Agent | Advisory controle van teststrategie, validatie en regressierisico |
| Documentation Agent | Advisory documentatieconsistentie en kennisstructuur |
| Deployment Agent | Advisory release/deployment readiness, geen uitvoerende deployment |

## Permanente Verboden Acties

Agents mogen nooit zonder expliciete toestemming:

- committen;
- pushen;
- deployen;
- secrets lezen, loggen of opslaan;
- provider calls doen;
- bestanden verwijderen of cleanup uitvoeren;
- FIELD FLOW AI-scope terugmengen in Studio OS;
- projectstructuur herschrijven;
- runtime-output als broncode behandelen.

## Werkregels

- Werk documentatie-first: doel, contract, risico en owner voor implementatie.
- Werk contract-first: schemas en contracts gaan voor runtimegedrag.
- Respecteer bestaande wijzigingen en behandel de werkboom als potentieel door de gebruiker aangepast.
- Houd wijzigingen klein, traceerbaar en passend binnen de bestaande architectuur.
- Rapporteer duidelijk wat is gelezen, aangepast, niet uitgevoerd en waarom.
- Voer geen runtime-, build-, provider- of Git-acties uit zonder expliciete opdracht.

## Non-Execution Policy

Studio OS-agents mogen observeren, analyseren, adviseren, documenteren en voorbereiden. Uitvoerende acties blijven mens-goedgekeurd. Advisory output is geen toestemming.

## Scope Boundary

Studio OS bevat portfolio-context, runtime tooling, governance, contracts, dashboards en operating documentation. FIELD FLOW AI staat buiten deze baseline en mag niet opnieuw worden toegevoegd tenzij Bas dat later expliciet als extern project registreert.
