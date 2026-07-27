# Repository Baseline Report

> Historische momentopname. Sinds de consolidatie van 27 juli 2026 staan de actieve idee-scaffolds onder `projects/NumberNinjaDesigns/initiatives/`; FIELD FLOW AI blijft buiten deze repository.

Datum: 2026-05-28
Branch: `feature/shared-systems-architecture`
Scope: conservatieve repository-baseline cleanup zonder runtimewijzigingen, deletes of deploys.

## Samenvatting
- Totaal gevonden bestanden buiten `.git/`: 104.
- Tracked bestanden: 9.
- Untracked bestanden volgens `git status --short -uall`: 95.
- Runtimecode is niet aangepast.
- Er zijn geen bestanden verwijderd, verplaatst of gearchiveerd.
- Er zijn geen deploys uitgevoerd.

## Tracked vs Untracked

### Tracked
De huidige Git-index bevat alleen centrale baseline-documentatie en shared README-bestanden:
- `CHANGELOG.md`
- `docs/ARCHITECTURE.md`
- `docs/SHARED_SYSTEMS_ARCHITECTURE.md`
- `shared/analytics/README.md`
- `shared/apis/README.md`
- `shared/automation/README.md`
- `shared/prompts/README.md`
- `shared/templates/README.md`
- `shared/ui/README.md`

### Untracked
De untracked set bevat de nieuwe repository-operatinglaag, projectmappen en een legacy API-naamgevingsmap:
- Rootdocumentatie: `.gitignore`, `CODEX.md`, `README.md`.
- Root docs: `docs/DEBUGGING.md`, `docs/MASTER_CONTROL.md`, `docs/NOTION_SYNC_PLAN.md`, `docs/WORKFLOW.md`.
- Scripts: `scripts/check-structure.ps1`, `scripts/setup.ps1`, `scripts/update-docs.ps1`.
- Projectstructuren voor:
  - `projects/AIDaytraden/`
  - `projects/BoodschappenVergelijker/`
  - `projects/LeersystemenVerkoop/`
  - `projects/LogistiekeSystemenVerkoop/`
  - `projects/NiveauVerhogenPaul/`
  - `projects/NumberNinjaDesigns/`
  - `projects/TOKHub/`
- Legacy/overlap-kandidaat: `shared/api/README.md`.

## Gecontroleerde Risicocategorieen

| Categorie | Bevinding | Actie |
| --- | --- | --- |
| `shared/api` vs `shared/apis` | Beide bestaan. `shared/apis/` is gedocumenteerd als nieuwe standaard; `shared/api/` is historische overlap. | Niet verwijderen. Eerst alle toekomstige verwijzingen naar `shared/apis/` sturen en daarna gecontroleerd archiveren of vervangen door redirect-documentatie. |
| Dubbele docs structuren | Projecten hebben bewust dezelfde docs-set: `API_STATUS.md`, `ARCHITECTURE.md`, `DEBUGGING.md`, `PROJECT_MASTER.md`, `PROMPTS.md`, `ROADMAP.md`. | Behouden als projectstandaard. Centraliseer alleen gedeelde templates in `shared/templates/`. |
| Oude HTML prototypes | Geen `.html` bestanden gevonden buiten `.git/`. | Geen actie. |
| Tijdelijke exports | Geen export-, temp-, backup- of archivebestanden gevonden buiten `.git/`. | `.gitignore` voorbereid voor toekomstige exports/temp/backups. |
| Screenshots | Geen screenshot- of imagebestanden gevonden buiten `.git/`. | Geen actie. |
| Zip bestanden | Geen `.zip` bestanden gevonden buiten `.git/`. | Geen actie. |
| Dubbele README systemen | 15 `README.md` bestanden gevonden: root, shared domeinen en projectroots. | Behouden. Dit is een bewuste navigatiestructuur, geen bewezen duplicatie. |
| Losse testbestanden | Alleen lege `tests/.gitkeep` placeholders per project gevonden. | Behouden als structuuranker. Geen testcode aanwezig om te beoordelen. |

## Duplicate Structuren

### Bewuste patroonduplicatie
De volgende namen komen meerdere keren voor omdat elk project een eigen governancepakket heeft:
- `README.md`: 15 keer.
- `CHANGELOG.md`: 8 keer.
- `CODEX.md`: 8 keer.
- `ARCHITECTURE.md`: 8 keer.
- `DEBUGGING.md`: 8 keer.
- `API_STATUS.md`: 7 keer.
- `PROJECT_MASTER.md`: 7 keer.
- `PROMPTS.md`: 7 keer.
- `ROADMAP.md`: 7 keer.
- `.gitkeep`: 21 keer.

Deze duplicatie is op dit moment structureel verklaarbaar. Er is geen bewijs dat runtimecode dubbel of conflicterend aanwezig is.

### Naamgevingsinconsistentie
De enige concrete inconsistentie is:
- `shared/api/`
- `shared/apis/`

Aanbevolen standaard: `shared/apis/`, omdat dit al in `docs/ARCHITECTURE.md` en `CHANGELOG.md` als nieuwe standaard is vastgelegd.

## Mogelijk Legacy

| Pad | Waarom mogelijk legacy | Risico bij directe verwijdering | Aanbevolen vervolg |
| --- | --- | --- | --- |
| `shared/api/README.md` | Enkelvoudige naam overlapt met `shared/apis/`; inhoud noemt hetzelfde domein. | Medium: toekomstige of lokale verwijzingen kunnen nog naar de oude map wijzen. | Eerst verwijzingen zoeken, daarna eventueel vervangen door een korte migratienotitie of archiveren in een aparte cleanup-commit. |

## Veilig Archiveerbaar

Er is niets definitief veilig archiveerbaar zonder extra verificatie. Conservatieve classificatie:
- Geen bestanden direct archiveren in deze baseline.
- `shared/api/` is alleen archiveerbaar nadat:
  - `rg "shared/api"` geen actieve verwijzingen toont buiten het baseline-rapport;
  - `shared/apis/` de expliciete standaard blijft;
  - een aparte commit de migratie documenteert.

## Risicoanalyse

| Risico | Kans | Impact | Beheersmaatregel |
| --- | --- | --- | --- |
| Per ongeluk runtimegedrag wijzigen | Laag | Hoog | Alleen docs en `.gitignore` wijzigen; geen broncode of projectinhoud aanpassen. |
| Legacy-map te vroeg verwijderen | Medium | Medium | Geen deletes uitvoeren; alleen markeren als mogelijk legacy. |
| Te veel projectdocumentatie centraliseren | Medium | Medium | Projectdocs behouden zolang projectspecifieke context nodig is. |
| Secrets of lokale output committen | Medium | Hoog | `.gitignore` uitbreiden met local secrets, logs, temp, exports, backups, build output en caches. |
| Onbedoeld artefacten missen door toekomstige tooling | Medium | Medium | Periodiek baseline-scan herhalen voor zip, screenshots, exports, logs en local env-bestanden. |

## Aanbevelingen

1. Behoud `shared/apis/` als enige nieuwe API-standaard.
2. Laat `shared/api/` voorlopig bestaan als legacy-overlap totdat verwijzingen gecontroleerd zijn.
3. Commit de huidige documentatiebaseline apart van toekomstige runtime- of productwijzigingen.
4. Houd rootdocumentatie voor portfolio-governance en projectdocumentatie voor productcontext.
5. Voeg geen gedeelde runtime-dependency toe voordat minimaal twee projecten dezelfde bewezen behoefte hebben.
6. Herhaal deze baselinecontrole voor iedere grotere projectimport of voor het toevoegen van gegenereerde assets.

## Controle Op Fouten, Performance En Security

- Geen runtimebestanden aangepast.
- Geen bestanden verwijderd.
- Geen deploy uitgevoerd.
- Geen secrets gevonden in de bestandsnamen of `.gitignore`-scope.
- Geen zware binaries, screenshots, zips, HTML-prototypes of exportbestanden gevonden buiten `.git/`.
- `.gitignore` is aangescherpt om toekomstige lokale output, secrets en buildartefacten buiten Git te houden.
