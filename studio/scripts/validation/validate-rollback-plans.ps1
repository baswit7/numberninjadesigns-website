[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'execution-validation-lib.ps1')

$failures = New-Object System.Collections.Generic.List[string]
$checks = New-Object System.Collections.Generic.List[object]
$registry = Read-ExecutionJson -RelativePath 'services/execution-governance/rollback-engine/rollback-plans.json' -Failures $failures

if ($null -ne $registry) {
    Test-ExecutionRequiredFields -Value $registry -RequiredFields @('schemaVersion', 'registryId', 'rollbackPlans', 'executionAllowed', 'nonExecutableMetadata') -Label 'Rollback registry' -Failures $failures
    Test-ExecutionAllowedFalse -Value $registry -Label 'Rollback registry' -Failures $failures
    Test-ExecutionNonExecutableMetadata -Value $registry -Label 'Rollback registry' -Failures $failures
    $validReadiness = @('ready', 'partial', 'missing', 'not-reversible')
    foreach ($plan in @($registry.rollbackPlans)) {
        Test-ExecutionRequiredFields -Value $plan -RequiredFields @('schemaVersion', 'rollbackPlanId', 'requestId', 'readiness', 'reversible', 'preconditions', 'rollbackSteps', 'validationChecks', 'executionAllowed', 'nonExecutableMetadata') -Label "Rollback plan '$($plan.rollbackPlanId)'" -Failures $failures
        Test-ExecutionAllowedFalse -Value $plan -Label "Rollback plan '$($plan.rollbackPlanId)'" -Failures $failures
        Test-ExecutionNonExecutableMetadata -Value $plan -Label "Rollback plan '$($plan.rollbackPlanId)'" -Failures $failures
        Test-ExecutionSafeStrings -Value $plan -Label "Rollback plan '$($plan.rollbackPlanId)'" -Failures $failures
        if ($validReadiness -notcontains $plan.readiness) {
            Add-ExecutionFailure -Failures $failures -Message "Rollback plan '$($plan.rollbackPlanId)' has invalid readiness '$($plan.readiness)'."
        }
        if (@($plan.validationChecks).Count -lt 1) {
            Add-ExecutionFailure -Failures $failures -Message "Rollback plan '$($plan.rollbackPlanId)' must include validation checks."
        }
    }
    $checks.Add([ordered]@{ id = 'rollback-plans'; status = 'checked'; plans = @($registry.rollbackPlans).Count }) | Out-Null
}

Complete-ExecutionValidation -Failures $failures -Checks $checks -ReportName 'rollback-plan-validation' -FailureTitle 'Phase 9 rollback plan validation failed.' -SuccessMessage 'Phase 9 rollback plans passed deterministic checks.'
