# Source provenance

Import uitgevoerd op `2026-07-15T01:46:21.9701512+02:00`.

| Rol | Bron | Doel | Bytes | SHA-256 | Gewijzigd | Selectie |
|---|---|---|---:|---|---|---|
| Authoritative HTML | `C:\AI\Active\Finance Producs Factory MVP\Finance_Product_Factory.html` | `incoming\Finance_Product_Factory.html` | 106.716 | `FDF375F084BFB6521DE4DC412426E88B1936D1BBB533C7DDC2E753D9CFD00C48` | Nee | Compleetste bewezen bron; Basic/Pro, configuratie en embedded Pro-template |
| Authoritative archief | dezelfde bron | `legacy\source-baselines\Finance_Product_Factory.authoritative-106716.html` | 106.716 | `FDF375F084BFB6521DE4DC412426E88B1936D1BBB533C7DDC2E753D9CFD00C48` | Nee | Ongewijzigde referentiekopie |
| Legacy HTML | voormalige `incoming\Finance_Product_Factory.html` | `legacy\source-baselines\Finance_Product_Factory.legacy-16079.html` | 16.079 | `967482956468F78988B3362756A816197AD3982BEF30FBFFC599B69AB0701D97` | Nee | Veiliggesteld vóór vervanging |
| Overdracht | `incoming\Finance_Product_Factory_Overdracht_Claude_Code.docx` | `docs\Finance_Product_Factory_Overdracht_Claude_Code.docx` | 37.857 | `F69BFA427D22FA72DE9D6BAFF687024C7AB42A268FA19F846C4924915604E562` | Nee | Enige geldige kandidaat; OOXML leesbaar en persoonlijke documentmetadata verwijderd |
| Projectinstellingen | `incoming\Projectinstellingen en Bronnen.txt` | `docs\Projectinstellingen en Bronnen.txt` | 2.425 | `684265AB6F60B4F4929204077DCC23D755F44BC49913BE27BEDFD533F2C48B9B` | Nee | Door gebruiker aangeleverde projectbron |
| Marktbenchmark | `incoming\listings_export_2026-07-15.csv` | dezelfde bron, read-only evidence | 15.632 | `00EB0355753FAA9622D26F0E9646658B956860B344191F0A895A063F8A977B46` | Niet sinds registratie | Statische 50-record benchmark; niet authoritative voor architectuur, actuele markt of prijsstelling |

De actieve runtime blijft `apps/product-factory/index.html`; `incoming/Finance_Product_Factory.html` is de authoritative bronbaseline. De twee bestanden zijn bewust niet identiek. Zie `release-evidence/baseline-gap-analysis.md`.

`Projectinstellingen en Bronnen.txt` bepaalt de prioriteit officiële documentatie → projectdocumentatie → broncode en verbiedt verzonnen API’s. De repositorygrenzen zelf komen uit `PROJECT_SCOPE.md` en de uitgevoerde reparatieopdracht.

## Marktbenchmark van 2026-07-15

`incoming/listings_export_2026-07-15.csv` bevat 50 unieke digitale-downloadrecords met 31 kolommen uit 39 shops. Vijf records zijn op basis van hun titel geclassificeerd als directe finance-spreadsheetcomparables. Deze afbakening, de afgeleide medianen en de tierhypothese staan in `release-evidence/ultimate-build/market-benchmark.md`.

De bewijsstatus is strikt gescheiden:

- **Feit:** letterlijke CSV-waarden, bestandseigenschappen, recordaantallen en checksum.
- **Marktsignaal:** uit de statische steekproef afgeleide omzet-, sales-, conversie-, prijs- en keywordpatronen.
- **Aanname:** producttiers, prioriteiten, prijsbanden en commerciële interpretaties.

De CSV vermeldt geen officiële bron-URL, exporttool, zoekopdracht, meetvenster of velddefinities en bevat alleen tagaantallen, niet de tagteksten. Zij bewijst daarom geen actuele Etsy-marktpositie, vraag, toekomstige omzet, conversie of geschikte verkoopprijs. Voor publicatie en prijsstelling blijven actuele officiële broncontrole en menselijke markt-, fee-, legal- en licentiereview verplicht.
