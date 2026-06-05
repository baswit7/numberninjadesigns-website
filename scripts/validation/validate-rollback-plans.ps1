Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-governance-validation.ps1"

$script:ValidationName = 'validate-rollback-plans'
$checks = @()
$rollbackPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'runtime\execution\rollback-plans'
$allowedReadiness = @('ready', 'partial', 'missing', 'not-reversible')
$files = @(Get-ChildItem -LiteralPath $rollbackPath -Filter *.json -File)

if ($files.Count -lt 1) {
    Add-Check -Checks ([ref]$checks) -Name 'rollback-plans' -Status 'FAIL' -Message 'at least one rollback plan is required'
}

foreach ($file in $files) {
    $json = Read-JsonFile -Path $file.FullName
    if ($json.schemaVersion -ne '1.0.0') {
        Add-Check -Checks ([ref]$checks) -Name "rollback:$($file.Name)" -Status 'FAIL' -Message 'schemaVersion must be 1.0.0'
    }
    if ($allowedReadiness -notcontains $json.readiness) {
        Add-Check -Checks ([ref]$checks) -Name "rollback:$($file.Name)" -Status 'FAIL' -Message 'invalid rollback readiness'
    }
    if (@($json.validationChecks).Count -lt 1) {
        Add-Check -Checks ([ref]$checks) -Name "rollback:$($file.Name)" -Status 'FAIL' -Message 'validation checks are required'
    }
    Add-Check -Checks ([ref]$checks) -Name "rollback:$($file.Name)" -Status 'PASS' -Message "rollback readiness modeled as $($json.readiness)"
}

$reportPath = New-ValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
