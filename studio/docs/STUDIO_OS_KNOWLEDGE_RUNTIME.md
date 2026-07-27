# Studio OS Knowledge Runtime

## Purpose
The Knowledge Runtime is the memory layer of the AI Software Factory. It captures decisions, failures, prompts, architecture patterns, launch outcomes, revenue learnings, API behavior and debugging lessons, then ranks and routes them back into future work.

## Knowledge Object Types
| Type | Captures |
| --- | --- |
| Decision | architectural, product, revenue or release decision |
| Pattern | reusable implementation, UX, workflow, prompt or launch approach |
| Failure | defect, incident, bad prompt, broken API, missed assumption |
| Prompt | reusable instruction block with cost and success metadata |
| Architecture | boundary, topology, integration or scaling model |
| Launch | readiness pattern, blocker, rollback lesson, launch result |
| Revenue | validated offer, channel, conversion, pricing or SEO insight |
| API Learning | auth issue, rate limit, fallback, provider reliability |
| Debug Lesson | root cause, reproduction, fix, prevention rule |
| Governance Rule | quality gate, authority rule, escalation threshold |

## Ingestion Pipeline
```text
source event/artifact
  -> extraction candidate
  -> classification
  -> evidence linking
  -> confidence scoring
  -> deduplication
  -> memory ranking
  -> promotion review
  -> retrieval index
  -> recommendation surface
```

## Indexing
| Index | Fields |
| --- | --- |
| Prompt Index | agent role, task type, token cost, success rate, failure mode |
| Architecture Index | domain, boundary, dependencies, scale trigger, constraints |
| Module Index | reusable component, owner, contract, maturity, adoption |
| Failure Index | root cause, affected area, prevention rule, recurrence |
| Launch Index | gates, blockers, outcomes, rollback, observation metrics |
| Revenue Index | product, channel, thesis, metric, lift, confidence |
| API Index | provider, endpoint, auth, rate limits, fallback, incidents |
| SEO Index | keyword, page, intent, ranking, conversion, update cadence |
| Debug Index | symptom, reproduction, fix, test, prevention |

## Memory Ranking
Score each memory item from 0 to 100:

```text
memory_score =
  evidence_quality * 0.25 +
  reuse_success * 0.20 +
  recency_adjusted_relevance * 0.20 +
  domain_match * 0.15 +
  failure_prevention_value * 0.10 +
  token_savings_value * 0.10
```

Confidence modifies presentation:

```text
effective_memory_score = memory_score * confidence
```

## Knowledge Aging
| Condition | Aging Behavior |
| --- | --- |
| No reuse for 90 days | reduce ranking unless evergreen |
| API/provider changed | mark as needs validation |
| Reused successfully | increase ranking and confidence |
| Caused failure | demote and create anti-pattern |
| Superseded by better pattern | deprecate with replacement link |
| Security-sensitive | require periodic review |

## Retrieval Pipeline
1. Receive task objective and resource scope.
2. Classify task type and risk.
3. Retrieve only relevant memory categories.
4. Filter by confidence, freshness, permissions and domain.
5. Rank by effective memory score.
6. Compress into context blocks.
7. Attach source references and uncertainty.
8. Record which memories were used.

## Recommendation Systems
| Recommendation | Source |
| --- | --- |
| Reuse prompt block | prompt success rate and task similarity |
| Add quality gate | repeated failure class |
| Promote shared module | repeated implementation across projects |
| Revisit architecture | scaling pressure or dependency drift |
| Launch hold | historical blocker pattern |
| Revenue experiment | similar validated opportunity |
| API fallback | provider instability memory |
| Token compression | repeated context waste |

## Cross-Project Propagation
Knowledge propagates when:
- same failure appears in two projects;
- a prompt succeeds across multiple domains;
- a launch pattern improves readiness;
- a revenue experiment shows repeatable lift;
- an API integration pattern stabilizes;
- a UX component becomes broadly reusable;
- a scoring threshold predicts real outcomes.

Propagation requires:
- source evidence;
- applicable constraints;
- confidence;
- owner approval for enforced gates;
- rollback/deprecation path.

## Feedback Loops
| Loop | Action |
| --- | --- |
| Agent outcome loop | update prompt and memory success metrics |
| Release loop | capture launch blockers, rollback and outcome |
| Incident loop | create prevention rule and debug memory |
| Revenue loop | promote validated experiment or kill weak thesis |
| Token loop | promote compressed context blocks |
| Architecture loop | move repeated boundary to shared architecture |

## Data Protection
- Secrets and credentials are never stored in memory.
- Personal data is summarized or excluded unless explicitly required.
- Memory items include visibility scope.
- Sensitive incident details require restricted retrieval.
- Deprecated memory remains traceable but is not recommended by default.

## Success Criteria
The Knowledge Runtime succeeds when:
- repeated work decreases;
- repeated failures become prevention rules;
- prompts improve over time;
- context loads shrink;
- launches become more predictable;
- revenue patterns transfer between projects;
- agents receive better context with fewer tokens.
