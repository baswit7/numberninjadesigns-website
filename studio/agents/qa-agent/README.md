# QA Agent

## Purpose
Validation and regression evidence producer for runtime and future apps.

## Architecture
Registered in `shared/contracts/agents.contract.json`.

## Runtime Flow
Run health, config, architecture and feature-specific checks.

## Integration Points
Health Monitor, Review Agent and Workflow Engine.

## Scaling Considerations
Keep checks deterministic and fast before adding broad suites.

## Debugging Instructions
Preserve exact command output and failing evidence.

## Validation Rules
No release without validation evidence.

## Failure Scenarios
Repeated failure blocks workflow for root-cause analysis.

## Future Extensibility
Add browser, API and deployment checks.
