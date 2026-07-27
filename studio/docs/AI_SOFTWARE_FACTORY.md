# AI Software Factory

## Doel
De AI Software Factory is het centrale operating system voor het bouwen, valideren, lanceren en verbeteren van meerdere AI-native producten. Het systeem maakt van de repository een schaalbare productfabriek met GitHub als technische waarheid, Notion als operationeel geheugen, Codex als implementatie-engine, ChatGPT als strategische reviewer en Vercel als gecontroleerd deploymentkanaal.

## Factory Principes
- **AI-first:** elk project, besluit, prompt, risico en quality gate is leesbaar voor AI-agents.
- **Documentatiegedreven:** architectuur, workflow, releasecriteria en commerciele aannames staan eerst in docs.
- **Modulair:** projecten blijven zelfstandig; hergebruik loopt via `shared/` met duidelijke contracten.
- **Token-efficient:** context wordt klein gehouden door centrale indexen, compacte projectdossiers en herbruikbare promptblokken.
- **Cloud-first:** deployments, secrets, observability en releaseprocessen worden ontworpen voor gecontroleerde cloudomgevingen.
- **Commercial by default:** elk project krijgt markt-, revenue- en launchvalidatie voordat het schaalt.
- **Self-improving:** lessons learned worden teruggevoerd naar prompts, workflows, checks en reusable systems.

## Centrale Waarheden
| Domein | Primaire waarheid | Rol |
| --- | --- | --- |
| Code en technische documentatie | GitHub repository | Reviewbare bron, branch discipline, releasehistorie |
| Planning en geheugen | Notion | Roadmaps, beslissingen, klantfeedback, lessons learned |
| Implementatie | Codex | Code, docs, checks, lokale validatie |
| Strategische review | ChatGPT | Architectuur, UX, business, security en launch readiness |
| Deployments | Vercel | Preview, production, rollback en observability |

## Repository Lagen
```text
docs/                 portfolio governance en factory systems
projects/<project>/   productdossiers, projectdocs, broncode en assets
shared/<domain>/      herbruikbare modules, prompts, templates en contracten
scripts/              veilige setup-, validatie- en documentatiecommando's
```

## Operating Cadence
| Moment | Output | Eigenaar |
| --- | --- | --- |
| Intake | Vision, scope, business case, first release target | Architect Agent + Sales Agent |
| Design | Architecture, UX principles, API registry, quality gates | Architect Agent + UI/UX Agent |
| Build | Feature branch, implementation, checks, documentation updates | Codex + Debug Agent |
| Review | Gate scores, risk register, release decision | ChatGPT + Release Agent |
| Launch | Deployment checklist, rollback plan, analytics baseline | Release Agent + Analytics Agent |
| Learn | Lessons learned, reusable patterns, prompt updates | Knowledge Agent |

## Factory Lifecycle
1. **Discover:** identify commercial problem, audience, urgency and willingness to pay.
2. **Frame:** write the project operating model and architecture before implementation.
3. **Build:** ship in small feature branches with focused scope and explicit acceptance criteria.
4. **Validate:** run quality gates, market checks, UX checks and security checks before release.
5. **Launch:** deploy only when launch readiness is above threshold and rollback is defined.
6. **Measure:** capture revenue, conversion, usage, bugs, performance and token cost.
7. **Improve:** convert learnings into reusable systems, prompts, docs and future gates.

## Factory Non-Negotiables
- No secrets in Git.
- No direct commits to main.
- No undocumented APIs.
- No giant unowned runtime files.
- No release without quality gates.
- No shared code without contract and owner.
- No project without commercial validation.
- No repeated failures without a knowledge graph update.

## Success Definition
The factory succeeds when a new product can move from idea to validated launch through repeatable documentation, agent workflows, quality gates, commercial scoring, deployment discipline and reusable intelligence without creating repository chaos or high token overhead.
