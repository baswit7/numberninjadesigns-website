[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$contractPath = Join-Path $repositoryRoot 'shared/contracts/execution-review/execution-review.contract.json'
$preflightDecisionsPath = Join-Path $repositoryRoot 'runtime/execution-preflight/execution-preflight.decisions.json'
$preflightReportPath = Join-Path $repositoryRoot 'runtime/execution-preflight/execution-preflight.report.json'
$runtimeDir = Join-Path $repositoryRoot 'runtime/execution-review'
$recordsPath = Join-Path $runtimeDir 'execution-review.records.json'
$auditPath = Join-Path $runtimeDir 'execution-review.audit.json'
$reportPath = Join-Path $runtimeDir 'execution-review.report.json'

if (-not (Test-Path -LiteralPath $contractPath -PathType Leaf)) {
    throw "Execution review contract missing: $contractPath"
}
if (-not (Test-Path -LiteralPath $preflightDecisionsPath -PathType Leaf)) {
    throw "Execution preflight decisions missing: $preflightDecisionsPath"
}
if (-not (Test-Path -LiteralPath $preflightReportPath -PathType Leaf)) {
    throw "Execution preflight report missing: $preflightReportPath"
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

$contract = Get-Content -LiteralPath $contractPath -Raw | ConvertFrom-Json
$preflightDecisions = Get-Content -LiteralPath $preflightDecisionsPath -Raw | ConvertFrom-Json
$preflightReport = Get-Content -LiteralPath $preflightReportPath -Raw | ConvertFrom-Json
$generatedAt = '2026-06-09T00:00:00.0000000Z'

function New-ReviewBlocker {
    param(
        [Parameter(Mandatory)][string]$Status,
        [Parameter(Mandatory)][string]$Reason
    )

    [ordered]@{
        role = 'ManualReview'
        status = $Status
        reason = $Reason
    }
}

$records = @($preflightDecisions.decisions | ForEach-Object {
    $reviewState = 'UNKNOWN'
    $result = 'unknown'
    $manualEvidence = @()
    $manualEvidencePresent = $false
    $blockers = @()
    foreach ($blocker in @($_.blockers)) {
        $blockers += $blocker
    }

    if ($_.preflightState -eq 'READY_FOR_MANUAL_REVIEW') {
        $reviewState = 'PENDING_REVIEW'
        $result = 'pending-human-review'
        $blockers += New-ReviewBlocker -Status 'manual-review-required' -Reason 'Explicit manual review evidence is required before APPROVED_FOR_DISPATCH can exist.'
    }
    elseif ($_.preflightState -eq 'BLOCKED') {
        $reviewState = 'BLOCKED'
        $result = 'blocked-by-preflight'
        $blockers += New-ReviewBlocker -Status 'preflight-blocked' -Reason 'BLOCKED preflight decisions remain BLOCKED at manual review.'
    }
    elseif ($_.preflightState -eq 'FAILED') {
        $reviewState = 'REJECTED'
        $result = 'rejected-by-failed-preflight'
        $blockers += New-ReviewBlocker -Status 'preflight-failed' -Reason 'FAILED preflight decisions cannot enter pending review.'
    }
    else {
        $reviewState = 'BLOCKED'
        $result = 'blocked-by-unsupported-preflight-state'
        $blockers += New-ReviewBlocker -Status 'unsupported-preflight-state' -Reason 'Only READY_FOR_MANUAL_REVIEW preflight decisions may become PENDING_REVIEW.'
    }

    [ordered]@{
        timestamp = $generatedAt
        reviewId = "REV-$($_.preflightId)"
        preflightId = $_.preflightId
        requestId = $_.requestId
        sourceApprovalId = $_.sourceApprovalId
        preflightState = $_.preflightState
        reviewState = $reviewState
        requestedAction = $_.requestedAction
        targetSystem = $_.targetSystem
        riskClassification = $_.riskClassification
        manualReviewRequired = $true
        manualEvidencePresent = $manualEvidencePresent
        requiredManualEvidence = @($contract.requiredManualEvidence)
        manualEvidence = $manualEvidence
        executionDispatchAllowed = $false
        result = $result
        evidence = @(
            "Review gate consumed $($contract.preflightDecisionInput).",
            'Review gate did not execute, dispatch, mutate approvals, mutate packages, or mutate preflight decisions.',
            "Preflight state was $($_.preflightState)."
        )
        blockers = @($blockers)
    }
})

$pending = @($records | Where-Object { $_['reviewState'] -eq 'PENDING_REVIEW' })
$blocked = @($records | Where-Object { $_['reviewState'] -eq 'BLOCKED' })
$rejected = @($records | Where-Object { $_['reviewState'] -eq 'REJECTED' })
$approved = @($records | Where-Object { $_['reviewState'] -eq 'APPROVED_FOR_DISPATCH' })
$unknownApproved = @($records | Where-Object { $_['preflightState'] -eq 'UNKNOWN' -and $_['reviewState'] -eq 'APPROVED_FOR_DISPATCH' })
$approvedWithoutEvidence = @($records | Where-Object { $_['reviewState'] -eq 'APPROVED_FOR_DISPATCH' -and $_['manualEvidencePresent'] -ne $true })
$dispatchAllowed = @($records | Where-Object { $_['executionDispatchAllowed'] -ne $false })

$recordDocument = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    capability = $contract.capability
    sourceFile = 'shared/contracts/execution-review/execution-review.contract.json'
    preflightDecisionInput = 'runtime/execution-preflight/execution-preflight.decisions.json'
    preflightReportInput = 'runtime/execution-preflight/execution-preflight.report.json'
    allowedReviewStates = @($contract.allowedReviewStates)
    records = $records
}

$audit = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    capability = $contract.capability
    auditRequired = $true
    entries = @($records | ForEach-Object {
        [ordered]@{
            timestamp = $_['timestamp']
            reviewId = $_['reviewId']
            preflightId = $_['preflightId']
            requestId = $_['requestId']
            sourceApprovalId = $_['sourceApprovalId']
            preflightState = $_['preflightState']
            reviewState = $_['reviewState']
            requestedAction = $_['requestedAction']
            targetSystem = $_['targetSystem']
            riskClassification = $_['riskClassification']
            manualEvidencePresent = $_['manualEvidencePresent']
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
        totalRecords = @($records).Count
        pendingReview = @($pending).Count
        blocked = @($blocked).Count
        rejected = @($rejected).Count
        approvedForDispatch = @($approved).Count
        unknownApprovedAutomatically = @($unknownApproved).Count -gt 0
        approvedForDispatchWithoutManualEvidence = @($approvedWithoutEvidence).Count
        executionDispatchAllowed = @($dispatchAllowed).Count
        executionPerformed = $false
        preflightMutated = $false
        requestPackagesMutated = $false
        approvalsMutated = $false
        externalCallsMade = $false
        sourcePreflightExecutionPerformed = $preflightReport.summary.executionPerformed
    }
    reviewStates = @($contract.allowedReviewStates)
    reviewRules = $contract.reviewRules
    boundaries = $contract.boundaries
    ownership = $contract.ownership
    recordsFile = 'runtime/execution-review/execution-review.records.json'
    auditFile = 'runtime/execution-review/execution-review.audit.json'
}

$jsonOptions = @{ Depth = 60 }
$recordDocument | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $recordsPath -Encoding UTF8
$audit | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $auditPath -Encoding UTF8
$report | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host 'Execution review records generated: runtime/execution-review' -ForegroundColor Green
