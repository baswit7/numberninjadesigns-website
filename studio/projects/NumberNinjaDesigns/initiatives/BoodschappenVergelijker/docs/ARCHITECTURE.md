# Architectuur - BoodschappenVergelijker

## Doel
Een uitbreidbare projectarchitectuur ontwerpen voor: Een vergelijkingsproduct voor boodschappenprijzen met betrouwbare productmatching en heldere besparingsinzichten.

## Huidige Architectuur
~~~text
BoodschappenVergelijker/
|-- docs/       Requirements, besluiten, API-status en operationele kennis
|-- src/        Productcode zodra scope is goedgekeurd
|-- assets/     Noodzakelijke projectassets en configuratievoorbeelden
+-- tests/      Regressie-, integratie- en validatiecontroles
~~~

## Functionele Grenzen
- Primair domein: Prijsdata, normalisatie, vergelijking en consumentgerichte UX.
- Integratiestatus: Prijsbronnen en juridische gebruiksvoorwaarden moeten nog worden bevestigd.
- Gedeelde functionaliteit wordt niet vooraf gebouwd; promotie naar **shared/** vereist stabiel contract en tweede gebruikscase.

## Niet-Functionele Eisen
- Performance: ontwerp databewerking en UI rond meetbare volumes; voorkom onnodige dependencies.
- Security: geen credentials of gevoelige data in Git of clientcode; valideer auth en toegangsrechten.
- Reliability: externe acties vereisen timeout, begrensde retries, logging, statusmelding en herstelpad.
- UX: eventuele interface is mobile-first, responsive en duidelijk bij loading, succes, reconnecting en fouten.

## Open Architectuurbesluiten
- Eerste gebruikersflow en data-entiteiten.
- Benodigde externe services, cachebeleid en deploymentmodel.
- Teststrategie en minimale observability voor productiegebruik.

## Randvoorwaarde
Toon herkomst, actualiteit en onzekerheid van prijzen zichtbaar aan gebruikers.
