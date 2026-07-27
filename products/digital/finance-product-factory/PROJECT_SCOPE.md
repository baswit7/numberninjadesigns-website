# Project scope

## Authorized repository

The canonical Git root is:

`C:\AI\Active\numberninjadesigns-os-integration-worktree`

The factory-owned subtree is `products/digital/finance-product-factory/`. It intentionally contains:

1. the Finance Product Factory application and production catalogs;
2. the preserved Etsy Intelligence Engine;
3. the preserved Listing Intelligence Engine;
4. repository-local contracts, tests, documentation, and release evidence.

## In scope

- Versioned product, locale, currency, and theme catalogs.
- Local XLSX generation, preview, validation, quality reporting, commercial packaging, and bounded batch production.
- Read-only intelligence adapters that do not affect workbook integrity.
- Tests, security controls, documentation, and evidence stored inside this repository.
- Validation workbooks only under designated repository output or evidence paths.

Changes must preserve the historical source artifacts and the independently testable intelligence modules unless an explicit task authorizes otherwise.

## Out of scope without separate authorization

- Backend services, databases, cloud storage, user accounts, authentication, telemetry, deployment, CI/CD, marketplace APIs, live publication, email, and payment processing.
- Global Codex, MCP, operating-system, root environment values or Studio configuration.
- Git remotes, history rewriting, repository reinitialization, commits, pushes, or deployment.
- Cross-repository writes.

The previous standalone factory, website, Studio OS and MVP folders are read-only migration sources. New factory work belongs only in the canonical subtree.

## Required preflight

Before mutation, confirm:

```powershell
git rev-parse --show-toplevel
git branch --show-current
git status --short
```

The resolved root must equal the canonical repository path and work must use a task branch. Existing user changes must be classified and preserved. Every planned factory write target must remain inside this subtree unless a broader NumberNinjaDesigns task explicitly authorizes another path.

## Release boundary

Structural XLSX validation, a quality score, or a local approval does not authorize publication. A commercial package may be `BLOCKED`, `DRAFT`, or `READY_FOR_REVIEW`; none of these states performs an external action. Native target evidence and a separate human release decision remain mandatory for any claim beyond local generation.
