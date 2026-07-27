# Packages

## Purpose
Shared runtime libraries will live here after contracts prove stable across services and apps.

## Architecture
Package boundaries are reserved for UI, config, logging, errors, events, auth, API clients, types, utilities, telemetry, runtime SDK and provider SDK.

## Runtime Flow
Current executable behavior is PowerShell-based. Future packages must preserve the existing JSON contracts and script outputs.

## Integration Points
Services and apps depend on packages; packages must not depend on apps.

## Scaling Considerations
Only promote code into packages when at least two runtime components need the same stable behavior.

## Debugging Instructions
Document package ownership, public API, failure modes and validation command before adding code.

## Validation Rules
No package may contain provider-specific secrets or project-specific business logic.

## Failure Scenarios
If a package grows mixed responsibilities, split by runtime boundary before adding dependents.

## Future Extensibility
Add typed SDKs after provider lifecycle, event bus and workflow contracts are proven.
