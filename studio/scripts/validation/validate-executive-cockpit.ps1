[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message) | Out-Null
}

$requiredReports = @(
    'runtime/executive-cockpit/executive-command.report.json',
    'runtime/executive-cockpit/today.report.json',
    'runtime/executive-cockpit/project-control.report.json',
    'runtime/executive-cockpit/opportunities.report.json',
    'runtime/executive-cockpit/bottlenecks.report.json',
    'runtime/executive-cockpit/scouts.report.json',
    'runtime/executive-cockpit/intelligence.report.json',
    'runtime/executive-cockpit/technical-center.report.json',
    'runtime/executive-cockpit/boundary-audit.report.json'
)

[void](Read-StudioJsonSafe -RelativePath 'shared/contracts/executive-cockpit/executive-cockpit.report.schema.json')
[void](Read-StudioJsonSafe -RelativePath 'shared/contracts/executive-cockpit/manifest.json')

foreach ($relativePath in $requiredReports) {
    $safe = Read-StudioJsonSafe -RelativePath $relativePath
    if (-not $safe.validJson) {
        Add-Failure "$relativePath missing or invalid JSON: $($safe.error)"
        continue
    }

    $report = $safe.value
    foreach ($field in @('schemaVersion', 'generatedAt', 'source', 'status', 'sectionId', 'cards', 'lineage', 'boundaries')) {
        if ($null -eq $report.PSObject.Properties[$field]) {
            Add-Failure "$relativePath misses required field $field."
        }
    }

    if (@($report.cards).Count -eq 0) {
        Add-Failure "$relativePath contains no cards."
    }

    foreach ($card in @($report.cards)) {
        foreach ($field in @('id', 'title', 'status', 'description', 'facts', 'lineage')) {
            if ($null -eq $card.PSObject.Properties[$field]) {
                Add-Failure "$relativePath card misses required field $field."
            }
        }
        if ($null -eq $card.PSObject.Properties['lineage'] -or
            [string]::IsNullOrWhiteSpace($card.lineage.sourceReport) -or
            [string]::IsNullOrWhiteSpace($card.lineage.sourceContract) -or
            [string]::IsNullOrWhiteSpace($card.lineage.sourceService)) {
            Add-Failure "$relativePath card $($card.id) has incomplete lineage."
        }
    }

    $boundary = $report.boundaries
    if ($boundary.readOnly -ne $true) { Add-Failure "$relativePath is not read-only." }
    foreach ($flag in @('executionEngine', 'providerExecution', 'publishingExecution', 'schedulerExecution', 'oauthCapability', 'credentialAccess', 'secretAccess', 'agentExecution', 'automaticDecisionMaking')) {
        if ($boundary.$flag -ne $false) {
            Add-Failure "$relativePath boundary flag $flag must be false."
        }
    }
}

$validationReport = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = Get-StudioTimestamp
    source = 'scripts/validation/validate-executive-cockpit.ps1'
    status = if ($failures.Count -eq 0) { 'ok' } else { 'failed' }
    checkedReports = $requiredReports
    mockupPercentage = if ($failures.Count -eq 0) { 0 } else { 100 }
    dynamicPercentage = if ($failures.Count -eq 0) { 100 } else { 0 }
    failures = @($failures)
}

Write-StudioJson -RelativePath 'runtime/executive-cockpit/executive-cockpit-validation.report.json' -Value $validationReport

if ($failures.Count -gt 0) {
    Write-Output ($validationReport | ConvertTo-Json -Depth 50)
    exit 1
}

Write-Output ($validationReport | ConvertTo-Json -Depth 50)
