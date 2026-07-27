# NumberNinjaDesigns masterarchitectuur

NumberNinjaDesigns is het enige hoofdmerk, de enige projectroot en de enige lokale credentialgrens.

```text
NumberNinjaDesigns/
├── website + storefront
├── products/
│   ├── physical/
│   └── digital/
├── studio/
│   ├── apps/
│   ├── services/
│   ├── projects/NumberNinjaDesigns/
│   │   └── initiatives/
│   ├── fixtures/runtime-baseline/ # veilige startsituatie voor een schone checkout
│   └── runtime/                   # lokaal gegenereerd en genegeerd
├── modules/                     # intelligence en workforce
├── services/                    # vertrouwde backendconnectors
├── config/                      # identiteit en portfoliocontracten
├── artifacts/                   # genegeerd bronbewijs en archief
├── .env                         # lokaal, genegeerd, nooit browser-side
└── .env.example                 # alleen variabelenamen
```

## Architectuurregels

- Websitebestanden blijven in de root voor de bestaande hosting- en redirectcontracten.
- Fysieke en digitale producten delen merk, winkel, governance en Studio OS, maar houden gescheiden productpipelines.
- Studio OS is een interne capability van NumberNinjaDesigns, geen tweede merk.
- Alle overige ideeën staan als initiatieven onder `studio/projects/NumberNinjaDesigns/initiatives/`.
- Providercredentials staan uitsluitend in de root-`.env`; `.env.example` bevat geen waarden.
- Browsercode krijgt nooit providercredentials.
- Read-only connectors mogen alleen na een expliciete run providers benaderen.
- Publiceren, deployen, accountwijzigingen en verwijdering blijven approval-gated.
- NumberNinjaTees en NinjaNumberTees mogen alleen voorkomen in migratiebewijs, redirects, validators en legacy-archieven.

## Gezaghebbende bronnen

- Identiteit: `config/project.identity.json`
- Portfolio: `config/portfolio.registry.json`
- Bronnenaudit: `docs/consolidation/SOURCE_AUDIT_2026-07-27.md`
- Uitgebreide architectuur: `docs/consolidation/UNIFIED_ARCHITECTURE.md`
- Uitfasering: `docs/consolidation/LEGACY_RETIREMENT_PLAN.md`
- Productstrategie: `IDEAS.md` en `ROADMAP.md`
