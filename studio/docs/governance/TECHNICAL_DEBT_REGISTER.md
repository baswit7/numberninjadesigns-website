# Technical Debt Register

No undocumented technical debt is allowed. Any accepted compromise must be recorded here before release.

| ID | Description | Reason | Impact | Risk | Removal Strategy | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TD-001 | Dashboard JSON is loaded through browser `fetch`, so double-click local file use may require importing JSON files manually in some browsers. | The dashboard remains framework-free and avoids a local server requirement. | Direct reload may be blocked by browser file restrictions. | Low; import fallback is built into the UI. | Keep import flow; evaluate a signed local viewer only if enterprise distribution requires it. | Medium | Accepted |
| TD-002 | Contract validation checks top-level structure rather than full JSON Schema compliance. | Phase 5.1 is contract-first and avoids adding dependencies. | Invalid nested contract details could pass basic validation. | Medium. | Add native schema validation in a future governance phase after schema runtime policy is approved. | High | Open |
| TD-003 | Confidence thresholds are deterministic but based on snapshot count only. | The phase forbids AI inference and new intelligence features. | Confidence measures data depth, not semantic correctness. | Low. | Extend confidence contracts later with data freshness and source coverage after governance approval. | Medium | Accepted |
