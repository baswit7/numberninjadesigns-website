# AIDaytraden

## Doel
Een onderzoeks- en analysesysteem voor AI-ondersteunde daytradinginzichten met harde risicogrenzen.

## Status
- Fase: initialisatie en scopevalidatie.
- Implementatie: projectscaffold gereed; nog geen productiecode of deployment actief.
- Prioriteit: Risicobeleid, datalicenties, backtestmethodiek en menselijke approval gates bepalen.

## Architectuur
Dit project is een zelfstandig domein binnen AI Development Studio. Broncode komt in **src/**, projectassets in **assets/**, verificatie in **tests/** en beslissingen in **docs/**. Alleen bewezen herbruikbare onderdelen mogen na review naar **../../shared/**.

## Gebruikte Tools
- Domein: Marktdata, signal research, backtesting en risicobeheer.
- Beoogde hulpmiddelen: Marktdata-API na selectie, analytics, logging en gecontroleerde experimenten.
- Centrale workflow: Notion voor planning, GitHub voor waarheid, Codex voor bouw, ChatGPT voor review en Vercel voor goedgekeurde webdeployments.

## Workflow
1. Bevestig de scope in **docs/PROJECT_MASTER.md** en prioriteiten in **docs/ROADMAP.md**.
2. Leg integraties en risico's vast in **docs/API_STATUS.md** voordat externe gegevens worden gebruikt.
3. Bouw op een feature-branch en valideer functionaliteit in **tests/**.
4. Werk documentatie en changelog bij voor review en eventuele deployment.

## Open Taken
- Risicobeleid, datalicenties, backtestmethodiek en menselijke approval gates bepalen.
- Definieer eerste acceptatiecriteria, gegevensbronnen en meetbare succesmetric.
- Selecteer alleen noodzakelijke integraties en documenteer security- en performancevoorwaarden.

## Bekende Bugs
Geen applicatiebugs geregistreerd; er is nog geen uitvoerbare productfunctionaliteit.

## Randvoorwaarde
Geen live orders of financieel advies; analyses vereisen validatie en audit logging.
