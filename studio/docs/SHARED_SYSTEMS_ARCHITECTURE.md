# Shared Systems Architecture

## 1. Doel van shared systems
Shared systems vormen de herbruikbare laag van AI Development Studio. Het doel is om bewezen patronen een vaste plek te geven zonder projecten strak aan elkaar te koppelen. De laag voorkomt documentatie- en implementatieduplicatie, houdt contextbelasting laag en maakt toekomstige projecten sneller op te starten.

De shared laag is geen tweede applicatie, framework of platform. Het is een gecontroleerde bibliotheek van contracten, templates, richtlijnen en later eventueel kleine herbruikbare modules. Alles in `shared/` moet projectonafhankelijk, onderhoudbaar en veilig te hergebruiken zijn.

## 2. Welke onderdelen gedeeld worden
De volgende onderdelen horen centraal zodra minimaal twee projecten dezelfde behoefte hebben of wanneer een contract portfolio-breed standaard moet zijn:

| Shared map | Inhoud | Promotiecriterium |
| --- | --- | --- |
| `shared/ui/` | Design tokens, layoutpatronen, navigatie/footerpatronen, toegankelijkheidsregels en kleine UI-bouwblokken | Herbruikbaar in meerdere statische of webprojecten zonder projectbranding te breken |
| `shared/prompts/` | Generieke promptpatronen, evaluatiecriteria, outputschemas en reviewrubrics | Geen projectgeheimen, getest op minimaal een kleine evaluatieset |
| `shared/automation/` | Workflowpatronen, retrybeleid, loggingstrategie, approval gates en herstelprocedures | Foutpaden, rollback en handmatige controle zijn beschreven |
| `shared/analytics/` | KPI-definities, eventtaxonomie, meetplannen en dashboardcontracten | Databron, definitie en privacy-impact zijn reproduceerbaar |
| `shared/apis/` | API-contracten, configuratiepatronen, authregels, rate-limitbeleid, cachebeleid en statusmodellen | Security, token expiry, CORS, retries en fallback zijn beoordeeld |
| `shared/templates/` | Projectdocumenttemplates, checklists, releaseformats en intakeformats | Stabiel format met duidelijke eigenaar en versiebeheer |

## 3. Welke onderdelen project-specifiek blijven
Projecten blijven eigenaar van hun eigen productcontext, gebruikersflows, merkregels, assets, credentials, API-keuzes, datalicenties, roadmap, tests en implementatie. Een onderdeel blijft project-specifiek wanneer het:

- afhankelijk is van merkidentiteit, tone of voice of visuele richting, zoals NumberNinjaDesigns tactical-tech branding;
- productiegegevens, API-credentials, klantdata of platformrechten raakt;
- slechts in een project voorkomt;
- nog experimenteel, ongevalideerd of afhankelijk van onduidelijke requirements is;
- compliance raakt, zoals Pinterest-publicatievoorwaarden of social-platform approvals.

Projecten mogen `shared/` gebruiken als bron van patronen, maar blijven verantwoordelijk voor implementatie, testen en securitybesluiten binnen hun eigen map.

## 4. Shared UI strategie
De UI-laag begint documentatie-first. Eerst worden tokens, componentregels en patronen vastgelegd; pas daarna komen herbruikbare codecomponenten. Dit voorkomt dat de repo een generiek design framework wordt voordat de echte hergebruikcases duidelijk zijn.

Centraliseerbaar:
- kleur-, spacing-, typografie- en motionregels die in meerdere projecten terugkomen;
- responsive navigatie- en footerpatronen;
- loading-, empty-, error-, reconnecting- en success-states;
- toegankelijkheidsregels voor contrast, focus, toetsenbordbediening en semantiek;
- statische HTML-patronen die nu herhaald inline CSS, nav of footer bevatten.

Project-specifiek:
- merkpaletten, campagnes, productfotografie, copywriting en conversieflows;
- projectassets en platform-specifieke UI voor Etsy, TikTok, Pinterest of andere kanalen;
- volledige pagina-implementaties totdat een patroon minstens twee keer stabiel is bewezen.

## 5. Shared SEO strategie
SEO wordt centraal vastgelegd als structuur en kwaliteitsmodel, niet als een universele set teksten. Shared SEO bevat straks metadataregels, title/description-lengtes, canonicalregels, structured-data-checklists, indexatiecriteria en contentbrief-templates.

Projecten houden hun eigen zoekintentie, keywords, productclaims, taalvarianten en compliancecontroles. Voor social commerce blijft publicatie altijd gekoppeld aan platformvoorwaarden en menselijke review wanneer content extern wordt geplaatst.

## 6. Shared analytics strategie
Analytics wordt gedeeld via een eventtaxonomie en KPI-definities. De shared laag definieert naamgeving, minimale eventvelden, privacyregels, consentvereisten, funneldefinities en rapportageformats.

Projecten bepalen zelf welke events worden geactiveerd, welke tooling wordt gebruikt en welke datastromen zijn toegestaan. Er wordt geen analytics-runtime centraal toegevoegd totdat een project concrete volumes, tooling en privacybesluit heeft.

## 7. Shared automation strategie
Automation wordt centraal beschreven via betrouwbare patronen:

- triggerdefinitie en idempotentie;
- retry met begrenzing en backoff;
- rate-limitafhandeling;
- audit logging zonder secrets of persoonsgegevens;
- approval gates voor publicatie, externe communicatie en financiele impact;
- rollback- of recoverypad;
- statusmodel: connected, reconnecting, error en disabled.

Automatiseringen blijven project-specifiek wanneer zij publiceren, platformrechten gebruiken, klantdata verwerken of afhankelijk zijn van externe API-voorwaarden. Dit beschermt onder andere Pinterest- en social-compliance.

## 8. Shared prompts strategie
Shared prompts bevatten alleen generieke patronen: rolkaders, kwaliteitsrubrics, outputschemas, evaluatieprompts en reviewchecklists. Projectprompts blijven in `projects/<project>/docs/PROMPTS.md` zolang ze merk, doelgroep, platformregels of concrete flows bevatten.

Promotie naar `shared/prompts/` vereist:
- duidelijk input- en outputcontract;
- bekende beperkingen en foutgedrag;
- kleine evaluatieset;
- geen secrets, persoonsgegevens of vertrouwelijke bedrijfsdata;
- eigenaar en versienummer.

## 9. Shared API/config/security strategie
`shared/apis/` is de nieuwe standaardmap voor API- en configuratiepatronen. De bestaande `shared/api/` map is aangetroffen als naamgevings-overlap en blijft ongemoeid om bestaande verwijzingen niet te breken. Nieuwe documentatie en toekomstige contracten gebruiken `shared/apis/`.

Shared API-documentatie moet altijd bevatten:
- configuratievelden zonder echte secrets;
- auth- en token-expirystrategie;
- rate-limitgedrag en retrybeleid;
- timeoutwaarden en fallbackgedrag;
- CORS-risico's bij client-side gebruik;
- cachingregels en invalidatie;
- loggingregels zonder credentials;
- test-connectiecriteria;
- statusindicatoren voor operators of gebruikers.

Credentials worden nooit in Git opgeslagen. Voorbeelden mogen alleen fictieve waarden bevatten en horen duidelijk als voorbeeld gemarkeerd te zijn.

## 10. Minimale token/contextbelasting
Shared systems moeten context besparen. Daarom worden gedeelde regels kort, modulair en vindbaar gehouden. Projectdocumentatie verwijst naar shared contracten in plaats van dezelfde tekst volledig te herhalen.

Regels:
- maak per shared domein kleine documenten met een helder doel;
- verwijs naar shared patronen vanuit projectdocs;
- kopieer alleen projectspecifieke afwijkingen;
- voorkom grote algemene handboeken in projectmappen;
- bewaar implementatiedetails bij de code en besluitregels in docs;
- splits pas wanneer documenten onhandig groot of inhoudelijk verschillend worden.

## 11. Regels voor toekomstig gebruik
- Voeg niets toe aan `shared/` zonder aantoonbare hergebruikcase of portfolio-breed governancebelang.
- Houd `shared/` vrij van secrets, build-output, grote assets, ruwe exports en tijdelijke experimenten.
- Projecten importeren of kopieren geen interne bestanden van andere projecten; hergebruik loopt via `shared/`.
- Runtimecode wordt pas gedeeld nadat contract, eigenaar, teststrategie en compatibility-impact duidelijk zijn.
- Compliancebasissen, zoals Pinterest-regels, worden niet verplaatst of aangepast zonder expliciet compliancebesluit.
- Elke shared toevoeging vermeldt impact op security, performance, onderhoud en contextbelasting.
- Vermijd enterprise overengineering: geen microservices, Docker, Kubernetes of frameworklaag zonder bewezen noodzaak.

## 12. Concrete vervolgstappen
1. Maak per shared map een compacte index met eigenaar, status en toegestane inhoud.
2. Hernoem toekomstige API-verwijzingen naar `shared/apis/` en laat `shared/api/` alleen bestaan als legacy-overlap totdat er geen verwijzingen meer zijn.
3. Extraheer uit projectdocs eerst templates voor `API_STATUS.md`, `PROMPTS.md`, `DEBUGGING.md` en `ARCHITECTURE.md`.
4. Definieer een shared UI-tokenbestand of document voor statische HTML-projecten voordat nieuwe prototypes worden gebouwd.
5. Leg een shared SEO-checklist vast voor metadata, structured data, canonical URLs en social previews.
6. Leg een shared analytics eventtaxonomie vast voordat trackingcode wordt toegevoegd.
7. Maak een automation readiness checklist voor TikTok, Pinterest, Etsy en andere externe platformen.
8. Gebruik `scripts/check-structure.ps1` als validatiestap na iedere structurele documentatie-update.

## Huidige overlap-analyse

### Onderdelen met overlap
- Projecten bevatten herhaalde documentatiestructuur: `PROJECT_MASTER.md`, `ARCHITECTURE.md`, `API_STATUS.md`, `PROMPTS.md`, `ROADMAP.md` en `DEBUGGING.md`.
- API-statusdocumenten delen dezelfde eisen rond secrets, rate limits, retries, token expiry, caching, fallback en statusmeldingen.
- Promptdocumenten delen governance rond input/outputcontracten, evaluatie, veiligheid en menselijke review.
- Architectuurdocumenten delen dezelfde projectgrenzen, niet-functionele eisen en promotiecriteria naar `shared/`.
- Centrale docs en shared README's beschrijven deels dezelfde toelatingsregels voor herbruikbare modules.
- Er is naamgevings-overlap tussen `shared/api/` en de gewenste standaard `shared/apis/`.

### Componenten die dubbel bestaan
- Generieke API-governance staat zowel centraal als per project beschreven.
- Promptgovernance staat per project grotendeels in hetzelfde format.
- Debugging- en workflowregels zijn waarschijnlijk templatebaar over alle projecten.
- Navigatie-, footer- en inline CSS-patronen uit statische HTML kunnen later shared UI-patronen worden, mits ze binnen deze repo worden toegevoegd of gevalideerd.

### Systemen die centraliseerbaar zijn
- Documenttemplates voor projectmaster, API-status, promptregistratie, roadmap en debugging.
- API readiness checklist met auth, rate limits, retries, CORS, caching, logging en test connection.
- Automation readiness checklist met idempotentie, approval, audit logging, rollback en platform-compliance.
- Shared SEO-checklist en social previewregels.
- Analytics eventnaamgeving, KPI-definities en funnelcontracten.
- UI-tokens en statische layoutpatronen wanneer meerdere projecten dezelfde basis gebruiken.

### Systemen die project-specifiek moeten blijven
- NumberNinjaDesigns merkidentiteit, tactical-tech stijl, Etsy-productstrategie en conversion copy.
- TOKHub/TikTok platformkeuzes, Creator Search Insights, publicatierechten en rate-limitdetails.
- Pinterest-compliancebasis en alle publicatie- of scrapingregels totdat ze formeel zijn beoordeeld.
- Projectroadmaps, assets, broncode, tests, credentials, databronnen en deploymentbesluiten.
- Externe Hub/Artlist/V15-V17 fragmenten buiten deze repo totdat ze gecontroleerd zijn geconsolideerd.
