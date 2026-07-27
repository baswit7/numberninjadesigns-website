# Self Improving Operations

## Doel
Self Improving Operations definieert de feedbackloops waardoor de software factory automatisch beter wordt. De factory promoot succesvolle werkwijzen, depreceert zwakke workflows, versterkt gates en vermindert terugkerende fouten.

## Feedback Loops
| Loop | Input | Action | Output |
| --- | --- | --- | --- |
| Prompt Promotion | Successful agent task | Promote or version prompt block | Lower token cost and better consistency |
| Workflow Deprecation | Repeated failed runbook | Pause, rewrite or remove workflow | Lower operational risk |
| UX Pattern Reuse | Conversion lift | Promote pattern to UX library | Faster high-quality interfaces |
| API Instability | Failures, rate limits, auth issues | Flag API and require fallback | Safer integrations |
| Debt Surfacing | Score drop, duplication, fragile modules | Create refactor task | Lower future change cost |
| Bug Prevention | Repeated root cause | Add gate, test or checklist | Fewer regressions |
| Launch Quality | Release result and incidents | Update release checklist | Safer releases |
| Token Efficiency | Cost and prompt metrics | Compress context and improve prompts | Lower AI spend |

## Promotion Criteria
| Artifact | Promotion Requirement |
| --- | --- |
| Prompt | Repeated success or high-impact validated result |
| UX Pattern | Measured conversion/usability improvement |
| Code System | Clear contract, reuse demand and ownership |
| Automation | Idempotent, observable, retryable and documented |
| Quality Gate | Prevents a real or high-severity failure |
| Revenue Playbook | Validated commercial signal |

## Deprecation Criteria
Deprecate when:
- workflow fails repeatedly;
- prompt produces low-confidence or bloated outputs;
- API becomes unstable without fallback;
- pattern causes measurable UX or performance regression;
- documentation conflicts with source of truth;
- automation creates risk greater than manual execution.

## Continuous Improvement Cadence
| Cadence | Review |
| --- | --- |
| Per task | Outcome, tokens, confidence, memory writes |
| Per release | Gates, incidents, rollback readiness, docs |
| Weekly portfolio | Scores, blockers, experiments, automation gaps |
| Monthly factory | Patterns promoted, workflows deprecated, cost trend |
| Quarterly strategy | Revenue focus, platform architecture, governance maturity |

## Prevention Rule Lifecycle
1. Incident or repeated failure detected.
2. Root cause verified.
3. Prevention rule drafted.
4. Quality gate or automation updated.
5. Rule is tested against the original failure.
6. Knowledge Graph links incident to prevention.
7. Rule is reviewed after future false positives.

## Learning Quality Gates
Learning is incomplete unless:
- source artifact is linked;
- decision or lesson is compact;
- owner is assigned;
- reuse conditions are clear;
- expiration or review date exists for unstable domains;
- downstream docs or gates are updated when needed.

## Operational Excellence Metrics
| Metric | Desired Direction |
| --- | --- |
| Repeated bug rate | Down |
| Prompt reuse rate | Up |
| Token cost per accepted deliverable | Down |
| Release blocker discovery before deploy | Up |
| Post-release incident rate | Down |
| Automation success rate | Up |
| Documentation drift | Down |
| Revenue experiment cycle time | Down |
