# Agents

## Purpose
Agent folders represent AI execution boundaries, not chat personas. Contracts live in `shared/contracts/agents.contract.json`.

## Architecture
Agents communicate through workflow state, events, validation hooks and documented handoffs.

## Runtime Flow
An agent receives bounded inputs, produces declared outputs and emits lifecycle events.

## Integration Points
Codex, ChatGPT, review, QA, documentation and deployment agents are all registered in the agent contract.

## Scaling Considerations
Agent autonomy stays disabled until validation, telemetry and governance gates are reliable.

## Debugging Instructions
Trace agent tasks through `agent.*` events and validation hook output.

## Validation Rules
Every registered agent must have a role, authority, inputs, outputs, events and validation hooks.

## Failure Scenarios
Blocked agents must emit a blocked event and required next evidence.

## Future Extensibility
Add agent-specific runbooks and context package formats.
