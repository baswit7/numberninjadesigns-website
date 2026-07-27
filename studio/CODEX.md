# Codex Instructies - AI Development Studio

## Doel
Deze instructies sturen alle wijzigingen in de centrale monorepo. Codex bouwt productiegericht, traceerbaar en zonder bestaande werkende onderdelen onbedoeld te overschrijven.

## Werkgrenzen
- Behandel iedere map onder `projects/` als zelfstandig productdomein.
- Plaats code in `shared/` alleen als minimaal twee projecten dezelfde stabiele behoefte hebben of als hergebruik vooraf aantoonbaar noodzakelijk is.
- Houd credentials, tokens en lokale secrets buiten Git; gebruik later platform secrets of lokale niet-geversioneerde configuratie.
- Activeer geen externe API, automatische publicatie, deployment of handelsactie zonder expliciete opdracht en validatie.

## Verplichte Workflow
1. Lees eerst `README.md`, `docs/ARCHITECTURE.md` en de relevante projectdocumentatie.
2. Controleer `git status` en werk op een taakgerichte `feature/`-branch.
3. Leg architectuur-, API- of scopebeslissingen direct vast in de bijbehorende documentatie.
4. Bouw modulair, mobile-first voor UI, met foutafhandeling, statusweergave, logging en herstelstrategie waar relevant.
5. Draai `scripts/check-structure.ps1` en projectspecifieke tests voor oplevering.
6. Werk `CHANGELOG.md` bij voor betekenisvolle wijzigingen.

## Kwaliteitseisen
- Geen placeholders in productiefunctionaliteit of onbeheerde losse experimenten.
- Geen dubbele bronbestanden of backups in de repository.
- Minimaliseer dependencies; motiveer elke nieuwe externe dependency.
- Ontwerp API-integraties met caching, rate limits, retries, auth expiry, CORS-beperkingen en duidelijke connection status.
- Controleer privacy, security en datalicenties voordat echte gegevens worden verwerkt.

## Projectoverdracht
Iedere wijziging moet duidelijk maken: doel, impact, testresultaat, open risico's en benodigde vervolgbeslissingen. Notion bevat planning; GitHub bevat de gereviewde waarheid.
