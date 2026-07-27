# Token Optimization System

## Doel
Het Token Optimization System maximaliseert output per contexttoken. De factory gebruikt compacte documenten, herbruikbare promptblokken, kleine branches en centrale waarheden om AI-werk sneller, goedkoper en betrouwbaarder te maken.

## Kernprincipes
- GitHub is de technische waarheid.
- Notion bewaart samenvattingen, beslissingen en lessons learned.
- Chats zijn tijdelijk; belangrijke kennis verhuist naar docs.
- Agents laden alleen relevante context.
- Grote taken worden opgesplitst in reviewbare branches.
- Promptblokken worden hergebruikt in plaats van opnieuw uitgeschreven.

## Context Budgets
| Taaktype | Richtbudget | Strategie |
| --- | ---: | --- |
| Kleine docwijziging | Laag | Alleen relevante docs lezen |
| Feature in een project | Medium | Project README, architecture, target files |
| Cross-project wijziging | Hoog | Centrale docs, affected projects, shared contracts |
| Release review | Medium | Changelog, gates, diff, deployment docs |
| Incident/debugging | Hoog | Logs, recent diff, reproduction, architecture |

## Prompt Standards
Een goede prompt bevat:
- project;
- doel;
- scope;
- constraints;
- acceptance criteria;
- gewenste output;
- verboden acties;
- relevante bestanden.

## Task Sizing Rules
- Een chat behandelt bij voorkeur een afgeronde taak.
- Splits wanneer meer dan een project of subsystem diep verandert.
- Splits wanneer runtime code en governance docs beide groot zijn.
- Splits wanneer verificatie meer dan een onafhankelijke check vraagt.

## Conversation Lifecycle
1. **Load:** minimale context.
2. **Act:** gerichte wijziging.
3. **Verify:** concrete checks.
4. **Summarize:** resultaat en risico's.
5. **Persist:** docs, changelog of knowledge graph update.

## Memory Delegation
| Geheugen | Wat hoort erin |
| --- | --- |
| GitHub docs | Architectuur, workflows, quality gates, API registry |
| Project docs | Productcontext, roadmap, bugs, prompts, releaseplan |
| Notion | Planning, decisions, customer feedback, meeting notes |
| Changelog | Betekenisvolle wijzigingen |
| Knowledge graph | Reusable patterns, anti-patterns, lessons learned |

## Duplicate Context Control
- Verwijs naar centrale docs in plaats van lange herhaling.
- Houd projectdocs projectspecifiek.
- Gebruik korte tabellen voor scores en status.
- Verwijder of archiveer pas na impactanalyse.
- Vermijd chat-only besluiten.

## Token Health Indicators
| Indicator | Gezond | Risico |
| --- | --- | --- |
| Projectdoc lengte | Compact en gestructureerd | Lange narratieve documenten |
| Prompt reuse | Centrale blokken | Elke taak nieuwe prompt |
| Branch scope | Klein | Meerdere doelen tegelijk |
| Context load | Selectief | Hele repo lezen zonder noodzaak |
| Knowledge sync | Samenvattingen | Duplicaat volledige chats |
