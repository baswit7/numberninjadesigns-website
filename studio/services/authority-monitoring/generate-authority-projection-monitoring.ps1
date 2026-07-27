[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'scripts/lib/StudioRuntime.psm1') -Force

function New-MonitoringBoundary {
    return [ordered]@{
        monitoringOnly = $true
        derivedOnly = $true
        ownsAuthority = $false
        repairsProjection = $false
        synchronizesProjection = $false
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        credentialAccessAllowed = $false
        secretAccessAllowed = $false
        runtimeMutationAllowed = $false
        reportWritingOnly = $true
        dashboardActionAllowed = $false
        approvalAutomationAllowed = $false
    }
}

function Get-SourceRef {
    param([Parameter(Mandatory)][string]$RelativePath)

    $info = Get-StudioLatestRuntimeFile -RelativePath $RelativePath
    if ($null -eq $info) {
        $root = Get-StudioRoot
        $path = Join-Path $root $RelativePath
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            $item = Get-Item -LiteralPath $path
            $lastModified = $item.LastWriteTimeUtc.ToString('o')
            $exists = $true
        }
        else {
            $lastModified = $null
            $exists = $false
        }
    }
    else {
        $lastModified = $info.lastModified
        $exists = $true
    }

    $safe = Read-StudioJsonSafe -RelativePath $RelativePath
    return [ordered]@{
        path = $RelativePath.Replace('\', '/')
        exists = $exists
        validJson = [bool]$safe.validJson
        lastModified = $lastModified
    }
}

function Add-Finding {
    param(
        [Parameter(Mandatory)]$Findings,
        [Parameter(Mandatory)][string]$Type,
        [Parameter(Mandatory)][string]$Severity,
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Projection,
        [Parameter(Mandatory)][string]$Summary
    )

    $idSuffix = ($Summary -replace '[^a-zA-Z0-9._-]', '-').ToLowerInvariant().Trim('-')
    if ($idSuffix.Length -gt 80) {
        $idSuffix = $idSuffix.Substring(0, 80).Trim('-')
    }
    $Findings.Add([ordered]@{
        id = "authority-projection.$Type.$idSuffix"
        type = $Type
        severity = $Severity
        source = $Source
        projection = $Projection
        summary = $Summary
    }) | Out-Null
}

function New-Check {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$Status,
        [Parameter(Mandatory)][string]$Summary
    )

    return [ordered]@{
        id = $Id
        status = $Status
        summary = $Summary
    }
}

function Get-GroupStatus {
    param([Parameter(Mandatory)]$Checks)

    $items = @($Checks)
    if (@($items | Where-Object { $_.status -eq 'error' }).Count -gt 0) { return 'error' }
    if (@($items | Where-Object { $_.status -eq 'warning' }).Count -gt 0) { return 'warning' }
    return 'ok'
}

$generatedAt = Get-StudioTimestamp
$findings = New-Object System.Collections.Generic.List[object]
$lineageChecks = New-Object System.Collections.Generic.List[object]
$completenessChecks = New-Object System.Collections.Generic.List[object]
$structuralChecks = New-Object System.Collections.Generic.List[object]

$sourcePaths = [ordered]@{
    constitution = 'shared/contracts/authority/constitution.rules.json'
    authorityRegistry = 'shared/contracts/authority/authority-registry.json'
    readModel = 'runtime/authority/authority-read-model.report.json'
    queryResponses = 'runtime/authority/authority-query-responses.report.json'
    authorityDashboard = 'runtime/dashboard/authority.view.json'
}

$consumedSources = @(
    Get-SourceRef -RelativePath $sourcePaths.constitution
    Get-SourceRef -RelativePath $sourcePaths.authorityRegistry
    Get-SourceRef -RelativePath $sourcePaths.readModel
    Get-SourceRef -RelativePath $sourcePaths.queryResponses
    Get-SourceRef -RelativePath $sourcePaths.authorityDashboard
)
$monitoredProjection = Get-SourceRef -RelativePath $sourcePaths.authorityDashboard

$constitutionSafe = Read-StudioJsonSafe -RelativePath $sourcePaths.constitution
$registrySafe = Read-StudioJsonSafe -RelativePath $sourcePaths.authorityRegistry
$readModelSafe = Read-StudioJsonSafe -RelativePath $sourcePaths.readModel
$dashboardSafe = Read-StudioJsonSafe -RelativePath $sourcePaths.authorityDashboard

if (-not $dashboardSafe.validJson) {
    Add-Finding -Findings $findings -Type 'missing-projection' -Severity 'error' -Source $sourcePaths.readModel -Projection $sourcePaths.authorityDashboard -Summary 'Authority dashboard projection is missing or unreadable.'
    $lineageChecks.Add((New-Check -Id 'projection-exists' -Status 'error' -Summary 'Authority dashboard projection is missing or unreadable.')) | Out-Null
    $completenessChecks.Add((New-Check -Id 'projection-completeness' -Status 'error' -Summary 'Completeness cannot be proven without authority dashboard projection JSON.')) | Out-Null
    $structuralChecks.Add((New-Check -Id 'projection-structure' -Status 'error' -Summary 'Structure cannot be proven without authority dashboard projection JSON.')) | Out-Null
}

if (-not $readModelSafe.validJson) {
    Add-Finding -Findings $findings -Type 'missing-projection' -Severity 'error' -Source $sourcePaths.authorityRegistry -Projection $sourcePaths.readModel -Summary 'Authority read model projection is missing or unreadable.'
    $lineageChecks.Add((New-Check -Id 'read-model-exists' -Status 'error' -Summary 'Authority read model projection is missing or unreadable.')) | Out-Null
}

$authorityCount = 0
$expectedProjectionCount = 0
$missingProjectionCount = 0
$staleProjectionCount = 0
$structuralMismatchCount = 0
$lineageIssueCount = 0
$completenessIssueCount = 0
$projectionOlderThanSource = $false
$sourceLastModified = $null
$projectionLastModified = $monitoredProjection.lastModified

if ($readModelSafe.validJson) {
    $readModel = $readModelSafe.value
    $authorities = @($readModel.authorities)
    $authorityCount = $authorities.Count
    $deniedAuthorities = @($authorities | Where-Object { $_.decision -eq 'DENY' })
    $classificationGroups = @($authorities | Group-Object classification)
    $expectedProjectionCount = 1 + $classificationGroups.Count + $deniedAuthorities.Count
    $readModelRef = Get-SourceRef -RelativePath $sourcePaths.readModel
    $sourceLastModified = $readModelRef.lastModified

    if ($dashboardSafe.validJson) {
        $dashboard = $dashboardSafe.value
        $cards = @($dashboard.cards)

        if ($sourceLastModified -and $projectionLastModified) {
            $sourceTime = [datetime]::Parse($sourceLastModified).ToUniversalTime()
            $projectionTime = [datetime]::Parse($projectionLastModified).ToUniversalTime()
            if ($projectionTime -lt $sourceTime) {
                $projectionOlderThanSource = $true
                $staleProjectionCount = 1
                Add-Finding -Findings $findings -Type 'stale-projection' -Severity 'warning' -Source $sourcePaths.readModel -Projection $sourcePaths.authorityDashboard -Summary 'Authority dashboard projection is older than the authority read model.'
            }
        }

        if ($dashboard.source -ne 'studio-dashboard:authority') {
            $lineageIssueCount++
            Add-Finding -Findings $findings -Type 'lineage-issue' -Severity 'error' -Source $sourcePaths.readModel -Projection $sourcePaths.authorityDashboard -Summary 'Authority dashboard projection source marker does not match studio-dashboard:authority.'
        }
        else {
            $lineageChecks.Add((New-Check -Id 'dashboard-source-marker' -Status 'ok' -Summary 'Dashboard source marker is studio-dashboard:authority.')) | Out-Null
        }

        $summaryCards = @($cards | Where-Object { $_.id -eq 'authority.summary' })
        if ($summaryCards.Count -ne 1) {
            $missingProjectionCount++
            $completenessIssueCount++
            Add-Finding -Findings $findings -Type 'missing-projection' -Severity 'error' -Source $sourcePaths.readModel -Projection $sourcePaths.authorityDashboard -Summary 'Authority summary projection card is missing or duplicated.'
        }
        else {
            $summary = $summaryCards[0]
            $sourceContractsMatch = $true
            foreach ($propertyName in @('constitution', 'authorityRegistry', 'classifications', 'decisions')) {
                if ($summary.details.sourceContracts.$propertyName -ne $readModel.sourceContracts.$propertyName) {
                    $sourceContractsMatch = $false
                }
            }
            if (-not $sourceContractsMatch) {
                $lineageIssueCount++
                Add-Finding -Findings $findings -Type 'lineage-issue' -Severity 'error' -Source $sourcePaths.readModel -Projection $sourcePaths.authorityDashboard -Summary 'Authority summary sourceContracts do not match the authority read model lineage.'
            }
            else {
                $lineageChecks.Add((New-Check -Id 'summary-source-contracts' -Status 'ok' -Summary 'Authority summary lineage matches read model sourceContracts.')) | Out-Null
            }

            if ($summary.details.authorityCount -ne $readModel.summary.authorityCount -or $summary.details.deniedAuthorityCount -ne $readModel.summary.deniedAuthorityCount -or $summary.details.relationshipCount -ne $readModel.summary.relationshipCount) {
                $structuralMismatchCount++
                Add-Finding -Findings $findings -Type 'structural-mismatch' -Severity 'error' -Source $sourcePaths.readModel -Projection $sourcePaths.authorityDashboard -Summary 'Authority summary counts do not match the authority read model.'
            }
            else {
                $structuralChecks.Add((New-Check -Id 'summary-counts' -Status 'ok' -Summary 'Authority summary counts match the authority read model.')) | Out-Null
            }
        }

        foreach ($group in $classificationGroups) {
            $cardId = "authority.classification.$($group.Name)"
            $matches = @($cards | Where-Object { $_.id -eq $cardId })
            if ($matches.Count -ne 1) {
                $missingProjectionCount++
                $completenessIssueCount++
                Add-Finding -Findings $findings -Type 'missing-projection' -Severity 'error' -Source $sourcePaths.readModel -Projection $sourcePaths.authorityDashboard -Summary "Classification projection '$cardId' is missing or duplicated."
                continue
            }
            if ($matches[0].details.count -ne $group.Count) {
                $structuralMismatchCount++
                Add-Finding -Findings $findings -Type 'structural-mismatch' -Severity 'error' -Source $sourcePaths.readModel -Projection $sourcePaths.authorityDashboard -Summary "Classification projection '$cardId' count does not match read model."
            }
        }

        foreach ($authority in $deniedAuthorities) {
            $cardId = "authority.denied.$($authority.authorityId)"
            $matches = @($cards | Where-Object { $_.id -eq $cardId })
            if ($matches.Count -ne 1) {
                $missingProjectionCount++
                $completenessIssueCount++
                Add-Finding -Findings $findings -Type 'missing-projection' -Severity 'error' -Source $sourcePaths.readModel -Projection $sourcePaths.authorityDashboard -Summary "Denied authority projection '$cardId' is missing or duplicated."
                continue
            }
            $card = $matches[0]
            if ($card.details.authorityId -ne $authority.authorityId -or $card.details.owner -ne $authority.owner -or $card.details.decision -ne $authority.decision -or $card.details.classification -ne $authority.classification) {
                $structuralMismatchCount++
                Add-Finding -Findings $findings -Type 'structural-mismatch' -Severity 'error' -Source $sourcePaths.readModel -Projection $sourcePaths.authorityDashboard -Summary "Denied authority projection '$cardId' does not match read model fields."
            }
        }

        foreach ($card in $cards) {
            if ($card.sourceFile -notlike 'runtime/authority/*.json') {
                $lineageIssueCount++
                Add-Finding -Findings $findings -Type 'lineage-issue' -Severity 'error' -Source $sourcePaths.readModel -Projection $sourcePaths.authorityDashboard -Summary "Dashboard card '$($card.id)' has invalid sourceFile lineage."
            }
            if ($card.PSObject.Properties['details']) {
                if ($card.details.PSObject.Properties['canExecute'] -and $card.details.canExecute -ne $false) {
                    $structuralMismatchCount++
                    Add-Finding -Findings $findings -Type 'structural-mismatch' -Severity 'error' -Source $sourcePaths.readModel -Projection $sourcePaths.authorityDashboard -Summary "Dashboard card '$($card.id)' exposes canExecute=true."
                }
                if ($card.details.PSObject.Properties['canMutate'] -and $card.details.canMutate -ne $false) {
                    $structuralMismatchCount++
                    Add-Finding -Findings $findings -Type 'structural-mismatch' -Severity 'error' -Source $sourcePaths.readModel -Projection $sourcePaths.authorityDashboard -Summary "Dashboard card '$($card.id)' exposes canMutate=true."
                }
            }
        }

        if ($missingProjectionCount -eq 0 -and $completenessIssueCount -eq 0) {
            $completenessChecks.Add((New-Check -Id 'expected-authority-cards' -Status 'ok' -Summary "$expectedProjectionCount expected authority dashboard cards are present.")) | Out-Null
        }
        if ($structuralMismatchCount -eq 0) {
            $structuralChecks.Add((New-Check -Id 'authority-field-parity' -Status 'ok' -Summary 'Projected authority fields match read model values.')) | Out-Null
        }
    }
}

if ($projectionOlderThanSource) {
    $freshnessStatus = 'warning'
}
elseif (-not $dashboardSafe.validJson -or -not $readModelSafe.validJson) {
    $freshnessStatus = 'error'
}
else {
    $freshnessStatus = 'ok'
}

if ($lineageChecks.Count -eq 0 -and $lineageIssueCount -eq 0) {
    $lineageChecks.Add((New-Check -Id 'lineage-available' -Status 'ok' -Summary 'Projection lineage is traceable to authority read model sources.')) | Out-Null
}
if ($structuralChecks.Count -eq 0 -and $structuralMismatchCount -eq 0) {
    $structuralChecks.Add((New-Check -Id 'structure-available' -Status 'ok' -Summary 'Projection structure is available for monitoring.')) | Out-Null
}
if ($completenessChecks.Count -eq 0 -and $completenessIssueCount -eq 0) {
    $completenessChecks.Add((New-Check -Id 'completeness-available' -Status 'ok' -Summary 'Projection completeness is available for monitoring.')) | Out-Null
}

$status = 'ok'
if (@($findings.ToArray() | Where-Object { $_.severity -eq 'error' }).Count -gt 0) {
    $status = 'error'
}
elseif ($findings.Count -gt 0) {
    $status = 'warning'
}

$report = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-18'
    reportId = 'authority-projection-monitoring'
    generatedBy = 'services/authority-monitoring/generate-authority-projection-monitoring.ps1'
    generatedAt = $generatedAt
    sourceOfTruth = [ordered]@{
        constitution = $sourcePaths.constitution
        authorityRegistry = $sourcePaths.authorityRegistry
        readModel = $sourcePaths.readModel
    }
    consumedSources = $consumedSources
    monitoredProjection = $monitoredProjection
    status = $status
    summary = [ordered]@{
        authorityCount = $authorityCount
        expectedProjectionCount = $expectedProjectionCount
        missingProjectionCount = $missingProjectionCount
        staleProjectionCount = $staleProjectionCount
        structuralMismatchCount = $structuralMismatchCount
        lineageIssueCount = $lineageIssueCount
        completenessIssueCount = $completenessIssueCount
        findingCount = $findings.Count
    }
    freshness = [ordered]@{
        status = $freshnessStatus
        sourceLastModified = $sourceLastModified
        projectionLastModified = $projectionLastModified
        projectionOlderThanSource = $projectionOlderThanSource
    }
    lineage = [ordered]@{
        status = Get-GroupStatus -Checks $lineageChecks.ToArray()
        checks = $lineageChecks.ToArray()
    }
    completeness = [ordered]@{
        status = Get-GroupStatus -Checks $completenessChecks.ToArray()
        checks = $completenessChecks.ToArray()
    }
    structuralChecks = [ordered]@{
        status = Get-GroupStatus -Checks $structuralChecks.ToArray()
        checks = $structuralChecks.ToArray()
    }
    findings = $findings.ToArray()
    boundary = New-MonitoringBoundary
}

Write-StudioJson -RelativePath 'runtime/authority/authority-projection-monitoring.report.json' -Value $report

Write-Host 'Phase 18 authority projection monitoring report generated.' -ForegroundColor Green
