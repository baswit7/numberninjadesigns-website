# Studio OS Frontend Architecture

## Purpose
The Studio OS frontend is a professional command cockpit for AI-native operations. It must feel closer to Linear, OpenAI, Vercel, Stripe and Cursor than to a traditional admin panel: dense, fast, operational, calm and decision-oriented.

## Frontend Topology
```text
apps/studio-os
|-- shell
|-- command-palette
|-- global-status-bar
|-- navigation-rail
|-- resource-inspector
`-- settings

apps/command-center
|-- portfolio-overview
|-- live-activity-stream
|-- score-grid
|-- escalation-queue
`-- operating-map

apps/project-control
|-- project-cockpit
|-- execution-lanes
|-- readiness-panel
|-- risk-ledger
`-- artifact-index

apps/agent-runtime
|-- agent-console
|-- task-queue
|-- context-viewer
|-- handoff-timeline
`-- review-pipeline
```

Shared UI lives under `shared/ui` and provides primitives, not business ownership.

## Current Entrypoints
| Path | Role |
| --- | --- |
| `apps/command-center/index.html` | Primary production entrypoint for Bas: Command Center, Project Cockpit, Agent Workbench and API Command Center. |
| `apps/studio-dashboard/index.html` | Technical Center only: runtime, governance, authority, evidence, monitoring and diagnostics. |
| `apps/public-site/index.html` | Public website surface. It is not the Studio OS operating cockpit. |

Vercel routing is intentionally unchanged in this phase. Connecting `/app` or the root route to `apps/command-center` is a separate deployment/routing task.

## Primary Interfaces
| Interface | Purpose | Primary Decisions |
| --- | --- | --- |
| Main Command Center | Portfolio operating view | What needs attention now |
| Project Cockpit | Single-project execution control | What moves, blocks or launches |
| AI Agent Console | Agent tasks, state, confidence and review | Which agent owns the next action |
| Live Activity Stream | Real-time event and signal feed | What changed and why |
| Revenue Intelligence Dashboard | Revenue potential, experiments, channels | Where effort creates money fastest |
| Launch Readiness Dashboard | Gate state and launch blockers | Ship, hold or remediate |
| AI Telemetry Dashboard | Tokens, quality, cost, retries, model outcomes | Optimize or escalate |
| Prompt Vault | Prompt blocks, versions, outcomes | Reuse, revise or deprecate |
| Knowledge Graph Explorer | Patterns, failures, decisions, dependencies | What intelligence should propagate |
| API Control Center | API health, owners, auth, rate limits | Stable, degraded or blocked |
| Automation Control | Runbooks, schedules, retries, status | Run, pause, approve or recover |
| Release Center | Release records, approvals, rollback | Approve, reject, observe |
| Incident Center | Active incidents, root cause, timeline | Mitigate, assign, prevent |
| Scaling Monitor | cost, latency, volume, complexity | Scale now or defer |
| Token Intelligence Dashboard | budgets, context reuse, waste, compression | Reduce cost and improve velocity |

## Layout System
The desktop layout uses a persistent four-zone cockpit:

```text
left rail       global navigation, app switcher, status
top command     search, command palette, current context, account
center canvas   main operational surface
right inspector selected resource, actions, evidence, timeline
```

Mobile collapses into:
- top status bar;
- searchable command launcher;
- tabbed content sections;
- bottom action sheet for resource actions;
- inspector as full-screen drawer.

## Visual Hierarchy
| Layer | Treatment |
| --- | --- |
| Critical signals | high contrast, persistent, actionable |
| Active workflow state | center canvas priority |
| Scores | compact numeric cards with trend and confidence |
| Evidence | inspector-side, expandable, timestamped |
| Secondary context | muted, collapsed by default |
| Historical noise | searchable, not dominant |

## Component System
| Component | Responsibility |
| --- | --- |
| `StatusDot` | connected, degraded, blocked, running, paused |
| `ScoreCell` | value, trend, confidence, freshness, threshold state |
| `SignalRow` | severity, source, owner, age, action |
| `CommandBar` | global search, commands, quick resource switching |
| `ResourceInspector` | selected entity metadata, actions, event timeline |
| `GateMatrix` | release, security, UX, docs, telemetry and revenue gate state |
| `AgentTaskCard` | objective, context scope, confidence, cost, review route |
| `EventStream` | live activity with filtering, grouping and correlation IDs |
| `RunbookControl` | run, dry-run, pause, retry, rollback and audit status |
| `KnowledgeNode` | memory item, evidence, reuse count, aging and score |

## UI States
| State | Required UX |
| --- | --- |
| Loading | skeleton with stable layout, no layout shift |
| Empty | explain missing source and next setup action |
| Degraded | orange status, stale data label, fallback view |
| Error | red status, clear cause, retry and diagnostics |
| Reconnecting | visible reconnecting state and last good data |
| Blocked | action disabled with gate reason and owner |
| Live | green connected state, freshness timestamp |
| Review required | explicit reviewer and required evidence |

## Interaction Philosophy
- Command palette first: every major action is searchable.
- Drilldown without losing context: inspector opens beside the cockpit.
- Evidence before action: destructive or launch actions show gate evidence.
- Dense by default, expandable on demand.
- Keyboard-friendly for repeat operators.
- All status changes show source, timestamp and confidence.
- AI recommendations are labeled as recommendations, not facts.

## Responsive Strategy
| Breakpoint | Behavior |
| --- | --- |
| Small mobile | Single-column, bottom navigation, inspector drawer |
| Large mobile | Two stacked panels, sticky status and primary actions |
| Tablet | Navigation rail plus content, inspector overlays |
| Desktop | Full cockpit with rail, command bar, canvas and inspector |
| Wide desktop | Canvas can split into dashboard plus stream or graph |

## Frontend Performance Rules
- Use virtualized lists for activity streams, events, prompts and memory nodes.
- Keep score cards stable with fixed dimensions.
- Prefer derived view models over repeated heavy client calculations.
- Cache last good telemetry view locally with freshness warnings.
- Lazy-load graph explorer, incident timelines and historical analytics.
- Avoid animation on high-frequency live updates; use subtle state transitions.
- No blocking render on optional telemetry panels.

## Accessibility And Ergonomics
- Status must not depend on color alone.
- Every icon button has accessible label and tooltip.
- Critical actions require confirmation and show impact.
- Tables support keyboard navigation and sorting.
- Live updates never steal focus.
- Motion respects reduced-motion settings.

## Navigation Flow
```text
Command Center
  -> Project Cockpit
  -> Agent Console / Release Center / Knowledge Graph
  -> Resource Inspector
  -> Action confirmation
  -> Event + audit record
```

The frontend succeeds when an operator can answer in under 30 seconds:
- what is broken;
- what is blocked;
- what is ready to ship;
- what produces revenue;
- which agent owns the next move;
- which knowledge should be reused.
