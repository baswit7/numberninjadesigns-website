Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-governance-validation.ps1"

$script:ValidationName = 'validate-command-contracts'
$checks = @()

Assert-PathExists -Checks ([ref]$checks) -RelativePath 'shared\contracts\execution\execution-request.schema.json' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'shared\contracts\execution\execution-policy.schema.json' | Out-Null
Assert-NoEnabledExecutionBoundary -Checks ([ref]$checks) -RelativePath 'shared\contracts\execution'

Add-Check -Checks ([ref]$checks) -Name 'command-contract-boundary' -Status 'PASS' -Message 'command-like execution requests are modeled as governance contracts only'

$reportPath = New-ValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0

