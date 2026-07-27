# Digital Product Factory — complete handleiding

## 1. Wat is gebouwd

De Digital Product Factory is één lokale productieomgeving voor het configureren, genereren, valideren en verpakken van digitale producten. Het creator-dashboard gebruikt dezelfde centrale productdefinities en engines als de tests en releasegeneratoren.

De factory ondersteunt in de huidige interface:

- XLSX-workbooks;
- DOCX-documentpakketten;
- gecombineerde XLSX- en DOCX-producten;
- ZIP-verkooppakketten;
- Etsy-listingafbeeldingen waar het product die declareert;
- batchgeneratie over producten, talen, valuta, thema’s en varianten;
- een lokale instructievideopipeline;
- lichte en donkere dashboardweergave;
- lichte en donkere productvarianten waar het productcontract die ondersteunt;
- automatische contract-, structuur-, kwaliteit- en packagevalidatie;
- lokale conceptopslag, back-up, herstel en menselijke goedkeuring.

Er vindt geen automatische externe publicatie plaats.

## 2. Waarom dit de benchmark voorbijgaat

De voorsprong zit niet in één mooi bestand, maar in een herhaalbaar productiesysteem:

1. **Eén bron van waarheid**
   Preview, generatie, validatie, listingmateriaal en packaging gebruiken dezelfde versieerbare productdefinitie.

2. **Meerdere productformaten**
   De interface past zich automatisch aan XLSX, DOCX of gecombineerde producten aan.

3. **Fail-closed kwaliteitsgates**
   Een bestand wordt niet als klaar aangeboden wanneer contracten, OOXML, package-inhoud of kwaliteit blokkeren.

4. **Commerciële productoutput**
   De factory bouwt niet alleen het kernbestand, maar ook een ZIP met klantdocumentatie, licentie, manifests, listingcopy en QA-rapporten.

5. **Schaalbare variantproductie**
   Batchmodus vermenigvuldigt gecontroleerd over taal, valuta, thema, capaciteit en licht/donker.

6. **Lokale veiligheid**
   Bestanden en concepten blijven lokaal. Paden, bestandstypen, ZIP-inhoud en DOCX-relaties worden gecontroleerd.

7. **Herstelbaarheid**
   Concepten worden automatisch bewaard en zijn exporteerbaar, importeerbaar en herstartbaar.

8. **Bewijs in plaats van claims**
   De interface toont validatie-, kwaliteits- en compatibiliteitsstatus voordat een menselijke releasebeslissing kan worden vastgelegd.

## 3. Dashboard openen

Dubbelklik in de repository op:

`Open Finance Product Factory.cmd`

De launcher:

1. controleert Node.js;
2. controleert of poort 4173 beschikbaar is;
3. start de lokale opslag- en productieservice;
4. wacht op een geldige healthcheck;
5. opent het creator-dashboard.

Dashboardadres:

`http://127.0.0.1:4173/apps/product-factory/`

## 4. Hoofdbediening

### Runtime-indicator

- **Groen:** de lokale generator en opslagservice zijn beschikbaar.
- **Oranje:** de runtime is bezig of een verbinding wordt opnieuw opgebouwd.
- **Rood:** generatie of opslag is geblokkeerd.

Start bij een rode status de launcher opnieuw.

### Weergave — Licht

Toont de creator-interface met een witte achtergrond en donkere tekst. Deze keuze:

- wordt lokaal onthouden;
- verandert geen producttaal;
- verandert geen productthema;
- verandert geen gegenereerde bestanden.

### Weergave — Donker

Toont dezelfde creator-interface in de donkere tactical-weergave. De werking blijft identiek aan de lichte variant.

### Handleiding

Opent de ingebouwde versie van deze bedieningshandleiding. De huidige productconfiguratie blijft behouden.

### Batchmodus

Opent de variantplanner. Hiermee worden meerdere combinaties in één begrensde run gegenereerd.

### Beheer

Opent:

- dashboardweergave;
- concept dupliceren;
- conceptback-up exporteren;
- conceptback-up importeren;
- lokale conceptstatus resetten;
- technisch debuglog.

## 5. Productieflow

### Stap 1 — Product

Handelingen:

- **Zoeken:** filtert op productnaam, product-ID en familie.
- **Familie:** beperkt de catalogus tot één productfamilie.
- **Sorteren:** sorteert op aanbeveling, naam of familie.
- **Productkaart:** activeert één productdefinitie.

De kaart toont de echte outputformaten en het aantal documenten of sheets.

### Stap 2 — Markt en doelgroep

- **Markt:** bepaalt de commerciële marktcontext.
- **Doelgroep:** beschrijft voor wie het product wordt aangeboden.

Deze velden mogen listingcopy beïnvloeden, maar nooit spreadsheetformules of documentstructuur.

### Stap 3 — Producttaal en valuta

- **Producttaal:** bepaalt de taal van preview, documenten en commerciële klantoutput.
- **Valuta:** bepaalt geldnotatie in workbooks en commerciële metadata.
- **Platformprofiel:**
  - `Excel` voor gevalideerde XLSX-output;
  - `Google Sheets` voor het importprofiel;
  - `Word · Google Docs-import` voor DOCX-producten.

De creator-interface zelf blijft Nederlands.

### Stap 4 — Productconfiguratie

- **Producttitel:** de productnaam in de generatie.
- **Bestandsnaam:** veilige basisnaam; de factory voegt automatisch `.xlsx` of `.docx` toe.
- **Jaar:** productiejaar voor producten die dit gebruiken.
- **Startmaand:** beginpunt voor workbooks die een afwijkend boekjaar ondersteunen.
- **Invoercapaciteit:** maximaal aantal voorbereide invoerregels.
- **Uitvoermap:**
  - `Beheerde projectmap` bewaart bestanden onder `output/generated-products`;
  - `Browserdownloadmap` gebruikt de normale browserdownload.
- **Voorbeelddata opnemen:** voegt veilige voorbeeldregels toe waar ondersteund.
- **Carry-over:** activeert overdracht naar een volgende periode waar het productcontract dit ondersteunt.

### Stap 5 — Inhoud

Voor XLSX-producten:

- voer één dropdowncategorie per regel in;
- dubbele waarden worden geweigerd;
- maximaal 100 categorieën;
- een lege lijst activeert automatische productstandaarden.

Voor DOCX-producten:

- controleer de lijst met documenttitels;
- controleer de bestandsnamen;
- controleer het aantal secties;
- alleen documenten voor de gekozen producttaal worden gegenereerd.

### Stap 6 — Productthema

- **Thema:** kiest kleuren, fonts en semantische productstijlen.
- **Lichte productvariant:** lichte werkmap of productvariant waar ondersteund.
- **Donkere productvariant:** donkere werkmap of productvariant waar ondersteund.

Dashboardweergave en productvariant zijn twee onafhankelijke instellingen.

### Stap 7 — Preview

- **Preview vernieuwen:** bouwt de preview opnieuw op uit de actuele configuratie.

Bij workbooks toont de preview sheets, kolommen, voorbeeldregels, formules en capaciteit.

Bij documentproducten toont de preview de exacte DOCX-inventaris, bestandsnamen, taal en aantal secties.

### Stap 8 — Validatie

- **Voer validatie uit:** controleert productdefinitie, configuratie, semantiek, lokalisatie, thema en valuta.

Status:

- `PASS`: doorgaan is toegestaan;
- `FAIL` of `BLOCKED`: los de gerapporteerde bevinding op;
- geen status: validatie is nog niet uitgevoerd.

### Stap 9 — Generatie

De groene knop is formatbewust. Voorbeelden:

- `Genereer en herlees XLSX + ZIP`;
- `Genereer 14 DOCX-bestanden + ZIP`;
- `Genereer XLSX + 10 DOCX-bestanden + ZIP`.

De pipeline:

1. valideert contracten en catalogi;
2. genereert XLSX wanneer gedeclareerd;
3. herleest workbookstructuur en OOXML;
4. genereert DOCX wanneer gedeclareerd;
5. herleest document-OOXML, placeholders, relaties en paden;
6. beoordeelt compatibiliteitsbewijs;
7. berekent de kwaliteitsscore;
8. bouwt en valideert het verkooppakket.

### Stap 10 — Kwaliteitsrapport

Het rapport beoordeelt:

- technische integriteit;
- inhoudskwaliteit;
- bruikbaarheid;
- lokalisatie;
- commerciële compleetheid;
- toegankelijkheid;
- exportcompleetheid.

Een lage of geblokkeerde score verhindert de volgende releasefase.

### Stap 11 — Bestanden

#### XLSX downloaden

Slaat de gevalideerde werkmap op. De knop blijft uitgeschakeld wanneer het product geen workbook bevat.

#### DOCX opslaan

Slaat één gevalideerd Word-document op. Iedere rij toont:

- bestandsnaam;
- template-ID;
- bestandsgrootte;
- validatiestatus.

#### Verkooppakket als ZIP

Slaat het complete verkooppakket op. Het ZIP-pakket kan bevatten:

- XLSX;
- DOCX;
- quick-start- en klantdocumentatie;
- licentie;
- listingtekst;
- manifesten;
- validatie-, kwaliteit- en compatibiliteitsrapporten;
- listingafbeeldingen waar gedeclareerd.

#### Etsy-afbeeldingen als ZIP

Bundelt alleen exact gevalideerde listingbeelden uit dezelfde productvariant.

#### Instructievideo maken

Start de lokale tutorialjob.

- De voice-overtaal volgt de producttaal.
- Beveiligde voice-instellingen worden buiten browseropslag bewaard.
- De video wordt alleen als gereed gemeld wanneer de volledige job slaagt.

### Stap 12 — Goedkeuring

- **Goedkeuren:** legt vast dat de variant handmatig is beoordeeld.
- **Afkeuren:** houdt de variant lokaal en vereist een herstelreden.
- **Besluit vastleggen:** bewaart status, datum en motivatie.

Goedkeuring publiceert niets naar Etsy, Shopify of een ander extern platform.

## 6. Batchmodus

Selecteer:

- één of meer producten;
- talen;
- valuta;
- thema’s;
- lichte en/of donkere productvarianten;
- invoercapaciteiten;
- workbook en/of package;
- wel of geen voorbeelddata.

De samenvatting toont het aantal varianten en een outputschatting.

- **Start batch:** start een nieuwe begrensde run.
- **Annuleer batch:** stopt na de huidige veilige grens.
- **Hervat batch:** gaat verder met de niet-voltooide varianten.
- **Download batcharchief:** bundelt uitsluitend geslaagde resultaten.

## 7. Beheer en herstel

### Concept dupliceren

Maakt een kopie met een veilige `-copy`-bestandsnaam en behoudt het correcte XLSX- of DOCX-formaat.

### Back-up exporteren

Downloadt een JSON-back-up van configuratie, stap, doelgroep en besluitstatus.

### Back-up importeren

Controleert grootte, JSON-structuur, productversie en contractgeldigheid voordat de back-up actief wordt.

### Lokale status resetten

Verwijdert alleen het actieve browserconcept na bevestiging. Reeds gegenereerde bestanden in de projectmap blijven bestaan.

### Debuglog

Toont begrensde technische gebeurtenissen zonder API-keys, tokens of persoonlijke productdata.

## 8. Licht en donker correct gebruiken

Er zijn twee verschillende keuzes:

| Keuze | Effect | Opslag |
| --- | --- | --- |
| Dashboardweergave | Alleen de creator-interface | Lokale UI-voorkeur |
| Productvariant | Gegenereerde productstijl waar ondersteund | Onderdeel van de productconfiguratie |

Voor beide productvarianten:

1. kies eerst `Lichte productvariant`;
2. genereer en sla de bestanden op;
3. kies daarna `Donkere productvariant`;
4. valideer opnieuw;
5. genereer de tweede set;
6. vergelijk preview, bestandspaden en package-manifest.

## 9. Foutafhandeling

### Runtime rood

1. sluit het browsertabblad;
2. start `Open Finance Product Factory.cmd` opnieuw;
3. wacht op de groene runtime-indicator.

### Validatie mislukt

1. open stap 8;
2. lees de eerste blokkerende regel;
3. ga terug naar de genoemde configuratiestap;
4. herstel het veld;
5. voer validatie opnieuw uit.

### Opslagservice niet bereikbaar

De factory biedt waar veilig mogelijk automatisch een normale browserdownload aan.

### Opgeslagen concept beschadigd

De factory weigert de beschadigde status en start met een geldige standaardconfiguratie. Importeer daarna een eerder geëxporteerde back-up.

## 10. Veilige operationele grens

- Gebruik geen echte persoonsgegevens als voorbeelddata in commerciële templates.
- Controleer placeholderteksten vóór verkoop of verzending.
- Behandel `Google Sheets` en `Google Docs` als importprofielen tenzij echte importvalidatie apart is uitgevoerd.
- Een technische `PASS` vervangt geen menselijke inhouds-, juridische of marketplace-review.
- Externe publicatie blijft altijd een afzonderlijke, expliciete handeling.
