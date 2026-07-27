# Anti-Magic Rules

## Purpose

Operational Intelligence must be documented, traceable, configurable and explainable. A dashboard user must understand why a score exists without reading source code.

## Forbidden

- hardcoded thresholds without a documented source
- hidden scoring logic
- undocumented weights
- magic numbers
- implicit penalties
- AI-generated judgments without deterministic evidence

## Required Threshold Metadata

Every threshold must identify:

- source
- purpose
- impact
- owning view or engine

## Current Deterministic Thresholds

| Threshold | Source | Purpose | Impact |
| --- | --- | --- | --- |
| Health score weights: runtime 25, projects 15, documentation 15, contracts 15, providers 10, telemetry 10, deployments 5, events 5 | Phase 5 Operational Intelligence scoring model | Calculate Studio Health Score from dashboard views | Higher weights increase contribution to final score. |
| Status penalties: success 0, info 0.15, warning 0.45, unknown 0.55, error 1 | Phase 5 Operational Intelligence scoring model | Convert status quality into component score | Higher penalty lowers component score. |
| Health classification: Elite >= 90, Healthy >= 75, Attention Required >= 60, At Risk >= 40, Critical < 40 | Phase 5 Operational Intelligence scoring model | Convert health score into executive classification | Drives health summary language and action hint. |
| Trend threshold: Studio Health +/- 2, other metrics +/- 0 | Phase 5 trend model | Prevent tiny Studio Health movement from becoming a trend | Determines Improving, Stable or Declining status. |
| Risk levels: LOW < 25, MEDIUM >= 25, HIGH >= 50, CRITICAL >= 75 | Phase 5 risk model | Convert risk score to operational risk level | Drives dashboard severity and executive summary. |
| Confidence levels: LOW < 3 snapshots, MEDIUM >= 3, HIGH >= 10, VERY HIGH >= 50 | Phase 5.1 confidence engine | Measure confidence from available history depth | Displays trust level for intelligence outputs. |
| Governance score weights: README 10, CHANGELOG 10, PROJECT_MASTER 10, Architecture 10, ADR 10, Technical Debt 10, Contracts 15, Security Docs 10, Release Docs 5, Documentation Completeness 10 | Phase 6 governance scoring model | Calculate governance score from platform standards | Higher weights increase contribution to governance classification. |
| Release readiness weights: Governance 25, Compliance 20, Risk 15, Confidence 10, Documentation 10, Technical Debt 10, Architecture Health 10 | Phase 6 release readiness model | Calculate release eligibility score | Converts governance state into release readiness classification. |
| Quality gate thresholds: Governance >= 75, Compliance PASS, Risk below CRITICAL, Confidence >= MEDIUM, Release Readiness >= 75 | Phase 6 quality gate model | Determine advisory release eligibility | Failed gates produce BLOCKED or WARNING with remediation. |
| Release readiness classification: Production Ready >= 90, Ready >= 75, Needs Attention >= 50, Not Ready < 50 | Phase 6 release readiness model | Convert readiness score into eligibility class | Drives Release Control Center status. |

## Change Rule

Changing any threshold requires:

1. an ADR or governance update
2. a contract update when output shape changes
3. a validation run
4. updated explainability output
