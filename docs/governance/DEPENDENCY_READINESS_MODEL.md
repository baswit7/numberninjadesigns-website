# Dependency Readiness Model

Dependency readiness checks confirm that a future execution plan references compatible governance assets.

## Dependency Types

- `contract`
- `document`
- `configuration`
- `runtime-model`
- `governance-record`

## Status Values

- `satisfied`
- `missing`
- `incompatible`
- `blocked`
- `unknown`

Dependency checks are read-only evidence records. They cannot fetch remote resources or resolve provider state.
