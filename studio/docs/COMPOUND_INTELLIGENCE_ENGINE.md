# Compound Intelligence Engine

## Doel
De Compound Intelligence Engine zet projectgeschiedenis om in proprietaire operationele intelligentie. Succesvolle patronen worden herbruikbaar, mislukte patronen worden preventieregels en tokengebruik daalt doordat agents compacte kennis ophalen in plaats van chatgeschiedenis te herlezen.

## Knowledge Domains
| Domain | Stored Objects | Examples |
| --- | --- | --- |
| Architecture | ADRs, system boundaries, scaling lessons | Shared module promotion, API fallback decision |
| Experiments | Hypotheses, results, learnings | Pricing test, landing page variant |
| Launches | Release notes, incidents, postmortems | Failed deploy, high-converting launch |
| Prompts | Reusable prompt blocks and evaluations | Debug prompt, release review prompt |
| Code Systems | Reusable components, contracts, templates | API client pattern, analytics event schema |
| SEO/Growth | Keywords, content structures, channel learnings | Search clusters, campaign results |
| Conversion | UX patterns, activation events, friction points | CTA placement, onboarding step |
| Debugging | Root causes, symptoms, prevention rules | Token expiry pattern, CORS failure pattern |
| API Stability | Rate limits, outages, behavior changes | TikTok API instability, retry rules |
| Commercial | Buyer pain, willingness to pay, saturation | Validated niche, rejected offer |
| Workflows | Recipes, runbooks, anti-patterns | Release checklist, failed automation |

## Graph Model
| Node | Key Fields |
| --- | --- |
| Project | name, domain, owner, status, scores |
| Decision | title, context, options, chosen path, impact |
| Pattern | trigger, solution, evidence, reuse count |
| AntiPattern | failure mode, prevention, severity |
| PromptBlock | purpose, inputs, outputs, cost, success rate |
| Experiment | hypothesis, metric, result, confidence |
| Incident | symptom, root cause, fix, prevention |
| API | owner, auth, rate limit, cost, stability |
| Release | scope, gates, deploy state, rollback |
| Metric | definition, source, owner, formula |

## Relationship Types
- `PROJECT_USED_PATTERN`
- `PROJECT_HAD_INCIDENT`
- `DECISION_REPLACED_DECISION`
- `PROMPT_PROMOTED_FROM_TASK`
- `EXPERIMENT_VALIDATED_ASSUMPTION`
- `INCIDENT_CREATED_PREVENTION_RULE`
- `API_TRIGGERED_FAILURE_MODE`
- `RELEASE_IMPROVED_SCORE`
- `PATTERN_RECOMMENDED_FOR_PROJECT`

## Ingestion Rules
| Source | Trigger | Output |
| --- | --- | --- |
| Release Center | Release approved or failed | Release node, lessons, gate outcomes |
| Debug Agent | RCA completed | Incident, root cause, prevention rule |
| Revenue Engine | Experiment completed | Commercial learning, score updates |
| Prompt Vault | Prompt outcome recorded | Prompt success metrics |
| Quality Gates | Blocker detected | Risk pattern or anti-pattern |
| Project Control | Decision made | Decision node and dependencies |

## Pattern Detection
The engine detects:
- repeated root causes across projects;
- duplicated architecture decisions;
- prompts with high success and low token cost;
- APIs with repeated instability;
- UX patterns tied to conversion lift;
- score improvements after specific interventions;
- repeated manual workflows eligible for automation.

## Recommendation Logic
| Signal | Recommendation |
| --- | --- |
| Similar project type and validated pattern | Reuse pattern before inventing new design |
| Repeated incident class | Add quality gate or automation check |
| High-cost prompt with low success | Deprecate or rewrite prompt |
| Revenue pattern with positive validation | Promote to launch playbook |
| Repeated shared code need | Propose shared module contract |
| API with instability trend | Require fallback and monitoring before release |

## Token Reduction Strategy
- Store compact summaries with links to full artifacts.
- Use typed graph queries for context retrieval.
- Prefer latest approved decision over full decision history.
- Load patterns by project type, risk and task, not by entire repo.
- Promote stable prompt layers into Prompt Vault.

## Quality Controls
- No memory object without source reference.
- No pattern promotion without repeated evidence or high-impact single proof.
- No anti-pattern deletion; deprecate with replacement.
- No conflicting decision without supersession link.
- No commercial learning without metric definition.
