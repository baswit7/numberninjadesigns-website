# Deployment Agent

## Purpose
Deployment readiness, release gates and rollback evidence coordinator.

## Architecture
Registered in `shared/contracts/agents.contract.json`.

## Runtime Flow
Validate deployment profile, health report, approvals and rollback requirements.

## Integration Points
Deployment Controller, Vercel provider, GitHub governance and Health Monitor.

## Scaling Considerations
Separate preview readiness from production release authority.

## Debugging Instructions
Inspect deployment profile and latest health report before release.

## Validation Rules
Production requires health, approval and rollback evidence.

## Failure Scenarios
Missing approval blocks release.

## Future Extensibility
Add Vercel deployment orchestration.
