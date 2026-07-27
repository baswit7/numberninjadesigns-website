# Studio OS UI System

## Purpose
The Studio OS UI system defines the visual and interaction language for an AI-native command center. It prioritizes operational clarity, high-density information, fast decision loops and premium engineering aesthetics.

## Design Principles
- Dark, precise, tactical and calm.
- Dense information without visual clutter.
- Status is always visible.
- Actions are evidence-backed.
- AI recommendations are explainable.
- Live systems show freshness and confidence.
- Mobile remains usable for review, approval and incident response.

## Visual Tokens
| Token | Value |
| --- | --- |
| `color.bg` | `#070707` |
| `color.surface` | `#0F0F0F` |
| `color.surfaceRaised` | `#161616` |
| `color.accent` | `#00FF94` |
| `color.text` | `#EDEBE3` |
| `color.muted` | `#777777` |
| `color.warning` | `#FFB020` |
| `color.danger` | `#FF4D4D` |
| `color.info` | `#67A7FF` |
| `radius.card` | `8px` |
| `radius.control` | `6px` |

Typography:
- display: Orbitron for rare high-impact identifiers;
- mono: JetBrains Mono for metrics, IDs, event types and technical controls;
- condensed: Bebas Neue only for brand-level labels, not dense UI body text.

## Component Categories
| Category | Components |
| --- | --- |
| Navigation | rail, app switcher, breadcrumb, command palette |
| Status | status dot, connection bar, freshness badge, confidence badge |
| Data | score cell, metric strip, event row, signal table, trend sparkline |
| Control | icon button, segmented control, switch, slider, menu, confirmation dialog |
| Workflow | stage rail, gate matrix, task card, review queue, blocker banner |
| Agent | agent card, handoff timeline, context scope viewer, token meter |
| Knowledge | graph node, memory card, recommendation row, evidence drawer |
| Release | release checklist, rollback panel, incident link, observation timer |

## State Colors
| State | Visual |
| --- | --- |
| Connected | green accent dot and freshness timestamp |
| Reconnecting | warning dot and animated but subtle pulse |
| Error | danger dot and recovery action |
| Blocked | danger border and required owner |
| Warning | amber indicator and recommended action |
| Paused | muted status and resume permission |
| Running | accent indicator and progress label |
| Review | info indicator and reviewer name |

## Layout Rules
- No nested cards.
- Page sections are full-width bands or unframed layouts.
- Cards are for repeated records, not page containers.
- Fixed-format controls use stable dimensions to prevent layout shift.
- Metrics use monospace numerals.
- Graph and telemetry panels must show loading, empty, stale and error states.
- Command actions stay close to selected resource context.

## Main Screens
### Main Command Center
Three-column cockpit:
- left: project and app navigation;
- center: score grid, active signals, operating map;
- right: inspector with selected signal, owner, timeline and actions.

### Project Cockpit
Primary bands:
- project status and objective;
- execution lanes;
- readiness gates;
- active agent tasks;
- revenue and launch risks;
- artifact index.

### AI Agent Console
Primary bands:
- queue by priority and confidence;
- active execution;
- handoffs;
- review pipeline;
- token and correction telemetry.

### Revenue Intelligence
Primary bands:
- revenue potential score;
- channel experiments;
- conversion signals;
- pricing hypotheses;
- opportunity queue;
- kill/scale recommendations.

### Launch Readiness
Primary bands:
- readiness score;
- gate matrix;
- open blockers;
- rollback plan;
- observation window;
- approval history.

### Token Intelligence
Primary bands:
- token spend by project and agent;
- context waste;
- prompt reuse;
- compression candidates;
- budget breaches;
- cost-to-outcome view.

## Interaction Patterns
| Pattern | Rule |
| --- | --- |
| Command palette | available everywhere |
| Inspector | opens for any resource, never hides main state on desktop |
| Confirmation | required for release, rollback, automation and integration actions |
| Filtering | event stream and tables support severity, project, owner and freshness |
| Sorting | scores and queues sort by urgency, value, risk or age |
| Drilldown | every score links to input snapshot |
| Recovery | every error state offers retry, diagnostics or fallback |

## Motion
- Use short, subtle transitions only for state changes.
- Avoid continuous decorative animation.
- Live updates should not move layout unexpectedly.
- Respect reduced-motion preferences.

## UI Quality Gates
Before implementation is accepted:
- no overflowing text on mobile or desktop;
- no overlapping controls;
- all critical statuses include text and icon;
- loading states preserve layout;
- error states show recovery action;
- keyboard navigation works for primary workflows;
- responsive views preserve operational priority;
- live updates remain readable.
