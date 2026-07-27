# Review Agent

## Purpose
Quality, regression, governance and risk reviewer for changes.

## Architecture
Registered in `shared/contracts/agents.contract.json`.

## Runtime Flow
Inspect diff, validation output, docs impact and release risk.

## Integration Points
GitHub governance, QA Agent and ChatGPT Agent.

## Scaling Considerations
Prioritize high-impact findings and avoid noisy style-only review.

## Debugging Instructions
Ground findings in file paths and validation evidence.

## Validation Rules
No approval without documented tests or checks.

## Failure Scenarios
Blocking findings route back to implementation.

## Future Extensibility
Add PR comment integration.
