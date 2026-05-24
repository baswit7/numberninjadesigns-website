# Known Issues And Risks

Issues here are confirmed from the repository baseline on 2026-05-24. Priority
reflects production or platform-integration impact.

| ID | Priority | Area | Finding | Required resolution | Status |
| --- | --- | --- | --- | --- | --- |
| B-001 | Critical | OAuth | `tiktok/callback/index.html` is only a static information page; it cannot perform secure OAuth code exchange or token lifecycle management. | Define and deploy a secure server-side OAuth flow before treating TikTok automation as connected. | Open |
| B-002 | High | Privacy | `privacy.html` does not describe retention, deletion, revocation, provider-specific processing or complete contact/legal handling required for mature integrations. | Align the policy with selected provider scopes and reviewed data-processing behaviour. | Open |
| B-003 | Medium | Verification | Two TikTok verification values each exist in a duplicated `(1)` filename as well as their canonical filename. | Confirm active provider verification records, then remove files not externally required in a dedicated change. | Open |
| B-004 | Medium | Web/SEO | `index.html` is a minimal verification message without mobile metadata, brand styling, trust content or SEO/social metadata. | Replace it with a measured mobile-first public landing page while preserving integration endpoints. | Open |
| B-005 | Medium | Delivery | The repository exposes public integration URLs but contains no automated endpoint, HTML or secret-leak validation. | Add lightweight CI validation once the endpoint contract is documented. | Open |

## Handling Rules

- Do not fix provider path or policy issues by silently deleting/changing public
  resources; validate external dependencies first.
- Close an issue only in the same reviewed change that implements and verifies
  its resolution.
