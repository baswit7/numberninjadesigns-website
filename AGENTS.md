# NumberNinjaDesigns repository instructions

Deze lokale instructies verfijnen de globale Codex-policy uitsluitend voor deze repository. De gevalideerde orchestrationcontracten onder `.studio-os` zijn leidend voor agentrouting, scopes en validators.

## Brand en Etsy-context

- Brand: NumberNinjaDesigns.
- Organisatie: `NumberNinjaDesigns` is de enige hoofdidentiteit. `Digital Production` en `Physical Production` zijn de producttakken; `Studio OS` is de gedeelde governance- en automatiseringslaag.
- Positionering: dark tactical premium voor een Data/Excel/programming-doelgroep.
- Tone of voice: witty en direct; geen corporate uitstraling.
- Designstandaard: `NND-BRAND-COLOR-2026.1`.
- Bindende kleuren: achtergrond `#07090C`, surface `#11151B`, elevated surface `#151B23`, accent `#00E891`, secundair accent `#6EE7FF`, tekst `#F3F5F7`, muted `#8B96A5`.
- Fonts: Orbitron, JetBrains Mono en Bebas Neue.
- Resultaten zijn premium, tactical-tech, responsive, conversion-focused en SEO-geoptimaliseerd.

Houd projectspecifieke modulepaden, routes, buildcommando's, validators, repositorykaarten en rollen lokaal onder `.studio-os`; promoveer ze niet naar de globale Codex-laag.

## Bindende kleurgovernance

- `config/brand.tokens.json` is de enige machine-leesbare kleurbron; `brand.css` is de verplichte publieke CSS-binding.
- Voor de publieke website geldt deny-by-default: uitsluitend de zeven exacte hexwaarden en `rgb()`/`rgba()`-varianten met dezelfde RGB-basis zijn toegestaan.
- De validator ontdekt alle publieke HTML-, CSS-, JavaScript- en SVG-bestanden recursief. Alleen expliciet interne mappen uit `config/brand.tokens.json` mogen worden uitgesloten.
- Benoemde CSS-kleuren, alternatieve hexwaarden en kleurfuncties zoals `hsl()`, `oklch()` en `color-mix()` blokkeren release en deployment.
- Afbeeldingspixels vallen buiten de literal-scan; ieder zichtbaar HTML-, CSS-, JavaScript- of SVG-kleurgebruik valt er wel onder.
- Iedere UI-wijziging moet `scripts/validation/validate-brand-colors.ps1` en `tests/brand-color-policy.test.mjs` doorstaan.
- Website-deployments mogen uitsluitend via `scripts/deploy-website.ps1`; directe `vercel`-deployments zijn verboden.
- De GitHub-check `brand-color-gate` moet slagen en mag niet via `continue-on-error`, padfilters of een handmatige bypass worden afgezwakt.
- Bij conflict met oudere documentatie, CSS, screenshots of assets heeft `config/brand.tokens.json` voorrang.
