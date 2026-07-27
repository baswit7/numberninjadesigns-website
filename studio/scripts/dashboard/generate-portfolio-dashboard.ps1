[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$registryPath = 'config/portfolio.projects.json'
$outputPath = 'runtime/dashboard/portfolio.view.json'
$registry = Read-StudioJson -RelativePath $registryPath
$generatedAt = Get-StudioTimestamp

function ConvertTo-PortfolioSeverity {
    param([Parameter(Mandatory)][string]$Health)

    switch ($Health.ToLowerInvariant()) {
        'green' { return 'success' }
        'yellow' { return 'warning' }
        'red' { return 'error' }
        default { return 'info' }
    }
}

function ConvertTo-PortfolioStatus {
    param([Parameter(Mandatory)][string]$Health)

    switch ($Health.ToLowerInvariant()) {
        'green' { return 'ok' }
        'yellow' { return 'warning' }
        'red' { return 'error' }
        default { return 'unknown' }
    }
}

function Get-PortfolioSummaryStatus {
    param([Parameter(Mandatory)]$Cards)

    $items = @($Cards)
    if (@($items | Where-Object { $_.status -eq 'error' }).Count -gt 0) {
        return 'error'
    }
    if (@($items | Where-Object { $_.status -eq 'warning' }).Count -gt 0) {
        return 'warning'
    }
    if ($items.Count -eq 0) {
        return 'unknown'
    }
    return 'ok'
}

$cards = @($registry.projects | ForEach-Object {
    $risks = @($_.openRisks)
    $riskCount = $risks.Count
    $status = ConvertTo-PortfolioStatus -Health $_.health
    $severity = ConvertTo-PortfolioSeverity -Health $_.health

    [ordered]@{
        id = "portfolio.$($_.projectId)"
        title = $_.projectName
        status = $status
        severity = $severity
        description = "type=$($_.projectType); priority=$($_.priority); health=$($_.health); risks=$riskCount"
        sourceFile = $registryPath
        lastUpdated = $_.lastActivity
        actionHint = $_.nextAction
        details = [ordered]@{
            projectId = $_.projectId
            projectName = $_.projectName
            projectType = $_.projectType
            status = $_.status
            priority = $_.priority
            health = $_.health
            lastActivity = $_.lastActivity
            nextAction = $_.nextAction
            repoReference = $_.repoReference
            activeBranch = $_.activeBranch
            openRisks = $risks
            openRiskCount = $riskCount
            readinessSummary = $_.readinessSummary
        }
    }
} | Sort-Object { $_.details.priority }, title)

$priorityOrder = @('P0', 'P1', 'P2', 'P3')
$prioritySummary = @()
foreach ($priority in $priorityOrder) {
    $prioritySummary += [ordered]@{
        priority = $priority
        count = @($cards | Where-Object { $_.details.priority -eq $priority }).Count
    }
}
$summary = [ordered]@{
    projectCount = @($cards).Count
    p0Count = @($cards | Where-Object { $_.details.priority -eq 'P0' }).Count
    p1Count = @($cards | Where-Object { $_.details.priority -eq 'P1' }).Count
    warningCount = @($cards | Where-Object { $_.status -eq 'warning' }).Count
    errorCount = @($cards | Where-Object { $_.status -eq 'error' }).Count
    totalOpenRiskCount = (@($cards | ForEach-Object { $_.details.openRiskCount }) | Measure-Object -Sum).Sum
    priorities = $prioritySummary
}

$view = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $generatedAt
    source = 'portfolio-dashboard:config/portfolio.projects.json'
    sourceFile = $registryPath
    status = Get-PortfolioSummaryStatus -Cards $cards
    readOnly = $true
    summary = $summary
    cards = $cards
    warnings = @()
    errors = @()
    nextRecommendedAction = 'Use the highest-priority next action from the portfolio view; update config/portfolio.projects.json when project metadata changes.'
    boundaries = [ordered]@{
        readOnlyDashboard = $true
        sourceOfTruth = 'config/portfolio.projects.json'
        storesSecrets = $false
        performsApiCalls = $false
        validatesCredentials = $false
        executesDeployments = $false
        createsApprovals = $false
        createsAgents = $false
        createsWorkersQueuesOrSchedulers = $false
    }
}

Write-StudioJson -RelativePath $outputPath -Value $view
Write-Host "Portfolio dashboard view generated: $outputPath" -ForegroundColor Green
