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
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'runtime\execution' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'runtime\readiness' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\PHASE_10_EXECUTION_READINESS.md' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'modules\ai-workforce-control-center\index.html' | Out-Null
Assert-PathExists -Checks ([ref]$checks) -RelativePath 'shared\contracts\ai-workforce' | Out-Null
Assert-NoEnabledExecutionBoundary -Checks ([ref]$checks) -RelativePath 'runtime\execution'
Assert-NoEnabledExecutionBoundary -Checks ([ref]$checks) -RelativePath 'runtime\readiness'
Assert-NoExecutionImplementations -Checks ([ref]$checks)

$reportPath = New-ValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
