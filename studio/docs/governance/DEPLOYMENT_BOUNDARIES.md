# Deployment Boundaries

## Purpose

This document defines the hard safety boundary for the Studio OS V2.4 Deployment Layer.

V2.4 is an offline deployment planning, approval and audit layer. It is not a deployment executor.

## Allowed

- Define deployment plans.
- Generate local deployment reports.
- Generate local deployment audit entries.
- Generate local approval reports.
- Validate deployment targets.
- Validate target environments.
- Validate rollback strategies.
- Validate approval state.
- Consume Project Templates, Portfolio Dashboard, GitHub Execution Layer and API Execution Layer context.

## Forbidden

V2.4 must not add:

- real deployments
- Vercel deployment
- GitHub Pages deployment
- GitHub Actions execution
- build execution
- hosting execution
- publishing
- credential storage
- secret storage
- workers
- queues
- schedulers
- background jobs
- autonomous deployment
- automatic rollback
- AI Workforce runtime execution
- Software Factory

## Secret Safety

The layer must not store or read:

- tokens
- API keys
- deployment credentials
- hosting credentials

Only environment variable names may appear.

## Failure Handling

| Failure | Result |
| --- | --- |
| Unsupported deployment target | Validation failure |
| Unsupported deployment type | Validation failure |
| Unsupported deployment state | Validation failure |
| Missing rollback strategy | Validation failure |
| Required human approval missing | Validation failure |
| Self-approval | Validation failure |
| Non-dry-run `EXECUTED` state | Validation failure |
| Secret-like value | Validation failure |
| Deployment command capability | Validation failure |
| Worker, queue or scheduler capability | Validation failure |

## Final Boundary Verdict

The Deployment Layer is safe only while it remains local, deterministic, deployment-free, build-free, secret-free and human-gated. Real deployment belongs to a later explicitly approved layer.
