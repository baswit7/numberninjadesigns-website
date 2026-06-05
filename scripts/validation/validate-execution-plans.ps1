Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-readiness-validation.ps1"

$script:ValidationName = 'validate-execution-plans'
$checks = @()
$files = Get-ReadinessFiles -Checks ([ref]$checks) -RelativePath 'runtime\readiness\plans'

foreach ($file in $files) {
    $json = Read-ReadinessJsonFile -Path $file.FullName
    if ($json.schemaVersion -ne '1.0.0') {
        Add-ReadinessCheck -Checks ([ref]$checks) -Name "plan:$($file.Name)" -Status 'FAIL' -Message 'schemaVersion must be 1.0.0'
    }
    if ($json.phase9Compatibility.approvalMetadataIsNotPermission -ne $true) {
        Add-ReadinessCheck -Checks ([ref]$checks) -Name "plan:$($file.Name)" -Status 'FAIL' -Message 'approval metadata must be modeled as non-permission'
    }
    if (@($json.steps).Count -lt 1) {
        Add-ReadinessCheck -Checks ([ref]$checks) -Name "plan:$($file.Name)" -Status 'FAIL' -Message 'at least one step is required'
    }
    foreach ($step in @($json.steps)) {
        if ($step.planId -ne $json.planId) {
            Add-ReadinessCheck -Checks ([ref]$checks) -Name "step:$($step.stepId)" -Status 'FAIL' -Message 'step planId must match parent plan'
        }
        if (@($step.requiredPreflightChecks).Count -lt 1) {
            Add-ReadinessCheck -Checks ([ref]$checks) -Name "step:$($step.stepId)" -Status 'FAIL' -Message 'required preflight checks missing'
        }
    }
    Add-ReadinessCheck -Checks ([ref]$checks) -Name "plan:$($file.Name)" -Status 'PASS' -Message "plan $($json.planId) is readiness-only and has modeled steps"
}

Assert-ReadinessBoundaryDisabled -Checks ([ref]$checks) -RelativePath 'runtime\readiness\plans'
Assert-NoReadinessExecutionCapability -Checks ([ref]$checks)

$reportPath = New-ReadinessValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
