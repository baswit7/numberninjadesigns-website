[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'execution-validation-lib.ps1')

$failures = New-Object System.Collections.Generic.List[string]
$checks = New-Object System.Collections.Generic.List[object]
$registry = Read-ExecutionJson -RelativePath 'services/execution-governance/idempotency-engine/idempotency-records.json' -Failures $failures

if ($null -ne $registry) {
    Test-ExecutionRequiredFields -Value $registry -RequiredFields @('schemaVersion', 'registryId', 'records', 'executionAllowed', 'nonExecutableMetadata') -Label 'Idempotency registry' -Failures $failures
    Test-ExecutionAllowedFalse -Value $registry -Label 'Idempotency registry' -Failures $failures
    Test-ExecutionNonExecutableMetadata -Value $registry -Label 'Idempotency registry' -Failures $failures
    $validStrategies = @('request-hash', 'business-key', 'manual-review')
    $validConflictPolicies = @('deny-conflict', 'require-review', 'allow-identical-only')
    foreach ($record in @($registry.records)) {
        Test-ExecutionRequiredFields -Value $record -RequiredFields @('schemaVersion', 'idempotencyId', 'requestId', 'idempotencyKey', 'strategy', 'replaySafe', 'dedupeWindowMinutes', 'conflictPolicy', 'executionAllowed', 'nonExecutableMetadata') -Label "Idempotency record '$($record.idempotencyId)'" -Failures $failures
        Test-ExecutionAllowedFalse -Value $record -Label "Idempotency record '$($record.idempotencyId)'" -Failures $failures
        Test-ExecutionNonExecutableMetadata -Value $record -Label "Idempotency record '$($record.idempotencyId)'" -Failures $failures
        Test-ExecutionSafeStrings -Value $record -Label "Idempotency record '$($record.idempotencyId)'" -Failures $failures
        if ($validStrategies -notcontains $record.strategy) {
            Add-ExecutionFailure -Failures $failures -Message "Idempotency record '$($record.idempotencyId)' has invalid strategy '$($record.strategy)'."
        }
        if ($validConflictPolicies -notcontains $record.conflictPolicy) {
            Add-ExecutionFailure -Failures $failures -Message "Idempotency record '$($record.idempotencyId)' has invalid conflictPolicy '$($record.conflictPolicy)'."
        }
    }
    $checks.Add([ordered]@{ id = 'idempotency-records'; status = 'checked'; records = @($registry.records).Count }) | Out-Null
}

Complete-ExecutionValidation -Failures $failures -Checks $checks -ReportName 'idempotency-record-validation' -FailureTitle 'Phase 9 idempotency record validation failed.' -SuccessMessage 'Phase 9 idempotency records passed deterministic checks.'
