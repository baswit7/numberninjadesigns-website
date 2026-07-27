# Market Intelligence Service

Studio OS market intelligence is a read-only capability for turning local business knowledge and explicitly available public-signal evidence into ranked opportunity visibility.

## Boundary

- No provider mutations.
- No publishing, scheduling or posting.
- No browser automation.
- No OAuth automation.
- No login automation.
- No private scraping.
- No secrets, tokens, ids or response bodies in reports.
- Missing, unavailable or invalid sources stay `UNKNOWN`.

## Runtime Outputs

The generator writes:

- `runtime/market-intelligence/market-signals.report.json`
- `runtime/market-intelligence/opportunities.report.json`
- `runtime/market-intelligence/recommendations.report.json`
- `runtime/market-intelligence/approval-queue.report.json`

Dashboard projection is owned by `apps/studio-dashboard/dashboard-adapter.ps1` and writes:

- `runtime/dashboard/market-intelligence.view.json`

## Run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\services\market-intelligence\generate-market-intelligence.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\apps\studio-dashboard\dashboard-adapter.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-market-intelligence.ps1
```
