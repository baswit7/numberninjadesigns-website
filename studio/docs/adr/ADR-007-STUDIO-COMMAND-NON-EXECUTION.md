# ADR-007: Studio Command Non-Execution

## Context

Studio OS heeft na Phase 6 voldoende runtime-, dashboard-, operational intelligence- en governance-output om acties te adviseren. De volgende stap is een command layer die deze informatie omzet naar gecontroleerde actievoorstellen, Codex-prompts, release-checklists en workflowhandoffs.

Zonder harde grens kan een command layer te snel veranderen in een executor die Git, providers, deployments of externe workflows muteert. Dat zou botsen met de bestaande safety boundaries.

## Decision

Phase 7 wordt ontworpen als non-executing Studio Command & Automation Layer.

De laag mag acties voorbereiden, classificeren en rapporteren. De laag mag geen acties uitvoeren. Iedere voorgestelde actie krijgt een classification:

- `SAFE_READ`
- `SAFE_WRITE_DOCS`
- `SAFE_GENERATE_PROMPT`
- `REQUIRES_APPROVAL`
- `BLOCKED`

Unknown, destructive, secret-related or structurally unsafe actions default to `BLOCKED`.

## Consequences

- Studio OS krijgt bruikbare command intelligence zonder execution risk.
- Governance blijft de eligibility authority.
- Runtime Console blijft gescheiden van command planning.
- Dashboard blijft read-only.
- Future Notion, GitHub en Vercel handoffs blijven proposal-only totdat expliciete approval en contracts bestaan.
- Implementatie kan later klein en testbaar starten, omdat de classification boundary eerst vastligt.

## Forbidden Actions

Phase 7 mag nooit zelfstandig:

- committen
- pushen
- mergen
- deployen
- provider calls doen
- secrets lezen
- credentials opslaan
- bestanden verwijderen
- projectstructuur herschrijven
- governance score herberekenen
- runtime-validatie dupliceren
- dashboard adapter dupliceren
- runtime console uitvoeren
- generated runtime output maken of committen

## Why Non-Execution First

Non-execution first voorkomt dat aanbevelingen per ongeluk operationele authority krijgen. De command layer moet eerst bewijzen dat hij intent correct kan lezen, risico correct kan classificeren, evidence traceerbaar houdt en veilige handofftekst kan maken.

Pas wanneer deze discipline betrouwbaar is, kan een latere ADR bepalen of beperkte, expliciet goedgekeurde execution flows ooit toegestaan zijn.

## Approval Model

Het approval model is menselijk, expliciet en actiegericht:

- `SAFE_READ` mag zonder approval als het alleen bestaande toegestane input leest.
- `SAFE_WRITE_DOCS` mag alleen binnen expliciet gevraagde documentatiescope.
- `SAFE_GENERATE_PROMPT` mag prompts en checklists maken, maar niet uitvoeren.
- `REQUIRES_APPROVAL` mag alleen een approval request en veilige handoff voorbereiden.
- `BLOCKED` mag niet worden uitgevoerd en moet een blockerreden rapporteren.

Approval is niet overdraagbaar. Goedkeuring voor een prompt is geen goedkeuring voor Git, provider calls, deploys of externe workflowmutaties.

## Status

Proposed.

## Date

2026-06-03
