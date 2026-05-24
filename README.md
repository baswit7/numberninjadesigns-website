# NumberNinjaTees Verification Host

Production repository for the public NumberNinjaTees web presence, platform
verification files, privacy disclosure, and OAuth redirect entry points.

## Current Public Endpoints

| Path | Purpose | Current implementation |
| --- | --- | --- |
| `/` | Public root and verification host landing page | Static HTML baseline |
| `/privacy.html` | Public privacy disclosure for integrations | Static HTML policy |
| `/tiktok/callback/` | TikTok OAuth redirect target | Static acknowledgement page |
| `/tiktok*.txt` | TikTok site ownership verification | Public token files |

No API credentials, OAuth client secrets, access tokens, or refresh tokens may
be committed to this repository.

## Repository Structure

| Directory | Responsibility |
| --- | --- |
| `core/` | Shared browser runtime, configuration and cross-feature utilities |
| `modules/` | User-facing features isolated by business capability |
| `api/` | API client contracts, authentication boundaries and resilience policy |
| `automation/` | Content and publishing automation design and jobs |
| `assets/` | Versioned visual and static presentation assets |
| `docs/` | Operational, delivery and integration documentation |
| `archive/` | Intentionally retired material retained for traceability |

See [MASTER_ARCHITECTURE.md](MASTER_ARCHITECTURE.md) for system boundaries and
[docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) for the delivery workflow.

## Delivery Rules

- `main` represents the publishable production baseline.
- Every change starts on a single-purpose branch such as `feature/*`,
  `bugfix/*`, `performance/*`, or `hotfix/*`.
- Commits use Conventional Commit style: `type(scope): short summary`.
- Public verification filenames and redirect paths are compatibility contracts.
  They are changed only after confirming the corresponding platform settings.

## Local Validation

This repository is deliberately deployable as static files without a build
tool. Before merging a website or integration change:

1. Open the affected HTML endpoint locally and validate responsive rendering.
2. Verify that public callback and verification paths still resolve.
3. Review changed files for exposed secrets or user data.
4. Update `CHANGELOG.md`, `BUGS.md`, and architecture documentation when their
   subject is affected.
