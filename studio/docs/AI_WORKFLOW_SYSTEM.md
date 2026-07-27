# AI Workflow System

## Doel
Het AI Workflow System standaardiseert hoe ChatGPT, Codex, GitHub, Notion, Vercel en specialistische agents samenwerken zonder contextchaos of ongecontroleerde groei.

## Workflow Principes
- Start elke taak met scope, acceptance criteria en risico's.
- Gebruik kleine feature branches.
- Leg betekenisvolle beslissingen vast in docs, niet alleen in chat.
- Houd projectcontext in projectdocs en generieke patronen in `shared/`.
- Gebruik quality gates voor releasebeslissingen.
- Synchroniseer alleen samengevatte, waardevolle kennis naar Notion.

## Standaard Werkstroom
1. **Intake:** definieer probleem, doel, project, owner, deadline en business impact.
2. **Context Load:** lees README, architecture, project master en relevante API docs.
3. **Plan:** bepaal minimale professionele wijziging, risico's en checks.
4. **Branch:** werk op taakgerichte feature branch.
5. **Build:** implementeer of documenteer volgens bestaande structuur.
6. **Verify:** draai beschikbare checks en review output.
7. **Document:** update changelog, architecture en projectdocs waar relevant.
8. **Review:** beoordeel quality gates en open risico's.
9. **Release:** maak PR, deploy preview of productie alleen na goedkeuring.
10. **Learn:** leg lessons learned en reusable patterns vast.

## Task Sizing
| Grootte | Criteria | Aanpak |
| --- | --- | --- |
| XS | Een docfix of kleine configwijziging | Direct uitvoeren, korte verificatie |
| S | Een kleine feature of docsysteem | Een branch, beperkte checks |
| M | Meerdere bestanden of cross-project impact | Plan, gates en review vereist |
| L | Nieuwe module, API of releasepad | Architectuur eerst, gefaseerde branches |
| XL | Platform- of factorywijziging | Splitsen in epics en governance-review |

## Agent Orchestration
| Fase | Primaire agent | Secundaire agent |
| --- | --- | --- |
| Discovery | Sales Agent | SEO/Growth Agent |
| Architecture | Architect Agent | Security Agent |
| UX | UI/UX Agent | Revenue Agent |
| Build | Codex | Debug Agent |
| Review | Release Agent | Refactor Agent |
| Learn | Knowledge Agent | Analytics Agent |

## Handoff Format
Elke overdracht bevat:
- doel
- scope
- gewijzigde bestanden
- beslissingen
- checks
- open risico's
- aanbevolen volgende stap

## Conversation Lifecycle
- **Start:** compacte taakomschrijving en relevante links.
- **Build:** alleen noodzakelijke context laden.
- **Checkpoint:** bij grote wijziging status en risico's samenvatten.
- **Close:** resultaat, verificatie, open risico's en commit/PR-status.
- **Archive:** leerpunten naar knowledge graph en Notion-samenvatting.

## Failure Handling
Bij fouten:
1. reproduceer;
2. bepaal root cause;
3. herstel minimale oorzaak;
4. voeg regression guard of documentatie toe;
5. leg lesson learned vast als het patroon herhaalbaar is.
