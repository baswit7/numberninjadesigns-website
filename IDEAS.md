# Improvement Candidates

These are scoped product and engineering opportunities, not committed
functionality. They should become isolated branches only after prioritization.

| Priority | Candidate | Value | Architectural constraint |
| --- | --- | --- | --- |
| 1 | Premium public landing page | Establishes trust and brand conversion surface instead of a bare verification host | Static, fast, accessible and does not disrupt platform paths |
| 2 | Integration-grade privacy and connection disclosure | Supports platform review and customer trust | Must match implemented scopes and retention/deletion behaviour |
| 3 | Endpoint validation workflow | Prevents accidental breakage of verification and callback URLs | Lightweight CI appropriate for static hosting |
| 4 | Secure social automation service | Enables scheduling, publishing and analytics safely | Separate protected deployable; no browser-stored provider tokens |
| 5 | TikTok Creator Search Insights content pipeline | Improves content discovery and SEO targeting | Requires compliant provider access and measurable data model |
| 6 | Engagement and product-content scoring | Informs Etsy/design promotion decisions | Requires normalized analytics and audit-ready reporting |

## Evaluation Criteria

Select work by expected conversion or operational value, provider/compliance
risk, implementation cost, performance impact and ability to verify results.
