[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'execution-validation-lib.ps1')

$failures = New-Object System.Collections.Generic.List[string]
$checks = New-Object System.Collections.Generic.List[object]
$registry = Read-ExecutionJson -RelativePath 'services/execution-governance/approval-engine/approval-registry.json' -Failures $failures

if ($null -ne $registry) {
    Test-ExecutionRequiredFields -Value $registry -RequiredFields @('schemaVersion', 'registryId', 'approvals', 'executionAllowed', 'nonExecutableMetadata') -Label 'Approval registry' -Failures $failures
    Test-ExecutionAllowedFalse -Value $registry -Label 'Approval registry' -Failures $failures
    Test-ExecutionNonExecutableMetadata -Value $registry -Label 'Approval registry' -Failures $failures
    $validStates = @('missing', 'pending', 'approved_for_review', 'denied', 'expired')
    foreach ($approval in @($registry.approvals)) {
        Test-ExecutionRequiredFields -Value $approval -RequiredFields @('schemaVersion', 'approvalId', 'requestId', 'approvalState', 'reason', 'executionAllowed', 'nonExecutableMetadata') -Label "Approval '$($approval.approvalId)'" -Failures $failures
        Test-ExecutionAllowedFalse -Value $approval -Label "Approval '$($approval.approvalId)'" -Failures $failures
        Test-ExecutionNonExecutableMetadata -Value $approval -Label "Approval '$($approval.approvalId)'" -Failures $failures
        Test-ExecutionSafeStrings -Value $approval -Label "Approval '$($approval.approvalId)'" -Failures $failures
        if ($validStates -notcontains $approval.approvalState) {
            Add-ExecutionFailure -Failures $failures -Message "Approval '$($approval.approvalId)' has invalid approvalState '$($approval.approvalState)'."
        }
    }
    $checks.Add([ordered]@{ id = 'approval-registry'; status = 'checked'; approvals = @($registry.approvals).Count }) | Out-Null
}

Complete-ExecutionValidation -Failures $failures -Checks $checks -ReportName 'approval-registry-validation' -FailureTitle 'Phase 9 approval registry validation failed.' -SuccessMessage 'Phase 9 approval registry passed deterministic checks.'
