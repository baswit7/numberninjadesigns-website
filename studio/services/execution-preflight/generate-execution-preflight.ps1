[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$contractPath = Join-Path $repositoryRoot 'shared/contracts/execution-preflight/execution-preflight.contract.json'
$packagesPath = Join-Path $repositoryRoot 'runtime/execution-request/execution-request.packages.json'
$requestReportPath = Join-Path $repositoryRoot 'runtime/execution-request/execution-request.report.json'
$runtimeDir = Join-Path $repositoryRoot 'runtime/execution-preflight'
$decisionsPath = Join-Path $runtimeDir 'execution-preflight.decisions.json'
$auditPath = Join-Path $runtimeDir 'execution-preflight.audit.json'
$reportPath = Join-Path $runtimeDir 'execution-preflight.report.json'

if (-not (Test-Path -LiteralPath $contractPath -PathType Leaf)) {
    throw "Execution preflight contract missing: $contractPath"
}
if (-not (Test-Path -LiteralPath $packagesPath -PathType Leaf)) {
    throw "Execution request packages missing: $packagesPath"
}
if (-not (Test-Path -LiteralPath $requestReportPath -PathType Leaf)) {
    throw "Execution request report missing: $requestReportPath"
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

$contract = Get-Content -LiteralPath $contractPath -Raw | ConvertFrom-Json
$packageDocument = Get-Content -LiteralPath $packagesPath -Raw | ConvertFrom-Json
$requestReport = Get-Content -LiteralPath $requestReportPath -Raw | ConvertFrom-Json
$generatedAt = '2026-06-09T00:00:00.0000000Z'

function Test-ArrayContainsAll {
    param(
        [Parameter(Mandatory)]$Actual,
        [Parameter(Mandatory)]$Expected
    )

    foreach ($item in @($Expected)) {
        if ($item -notin @($Actual)) {
            return $false
        }
    }
    return $true
}

function New-Blocker {
    param(
        [Parameter(Mandatory)][string]$Status,
        [Parameter(Mandatory)][string]$Reason
    )

    [ordered]@{
        role = 'Preflight'
        status = $Status
        reason = $Reason
    }
}

$decisions = @($packageDocument.packages | ForEach-Object {
    $dispatchSafe = $_.executionDispatchAllowed -eq $false
    $validatorsPresent = Test-ArrayContainsAll -Actual $_.requiredValidators -Expected $contract.requiredPackageValidators
    $evidencePresent = Test-ArrayContainsAll -Actual $_.requiredEvidence -Expected $contract.requiredPackageEvidence
    $deniedActionRequested = $_.allowedActionType -in @($_.deniedActionTypes)
    $blockedPackage = $_.executionReadinessState -eq 'BLOCKED'
    $unknownApproval = $_.approvalState -eq 'UNKNOWN'
    $readyForReview = $_.executionReadinessState -eq 'READY_FOR_REVIEW'

    $blockers = @()
    foreach ($blocker in @($_.blockers)) {
        $blockers += $blocker
    }

    if (-not $dispatchSafe) {
        $blockers += New-Blocker -Status 'dispatch-enabled-fail' -Reason 'Packages with executionDispatchAllowed other than false must fail preflight.'
    }
    if (-not $validatorsPresent) {
        $blockers += New-Blocker -Status 'required-validator-missing' -Reason 'Package does not include all required validators.'
    }
    if (-not $evidencePresent) {
        $blockers += New-Blocker -Status 'required-evidence-missing' -Reason 'Package does not include all required evidence labels.'
    }
    if ($deniedActionRequested) {
        $blockers += New-Blocker -Status 'denied-action-requested' -Reason 'Requested action appears in the package denied action type list.'
    }
    if ($unknownApproval) {
        $blockers += New-Blocker -Status 'unknown-approval-block' -Reason 'UNKNOWN approval state never passes automatically.'
    }
    if ($blockedPackage) {
        $blockers += New-Blocker -Status 'package-blocked' -Reason 'BLOCKED request packages remain BLOCKED at preflight.'
    }

    $preflightState = 'UNKNOWN'
    $result = 'unknown'
    if (-not $dispatchSafe -or -not $validatorsPresent -or -not $evidencePresent -or $deniedActionRequested) {
        $preflightState = 'FAILED'
        $result = 'failed-preflight'
    }
    elseif ($blockedPackage -or $unknownApproval) {
        $preflightState = 'BLOCKED'
        $result = 'blocked-by-package-state'
    }
    elseif ($readyForReview) {
        $preflightState = 'READY_FOR_MANUAL_REVIEW'
        $result = 'passed-preflight-ready-for-manual-review'
    }
    else {
        $preflightState = 'FAILED'
        $result = 'unsupported-package-readiness-state'
        $blockers += New-Blocker -Status 'unsupported-readiness-state' -Reason 'Only READY_FOR_REVIEW packages may become READY_FOR_MANUAL_REVIEW.'
    }

    [ordered]@{
        timestamp = $generatedAt
        preflightId = "PFG-$($_.requestId)"
        requestId = $_.requestId
        sourceApprovalId = $_.sourceApprovalId
        approvalState = $_.approvalState
        requestedAction = $_.requestedAction
        targetSystem = $_.targetSystem
        packageReadinessState = $_.executionReadinessState
        preflightState = $preflightState
        riskClassification = $_.riskClassification
        executionDispatchAllowed = $false
        result = $result
        checks = [ordered]@{
            dispatchDisabled = $dispatchSafe
            requiredValidatorsPresent = $validatorsPresent
            requiredEvidencePresent = $evidencePresent
            requestedActionNotDenied = -not $deniedActionRequested
            unknownDidNotPass = -not ($unknownApproval -and $preflightState -eq 'PASSED')
            blockedRemainedBlocked = -not ($blockedPackage -and $preflightState -ne 'BLOCKED' -and $preflightState -ne 'FAILED')
            readyForManualReviewDoesNotExecute = $true
            passedDoesNotExecute = $true
        }
        evidence = @(
            "Preflight consumed $($contract.packageInput).",
            'Preflight did not execute, dispatch, mutate approvals, or mutate request packages.',
            "Package readiness state was $($_.executionReadinessState)."
        )
        blockers = @($blockers)
    }
})

$readyForManualReview = @($decisions | Where-Object { $_['preflightState'] -eq 'READY_FOR_MANUAL_REVIEW' })
$blocked = @($decisions | Where-Object { $_['preflightState'] -eq 'BLOCKED' })
$failed = @($decisions | Where-Object { $_['preflightState'] -eq 'FAILED' })
$unknownPassed = @($decisions | Where-Object { $_['approvalState'] -eq 'UNKNOWN' -and $_['preflightState'] -eq 'PASSED' })
$dispatchAllowed = @($decisions | Where-Object { $_['executionDispatchAllowed'] -ne $false })

$decisionDocument = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    capability = $contract.capability
    sourceFile = 'shared/contracts/execution-preflight/execution-preflight.contract.json'
    packageInput = 'runtime/execution-request/execution-request.packages.json'
    packageReportInput = 'runtime/execution-request/execution-request.report.json'
    allowedPreflightStates = @($contract.allowedPreflightStates)
    decisions = $decisions
}

$audit = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    capability = $contract.capability
    auditRequired = $true
    entries = @($decisions | ForEach-Object {
        [ordered]@{
            timestamp = $_['timestamp']
            preflightId = $_['preflightId']
            requestId = $_['requestId']
            sourceApprovalId = $_['sourceApprovalId']
            approvalState = $_['approvalState']
            requestedAction = $_['requestedAction']
            targetSystem = $_['targetSystem']
            packageReadinessState = $_['packageReadinessState']
            preflightState = $_['preflightState']
            riskClassification = $_['riskClassification']
            executionDispatchAllowed = $_['executionDispatchAllowed']
            result = $_['result']
            blockers = @($_['blockers'])
        }
    })
    boundaries = $contract.boundaries
    ownership = $contract.ownership
}

$report = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    capability = $contract.capability
    status = 'ok'
    summary = [ordered]@{
        totalDecisions = @($decisions).Count
        readyForManualReview = @($readyForManualReview).Count
        blocked = @($blocked).Count
        failed = @($failed).Count
        unknownPassedAutomatically = @($unknownPassed).Count -gt 0
        executionDispatchAllowed = @($dispatchAllowed).Count
        executionPerformed = $false
        requestPackagesMutated = $false
        externalCallsMade = $false
        sourcePackageReportExecutionDispatched = $requestReport.summary.executionDispatched
    }
    preflightStates = @($contract.allowedPreflightStates)
    preflightRules = $contract.preflightRules
    boundaries = $contract.boundaries
    ownership = $contract.ownership
    decisionsFile = 'runtime/execution-preflight/execution-preflight.decisions.json'
    auditFile = 'runtime/execution-preflight/execution-preflight.audit.json'
}

$jsonOptions = @{ Depth = 60 }
$decisionDocument | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $decisionsPath -Encoding UTF8
$audit | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $auditPath -Encoding UTF8
$report | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host 'Execution preflight decisions generated: runtime/execution-preflight' -ForegroundColor Green
