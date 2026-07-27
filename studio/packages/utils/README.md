# Utils Package

## Purpose
Small pure utilities shared across runtime packages.

## Architecture
Utilities must be dependency-light and side-effect free.

## Runtime Flow
Support formatting, IDs, date handling and deterministic helpers.

## Integration Points
Packages and services.

## Scaling Considerations
Avoid becoming a mixed responsibility dumping ground.

## Debugging Instructions
Require tests for every utility before promotion.

## Validation Rules
No provider, file system or network behavior.

## Failure Scenarios
Ambiguous utilities stay local to their owning service.

## Future Extensibility
Add only proven repeated helpers.
