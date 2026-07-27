# Knowledge Graph Strategy

## Doel
De knowledge graph maakt de software factory slimmer naarmate meer projecten worden gebouwd. Het systeem bewaart beslissingen, experimenten, patronen en lessons learned als herbruikbare intelligentie.

## Knowledge Types
| Type | Voorbeeld |
| --- | --- |
| Decision | Hostingkeuze, API-strategie, pricingbesluit |
| Failed experiment | Campagne zonder conversie, API met onbruikbare limits |
| Successful launch | Werkende offer, funnel of deploymentpatroon |
| Reusable prompt | Debug prompt, release review prompt, SEO prompt |
| Reusable system | Analytics taxonomy, API health pattern |
| SEO learning | Keyword cluster, intent mismatch, ranking opportunity |
| API learning | Rate limit, auth issue, fallback pattern |
| Debugging learning | Root cause, regression guard, diagnostic query |
| Commercial learning | Pricing insight, objection, buyer segment |
| Automation learning | Retry model, idempotency pattern, failure mode |
| Architecture pattern | Module boundary, deployment split, shared contract |
| Anti-pattern | Giant HTML, hidden dependency, chat-only decision |
| Scaling lesson | Bottleneck, data growth issue, support constraint |

## Entry Schema
```yaml
id: kg-YYYYMMDD-short-name
type: decision | experiment | pattern | anti-pattern | lesson
project: portfolio | project-name
summary: one-line AI-readable summary
context: why this mattered
evidence: source file, metric, feedback or incident
decision: what changed
impact: technical, commercial or operational effect
reuse: when to apply again
owner: role or agent
review_date: YYYY-MM-DD
```

## Storage Strategy
- Canonical technical knowledge lives in GitHub docs.
- Operational planning and memory summaries live in Notion.
- Project-specific learnings live in `projects/<project>/docs/`.
- Cross-project reusable knowledge lives in central `docs/` or `shared/`.

## Update Triggers
Create or update knowledge when:
- a release succeeds or fails;
- an experiment changes commercial direction;
- a debugging session finds a reusable root cause;
- a prompt repeatedly improves output quality;
- a shared module is created or changed;
- a quality gate catches a real issue.

## Retrieval Rules
- Start with current project docs.
- Load central docs only for governance, shared patterns or cross-project questions.
- Prefer summaries over full historical chat.
- Resolve conflicts by most recent reviewed GitHub documentation.

## Self-Improvement Loop
1. Capture decision or lesson.
2. Normalize into the entry schema.
3. Link to source evidence.
4. Update relevant prompt, workflow or quality gate.
5. Review after real reuse.

## Anti-Entropy Controls
- Mark obsolete knowledge explicitly.
- Avoid duplicate entries for the same decision.
- Link patterns to examples.
- Keep entries short enough for AI retrieval.
- Never store secrets, credentials or private customer data.
