# Architecture

## Project Type

Dashboard.

## Recommended Shape

- Read-only views over existing metadata.
- No local edits to source data.
- Simple file or static data adapter before any heavier architecture.
- Clear empty, stale, and unavailable states.

## Boundaries

- The dashboard is not a source of truth.
- This template does not add execution, approval, provider, deployment, queue, worker, scheduler, or secret capability.

## Performance Defaults

- Precompute or cache derived display data when the source grows.
- Keep rendering incremental and predictable.
- Avoid polling unless a concrete current need exists.
