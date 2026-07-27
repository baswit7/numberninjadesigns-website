# Phase 5 Operational Intelligence Governance

## Besluit
Phase 5 introduceert een Historical Snapshot Layer en een Operational Intelligence Layer achter de bestaande Dashboard Adapter. De Runtime Console blijft de bron van waarheid, de adapter blijft de vertaler en de Visual Dashboard blijft consument.

## Nieuwe Commands
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\runtime\studio-console.ps1 -Command snapshot
```

`snapshot` bewaart een samenvatting van gegenereerde dashboard state onder `runtime/history/`.

`prune-history` is geen actief baseline-command. Het blijft future guarded maintenance en mag pas worden toegevoegd na aparte safety review van retention, path boundaries en delete-gedrag.

## Governance Regels
- Operational Intelligence leest uitsluitend `runtime/dashboard/*.json` en `runtime/history/*.json`.
- Geen provider calls, deployment calls, credential creation, secret exposure of runtime mutation.
- Geen LLM, AI inference of externe API voor scoring, trends, risk of executive summaries.
- Scoring en risk moeten verklaarbare modellen met vaste gewichten gebruiken.
- Dashboard UI mag intelligence weergeven, maar geen runtime-acties starten.

## Validatie
Phase 5 is geldig wanneer dashboard generation en snapshot export lokaal slagen en alle intelligence view models renderbaar zijn zonder Phase 4-functionaliteit te breken. History pruning blijft buiten de baseline totdat guarded maintenance apart is goedgekeurd.
