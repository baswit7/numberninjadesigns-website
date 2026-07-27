# Architecture

## Project Type

Automation.

## Recommended Shape

- Start with a local script or checklist only after the manual flow is documented.
- Make inputs and outputs explicit.
- Keep operations idempotent where practical.
- Add logging before expanding scope.

## Boundaries

- This template does not add schedulers.
- This template does not add workers or queues.
- This template does not call external providers.
- This template does not store credentials.
- This template does not add deployment automation.

## Reliability Defaults

- Validate inputs before writing outputs.
- Prefer dry-run modes when scripts are added.
- Keep recovery instructions close to the workflow.
