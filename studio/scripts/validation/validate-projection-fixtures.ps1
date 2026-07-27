[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$failures = New-Object System.Collections.Generic.List[string]
$root = Get-StudioRoot

function Add-Failure {
    param([string]$Message)
    $failures.Add($Message) | Out-Null
}

function Assert-PathExists {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][string]$ExpectedType
    )

    $path = Join-Path $root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType $ExpectedType)) {
        Add-Failure "Required $ExpectedType missing: $RelativePath"
        return $false
    }
    return $true
}

function Assert-FalseBoundaryFlag {
    param(
        [Parameter(Mandatory)]$Object,
        [Parameter(Mandatory)][string]$Flag,
        [Parameter(Mandatory)][string]$Label
    )

    $property = $Object.PSObject.Properties[$Flag]
    if ($null -eq $property) {
        Add-Failure "$Label missing boundary flag $Flag."
        return
    }
    if ($property.Value -ne $false) {
        Add-Failure "$Label boundary flag $Flag must be false."
    }
}

function Assert-ReadOnlyBoundary {
    param(
        [Parameter(Mandatory)]$Boundary,
        [Parameter(Mandatory)][string]$Label,
        [string[]]$FalseFlags = @(
            'writesAllowed',
            'runtimeMutationAllowed',
            'dashboardMutationAllowed',
            'executionAllowed',
            'providerCallsAllowed',
            'deploymentAllowed',
            'credentialAccessAllowed',
            'browserStorageAuthorityAllowed'
        )
    )

    if ($Boundary.PSObject.Properties['readOnly'] -and $Boundary.readOnly -ne $true) {
        Add-Failure "$Label boundary readOnly must be true."
    }
    foreach ($flag in $FalseFlags) {
        Assert-FalseBoundaryFlag -Object $Boundary -Flag $flag -Label $Label
    }
}

function Test-DashboardProjectionFixture {
    param(
        [Parameter(Mandatory)]$Fixture,
        [Parameter(Mandatory)][string]$RelativePath
    )

    foreach ($field in @('schemaVersion', 'projectionId', 'generatedAt', 'source', 'runtimeTruth', 'producer', 'consumer', 'sources', 'sections', 'boundary', 'nonExecutableMetadata')) {
        if ($null -eq $Fixture.PSObject.Properties[$field]) {
            Add-Failure "$RelativePath missing required projection field $field."
        }
    }

    if ($Fixture.schemaVersion -ne '1.0.0') { Add-Failure "$RelativePath schemaVersion must be 1.0.0." }
    if ($Fixture.source -ne 'dashboard-adapter-projection') { Add-Failure "$RelativePath source must be dashboard-adapter-projection." }
    if ($Fixture.runtimeTruth.owner -ne 'runtime') { Add-Failure "$RelativePath runtimeTruth owner must be runtime." }
    if ($Fixture.runtimeTruth.authoritative -ne $true) { Add-Failure "$RelativePath runtimeTruth must remain authoritative." }
    if (@($Fixture.runtimeTruth.sourcePaths).Count -lt 1) { Add-Failure "$RelativePath must include runtimeTruth source paths." }
    if ($Fixture.producer.owner -ne 'apps/studio-dashboard/dashboard-adapter.ps1') { Add-Failure "$RelativePath producer owner must remain the dashboard adapter." }
    if ($Fixture.producer.onlyProducer -ne $true) { Add-Failure "$RelativePath producer must remain the only producer." }
    if ($Fixture.consumer.owner -ne 'apps/studio-dashboard') { Add-Failure "$RelativePath consumer owner must remain the studio dashboard." }
    if ($Fixture.consumer.passive -ne $true) { Add-Failure "$RelativePath dashboard consumer must remain passive." }
    if (@($Fixture.sources).Count -lt 1) { Add-Failure "$RelativePath must include source references." }
    if (@($Fixture.sections).Count -lt 1) { Add-Failure "$RelativePath must include display sections." }

    Assert-ReadOnlyBoundary -Boundary $Fixture.boundary -Label $RelativePath -FalseFlags @(
        'runtimeMutationAllowed',
        'dashboardWriteAllowed',
        'executionAllowed',
        'providerCallAllowed',
        'deploymentAllowed',
        'credentialAccessAllowed',
        'browserStorageAuthorityAllowed'
    )

    if ($Fixture.nonExecutableMetadata.phase -ne 'phase-13') { Add-Failure "$RelativePath must remain a Phase 13 projection contract instance." }
    if ($Fixture.nonExecutableMetadata.owner -ne 'studio-os') { Add-Failure "$RelativePath metadata owner must be studio-os." }
    if ($Fixture.nonExecutableMetadata.safetyClass -ne 'read-only-projection-contract') {
        Add-Failure "$RelativePath safetyClass must be read-only-projection-contract."
    }
}

Assert-PathExists -RelativePath 'shared/contracts/projections/fixtures' -ExpectedType Container | Out-Null
Assert-PathExists -RelativePath 'shared/contracts/projections/validation-reports' -ExpectedType Container | Out-Null
Assert-PathExists -RelativePath 'shared/contracts/projections/fixtures/projection-fixtures.manifest.json' -ExpectedType Leaf | Out-Null

$manifest = Read-StudioJson -RelativePath 'shared/contracts/projections/fixtures/projection-fixtures.manifest.json'

if ($manifest.schemaVersion -ne '1.0.0') { Add-Failure 'Projection fixture manifest schemaVersion must be 1.0.0.' }
if ($manifest.phase -ne 'phase-14') { Add-Failure 'Projection fixture manifest phase must be phase-14.' }
if (@($manifest.fixtures).Count -lt 2) { Add-Failure 'Projection fixture manifest must include fresh and stale coverage.' }
Assert-ReadOnlyBoundary -Boundary $manifest.boundary -Label 'Projection fixture manifest'

$rawFixtureText = ''
$scanRoots = @(
    'shared/contracts/projections/fixtures',
    'shared/contracts/projections/validation-reports'
)
foreach ($scanRoot in $scanRoots) {
    $scanPath = Join-Path $root $scanRoot
    if (Test-Path -LiteralPath $scanPath -PathType Container) {
        $rawFixtureText += (Get-ChildItem -LiteralPath $scanPath -Filter '*.json' -File -Recurse | ForEach-Object {
            Get-Content -LiteralPath $_.FullName -Raw
        }) -join [Environment]::NewLine
    }
}

$forbiddenPatterns = @(
    '"(command|commands|commandText|networkEndpoint|providerInvocation|deploymentPayload|approvalWritePayload|runtimeMutationPayload)"\s*:',
    '"(queueConfiguration|workerConfiguration|schedulerConfiguration|executorConfiguration|agentConfiguration)"\s*:',
    'Invoke-RestMethod|Invoke-WebRequest|Start-Job|Register-ScheduledTask|Start-Process|gh\s+api|vercel\s+deploy|netlify\s+deploy|firebase\s+deploy',
    'openai\.com|api\.anthropic\.com',
    'localStorage|sessionStorage',
    '"(apiKey|accessToken|refreshToken|clientSecret|password|credentialValue)"\s*:'
)

foreach ($pattern in $forbiddenPatterns) {
    if ($rawFixtureText -match $pattern) {
        Add-Failure "Projection fixtures contain forbidden capability pattern: $pattern"
    }
}

$freshCount = 0
$staleCount = 0

foreach ($entry in $manifest.fixtures) {
    foreach ($field in @('fixtureId', 'projectionPath', 'contractPath', 'sourceEvidenceObservedAt', 'expectedStaleness', 'validationReportPath')) {
        if ($null -eq $entry.PSObject.Properties[$field]) {
            Add-Failure "Projection fixture manifest entry missing $field."
        }
    }

    Assert-PathExists -RelativePath $entry.projectionPath -ExpectedType Leaf | Out-Null
    Assert-PathExists -RelativePath $entry.contractPath -ExpectedType Leaf | Out-Null
    Assert-PathExists -RelativePath $entry.validationReportPath -ExpectedType Leaf | Out-Null

    $fixture = Read-StudioJson -RelativePath $entry.projectionPath
    Test-DashboardProjectionFixture -Fixture $fixture -RelativePath $entry.projectionPath

    if ($fixture.projectionId -ne $entry.fixtureId) {
        Add-Failure "$($entry.projectionPath) projectionId must match manifest fixtureId."
    }

    $generatedAt = [datetimeoffset]::Parse($fixture.generatedAt)
    $sourceObservedAt = [datetimeoffset]::Parse($entry.sourceEvidenceObservedAt)
    $actualStaleness = if ($generatedAt -lt $sourceObservedAt) { 'stale' } else { 'fresh' }
    if ($actualStaleness -eq 'fresh') { $freshCount++ }
    if ($actualStaleness -eq 'stale') { $staleCount++ }

    if ($actualStaleness -ne $entry.expectedStaleness) {
        Add-Failure "$($entry.projectionPath) staleness expected $($entry.expectedStaleness) but evaluated $actualStaleness."
    }

    $report = Read-StudioJson -RelativePath $entry.validationReportPath
    if ($report.schemaVersion -ne '1.0.0') { Add-Failure "$($entry.validationReportPath) schemaVersion must be 1.0.0." }
    if ($report.phase -ne 'phase-14') { Add-Failure "$($entry.validationReportPath) phase must be phase-14." }
    if ($report.fixtureId -ne $entry.fixtureId) { Add-Failure "$($entry.validationReportPath) fixtureId must match manifest." }
    if ($report.projectionPath -ne $entry.projectionPath) { Add-Failure "$($entry.validationReportPath) projectionPath must match manifest." }
    if ($report.contractPath -ne $entry.contractPath) { Add-Failure "$($entry.validationReportPath) contractPath must match manifest." }
    if ($report.evaluatedStaleness -ne $actualStaleness) { Add-Failure "$($entry.validationReportPath) evaluatedStaleness must match deterministic evaluation." }
    if ($report.result -ne 'passed') { Add-Failure "$($entry.validationReportPath) result must be passed." }
    if (@($report.checks).Count -lt 2) { Add-Failure "$($entry.validationReportPath) must include schema and staleness checks." }
    Assert-ReadOnlyBoundary -Boundary $report.boundary -Label $entry.validationReportPath
    if ($report.nonExecutableMetadata.phase -ne 'phase-14') { Add-Failure "$($entry.validationReportPath) metadata phase must be phase-14." }
    if ($report.nonExecutableMetadata.safetyClass -ne 'read-only-projection-validation-report') {
        Add-Failure "$($entry.validationReportPath) safetyClass must be read-only-projection-validation-report."
    }
}

if ($freshCount -lt 1) { Add-Failure 'Projection fixture validation requires at least one fresh fixture.' }
if ($staleCount -lt 1) { Add-Failure 'Projection fixture validation requires at least one stale fixture.' }

if ($failures.Count -gt 0) {
    Write-Host 'Phase 14 projection fixture validation failed.' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'Phase 14 projection fixtures passed deterministic read-only validation and stale detection.' -ForegroundColor Green
exit 0
