# Baseline selection report

## Besluit

`C:\AI\Active\Finance Producs Factory MVP\Finance_Product_Factory.html` is geselecteerd als authoritative Finance Product Factory-bron. Grootte en SHA-256 matchen de vooraf vastgelegde waarden exact.

De vorige `incoming`-HTML is vóór vervanging byte-identiek gearchiveerd. De geselecteerde bron staat zowel in `incoming/` als in `legacy/source-baselines/`.

## Runtimebesluit

De actieve applicatieroute is objectief:

1. `npm start` start `scripts/serve.mjs` vanuit de repositoryroot;
2. `/` serveert `index.html`;
3. de Product Factory-kaart linkt naar `apps/product-factory/index.html`.

`incoming/Finance_Product_Factory.html` is dus een bronartefact en geen runtime-entrypoint.

De runtime is niet monolithisch vervangen. De bestaande runtime bewaakt het overeengekomen vier-sheetcontract en bevat gerichte `SUMIFS`- en workbookstructuurvalidatie. De authoritative Basic-generator gebruikt een ander zes-sheetmodel; blind vervangen zou een regressie en ongewenste functionele uitbreiding zijn.

## Alternatieve kandidaat

De 16.079-byte HTML was een valide maar beperkte kandidaat met één product, vier sheets en minimale foutafhandeling. Hij is niet meer authoritative, maar blijft volledig reproduceerbaar via het legacy-archief.
