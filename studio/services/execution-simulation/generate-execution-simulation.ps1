[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'scripts/lib/StudioRuntime.psm1') -Force

function New-SimulationBoundary {
    return [ordered]@{
        simulationOnly = $true
        hypotheticalOnly = $true
        readOnly = $true
        derivedOnly = $true
        reportWritingOnly = $true
        ownsSimulationReports = $true
        ownsAuthorityTruth = $false
        ownsGovernanceTruth = $false
        ownsEvidenceTruth = $false
        ownsMonitoringTruth = $false
        ownsHistoryTruth = $false
        ownsObservabilityTruth = $false
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        workflowExecutionAllowed = $false
        commandExecutionAllowed = $false
        orchestrationAllowed = $false
        automationAllowed = $false
        repairAllowed = $false
        synchronizationAllowed = $false
        approvalMutationAllowed = $false
        authorityMutationAllowed = $false
        evidenceMutationAllowed = $false
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
    }
}

function Convert-ToSimulationStatus {
    param([AllowNull()][string]$Status)

    if ([string]::IsNullOrWhiteSpace($Status)) { return 'unknown' }
    switch ($Status.ToLowerInvariant()) {
        { $_ -in @('ok', 'pass', 'passed', 'ready') } { return 'pass' }
        { $_ -in @('warning', 'partial', 'missing', 'fail', 'failed', 'error') } { return 'warning' }
        default { return 'unknown' }
    }
}

function New-SimulationItem {
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

function New-SimulationGroup {
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
    if (-not $safe.exists) { $reason = "$Role is missing; simulation result is unknown." }
    elseif (-not $safe.validJson) { $reason = "$Role is unreadable; simulation result is unknown." }
    elseif (-not $isComplete) { $reason = "$Role is incomplete; simulation result is unknown." }
    elseif ($isStale) { $reason = "$Role is stale; simulation result is unknown." }

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

$planPath = 'runtime/readiness/execution-plan.sample.json'
$readinessPath = 'runtime/readiness/readiness-report.sample.json'
$contractsPath = 'runtime/execution/execution-contract-validation.json'
$approvalsPath = 'runtime/execution/approval-registry-validation.json'
$rollbackPath = 'runtime/execution/rollback-plan-validation.json'
$idempotencyPath = 'runtime/execution/idempotency-record-validation.json'
$readModelPath = 'runtime/authority/authority-read-model.report.json'
$monitoringPath = 'runtime/authority/authority-projection-monitoring.report.json'
$evidencePath = 'runtime/authority/authority-monitoring-evidence.report.json'
$historyPath = 'runtime/authority/authority-evidence-history.report.json'
$observabilityPath = 'runtime/authority/authority-observability.report.json'

$inputs = @(
    New-ReportInput -RelativePath $planPath -Role 'Phase 10 sample execution plan' -RequiredFields @('schemaVersion', 'planId', 'steps', 'executionAllowed', 'readinessOnly')
    New-ReportInput -RelativePath $readinessPath -Role 'Phase 10 readiness report' -RequiredFields @('schemaVersion', 'reportId', 'decision', 'checks', 'executionAllowed')
    New-ReportInput -RelativePath $contractsPath -Role 'Phase 9 execution contract validation' -RequiredFields @('schemaVersion', 'status', 'executionAllowed', 'checks')
    New-ReportInput -RelativePath $approvalsPath -Role 'Phase 9 approval registry validation' -RequiredFields @('schemaVersion', 'status', 'executionAllowed', 'checks')
    New-ReportInput -RelativePath $rollbackPath -Role 'Phase 9 rollback plan validation' -RequiredFields @('schemaVersion', 'status', 'executionAllowed', 'checks')
    New-ReportInput -RelativePath $idempotencyPath -Role 'Phase 9 idempotency validation' -RequiredFields @('schemaVersion', 'status', 'executionAllowed', 'checks')
    New-ReportInput -RelativePath $readModelPath -Role 'Phase 16 authority read model' -RequiredFields @('schemaVersion', 'phase', 'summary', 'boundary')
    New-ReportInput -RelativePath $monitoringPath -Role 'Phase 18 projection monitoring' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary')
    New-ReportInput -RelativePath $evidencePath -Role 'Phase 19 evidence center' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary')
    New-ReportInput -RelativePath $historyPath -Role 'Phase 20 evidence history' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary')
    New-ReportInput -RelativePath $observabilityPath -Role 'Phase 21 observability center' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary', 'boundary')
)

$planSafe = Read-StudioJsonSafe -RelativePath $planPath
$readinessSafe = Read-StudioJsonSafe -RelativePath $readinessPath
$contractsSafe = Read-StudioJsonSafe -RelativePath $contractsPath
$approvalsSafe = Read-StudioJsonSafe -RelativePath $approvalsPath
$rollbackSafe = Read-StudioJsonSafe -RelativePath $rollbackPath
$idempotencySafe = Read-StudioJsonSafe -RelativePath $idempotencyPath
$readModelSafe = Read-StudioJsonSafe -RelativePath $readModelPath
$monitoringSafe = Read-StudioJsonSafe -RelativePath $monitoringPath
$evidenceSafe = Read-StudioJsonSafe -RelativePath $evidencePath
$historySafe = Read-StudioJsonSafe -RelativePath $historyPath
$observabilitySafe = Read-StudioJsonSafe -RelativePath $observabilityPath

$plan = if ($planSafe.validJson) { $planSafe.value } else { $null }
$readiness = if ($readinessSafe.validJson) { $readinessSafe.value } else { $null }
$contracts = if ($contractsSafe.validJson) { $contractsSafe.value } else { $null }
$approvals = if ($approvalsSafe.validJson) { $approvalsSafe.value } else { $null }
$rollback = if ($rollbackSafe.validJson) { $rollbackSafe.value } else { $null }
$idempotency = if ($idempotencySafe.validJson) { $idempotencySafe.value } else { $null }
$readModel = if ($readModelSafe.validJson) { $readModelSafe.value } else { $null }
$monitoring = if ($monitoringSafe.validJson) { $monitoringSafe.value } else { $null }
$evidence = if ($evidenceSafe.validJson) { $evidenceSafe.value } else { $null }
$history = if ($historySafe.validJson) { $historySafe.value } else { $null }
$observability = if ($observabilitySafe.validJson) { $observabilitySafe.value } else { $null }

$knownInputCount = @($inputs | Where-Object { $_.verdict -eq 'known' }).Count
$unknownInputCount = @($inputs | Where-Object { $_.verdict -eq 'unknown' }).Count
$staleInputCount = @($inputs | Where-Object { $_.isStale }).Count

$planStepCount = if ($null -eq $plan) { 0 } else { @($plan.steps).Count }
$planMissingStepCount = if ($null -eq $plan) { 0 } else { @($plan.steps | Where-Object { $_.readinessStatus -ne 'ready' }).Count }
$readinessMissingCheckCount = if ($null -eq $readiness) { 0 } else { @($readiness.checks | Where-Object { $_.status -ne 'ready' }).Count }
$deniedAuthorityCount = if ($null -eq $readModel) { 0 } else { [int]$readModel.summary.deniedAuthorityCount }
$monitoringFindingCount = if ($null -eq $monitoring) { 0 } else { [int]$monitoring.summary.findingCount }
$evidenceUnknownCount = if ($null -eq $evidence) { 0 } else { [int]$evidence.summary.unknownCount }
$historyUnknownCount = if ($null -eq $history) { 0 } else { [int]$history.summary.unknownInputCount }
$observabilityUnknownCount = if ($null -eq $observability) { 0 } else { [int]$observability.summary.unknownCount }

$readinessItems = @(
    New-SimulationItem -Id 'readiness.plan-permission' -Status $(if ($null -eq $plan) { 'unknown' } elseif ($plan.executionAllowed -eq $false -and $plan.readinessOnly -eq $true) { 'warning' } else { 'unknown' }) -Summary "Hypothetical plan has executionAllowed=$(if ($null -eq $plan) { 'unknown' } else { [string]$plan.executionAllowed }); readinessOnly=$(if ($null -eq $plan) { 'unknown' } else { [string]$plan.readinessOnly })." -Source $planPath
    New-SimulationItem -Id 'readiness.plan-steps' -Status $(if ($null -eq $plan) { 'unknown' } elseif ($planMissingStepCount -gt 0) { 'warning' } else { 'pass' }) -Summary "Plan steps=$planStepCount; non-ready steps=$planMissingStepCount." -Source $planPath
    New-SimulationItem -Id 'readiness.report-checks' -Status $(if ($null -eq $readiness) { 'unknown' } elseif ($readinessMissingCheckCount -gt 0) { 'warning' } else { 'pass' }) -Summary "Readiness decision=$(if ($null -eq $readiness) { 'unknown' } else { [string]$readiness.decision }); non-ready checks=$readinessMissingCheckCount." -Source $readinessPath
)

$impactItems = @(
    New-SimulationItem -Id 'impact.execution-contracts' -Status (Convert-ToSimulationStatus -Status $(if ($null -eq $contracts) { 'unknown' } else { [string]$contracts.status })) -Summary "Execution contract validation status is $(if ($null -eq $contracts) { 'unknown' } else { [string]$contracts.status })." -Source $contractsPath
    New-SimulationItem -Id 'impact.authority-domains' -Status $(if ($null -eq $readModel) { 'unknown' } elseif ($deniedAuthorityCount -gt 0) { 'warning' } else { 'pass' }) -Summary "Hypothetical action intersects authority model with deniedAuthorityCount=$deniedAuthorityCount." -Source $readModelPath
    New-SimulationItem -Id 'impact.evidence-chain' -Status $(if ($null -eq $evidence) { 'unknown' } elseif ($evidenceUnknownCount -gt 0) { 'unknown' } else { 'pass' }) -Summary "Evidence unknownCount=$evidenceUnknownCount." -Source $evidencePath
    New-SimulationItem -Id 'impact.observability-chain' -Status (Convert-ToSimulationStatus -Status $(if ($null -eq $observability) { 'unknown' } else { [string]$observability.status })) -Summary "Observability status is $(if ($null -eq $observability) { 'unknown' } else { [string]$observability.status })." -Source $observabilityPath
)

$riskItems = @(
    New-SimulationItem -Id 'risk.approval-readiness' -Status $(if ($null -eq $approvals) { 'unknown' } elseif ($readinessMissingCheckCount -gt 0) { 'warning' } else { 'pass' }) -Summary "Approval validation status=$(if ($null -eq $approvals) { 'unknown' } else { [string]$approvals.status }); missing readiness checks=$readinessMissingCheckCount." -Source "$approvalsPath + $readinessPath"
    New-SimulationItem -Id 'risk.rollback-readiness' -Status (Convert-ToSimulationStatus -Status $(if ($null -eq $rollback) { 'unknown' } else { [string]$rollback.status })) -Summary "Rollback validation status is $(if ($null -eq $rollback) { 'unknown' } else { [string]$rollback.status })." -Source $rollbackPath
    New-SimulationItem -Id 'risk.idempotency-readiness' -Status (Convert-ToSimulationStatus -Status $(if ($null -eq $idempotency) { 'unknown' } else { [string]$idempotency.status })) -Summary "Idempotency validation status is $(if ($null -eq $idempotency) { 'unknown' } else { [string]$idempotency.status })." -Source $idempotencyPath
    New-SimulationItem -Id 'risk.monitoring-findings' -Status $(if ($null -eq $monitoring) { 'unknown' } elseif ($monitoringFindingCount -gt 0) { 'warning' } else { 'pass' }) -Summary "Monitoring findingCount=$monitoringFindingCount." -Source $monitoringPath
    New-SimulationItem -Id 'risk.history-unknowns' -Status $(if ($null -eq $history) { 'unknown' } elseif ($history.status -eq 'unknown') { 'unknown' } else { 'pass' }) -Summary "History status=$(if ($null -eq $history) { 'unknown' } else { [string]$history.status }); unknownInputCount=$historyUnknownCount." -Source $historyPath
)

$governanceCompletenessScore = [math]::Round(($knownInputCount / [double]@($inputs).Count) * 100, 2)
$approvalReadinessScore = if ($null -eq $readiness -or @($readiness.checks).Count -eq 0) { 0 } else { [math]::Round(((@($readiness.checks | Where-Object { $_.status -eq 'ready' }).Count) / [double]@($readiness.checks).Count) * 100, 2) }
$simulationReadinessScore = [math]::Round((($governanceCompletenessScore + $approvalReadinessScore) / 2), 2)

$scoringItems = @(
    New-SimulationItem -Id 'score.simulation-readiness' -Status $(if ($unknownInputCount -gt 0) { 'unknown' } elseif ($simulationReadinessScore -lt 100) { 'warning' } else { 'pass' }) -Summary "simulationReadinessScore=$simulationReadinessScore." -Source 'runtime/simulation/execution-simulation.report.json'
    New-SimulationItem -Id 'score.governance-completeness' -Status $(if ($unknownInputCount -gt 0) { 'unknown' } elseif ($governanceCompletenessScore -lt 100) { 'warning' } else { 'pass' }) -Summary "governanceCompletenessScore=$governanceCompletenessScore." -Source 'runtime/simulation/execution-simulation.report.json'
    New-SimulationItem -Id 'score.approval-readiness' -Status $(if ($approvalReadinessScore -lt 100) { 'warning' } else { 'pass' }) -Summary "approvalReadinessScore=$approvalReadinessScore." -Source $readinessPath
)

$explainItems = @(
    New-SimulationItem -Id 'explain.simulation-scope' -Status 'warning' -Summary 'This report answers hypothetical governance consequences only; it does not perform the requested action.' -Source 'shared/contracts/execution-simulation/simulation.manifest.json'
    New-SimulationItem -Id 'explain.non-executable-source' -Status $(if ($null -eq $plan) { 'unknown' } elseif ($plan.executionAllowed -eq $false) { 'warning' } else { 'unknown' }) -Summary 'Upstream readiness sample keeps execution disabled, so the simulated outcome cannot be pass.' -Source $planPath
    New-SimulationItem -Id 'explain.unknown-propagation' -Status $(if ($observabilityUnknownCount -gt 0 -or $evidenceUnknownCount -gt 0) { 'unknown' } else { 'pass' }) -Summary "Upstream unknowns are preserved: observabilityUnknownCount=$observabilityUnknownCount; evidenceUnknownCount=$evidenceUnknownCount." -Source "$observabilityPath + $evidencePath"
)

$unknownItems = @()
foreach ($input in $inputs) {
    if ($input.verdict -eq 'unknown') {
        $unknownItems += New-SimulationItem -Id "unknown.$($input.path.Replace('/', '.'))" -Status 'unknown' -Summary $input.reason -Source $input.path
    }
}
if ($observabilityUnknownCount -gt 0) {
    $unknownItems += New-SimulationItem -Id 'unknown.upstream-observability' -Status 'unknown' -Summary "Phase 21 reports unknownCount=$observabilityUnknownCount; simulation preserves that unknown state." -Source $observabilityPath
}
if ($evidenceUnknownCount -gt 0) {
    $unknownItems += New-SimulationItem -Id 'unknown.upstream-evidence' -Status 'unknown' -Summary "Phase 19 reports unknownCount=$evidenceUnknownCount; simulation preserves that unknown state." -Source $evidencePath
}
if ($unknownItems.Count -eq 0) {
    $unknownItems += New-SimulationItem -Id 'unknown.none-detected' -Status 'pass' -Summary 'No unknown simulation inputs were detected.' -Source 'runtime/simulation/execution-simulation.report.json'
}

$readinessSimulation = New-SimulationGroup -Items $readinessItems
$governanceImpact = New-SimulationGroup -Items $impactItems
$riskSimulation = New-SimulationGroup -Items $riskItems
$readinessScoring = New-SimulationGroup -Items $scoringItems
$explainability = New-SimulationGroup -Items $explainItems
$unknowns = New-SimulationGroup -Items $unknownItems

$allItems = @($readinessSimulation.items + $governanceImpact.items + $riskSimulation.items + $readinessScoring.items + $explainability.items + $unknowns.items)
$warningCount = @($allItems | Where-Object { $_.status -eq 'warning' }).Count
$unknownCount = @($allItems | Where-Object { $_.status -eq 'unknown' }).Count
$status = if ($unknownInputCount -gt 0 -or $unknownCount -gt 0) { 'unknown' } elseif ($warningCount -gt 0) { 'warning' } else { 'pass' }

$report = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-22'
    reportId = 'execution-governance-simulation'
    generatedBy = 'services/execution-simulation/generate-execution-simulation.ps1'
    generatedAt = $generatedAt
    simulationQuestion = 'If the sample execution plan were attempted, what governance consequences would occur?'
    sourceOfTruth = [ordered]@{
        governance = 'shared/contracts/execution'
        authority = 'shared/contracts/authority + runtime/authority/authority-read-model.report.json'
        observability = $observabilityPath
        readiness = "$planPath + $readinessPath"
    }
    consumedReports = $inputs
    status = $status
    summary = [ordered]@{
        knownInputCount = $knownInputCount
        unknownInputCount = $unknownInputCount
        staleInputCount = $staleInputCount
        warningCount = $warningCount
        unknownCount = $unknownCount
        simulationReadinessScore = $simulationReadinessScore
        governanceCompletenessScore = $governanceCompletenessScore
        approvalReadinessScore = $approvalReadinessScore
    }
    readinessSimulation = $readinessSimulation
    governanceImpact = $governanceImpact
    riskSimulation = $riskSimulation
    readinessScoring = $readinessScoring
    explainability = $explainability
    unknowns = $unknowns
    boundary = New-SimulationBoundary
}

Write-StudioJson -RelativePath 'runtime/simulation/execution-simulation.report.json' -Value $report

Write-Host 'Phase 22 execution governance simulation report generated.' -ForegroundColor Green
