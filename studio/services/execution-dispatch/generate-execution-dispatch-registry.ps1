[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$contractPath = Join-Path $repositoryRoot 'shared/contracts/execution-dispatch/execution-dispatch.contract.json'
$reviewRecordsPath = Join-Path $repositoryRoot 'runtime/execution-review/execution-review.records.json'
$reviewReportPath = Join-Path $repositoryRoot 'runtime/execution-review/execution-review.report.json'
$runtimeDir = Join-Path $repositoryRoot 'runtime/execution-dispatch'
$registryPath = Join-Path $runtimeDir 'execution-dispatch.registry.json'
$auditPath = Join-Path $runtimeDir 'execution-dispatch.audit.json'
$reportPath = Join-Path $runtimeDir 'execution-dispatch.report.json'

if (-not (Test-Path -LiteralPath $contractPath -PathType Leaf)) {
    throw "Execution dispatch contract missing: $contractPath"
}
if (-not (Test-Path -LiteralPath $reviewRecordsPath -PathType Leaf)) {
    throw "Execution review records missing: $reviewRecordsPath"
}
if (-not (Test-Path -LiteralPath $reviewReportPath -PathType Leaf)) {
    throw "Execution review report missing: $reviewReportPath"
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

$contract = Get-Content -LiteralPath $contractPath -Raw | ConvertFrom-Json
$reviewRecords = Get-Content -LiteralPath $reviewRecordsPath -Raw | ConvertFrom-Json
$reviewReport = Get-Content -LiteralPath $reviewReportPath -Raw | ConvertFrom-Json
$generatedAt = '2026-06-09T00:00:00.0000000Z'

function New-DispatchBlocker {
    param(
        [Parameter(Mandatory)][string]$Status,
        [Parameter(Mandatory)][string]$Reason
    )

    [ordered]@{
        role = 'DispatchRegistry'
        status = $Status
        reason = $Reason
    }
}

$entries = @($reviewRecords.records | ForEach-Object {
    $dispatchState = 'UNKNOWN'
    $result = 'unknown'
    $dispatchEligible = $false
    $blockers = @()
    foreach ($blocker in @($_.blockers)) {
        $blockers += $blocker
    }

    if ($_.reviewState -eq 'APPROVED_FOR_DISPATCH') {
        $dispatchState = 'DISPATCH_ELIGIBLE'
        $result = 'eligible-for-future-dispatch'
        $dispatchEligible = $true
    }
    elseif ($_.reviewState -eq 'BLOCKED') {
        $dispatchState = 'BLOCKED'
        $result = 'blocked-by-review'
        $blockers += New-DispatchBlocker -Status 'review-blocked' -Reason 'BLOCKED review records remain BLOCKED in the dispatch registry.'
    }
    elseif ($_.reviewState -eq 'PENDING_REVIEW') {
        $dispatchState = 'DISPATCH_DENIED'
        $result = 'denied-pending-review'
        $blockers += New-DispatchBlocker -Status 'pending-review-not-dispatchable' -Reason 'PENDING_REVIEW never becomes DISPATCH_ELIGIBLE.'
    }
    elseif ($_.reviewState -eq 'REJECTED') {
        $dispatchState = 'DISPATCH_DENIED'
        $result = 'denied-rejected-review'
        $blockers += New-DispatchBlocker -Status 'review-rejected' -Reason 'Rejected review records cannot be dispatched.'
    }
    elseif ($_.reviewState -eq 'EXPIRED') {
        $dispatchState = 'EXPIRED'
        $result = 'expired-review'
        $blockers += New-DispatchBlocker -Status 'review-expired' -Reason 'Expired review records cannot be dispatched.'
    }
    else {
        $dispatchState = 'BLOCKED'
        $result = 'blocked-unknown-review-state'
        $blockers += New-DispatchBlocker -Status 'unknown-review-state' -Reason 'UNKNOWN never becomes DISPATCH_ELIGIBLE.'
    }

    [ordered]@{
        timestamp = $generatedAt
        dispatchId = "DSP-$($_.reviewId)"
        reviewId = $_.reviewId
        preflightId = $_.preflightId
        requestId = $_.requestId
        sourceApprovalId = $_.sourceApprovalId
        reviewState = $_.reviewState
        dispatchState = $dispatchState
        requestedAction = $_.requestedAction
        targetSystem = $_.targetSystem
        riskClassification = $_.riskClassification
        dispatchEligible = $dispatchEligible
        executionTriggered = $false
        providerActionTriggered = $false
        githubActionTriggered = $false
        deploymentActionTriggered = $false
        result = $result
        evidence = @(
            "Dispatch registry consumed $($contract.reviewRecordsInput).",
            'Dispatch registry records eligibility only and does not execute or dispatch.',
            "Review state was $($_.reviewState)."
        )
        blockers = @($blockers)
    }
})

$eligible = @($entries | Where-Object { $_['dispatchState'] -eq 'DISPATCH_ELIGIBLE' })
$blocked = @($entries | Where-Object { $_['dispatchState'] -eq 'BLOCKED' })
$denied = @($entries | Where-Object { $_['dispatchState'] -eq 'DISPATCH_DENIED' })
$unknownEligible = @($entries | Where-Object { $_['reviewState'] -eq 'UNKNOWN' -and $_['dispatchState'] -eq 'DISPATCH_ELIGIBLE' })
$pendingEligible = @($entries | Where-Object { $_['reviewState'] -eq 'PENDING_REVIEW' -and $_['dispatchState'] -eq 'DISPATCH_ELIGIBLE' })
$triggered = @($entries | Where-Object { $_['executionTriggered'] -ne $false -or $_['providerActionTriggered'] -ne $false -or $_['githubActionTriggered'] -ne $false -or $_['deploymentActionTriggered'] -ne $false })

$registry = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    capability = $contract.capability
    sourceFile = 'shared/contracts/execution-dispatch/execution-dispatch.contract.json'
    reviewRecordsInput = 'runtime/execution-review/execution-review.records.json'
    reviewReportInput = 'runtime/execution-review/execution-review.report.json'
    allowedDispatchStates = @($contract.allowedDispatchStates)
    entries = $entries
}

$audit = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    capability = $contract.capability
    auditRequired = $true
    entries = @($entries | ForEach-Object {
        [ordered]@{
            timestamp = $_['timestamp']
            dispatchId = $_['dispatchId']
            reviewId = $_['reviewId']
            requestId = $_['requestId']
            sourceApprovalId = $_['sourceApprovalId']
            reviewState = $_['reviewState']
            dispatchState = $_['dispatchState']
            requestedAction = $_['requestedAction']
            targetSystem = $_['targetSystem']
            dispatchEligible = $_['dispatchEligible']
            executionTriggered = $_['executionTriggered']
            providerActionTriggered = $_['providerActionTriggered']
            githubActionTriggered = $_['githubActionTriggered']
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
        totalEntries = @($entries).Count
        dispatchEligible = @($eligible).Count
        blocked = @($blocked).Count
        dispatchDenied = @($denied).Count
        unknownDispatchEligible = @($unknownEligible).Count
        pendingReviewDispatchEligible = @($pendingEligible).Count
        triggeredActions = @($triggered).Count
        executionPerformed = $false
        automaticDispatch = $false
        externalCallsMade = $false
        sourceReviewExecutionPerformed = $reviewReport.summary.executionPerformed
        sourceReviewDispatchAllowed = $reviewReport.summary.executionDispatchAllowed
    }
    dispatchStates = @($contract.allowedDispatchStates)
    dispatchRules = $contract.dispatchRules
    boundaries = $contract.boundaries
    ownership = $contract.ownership
    registryFile = 'runtime/execution-dispatch/execution-dispatch.registry.json'
    auditFile = 'runtime/execution-dispatch/execution-dispatch.audit.json'
}

$jsonOptions = @{ Depth = 60 }
$registry | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $registryPath -Encoding UTF8
$audit | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $auditPath -Encoding UTF8
$report | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host 'Execution dispatch registry generated: runtime/execution-dispatch' -ForegroundColor Green
