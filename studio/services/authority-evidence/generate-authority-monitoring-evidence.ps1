[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'scripts/lib/StudioRuntime.psm1') -Force

function New-EvidenceBoundary {
    return [ordered]@{
        evidenceOnly = $true
        readOnly = $true
        derivedOnly = $true
        reportWritingOnly = $true
        ownsAuthority = $false
        ownsTruth = $false
        createsDecisions = $false
        createsApprovals = $false
        repairsProjection = $false
        synchronizesProjection = $false
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        credentialAccessAllowed = $false
        secretAccessAllowed = $false
        runtimeMutationAllowed = $false
        dashboardActionAllowed = $false
        approvalAutomationAllowed = $false
        workflowExecutionAllowed = $false
        browserAuthorityStorageAllowed = $false
    }
}

function Convert-MonitoringStatusToEvidenceVerdict {
    param([AllowNull()][string]$Status)

    if ([string]::IsNullOrWhiteSpace($Status)) { return 'unknown' }
    switch ($Status.ToLowerInvariant()) {
        'ok' { return 'pass' }
        'passed' { return 'pass' }
        'warning' { return 'fail' }
        'error' { return 'fail' }
        'failed' { return 'fail' }
        default { return 'unknown' }
    }
}

function Get-GroupVerdict {
    param([Parameter(Mandatory)]$Items)

    $values = @($Items)
    if (@($values | Where-Object { $_.verdict -eq 'unknown' }).Count -gt 0) { return 'unknown' }
    if (@($values | Where-Object { $_.verdict -eq 'fail' }).Count -gt 0) { return 'fail' }
    return 'pass'
}

function New-FileEvidence {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][string]$Kind,
        [Parameter(Mandatory)][string]$Role
    )

    $safe = Read-StudioJsonSafe -RelativePath $RelativePath
    $info = Get-StudioLatestRuntimeFile -RelativePath $RelativePath
    if ($null -eq $info) {
        $root = Get-StudioRoot
        $path = Join-Path $root $RelativePath
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            $item = Get-Item -LiteralPath $path
            $lastModified = $item.LastWriteTimeUtc.ToString('o')
        }
        else {
            $lastModified = $null
        }
    }
    else {
        $lastModified = $info.lastModified
    }

    $verdict = if ($safe.exists -and $safe.validJson) { 'pass' } else { 'unknown' }
    $reason = if ($safe.exists -and $safe.validJson) { "$Role is present and readable." } else { "$Role is missing or unreadable; evidence remains unknown." }

    return [ordered]@{
        path = $RelativePath.Replace('\', '/')
        kind = $Kind
        role = $Role
        exists = [bool]$safe.exists
        validJson = [bool]$safe.validJson
        lastModified = $lastModified
        verdict = $verdict
        reason = $reason
    }
}

function New-EvidenceItem {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$Verdict,
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Projection,
        [Parameter(Mandatory)][string]$Summary
    )

    return [ordered]@{
        id = $Id
        verdict = $Verdict
        source = $Source
        projection = $Projection
        summary = $Summary
        safe = ($Verdict -eq 'pass')
    }
}

function New-EvidenceGroup {
    param([Parameter(Mandatory)]$Items)

    $array = @($Items)
    return [ordered]@{
        status = Get-GroupVerdict -Items $array
        items = $array
    }
}

$generatedAt = Get-StudioTimestamp
$monitoringPath = 'runtime/authority/authority-projection-monitoring.report.json'
$readModelPath = 'runtime/authority/authority-read-model.report.json'
$queryResponsesPath = 'runtime/authority/authority-query-responses.report.json'
$authorityViewPath = 'runtime/dashboard/authority.view.json'

$monitoringFile = New-FileEvidence -RelativePath $monitoringPath -Kind 'monitoring-report' -Role 'Phase 18 monitoring source'
$sourceFileEvidence = @(
    New-FileEvidence -RelativePath 'shared/contracts/authority/constitution.rules.json' -Kind 'source' -Role 'Constitution source of truth'
    New-FileEvidence -RelativePath 'shared/contracts/authority/authority-registry.json' -Kind 'source' -Role 'Authority ownership source'
    New-FileEvidence -RelativePath $readModelPath -Kind 'source' -Role 'Authority read model projection'
    New-FileEvidence -RelativePath $queryResponsesPath -Kind 'source' -Role 'Authority query response projection'
    $monitoringFile
)
$projectionFileEvidence = @(
    New-FileEvidence -RelativePath $authorityViewPath -Kind 'projection' -Role 'Authority dashboard projection'
    New-FileEvidence -RelativePath 'runtime/dashboard/authority-projection-monitoring.view.json' -Kind 'dashboard-view' -Role 'Phase 18 dashboard monitoring view'
)

$monitoringSafe = Read-StudioJsonSafe -RelativePath $monitoringPath
$monitoring = if ($monitoringSafe.validJson) { $monitoringSafe.value } else { $null }

if ($null -eq $monitoring) {
    $unknownItem = New-EvidenceItem -Id 'monitoring-source-unavailable' -Verdict 'unknown' -Source $monitoringPath -Projection $authorityViewPath -Summary 'Phase 18 monitoring report is missing or unreadable; evidence cannot infer success.'
    $lineageEvidence = New-EvidenceGroup -Items @($unknownItem)
    $verdictEvidence = New-EvidenceGroup -Items @($unknownItem)
    $freshnessEvidence = New-EvidenceGroup -Items @($unknownItem)
    $completenessEvidence = New-EvidenceGroup -Items @($unknownItem)
    $mismatchEvidence = New-EvidenceGroup -Items @($unknownItem)
}
else {
    $lineageItems = @($monitoring.lineage.checks | ForEach-Object {
        New-EvidenceItem -Id $_.id -Verdict (Convert-MonitoringStatusToEvidenceVerdict -Status $_.status) -Source $readModelPath -Projection $authorityViewPath -Summary $_.summary
    })
    if ($lineageItems.Count -eq 0) {
        $lineageItems = @((New-EvidenceItem -Id 'lineage-evidence-missing' -Verdict 'unknown' -Source $readModelPath -Projection $authorityViewPath -Summary 'Monitoring report contains no lineage checks.'))
    }
    $lineageEvidence = New-EvidenceGroup -Items $lineageItems

    $verdictItems = @(
        New-EvidenceItem -Id 'monitoring-verdict' -Verdict (Convert-MonitoringStatusToEvidenceVerdict -Status $monitoring.status) -Source $monitoringPath -Projection $authorityViewPath -Summary "Phase 18 status=$($monitoring.status); findings=$($monitoring.summary.findingCount)."
    )
    foreach ($finding in @($monitoring.findings | Sort-Object id)) {
        $verdictItems += New-EvidenceItem -Id $finding.id -Verdict 'fail' -Source $finding.source -Projection $finding.projection -Summary $finding.summary
    }
    $verdictEvidence = New-EvidenceGroup -Items $verdictItems

    $freshnessEvidence = New-EvidenceGroup -Items @(
        New-EvidenceItem -Id 'freshness-marker-comparison' -Verdict (Convert-MonitoringStatusToEvidenceVerdict -Status $monitoring.freshness.status) -Source $readModelPath -Projection $authorityViewPath -Summary "sourceLastModified=$($monitoring.freshness.sourceLastModified); projectionLastModified=$($monitoring.freshness.projectionLastModified); projectionOlderThanSource=$($monitoring.freshness.projectionOlderThanSource)."
    )

    $completenessItems = @($monitoring.completeness.checks | ForEach-Object {
        New-EvidenceItem -Id $_.id -Verdict (Convert-MonitoringStatusToEvidenceVerdict -Status $_.status) -Source $readModelPath -Projection $authorityViewPath -Summary $_.summary
    })
    if ($completenessItems.Count -eq 0) {
        $completenessItems = @((New-EvidenceItem -Id 'completeness-evidence-missing' -Verdict 'unknown' -Source $readModelPath -Projection $authorityViewPath -Summary 'Monitoring report contains no completeness checks.'))
    }
    $completenessEvidence = New-EvidenceGroup -Items $completenessItems

    $mismatchItems = @($monitoring.structuralChecks.checks | ForEach-Object {
        New-EvidenceItem -Id $_.id -Verdict (Convert-MonitoringStatusToEvidenceVerdict -Status $_.status) -Source $readModelPath -Projection $authorityViewPath -Summary $_.summary
    })
    if ($mismatchItems.Count -eq 0) {
        $mismatchItems = @((New-EvidenceItem -Id 'mismatch-evidence-missing' -Verdict 'unknown' -Source $readModelPath -Projection $authorityViewPath -Summary 'Monitoring report contains no structural mismatch checks.'))
    }
    $mismatchEvidence = New-EvidenceGroup -Items $mismatchItems
}

$boundary = New-EvidenceBoundary
$safetyItems = @()
foreach ($flag in @('repairsProjection', 'synchronizesProjection', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeMutationAllowed', 'dashboardActionAllowed', 'approvalAutomationAllowed', 'workflowExecutionAllowed', 'browserAuthorityStorageAllowed', 'ownsAuthority', 'ownsTruth')) {
    $value = $boundary[$flag]
    $safetyItems += New-EvidenceItem -Id "safety.$flag" -Verdict $(if ($value -eq $false) { 'pass' } else { 'fail' }) -Source 'shared/contracts/authority/evidence/evidence.manifest.json' -Projection 'runtime/authority/authority-monitoring-evidence.report.json' -Summary "$flag=$value."
}
$safetyEvidence = New-EvidenceGroup -Items $safetyItems

$unknownItems = @()
foreach ($file in @($sourceFileEvidence + $projectionFileEvidence)) {
    if ($file.verdict -eq 'unknown') {
        $unknownItems += New-EvidenceItem -Id "unknown.$($file.path.Replace('/', '.'))" -Verdict 'unknown' -Source $file.path -Projection 'runtime/authority/authority-monitoring-evidence.report.json' -Summary $file.reason
    }
}
if ($unknownItems.Count -eq 0) {
    $unknownItems += New-EvidenceItem -Id 'unknown-state-proof' -Verdict 'unknown' -Source 'simulated-missing-input' -Projection 'runtime/authority/authority-monitoring-evidence.report.json' -Summary 'If an input is missing or unreadable, Evidence Center classifies it as unknown, never pass.'
}
$unknownEvidence = New-EvidenceGroup -Items $unknownItems

$allGroups = @($lineageEvidence, $verdictEvidence, $freshnessEvidence, $completenessEvidence, $mismatchEvidence, $safetyEvidence, $unknownEvidence)
$allItems = @($allGroups | ForEach-Object { $_.items })
$unknownCount = @($allItems | Where-Object { $_.verdict -eq 'unknown' }).Count
$failCount = @($allItems | Where-Object { $_.verdict -eq 'fail' }).Count
$passCount = @($allItems | Where-Object { $_.verdict -eq 'pass' }).Count

$status = if ($unknownCount -gt 0) { 'unknown' } elseif ($failCount -gt 0) { 'fail' } else { 'pass' }
$findingCount = if ($null -ne $monitoring) { @($monitoring.findings).Count } else { 0 }

$report = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-19'
    reportId = 'authority-monitoring-evidence'
    generatedBy = 'services/authority-evidence/generate-authority-monitoring-evidence.ps1'
    generatedAt = $generatedAt
    sourceOfTruth = [ordered]@{
        constitution = 'shared/contracts/authority/constitution.rules.json'
        authorityRegistry = 'shared/contracts/authority/authority-registry.json'
        monitoring = $monitoringPath
    }
    monitoringSource = $monitoringFile
    status = $status
    summary = [ordered]@{
        passCount = $passCount
        failCount = $failCount
        unknownCount = $unknownCount
        sourceFileCount = @($sourceFileEvidence).Count
        projectionFileCount = @($projectionFileEvidence).Count
        findingCount = $findingCount
    }
    sourceFileEvidence = $sourceFileEvidence
    projectionFileEvidence = $projectionFileEvidence
    lineageEvidence = $lineageEvidence
    verdictEvidence = $verdictEvidence
    freshnessEvidence = $freshnessEvidence
    completenessEvidence = $completenessEvidence
    mismatchEvidence = $mismatchEvidence
    safetyEvidence = $safetyEvidence
    unknownEvidence = $unknownEvidence
    unknownStateProof = [ordered]@{
        simulatedMissingInput = 'runtime/authority/missing-phase-19-input.fixture.json'
        verdict = 'unknown'
        reason = 'Missing evidence is classified as unknown and cannot produce a pass verdict.'
    }
    boundary = $boundary
}

Write-StudioJson -RelativePath 'runtime/authority/authority-monitoring-evidence.report.json' -Value $report

Write-Host 'Phase 19 authority monitoring evidence report generated.' -ForegroundColor Green
