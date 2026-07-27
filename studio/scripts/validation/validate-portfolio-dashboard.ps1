[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]
$registryRelativePath = 'config/portfolio.projects.json'
$generatorRelativePath = 'scripts/dashboard/generate-portfolio-dashboard.ps1'
$viewRelativePath = 'runtime/dashboard/portfolio.view.json'
$requiredProjects = @('Studio OS', 'NumberNinjaDesigns', 'NumberNinjaDesigns / TOK Hub', 'NumberNinjaDesigns / BoodschappenVergelijker')
$requiredProjectFields = @('projectId', 'projectName', 'projectType', 'status', 'priority', 'health', 'lastActivity', 'nextAction', 'repoReference', 'openRisks', 'readinessSummary')
$requiredViewFields = @('schemaVersion', 'generatedAt', 'source', 'sourceFile', 'status', 'readOnly', 'summary', 'cards', 'warnings', 'errors', 'nextRecommendedAction', 'boundaries')
$scanPaths = @(
    'config/portfolio.projects.json',
    'services/portfolio-dashboard',
    'scripts/dashboard/generate-portfolio-dashboard.ps1',
    'scripts/validation/validate-portfolio-dashboard.ps1',
    'docs/projects/PORTFOLIO_DASHBOARD.md'
)

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message) | Out-Null
}

function Read-JsonForValidation {
    param([Parameter(Mandatory)][string]$RelativePath)

    $path = Join-Path $root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Required JSON file missing: $RelativePath"
        return $null
    }

    try {
        return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    }
    catch {
        Add-Failure "Invalid JSON in $RelativePath. $($_.Exception.Message)"
        return $null
    }
}

function Test-RequiredFields {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string[]]$Fields,
        [Parameter(Mandatory)][string]$Context
    )

    foreach ($field in $Fields) {
        $property = $Value.PSObject.Properties[$field]
        if ($null -eq $property -or $null -eq $property.Value) {
            Add-Failure "$Context misses required field '$field'."
            continue
        }
        if ($property.Value -is [string] -and [string]::IsNullOrWhiteSpace($property.Value)) {
            Add-Failure "$Context misses required field '$field'."
        }
    }
}

$registry = Read-JsonForValidation -RelativePath $registryRelativePath

if ($null -ne $registry) {
    Test-RequiredFields -Value $registry -Fields @('schemaVersion', 'registryId', 'sourceOfTruth', 'generatedView', 'requiredFields', 'projects', 'boundaries') -Context 'Portfolio registry'

    foreach ($projectName in $requiredProjects) {
        $project = @($registry.projects) | Where-Object { $_.projectName -eq $projectName } | Select-Object -First 1
        if ($null -eq $project) {
            Add-Failure "Required portfolio project missing: $projectName"
            continue
        }
        Test-RequiredFields -Value $project -Fields $requiredProjectFields -Context "Portfolio project '$projectName'"
        if (@($project.openRisks).Count -eq 0) {
            Add-Failure "Portfolio project '$projectName' must define openRisks as an array, even when risk count is zero."
        }
    }

    $expectedBoundaries = [ordered]@{
        readOnlyRegistry = $true
        readOnlyDashboard = $true
        documentDriven = $true
        storesSecrets = $false
        performsApiCalls = $false
        validatesCredentials = $false
        executesDeployments = $false
        createsApprovals = $false
        createsAgents = $false
        createsWorkersQueuesOrSchedulers = $false
    }
    foreach ($key in $expectedBoundaries.Keys) {
        $property = $registry.boundaries.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $expectedBoundaries[$key]) {
            Add-Failure "Portfolio registry boundary '$key' must be $($expectedBoundaries[$key])."
        }
    }
}

$generatorPath = Join-Path $root $generatorRelativePath
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure "Portfolio dashboard generator missing: $generatorRelativePath"
}

if ($failures.Count -eq 0) {
    & $generatorPath | Out-Null
}

$view = Read-JsonForValidation -RelativePath $viewRelativePath
if ($null -ne $view) {
    Test-RequiredFields -Value $view -Fields $requiredViewFields -Context 'Portfolio dashboard view'
    if ($view.readOnly -ne $true) {
        Add-Failure 'Portfolio dashboard view must set readOnly=true.'
    }
    foreach ($projectName in $requiredProjects) {
        $card = @($view.cards) | Where-Object { $_.details.projectName -eq $projectName } | Select-Object -First 1
        if ($null -eq $card) {
            Add-Failure "Portfolio dashboard view misses required project card: $projectName"
            continue
        }
        Test-RequiredFields -Value $card -Fields @('id', 'title', 'status', 'severity', 'description', 'sourceFile', 'lastUpdated', 'actionHint', 'details') -Context "Portfolio dashboard card '$projectName'"
        Test-RequiredFields -Value $card.details -Fields $requiredProjectFields -Context "Portfolio dashboard card details '$projectName'"
    }

    $expectedViewBoundaries = [ordered]@{
        readOnlyDashboard = $true
        storesSecrets = $false
        performsApiCalls = $false
        validatesCredentials = $false
        executesDeployments = $false
        createsApprovals = $false
        createsAgents = $false
        createsWorkersQueuesOrSchedulers = $false
    }
    foreach ($key in $expectedViewBoundaries.Keys) {
        $property = $view.boundaries.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $expectedViewBoundaries[$key]) {
            Add-Failure "Portfolio dashboard view boundary '$key' must be $($expectedViewBoundaries[$key])."
        }
    }
}

$secretPatterns = @(
    'api[_-]?key\s*[:=]\s*["''][^"'']+["'']',
    'token\s*[:=]\s*["''][^"'']+["'']',
    'secret\s*[:=]\s*["''][^"'']+["'']',
    'password\s*[:=]\s*["''][^"'']+["'']',
    '-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----'
)
$forbiddenCapabilityPatterns = @(
    ('Invoke-' + 'RestMethod'),
    ('Invoke-' + 'WebRequest'),
    ('Start-' + 'Job'),
    ('Register-' + 'ScheduledTask'),
    ('New-' + 'Service'),
    ('Start-' + 'Service'),
    'gh\s+api',
    'npm\s+',
    'docker\s+',
    'vercel\s+deploy',
    'netlify\s+deploy',
    'firebase\s+deploy'
)

foreach ($relativePath in $scanPaths) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path)) {
        continue
    }

    $files = if (Test-Path -LiteralPath $path -PathType Container) {
        Get-ChildItem -LiteralPath $path -File -Recurse
    }
    else {
        Get-Item -LiteralPath $path
    }

    foreach ($file in $files) {
        $content = Get-Content -LiteralPath $file.FullName -Raw
        foreach ($pattern in $secretPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Possible secret or credential found in portfolio dashboard artifact: $($file.FullName)"
            }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Forbidden execution/provider/deployment capability found in portfolio dashboard artifact: $($file.FullName) pattern=$pattern"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "Portfolio dashboard validation failed with $($failures.Count) failure(s)."
}

Write-Host "Studio OS V1 portfolio dashboard passed deterministic checks. Checked $(@($requiredProjects).Count) projects." -ForegroundColor Green
