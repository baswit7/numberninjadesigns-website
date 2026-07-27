[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runtimeDir = Join-Path $repositoryRoot 'runtime/dashboard'
$viewPath = Join-Path $runtimeDir 'execution-control.view.json'
$generatedAt = '2026-06-09T00:00:00.0000000Z'

$sources = [ordered]@{
    requestPackages = 'runtime/execution-request/execution-request.packages.json'
    requestReport = 'runtime/execution-request/execution-request.report.json'
    approvalRecords = 'runtime/approval/execution-approval.records.json'
    approvalReport = 'runtime/approval/execution-approval.report.json'
    preflightDecisions = 'runtime/execution-preflight/execution-preflight.decisions.json'
    preflightReport = 'runtime/execution-preflight/execution-preflight.report.json'
    reviewRecords = 'runtime/execution-review/execution-review.records.json'
    reviewReport = 'runtime/execution-review/execution-review.report.json'
    dispatchRegistry = 'runtime/execution-dispatch/execution-dispatch.registry.json'
    dispatchReport = 'runtime/execution-dispatch/execution-dispatch.report.json'
    auditReport = 'runtime/execution-audit/audit.report.json'
    auditSummary = 'runtime/execution-audit/audit.summary.json'
    auditBoundary = 'runtime/execution-audit/audit.boundary.json'
}

function Read-Json {
    param([Parameter(Mandatory)][string]$RelativePath)

    $path = Join-Path $repositoryRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Dashboard source missing: $RelativePath"
    }
    return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
}

function Count-Where {
    param(
        [Parameter(Mandatory)][object[]]$Items,
        [Parameter(Mandatory)][scriptblock]$Predicate
    )

    return @($Items | Where-Object $Predicate).Count
}

$requestPackages = Read-Json -RelativePath $sources.requestPackages
$requestReport = Read-Json -RelativePath $sources.requestReport
$approvalRecords = Read-Json -RelativePath $sources.approvalRecords
$approvalReport = Read-Json -RelativePath $sources.approvalReport
$preflightDecisions = Read-Json -RelativePath $sources.preflightDecisions
$preflightReport = Read-Json -RelativePath $sources.preflightReport
$reviewRecords = Read-Json -RelativePath $sources.reviewRecords
$reviewReport = Read-Json -RelativePath $sources.reviewReport
$dispatchRegistry = Read-Json -RelativePath $sources.dispatchRegistry
$dispatchReport = Read-Json -RelativePath $sources.dispatchReport
$auditReport = Read-Json -RelativePath $sources.auditReport
$auditSummary = Read-Json -RelativePath $sources.auditSummary
$auditBoundary = Read-Json -RelativePath $sources.auditBoundary

$packages = @($requestPackages.packages)
$approvals = @($approvalRecords.records)
$preflights = @($preflightDecisions.decisions)
$reviews = @($reviewRecords.records)
$dispatches = @($dispatchRegistry.entries)
$audits = @($auditReport.entries)

$requestStatus = [ordered]@{
    totalRequests = @($packages).Count
    approvedRequests = Count-Where -Items $packages -Predicate { $_.approvalState -eq 'APPROVED' }
    pendingRequests = Count-Where -Items $packages -Predicate { $_.approvalState -in @('REQUESTED', 'PENDING_APPROVAL') -or $_.executionReadinessState -eq 'READY_FOR_REVIEW' }
    blockedRequests = Count-Where -Items $packages -Predicate { $_.executionReadinessState -eq 'BLOCKED' }
    unknownRequests = Count-Where -Items $packages -Predicate { $_.approvalState -eq 'UNKNOWN' -or $_.executionReadinessState -eq 'UNKNOWN' }
}

$approvalStatus = [ordered]@{
    approved = $approvalReport.summary.approvedRecords
    blocked = $approvalReport.summary.blockedRecords
    unknown = $approvalReport.summary.unknownRecords
    automaticApproval = $approvalReport.summary.autoApprovalAllowed
    unknownAutoApproved = $approvalReport.summary.unknownAutoApproved
}

$preflightStatus = [ordered]@{
    readyForManualReview = $preflightReport.summary.readyForManualReview
    blocked = $preflightReport.summary.blocked
    failed = $preflightReport.summary.failed
    unknownPassedAutomatically = $preflightReport.summary.unknownPassedAutomatically
    executionDispatchAllowed = $preflightReport.summary.executionDispatchAllowed
}

$reviewStatus = [ordered]@{
    pendingReview = $reviewReport.summary.pendingReview
    blocked = $reviewReport.summary.blocked
    rejected = $reviewReport.summary.rejected
    approvedForDispatch = $reviewReport.summary.approvedForDispatch
    approvedForDispatchWithoutManualEvidence = $reviewReport.summary.approvedForDispatchWithoutManualEvidence
    executionDispatchAllowed = $reviewReport.summary.executionDispatchAllowed
}

$dispatchStatus = [ordered]@{
    dispatchEligible = $dispatchReport.summary.dispatchEligible
    dispatchDenied = $dispatchReport.summary.dispatchDenied
    blocked = $dispatchReport.summary.blocked
    unknownDispatchEligible = $dispatchReport.summary.unknownDispatchEligible
    triggeredActions = $dispatchReport.summary.triggeredActions
}

$auditStatus = [ordered]@{
    totalAuditEntries = $auditSummary.totalAuditEntries
    passCount = $auditSummary.passCount
    unknownCount = $auditSummary.unknownCount
    unknownPassCount = $auditSummary.unknownPassCount
    unknownDispatchEligibleCount = $auditSummary.unknownDispatchEligibleCount
    automaticApprovalCount = $auditSummary.automaticApprovalCount
}

$manualEvidenceStatus = [ordered]@{
    manualEvidenceRequired = $auditSummary.manualEvidenceRequiredCount
    manualEvidencePresent = $auditSummary.manualEvidencePresentCount
    manualEvidenceVerified = $auditSummary.manualEvidenceVerifiedCount
    eligibleWithoutVerifiedManualEvidence = $auditSummary.eligibleWithoutVerifiedManualEvidence
}

$unknownSummary = [ordered]@{
    unknownRequests = $requestStatus.unknownRequests
    approvalUnknown = $approvalStatus.unknown
    auditUnknown = $auditStatus.unknownCount
    unknownPassCount = $auditStatus.unknownPassCount
    unknownDispatchEligibleCount = $auditStatus.unknownDispatchEligibleCount
    unknownRemainsUnknown = ($auditStatus.unknownPassCount -eq 0 -and $auditStatus.unknownDispatchEligibleCount -eq 0)
}

$boundarySummary = [ordered]@{
    readOnlyDashboard = $true
    visualizationOnly = $true
    ownsTruth = $false
    ownsExecutionTruth = $false
    ownsApprovalTruth = $false
    ownsPreflightTruth = $false
    ownsReviewTruth = $false
    ownsDispatchTruth = $false
    ownsAuditTruth = $false
    performsExecution = $false
    executionEngine = $false
    dispatchEngine = $false
    providerExecution = $false
    githubExecution = $false
    deploymentExecution = $false
    approvalMutation = $false
    dispatchMutation = $false
    runtimeMutation = $false
    queues = $false
    workers = $false
    schedulers = $false
    backgroundJobs = $false
    agentExecution = $false
    credentialAccess = $false
    secretAccess = $false
    branchWrites = $false
    repositorySettingsMutation = $false
    collaboratorMutation = $false
    localStorageAuthority = $false
    sessionStorageAuthority = $false
    actionEndpoints = $false
    actionControls = $false
    writesOnly = 'runtime/dashboard/execution-control.view.json'
    consumesReportsOnly = $true
}

$cards = @(
    [ordered]@{
        id = 'execution-control.request-status'
        title = 'Request Status'
        status = if ($requestStatus.unknownRequests -gt 0) { 'warning' } else { 'ok' }
        severity = if ($requestStatus.unknownRequests -gt 0) { 'warning' } else { 'success' }
        description = "total=$($requestStatus.totalRequests); approved=$($requestStatus.approvedRequests); pending=$($requestStatus.pendingRequests); blocked=$($requestStatus.blockedRequests); unknown=$($requestStatus.unknownRequests)"
        sourceFile = $sources.requestPackages
        lastUpdated = $generatedAt
        actionHint = 'Read-only execution governance visibility; dashboard cannot approve, dispatch or execute.'
        details = $requestStatus
    },
    [ordered]@{
        id = 'execution-control.approval-status'
        title = 'Approval Status'
        status = if ($approvalStatus.unknown -gt 0) { 'warning' } else { 'ok' }
        severity = if ($approvalStatus.unknown -gt 0) { 'warning' } else { 'success' }
        description = "approved=$($approvalStatus.approved); blocked=$($approvalStatus.blocked); unknown=$($approvalStatus.unknown); automaticApproval=$($approvalStatus.automaticApproval)"
        sourceFile = $sources.approvalReport
        lastUpdated = $generatedAt
        actionHint = 'Approval truth remains owned by the approval gateway.'
        details = $approvalStatus
    },
    [ordered]@{
        id = 'execution-control.preflight-status'
        title = 'Preflight Status'
        status = if ($preflightStatus.blocked -gt 0) { 'warning' } else { 'ok' }
        severity = if ($preflightStatus.blocked -gt 0) { 'warning' } else { 'success' }
        description = "readyForManualReview=$($preflightStatus.readyForManualReview); blocked=$($preflightStatus.blocked); failed=$($preflightStatus.failed)"
        sourceFile = $sources.preflightReport
        lastUpdated = $generatedAt
        actionHint = 'Preflight truth remains owned by the preflight gate.'
        details = $preflightStatus
    },
    [ordered]@{
        id = 'execution-control.review-status'
        title = 'Review Status'
        status = if ($reviewStatus.pendingReview -gt 0 -or $reviewStatus.blocked -gt 0) { 'warning' } else { 'ok' }
        severity = if ($reviewStatus.pendingReview -gt 0 -or $reviewStatus.blocked -gt 0) { 'warning' } else { 'success' }
        description = "pending=$($reviewStatus.pendingReview); blocked=$($reviewStatus.blocked); approvedForDispatch=$($reviewStatus.approvedForDispatch)"
        sourceFile = $sources.reviewReport
        lastUpdated = $generatedAt
        actionHint = 'Manual review remains outside the dashboard projection.'
        details = $reviewStatus
    },
    [ordered]@{
        id = 'execution-control.dispatch-status'
        title = 'Dispatch Status'
        status = if ($dispatchStatus.dispatchEligible -gt 0) { 'warning' } else { 'ok' }
        severity = if ($dispatchStatus.dispatchEligible -gt 0) { 'warning' } else { 'success' }
        description = "eligible=$($dispatchStatus.dispatchEligible); denied=$($dispatchStatus.dispatchDenied); triggeredActions=$($dispatchStatus.triggeredActions)"
        sourceFile = $sources.dispatchReport
        lastUpdated = $generatedAt
        actionHint = 'Dashboard does not dispatch; dispatch registry remains source for eligibility.'
        details = $dispatchStatus
    },
    [ordered]@{
        id = 'execution-control.audit-status'
        title = 'Audit Status'
        status = if ($auditStatus.unknownCount -gt 0) { 'warning' } else { 'ok' }
        severity = if ($auditStatus.unknownCount -gt 0) { 'warning' } else { 'success' }
        description = "entries=$($auditStatus.totalAuditEntries); pass=$($auditStatus.passCount); unknown=$($auditStatus.unknownCount)"
        sourceFile = $sources.auditSummary
        lastUpdated = $generatedAt
        actionHint = 'Audit trail remains derived evidence, not execution authority.'
        details = $auditStatus
    },
    [ordered]@{
        id = 'execution-control.manual-evidence-status'
        title = 'Manual Evidence Status'
        status = if ($manualEvidenceStatus.manualEvidenceVerified -eq 0) { 'warning' } else { 'ok' }
        severity = if ($manualEvidenceStatus.manualEvidenceVerified -eq 0) { 'warning' } else { 'success' }
        description = "required=$($manualEvidenceStatus.manualEvidenceRequired); present=$($manualEvidenceStatus.manualEvidencePresent); verified=$($manualEvidenceStatus.manualEvidenceVerified)"
        sourceFile = $sources.auditSummary
        lastUpdated = $generatedAt
        actionHint = 'Manual evidence must be supplied outside the dashboard projection.'
        details = $manualEvidenceStatus
    }
)

$view = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $generatedAt
    source = 'execution-control-dashboard:derived-governance-runtime'
    sourceFiles = $sources
    status = if ($unknownSummary.unknownRemainsUnknown -and $boundarySummary.readOnlyDashboard) { 'ok' } else { 'warning' }
    readOnly = $true
    projectionOnly = $true
    ownsTruth = $false
    summary = [ordered]@{
        totalRequests = $requestStatus.totalRequests
        approvedRequests = $requestStatus.approvedRequests
        pendingRequests = $requestStatus.pendingRequests
        blockedRequests = $requestStatus.blockedRequests
        unknownRequests = $requestStatus.unknownRequests
        dispatchEligible = $dispatchStatus.dispatchEligible
        dispatchDenied = $dispatchStatus.dispatchDenied
        manualEvidenceRequired = $manualEvidenceStatus.manualEvidenceRequired
        manualEvidencePresent = $manualEvidenceStatus.manualEvidencePresent
        manualEvidenceVerified = $manualEvidenceStatus.manualEvidenceVerified
        unknownCount = $unknownSummary.auditUnknown
    }
    statusSummary = [ordered]@{
        requestStatus = $requestStatus
        approvalStatus = $approvalStatus
        preflightStatus = $preflightStatus
        reviewStatus = $reviewStatus
        dispatchStatus = $dispatchStatus
    }
    auditSummary = $auditStatus
    evidenceSummary = $manualEvidenceStatus
    unknownSummary = $unknownSummary
    boundarySummary = $boundarySummary
    cards = $cards
    warnings = @(
        'UNKNOWN states are displayed as UNKNOWN and are never promoted by the dashboard.',
        'Manual evidence is not present or verified in the current runtime proof.'
    )
    errors = @()
    nextRecommendedAction = 'Use this read-only dashboard projection for governance visibility only; continue to use source layers for truth.'
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$view | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $viewPath -Encoding UTF8

Write-Host 'Execution control dashboard view generated: runtime/dashboard/execution-control.view.json' -ForegroundColor Green
