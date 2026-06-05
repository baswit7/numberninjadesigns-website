Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-readiness-validation.ps1"

$script:ValidationName = 'validate-readiness-boundaries'
$checks = @()

Assert-ReadinessPathExists -Checks ([ref]$checks) -RelativePath 'services\execution-readiness' | Out-Null
Assert-ReadinessPathExists -Checks ([ref]$checks) -RelativePath 'shared\contracts\readiness' | Out-Null
Assert-ReadinessPathExists -Checks ([ref]$checks) -RelativePath 'runtime\readiness' | Out-Null
Assert-ReadinessPathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\EXECUTION_READINESS_BOUNDARY.md' | Out-Null

Assert-ReadinessBoundaryDisabled -Checks ([ref]$checks) -RelativePath 'shared\contracts\readiness'
Assert-ReadinessBoundaryDisabled -Checks ([ref]$checks) -RelativePath 'runtime\readiness'
Assert-NoReadinessExecutionCapability -Checks ([ref]$checks)

$repoRoot = Get-RepoRoot
$uiMatches = Get-ChildItem -Path (Join-Path $repoRoot '*.html') -File |
    Select-String -Pattern 'readiness|execution-readiness'
if ($uiMatches) {
    Add-ReadinessCheck -Checks ([ref]$checks) -Name 'dashboard-ui' -Status 'FAIL' -Message 'readiness dashboard UI was added to static HTML'
}
Add-ReadinessCheck -Checks ([ref]$checks) -Name 'dashboard-ui' -Status 'PASS' -Message 'no readiness dashboard UI added'

$reportPath = New-ReadinessValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
