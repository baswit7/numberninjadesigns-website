# Contract inventory

| Contract | Bestaande bron | Producer | Consumer | Overlap / conflict | Voorgestelde canonieke bron |
|---|---|---|---|---|---|
| MarketOpportunity | `modules/listing-intelligence-engine/schemas/market-opportunity.v1.schema.json` | Etsy Intelligence produceert intern opportunity-objecten | Listing Intelligence accepteert marktinput | Etsy gebruikt camelCase en een rijker intern model; schema gebruikt snake_case en minimale boundaryvelden | Bestaand versioned Listing Intelligence-schema, later gevoed via een adapter |
| ProductBlueprint | `modules/etsy-intelligence-engine/engine/decide.js` (`createBlueprint`) | Etsy Intelligence | Etsy-dashboard en toekomstige productadapter | Geen versioned schema; veldnamen zijn camelCase | Bestaande `createBlueprint`-output totdat een versioned boundaryschema wordt vastgesteld |
| ProductManifest | `modules/listing-intelligence-engine/schemas/product-manifest.v1.schema.json` | Momenteel alleen fixtures / externe Product Factory-output | Listing Intelligence | Product Factory HTML produceert nog geen manifest; runtimevalidatie dupliceert een subset van het schema | Bestaand versioned Listing Intelligence-schema |
| GeneratedProduct | Geen bestaand schema; Product Factory levert een XLSX Blob | Product Factory | Toekomstige validator en Listing Intelligence-adapter | Geen metadata-contract voor bestand, hash of workbookvalidatie | Nog niet vaststellen; eerst adapter-eisen uit de echte XLSX-output afleiden |
| ListingPackage | `modules/listing-intelligence-engine/schemas/listing-package.v1.schema.json` | `generateListingPackage` | Dashboard, CLI en `exportPackage` | Runtime-object bevat meer velden dan het permissieve schema | Bestaand versioned Listing Intelligence-schema |
| ProductRecord | Geen bestaand model | Geen | Toekomstige Product Registry | Ontbreekt volledig | Nog niet vaststellen; eerst lifecycle- en versievereisten bepalen |
