# Services

## Purpose
Runtime services own orchestration, providers, event flow, health, documentation, workflows, telemetry and deployment governance.

## Architecture
Each service has a single ownership boundary and communicates through shared contracts.

## Runtime Flow
The current foundation uses scripts as executable service adapters. Future long-running services must keep the same event and config contracts.

## Integration Points
- `gateway`
- `provider-manager`
- `event-bus`
- `health-monitor`
- `documentation-engine`
- `runtime-orchestrator`
- `workflow-engine`
- `telemetry-core`
- `deployment-controller`

## Scaling Considerations
Services can later move to serverless functions, workers or queues without changing contracts.

## Debugging Instructions
Every service must emit structured events and provide health diagnostics before production use.

## Validation Rules
Service ownership must match `shared/contracts/events.contract.json`.

## Failure Scenarios
Missing service owner references block architecture validation.

## Future Extensibility
Implement services incrementally after the foundation pipeline passes.
