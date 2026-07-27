# Codex Instructies - BoodschappenVergelijker

## Doel
Codex voert wijzigingen voor **BoodschappenVergelijker** uit binnen deze projectgrens en houdt de technische documentatie synchroon met de implementatie.

## Projectfocus
- Domein: Prijsdata, normalisatie, vergelijking en consumentgerichte UX.
- Huidige prioriteit: Datamodel, bronkwaliteit, cachebeleid en matchingsregels ontwerpen.
- Kritieke randvoorwaarde: Toon herkomst, actualiteit en onzekerheid van prijzen zichtbaar aan gebruikers.

## Bouwregels
- Lees voor implementatie **docs/PROJECT_MASTER.md**, **docs/ARCHITECTURE.md**, **docs/API_STATUS.md** en **docs/ROADMAP.md**.
- Plaats productcode in **src/**, testbare controles in **tests/** en alleen benodigde media/configuratiesjablonen in **assets/**.
- Voeg geen dependency, API-koppeling, persoonsgegevensstroom of deployment toe zonder bijbehorende documentatie en validatie.
- Houd UI mobile-first, responsive, toegankelijk en voorzien van begrijpelijke status- en foutmeldingen waar UI wordt gebouwd.
- Ontwerp API-werk met cachingbesluit, begrensde retries, rate limits, token expiry, foutstatus en recovery.

## Definition Of Done
- Gedrag, tests/controle, performance- en security-impact zijn aantoonbaar beoordeeld.
- **CHANGELOG.md**, API-status, roadmap of debuggingnotities zijn bijgewerkt wanneer de wijziging dat vereist.
- De oplossing is reviewbaar op een taakgerichte branch en bevat geen secrets of dubbele backups.
