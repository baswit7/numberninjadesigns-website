# Architectuur - AIDaytraden

## Doel
Een uitbreidbare projectarchitectuur ontwerpen voor: Een onderzoeks- en analysesysteem voor AI-ondersteunde daytradinginzichten met harde risicogrenzen.

## Huidige Architectuur
~~~text
AIDaytraden/
|-- docs/       Requirements, besluiten, API-status en operationele kennis
|-- src/        Productcode zodra scope is goedgekeurd
|-- assets/     Noodzakelijke projectassets en configuratievoorbeelden
+-- tests/      Regressie-, integratie- en validatiecontroles
~~~

## Functionele Grenzen
- Primair domein: Marktdata, signal research, backtesting en risicobeheer.
- Integratiestatus: Geen broker- of handelsintegratie actief; marktdata-provider nog te selecteren.
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
Geen live orders of financieel advies; analyses vereisen validatie en audit logging.
