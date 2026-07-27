# NumberNinjaDesigns repository instructions

Deze lokale instructies verfijnen de globale Codex-policy uitsluitend voor deze repository. De gevalideerde orchestrationcontracten onder `.studio-os` zijn leidend voor agentrouting, scopes en validators.

## Brand en Etsy-context

- Brand: NumberNinjaDesigns.
- Organisatie: `NumberNinjaDesigns` is de enige hoofdidentiteit. `Digital Production` en `Physical Production` zijn de producttakken; `Studio OS` is de gedeelde governance- en automatiseringslaag.
- Positionering: dark tactical premium voor een Data/Excel/programming-doelgroep.
- Tone of voice: witty en direct; geen corporate uitstraling.
- Bindende kleurbron: `config/brand.tokens.json`, standaard `NND-BRAND-COLOR-2026.1`.
- Design: achtergrond `#07090C`, surface `#11151B`, elevated surface `#151B23`, accent `#00E891`, secundair accent `#6EE7FF`, tekst `#F3F5F7`, muted `#8B96A5`.
- Fonts: Orbitron, JetBrains Mono en Bebas Neue.
- Resultaten zijn premium, tactical-tech, responsive, conversion-focused en SEO-geoptimaliseerd.

## Unified repository

- De website blijft aan de repository-root voor hostingcompatibiliteit.
- `products/digital/` en `products/physical/` zijn de enige productdivisies.
- `studio/` bevat Studio OS, API-governance, dashboards, ideeën en plannen; Studio OS is geen afzonderlijk merk.
- De root `.env` is de enige lokale secretbron. Het bestand blijft Git-ignored en mag nooit in browsercode, logging, runtime-output of artifacts terechtkomen.
- Retired identifiers zijn alleen toegestaan in `docs/migration/`, redirectcompatibiliteit, `artifacts/legacy/` en tests die de oude identiteit blokkeren.

Houd projectspecifieke modulepaden, routes, buildcommando's, validators, repositorykaarten en rollen lokaal onder `.studio-os`; promoveer ze niet naar de globale Codex-laag.
