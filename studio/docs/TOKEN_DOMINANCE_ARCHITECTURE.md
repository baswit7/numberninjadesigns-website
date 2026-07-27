# Token Dominance Architecture

## Doel
Token Dominance Architecture minimaliseert AI-kosten en contextverspilling terwijl outputkwaliteit stijgt. De factory gebruikt contextbudgetten, prompt layering, memory delegation, summaries en branch isolation om maximum resultaat per token te halen.

## Context Budget Model
| Work Type | Context Budget | Required Inputs |
| --- | ---: | --- |
| Small docs update | Low | Target doc, related index, changelog |
| Single project feature | Medium | Project README, architecture, affected files |
| Cross-project governance | Medium | Root docs, affected contracts |
| Runtime change | Medium/High | Architecture, code, tests, logs |
| Incident | High | Logs, diff, reproduction, API registry |
| Release | Medium | Changelog, gates, branch diff, deployment notes |

## Prompt Layering
| Layer | Content | Stability |
| --- | --- | --- |
| System layer | Global behavior and safety | Stable |
| Factory layer | Repository rules, quality gates, governance | Stable |
| Project layer | Product context, users, brand, architecture | Medium |
| Task layer | Objective, scope, acceptance criteria | Per task |
| Evidence layer | Logs, diffs, metrics, files | Per task |
| Output layer | Required deliverable and format | Per task |

## Memory Delegation
| Information | Stored In | Loaded When |
| --- | --- | --- |
| Architecture decisions | GitHub docs / ADRs | Architecture or release tasks |
| Planning and meetings | Notion | Product or roadmap tasks |
| Prompt patterns | Prompt Vault | Similar task type |
| Reusable lessons | Knowledge Graph | Agent routing or design review |
| API behavior | API Registry | Integration, debug or release tasks |
| Metrics | Analytics Core | Scoring, revenue or incident tasks |

## Reusable Intelligence Blocks
Blocks are promoted when they are:
- stable across at least two tasks or strategically critical once;
- short enough to load cheaply;
- tied to an output contract;
- measured for success or failure;
- free from secrets and project-private data unless scoped.

## Branch Isolation
- One branch owns one coherent outcome.
- Avoid mixing runtime implementation, governance redesign and cleanup.
- Large work is split by app, project or subsystem.
- Every branch has a compact summary for future agents.
- Stale branches are reviewed for reusable knowledge before closure.

## Project Segmentation
| Segment | Purpose |
| --- | --- |
| Root docs | Factory-wide policy and architecture |
| Project docs | Product-specific context and decisions |
| Shared systems | Reusable contracts and patterns |
| Scripts | Safe validation and maintenance |
| Runtime apps | Future executable systems only after architecture approval |

## AI-Readable Summaries
Every major doc should expose:
- purpose;
- ownership;
- current status;
- inputs and outputs;
- decision rules;
- open risks;
- links to related systems.

## Compression Strategies
- Replace long chat history with structured outcome summaries.
- Use tables for score models and contracts.
- Keep detailed evidence linked, not pasted everywhere.
- Supersede old decisions with explicit replacement links.
- Summarize repeated project scaffolds at root and keep specifics local.

## Token Waste Detectors
| Waste Pattern | Prevention |
| --- | --- |
| Loading entire repo for small change | Use target file and references only |
| Rewriting same prompt | Promote prompt block |
| Repeating architecture text in every project | Link central doc |
| Long unresolved chats | Persist decision and close thread |
| Agents debating without evidence | Require source and confidence |
| Large mixed branches | Split task and summarize boundary |

## Cost Escalation
Escalate when:
- token cost exceeds expected budget by 50 percent;
- same context is loaded repeatedly;
- agent fails same task twice;
- generated output is mostly discarded;
- project lacks compact source-of-truth docs.
