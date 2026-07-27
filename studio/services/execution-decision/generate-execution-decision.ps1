[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'scripts/lib/StudioRuntime.psm1') -Force

function New-DecisionBoundary {
    return [ordered]@{
        decisionOnly = $true
        readOnly = $true
        derivedOnly = $true
        reportWritingOnly = $true
        ownsDecisionReports = $true
        ownsAuthorityTruth = $false
        ownsEvidenceTruth = $false
        ownsMonitoringTruth = $false
        ownsHistoryTruth = $false
        ownsObservabilityTruth = $false
        ownsSimulationTruth = $false
        ownsReviewTruth = $false
        ownsDashboardTruth = $false
        ownsRuntimeTruth = $false
        createsApprovals = $false
        approvalWorkflowAllowed = $false
        approvalMutationAllowed = $false
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        workflowExecutionAllowed = $false
        commandExecutionAllowed = $false
        queueAllowed = $false
        workerAllowed = $false
        schedulerAllowed = $false
        repairAllowed = $false
        autoRemediationAllowed = $false
        credentialAccessAllowed = $false
        secretAccessAllowed = $false
        runtimeMutationAllowed = $false
        dashboardMutationAllowed = $false
        localStorageAuthorityAllowed = $false
        sessionStorageAuthorityAllowed = $false
        backgroundExecutionAllowed = $false
    }
}

function Convert-ToDecisionSourceStatus {
    param([AllowNull()][string]$Status)

    if ([string]::IsNullOrWhiteSpace($Status)) { return 'unknown' }
    switch ($Status.ToLowerInvariant()) {
        { $_ -in @('ok', 'pass', 'passed', 'ready') } { return 'pass' }
        { $_ -in @('warning', 'partial', 'missing', 'fail', 'failed', 'error') } { return 'warning' }
        default { return 'unknown' }
    }
}

function New-DecisionItem {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$State,
        [Parameter(Mandatory)][string]$Summary,
        [Parameter(Mandatory)][string]$Source
    )

    return [ordered]@{
        id = $Id
        state = $State
        summary = $Summary
        source = $Source
        authoritative = $false
    }
}

function Test-RequiredFieldSet {
    param(
        [AllowNull()]$Value,
        [Parameter(Mandatory)][string[]]$RequiredFields
    )

    if ($null -eq $Value) { return $false }
    foreach ($field in $RequiredFields) {
        $property = $Value.PSObject.Properties[$field]
        if ($null -eq $property -or $null -eq $property.Value) {
            return $false
        }
    }
    return $true
}

function New-ReportInput {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][string]$Role,
        [Parameter(Mandatory)][string[]]$RequiredFields,
        [int]$FreshnessHours = 24
    )

    $safe = Read-StudioJsonSafe -RelativePath $RelativePath
    $info = Get-StudioLatestRuntimeFile -RelativePath $RelativePath
    $lastModified = if ($null -eq $info) { $null } else { $info.lastModified }
    $isStale = $false
    if ($null -ne $info -and $null -ne $info.lastModified) {
        $isStale = ([datetime]$info.lastModified).ToUniversalTime() -lt (Get-Date).ToUniversalTime().AddHours(-1 * $FreshnessHours)
    }
    $isComplete = [bool]($safe.validJson -and (Test-RequiredFieldSet -Value $safe.value -RequiredFields $RequiredFields))
    $known = [bool]($safe.exists -and $safe.validJson -and $isComplete -and -not $isStale)

    $reason = "$Role is present, readable, complete and fresh."
    if (-not $safe.exists) { $reason = "$Role is missing; decision is UNKNOWN." }
    elseif (-not $safe.validJson) { $reason = "$Role is unreadable; decision is UNKNOWN." }
    elseif (-not $isComplete) { $reason = "$Role is incomplete; decision is UNKNOWN." }
    elseif ($isStale) { $reason = "$Role is stale; decision is UNKNOWN." }

    return [ordered]@{
        path = $RelativePath.Replace('\', '/')
        role = $Role
        exists = [bool]$safe.exists
        validJson = [bool]$safe.validJson
        lastModified = $lastModified
        isStale = [bool]$isStale
        isComplete = [bool]$isComplete
        verdict = if ($known) { 'known' } else { 'unknown' }
        reason = $reason
    }
}

$generatedAt = Get-StudioTimestamp

$authorityPath = 'runtime/authority/authority-read-model.report.json'
$monitoringPath = 'runtime/authority/authority-projection-monitoring.report.json'
$evidencePath = 'runtime/authority/authority-monitoring-evidence.report.json'
$historyPath = 'runtime/authority/authority-evidence-history.report.json'
$observabilityPath = 'runtime/authority/authority-observability.report.json'
$simulationPath = 'runtime/simulation/execution-simulation.report.json'
$reviewPath = 'runtime/review/simulation-review.report.json'

$inputs = @(
    New-ReportInput -RelativePath $authorityPath -Role 'Phase 16 authority read model' -RequiredFields @('schemaVersion', 'phase', 'summary', 'boundary')
    New-ReportInput -RelativePath $monitoringPath -Role 'Phase 18 projection monitoring report' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary')
    New-ReportInput -RelativePath $evidencePath -Role 'Phase 19 evidence center report' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary')
    New-ReportInput -RelativePath $historyPath -Role 'Phase 20 evidence history report' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary')
    New-ReportInput -RelativePath $observabilityPath -Role 'Phase 21 observability report' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary')
    New-ReportInput -RelativePath $simulationPath -Role 'Phase 22 execution governance simulation report' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary', 'boundary')
    New-ReportInput -RelativePath $reviewPath -Role 'Phase 23 simulation evidence review report' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary', 'boundary')
)

$authoritySafe = Read-StudioJsonSafe -RelativePath $authorityPath
$monitoringSafe = Read-StudioJsonSafe -RelativePath $monitoringPath
$evidenceSafe = Read-StudioJsonSafe -RelativePath $evidencePath
$historySafe = Read-StudioJsonSafe -RelativePath $historyPath
$observabilitySafe = Read-StudioJsonSafe -RelativePath $observabilityPath
$simulationSafe = Read-StudioJsonSafe -RelativePath $simulationPath
$reviewSafe = Read-StudioJsonSafe -RelativePath $reviewPath

$authority = if ($authoritySafe.validJson) { $authoritySafe.value } else { $null }
$monitoring = if ($monitoringSafe.validJson) { $monitoringSafe.value } else { $null }
$evidence = if ($evidenceSafe.validJson) { $evidenceSafe.value } else { $null }
$history = if ($historySafe.validJson) { $historySafe.value } else { $null }
$observability = if ($observabilitySafe.validJson) { $observabilitySafe.value } else { $null }
$simulation = if ($simulationSafe.validJson) { $simulationSafe.value } else { $null }
$review = if ($reviewSafe.validJson) { $reviewSafe.value } else { $null }

$knownInputCount = @($inputs | Where-Object { $_.verdict -eq 'known' }).Count
$unknownInputCount = @($inputs | Where-Object { $_.verdict -eq 'unknown' }).Count
$staleInputCount = @($inputs | Where-Object { $_.isStale }).Count

$sourceSimulationStatus = Convert-ToDecisionSourceStatus -Status $(if ($null -eq $simulation) { 'unknown' } else { [string]$simulation.status })
$sourceReviewStatus = Convert-ToDecisionSourceStatus -Status $(if ($null -eq $review) { 'unknown' } else { [string]$review.status })
$simulationUnknownInputCount = if ($null -eq $simulation) { 0 } else { [int]$simulation.summary.unknownInputCount }
$simulationUnknownCount = if ($null -eq $simulation) { 0 } else { [int]$simulation.summary.unknownCount }
$reviewUnknownCount = if ($null -eq $review) { 0 } else { [int]$review.summary.unknownCount }
$evidenceUnknownCount = if ($null -eq $evidence) { 0 } else { [int]$evidence.summary.unknownCount }
$observabilityUnknownCount = if ($null -eq $observability) { 0 } else { [int]$observability.summary.unknownCount }
$historyUnknownInputCount = if ($null -eq $history) { 0 } else { [int]$history.summary.unknownInputCount }
$deniedAuthorityCount = if ($null -eq $authority) { 0 } else { [int]$authority.summary.deniedAuthorityCount }
$monitoringFindingCount = if ($null -eq $monitoring) { 0 } else { [int]$monitoring.summary.findingCount }
$approvalReadinessScore = if ($null -eq $simulation) { 0 } else { [double]$simulation.summary.approvalReadinessScore }
$simulationReadinessScore = if ($null -eq $simulation) { 0 } else { [double]$simulation.summary.simulationReadinessScore }

$requiredEvidence = @(
    New-DecisionItem -Id 'required.authority-read-model' -State $(if ($null -eq $authority) { 'UNKNOWN' } else { 'PASS' }) -Summary 'Authority read model is required as upstream evidence.' -Source $authorityPath
    New-DecisionItem -Id 'required.monitoring' -State $(if ($null -eq $monitoring) { 'UNKNOWN' } else { 'PASS' }) -Summary 'Projection monitoring report is required as upstream evidence.' -Source $monitoringPath
    New-DecisionItem -Id 'required.evidence-center' -State $(if ($null -eq $evidence) { 'UNKNOWN' } else { 'PASS' }) -Summary 'Evidence Center report is required as upstream evidence.' -Source $evidencePath
    New-DecisionItem -Id 'required.history' -State $(if ($null -eq $history) { 'UNKNOWN' } else { 'PASS' }) -Summary 'Evidence history report is required as upstream evidence.' -Source $historyPath
    New-DecisionItem -Id 'required.observability' -State $(if ($null -eq $observability) { 'UNKNOWN' } else { 'PASS' }) -Summary 'Observability report is required as upstream evidence.' -Source $observabilityPath
    New-DecisionItem -Id 'required.simulation' -State $(if ($null -eq $simulation) { 'UNKNOWN' } else { 'PASS' }) -Summary 'Execution governance simulation report is required as upstream evidence.' -Source $simulationPath
    New-DecisionItem -Id 'required.review' -State $(if ($null -eq $review) { 'UNKNOWN' } else { 'PASS' }) -Summary 'Simulation evidence review report is required as upstream evidence.' -Source $reviewPath
)

$missingInputs = @()
foreach ($input in $inputs) {
    if ($input.verdict -eq 'unknown') {
        $missingInputs += New-DecisionItem -Id "missing.$($input.path.Replace('/', '.'))" -State 'UNKNOWN' -Summary $input.reason -Source $input.path
    }
}
if ($missingInputs.Count -eq 0) {
    $missingInputs += New-DecisionItem -Id 'missing.none-detected' -State 'PASS' -Summary 'No missing, unreadable, stale or incomplete decision inputs were detected.' -Source 'runtime/decision/execution-readiness-decision.report.json'
}

$unknownItems = @()
if ($unknownInputCount -gt 0) {
    $unknownItems += New-DecisionItem -Id 'unknown.decision-inputs' -State 'UNKNOWN' -Summary "Decision input unknownInputCount=$unknownInputCount; decision must be UNKNOWN." -Source 'runtime/decision/execution-readiness-decision.report.json'
}
if ($sourceSimulationStatus -eq 'unknown' -or $simulationUnknownInputCount -gt 0 -or $simulationUnknownCount -gt 0) {
    $unknownItems += New-DecisionItem -Id 'unknown.simulation' -State 'UNKNOWN' -Summary "Simulation status=$sourceSimulationStatus; unknownInputCount=$simulationUnknownInputCount; unknownCount=$simulationUnknownCount." -Source $simulationPath
}
if ($sourceReviewStatus -eq 'unknown' -or $reviewUnknownCount -gt 0) {
    $unknownItems += New-DecisionItem -Id 'unknown.review' -State 'UNKNOWN' -Summary "Review status=$sourceReviewStatus; unknownCount=$reviewUnknownCount." -Source $reviewPath
}
if ($evidenceUnknownCount -gt 0 -or $observabilityUnknownCount -gt 0 -or $historyUnknownInputCount -gt 0) {
    $unknownItems += New-DecisionItem -Id 'unknown.upstream-evidence' -State 'UNKNOWN' -Summary "Evidence unknown=$evidenceUnknownCount; observability unknown=$observabilityUnknownCount; history unknownInput=$historyUnknownInputCount." -Source "$evidencePath + $observabilityPath + $historyPath"
}
if ($unknownItems.Count -eq 0) {
    $unknownItems += New-DecisionItem -Id 'unknown.none-detected' -State 'PASS' -Summary 'No upstream UNKNOWN condition was detected.' -Source 'runtime/decision/execution-readiness-decision.report.json'
}

$blockingConditions = @()
if ($deniedAuthorityCount -gt 0) {
    $blockingConditions += New-DecisionItem -Id 'block.authority-denials' -State 'BLOCKED' -Summary "Authority read model reports deniedAuthorityCount=$deniedAuthorityCount." -Source $authorityPath
}
if ($monitoringFindingCount -gt 0) {
    $blockingConditions += New-DecisionItem -Id 'block.monitoring-findings' -State 'BLOCKED' -Summary "Projection monitoring reports findingCount=$monitoringFindingCount." -Source $monitoringPath
}
if ($approvalReadinessScore -lt 100) {
    $blockingConditions += New-DecisionItem -Id 'block.readiness-score' -State 'BLOCKED' -Summary "Approval readiness score is $approvalReadinessScore; decision layer cannot treat this as theoretically allowed." -Source $simulationPath
}
if ($simulationReadinessScore -lt 100) {
    $blockingConditions += New-DecisionItem -Id 'block.simulation-readiness' -State 'BLOCKED' -Summary "Simulation readiness score is $simulationReadinessScore." -Source $simulationPath
}
if ($blockingConditions.Count -eq 0) {
    $blockingConditions += New-DecisionItem -Id 'block.none-detected' -State 'PASS' -Summary 'No derived blocking condition was detected.' -Source 'runtime/decision/execution-readiness-decision.report.json'
}

$hasUnknown = @($unknownItems | Where-Object { $_.state -eq 'UNKNOWN' }).Count -gt 0
$hasBlocked = @($blockingConditions | Where-Object { $_.state -eq 'BLOCKED' }).Count -gt 0
$decision = if ($hasUnknown) { 'UNKNOWN' } elseif ($hasBlocked) { 'BLOCKED' } else { 'PASS' }

$reasons = @(
    New-DecisionItem -Id 'reason.decision-scope' -State $decision -Summary 'Decision is derived from existing reports only and does not create execution, approval or override authority.' -Source 'shared/contracts/decision/decision.contract.json'
    New-DecisionItem -Id 'reason.unknown-precedence' -State $(if ($hasUnknown) { 'UNKNOWN' } else { 'PASS' }) -Summary 'UNKNOWN input or upstream UNKNOWN has precedence over PASS.' -Source "$simulationPath + $reviewPath"
    New-DecisionItem -Id 'reason.blocking-precedence' -State $(if ($hasBlocked) { 'BLOCKED' } else { 'PASS' }) -Summary 'Derived blocking conditions prevent PASS when no UNKNOWN is present.' -Source "$authorityPath + $simulationPath"
)

$report = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-24'
    reportId = 'execution-readiness-decision'
    generatedBy = 'services/execution-decision/generate-execution-decision.ps1'
    generatedAt = $generatedAt
    decisionQuestion = 'Would execution theoretically be allowed if execution existed?'
    decision = $decision
    sourceOfTruth = [ordered]@{
        authority = $authorityPath
        monitoring = $monitoringPath
        evidence = $evidencePath
        history = $historyPath
        observability = $observabilityPath
        simulation = $simulationPath
        review = $reviewPath
    }
    consumedReports = $inputs
    summary = [ordered]@{
        knownInputCount = $knownInputCount
        unknownInputCount = $unknownInputCount
        staleInputCount = $staleInputCount
        reasonCount = @($reasons).Count
        blockingConditionCount = @($blockingConditions | Where-Object { $_.state -eq 'BLOCKED' }).Count
        missingInputCount = @($missingInputs | Where-Object { $_.state -eq 'UNKNOWN' }).Count
        requiredEvidenceCount = @($requiredEvidence).Count
        sourceSimulationStatus = $sourceSimulationStatus
        sourceReviewStatus = $sourceReviewStatus
    }
    reasons = $reasons
    blockingConditions = $blockingConditions
    requiredEvidence = $requiredEvidence
    missingInputs = $missingInputs
    unknownPropagation = [ordered]@{
        status = if ($hasUnknown) { 'UNKNOWN' } else { 'PASS' }
        items = $unknownItems
    }
    boundary = New-DecisionBoundary
}

$summary = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-24'
    reportId = 'execution-readiness-decision-summary'
    generatedBy = 'services/execution-decision/generate-execution-decision.ps1'
    generatedAt = $generatedAt
    decision = $decision
    reasonCount = @($reasons).Count
    blockingConditionCount = $report.summary.blockingConditionCount
    missingInputCount = $report.summary.missingInputCount
    unknownPropagationStatus = $report.unknownPropagation.status
    sourceSimulationStatus = $sourceSimulationStatus
    sourceReviewStatus = $sourceReviewStatus
    authoritative = $false
    executionAllowed = $false
}

Write-StudioJson -RelativePath 'runtime/decision/execution-readiness-decision.report.json' -Value $report
Write-StudioJson -RelativePath 'runtime/decision/execution-readiness-decision-summary.json' -Value $summary

Write-Host 'Phase 24 execution readiness decision reports generated.' -ForegroundColor Green
