# Studio OS V2.9 Execution Control Dashboard Integration

## Purpose

The Execution Control Dashboard Integration exposes a unified read-only view over the execution governance chain.

It renders:

- request status
- approval status
- preflight status
- review status
- dispatch status
- audit status
- manual evidence status
- unknown state visibility
- boundary status

The dashboard is visibility only. It does not execute, dispatch, approve, reject or mutate runtime state.

## Sources

The projection consumes existing reports from:

- `runtime/execution-request/`
- `runtime/approval/`
- `runtime/execution-preflight/`
- `runtime/execution-review/`
- `runtime/execution-dispatch/`
- `runtime/execution-audit/`

The dashboard owns no source truth. Execution governance layers remain the only owners of their own records and decisions.

## Output

The projection writes:

- `runtime/dashboard/execution-control.view.json`

The generated view includes:

- `statusSummary`
- `auditSummary`
- `evidenceSummary`
- `unknownSummary`
- `boundarySummary`
- dashboard cards for request, approval, preflight, review, dispatch, audit and manual evidence status

## Required Metrics

The summary exposes:

- `totalRequests`
- `approvedRequests`
- `pendingRequests`
- `blockedRequests`
- `unknownRequests`
- `dispatchEligible`
- `dispatchDenied`
- `manualEvidenceRequired`
- `manualEvidencePresent`
- `manualEvidenceVerified`
- `unknownCount`

## Unknown Handling

The dashboard must display unknown states clearly.

Rules:

- `UNKNOWN` remains `UNKNOWN`
- `UNKNOWN` must never become `PASS`
- `UNKNOWN` must never become `APPROVED`
- `UNKNOWN` must never become `DISPATCH_ELIGIBLE`

The dashboard does not reinterpret unknown states into readiness.

## Ownership

The dashboard projection owns:

- visualization
- read-only count aggregation
- read-only status aggregation

The dashboard does not own:

- execution truth
- request truth
- approval truth
- preflight truth
- review truth
- dispatch truth
- audit truth
- provider truth
- GitHub truth
- deployment truth

## Validation

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-execution-dashboard.ps1
```

The validator verifies that the projection exists, consumes only reports, owns no truth, preserves unknown propagation, exposes required metrics and contains no action endpoints or execution controls.
