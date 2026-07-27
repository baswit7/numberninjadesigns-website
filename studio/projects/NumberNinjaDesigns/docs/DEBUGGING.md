# Debugging - NumberNinjaDesigns

## Doel
Problemen snel reproduceren, de root cause vaststellen en structureel verhelpen zonder nieuwe operationele risico's.

## Status
Er is nog geen uitvoerbare productcode. Dit document definieert het minimale diagnose- en loggingcontract voor toekomstige implementatie.

## Diagnoseflow
1. Registreer branch, versie, omgeving, invoer, verwachte uitkomst en feitelijke uitkomst.
2. Reproduceer lokaal met gecontroleerde testdata.
3. Inspecteer state, netwerk/API, auth, console/logs en eventuele cache.
4. Identificeer oorzaak en impact; pas daarna code of configuratie aan.
5. Voeg regressiecontrole toe en registreer resultaat in het changelog bij relevante fixes.

## Logging En Herstel
- Gebruik gestructureerde logevents zonder secrets of gevoelige gegevens.
- Maak connectionstatus zichtbaar wanneer externe services ontstaan: verbonden, reconnecting of fout.
- Begrens retries en lever een bruikbare herstelactie in plaats van stil falen.
- Documenteer reset- of rollbackgedrag voordat persistent state wordt gebruikt.

## Bekende Bugs
Geen bekende bugs; implementatie is nog niet gestart.

## Open Taken
- Kies projectspecifieke testgevallen wanneer de eerste flow is bevestigd.
- Leg API-foutcodes, rate limits en recovery vast zodra integraties worden gekozen.
