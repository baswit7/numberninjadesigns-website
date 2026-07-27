# Project Governance

## Doel
Project Governance definieert hoe elk product binnen de software factory wordt aangemaakt, bestuurd, beoordeeld en opgeschaald. Elk project moet zelfstandig begrijpbaar zijn voor mensen en AI-agents.

## Verplichte Projectstructuur
Elk project onder `projects/<project>/` krijgt minimaal:

| Bestand of sectie | Doel |
| --- | --- |
| `README.md` | Productoverzicht, status, doelgroep en quick start |
| `CODEX.md` | Projectspecificieke AI-instructies |
| `CHANGELOG.md` | Releasehistorie en betekenisvolle wijzigingen |
| `docs/PROJECT_MASTER.md` | Centrale projectwaarheid |
| `docs/ARCHITECTURE.md` | Technische architectuur en modulegrenzen |
| `docs/API_STATUS.md` | API registry, status, limits en secretsbeleid |
| `docs/DEBUGGING.md` | Root-cause workflow en bekende issues |
| `docs/PROMPTS.md` | Prompt library en agentinstructies |
| `docs/ROADMAP.md` | Feature backlog, releases en validatie |

## Verplichte Projectinhoud
Elk projectdossier bevat:
- Vision
- Mission
- Audience
- Problem/Solution
- Business Model
- Revenue Model
- Market Validation
- Technical Architecture
- UX Principles
- API Registry
- Prompt Library
- Feature Backlog
- Bug Board
- Release Plan
- Launch Checklist
- Analytics Dashboard
- Lessons Learned
- Reusable Components
- Scaling Risks
- Automation Opportunities

## Branch Discipline
- Werk altijd op `feature/`, `fix/`, `docs/`, `refactor/` of `release/` branches.
- Geen directe commits naar main.
- Feature branches moeten klein genoeg zijn voor review in een enkele context.
- Elke branch heeft een expliciet doel, impact en verificatiepad.

## Decision Governance
Belangrijke beslissingen worden vastgelegd met:
- datum
- besluit
- context
- alternatieven
- impact
- eigenaar
- herzieningsmoment

## Shared Module Governance
Een onderdeel mag alleen naar `shared/` als:
- het herbruikbaar is voor meerdere projecten of strategisch centraal moet zijn;
- het een duidelijk contract heeft;
- het geen projectgeheime aannames bevat;
- ownership en onderhoud zijn vastgelegd;
- migratie-impact bekend is.

## Review Governance
Elke release of grote wijziging krijgt minimaal:
- architecture review
- UX review waar interface of workflow verandert
- security review bij API, auth, data of externe integraties
- commercial review bij product- of pricingimpact
- documentation review voor AI-readability

## Stop Conditions
Werk stopt of escaleert wanneer:
- secrets of gevoelige data in Git dreigen te komen;
- requirements conflicteren met bestaande governance;
- projectgrenzen onduidelijk zijn;
- releasecriteria niet meetbaar zijn;
- commerciele aannames volledig onbewezen zijn bij launchscope.
