# Shared apis

## Doel
API-contracten, configuratiepatronen en securityregels die meerdere projecten veilig kunnen hergebruiken.

## Status
Map ingericht als nieuwe standaard voor API-documentatie. Er zijn nog geen gevalideerde gedeelde API-modules toegevoegd.

## Toelatingsregels
- Documenteer auth, token expiry, rate limits, retries, caching, CORS, logging en fallbackgedrag.
- Gebruik alleen voorbeeldconfiguratie zonder echte secrets of productiegegevens.
- Voeg pas herbruikbare clients toe wanneer minimaal twee projecten hetzelfde contract nodig hebben.

## Open Taken
- Migreer toekomstige verwijzingen van `shared/api/` naar `shared/apis/`.
- Maak een API readiness checklist voordat externe integraties worden gebouwd.
