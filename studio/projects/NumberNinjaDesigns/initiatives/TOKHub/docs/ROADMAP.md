# Roadmap - TOKHub

## Doel
De ontwikkeling sturen van gevalideerde scope naar een controleerbaar, waardevol product.

## Status
De roadmap start in discovery; deadlines worden pas vastgelegd nadat prioriteit en eigenaar in Notion zijn bevestigd.

## Fase 1 - Validatie
- Bevestig probleem, doelgroep, eigenaar, waardepropositie en succesmetric.
- Werk eerste gebruikersflow, datastromen, privacy- en securityrisico's uit.
- Beslis welke API's, tools of data echt nodig zijn.

## Fase 2 - Eerste Levering
- Bouw de kleinste productiegeschikte functionaliteit met tests en operationele documentatie.
- Voeg statusweergave, foutafhandeling, logging en recovery toe waar integraties of UI bestaan.
- Laat code en productgedrag reviewen voordat deployment of echte data wordt gebruikt.

## Fase 3 - Schalen
- Meet gebruik, performance, betrouwbaarheid en businesswaarde.
- Promote bewezen herbruikbare bouwblokken gecontroleerd naar **shared/**.
- Automatiseer alleen processen met beheersbare fouten, audittrail en rollback.

## Eerstvolgende Acties
- Databronnen, auth-strategie, retrybeleid en content review-flow vastleggen.
- Stel acceptatiecriteria en een expliciete go/no-go voor implementatie op.

## Risico
Geen automatische publicatie of credential-opslag zonder expliciete security review.
