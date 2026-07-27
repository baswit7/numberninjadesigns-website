# Operational Intelligence Layer

## Doel
De Operational Intelligence Layer verandert het Visual Runtime Dashboard van statusweergave naar lokale, deterministische beoordeling. De laag leest alleen gegenereerde dashboard state en historische snapshots.

## Dataflow
```text
Runtime Console
  -> runtime/*.json
  -> Dashboard Adapter
  -> runtime/dashboard/*.json
  -> Historical Snapshot Layer
  -> Operational Intelligence Layer
  -> Visual Dashboard
```

## Boundary
De laag is read-only ten opzichte van runtime, providers en deployments. Hij voert geen runtimevalidaties uit, inspecteert geen providers direct, leest geen raw provider credentials, muteert geen runtime state, voert geen deployments uit en doet geen externe requests.

## Outputs
| Output | Functie |
| --- | --- |
| `operational-health.view.json` | Studio Health Score en componentwegingen |
| `trend-intelligence.view.json` | Improving, Stable of Declining per operationeel domein |
| `change-intelligence.view.json` | Delta tussen laatste en vorige snapshot |
| `risk-intelligence.view.json` | Explainable risk score en LOW/MEDIUM/HIGH/CRITICAL level |
| `maturity.view.json` | Project maturity op zes meetbare criteria |
| `governance.view.json` | Governance score op vereiste documentatie-artifacts |
| `executive-summary.view.json` | Deterministische managementsamenvatting |

## Modellen
Health gebruikt vaste gewichten: Runtime Health 25, Projects 15, Documentation 15, Contracts 15, Providers 10, Telemetry 10, Deployments 5 en Events 5. Statussen krijgen expliciete penalties: success 0, info 0.15, warning 0.45, unknown 0.55 en error 1.

Trend gebruikt snapshots in `runtime/history/`. Studio Health verbetert bij delta groter dan 2, daalt bij delta kleiner dan -2. Domeinen op aantallen gezonde items verbeteren bij positieve delta, dalen bij negatieve delta.

Risk gebruikt de health gap, warning/error-deltas, dalende trends, missing documentation, contract failures en provider issues. Iedere factor wordt met punten en evidence gerapporteerd.

Maturity gebruikt zes criteria: registered, path exists, documentation present, controlled branch, deployment declared en dashboard healthy.

Governance gebruikt alleen artifacts die door de Dashboard Adapter in documentation state zijn opgenomen: README, CHANGELOG, PROJECT_MASTER, ARCHITECTURE, CODEX, ROADMAP en documentation status.

## Security
Snapshots bewaren summaries, counts, scores en timestamps. Ze kopieren geen tokens, credential values, OAuth data of secret values. Environment variable names mogen zichtbaar zijn in dashboard provider state, maar snapshot history bewaart die detailvelden niet.
