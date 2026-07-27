[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$registryPath = 'config/api-center.config.json'
$outputPath = 'runtime/dashboard/api-center.view.json'
$registry = Read-StudioJson -RelativePath $registryPath
$generatedAt = Get-StudioTimestamp

function ConvertTo-ApiCenterStatus {
    param([Parameter(Mandatory)][string]$Health)

    switch ($Health.ToLowerInvariant()) {
        'configured' { return 'ok' }
        'available' { return 'ok' }
        'not-configured' { return 'not-configured' }
        'planned' { return 'warning' }
        'blocked' { return 'error' }
        default { return 'unknown' }
    }
}

function ConvertTo-ApiCenterSeverity {
    param([Parameter(Mandatory)][string]$Status)

    switch ($Status) {
        'ok' { return 'success' }
        'warning' { return 'warning' }
        'error' { return 'error' }
        'not-configured' { return 'info' }
        default { return 'info' }
    }
}

function Get-ApiCenterSummaryStatus {
    param([Parameter(Mandatory)]$Cards)

    $items = @($Cards)
    if (@($items | Where-Object { $_.status -eq 'error' }).Count -gt 0) {
        return 'error'
    }
    if ($items.Count -eq 0) {
        return 'unknown'
    }
    return 'ok'
}

$cards = @($registry.providers | ForEach-Object {
    $status = ConvertTo-ApiCenterStatus -Health $_.health
    $severity = ConvertTo-ApiCenterSeverity -Status $status
    $envVars = @($_.requiredEnvironmentVariables)
    $scopes = @($_.scopesRequired)
    $limitations = @($_.knownLimitations)
    $projects = @($_.usedByProjects)

    [ordered]@{
        id = "api.$($_.providerId)"
        title = $_.providerName
        status = $status
        severity = $severity
        description = "auth=$($_.authType); envVars=$($envVars.Count); projects=$($projects.Count); health=$($_.health)"
        sourceFile = $registryPath
        lastUpdated = $generatedAt
        actionHint = $_.nextAction
        details = [ordered]@{
            providerId = $_.providerId
            providerName = $_.providerName
            purpose = $_.purpose
            usedByProjects = $projects
            status = $_.status
            health = $_.health
            docsReference = $_.docsReference
            requiredEnvironmentVariables = $envVars
            authType = $_.authType
            scopesRequired = $scopes
            knownLimitations = $limitations
            nextAction = $_.nextAction
        }
    }
} | Sort-Object title)

$authTypes = @($cards | ForEach-Object { $_.details.authType } | Sort-Object -Unique)
$summary = [ordered]@{
    providerCount = @($cards).Count
    notConfiguredCount = @($cards | Where-Object { $_.status -eq 'not-configured' }).Count
    configuredCount = @($cards | Where-Object { $_.status -eq 'ok' }).Count
    totalEnvironmentVariableNameCount = (@($cards | ForEach-Object { @($_.details.requiredEnvironmentVariables).Count }) | Measure-Object -Sum).Sum
    authTypes = $authTypes
    usedByProjects = @($cards | ForEach-Object { $_.details.usedByProjects } | Sort-Object -Unique)
}

$view = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $generatedAt
    source = 'api-center:config/api-center.config.json'
    sourceFile = $registryPath
    status = Get-ApiCenterSummaryStatus -Cards $cards
    readOnly = $true
    summary = $summary
    cards = $cards
    warnings = @()
    errors = @()
    nextRecommendedAction = 'Use the API Center as a read-only catalog; add credentials or provider integrations only in explicitly scoped future work.'
    boundaries = [ordered]@{
        readOnlyCatalog = $true
        sourceOfTruth = 'config/api-center.config.json'
        storesSecrets = $false
        exposesTokens = $false
        readsSecretValues = $false
        validatesCredentials = $false
        performsApiCalls = $false
        callsProviders = $false
        executesDeployments = $false
        createsApprovals = $false
        createsAgents = $false
        createsWorkersQueuesOrSchedulers = $false
    }
}

Write-StudioJson -RelativePath $outputPath -Value $view
Write-Host "API Center view generated: $outputPath" -ForegroundColor Green
