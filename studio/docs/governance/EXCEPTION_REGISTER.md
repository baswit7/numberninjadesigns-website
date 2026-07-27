# Exception Register

Approved exceptions are temporary and scoped. Governance respects active approved exceptions. Expired exceptions become violations.

| ID | Status | Scope | Approver | Expiration Date | Reason | Impact |
| --- | --- | --- | --- | --- | --- | --- |
| EX-000 | none | platform | n/a | 2099-12-31 | No active governance exceptions are approved. | None. |

## Rules

- `Status` must be `approved`, `expired`, `rejected` or `none`.
- `Expiration Date` must use `YYYY-MM-DD`.
- Approved exceptions are valid only before or on the expiration date.
- Expired approved exceptions are governance violations.
- Exceptions cannot grant execution authority.
