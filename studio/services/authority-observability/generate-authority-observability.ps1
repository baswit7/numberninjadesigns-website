[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'scripts/lib/StudioRuntime.psm1') -Force

function New-ObservabilityBoundary {
    return [ordered]@{
        observabilityOnly = $true
        visibilityOnly = $true
        readOnly = $true
        derivedOnly = $true
        reportWritingOnly = $true
        ownsAuthorityTruth = $false
        ownsEvidenceTruth = $false
        ownsMonitoringTruth = $false
        ownsProjectionTruth = $false
        ownsHistoryTruth = $false
        ownsRetentionTruth = $false
        createsDecisions = $false
        createsApprovals = $false
        repairsProjection = $false
        synchronizesProjection = $false
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        credentialAccessAllowed = $false
        secretAccessAllowed = $false
        runtimeTruthMutationAllowed = $false
        dashboardMutationAllowed = $false
        approvalMutationAllowed = $false
        workflowExecutionAllowed = $false
        workerAllowed = $false
        schedulerAllowed = $false
        queueAllowed = $false
        automationAllowed = $false
        selfHealingAllowed = $false
        browserAuthorityStorageAllowed = $false
    }
}

function Convert-ToObservabilityStatus {
    param([AllowNull()][string]$Status)

    if ([string]::IsNullOrWhiteSpace($Status)) { return 'unknown' }
    switch ($Status.ToLowerInvariant()) {
        { $_ -in @('ok', 'pass', 'passed') } { return 'pass' }
        { $_ -in @('warning', 'fail', 'failed', 'error') } { return 'warning' }
        default { return 'unknown' }
    }
}

function New-ObservabilityItem {
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

function New-ObservabilityGroup {
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

function Get-RequiredFieldCompleteness {
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
    $isComplete = [bool]($safe.validJson -and (Get-RequiredFieldCompleteness -Value $safe.value -RequiredFields $RequiredFields))
    $known = [bool]($safe.exists -and $safe.validJson -and $isComplete -and -not $isStale)

    $reason = "$Role is present, readable, complete and fresh."
    if (-not $safe.exists) { $reason = "$Role is missing; observability is unknown." }
    elseif (-not $safe.validJson) { $reason = "$Role is unreadable; observability is unknown." }
    elseif (-not $isComplete) { $reason = "$Role is incomplete; observability is unknown." }
    elseif ($isStale) { $reason = "$Role is stale; observability is unknown." }

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

$readModelPath = 'runtime/authority/authority-read-model.report.json'
$readModelValidationPath = 'runtime/authority/authority-read-model-validation.report.json'
$dashboardProjectionPath = 'runtime/dashboard/authority.view.json'
$dashboardValidationPath = 'runtime/dashboard/authority-dashboard-validation.report.json'
$monitoringPath = 'runtime/authority/authority-projection-monitoring.report.json'
$evidencePath = 'runtime/authority/authority-monitoring-evidence.report.json'
$historyPath = 'runtime/authority/authority-evidence-history.report.json'

$inputs = @(
    New-ReportInput -RelativePath $readModelPath -Role 'Phase 16 authority read model' -RequiredFields @('schemaVersion', 'phase', 'summary', 'boundary')
    New-ReportInput -RelativePath $readModelValidationPath -Role 'Phase 16 read model validation' -RequiredFields @('schemaVersion', 'phase', 'status')
    New-ReportInput -RelativePath $dashboardProjectionPath -Role 'Phase 17 dashboard projection' -RequiredFields @('generatedAt', 'source', 'status', 'cards')
    New-ReportInput -RelativePath $dashboardValidationPath -Role 'Phase 17 dashboard projection validation' -RequiredFields @('schemaVersion', 'phase', 'status')
    New-ReportInput -RelativePath $monitoringPath -Role 'Phase 18 projection monitoring' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary')
    New-ReportInput -RelativePath $evidencePath -Role 'Phase 19 evidence center' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary')
    New-ReportInput -RelativePath $historyPath -Role 'Phase 20 evidence history' -RequiredFields @('schemaVersion', 'phase', 'status', 'summary', 'retention')
)

$readModelSafe = Read-StudioJsonSafe -RelativePath $readModelPath
$dashboardSafe = Read-StudioJsonSafe -RelativePath $dashboardProjectionPath
$monitoringSafe = Read-StudioJsonSafe -RelativePath $monitoringPath
$evidenceSafe = Read-StudioJsonSafe -RelativePath $evidencePath
$historySafe = Read-StudioJsonSafe -RelativePath $historyPath

$readModel = if ($readModelSafe.validJson) { $readModelSafe.value } else { $null }
$dashboard = if ($dashboardSafe.validJson) { $dashboardSafe.value } else { $null }
$monitoring = if ($monitoringSafe.validJson) { $monitoringSafe.value } else { $null }
$evidence = if ($evidenceSafe.validJson) { $evidenceSafe.value } else { $null }
$history = if ($historySafe.validJson) { $historySafe.value } else { $null }

$knownInputCount = @($inputs | Where-Object { $_.verdict -eq 'known' }).Count
$unknownInputCount = @($inputs | Where-Object { $_.verdict -eq 'unknown' }).Count
$staleInputCount = @($inputs | Where-Object { $_.isStale }).Count
$coveragePercent = [math]::Round(($knownInputCount / [double]@($inputs).Count) * 100, 2)

$freshnessItems = @()
foreach ($input in $inputs) {
    $status = if ($input.verdict -eq 'known') { 'pass' } else { 'unknown' }
    $freshnessItems += New-ObservabilityItem -Id "freshness.$($input.path.Replace('/', '.'))" -Status $status -Summary $input.reason -Source $input.path
}

$lineageItems = @(
    New-ObservabilityItem -Id 'lineage.authority-to-read-model' -Status $(if ($readModelSafe.validJson) { 'pass' } else { 'unknown' }) -Summary 'Authority Control Plane contracts feed the Phase 16 read model.' -Source $readModelPath
    New-ObservabilityItem -Id 'lineage.read-model-to-dashboard-projection' -Status $(if ($readModelSafe.validJson -and $dashboardSafe.validJson) { 'pass' } else { 'unknown' }) -Summary 'Read model output feeds passive dashboard projection visibility.' -Source "$readModelPath + $dashboardProjectionPath"
    New-ObservabilityItem -Id 'lineage.projection-to-monitoring' -Status $(if ($dashboardSafe.validJson -and $monitoringSafe.validJson) { 'pass' } else { 'unknown' }) -Summary 'Dashboard projection output feeds Phase 18 monitoring visibility.' -Source "$dashboardProjectionPath + $monitoringPath"
    New-ObservabilityItem -Id 'lineage.monitoring-to-evidence' -Status $(if ($monitoringSafe.validJson -and $evidenceSafe.validJson) { 'pass' } else { 'unknown' }) -Summary 'Monitoring output feeds Phase 19 evidence visibility.' -Source "$monitoringPath + $evidencePath"
    New-ObservabilityItem -Id 'lineage.evidence-to-history' -Status $(if ($evidenceSafe.validJson -and $historySafe.validJson) { 'pass' } else { 'unknown' }) -Summary 'Evidence output feeds Phase 20 history visibility.' -Source "$evidencePath + $historyPath"
)

$authorityCount = if ($null -eq $readModel) { 0 } else { [int]$readModel.summary.authorityCount }
$dashboardCardCount = if ($null -eq $dashboard) { 0 } else { @($dashboard.cards).Count }
$monitoringCoverage = if ($null -eq $monitoring) { 0 } else { [int]$monitoring.summary.expectedProjectionCount }
$evidenceCoverage = if ($null -eq $evidence) { 0 } else { [int]$evidence.summary.sourceFileCount }
$coverageItems = @(
    New-ObservabilityItem -Id 'coverage.authority-read-model' -Status $(if ($authorityCount -gt 0) { 'pass' } else { 'unknown' }) -Summary "Authority read model exposes $authorityCount authority record(s)." -Source $readModelPath
    New-ObservabilityItem -Id 'coverage.dashboard-projection' -Status $(if ($dashboardCardCount -gt 0) { 'pass' } else { 'unknown' }) -Summary "Dashboard projection exposes $dashboardCardCount passive card(s)." -Source $dashboardProjectionPath
    New-ObservabilityItem -Id 'coverage.monitoring' -Status $(if ($monitoringCoverage -gt 0) { 'pass' } else { 'unknown' }) -Summary "Projection monitoring checked $monitoringCoverage projection item(s)." -Source $monitoringPath
    New-ObservabilityItem -Id 'coverage.evidence' -Status $(if ($evidenceCoverage -gt 0) { 'pass' } else { 'unknown' }) -Summary "Evidence Center references $evidenceCoverage source file(s)." -Source $evidencePath
    New-ObservabilityItem -Id 'coverage.input-set' -Status $(if ($unknownInputCount -eq 0) { 'pass' } else { 'unknown' }) -Summary "Known observability inputs: $knownInputCount of $(@($inputs).Count); coveragePercent=$coveragePercent." -Source 'runtime/authority/authority-observability.report.json'
)

$trendItems = @(
    New-ObservabilityItem -Id 'trend.monitoring-status' -Status (Convert-ToObservabilityStatus -Status $(if ($null -eq $monitoring) { 'unknown' } else { [string]$monitoring.status })) -Summary "Projection monitoring status is $(if ($null -eq $monitoring) { 'unknown' } else { [string]$monitoring.status })." -Source $monitoringPath
    New-ObservabilityItem -Id 'trend.evidence-status' -Status (Convert-ToObservabilityStatus -Status $(if ($null -eq $evidence) { 'unknown' } else { [string]$evidence.status })) -Summary "Evidence Center status is $(if ($null -eq $evidence) { 'unknown' } else { [string]$evidence.status })." -Source $evidencePath
    New-ObservabilityItem -Id 'trend.history-status' -Status (Convert-ToObservabilityStatus -Status $(if ($null -eq $history) { 'unknown' } else { [string]$history.status })) -Summary "History and retention status is $(if ($null -eq $history) { 'unknown' } else { [string]$history.status })." -Source $historyPath
)

$retentionItems = @(
    New-ObservabilityItem -Id 'retention.history-policy' -Status $(if ($null -ne $history -and $history.retention.pruningAllowed -eq $false -and $history.retention.repairAllowed -eq $false -and $history.retention.synchronizationAllowed -eq $false) { 'pass' } else { 'unknown' }) -Summary "History retention policy is $(if ($null -eq $history) { 'unknown' } else { [string]$history.retention.policyId }); retainedSnapshotCount=$(if ($null -eq $history) { 'unknown' } else { [string]$history.retention.retainedSnapshotCount })." -Source $historyPath
)

$healthItems = @(
    New-ObservabilityItem -Id 'health.inputs' -Status $(if ($unknownInputCount -eq 0) { 'pass' } else { 'unknown' }) -Summary "unknownInputCount=$unknownInputCount; staleInputCount=$staleInputCount." -Source 'runtime/authority/authority-observability.report.json'
    New-ObservabilityItem -Id 'health.monitoring-findings' -Status $(if ($null -eq $monitoring) { 'unknown' } elseif ([int]$monitoring.summary.findingCount -gt 0) { 'warning' } else { 'pass' }) -Summary "monitoringFindingCount=$(if ($null -eq $monitoring) { 'unknown' } else { [string]$monitoring.summary.findingCount })." -Source $monitoringPath
    New-ObservabilityItem -Id 'health.evidence-unknowns' -Status $(if ($null -eq $evidence) { 'unknown' } elseif ([int]$evidence.summary.unknownCount -gt 0) { 'unknown' } else { 'pass' }) -Summary "evidenceUnknownCount=$(if ($null -eq $evidence) { 'unknown' } else { [string]$evidence.summary.unknownCount })." -Source $evidencePath
)

$unknownItems = @()
foreach ($input in $inputs) {
    if ($input.verdict -eq 'unknown') {
        $unknownItems += New-ObservabilityItem -Id "unknown.$($input.path.Replace('/', '.'))" -Status 'unknown' -Summary $input.reason -Source $input.path
    }
}
if ($unknownItems.Count -eq 0 -and $null -ne $history -and $history.unknowns.status -eq 'unknown') {
    $unknownItems += New-ObservabilityItem -Id 'unknown.history-trend-depth' -Status 'unknown' -Summary 'Phase 20 reports unknown trend depth by bounded retention; Observability Center preserves that unknown state.' -Source $historyPath
}
if ($unknownItems.Count -eq 0) {
    $unknownItems += New-ObservabilityItem -Id 'unknown.none-detected' -Status 'pass' -Summary 'No unknown observability inputs were detected.' -Source 'runtime/authority/authority-observability.report.json'
}

$freshness = New-ObservabilityGroup -Items $freshnessItems
$lineage = New-ObservabilityGroup -Items $lineageItems
$coverage = New-ObservabilityGroup -Items $coverageItems
$trend = New-ObservabilityGroup -Items $trendItems
$retention = New-ObservabilityGroup -Items $retentionItems
$health = New-ObservabilityGroup -Items $healthItems
$unknowns = New-ObservabilityGroup -Items $unknownItems

$allItems = @($freshness.items + $lineage.items + $coverage.items + $trend.items + $retention.items + $health.items + $unknowns.items)
$warningCount = @($allItems | Where-Object { $_.status -eq 'warning' }).Count
$unknownCount = @($allItems | Where-Object { $_.status -eq 'unknown' }).Count
$status = if ($unknownInputCount -gt 0 -or $unknownCount -gt 0) { 'unknown' } elseif ($warningCount -gt 0) { 'warning' } else { 'pass' }

$report = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-21'
    reportId = 'authority-evidence-observability'
    generatedBy = 'services/authority-observability/generate-authority-observability.ps1'
    generatedAt = $generatedAt
    sourceOfTruth = [ordered]@{
        authority = 'shared/contracts/authority/constitution.rules.json + shared/contracts/authority/authority-registry.json'
        readModel = $readModelPath
        projection = $dashboardProjectionPath
        monitoring = $monitoringPath
        evidence = $evidencePath
        history = $historyPath
    }
    consumedReports = $inputs
    status = $status
    summary = [ordered]@{
        knownInputCount = $knownInputCount
        unknownInputCount = $unknownInputCount
        staleInputCount = $staleInputCount
        coveragePercent = $coveragePercent
        warningCount = $warningCount
        unknownCount = $unknownCount
    }
    freshness = $freshness
    lineage = $lineage
    coverage = $coverage
    trend = $trend
    retention = $retention
    health = $health
    unknowns = $unknowns
    boundary = New-ObservabilityBoundary
}

Write-StudioJson -RelativePath 'runtime/authority/authority-observability.report.json' -Value $report

Write-Host 'Phase 21 authority evidence observability report generated.' -ForegroundColor Green
