Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-governance-validation.ps1"

$script:ValidationName = 'validate-approval-registry'
$checks = @()
$approvalPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'runtime\execution\approvals'
$allowedStatuses = @('missing', 'pending', 'approved', 'denied', 'expired')
$files = @(Get-ChildItem -LiteralPath $approvalPath -Filter *.json -File)

if ($files.Count -lt 1) {
    Add-Check -Checks ([ref]$checks) -Name 'approval-records' -Status 'FAIL' -Message 'at least one approval record is required'
}

foreach ($file in $files) {
    $json = Read-JsonFile -Path $file.FullName
    if ($json.schemaVersion -ne '1.0.0') {
        Add-Check -Checks ([ref]$checks) -Name "approval:$($file.Name)" -Status 'FAIL' -Message 'schemaVersion must be 1.0.0'
    }
    if ($allowedStatuses -notcontains $json.status) {
        Add-Check -Checks ([ref]$checks) -Name "approval:$($file.Name)" -Status 'FAIL' -Message 'invalid approval status'
    }
    if ([string]::IsNullOrWhiteSpace($json.reason)) {
        Add-Check -Checks ([ref]$checks) -Name "approval:$($file.Name)" -Status 'FAIL' -Message 'approval reason is required'
    }
    Add-Check -Checks ([ref]$checks) -Name "approval:$($file.Name)" -Status 'PASS' -Message "approval state modeled as $($json.status)"
}

$reportPath = New-ValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
