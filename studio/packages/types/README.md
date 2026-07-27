# Types Package

## Purpose
Shared type definitions for events, providers, workflows, telemetry and health.

## Architecture
Types derive from `shared/schemas` and `shared/contracts`.

## Runtime Flow
Services and apps consume consistent structures.

## Integration Points
All packages, services and apps.

## Scaling Considerations
Keep type changes versioned and backward compatible.

## Debugging Instructions
Validate runtime JSON against schemas before adding type wrappers.

## Validation Rules
No project-specific business types in this package.

## Failure Scenarios
Schema drift blocks validation.

## Future Extensibility
Add generated TypeScript types after runtime stack selection.
