[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'execution-validation-lib.ps1')

$failures = New-Object System.Collections.Generic.List[string]
$checks = New-Object System.Collections.Generic.List[object]
$contracts = @(
    'execution-request.schema.json',
    'approval-record.schema.json',
    'risk-assessment.schema.json',
    'rollback-plan.schema.json',
    'execution-policy.schema.json',
    'idempotency-record.schema.json'
)

foreach ($contract in $contracts) {
    $relativePath = "shared/contracts/execution/$contract"
    $schema = Read-ExecutionJson -RelativePath $relativePath -Failures $failures
    if ($null -eq $schema) {
        continue
    }
    Test-ExecutionSchema -Schema $schema -Label $contract -Failures $failures
    Test-ExecutionSafeStrings -Value $schema -Label $contract -Failures $failures
    $checks.Add([ordered]@{ id = $contract; status = 'checked' }) | Out-Null
}

$request = Read-ExecutionJson -RelativePath 'services/execution-governance/execution-request.example.json' -Failures $failures
if ($null -ne $request) {
    Test-ExecutionRequiredFields -Value $request -RequiredFields @('schemaVersion', 'requestId', 'createdAt', 'requestedAction', 'target', 'forbiddenCapabilities', 'executionAllowed', 'nonExecutableMetadata') -Label 'Execution request example' -Failures $failures
    Test-ExecutionAllowedFalse -Value $request -Label 'Execution request example' -Failures $failures
    Test-ExecutionNonExecutableMetadata -Value $request -Label 'Execution request example' -Failures $failures
    Test-ExecutionSafeStrings -Value $request -Label 'Execution request example' -Failures $failures
    $checks.Add([ordered]@{ id = 'execution-request-example'; status = 'checked' }) | Out-Null
}

Complete-ExecutionValidation -Failures $failures -Checks $checks -ReportName 'execution-contract-validation' -FailureTitle 'Phase 9 execution contract validation failed.' -SuccessMessage "Phase 9 execution contracts passed deterministic checks. Checked $($contracts.Count) schemas."
