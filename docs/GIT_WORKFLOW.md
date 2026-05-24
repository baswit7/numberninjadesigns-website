# Git Delivery Workflow

## Branch Policy

`main` is the publishable baseline. Create one short-lived branch for one
logical change:

| Prefix | Use |
| --- | --- |
| `feature/` | New user-visible or architectural capability |
| `bugfix/` | Correctness or integration defect |
| `performance/` | Measured performance improvement |
| `hotfix/` | Urgent production correction |
| `experimental/` | Time-boxed investigation not intended for direct release |

## Commit Policy

Use `type(scope): short summary`, for example:

```text
feat(core): establish public site runtime
fix(oauth): preserve callback status handling
perf(assets): reduce landing image payload
docs(architecture): define automation service boundary
```

A commit should be reviewable as one coherent reason for change and must not
include credentials, local generated debris or unrelated refactors.

## Verification Gate

Before a change can enter `main`:

1. Confirm `git status` contains only intended files.
2. Review public URL compatibility for changed verification/callback paths.
3. Validate modified pages on narrow and desktop viewports.
4. Validate keyboard/focus behaviour for interactive UI changes.
5. Inspect repository changes for secrets, tokens and private data.
6. Update architecture, changelog or known issues where behaviour or risk has
   changed.

## Release Boundary

Public GitHub Pages content and protected automation/API services are separate
delivery boundaries. A static-site merge must not be used as a mechanism for
shipping secret-dependent integration behaviour.
