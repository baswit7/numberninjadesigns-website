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
$phaseMatrixPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\PHASE_READINESS_MATRIX.md'

$architecture = Get-Content -LiteralPath $architecturePath -Raw
$graph = Get-Content -LiteralPath $graphPath -Raw
$boundary = Get-Content -LiteralPath $boundaryPath -Raw
$readinessBoundary = Get-Content -LiteralPath $readinessBoundaryPath -Raw
$dashboardBoundary = Get-Content -LiteralPath $dashboardBoundaryPath -Raw
$phase12 = Get-Content -LiteralPath $phase12Path -Raw
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

$reportPath = New-ValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
