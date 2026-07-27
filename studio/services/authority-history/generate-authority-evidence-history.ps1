[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'scripts/lib/StudioRuntime.psm1') -Force

function New-HistoryBoundary {
    return [ordered]@{
        historyOnly = $true
        trendOnly = $true
        readOnly = $true
        derivedOnly = $true
        reportWritingOnly = $true
        ownsAuthorityTruth = $false
        ownsEvidenceTruth = $false
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

function New-ReportInput {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][string]$Role
    )

    $safe = Read-StudioJsonSafe -RelativePath $RelativePath
    $info = Get-StudioLatestRuntimeFile -RelativePath $RelativePath
    $lastModified = if ($null -eq $info) { $null } else { $info.lastModified }
    $known = [bool]($safe.exists -and $safe.validJson)

    return [ordered]@{
        path = $RelativePath.Replace('\', '/')
        role = $Role
        exists = [bool]$safe.exists
        validJson = [bool]$safe.validJson
        lastModified = $lastModified
        verdict = if ($known) { 'known' } else { 'unknown' }
        reason = if ($known) { "$Role is present and readable." } else { "$Role is missing or unreadable; history state is unknown." }
    }
}

function Convert-ToTrendStatus {
    param([AllowNull()][string]$Status)

    if ([string]::IsNullOrWhiteSpace($Status)) { return 'unknown' }
    switch ($Status.ToLowerInvariant()) {
        { $_ -in @('ok', 'pass', 'passed') } { return 'pass' }
        { $_ -in @('warning', 'fail', 'failed', 'error') } { return 'warning' }
        default { return 'unknown' }
    }
}

function New-TrendItem {
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

function New-TrendGroup {
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

$generatedAt = Get-StudioTimestamp
$monitoringPath = 'runtime/authority/authority-projection-monitoring.report.json'
$evidencePath = 'runtime/authority/authority-monitoring-evidence.report.json'
$authorityViewPath = 'runtime/dashboard/authority.view.json'
$evidenceViewPath = 'runtime/dashboard/authority-monitoring-evidence.view.json'

$inputs = @(
    New-ReportInput -RelativePath $monitoringPath -Role 'Phase 18 monitoring report'
    New-ReportInput -RelativePath $evidencePath -Role 'Phase 19 evidence report'
    New-ReportInput -RelativePath $authorityViewPath -Role 'Authority dashboard projection'
    New-ReportInput -RelativePath $evidenceViewPath -Role 'Authority monitoring evidence dashboard view'
)

$monitoringSafe = Read-StudioJsonSafe -RelativePath $monitoringPath
$evidenceSafe = Read-StudioJsonSafe -RelativePath $evidencePath
$monitoring = if ($monitoringSafe.validJson) { $monitoringSafe.value } else { $null }
$evidence = if ($evidenceSafe.validJson) { $evidenceSafe.value } else { $null }

$monitoringStatus = if ($null -eq $monitoring) { 'unknown' } else { [string]$monitoring.status }
$evidenceStatus = if ($null -eq $evidence) { 'unknown' } else { [string]$evidence.status }
$findingCount = if ($null -eq $monitoring) { 0 } else { [int]$monitoring.summary.findingCount }
$unknownCount = if ($null -eq $evidence) { 1 } else { [int]$evidence.summary.unknownCount }
$staleCount = if ($null -eq $monitoring) { 0 } else { [int]$monitoring.summary.staleProjectionCount }
$historySnapshotId = 'authority-evidence-history.current'

$snapshots = @(
    [ordered]@{
        snapshotId = $historySnapshotId
        generatedAt = $generatedAt
        monitoringStatus = $monitoringStatus
        evidenceStatus = $evidenceStatus
        findingCount = $findingCount
        unknownCount = $unknownCount
        source = "$monitoringPath + $evidencePath"
    }
)

$unknownInputCount = @($inputs | Where-Object { $_.verdict -eq 'unknown' }).Count
$knownInputCount = @($inputs | Where-Object { $_.verdict -eq 'known' }).Count

$trendItems = @(
    New-TrendItem -Id 'history-baseline-size' -Status 'unknown' -Summary 'Only the current bounded snapshot is retained; multi-snapshot trend direction is not yet available.' -Source 'runtime/authority/authority-evidence-history.report.json'
    New-TrendItem -Id 'monitoring-status-current' -Status (Convert-ToTrendStatus -Status $monitoringStatus) -Summary "Current Phase 18 monitoring status is $monitoringStatus." -Source $monitoringPath
    New-TrendItem -Id 'evidence-status-current' -Status (Convert-ToTrendStatus -Status $evidenceStatus) -Summary "Current Phase 19 evidence status is $evidenceStatus." -Source $evidencePath
)

$lineageItems = @(
    New-TrendItem -Id 'lineage-monitoring-source' -Status $(if ($monitoringSafe.validJson) { 'pass' } else { 'unknown' }) -Summary 'History consumes Phase 18 monitoring as upstream monitoring source.' -Source $monitoringPath
    New-TrendItem -Id 'lineage-evidence-source' -Status $(if ($evidenceSafe.validJson) { 'pass' } else { 'unknown' }) -Summary 'History consumes Phase 19 evidence as upstream evidence source.' -Source $evidencePath
)

$freshnessStatus = 'unknown'
$freshnessSummary = 'Freshness cannot be determined without both Phase 18 and Phase 19 reports.'
if ($monitoringSafe.validJson -and $evidenceSafe.validJson) {
    $freshnessStatus = if ($staleCount -gt 0) { 'warning' } else { 'pass' }
    $freshnessSummary = "staleProjectionCount=$staleCount; monitoringGeneratedAt=$($monitoring.generatedAt); evidenceGeneratedAt=$($evidence.generatedAt)."
}
$freshnessItems = @(
    New-TrendItem -Id 'freshness-current-authority-evidence' -Status $freshnessStatus -Summary $freshnessSummary -Source "$monitoringPath + $evidencePath"
)

$regressionItems = @(
    New-TrendItem -Id 'regression-history-depth' -Status 'unknown' -Summary 'No prior retained snapshot exists, so regression direction is unknown rather than pass.' -Source 'runtime/authority/authority-evidence-history.report.json'
    New-TrendItem -Id 'regression-current-findings' -Status $(if ($findingCount -gt 0) { 'warning' } else { 'pass' }) -Summary "Current monitoring finding count is $findingCount." -Source $monitoringPath
)

$unknownItems = @()
foreach ($input in $inputs) {
    if ($input.verdict -eq 'unknown') {
        $unknownItems += New-TrendItem -Id "unknown.$($input.path.Replace('/', '.'))" -Status 'unknown' -Summary $input.reason -Source $input.path
    }
}
if ($unknownItems.Count -eq 0) {
    $unknownItems += New-TrendItem -Id 'unknown-prior-history' -Status 'unknown' -Summary 'Prior history is absent by bounded retention policy; trend direction remains unknown, not pass.' -Source 'runtime/authority/authority-evidence-history.report.json'
}

$trend = New-TrendGroup -Items $trendItems
$lineage = New-TrendGroup -Items $lineageItems
$freshness = New-TrendGroup -Items $freshnessItems
$regressions = New-TrendGroup -Items $regressionItems
$unknowns = New-TrendGroup -Items $unknownItems

$warningCount = @($trend.items + $lineage.items + $freshness.items + $regressions.items + $unknowns.items | Where-Object { $_.status -eq 'warning' }).Count
$regressionCount = @($regressions.items | Where-Object { $_.status -eq 'warning' }).Count
$status = if ($unknownInputCount -gt 0 -or $unknowns.status -eq 'unknown') { 'unknown' } elseif ($warningCount -gt 0) { 'warning' } else { 'pass' }

$report = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-20'
    reportId = 'authority-evidence-history'
    generatedBy = 'services/authority-history/generate-authority-evidence-history.ps1'
    generatedAt = $generatedAt
    sourceOfTruth = [ordered]@{
        constitution = 'shared/contracts/authority/constitution.rules.json'
        authorityRegistry = 'shared/contracts/authority/authority-registry.json'
        monitoring = $monitoringPath
        evidence = $evidencePath
    }
    consumedReports = $inputs
    status = $status
    summary = [ordered]@{
        snapshotCount = $snapshots.Count
        knownInputCount = $knownInputCount
        unknownInputCount = $unknownInputCount
        warningCount = $warningCount
        regressionCount = $regressionCount
    }
    history = [ordered]@{
        mode = 'derived-current-snapshot'
        snapshots = $snapshots
    }
    trend = $trend
    retention = [ordered]@{
        policyId = 'authority-evidence-history-retention'
        retainedSnapshotCount = 1
        pruningAllowed = $false
        repairAllowed = $false
        synchronizationAllowed = $false
        reason = 'Phase 20 keeps a bounded generated report snapshot for visibility only; pruning or repair requires a separate reviewed phase.'
    }
    lineage = $lineage
    freshness = $freshness
    regressions = $regressions
    unknowns = $unknowns
    boundary = New-HistoryBoundary
}

Write-StudioJson -RelativePath 'runtime/authority/authority-evidence-history.report.json' -Value $report

Write-Host 'Phase 20 authority evidence history report generated.' -ForegroundColor Green
