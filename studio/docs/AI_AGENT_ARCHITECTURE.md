# AI Agent Architecture

## Doel
De multi-agent architectuur verdeelt werk in gespecialiseerde rollen met expliciete inputs, outputs, quality checks en overdrachtsmomenten. Agents zijn geen losse prompts maar herbruikbare operationele functies binnen de software factory.

## Agent Contract
Elke agent werkt met hetzelfde contract.

| Veld | Betekenis |
| --- | --- |
| Mission | Primaire verantwoordelijkheid |
| Inputs | Vereiste context voordat de agent start |
| Outputs | Concrete artefacten of beslissingen |
| Checks | Criteria voordat werk wordt overgedragen |
| Escalation | Wanneer menselijke of senior review nodig is |

## Agents

### 1. Architect Agent
- **Mission:** systeemdesign, structuur, schaalbaarheid en modulegrenzen.
- **Inputs:** project vision, requirements, existing architecture, shared modules, constraints.
- **Outputs:** architecture doc, module map, dependency policy, scaling risks.
- **Checks:** geen verborgen afhankelijkheden, duidelijke ownership, cloud-ready ontwerp.
- **Escalation:** bij cross-project dependencies, security impact of grote datavolumes.

### 2. UI/UX Agent
- **Mission:** design systems, usability, conversion en responsive interacties.
- **Inputs:** audience, use cases, brand system, UX principles, conversion goals.
- **Outputs:** UX principles, screens, interaction states, accessibility notes.
- **Checks:** mobile-first, loading/error states, visible status, no overlapping UI.
- **Escalation:** bij conversie-kritieke flows of accessibility blockers.

### 3. Sales Agent
- **Mission:** commerciele validatie, pricing en market fit.
- **Inputs:** audience, problem, competitors, offer, channel assumptions.
- **Outputs:** validation plan, pricing thesis, sales objections, offer framework.
- **Checks:** urgent probleem, betaalbereidheid, duidelijke doelgroep, meetbare feedback.
- **Escalation:** bij lage willingness to pay of onduidelijke buyer.

### 4. SEO/Growth Agent
- **Mission:** discoverability, ranking, growth loops en contentstrategie.
- **Inputs:** product category, search intent, competitors, audience language.
- **Outputs:** SEO map, keyword clusters, growth experiments, content backlog.
- **Checks:** intent-match, indexeerbaarheid, metadata plan, distribution loop.
- **Escalation:** bij YMYL-risico, datalicenties of merkpositionering.

### 5. Debug Agent
- **Mission:** root cause analysis, regressiedetectie en stabiliteit.
- **Inputs:** bug report, logs, reproduction steps, recent changes, environment.
- **Outputs:** root cause, fix plan, test plan, regression guard.
- **Checks:** oorzaak bewezen, niet alleen symptoom opgelost, fallback beschreven.
- **Escalation:** bij data loss, security incident of onreproduceerbare production bug.

### 6. Refactor Agent
- **Mission:** technical debt reduction, cleanup en modularisering.
- **Inputs:** architecture doc, duplication map, complexity hotspots, tests.
- **Outputs:** refactor plan, migration path, risk matrix, cleanup PR.
- **Checks:** gedrag behouden, scope klein, tests of checks aanwezig.
- **Escalation:** bij public API change of migration zonder rollback.

### 7. Security Agent
- **Mission:** API audits, secrets governance en security checks.
- **Inputs:** API registry, auth flows, environment strategy, dependency list.
- **Outputs:** security risk register, secrets checklist, threat notes.
- **Checks:** no secrets in repo, least privilege, token expiry, audit logging.
- **Escalation:** bij exposed credentials, unsafe auth, PII of payment data.

### 8. Release Agent
- **Mission:** deployment checks, release readiness en rollback validation.
- **Inputs:** changelog, quality gate scores, branch status, deployment target.
- **Outputs:** release checklist, go/no-go decision, rollback plan, release notes.
- **Checks:** gates passed, rollback tested or documented, analytics baseline ready.
- **Escalation:** bij blockers, missing owner, missing rollback or degraded API.

### 9. Analytics Agent
- **Mission:** KPI monitoring, performance insights en feedback loops.
- **Inputs:** product goals, analytics events, conversion funnel, revenue metrics.
- **Outputs:** KPI dashboard spec, event taxonomy, insight report.
- **Checks:** metrics actionable, privacy-safe, tied to decisions.
- **Escalation:** bij tracking of privacy ambiguity.

### 10. Automation Agent
- **Mission:** workflow automation, integrations en orchestration.
- **Inputs:** manual workflow, frequency, error modes, required APIs.
- **Outputs:** automation spec, retry/fallback model, status indicators.
- **Checks:** idempotency, rate limits, recovery, clear failure states.
- **Escalation:** bij irreversible actions, production writes or external posting.

### 11. Knowledge Agent
- **Mission:** lessons learned, prompt memory en reusable intelligence.
- **Inputs:** decisions, incidents, launches, experiments, reusable patterns.
- **Outputs:** knowledge graph entries, prompt improvements, anti-pattern updates.
- **Checks:** compact, searchable, source-linked, no secrets.
- **Escalation:** bij conflicting decisions or obsolete canonical docs.

### 12. Revenue Agent
- **Mission:** monetization, pricing experiments en launch strategy.
- **Inputs:** validation data, funnel metrics, offer, costs, market feedback.
- **Outputs:** revenue experiments, pricing matrix, conversion improvement plan.
- **Checks:** measurable hypothesis, expected impact, rollback or stop condition.
- **Escalation:** bij legal/compliance/payment risk or unclear unit economics.

## Handoff Workflow
1. Architect Agent frames module boundaries and risk.
2. UI/UX Agent and Sales Agent validate user and commercial fit.
3. SEO/Growth Agent and Revenue Agent define acquisition and monetization.
4. Codex implements only scoped, documented changes.
5. Debug, Security and Refactor Agents review technical quality.
6. Release Agent performs go/no-go.
7. Analytics and Knowledge Agents capture launch results and reusable learnings.

## Escalation Rules
- Security, data loss, payments or production credentials always escalate.
- Cross-project shared module changes require architecture review.
- Launch blockers require Release Agent approval before continuing.
- Repeated defects require Knowledge Agent update and regression guard.
