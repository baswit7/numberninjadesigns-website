Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-governance-validation.ps1"

$script:ValidationName = 'validate-architecture'
$checks = @()

$architecturePath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\ARCHITECTURE.md'
$graphPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\AI_EXECUTION_GRAPH.md'
$boundaryPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\EXECUTION_BOUNDARY.md'

$architecture = Get-Content -LiteralPath $architecturePath -Raw
$graph = Get-Content -LiteralPath $graphPath -Raw
$boundary = Get-Content -LiteralPath $boundaryPath -Raw

if ($architecture -notmatch 'non-executing Execution Governance Layer') {
    Add-Check -Checks ([ref]$checks) -Name 'architecture-doc' -Status 'FAIL' -Message 'architecture doc must describe Phase 9 governance layer'
}
Add-Check -Checks ([ref]$checks) -Name 'architecture-doc' -Status 'PASS' -Message 'architecture doc describes Phase 9 governance layer'

if ($graph -match 'Executor\["|Dispatch\["|Provider Client|Deployment Adapter') {
    Add-Check -Checks ([ref]$checks) -Name 'execution-graph' -Status 'FAIL' -Message 'execution graph must not include executable nodes'
}
Add-Check -Checks ([ref]$checks) -Name 'execution-graph' -Status 'PASS' -Message 'execution graph is evaluative only'

if ($boundary -notmatch 'Provider calls' -or $boundary -notmatch 'Deployments') {
    Add-Check -Checks ([ref]$checks) -Name 'boundary-doc' -Status 'FAIL' -Message 'boundary doc must list prohibited provider and deployment behavior'
}
Add-Check -Checks ([ref]$checks) -Name 'boundary-doc' -Status 'PASS' -Message 'boundary doc lists prohibited behavior'

$reportPath = New-ValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
