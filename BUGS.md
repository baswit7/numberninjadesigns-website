# Known Issues And Risks

Issues here are confirmed from the repository baseline on 2026-05-24. Priority
reflects production or platform-integration impact.

| ID | Priority | Area | Finding | Required resolution | Status |
| --- | --- | --- | --- | --- | --- |
| B-006 | Critical | Deployment | The supplied URL `https://numberninjatees.github.io/` returned HTTP 404 on 2026-05-24; the repository is currently served at `https://baswit7.github.io/numberninjatees.github.io/`. | Submit only the verified project URL to Pinterest, or establish and validate a separate controlled publication domain before changing reviewer URLs. | Mitigated in review documentation; domain decision open |
| B-001 | Critical | OAuth | Public callback pages, including `/pinterest/callback/`, cannot perform secure OAuth code exchange or token lifecycle management on GitHub Pages. | Define and deploy a protected OAuth/API flow before demonstrating active authenticated automation or seeking Standard production operation. | Open |
| B-002 | High | Privacy | The original `privacy.html` did not describe Pinterest purpose, credential handling, hosting or contact ownership. | New policy is implemented on the feature branch; verify the public deployed URL before Pinterest submission. | Mitigated pending deployment |
| B-003 | Medium | Verification | Two TikTok verification values each exist in a duplicated `(1)` filename as well as their canonical filename. | Confirm active provider verification records, then remove files not externally required in a dedicated change. | Open |
| B-004 | Medium | Web/SEO | The original `index.html` was a minimal verification message without business identity, mobile metadata, brand styling or review navigation. | Responsive company homepage is implemented on the feature branch; verify GitHub Pages publication and performance. | Mitigated pending deployment |
| B-005 | Medium | Delivery | The repository exposes public integration URLs but contains no automated endpoint, HTML or secret-leak validation. | Add lightweight CI validation once the endpoint contract is documented. | Open |

## Handling Rules

- Do not fix provider path or policy issues by silently deleting/changing public
  resources; validate external dependencies first.
- Close an issue only in the same reviewed change that implements and verifies
  its resolution.
