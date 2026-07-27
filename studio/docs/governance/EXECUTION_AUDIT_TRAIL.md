# Studio OS V2.8 Dispatch Audit Trail & Manual Evidence Gate

## Purpose

The Dispatch Audit Trail & Manual Evidence Gate creates immutable visibility into the governance chain that precedes any future execution consumer.

It answers:

- who supplied manual evidence
- when evidence was supplied
- why dispatch eligibility was granted, denied, blocked or unknown
- which authority source was used
- which evidence chain was reviewed
- whether manual evidence exists and was verified

V2.8 is read-only, derived and non-executing. It does not create execution capability.

## Inputs

The audit layer consumes existing runtime reports only:

- `runtime/execution-request/execution-request.packages.json`
- `runtime/approval/execution-approval.records.json`
- `runtime/execution-preflight/execution-preflight.decisions.json`
- `runtime/execution-review/execution-review.records.json`
- `runtime/execution-dispatch/execution-dispatch.registry.json`

The audit layer owns no upstream truth. It only derives audit reports from these sources.

## Outputs

The layer writes only to:

- `runtime/execution-audit/audit.report.json`
- `runtime/execution-audit/audit.summary.json`
- `runtime/execution-audit/audit.boundary.json`

## Audit Model

Every audit entry includes:

- `auditId`
- `timestamp`
- `sourceLayer`
- `decisionLayer`
- `decisionOutcome`
- `evidencePresent`
- `authoritySource`
- `reviewSource`
- `reviewOutcome`
- `dispatchEligible`
- `unknownState`
- `notes`
- `manualEvidenceRequired`
- `manualEvidencePresent`
- `manualEvidenceVerified`

The supported audit artifact types are:

- `AUDIT_ENTRY`
- `EVIDENCE_REFERENCE`
- `AUTHORITY_REFERENCE`
- `DECISION_TRACE`

## Manual Evidence Gate

Dispatch eligibility requires explicit manual evidence.

Rules:

- missing manual evidence means the audit outcome is `UNKNOWN`
- unknown evidence means the audit outcome is `UNKNOWN`
- missing manual evidence cannot become dispatch eligible
- unverified manual evidence cannot become `PASS`
- automatic approval is forbidden
- `PASS` does not execute anything

Current V2.8 runtime proof intentionally records no verified manual evidence, so dispatch eligibility remains zero.

## Unknown Handling

`UNKNOWN` is terminal for audit promotion until real manual evidence exists.

Rules:

- `UNKNOWN` never becomes `PASS`
- `UNKNOWN` never becomes `DISPATCH_ELIGIBLE`
- missing evidence produces `UNKNOWN`, not `PASS`
- unknown approval, request, preflight, review or dispatch state keeps the audit entry unknown

## Ownership

The audit layer owns:

- audit report generation
- manual evidence gate proof
- evidence-chain visibility
- boundary proof

The audit layer does not own:

- execution truth
- provider truth
- GitHub truth
- deployment truth
- approval truth
- request truth
- preflight truth
- review truth
- dispatch truth

## Validation

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-execution-audit.ps1
```

The validator checks contracts, required fields, derived outputs, unknown propagation, manual evidence enforcement, ownership boundaries and forbidden capability leakage.
