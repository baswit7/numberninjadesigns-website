# Quality Scoring

## Doel en contract

[`src/engines/quality-engine.js`](src/engines/quality-engine.js) zet contract-, workbook-, compatibility- en aangeleverde kwaliteitsmetingen om in één strict `QualityReport` v1.

Het report vereist `productId`, `productVersion`, `status`, `score`, `threshold`, minimaal één component, `recommendations` en `generatedAt`. Componentgewichten moeten contractueel exact optellen tot `1`. `PASS` is alleen geldig wanneer `score >= threshold`; onbekende top-level velden worden afgewezen.

Publieke exports:

- `scoreProduct(input)`;
- `QUALITY_DIMENSIONS`, een bevroren weightmap.

## Scoremodel

Iedere inputscore wordt begrensd op `0..100`. De eindscore is de op twee decimalen afgeronde gewogen som.

| Component-id | Gewicht | Huidige berekening |
| --- | ---: | --- |
| `technical-integrity` | 25% | `100` bij workbook `PASS`, anders `0`. |
| `formula-quality` | 15% | `100` bij minimaal één formule en geen issuecode met `FORMULA`, anders `0`. |
| `usability` | 10% | `100` wanneer validations, filters en panes allemaal aanwezig zijn, anders `60`. |
| `visual-quality` | 10% | Percentage true-values in `visualChecks`. |
| `localization` | 10% | Aangeleverde `localeCoverage`. |
| `commercial-completeness` | 10% | Aangeleverde aanwezigheidsscore voor commerciële metadata. |
| `instructions` | 5% | `100` wanneer instructies compleet zijn, anders `0`. |
| `compatibility` | 5% | `PASS=100`, `PARTIAL=60`, anders `0`. |
| `accessibility` | 5% | Aangeleverde `accessibilityScore`. |
| `export-completeness` | 5% | Aangeleverde `exportCompleteness`. |

Bewijsregels in `components[].evidence` beschrijven de bronstatus of metriek. Workbookmetrics worden uitsluitend gelezen uit `workbookReport.extensions.metrics`; warnings uit `workbookReport.extensions.warnings` worden in reportextensions bewaard.

## Status- en releasegates

`hardFailure` is true wanneer definition-, configuration- of workbookrapport `FAIL` is, of compatibility `FAIL` is.

De statusvolgorde is exact:

1. hard failure of score `< 80` → `FAIL`;
2. anders score `>= threshold` → `PASS`;
3. anders → `REVIEW`.

De standaardthreshold is `90`. Een caller kan een andere threshold meegeven, binnen het contractbereik `0..100`.

Package/release vertaalt de uitkomst als volgt:

- `QualityReport.FAIL` → GeneratedProductManifest `BLOCKED`;
- `REVIEW` → geen release-ready gate, dus `DRAFT`;
- `PASS` is noodzakelijk maar niet voldoende: validation en compatibility moeten ook `PASS` zijn voor `READY_FOR_REVIEW`.

`APPROVED` en `RELEASED` worden nooit door de scoring-engine toegekend.

## Runtime-dataflow

`FinanceProductFactoryRuntime.generate()` levert momenteel:

- definition- en configuration-contractreports uit preflight;
- het herlezen workbookrapport;
- locale coverage uit `LocalizationBundle.extensions.coverage`;
- een aanwezigheidsscore over acht `CommercialMetadata`-velden;
- instructie-aanwezigheid via een `instructions`-sheet of feature;
- het compatibilityrapport;
- `generatedAt`.

De defaultscore gebruikt vier visuele booleans: contrast, herkenbaarheid van invoercellen, herkenbaarheid van formulecellen en printprofiel.

## Security- en integriteitsgrens

- Scores worden begrensd en niet-finite waarden kunnen niet door een strict reportcontract.
- Hard failures kunnen niet door een hoge gewogen score worden gemaskeerd.
- Contractsemantiek valideert gewichtsom, threshold en PASS-status opnieuw.
- Evidence is tekstuele herkomstinformatie, geen uitvoerbare content.
- Quality scoring wijzigt workbook, configuratie of externe systemen niet.

De engine vertrouwt wel op de juistheid van aangeleverde percentages en booleans. Zij voert daarvoor geen onafhankelijke accessibility-, screenshot- of exportaudit uit.

## Extensiepunten

- Een caller kan `threshold`, coverage/completeness-scores en `visualChecks` expliciet meegeven.
- Nieuwe vaste dimensies vereisen een codewijziging in `QUALITY_DIMENSIONS`, een berekening in `componentScores` en tests die de som `1` behouden.
- Nieuwe aanbevelingen kunnen uit meetbare componenttekorten worden afgeleid.
- Aanvullende niet-contractuele evidence hoort in `extensions`; de strict top-level vorm blijft ongewijzigd.

## Aantoonbare beperkingen

- `ProductDefinition.qualityRules` is verplicht contractmetadata, maar stuurt `scoreProduct` momenteel niet aan. De scoringgewichten en logica zijn hard-coded.
- De runtime vult `accessibilityScore` en `exportCompleteness` momenteel expliciet met `100` en gebruikt standaard alle visuele checks als true. Dit zijn defaults, geen gemeten auditresultaten.
- Commercial completeness controleert aanwezigheid, niet copykwaliteit, marketplacecompliance of conversiekracht.
- Formula quality controleert formuleaanwezigheid en issuecodes, niet de numerieke uitkomst.
- Usability is een grove structurele proxy en geeft bij ontbrekende signalen nog `60`.
- Er is geen productcatalogusbrede of native-applicatie-E2E die alle scoreclaims valideert.

## Verificatie

```powershell
node --test tests/engine-support.test.mjs tests/workbook-engine.test.mjs tests/contracts-registry.test.mjs
```

Actuele uitkomst op 15 juli 2026: `23/23 PASS`. De tests bewijzen strict reportoutput, hard contractinvarianten en een positieve workbookscore. Zij bewijzen geen onafhankelijke visual-, accessibility- of marketplaceaudit.
