[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$errors = New-Object System.Collections.Generic.List[string]
$architectureConflicts = New-Object System.Collections.Generic.List[string]
$requiredDirectories = @(
    'apps',
    'packages',
    'services',
    'agents',
    'shared/schemas',
    'shared/contracts',
    'shared/contracts/coordination',
    'shared/contracts/execution',
    'config',
    'docs/coordination',
    'docs/runtime',
    'docs/governance',
    'scripts/validation',
    'scripts/health',
    'scripts/documentation',
    'scripts/events',
    'scripts/telemetry'
)

$requiredCanonicalDocs = @(
    'docs/runtime/EXECUTABLE_FOUNDATION.md',
    'docs/runtime/RUNTIME_CONSOLE.md',
    'docs/PROJECT_GOVERNANCE.md',
    'docs/AI_WORKFLOW_SYSTEM.md',
    'docs/STUDIO_OS_EVENT_SYSTEM.md',
    'docs/adr/ADR-005-NO-PROVIDER-DEPENDENCIES.md',
    'services/provider-manager/README.md',
    'services/workflow-engine/README.md',
    'config/providers.config.json',
    'shared/schemas/provider.schema.json',
    'shared/contracts/workflow.contract.json'
)

$phase8RequiredPaths = @(
    'shared/contracts/coordination/agent-registry.schema.json',
    'shared/contracts/coordination/workflow-registry.schema.json',
    'shared/contracts/coordination/coordination-request.schema.json',
    'shared/contracts/coordination/coordination-graph.schema.json',
    'shared/contracts/coordination/coordination-report.schema.json',
    'shared/contracts/coordination/coordination-health.schema.json',
    'services/coordination/agent-registry.json',
    'services/coordination/workflow-registry.json',
    'services/coordination/coordination-request.example.json',
    'services/coordination/generate-coordination-graph.ps1',
    'scripts/validation/validate-coordination-contracts.ps1',
    'scripts/validation/validate-agent-registry.ps1',
    'scripts/validation/validate-workflow-registry.ps1',
    'scripts/validation/validate-coordination-graph.ps1',
    'scripts/validation/validate-coordination-negative-tests.ps1',
    'docs/coordination/AI_COORDINATION_LAYER.md',
    'docs/governance/PHASE_8_SAFETY_BOUNDARY.md',
    'docs/governance/PHASE_8_COMPATIBILITY_REPORT.md',
    'docs/governance/PHASE_8_IMPLEMENTATION_REPORT.md'
)

$phase9RequiredPaths = @(
    'shared/contracts/execution/execution-request.schema.json',
    'shared/contracts/execution/approval-record.schema.json',
    'shared/contracts/execution/risk-assessment.schema.json',
    'shared/contracts/execution/rollback-plan.schema.json',
    'shared/contracts/execution/execution-policy.schema.json',
    'shared/contracts/execution/idempotency-record.schema.json',
    'services/execution-governance/README.md',
    'services/execution-governance/execution-request.example.json',
    'services/execution-governance/approval-engine/approval-registry.json',
    'services/execution-governance/risk-engine/risk-assessments.json',
    'services/execution-governance/rollback-engine/rollback-plans.json',
    'services/execution-governance/idempotency-engine/idempotency-records.json',
    'services/execution-governance/execution-policy-engine/execution-policies.json',
    'scripts/validation/validate-execution-contracts.ps1',
    'scripts/validation/validate-approval-registry.ps1',
    'scripts/validation/validate-rollback-plans.ps1',
    'scripts/validation/validate-idempotency-records.ps1',
    'docs/governance/PHASE_9_EXECUTION_GOVERNANCE.md',
    'docs/governance/EXECUTION_BOUNDARY.md',
    'docs/governance/APPROVAL_PROTOCOL.md',
    'docs/governance/ROLLBACK_STRATEGY.md',
    'docs/governance/IDEMPOTENCY_MODEL.md',
    'docs/governance/EXECUTION_RISK_MODEL.md',
    'docs/governance/PHASE_9_IMPLEMENTATION_REPORT.md',
    'docs/governance/PHASE_9_COMPATIBILITY_REPORT.md',
    'docs/governance/PHASE_9_BOUNDARY_AUDIT.md'
)

foreach ($directory in $requiredDirectories) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $directory) -PathType Container)) {
        $errors.Add("Required architecture directory missing: $directory") | Out-Null
    }
}

foreach ($document in $requiredCanonicalDocs) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $document) -PathType Leaf)) {
        $errors.Add("Required canonical architecture document missing: $document") | Out-Null
    }
}

foreach ($relativePath in $phase8RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 8 coordination artifact missing: $relativePath") | Out-Null
    }
}

foreach ($relativePath in $phase9RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 9 execution governance artifact missing: $relativePath") | Out-Null
    }
}


$phase10RequiredPaths = @(
    'shared/contracts/readiness/execution-plan.schema.json',
    'shared/contracts/readiness/execution-step.schema.json',
    'shared/contracts/readiness/dependency-check.schema.json',
    'shared/contracts/readiness/preflight-check.schema.json',
    'shared/contracts/readiness/approval-chain.schema.json',
    'shared/contracts/readiness/readiness-decision.schema.json',
    'shared/contracts/readiness/readiness-report.schema.json',
    'services/execution-readiness/README.md',
    'services/execution-readiness/preflight-engine/README.md',
    'services/execution-readiness/dependency-engine/README.md',
    'services/execution-readiness/approval-chain-engine/README.md',
    'services/execution-readiness/rollback-readiness-engine/README.md',
    'services/execution-readiness/idempotency-readiness-engine/README.md',
    'services/execution-readiness/readiness-policy-engine/README.md',
    'runtime/readiness/execution-plan.sample.json',
    'runtime/readiness/readiness-report.sample.json',
    'scripts/validation/validate-readiness-contracts.ps1',
    'scripts/validation/validate-execution-plans.ps1',
    'scripts/validation/validate-preflight-checks.ps1',
    'scripts/validation/validate-approval-chains.ps1',
    'scripts/validation/validate-readiness-boundaries.ps1',
    'docs/governance/PHASE_10_EXECUTION_READINESS.md',
    'docs/governance/EXECUTION_READINESS_BOUNDARY.md',
    'docs/governance/PREFLIGHT_MODEL.md',
    'docs/governance/DEPENDENCY_READINESS_MODEL.md',
    'docs/governance/APPROVAL_CHAIN_READINESS.md',
    'docs/governance/PHASE_10_COMPATIBILITY_REPORT.md',
    'docs/governance/PHASE_10_BOUNDARY_AUDIT.md',
    'docs/governance/PHASE_10_IMPLEMENTATION_REPORT.md'
)
foreach ($relativePath in $phase10RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 10 execution readiness artifact missing: $relativePath") | Out-Null
    }
}

$phase11RequiredPaths = @(
    'apps/studio-dashboard/dashboard-adapter.ps1',
    'apps/studio-dashboard/index.html',
    'apps/studio-dashboard/js/dashboard-loader.js',
    'apps/studio-dashboard/js/dashboard-state.js',
    'apps/studio-dashboard/js/dashboard-renderers.js',
    'apps/studio-dashboard/js/dashboard.js',
    'docs/governance/PHASE_11_READINESS_DASHBOARD_CENTER.md',
    'docs/runtime/RUNTIME_DASHBOARD_ADAPTER.md',
    'docs/runtime/VISUAL_RUNTIME_DASHBOARD.md'
)
foreach ($relativePath in $phase11RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 11 readiness dashboard artifact missing: $relativePath") | Out-Null
    }
}

$phase12RequiredPaths = @(
    'docs/governance/DASHBOARD_RUNTIME_BOUNDARY.md',
    'docs/governance/PHASE_12_DASHBOARD_RUNTIME_BOUNDARY_DESIGN.md'
)
foreach ($relativePath in $phase12RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 12 dashboard runtime boundary artifact missing: $relativePath") | Out-Null
    }
}

$phase13RequiredPaths = @(
    'shared/contracts/projections/dashboard-projection.schema.json',
    'shared/contracts/projections/no-write-validator-interface.schema.json',
    'shared/contracts/projections/projection-contract.manifest.json',
    'scripts/validation/validate-projection-contracts.ps1',
    'docs/governance/PROJECTION_CONTRACT.md',
    'docs/governance/PHASE_13_PROJECTION_CONTRACT_REPORT.md'
)
foreach ($relativePath in $phase13RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 13 projection contract artifact missing: $relativePath") | Out-Null
    }
}

$phase14RequiredPaths = @(
    'shared/contracts/projections/fixtures/projection-fixtures.manifest.json',
    'shared/contracts/projections/fixtures/fresh-dashboard-projection.fixture.json',
    'shared/contracts/projections/fixtures/stale-dashboard-projection.fixture.json',
    'shared/contracts/projections/validation-reports/fresh-dashboard-projection.validation-report.json',
    'shared/contracts/projections/validation-reports/stale-dashboard-projection.validation-report.json',
    'scripts/validation/validate-projection-fixtures.ps1',
    'docs/governance/PHASE_14_PROJECTION_FIXTURE_VALIDATION_REPORT.md'
)
foreach ($relativePath in $phase14RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 14 projection fixture validation artifact missing: $relativePath") | Out-Null
    }
}

$phase15RequiredPaths = @(
    'shared/contracts/authority/constitution.rules.json',
    'shared/contracts/authority/authority-registry.json',
    'shared/contracts/authority/authority-classifications.json',
    'shared/contracts/authority/authority-decisions.json',
    'shared/contracts/authority/validation-reports/authority-validation-report.json',
    'scripts/validation/validate-authority-control-plane.ps1',
    'docs/governance/CONSTITUTION_AUTHORITY_CONTROL_PLANE.md',
    'docs/governance/PHASE_15_CONSTITUTION_AUTHORITY_CONTROL_PLANE.md',
    'docs/governance/PHASE_15_BOUNDARY_AUDIT.md'
)
foreach ($relativePath in $phase15RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 15 constitution authority artifact missing: $relativePath") | Out-Null
    }
}

$phase16RequiredPaths = @(
    'shared/contracts/authority/read-model/authority-read-model.schema.json',
    'shared/contracts/authority/read-model/authority-query-response.schema.json',
    'shared/contracts/authority/read-model/read-model.manifest.json',
    'services/authority-read-model/README.md',
    'services/authority-read-model/generate-authority-read-model.ps1',
    'runtime/authority/authority-read-model.report.json',
    'runtime/authority/authority-query-responses.report.json',
    'runtime/authority/authority-read-model-validation.report.json',
    'scripts/validation/validate-authority-read-model.ps1',
    'docs/governance/AUTHORITY_READ_MODEL.md',
    'docs/governance/PHASE_16_AUTHORITY_READ_MODEL.md',
    'docs/governance/PHASE_16_BOUNDARY_AUDIT.md'
)
foreach ($relativePath in $phase16RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 16 authority read-model artifact missing: $relativePath") | Out-Null
    }
}

$phase17RequiredPaths = @(
    'runtime/dashboard/authority.view.json',
    'runtime/dashboard/authority-dashboard-validation.report.json',
    'scripts/validation/validate-authority-dashboard-projection.ps1',
    'docs/governance/AUTHORITY_DASHBOARD_PROJECTION.md',
    'docs/governance/PHASE_17_AUTHORITY_DASHBOARD_PROJECTION.md',
    'docs/governance/PHASE_17_BOUNDARY_AUDIT.md'
)
foreach ($relativePath in $phase17RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 17 authority dashboard projection artifact missing: $relativePath") | Out-Null
    }
}

$phase18RequiredPaths = @(
    'shared/contracts/authority/monitoring/authority-projection-monitoring.schema.json',
    'shared/contracts/authority/monitoring/monitoring.manifest.json',
    'services/authority-monitoring/README.md',
    'services/authority-monitoring/generate-authority-projection-monitoring.ps1',
    'runtime/authority/authority-projection-monitoring.report.json',
    'runtime/authority/authority-projection-monitoring-validation.report.json',
    'runtime/dashboard/authority-projection-monitoring.view.json',
    'scripts/validation/validate-authority-projection-monitoring.ps1',
    'docs/governance/AUTHORITY_PROJECTION_MONITORING.md',
    'docs/governance/PHASE_18_BOUNDARY_AUDIT.md'
)
foreach ($relativePath in $phase18RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 18 authority projection monitoring artifact missing: $relativePath") | Out-Null
    }
}

$phase19RequiredPaths = @(
    'shared/contracts/authority/evidence/authority-monitoring-evidence.schema.json',
    'shared/contracts/authority/evidence/evidence.manifest.json',
    'services/authority-evidence/README.md',
    'services/authority-evidence/generate-authority-monitoring-evidence.ps1',
    'runtime/authority/authority-monitoring-evidence.report.json',
    'runtime/authority/authority-monitoring-evidence-validation.report.json',
    'runtime/dashboard/authority-monitoring-evidence.view.json',
    'scripts/validation/validate-authority-evidence-center.ps1',
    'docs/governance/AUTHORITY_MONITORING_EVIDENCE_CENTER.md',
    'docs/governance/PHASE_19_BOUNDARY_AUDIT.md'
)
foreach ($relativePath in $phase19RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 19 authority evidence artifact missing: $relativePath") | Out-Null
    }
}

$phase20RequiredPaths = @(
    'shared/contracts/authority/history/authority-evidence-history.schema.json',
    'shared/contracts/authority/history/history.manifest.json',
    'services/authority-history/README.md',
    'services/authority-history/generate-authority-evidence-history.ps1',
    'runtime/authority/authority-evidence-history.report.json',
    'runtime/authority/authority-evidence-history-validation.report.json',
    'scripts/validation/validate-authority-evidence-history.ps1',
    'docs/governance/PHASE_20_AUTHORITY_EVIDENCE_HISTORY.md',
    'docs/governance/PHASE_20_BOUNDARY_AUDIT.md'
)
foreach ($relativePath in $phase20RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 20 authority evidence history artifact missing: $relativePath") | Out-Null
    }
}

$phase21RequiredPaths = @(
    'shared/contracts/authority/observability/authority-observability.schema.json',
    'shared/contracts/authority/observability/observability.manifest.json',
    'services/authority-observability/README.md',
    'services/authority-observability/generate-authority-observability.ps1',
    'runtime/authority/authority-observability.report.json',
    'runtime/authority/authority-observability-validation.report.json',
    'scripts/validation/validate-authority-observability.ps1',
    'docs/governance/PHASE_21_AUTHORITY_EVIDENCE_OBSERVABILITY.md',
    'docs/governance/PHASE_21_BOUNDARY_AUDIT.md'
)
foreach ($relativePath in $phase21RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 21 authority observability artifact missing: $relativePath") | Out-Null
    }
}

$phase22RequiredPaths = @(
    'shared/contracts/execution-simulation/execution-simulation.schema.json',
    'shared/contracts/execution-simulation/simulation.manifest.json',
    'services/execution-simulation/README.md',
    'services/execution-simulation/generate-execution-simulation.ps1',
    'runtime/simulation/execution-simulation.report.json',
    'runtime/simulation/execution-simulation-validation.report.json',
    'scripts/validation/validate-execution-simulation.ps1',
    'docs/governance/PHASE_22_EXECUTION_GOVERNANCE_SIMULATION.md',
    'docs/governance/PHASE_22_BOUNDARY_AUDIT.md'
)
foreach ($relativePath in $phase22RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 22 execution governance simulation artifact missing: $relativePath") | Out-Null
    }
}

$phase23RequiredPaths = @(
    'shared/contracts/simulation-review/simulation-review.schema.json',
    'shared/contracts/simulation-review/review.manifest.json',
    'services/simulation-review/README.md',
    'services/simulation-review/generate-simulation-review.ps1',
    'runtime/review/simulation-review.report.json',
    'runtime/review/simulation-review-validation.report.json',
    'scripts/validation/validate-simulation-review.ps1',
    'docs/governance/PHASE_23_SIMULATION_EVIDENCE_REVIEW.md',
    'docs/governance/PHASE_23_BOUNDARY_AUDIT.md'
)
foreach ($relativePath in $phase23RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 23 simulation evidence review artifact missing: $relativePath") | Out-Null
    }
}

$phase24RequiredPaths = @(
    'shared/contracts/decision/decision.contract.json',
    'shared/contracts/decision/decision-report.schema.json',
    'services/execution-decision/README.md',
    'services/execution-decision/generate-execution-decision.ps1',
    'runtime/decision/execution-readiness-decision.report.json',
    'runtime/decision/execution-readiness-decision-summary.json',
    'runtime/decision/execution-readiness-decision-validation.report.json',
    'scripts/validation/validate-execution-decision.ps1',
    'docs/governance/PHASE_24_EXECUTION_DECISION_REPORT.md'
)
foreach ($relativePath in $phase24RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $architectureConflicts.Add("Required Phase 24 execution readiness decision artifact missing: $relativePath") | Out-Null
    }
}

$agentContract = Read-StudioJson -RelativePath 'shared/contracts/agents.contract.json'
foreach ($agent in $agentContract.agents) {
    foreach ($hook in $agent.validationHooks) {
        if (-not (Test-Path -LiteralPath (Join-Path $root $hook) -PathType Leaf)) {
            $errors.Add("Agent '$($agent.id)' references missing validation hook '$hook'.") | Out-Null
        }
    }
}

$eventContract = Read-StudioJson -RelativePath 'shared/contracts/events.contract.json'
foreach ($family in $eventContract.eventFamilies) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $family.owner) -PathType Container)) {
        $errors.Add("Event family '$($family.prefix)' references missing owner '$($family.owner)'.") | Out-Null
    }
}

$phase51RequiredPaths = @(
    'docs/governance/ARCHITECTURE_PROTECTION_RULES.md',
    'docs/governance/ANTI_MAGIC_RULES.md',
    'docs/governance/AI_SAFETY_BOUNDARY.md',
    'docs/governance/TECHNICAL_DEBT_REGISTER.md',
    'docs/governance/PHASE_COMPATIBILITY_REPORT.md',
    'docs/adr/ADR-001-SACRED-RUNTIME-PIPELINE.md',
    'docs/adr/ADR-002-READ-ONLY-DASHBOARD.md',
    'docs/adr/ADR-003-OPERATIONAL-INTELLIGENCE-LAYER.md',
    'docs/adr/ADR-004-HISTORICAL-SNAPSHOT-STRATEGY.md',
    'docs/adr/ADR-005-NO-PROVIDER-DEPENDENCIES.md',
    'shared/contracts/intelligence/health.schema.json',
    'shared/contracts/intelligence/risk.schema.json',
    'shared/contracts/intelligence/trend.schema.json',
    'shared/contracts/intelligence/governance.schema.json',
    'shared/contracts/intelligence/maturity.schema.json',
    'shared/contracts/intelligence/confidence.schema.json',
    'shared/contracts/intelligence/executive-summary.schema.json',
    'services/operational-intelligence/confidence/generate-confidence.ps1',
    'services/operational-intelligence/explainability/generate-explainability.ps1'
)

foreach ($relativePath in $phase51RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath))) {
        $architectureConflicts.Add("Required trust-layer artifact missing: $relativePath") | Out-Null
    }
}

$phase6RequiredPaths = @(
    'docs/governance/GOVERNANCE_SAFETY_BOUNDARY.md',
    'docs/governance/PHASE_6_COMPATIBILITY_REPORT.md',
    'docs/governance/EXCEPTION_REGISTER.md',
    'shared/contracts/governance/governance-score.schema.json',
    'shared/contracts/governance/compliance.schema.json',
    'shared/contracts/governance/release-readiness.schema.json',
    'shared/contracts/governance/quality-gates.schema.json',
    'shared/contracts/governance/exceptions.schema.json',
    'shared/contracts/governance/governance-drift.schema.json',
    'services/governance/Governance.psm1',
    'services/governance/run-governance.ps1',
    'services/governance/scoring/generate-governance-score.ps1',
    'services/governance/compliance/generate-compliance.ps1',
    'services/governance/release-readiness/generate-release-readiness.ps1',
    'services/governance/quality-gates/generate-quality-gates.ps1',
    'services/governance/exceptions/generate-exceptions.ps1',
    'services/governance/drift-detection/generate-governance-drift.ps1'
)

foreach ($relativePath in $phase6RequiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath))) {
        $architectureConflicts.Add("Required governance-layer artifact missing: $relativePath") | Out-Null
    }
}

$intelligenceContractsPath = Join-Path $root 'shared/contracts/intelligence'
if (Test-Path -LiteralPath $intelligenceContractsPath -PathType Container) {
    foreach ($contractFile in @(Get-ChildItem -LiteralPath $intelligenceContractsPath -Filter '*.json' -File)) {
        try {
            $contract = Get-Content -LiteralPath $contractFile.FullName -Raw | ConvertFrom-Json
            foreach ($field in @('schemaVersion', 'contractId', 'requiredFields', 'traceability')) {
                if ($null -eq $contract.PSObject.Properties[$field]) {
                    $architectureConflicts.Add("Intelligence contract misses '$field': $($contractFile.Name)") | Out-Null
                }
            }
        }
        catch {
            $architectureConflicts.Add("Invalid intelligence contract JSON: $($contractFile.Name)") | Out-Null
        }
    }
}

$governanceContractsPath = Join-Path $root 'shared/contracts/governance'
if (Test-Path -LiteralPath $governanceContractsPath -PathType Container) {
    foreach ($contractFile in @(Get-ChildItem -LiteralPath $governanceContractsPath -Filter '*.json' -File)) {
        try {
            $contract = Get-Content -LiteralPath $contractFile.FullName -Raw | ConvertFrom-Json
            foreach ($field in @('schemaVersion', 'contractId', 'requiredFields', 'traceability')) {
                if ($null -eq $contract.PSObject.Properties[$field]) {
                    $architectureConflicts.Add("Governance contract misses '$field': $($contractFile.Name)") | Out-Null
                }
            }
        }
        catch {
            $architectureConflicts.Add("Invalid governance contract JSON: $($contractFile.Name)") | Out-Null
        }
    }
}

$approvedEnginePaths = @{
    scoring = 'services/operational-intelligence/scoring'
    trends = 'services/operational-intelligence/trends'
    risk = 'services/operational-intelligence/risk'
    governance = 'services/operational-intelligence/governance'
}

foreach ($engine in $approvedEnginePaths.GetEnumerator()) {
    $matches = @(Get-ChildItem -LiteralPath (Join-Path $root 'services/operational-intelligence') -Directory -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq $engine.Key -and $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/') -ne $engine.Value })
    foreach ($match in $matches) {
        $relative = $match.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
        $architectureConflicts.Add("Duplicate $($engine.Key) engine detected: $relative") | Out-Null
    }
}

$protectedSourceFiles = @(
    'apps/studio-dashboard/dashboard-adapter.ps1',
    'services/operational-intelligence/OperationalIntelligence.psm1',
    'services/operational-intelligence/run-operational-intelligence.ps1',
    'services/governance/Governance.psm1',
    'services/governance/run-governance.ps1'
) + @(Get-ChildItem -LiteralPath (Join-Path $root 'services/operational-intelligence') -Filter '*.ps1' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'services/governance') -Filter '*.ps1' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'services/coordination') -Filter '*.ps1' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts/validation') -Filter 'validate-authority-control-plane.ps1' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts/validation') -Filter 'validate-authority-read-model.ps1' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts/validation') -Filter 'validate-authority-dashboard-projection.ps1' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts/validation') -Filter 'validate-authority-projection-monitoring.ps1' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts/validation') -Filter 'validate-authority-evidence-center.ps1' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts/validation') -Filter 'validate-authority-evidence-history.ps1' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts/validation') -Filter 'validate-authority-observability.ps1' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'services/authority-read-model') -Filter '*.ps1' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'services/authority-monitoring') -Filter '*.ps1' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'services/authority-evidence') -Filter '*.ps1' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'services/authority-history') -Filter '*.ps1' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'services/authority-observability') -Filter '*.ps1' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'services/execution-simulation') -Filter '*.ps1' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts/validation') -Filter 'validate-execution-simulation.ps1' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'services/simulation-review') -Filter '*.ps1' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts/validation') -Filter 'validate-simulation-review.ps1' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'services/execution-decision') -Filter '*.ps1' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts/validation') -Filter 'validate-execution-decision.ps1' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts/validation') -Filter 'validate-execution*.ps1' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts/validation') -Filter 'validate-approval-registry.ps1' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts/validation') -Filter 'validate-rollback-plans.ps1' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}) + @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts/validation') -Filter 'validate-idempotency-records.ps1' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
})

$forbiddenSourcePatterns = @(
    'Invoke-RestMethod',
    'Invoke-WebRequest',
    'New-StoredCredential',
    'Set-StoredCredential',
    'Start-Process',
    'git\s+push',
    'gh\s+pr',
    'vercel\s+deploy',
    'netlify\s+deploy',
    'firebase\s+deploy'
)

foreach ($relativeFile in @($protectedSourceFiles | Sort-Object -Unique)) {
    $path = Join-Path $root $relativeFile
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }
    foreach ($pattern in $forbiddenSourcePatterns) {
        $match = Select-String -LiteralPath $path -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($match) {
            $architectureConflicts.Add("Forbidden protected-boundary action '$pattern' in $relativeFile") | Out-Null
        }
    }
}

if ($architectureConflicts.Count -gt 0) {
    Write-Host 'ARCHITECTURE CONFLICT DETECTED' -ForegroundColor Red
    foreach ($conflict in $architectureConflicts) {
        Write-Host "  - $conflict" -ForegroundColor Red
    }
    exit 1
}

if ($errors.Count -gt 0) {
    Write-Host "Architecture validation failed with $($errors.Count) error(s):" -ForegroundColor Red
    foreach ($errorMessage in $errors) {
        Write-Host "  - $errorMessage" -ForegroundColor Red
    }
    exit 1
}

Write-Host 'Architecture validation passed.' -ForegroundColor Green
