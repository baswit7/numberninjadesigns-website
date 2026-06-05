Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-governance-validation.ps1"

$script:ValidationName = 'validate-studio-os'
$checks = @()

Assert-PathExists -Checks ([ref]$checks) -RelativePath 'README.md' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'services\execution-governance' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'shared\contracts\execution' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'runtime\execution' | Out-Null
Assert-NoEnabledExecutionBoundary -Checks ([ref]$checks) -RelativePath 'runtime\execution'
Assert-NoExecutionImplementations -Checks ([ref]$checks)

$reportPath = New-ValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0

