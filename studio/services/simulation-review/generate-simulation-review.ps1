[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'scripts/lib/StudioRuntime.psm1') -Force

function New-ReviewBoundary {
    return [ordered]@{
        reviewOnly = $true
        explanationOnly = $true
        readOnly = $true
        derivedOnly = $true
        reportWritingOnly = $true
        ownsReviewReports = $true
        ownsAuthorityTruth = $false
        ownsGovernanceTruth = $false
        ownsEvidenceTruth = $false
        ownsMonitoringTruth = $false
        ownsHistoryTruth = $false
        ownsObservabilityTruth = $false
        ownsSimulationTruth = $false
        createsDecisions = $false
        createsApprovals = $false
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        workflowExecutionAllowed = $false
        commandExecutionAllowed = $false
        orchestrationAllowed = $false
        automationAllowed = $false
        repairAllowed = $false
        synchronizationAllowed = $false
        approvalWorkflowAllowed = $false
        approvalMutationAllowed = $false
        authorityMutationAllowed = $false
        evidenceMutationAllowed = $false
        simulationMutationAllowed = $false
        contractMutationAllowed = $false
        credentialAccessAllowed = $false
        secretAccessAllowed = $false
        runtimeMutationAllowed = $false
        dashboardMutationAllowed = $false
        queueAllowed = $false
        workerAllowed = $false
        schedulerAllowed = $false
        backgroundJobAllowed = $false
        selfHealingAllowed = $false
        retryAllowed = $false
        providerAdapterAllowed = $false
        stateChangingRecommendationAllowed = $false
    }
}

function Convert-ToReviewStatus {
    param([AllowNull()][string]$Status)

    if ([string]::IsNullOrWhiteSpace($Status)) { return 'unknown' }
    switch ($Status.ToLowerInvariant()) {
        { $_ -in @('ok', 'pass', 'passed', 'ready') } { return 'pass' }
        { $_ -in @('warning', 'partial', 'missing', 'fail', 'failed', 'error') } { return 'warning' }
        default { return 'unknown' }
    }
}

function New-ReviewItem {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$Status,
        [Parameter(Mandatory)][string]$Summary,
        [Parameter(Mandatory)][string]$Source
    )

    return [ordered]@{
        id = $Id
        status = $Status
        summary = $Summary
        source = $Source
        safe = ($Status -eq 'pass')
    }
}

function New-ReviewGroup {
    param([Parameter(Mandatory)]$Items)

    $array = @($Items)
    $status = 'pass'
    if (@($array | Where-Object { $_.status -eq 'unknown' }).Count -gt 0) { $status = 'unknown' }
    elseif (@($array | Where-Object { $_.status -eq 'warning' }).Count -gt 0) { $status = 'warning' }

    return [ordered]@{
        status = $status
        items = $array
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
    if (-not $safe.exists) { $reason = "$Role is missing; simulation review result is unknown." }
    elseif (-not $safe.validJson) { $reason = "$Role is unreadable; simulation review result is unknown." }
    elseif (-not $isComplete) { $reason = "$Role is incomplete; simulation review result is unknown." }
    elseif ($isStale) { $reason = "$Role is stale; simulation review result is unknown." }

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

$simulationPath = 'runtime/simulation/execution-simulation.report.json'
$simulationValidationPath = 'runtime/simulation/execution-simulation-validation.report.json'
$monitoringPath = 'runtime/authority/authority-projection-monitoring.report.json'
$evidencePath = 'runtime/authority/authority-monitoring-evidence.report.json'
$historyPath = 'runtime/authority/authority-evidence-history.report.json'
$observabilityPath = 'runtime/authority/authority-observability.report.json'

$inputs = @(
    New-ReportInput -RelativePath $simulationPath -Role 'Phase 22 execution governance simulation report' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary', 'boundary')
    New-ReportInput -RelativePath $simulationValidationPath -Role 'Phase 22 execution governance simulation validation report' -RequiredFields @('schemaVersion', 'phase', 'status', 'failures', 'boundary')
    New-ReportInput -RelativePath $monitoringPath -Role 'Phase 18 projection monitoring report' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary')
    New-ReportInput -RelativePath $evidencePath -Role 'Phase 19 evidence center report' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary')
    New-ReportInput -RelativePath $historyPath -Role 'Phase 20 evidence history report' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary')
    New-ReportInput -RelativePath $observabilityPath -Role 'Phase 21 observability report' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary', 'boundary')
)

$simulationSafe = Read-StudioJsonSafe -RelativePath $simulationPath
$simulationValidationSafe = Read-StudioJsonSafe -RelativePath $simulationValidationPath
$monitoringSafe = Read-StudioJsonSafe -RelativePath $monitoringPath
$evidenceSafe = Read-StudioJsonSafe -RelativePath $evidencePath
$historySafe = Read-StudioJsonSafe -RelativePath $historyPath
$observabilitySafe = Read-StudioJsonSafe -RelativePath $observabilityPath

$simulation = if ($simulationSafe.validJson) { $simulationSafe.value } else { $null }
$simulationValidation = if ($simulationValidationSafe.validJson) { $simulationValidationSafe.value } else { $null }
$monitoring = if ($monitoringSafe.validJson) { $monitoringSafe.value } else { $null }
$evidence = if ($evidenceSafe.validJson) { $evidenceSafe.value } else { $null }
$history = if ($historySafe.validJson) { $historySafe.value } else { $null }
$observability = if ($observabilitySafe.validJson) { $observabilitySafe.value } else { $null }

$knownInputCount = @($inputs | Where-Object { $_.verdict -eq 'known' }).Count
$unknownInputCount = @($inputs | Where-Object { $_.verdict -eq 'unknown' }).Count
$staleInputCount = @($inputs | Where-Object { $_.isStale }).Count

$sourceSimulationStatus = Convert-ToReviewStatus -Status $(if ($null -eq $simulation) { 'unknown' } else { [string]$simulation.status })
$simulationUnknownInputCount = if ($null -eq $simulation) { 0 } else { [int]$simulation.summary.unknownInputCount }
$simulationStaleInputCount = if ($null -eq $simulation) { 0 } else { [int]$simulation.summary.staleInputCount }
$simulationUnknownCount = if ($null -eq $simulation) { 0 } else { [int]$simulation.summary.unknownCount }
$simulationWarningCount = if ($null -eq $simulation) { 0 } else { [int]$simulation.summary.warningCount }
$simulationReadinessScore = if ($null -eq $simulation) { 0 } else { [double]$simulation.summary.simulationReadinessScore }
$approvalReadinessScore = if ($null -eq $simulation) { 0 } else { [double]$simulation.summary.approvalReadinessScore }
$monitoringFindingCount = if ($null -eq $monitoring) { 0 } else { [int]$monitoring.summary.findingCount }
$evidenceUnknownCount = if ($null -eq $evidence) { 0 } else { [int]$evidence.summary.unknownCount }
$historyUnknownInputCount = if ($null -eq $history) { 0 } else { [int]$history.summary.unknownInputCount }
$observabilityUnknownCount = if ($null -eq $observability) { 0 } else { [int]$observability.summary.unknownCount }
$validationFailureCount = if ($null -eq $simulationValidation) { 0 } else { @($simulationValidation.failures).Count }

$outcomeItems = @(
    New-ReviewItem -Id 'outcome.simulation-status' -Status $(if ($sourceSimulationStatus -eq 'unknown') { 'unknown' } elseif ($sourceSimulationStatus -eq 'warning') { 'warning' } else { 'pass' }) -Summary "Phase 22 simulation status is $sourceSimulationStatus; review explains the result without changing it." -Source $simulationPath
    New-ReviewItem -Id 'outcome.validation-status' -Status $(if ($null -eq $simulationValidation) { 'unknown' } elseif ($simulationValidation.status -eq 'passed') { 'pass' } elseif ($simulationValidation.status -eq 'failed') { 'warning' } else { 'unknown' }) -Summary "Phase 22 validation status is $(if ($null -eq $simulationValidation) { 'unknown' } else { [string]$simulationValidation.status }); validation failures=$validationFailureCount." -Source $simulationValidationPath
    New-ReviewItem -Id 'outcome.unknown-propagation' -Status $(if ($simulationUnknownInputCount -gt 0 -or $simulationUnknownCount -gt 0 -or $unknownInputCount -gt 0) { 'unknown' } else { 'pass' }) -Summary "Simulation unknownInputCount=$simulationUnknownInputCount; simulation unknownCount=$simulationUnknownCount; review unknownInputCount=$unknownInputCount." -Source "$simulationPath + $simulationValidationPath"
)

$rootCauseItems = @(
    New-ReviewItem -Id 'cause.stale-simulation-inputs' -Status $(if ($simulationStaleInputCount -gt 0 -or $staleInputCount -gt 0) { 'unknown' } else { 'pass' }) -Summary "Stale inputs explain uncertainty: simulationStaleInputCount=$simulationStaleInputCount; reviewStaleInputCount=$staleInputCount." -Source $simulationPath
    New-ReviewItem -Id 'cause.upstream-unknowns' -Status $(if ($observabilityUnknownCount -gt 0 -or $evidenceUnknownCount -gt 0 -or $historyUnknownInputCount -gt 0) { 'unknown' } else { 'pass' }) -Summary "Upstream unknowns: observability=$observabilityUnknownCount; evidence=$evidenceUnknownCount; historyInputs=$historyUnknownInputCount." -Source "$observabilityPath + $evidencePath + $historyPath"
    New-ReviewItem -Id 'cause.readiness-denial' -Status $(if ($approvalReadinessScore -lt 100) { 'warning' } else { 'pass' }) -Summary "Approval readiness score is $approvalReadinessScore; this explains warning outcomes but does not approve or deny anything." -Source $simulationPath
    New-ReviewItem -Id 'cause.monitoring-findings' -Status $(if ($monitoringFindingCount -gt 0) { 'warning' } else { 'pass' }) -Summary "Projection monitoring findingCount=$monitoringFindingCount." -Source $monitoringPath
)

$evidenceItems = @(
    New-ReviewItem -Id 'evidence.simulation-report' -Status $(if ($null -eq $simulation) { 'unknown' } else { $sourceSimulationStatus }) -Summary "Primary evidence is the generated Phase 22 simulation report with readiness score $simulationReadinessScore." -Source $simulationPath
    New-ReviewItem -Id 'evidence.validation-report' -Status $(if ($null -eq $simulationValidation) { 'unknown' } elseif ($simulationValidation.status -eq 'passed') { 'pass' } else { 'warning' }) -Summary "Validation evidence has $validationFailureCount failure(s)." -Source $simulationValidationPath
    New-ReviewItem -Id 'evidence.evidence-center' -Status $(if ($null -eq $evidence) { 'unknown' } elseif ($evidenceUnknownCount -gt 0) { 'unknown' } else { Convert-ToReviewStatus -Status ([string]$evidence.status) }) -Summary "Evidence Center unknownCount=$evidenceUnknownCount." -Source $evidencePath
    New-ReviewItem -Id 'evidence.history' -Status $(if ($null -eq $history) { 'unknown' } else { Convert-ToReviewStatus -Status ([string]$history.status) }) -Summary "History status is $(if ($null -eq $history) { 'unknown' } else { [string]$history.status }); unknownInputCount=$historyUnknownInputCount." -Source $historyPath
    New-ReviewItem -Id 'evidence.observability' -Status $(if ($null -eq $observability) { 'unknown' } else { Convert-ToReviewStatus -Status ([string]$observability.status) }) -Summary "Observability status is $(if ($null -eq $observability) { 'unknown' } else { [string]$observability.status }); unknownCount=$observabilityUnknownCount." -Source $observabilityPath
)

$confidenceScore = [math]::Round((($knownInputCount / [double]@($inputs).Count) * 100) - (($simulationUnknownInputCount + $simulationStaleInputCount) * 5), 2)
if ($confidenceScore -lt 0) { $confidenceScore = 0 }

$confidenceItems = @(
    New-ReviewItem -Id 'confidence.input-completeness' -Status $(if ($unknownInputCount -gt 0) { 'unknown' } elseif ($knownInputCount -lt @($inputs).Count) { 'warning' } else { 'pass' }) -Summary "Known review inputs=$knownInputCount of $(@($inputs).Count)." -Source 'shared/contracts/simulation-review/review.manifest.json'
    New-ReviewItem -Id 'confidence.source-unknowns' -Status $(if ($simulationUnknownInputCount -gt 0 -or $simulationUnknownCount -gt 0) { 'unknown' } else { 'pass' }) -Summary "Source simulation unknownInputCount=$simulationUnknownInputCount; unknownCount=$simulationUnknownCount." -Source $simulationPath
    New-ReviewItem -Id 'confidence.score' -Status $(if ($confidenceScore -lt 100) { 'unknown' } else { 'pass' }) -Summary "reviewConfidenceScore=$confidenceScore." -Source 'runtime/review/simulation-review.report.json'
)

$explainItems = @(
    New-ReviewItem -Id 'explain.scope' -Status 'warning' -Summary 'Phase 23 explains why the simulation produced its status; it does not decide, approve, repair or execute.' -Source 'shared/contracts/simulation-review/review.manifest.json'
    New-ReviewItem -Id 'explain.unknown-before-pass' -Status $(if ($simulationUnknownInputCount -gt 0 -or $unknownInputCount -gt 0) { 'unknown' } else { 'pass' }) -Summary 'Any missing, unreadable, stale or incomplete review evidence keeps the review unknown and prevents pass.' -Source "$simulationPath + shared/contracts/simulation-review/simulation-review.schema.json"
    New-ReviewItem -Id 'explain.no-state-change' -Status 'warning' -Summary 'The review report may contain explanatory findings only; it contains no state-changing recommendation.' -Source 'docs/governance/PHASE_23_BOUNDARY_AUDIT.md'
)

$unknownItems = @()
foreach ($input in $inputs) {
    if ($input.verdict -eq 'unknown') {
        $unknownItems += New-ReviewItem -Id "unknown.$($input.path.Replace('/', '.'))" -Status 'unknown' -Summary $input.reason -Source $input.path
    }
}
if ($simulationUnknownInputCount -gt 0) {
    $unknownItems += New-ReviewItem -Id 'unknown.source-simulation-inputs' -Status 'unknown' -Summary "Phase 22 simulation has unknownInputCount=$simulationUnknownInputCount; review must remain unknown." -Source $simulationPath
}
if ($simulationUnknownCount -gt 0) {
    $unknownItems += New-ReviewItem -Id 'unknown.source-simulation-items' -Status 'unknown' -Summary "Phase 22 simulation has unknownCount=$simulationUnknownCount; review explains rather than resolves it." -Source $simulationPath
}
if ($unknownItems.Count -eq 0) {
    $unknownItems += New-ReviewItem -Id 'unknown.none-detected' -Status 'pass' -Summary 'No unknown simulation review evidence was detected.' -Source 'runtime/review/simulation-review.report.json'
}

$outcomeReview = New-ReviewGroup -Items $outcomeItems
$rootCauseClassification = New-ReviewGroup -Items $rootCauseItems
$evidenceAttribution = New-ReviewGroup -Items $evidenceItems
$reviewConfidence = New-ReviewGroup -Items $confidenceItems
$explainability = New-ReviewGroup -Items $explainItems
$unknowns = New-ReviewGroup -Items $unknownItems

$allItems = @($outcomeReview.items + $rootCauseClassification.items + $evidenceAttribution.items + $reviewConfidence.items + $explainability.items + $unknowns.items)
$warningCount = @($allItems | Where-Object { $_.status -eq 'warning' }).Count
$unknownCount = @($allItems | Where-Object { $_.status -eq 'unknown' }).Count
$status = if ($unknownInputCount -gt 0 -or $simulationUnknownInputCount -gt 0 -or $simulationUnknownCount -gt 0 -or $unknownCount -gt 0) { 'unknown' } elseif ($warningCount -gt 0) { 'warning' } else { 'pass' }

$report = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-23'
    reportId = 'simulation-evidence-review'
    generatedBy = 'services/simulation-review/generate-simulation-review.ps1'
    generatedAt = $generatedAt
    reviewQuestion = 'Why did the Phase 22 simulation produce PASS, WARNING or UNKNOWN?'
    sourceOfTruth = [ordered]@{
        simulation = $simulationPath
        validation = $simulationValidationPath
        evidence = $evidencePath
        history = $historyPath
        observability = $observabilityPath
    }
    consumedReports = $inputs
    status = $status
    summary = [ordered]@{
        knownInputCount = $knownInputCount
        unknownInputCount = $unknownInputCount
        staleInputCount = $staleInputCount
        warningCount = $warningCount
        unknownCount = $unknownCount
        attributedEvidenceCount = @($evidenceItems).Count
        rootCauseCount = @($rootCauseItems | Where-Object { $_.status -ne 'pass' }).Count
        reviewConfidenceScore = $confidenceScore
        sourceSimulationStatus = $sourceSimulationStatus
    }
    outcomeReview = $outcomeReview
    rootCauseClassification = $rootCauseClassification
    evidenceAttribution = $evidenceAttribution
    reviewConfidence = $reviewConfidence
    explainability = $explainability
    unknowns = $unknowns
    boundary = New-ReviewBoundary
}

Write-StudioJson -RelativePath 'runtime/review/simulation-review.report.json' -Value $report

Write-Host 'Phase 23 simulation evidence review report generated.' -ForegroundColor Green
