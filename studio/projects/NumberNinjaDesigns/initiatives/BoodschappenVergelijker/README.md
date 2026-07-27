# BoodschappenVergelijker

## Doel
Een vergelijkingsproduct voor boodschappenprijzen met betrouwbare productmatching en heldere besparingsinzichten.

## Status
- Fase: initialisatie en scopevalidatie.
- Implementatie: projectscaffold gereed; nog geen productiecode of deployment actief.
- Prioriteit: Datamodel, bronkwaliteit, cachebeleid en matchingsregels ontwerpen.

## Architectuur
Dit project is een zelfstandig domein binnen AI Development Studio. Broncode komt in **src/**, projectassets in **assets/**, verificatie in **tests/** en beslissingen in **docs/**. Alleen bewezen herbruikbare onderdelen mogen na review naar **../../shared/**.

## Gebruikte Tools
- Domein: Prijsdata, normalisatie, vergelijking en consumentgerichte UX.
- Beoogde hulpmiddelen: Dataverwerking, web/API-bronnen na validatie, analytics en responsive UI.
- Centrale workflow: Notion voor planning, GitHub voor waarheid, Codex voor bouw, ChatGPT voor review en Vercel voor goedgekeurde webdeployments.

## Workflow
1. Bevestig de scope in **docs/PROJECT_MASTER.md** en prioriteiten in **docs/ROADMAP.md**.
2. Leg integraties en risico's vast in **docs/API_STATUS.md** voordat externe gegevens worden gebruikt.
3. Bouw op een feature-branch en valideer functionaliteit in **tests/**.
4. Werk documentatie en changelog bij voor review en eventuele deployment.

## Open Taken
- Datamodel, bronkwaliteit, cachebeleid en matchingsregels ontwerpen.
- Definieer eerste acceptatiecriteria, gegevensbronnen en meetbare succesmetric.
- Selecteer alleen noodzakelijke integraties en documenteer security- en performancevoorwaarden.

## Bekende Bugs
Geen applicatiebugs geregistreerd; er is nog geen uitvoerbare productfunctionaliteit.

## Randvoorwaarde
Toon herkomst, actualiteit en onzekerheid van prijzen zichtbaar aan gebruikers.
