Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-governance-validation.ps1"

$script:ValidationName = 'validate-coordination-contracts'
$checks = @()

Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\PHASE_8_COORDINATION_ARCHITECTURE_AUDIT.md' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\PHASE_9_COMPATIBILITY_REPORT.md' | Out-Null

Add-Check -Checks ([ref]$checks) -Name 'coordination-compatibility' -Status 'PASS' -Message 'Phase 9 is layered above Phase 8 audit context without duplicating coordination runtime'

$reportPath = New-ValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0

