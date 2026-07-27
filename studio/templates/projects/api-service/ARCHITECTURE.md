# Architecture

## Project Type

API service.

## Recommended Shape

- Contract-first endpoint design.
- Small handlers grouped by domain.
- Explicit input validation and error responses.
- Configuration through environment variable names only.

## Boundaries

- This template does not call providers.
- This template does not validate credentials.
- This template does not store secrets.
- This template does not include deployment automation, workers, queues, schedulers, or background services.

## Performance Defaults

- Keep request parsing strict.
- Cache only documented read-heavy data.
- Rate limits and retries should be designed when real consumers exist.
