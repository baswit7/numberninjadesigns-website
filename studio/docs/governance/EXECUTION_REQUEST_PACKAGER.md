# Studio OS V2.4 Execution Request Packager

The Execution Request Packager converts approval records into structured execution request packages for review by a future execution layer.

This layer is non-executing. It reads approval evidence from `runtime/approval/execution-approval.records.json` and writes request package evidence under `runtime/execution-request/`.

## What It Can Do

- Package approval records into machine-readable execution request packages.
- Preserve the source approval id, approval state, requested action, target system and risk classification.
- Add required evidence, required validators, denied action types and an execution readiness state.
- Produce audit and report files for governance review.

## Readiness Model

Allowed readiness states:

- `UNKNOWN`
- `BLOCKED`
- `PACKAGED`
- `READY_FOR_REVIEW`
- `REJECTED`

Packaging rules:

- `UNKNOWN` approval state never becomes `READY_FOR_REVIEW`.
- Unapproved actions become `BLOCKED`.
- Rejected actions become `REJECTED`.
- Approved actions become `READY_FOR_REVIEW`.
- No package dispatches execution.

## Evidence Model

Every package includes:

- request id
- source approval id
- approval state
- requested action
- target system
- allowed action type
- denied action types
- required evidence
- required validators
- risk classification
- execution readiness state
- result
- blockers

## Ownership

The packager owns execution request packages, request package audit records and package evidence.

It does not own approval truth, execution truth, provider truth, deployment truth, GitHub truth, or runtime truth outside `runtime/execution-request/`.
