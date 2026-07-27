# NumberNinjaDesigns Etsy Light Color Standard

Status: binding
Standard: `NND-ETSY-LIGHT-2026.1`
Reference: live Etsy banner palette established by repository commit `b89b341`

## Canonical palette

| Role | Value |
| --- | --- |
| Background | `#F9FBFC` |
| Surface | `#FFFFFF` |
| Soft surface | `#E9F5F3` |
| Strong surface | `#D7EFEB` |
| Accent | `#13B8A7` |
| Accessible accent | `#08766D` |
| Secondary accent | `#2463E9` |
| Text | `#0C1426` |
| Muted text | `#545A63` |
| Danger | `#B42318` |
| Warning | `#B45309` |

## Non-negotiable rules

- The website is light-only. Dark themes and alternate palettes are forbidden.
- The text token `#0C1426` and its aliases may never be used as an opaque page, card or media background.
- `config/brand.tokens.json` is the machine contract and `brand.css` is the public binding.
- Every public UI literal must use the canonical palette or an alpha based on one of its RGB values.
- Named colors, unapproved hex/RGB values and HSL/HWB/LAB/LCH/OKLCH/color functions are forbidden.
- All HTML routes use `theme-color #F9FBFC`, `color-scheme light` and the current stylesheet cache version.
- Consent, favicon, SVG assets, support, commerce and SEO share this exact contract.
- Raster image pixels are the only color content excluded from literal scanning.
- The automated validator, independent Node policy test and storefront regression test must all pass before release.

## Change control

Changing this palette requires explicit current user approval and an atomic update of every file listed in `config/brand.tokens.json.changeControl.requiredFiles`. A validator or workflow change that weakens these rules is a release blocker.
