# API Registry Manager

Lokale editor voor `studio/shared/contracts/api-governance/api-registry.json`.

- VS Code en de manager gebruiken exact hetzelfde bronbestand.
- Chromium-browsers gebruiken de File System Access API voor expliciet toegestane read/write-toegang.
- Externe wijzigingen worden iedere twee seconden gecontroleerd.
- Opslaan wordt geblokkeerd wanneer het bestand na de laatste load extern is gewijzigd.
- Secretvelden, tokens en credentialwaarden zijn niet toegestaan.
- De bestaande Studio Dashboard-projectie blijft read-only.

Open `index.html`, kies **Bronbestand koppelen** en selecteer het centrale `api-registry.json`-bestand. In browsers zonder File System Access API is import plus backup-export beschikbaar; direct terugschrijven is daar uitgeschakeld.
