# Codex Instructies - NumberNinjaDesigns

## Doel
Codex voert wijzigingen voor **NumberNinjaDesigns** uit binnen deze projectgrens en houdt de technische documentatie synchroon met de implementatie.

## Projectfocus
- Domein: E-commerce, merkcontent, SEO en conversion analytics.
- Huidige prioriteit: Merkregels, listing-pipeline, contentplanning en conversiemeting concretiseren.
- Kritieke randvoorwaarde: Behoud dark tactical premium ontwerp: #070707 achtergrond, #0F0F0F surface, #00FF94 accent, #EDEBE3 tekst, #777777 muted; gebruik Orbitron, JetBrains Mono en Bebas Neue; toon witty/direct en conversion-focused; publiceer niets automatisch zonder goedkeuring.

## Bouwregels
- Lees voor implementatie **docs/PROJECT_MASTER.md**, **docs/ARCHITECTURE.md**, **docs/API_STATUS.md** en **docs/ROADMAP.md**.
- Plaats productcode in **src/**, testbare controles in **tests/** en alleen benodigde media/configuratiesjablonen in **assets/**.
- Voeg geen dependency, API-koppeling, persoonsgegevensstroom of deployment toe zonder bijbehorende documentatie en validatie.
- Houd UI mobile-first, responsive, toegankelijk en voorzien van begrijpelijke status- en foutmeldingen waar UI wordt gebouwd.
- Ontwerp API-werk met cachingbesluit, begrensde retries, rate limits, token expiry, foutstatus en recovery.

## Definition Of Done
- Gedrag, tests/controle, performance- en security-impact zijn aantoonbaar beoordeeld.
- **CHANGELOG.md**, API-status, roadmap of debuggingnotities zijn bijgewerkt wanneer de wijziging dat vereist.
- De oplossing is reviewbaar op een taakgerichte branch en bevat geen secrets of dubbele backups.
