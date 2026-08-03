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

## Bindende kleurgovernance

- `config/brand.tokens.json` is de enige machine-leesbare kleurbron voor website, Etsy-assets, Studio OS, Digital Production, Physical Production en interne dashboards.
- `branding/manifest.json`, `branding/banners/etsy-banner.png` en `branding/banners/website-hero.png` zijn de visuele bronreferenties.
- Nieuwe of gewijzigde UI mag geen alternatieve achtergrond-, surface-, accent-, tekst- of muted-kleuren introduceren zonder een expliciete wijziging van `NND-BRAND-COLOR-2026.1`.
- Voor de publieke website geldt een deny-by-default-regel: alleen de zeven exacte hexwaarden uit `config/brand.tokens.json` en `rgb()`/`rgba()`-varianten met exact dezelfde RGB-basis zijn toegestaan.
- Alle publieke HTML-, CSS-, JavaScript- en SVG-bestanden, inclusief productpreviews, consent-UI, support en callbacks, worden automatisch ontdekt en gescand. Een nieuw publiek bestand valt automatisch onder deze gate.
- Benoemde CSS-kleuren, niet-goedgekeurde hexwaarden en alternatieve kleurfuncties zoals `hsl()`, `oklch()` en `color-mix()` blokkeren validatie en deployment.
- Afbeeldingspixels vallen buiten de literal-scan; ieder zichtbaar CSS-, HTML-, JavaScript- of SVG-kleurgebruik valt er nadrukkelijk wel onder.
- Browser-default linkkleuren, bezochte paarse links en ongecontroleerde kleurvarianten zijn verboden.
- Iedere UI-wijziging moet `scripts/validation/validate-brand-colors.ps1` doorstaan.
- Website-deployments mogen uitsluitend via `scripts/deploy-website.ps1`; directe `vercel`-deployments zijn verboden omdat ze de kleur-releasegate kunnen omzeilen.
- De GitHub-check `brand-color-gate` moet slagen voor iedere push en pull request en mag niet met `continue-on-error`, padfilters of een handmatige bypass worden afgezwakt.
- Bij conflict tussen oudere documentatie, CSS of screenshots en `config/brand.tokens.json` heeft `config/brand.tokens.json` voorrang.

## Harde visual-quality gate

- Lever lifestyle- en productbeelden alleen op wanneer ze op 100% visuele inspectie overtuigen als echte premium campagnefotografie.
- Keur beelden direct af bij selectiehalo's, uitgebleekte witte of grijze waas, vlakke grafische overlays, zichtbare knipranden, plastic huid, onjuiste anatomie, stockfotografie-uitstraling of onrealistische objectinteracties.
- Productartwork moet uit het originele bronbestand komen, volledig leesbaar en inhoudelijk exact zijn. Vervormde, vereenvoudigde of opnieuw gegenereerde prints zijn niet toegestaan als eindresultaat.
- Integreer artwork in Photoshop met geloofwaardige schaal, positionering, stoftextuur, vouwen, licht en schaduw; een zichtbaar opgeplakte print is altijd afkeur.
- Na een afgekeurde stijl- of kwaliteitsrichting wordt het beeld vanaf een nieuwe fotografische basis opgebouwd; de afgekeurde compositie wordt niet gerecycled.
- De bindende generatorstandaard is `NND-VISUAL-QUALITY-2026.1`. Zonder volledig vastgelegde menselijke goedkeuring op alle verplichte checks mag een listing nooit `PUBLICATION_READY` worden.
- Een digitale listing moet digitale productbeelden bevatten die de echte interface, bestanden, werkbladen, formules of workflow tonen. Alleen lifestylebeelden of kledingmock-ups zijn altijd onvoldoende.
- Listingvideo's zijn echte interactieve productwalkthroughs met zichtbare bediening en statuswissels. PowerPoint-achtige slideshows, statische montages en generieke stockvideo zijn per direct verboden.
- Etsy-video: MP4/H.264, 3–15 seconden, exact 2:1, minimaal 1920×960 en 30 fps; lever een stille Etsy-master en desgewenst een promotionele master met originele of aantoonbaar royalty-cleared muziek.
- Iedere eindset wordt op 100% geïnspecteerd op premium campagnekwaliteit, productwaarheid, brongetrouwheid, digitale productdekking, artefacten, mobiele leesbaarheid, echte video-interactie en Etsy-exportconformiteit.
- Bij één mislukte verplichte check is de assetset geblokkeerd. Goedkeuring mag niet worden afgeleid uit alleen bestandsformaat, resolutie, aantallen of een hoge geautomatiseerde score.

Houd projectspecifieke modulepaden, routes, buildcommando's, validators, repositorykaarten en rollen lokaal onder `.studio-os`; promoveer ze niet naar de globale Codex-laag.
