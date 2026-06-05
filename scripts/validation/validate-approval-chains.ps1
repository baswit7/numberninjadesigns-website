Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-readiness-validation.ps1"

$script:ValidationName = 'validate-approval-chains'
$checks = @()
$files = Get-ReadinessFiles -Checks ([ref]$checks) -RelativePath 'runtime\readiness\approval-chains'
$allowedStatuses = @('complete', 'incomplete', 'denied', 'expired', 'blocked')

foreach ($file in $files) {
    $json = Read-ReadinessJsonFile -Path $file.FullName
    if ($json.schemaVersion -ne '1.0.0') {
        Add-ReadinessCheck -Checks ([ref]$checks) -Name "approval-chain:$($file.Name)" -Status 'FAIL' -Message 'schemaVersion must be 1.0.0'
    }
    if ($allowedStatuses -notcontains $json.status) {
        Add-ReadinessCheck -Checks ([ref]$checks) -Name "approval-chain:$($file.Name)" -Status 'FAIL' -Message 'invalid approval-chain status'
    }
    if ($json.approvalMetadataIsExecutionPermission -ne $false) {
        Add-ReadinessCheck -Checks ([ref]$checks) -Name "approval-chain:$($file.Name)" -Status 'FAIL' -Message 'approval metadata must not grant execution permission'
    }
    if (@($json.requiredApprovers).Count -lt 1) {
        Add-ReadinessCheck -Checks ([ref]$checks) -Name "approval-chain:$($file.Name)" -Status 'FAIL' -Message 'required approvers missing'
    }
    Add-ReadinessCheck -Checks ([ref]$checks) -Name "approval-chain:$($file.Name)" -Status 'PASS' -Message "approval chain modeled as $($json.status)"
}

Assert-ReadinessBoundaryDisabled -Checks ([ref]$checks) -RelativePath 'runtime\readiness\approval-chains'
Assert-NoReadinessExecutionCapability -Checks ([ref]$checks)

$reportPath = New-ReadinessValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
