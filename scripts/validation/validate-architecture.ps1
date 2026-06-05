Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-governance-validation.ps1"

$script:ValidationName = 'validate-architecture'
$checks = @()

$architecturePath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\ARCHITECTURE.md'
$graphPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\AI_EXECUTION_GRAPH.md'
$boundaryPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\EXECUTION_BOUNDARY.md'
$readinessBoundaryPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\EXECUTION_READINESS_BOUNDARY.md'

$architecture = Get-Content -LiteralPath $architecturePath -Raw
$graph = Get-Content -LiteralPath $graphPath -Raw
$boundary = Get-Content -LiteralPath $boundaryPath -Raw
$readinessBoundary = Get-Content -LiteralPath $readinessBoundaryPath -Raw

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

$reportPath = New-ValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
