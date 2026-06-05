Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-readiness-validation.ps1"

$script:ValidationName = 'validate-preflight-checks'
$checks = @()
$files = Get-ReadinessFiles -Checks ([ref]$checks) -RelativePath 'runtime\readiness\preflight-checks'
$allowedStatuses = @('pass', 'warning', 'fail', 'blocked')
$allowedTypes = @('boundary', 'schema', 'risk', 'rollback', 'idempotency', 'approval-chain', 'dependency')

foreach ($file in $files) {
    $json = Read-ReadinessJsonFile -Path $file.FullName
    if ($json.schemaVersion -ne '1.0.0') {
        Add-ReadinessCheck -Checks ([ref]$checks) -Name "preflight:$($file.Name)" -Status 'FAIL' -Message 'schemaVersion must be 1.0.0'
    }
    if ($allowedStatuses -notcontains $json.status) {
        Add-ReadinessCheck -Checks ([ref]$checks) -Name "preflight:$($file.Name)" -Status 'FAIL' -Message 'invalid preflight status'
    }
    if ($allowedTypes -notcontains $json.checkType) {
        Add-ReadinessCheck -Checks ([ref]$checks) -Name "preflight:$($file.Name)" -Status 'FAIL' -Message 'invalid preflight check type'
    }
    if ([string]::IsNullOrWhiteSpace($json.reason)) {
        Add-ReadinessCheck -Checks ([ref]$checks) -Name "preflight:$($file.Name)" -Status 'FAIL' -Message 'reason is required'
    }
    Add-ReadinessCheck -Checks ([ref]$checks) -Name "preflight:$($file.Name)" -Status 'PASS' -Message "preflight modeled as $($json.status)"
}

Assert-NoReadinessExecutionCapability -Checks ([ref]$checks)

$reportPath = New-ReadinessValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
