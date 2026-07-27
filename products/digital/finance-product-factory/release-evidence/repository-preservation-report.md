# Repository preservation report

## Repository

- Root: `C:\AI\Active\Finance Product Factory`
- Branch: `main`
- HEAD vóór en na: `b811facfca317676dc08e84cf3d11aa3b370649e`
- Commitbericht: `chore(factory): establish isolated integration baseline`
- `git merge-base --is-ancestor b811fac HEAD`: exit `0`
- Remotes: `0`
- Parent Git-root onder `C:\AI\Active`: geen
- Root symlink/junction: nee
- Commit, push, pull request en deployment: niet uitgevoerd

## Bestaande gebruikerswijziging

De preflight bevatte uitsluitend het door de gebruiker aangeleverde untracked bestand `incoming/Projectinstellingen en Bronnen.txt`. Dit bestand is als projectbron behouden en checksum-identiek naar `docs/` gekopieerd.

## Intelligence-modules

| Module | Tracked bestanden | Bytes | Canonieke manifest-SHA-256 | Git-objectafwijkingen | Teststatus |
|---|---:|---:|---|---:|---|
| Etsy Intelligence Engine | 17 | 1.517.361 | `c5609af6d2232e3cbb0824a74c19ccb75f6a09d8aa01325d3adf7fae81aa39d2` | 0 | PASS |
| Listing Intelligence Engine | 28 | 52.528 | `c63b9044b05c26814af31a602b29d775a4d8e8dc672f9f8369e42213b8b988b2` | 0 | PASS |

`git diff --name-only HEAD -- modules` retourneerde nul bestanden. Schema’s, bronlogica, tests, fixtures en module-entrypoints zijn niet gewijzigd of verwijderd.

## Externe scopebewijzen

| Gebied | Voor | Na | Resultaat |
|---|---|---|---|
| `numberninjatees.github.io` Git-status | 251 regels / `945630b41b388c9cf043472fbdbe728ed111dc16e977bc3717e4e73eddc1edba` | identiek | Geen wijziging |
| Professionele AI Development Studio Git-status | 23 regels / `7fca87488c122f7c0d6c6355e916c9b062eb2a4cfeec3da10a535a096c09714a` | identiek | Geen wijziging |
| Authoritative HTML-bron | `FDF375F084BFB6521DE4DC412426E88B1936D1BBB533C7DDC2E753D9CFD00C48` | identiek | Read-only behouden |

## Runtime-impact

De root-shell en workbooklogica zijn behouden. In `apps/product-factory/index.html` is uitsluitend mobiele CSS aangepast nadat de browsertest horizontale overflow aantoonde bij een lange gegenereerde downloadnaam. Na herstel:

- desktop 1440×900: geen overflow, geen consolefouten;
- mobiel 390×844: geen overflow, knop bereikbaar, resultaat zichtbaar, geen consolefouten;
- echte XLSX-download: geslaagd.

## Tests en validatie

- `npm run validate`: PASS — 10 checks, 7 expliciete waarschuwingen.
- `npm run check`: PASS — 6/6 tests.
- `npm test`: PASS — 39/39 tests.
- HTML-inline scripts: syntactisch geldig.
- Browser-smoke: PASS.
- XLSX ZIP/XML-integriteit: PASS, 13 ZIP-entries, 11 XML-bestanden, 0 parsefouten.
- Workbookformules: 27 totaal; `SUM` 2, `SUMIF` 10, `SUMIFS` 1.

## Bewuste beperkingen

De huidige Basic-runtime genereert 60 lege invoerregels met USD-formattering en exporteert geen data validation, autofilters of frozen panes. De renderer schrijft vier bruikbare previews, maar de gebundelde Windows-renderprocess beëindigt na voltooiing met native exit `-1073740791`; import en inspectie zonder render eindigen wel met exit `0`.

Deze punten zijn niet als stil succes gemarkeerd. Ze zijn vastgelegd in `xlsx-validation.json` en vallen onder de volgende functionele productiefase.
