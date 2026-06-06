Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-governance-validation.ps1"

$script:ValidationName = 'validate-architecture'
$checks = @()

$architecturePath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\ARCHITECTURE.md'
$graphPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\AI_EXECUTION_GRAPH.md'
$boundaryPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\EXECUTION_BOUNDARY.md'
$readinessBoundaryPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\EXECUTION_READINESS_BOUNDARY.md'
$dashboardBoundaryPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\DASHBOARD_RUNTIME_BOUNDARY.md'
$phase12Path = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\PHASE_12_DASHBOARD_RUNTIME_BOUNDARY_DESIGN.md'
$projectionContractPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\PROJECTION_CONTRACT.md'
$phase13Path = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\PHASE_13_PROJECTION_CONTRACT_REPORT.md'
$phase14Path = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\PHASE_14_PROJECTION_FIXTURE_VALIDATION_REPORT.md'
$phaseMatrixPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\PHASE_READINESS_MATRIX.md'

$architecture = Get-Content -LiteralPath $architecturePath -Raw
$graph = Get-Content -LiteralPath $graphPath -Raw
$boundary = Get-Content -LiteralPath $boundaryPath -Raw
$readinessBoundary = Get-Content -LiteralPath $readinessBoundaryPath -Raw
$dashboardBoundary = Get-Content -LiteralPath $dashboardBoundaryPath -Raw
$phase12 = Get-Content -LiteralPath $phase12Path -Raw
$projectionContract = Get-Content -LiteralPath $projectionContractPath -Raw
$phase13 = Get-Content -LiteralPath $phase13Path -Raw
$phase14 = Get-Content -LiteralPath $phase14Path -Raw
$phaseMatrix = Get-Content -LiteralPath $phaseMatrixPath -Raw

if ($architecture -notmatch 'non-executing Execution Governance Layer') {
    Add-Check -Checks ([ref]$checks) -Name 'architecture-doc' -Status 'FAIL' -Message 'architecture doc must describe Phase 9 governance layer'
}
Add-Check -Checks ([ref]$checks) -Name 'architecture-doc' -Status 'PASS' -Message 'architecture doc describes Phase 9 governance layer'

if ($architecture -notmatch 'non-executing Execution Readiness Layer') {
    Add-Check -Checks ([ref]$checks) -Name 'readiness-architecture-doc' -Status 'FAIL' -Message 'architecture doc must describe Phase 10 readiness layer'
}
Add-Check -Checks ([ref]$checks) -Name 'readiness-architecture-doc' -Status 'PASS' -Message 'architecture doc describes Phase 10 readiness layer'

if ($graph -match 'Executor\["|Dispatch\["|Provider Client|Deployment Adapter') {
    Add-Check -Checks ([ref]$checks) -Name 'execution-graph' -Status 'FAIL' -Message 'execution graph must not include executable nodes'
}
Add-Check -Checks ([ref]$checks) -Name 'execution-graph' -Status 'PASS' -Message 'execution graph is evaluative only'

if ($boundary -notmatch 'Provider calls' -or $boundary -notmatch 'Deployments') {
    Add-Check -Checks ([ref]$checks) -Name 'boundary-doc' -Status 'FAIL' -Message 'boundary doc must list prohibited provider and deployment behavior'
}
Add-Check -Checks ([ref]$checks) -Name 'boundary-doc' -Status 'PASS' -Message 'boundary doc lists prohibited behavior'

if ($readinessBoundary -notmatch 'Approval-chain metadata' -or $readinessBoundary -notmatch 'Readiness decisions') {
    Add-Check -Checks ([ref]$checks) -Name 'readiness-boundary-doc' -Status 'FAIL' -Message 'readiness boundary doc must list non-permission semantics'
}
Add-Check -Checks ([ref]$checks) -Name 'readiness-boundary-doc' -Status 'PASS' -Message 'readiness boundary doc lists non-permission semantics'

if ($architecture -notmatch 'Phase 12' -or $architecture -notmatch 'dashboard/runtime boundary design documentation only') {
    Add-Check -Checks ([ref]$checks) -Name 'phase-12-architecture-doc' -Status 'FAIL' -Message 'architecture doc must describe Phase 12 as design-only'
}
Add-Check -Checks ([ref]$checks) -Name 'phase-12-architecture-doc' -Status 'PASS' -Message 'architecture doc describes Phase 12 design-only boundary'

if ($graph -notmatch 'Phase 12 Dashboard Boundary State' -or $graph -match 'Executor\["|Dispatch\["|Provider Client|Deployment Adapter') {
    Add-Check -Checks ([ref]$checks) -Name 'phase-12-graph' -Status 'FAIL' -Message 'execution graph must document Phase 12 projection boundary without executable nodes'
}
Add-Check -Checks ([ref]$checks) -Name 'phase-12-graph' -Status 'PASS' -Message 'Phase 12 graph remains projection-only'

if ($dashboardBoundary -notmatch 'No-Write Validation Mode' -or $dashboardBoundary -notmatch 'Validator And Business Logic Boundary') {
    Add-Check -Checks ([ref]$checks) -Name 'dashboard-runtime-boundary-doc' -Status 'FAIL' -Message 'dashboard boundary doc must define no-write validation and validator ownership'
}
Add-Check -Checks ([ref]$checks) -Name 'dashboard-runtime-boundary-doc' -Status 'PASS' -Message 'dashboard boundary doc defines no-write validation and validator ownership'

if ($dashboardBoundary -match 'Invoke-RestMethod|Invoke-WebRequest|Start-Job|Register-ScheduledTask|Start-Process\s+.*vercel|gh\s+api|"(apiKey|token|secret|credential)"\s*:') {
    Add-Check -Checks ([ref]$checks) -Name 'dashboard-boundary-capability-scan' -Status 'FAIL' -Message 'dashboard boundary doc must not introduce executable or credential capability'
}
Add-Check -Checks ([ref]$checks) -Name 'dashboard-boundary-capability-scan' -Status 'PASS' -Message 'dashboard boundary doc contains no executable or credential capability'

if ($phase12 -notmatch 'No execution' -or $phase12 -notmatch 'No dashboard implementation') {
    Add-Check -Checks ([ref]$checks) -Name 'phase-12-scope' -Status 'FAIL' -Message 'Phase 12 design doc must preserve non-execution and no-dashboard-implementation scope'
}
Add-Check -Checks ([ref]$checks) -Name 'phase-12-scope' -Status 'PASS' -Message 'Phase 12 design scope prohibits runtime and dashboard implementation'

if ($phaseMatrix -notmatch '12 \| Dashboard/runtime boundary design \| Designed only' -or $phaseMatrix -notmatch 'Runtime capability introduced \| Not allowed') {
    Add-Check -Checks ([ref]$checks) -Name 'phase-readiness-matrix' -Status 'FAIL' -Message 'phase readiness matrix must show Phase 12 as design-only with no runtime capability'
}
Add-Check -Checks ([ref]$checks) -Name 'phase-readiness-matrix' -Status 'PASS' -Message 'phase readiness matrix captures Phase 12 design-only status'

if ($architecture -notmatch 'Phase 13' -or $architecture -notmatch 'Projection Contract and No-Write Validator Interface') {
    Add-Check -Checks ([ref]$checks) -Name 'phase-13-architecture-doc' -Status 'FAIL' -Message 'architecture doc must describe Phase 13 projection contract layer'
}
Add-Check -Checks ([ref]$checks) -Name 'phase-13-architecture-doc' -Status 'PASS' -Message 'architecture doc describes Phase 13 projection contract layer'

if ($graph -notmatch 'Phase 13 Projection Contract State' -or $graph -match 'Executor\["|Dispatch\["|Provider Client|Deployment Adapter') {
    Add-Check -Checks ([ref]$checks) -Name 'phase-13-graph' -Status 'FAIL' -Message 'execution graph must document Phase 13 projection contract boundary without executable nodes'
}
Add-Check -Checks ([ref]$checks) -Name 'phase-13-graph' -Status 'PASS' -Message 'Phase 13 graph remains projection-contract-only'

if ($projectionContract -notmatch 'Runtime truth' -or $projectionContract -notmatch 'Passive visual consumer' -or $projectionContract -notmatch 'No-Write Validator Interface') {
    Add-Check -Checks ([ref]$checks) -Name 'projection-contract-doc' -Status 'FAIL' -Message 'projection contract doc must define runtime truth, passive dashboard consumption, and no-write validation'
}
Add-Check -Checks ([ref]$checks) -Name 'projection-contract-doc' -Status 'PASS' -Message 'projection contract doc defines ownership and no-write validation'

if ($phase13 -notmatch 'Phase 13 remains non-executing and read-only by design' -or $phase13 -notmatch 'Projection layer \| Read-only derived contract') {
    Add-Check -Checks ([ref]$checks) -Name 'phase-13-report' -Status 'FAIL' -Message 'Phase 13 report must state non-executing read-only projection verdict'
}
Add-Check -Checks ([ref]$checks) -Name 'phase-13-report' -Status 'PASS' -Message 'Phase 13 report states read-only non-executing verdict'

if ($phaseMatrix -notmatch '13 \| Projection contract and no-write validator interface \| Implemented as contracts only' -or $phaseMatrix -notmatch 'Projection layer write capability \| Not allowed') {
    Add-Check -Checks ([ref]$checks) -Name 'phase-13-readiness-matrix' -Status 'FAIL' -Message 'phase readiness matrix must show Phase 13 as contract-only with no projection write capability'
}
Add-Check -Checks ([ref]$checks) -Name 'phase-13-readiness-matrix' -Status 'PASS' -Message 'phase readiness matrix captures Phase 13 contract-only status'

if ($architecture -notmatch 'Phase 14' -or $architecture -notmatch 'read-only projection fixture validation and stale-projection detection') {
    Add-Check -Checks ([ref]$checks) -Name 'phase-14-architecture-doc' -Status 'FAIL' -Message 'architecture doc must describe Phase 14 projection fixture validation'
}
Add-Check -Checks ([ref]$checks) -Name 'phase-14-architecture-doc' -Status 'PASS' -Message 'architecture doc describes Phase 14 fixture validation layer'

if ($graph -notmatch 'Phase 14 Projection Fixture Validation State' -or $graph -match 'Executor\["|Dispatch\["|Provider Client|Deployment Adapter') {
    Add-Check -Checks ([ref]$checks) -Name 'phase-14-graph' -Status 'FAIL' -Message 'execution graph must document Phase 14 fixture validation without executable nodes'
}
Add-Check -Checks ([ref]$checks) -Name 'phase-14-graph' -Status 'PASS' -Message 'Phase 14 graph remains fixture-validation-only'

if ($phase14 -notmatch 'Phase 14 remains non-executing and read-only by design' -or $phase14 -notmatch 'Projection fixtures \| Read-only validation evidence') {
    Add-Check -Checks ([ref]$checks) -Name 'phase-14-report' -Status 'FAIL' -Message 'Phase 14 report must state non-executing read-only projection fixture verdict'
}
Add-Check -Checks ([ref]$checks) -Name 'phase-14-report' -Status 'PASS' -Message 'Phase 14 report states read-only non-executing verdict'

if ($phaseMatrix -notmatch '14 \| Projection fixture validation and stale-projection detection \| Implemented as read-only fixtures only' -or $phaseMatrix -notmatch 'Stale projection detection present \| Enforced') {
    Add-Check -Checks ([ref]$checks) -Name 'phase-14-readiness-matrix' -Status 'FAIL' -Message 'phase readiness matrix must show Phase 14 as read-only fixture validation'
}
Add-Check -Checks ([ref]$checks) -Name 'phase-14-readiness-matrix' -Status 'PASS' -Message 'phase readiness matrix captures Phase 14 fixture-only status'

$reportPath = New-ValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
