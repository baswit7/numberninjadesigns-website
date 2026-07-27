# Baseline gap analysis

## Vergelijking

| Onderdeel | Legacy 16.079 B | Authoritative 106.716 B | Actieve runtime | Classificatie/besluit |
|---|---|---|---|---|
| Productkeuze | Alleen Basic | Basic en Pro | Alleen Basic | Authoritative rijker; Pro niet in runtime geïmporteerd wegens `NO_FEATURE_EXPANSION` |
| Productstappen | Eén catalogusactie | Productselectie, configuratie, specificatie, downloads | Eén catalogusactie binnen geïntegreerde shell | Ontbreekt deels; volgende productiefase |
| Instellingen | Vast | Naam, valuta, jaar, startmaand, thema | Vast | Ontbreekt in runtime; geen reparatie vereist voor bewezen vier-sheetbaseline |
| Categorieën | Statische income/expense-lijsten | Basic-categorieën en Pro-template | Statische income/expense-lijsten | Aanwezig, anders geïmplementeerd |
| Workbookconfiguratie | 30 + 30 invoerregels | 250 transactieregels in Basic; Pro-template | 30 + 30 invoerregels | Verschillend contract; niet samengevoegd |
| Thema’s | Geen selector | Executive/Classic/Dark-selectie | Geen selector | Ontbreekt; productiefase |
| Preview | Resultaatstub | Sheetspecificatie/downloadhistorie | Resultaatstub | Anders geïmplementeerd; geen echte workbookpreview |
| XLSX-generatie | SheetJS via CDN | SheetJS + JSZip via CDN; embedded Pro-OOXML | SheetJS via CDN | Aanwezig; netwerkafhankelijk |
| Formules | `SUM`, `SUMIF` | `SUMIFS` in Basic en embedded Pro-formules | `SUM`, `SUMIF`, `SUMIFS` | Runtime heeft het vereiste formulecontract |
| Validatie | Geen structurele preflight | Configvalidatie en `try/catch` | Sheet- en formulevalidatie vóór export | Runtime sterker op structurele Basic-validatie |
| Import/export | XLSX-download | XLSX-download | XLSX-download | Geen workbookimport in alle varianten |
| localStorage | Geen | Schrijft laatste configuratie | Geen | Authoritative schrijft maar herstelt configuratie niet |
| Foutafhandeling | Minimaal | Status, foutpaneel en `try/catch` | Knopstatus zonder volledige `try/catch` | Authoritative sterker; geen minimale reparatienoodzaak bewezen |
| Mobiel | Responsive catalogus | Uitgebreide responsive layout | Responsive catalogus | Bestaande overflow na generatie gericht hersteld zonder functionele wijziging |
| Embedded ExcelJS | Nee | Nee | Nee | Niet aanwezig; geen offlineclaim toegestaan |
| Offline | Nee, SheetJS en fonts extern | Nee, SheetJS/JSZip extern | Nee, SheetJS en fonts extern | Feitelijk restrisico |

## Minimale wijzigingen

- Authoritative HTML checksum-identiek geïmporteerd en gearchiveerd.
- Legacy HTML checksum-identiek veiliggesteld.
- Projectinstellingen en overdrachtsdocument checksum-identiek naar `docs/` gekopieerd.
- Workbooklogica en intelligence-modules inhoudelijk niet gewijzigd; uitsluitend de mobiele runtime-CSS is gericht gecorrigeerd voor lange downloadnamen en gridplaatsing.

## Bewust niet uitgevoerd

Geen Pro-product, configuratiepaneel, thema-engine, localStorage-herstel, offline dependencybundeling of nieuwe workbookarchitectuur toegevoegd. Dit zijn productie-uitbreidingen, geen repositoryreparaties.
