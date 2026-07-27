# Deployment Controller

## Purpose
Central owner for deployment readiness, release gates and rollback requirements.

## Architecture
Deployment profiles are declared in `config/deployment.config.json`.

## Runtime Flow
Future deployment checks must consume health reports, branch state and approval evidence before calling Vercel.

## Integration Points
Uses health monitor, GitHub governance and Vercel provider status.

## Scaling Considerations
Keep deployment orchestration separate from app code and business features.

## Debugging Instructions
Inspect deployment profile requirements and latest health report before release.

## Validation Rules
Production requires branch protection, health report, manual approval and rollback plan.

## Failure Scenarios
Missing approval or failed health blocks release.

## Future Extensibility
Add Vercel preview promotion, rollback ledger and deployment event subscriptions.
