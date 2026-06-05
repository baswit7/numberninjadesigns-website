Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-governance-validation.ps1"

$script:ValidationName = 'validate-idempotency-records'
$checks = @()
$idempotencyPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'runtime\execution\idempotency'
$allowedStrategies = @('request-hash', 'business-key', 'manual-review')
$allowedConflictPolicies = @('deny-conflict', 'require-review', 'allow-identical-only')
$files = @(Get-ChildItem -LiteralPath $idempotencyPath -Filter *.json -File)

if ($files.Count -lt 1) {
    Add-Check -Checks ([ref]$checks) -Name 'idempotency-records' -Status 'FAIL' -Message 'at least one idempotency record is required'
}

foreach ($file in $files) {
    $json = Read-JsonFile -Path $file.FullName
    if ($json.schemaVersion -ne '1.0.0') {
        Add-Check -Checks ([ref]$checks) -Name "idempotency:$($file.Name)" -Status 'FAIL' -Message 'schemaVersion must be 1.0.0'
    }
    if ($allowedStrategies -notcontains $json.strategy) {
        Add-Check -Checks ([ref]$checks) -Name "idempotency:$($file.Name)" -Status 'FAIL' -Message 'invalid idempotency strategy'
    }
    if ($allowedConflictPolicies -notcontains $json.conflictPolicy) {
        Add-Check -Checks ([ref]$checks) -Name "idempotency:$($file.Name)" -Status 'FAIL' -Message 'invalid conflict policy'
    }
    if ($json.dedupeWindowMinutes -lt 1) {
        Add-Check -Checks ([ref]$checks) -Name "idempotency:$($file.Name)" -Status 'FAIL' -Message 'dedupe window must be positive'
    }
    Add-Check -Checks ([ref]$checks) -Name "idempotency:$($file.Name)" -Status 'PASS' -Message "idempotency strategy modeled as $($json.strategy)"
}

$reportPath = New-ValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
