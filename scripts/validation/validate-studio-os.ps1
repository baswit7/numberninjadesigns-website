Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-governance-validation.ps1"

$script:ValidationName = 'validate-studio-os'
$checks = @()

Assert-PathExists -Checks ([ref]$checks) -RelativePath 'README.md' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'config\studio.config.json' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'services\execution-governance' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'services\execution-readiness' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'shared\contracts\execution' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'shared\contracts\readiness' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'shared\contracts\projections' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'shared\contracts\projections\fixtures' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'services\dashboard-adapter' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'runtime\execution' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'runtime\readiness' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\PHASE_10_EXECUTION_READINESS.md' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\PHASE_13_PROJECTION_CONTRACT_REPORT.md' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\PHASE_14_PROJECTION_FIXTURE_VALIDATION_REPORT.md' | Out-Null
Assert-NoEnabledExecutionBoundary -Checks ([ref]$checks) -RelativePath 'runtime\execution'
Assert-NoEnabledExecutionBoundary -Checks ([ref]$checks) -RelativePath 'runtime\readiness'
Assert-NoEnabledExecutionBoundary -Checks ([ref]$checks) -RelativePath 'shared\contracts\projections'
Assert-NoExecutionImplementations -Checks ([ref]$checks)

$reportPath = New-ValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
