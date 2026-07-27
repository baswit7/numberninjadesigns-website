[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]
$registryRelativePath = 'config/api-center.config.json'
$generatorRelativePath = 'scripts/api/generate-api-center.ps1'
$viewRelativePath = 'runtime/dashboard/api-center.view.json'
$requiredProviders = @('OpenAI', 'GitHub', 'Telegram', 'Notion', 'Etsy', 'TikTok', 'Pinterest', 'Instagram', 'Facebook', 'Vercel')
$requiredProviderFields = @('providerName', 'purpose', 'usedByProjects', 'status', 'health', 'docsReference', 'requiredEnvironmentVariables', 'authType', 'scopesRequired', 'knownLimitations', 'nextAction')
$requiredViewFields = @('schemaVersion', 'generatedAt', 'source', 'sourceFile', 'status', 'readOnly', 'summary', 'cards', 'warnings', 'errors', 'nextRecommendedAction', 'boundaries')
$environmentVariableNamePattern = '^[A-Z][A-Z0-9_]*$'
$scanPaths = @(
    'config/api-center.config.json',
    'services/api-center',
    'scripts/api/generate-api-center.ps1',
    'scripts/validation/validate-api-center.ps1',
    'docs/integrations/API_CENTER.md'
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

function Test-EnvironmentVariableNames {
    param(
        [Parameter(Mandatory)]$Names,
        [Parameter(Mandatory)][string]$Context
    )

    foreach ($name in @($Names)) {
        if ([string]::IsNullOrWhiteSpace([string]$name)) {
            Add-Failure "$Context contains an empty environment variable name."
            continue
        }
        if ([string]$name -notmatch $environmentVariableNamePattern) {
            Add-Failure "$Context contains a value that is not an environment variable name: $name"
        }
        if ([string]$name -match '^[A-Za-z0-9+/]{20,}={0,2}$') {
            Add-Failure "$Context contains a token-shaped value instead of an environment variable name."
        }
    }
}

$registry = Read-JsonForValidation -RelativePath $registryRelativePath

if ($null -ne $registry) {
    Test-RequiredFields -Value $registry -Fields @('schemaVersion', 'registryId', 'sourceOfTruth', 'generatedView', 'requiredFields', 'providers', 'boundaries') -Context 'API Center registry'

    foreach ($providerName in $requiredProviders) {
        $provider = @($registry.providers) | Where-Object { $_.providerName -eq $providerName } | Select-Object -First 1
        if ($null -eq $provider) {
            Add-Failure "Required API provider missing: $providerName"
            continue
        }
        Test-RequiredFields -Value $provider -Fields $requiredProviderFields -Context "API provider '$providerName'"
        Test-EnvironmentVariableNames -Names $provider.requiredEnvironmentVariables -Context "API provider '$providerName'"
    }

    $expectedBoundaries = [ordered]@{
        readOnlyCatalog = $true
        documentDriven = $true
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
    foreach ($key in $expectedBoundaries.Keys) {
        $property = $registry.boundaries.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $expectedBoundaries[$key]) {
            Add-Failure "API Center registry boundary '$key' must be $($expectedBoundaries[$key])."
        }
    }
}

$generatorPath = Join-Path $root $generatorRelativePath
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure "API Center generator missing: $generatorRelativePath"
}

if ($failures.Count -eq 0) {
    & $generatorPath | Out-Null
}

$view = Read-JsonForValidation -RelativePath $viewRelativePath
if ($null -ne $view) {
    Test-RequiredFields -Value $view -Fields $requiredViewFields -Context 'API Center dashboard view'
    if ($view.readOnly -ne $true) {
        Add-Failure 'API Center dashboard view must set readOnly=true.'
    }
    foreach ($providerName in $requiredProviders) {
        $card = @($view.cards) | Where-Object { $_.details.providerName -eq $providerName } | Select-Object -First 1
        if ($null -eq $card) {
            Add-Failure "API Center view misses required provider card: $providerName"
            continue
        }
        Test-RequiredFields -Value $card -Fields @('id', 'title', 'status', 'severity', 'description', 'sourceFile', 'lastUpdated', 'actionHint', 'details') -Context "API Center card '$providerName'"
        Test-RequiredFields -Value $card.details -Fields $requiredProviderFields -Context "API Center card details '$providerName'"
        Test-EnvironmentVariableNames -Names $card.details.requiredEnvironmentVariables -Context "API Center card '$providerName'"
    }

    $expectedViewBoundaries = [ordered]@{
        readOnlyCatalog = $true
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
    foreach ($key in $expectedViewBoundaries.Keys) {
        $property = $view.boundaries.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $expectedViewBoundaries[$key]) {
            Add-Failure "API Center view boundary '$key' must be $($expectedViewBoundaries[$key])."
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
                Add-Failure "Possible secret or credential found in API Center artifact: $($file.FullName)"
            }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Forbidden execution/provider/deployment capability found in API Center artifact: $($file.FullName) pattern=$pattern"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "API Center validation failed with $($failures.Count) failure(s)."
}

Write-Host "Studio OS V1 API Center passed deterministic checks. Checked $(@($requiredProviders).Count) providers." -ForegroundColor Green
