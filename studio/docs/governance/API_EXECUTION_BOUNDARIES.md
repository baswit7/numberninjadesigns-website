# API Execution Boundaries

## Purpose

This document defines the hard safety boundary for the Studio OS V2.3 API Execution Layer.

V2.3 is a planning, approval and audit layer only. It is not a provider executor.

## Allowed

- Define API execution request intent.
- Generate local API execution plans.
- Generate local audit reports.
- Generate local approval-state reports.
- Read provider metadata from API Center.
- Reference environment variable names.
- Validate providers, action types, execution states, approval rules, audit fields and forbidden capabilities.

## Forbidden

V2.3 must not add:

- actual API calls
- OpenAI execution
- GitHub API execution
- Telegram sending
- Notion writing
- Etsy actions
- TikTok publishing
- Pinterest publishing
- Instagram publishing
- Facebook publishing
- Vercel deployment
- credential storage
- secret storage
- OAuth flows
- token refresh
- background jobs
- workers
- queues
- schedulers
- autonomous execution
- AI Workforce runtime execution
- Software Factory
- paid spend execution
- content publication

## Secret Safety

The layer must not store or read:

- tokens
- API keys
- client secrets
- refresh tokens
- cookies
- `Bearer` authorization values
- personal credentials

Only environment variable names may appear in contracts, runtime reports and documentation.

## API Center Boundary

API Center remains the source for:

- provider names
- auth type
- scopes required
- required environment variable names
- provider documentation references
- known limitations

API Execution owns only:

- execution request intent
- approval reports
- audit reports
- boundary validation

## Failure Handling

| Failure | Result |
| --- | --- |
| Unknown provider | Validation failure |
| Provider missing from API Center | Validation failure |
| Unsupported action type | Validation failure |
| Unsupported execution state | Validation failure |
| Missing approval fields | Validation failure |
| Non-dry-run `EXECUTED` runtime item | Validation failure |
| Secret-like value | Validation failure |
| Provider call capability | Validation failure |
| Deployment capability | Validation failure |
| Worker, queue or scheduler capability | Validation failure |

## Final Boundary Verdict

The V2.3 API Execution Layer is safe only while it remains local, deterministic, provider-call-free, deployment-free, secret-free and human-gated. Live provider execution belongs to a later separately approved layer.
