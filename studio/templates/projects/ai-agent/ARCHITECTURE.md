# Architecture

## Project Type

AI agent.

## Recommended Shape

- Define task, context, tools, and evaluation separately.
- Start with prompt and fixture examples before adding tool access.
- Keep human decision points explicit.
- Keep provider configuration outside the repository.

## Boundaries

- This template does not add agent orchestration.
- This template does not call providers.
- This template does not store credentials.
- This template does not add approval engines, workers, queues, schedulers, or deployment automation.

## Quality Defaults

- Use small evaluation cases.
- Track failure modes.
- Prefer deterministic fixtures for early validation.
