# NumberNinjaDesigns repository instructions

Deze lokale instructies verfijnen de globale Codex-policy uitsluitend voor deze repository. De gevalideerde orchestrationcontracten onder `.studio-os` zijn leidend voor agentrouting, scopes en validators.

## Bindende lichte Etsy-bannerstandaard

- Brand: NumberNinjaDesigns.
- Organisatie: `NumberNinjaDesigns` is de enige hoofdidentiteit. `Digital Production` en `Physical Production` zijn de producttakken; `Studio OS` is de gedeelde governance- en automatiseringslaag.
- Bindende kleurstandaard: `NND-ETSY-LIGHT-2026.1`.
- Positionering: lichte, premium Etsy-bannerstijl voor een Data/Excel/programming-doelgroep.
- Tone of voice: witty en direct; geen corporate uitstraling.
- Design: achtergrond `#F9FBFC`, surface `#FFFFFF`, zachte surfaces `#E9F5F3` en `#D7EFEB`, accent `#13B8A7`, toegankelijk accent `#08766D`, secundair `#2463E9`, tekst `#0C1426`, muted `#545A63`, danger `#B42318` en warning `#B45309`.
- Fonts: Orbitron, JetBrains Mono en Bebas Neue.
- Resultaten zijn premium, licht, responsive, conversion-focused en SEO-geoptimaliseerd.

### Kleurgovernance zonder uitzonderingsroute

- `config/brand.tokens.json` is het machineleesbare kleurcontract; `brand.css` is de enige publieke tokenbinding.
- De lichte Etsy-bannerpalette is deny-by-default. Een donkere theme, alternatieve palette, benaderende kleur, benoemde CSS-kleur, niet-goedgekeurde hex/RGB-basis of moderne kleurfunctie is verboden.
- De tekstkleur `#0C1426`, `rgb(12,20,38)`, `--brand-text` en `--brand-on-accent` mogen nooit als ondoorzichtige achtergrond of media-surface worden gebruikt; donkere pagina-, kaart- en mediawells zijn verboden.
- Alle publieke `.html`, `.css`, `.js`, `.mjs` en `.svg` bestanden worden recursief gevalideerd. Alleen pixels in rasterafbeeldingen vallen buiten de literalscanner; SVG valt er expliciet binnen.
- Iedere publieke HTML-route moet exact `theme-color #F9FBFC`, `color-scheme light` en de actuele stylesheetversie uit het contract gebruiken.
- Consent UI, favicon, social assets, wordmark, support, commerce, SEO en alle routevarianten vallen onder hetzelfde contract. Er bestaat geen zelfstandige subpalette.
- Een palettewijziging vereist expliciete actuele toestemming van de gebruiker én gelijktijdige beoordeling en waar nodig wijziging van ieder bestand in `config/brand.tokens.json.changeControl.requiredFiles`; de gate controleert dat deze set volledig blijft.
- `scripts/validation/validate-brand-colors.ps1`, `tests/brand-color-policy.test.mjs` en `tests/brand-palette.test.mjs` zijn verplichte releasechecks. Een mislukking blokkeert commit, merge en deployment.
- `.github/workflows/brand-color-gate.yml` en `.github/CODEOWNERS` mogen niet worden verwijderd, afgezwakt of omzeild voor een kleur- of frontendwijziging.
- Een productie-uitrol mag uitsluitend exact de schone, gevalideerde Git-revisie promoveren. Lokale `vercel`/`npx vercel`-deployment en deployment vanuit een dirty worktree zijn verboden.

Houd projectspecifieke modulepaden, routes, buildcommando's, validators, repositorykaarten en rollen lokaal onder `.studio-os`; promoveer ze niet naar de globale Codex-laag.
