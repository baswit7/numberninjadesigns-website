# Approval Engine

The approval engine models approval state for a future execution request.

## Inputs

- Execution request contract.
- Approval record contract.

## Outputs

- Human-readable approval state.
- Governance-only JSON records under `runtime/execution/approvals/`.

## Non-Goals

- No identity provider calls.
- No approval notification workflow.
- No automatic approval.
- No mutation outside governance output files.

