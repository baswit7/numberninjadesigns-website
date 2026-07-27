# Quality Gates

## Doel
Quality Gates voorkomen releases met zwakke architectuur, slechte UX, securityrisico's, ontbrekende documentatie of ongetoetste commerciele aannames. Geen release gaat door zonder gate-evaluatie.

## Gate Status
| Status | Betekenis |
| --- | --- |
| Pass | Voldoet aan releasecriteria |
| Warning | Bekend risico, expliciet geaccepteerd |
| Blocker | Release stopt tot herstel is afgerond |
| Not Applicable | Niet relevant voor deze wijziging, met motivatie |

## Release Gates

### 1. Architecture Check
Criteria:
- modulegrenzen zijn duidelijk;
- afhankelijkheden zijn expliciet;
- shared modules hebben eigenaar en contract;
- scaling risks zijn bekend.

Blockers:
- verborgen dependency;
- onduidelijke ownership;
- breaking change zonder migratiepad.

### 2. UX Check
Criteria:
- mobile-first en responsive;
- loading, empty en error states aanwezig waar relevant;
- statusindicatoren zijn duidelijk;
- conversiepad is logisch.

Blockers:
- onbruikbare mobiele flow;
- overlappende UI;
- kritieke actie zonder feedback.

### 3. Performance Check
Criteria:
- baseline is gemeten of verantwoord;
- zware berekeningen zijn beperkt;
- lazy loading/caching is overwogen;
- geen duidelijke memory leaks.

Blockers:
- bekende performance-regressie;
- onbegrensde loops of polling;
- grote assets zonder strategie.

### 4. Security Check
Criteria:
- geen secrets in repository;
- API keys via local/deployment secrets;
- auth, token expiry en permissions zijn beschreven;
- logging lekt geen gevoelige data.

Blockers:
- exposed secret;
- onveilige auth flow;
- PII zonder beleid.

### 5. API Check
Criteria:
- API registry is bijgewerkt;
- rate limits, retries en timeouts zijn beschreven;
- CORS en token expiry zijn beoordeeld;
- fallback of degraded mode is bekend.

Blockers:
- undocumented API;
- geen foutafhandeling voor kritieke integratie;
- productie-API zonder secretsstrategie.

### 6. Documentation Check
Criteria:
- README, architecture en changelog zijn actueel;
- projectdossier beschrijft impact;
- AI-agents kunnen context compact herleiden.

Blockers:
- ontbrekende release-notes;
- architectuur wijkt af van documentatie;
- beslissingen zijn niet traceerbaar.

### 7. Commercial Check
Criteria:
- doelgroep, probleem en waardepropositie zijn helder;
- revenue of validation hypothesis is meetbaar;
- launchcomplexiteit is beoordeeld.

Blockers:
- launch zonder doelgroep;
- betaalmodel raakt compliance zonder review;
- geen meetbaar validatiedoel.

### 8. Automation Check
Criteria:
- herhaalbare workflows zijn gedocumenteerd;
- retries, fallback en idempotency zijn beoordeeld;
- handmatige stappen zijn bekend.

Blockers:
- irreversible automation zonder confirmatie;
- posting/payment/production write zonder rollback;
- geen zichtbare foutstatus.

### 9. AI Readability Check
Criteria:
- taken zijn afgebakend;
- docs gebruiken consistente koppen en tabellen;
- prompt blocks zijn herbruikbaar;
- centrale waarheid is duidelijk.

Blockers:
- context alleen in chat;
- dubbele conflicterende instructies;
- onduidelijke projectstatus.

### 10. Scaling Check
Criteria:
- datagroei, gebruikersgroei en operationele groei zijn beoordeeld;
- bottlenecks zijn benoemd;
- modularisatiepad is bekend.

Blockers:
- schaalrisico raakt kernflow zonder plan;
- shared module kan meerdere projecten breken;
- geen rollback of fallback bij growth-critical change.

## Thresholds
- Alle blockers moeten opgelost zijn voor release.
- Maximaal twee warnings bij beta-release.
- Productielaunch vereist minimaal 80 Launch Readiness Score.
- Commerciele launch vereist minimaal 70 Revenue Potential Score.

## Escalatie
Gate-eigenaar bepaalt herstelactie. Release Agent bewaakt go/no-go. Bij conflict beslist de project owner op basis van risico, impact en rollbackbaarheid.
