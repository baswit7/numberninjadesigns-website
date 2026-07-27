[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]
$registryRelativePath = 'config/postman-registry.config.json'
$apiCenterRelativePath = 'config/api-center.config.json'
$generatorRelativePath = 'scripts/api/generate-postman-registry.ps1'
$viewRelativePath = 'runtime/dashboard/postman-registry.view.json'
$requiredProviders = @('OpenAI', 'GitHub', 'Telegram', 'Notion', 'Etsy', 'TikTok', 'Pinterest', 'Instagram', 'Facebook', 'Vercel')
$requiredCollectionFields = @('providerName', 'collectionName', 'collectionReference', 'purpose', 'linkedApiCenterProvider', 'authType', 'environmentVariablesUsed', 'requestExamples', 'responseExamples', 'knownRisks', 'nextAction')
$requiredViewFields = @('schemaVersion', 'generatedAt', 'source', 'sourceFile', 'status', 'readOnly', 'summary', 'cards', 'warnings', 'errors', 'nextRecommendedAction', 'boundaries')
$environmentVariableNamePattern = '^[A-Z][A-Z0-9_]*$'
$scanPaths = @(
    'config/postman-registry.config.json',
    'services/postman-registry',
    'scripts/api/generate-postman-registry.ps1',
    'scripts/validation/validate-postman-registry.ps1',
    'docs/integrations/POSTMAN_REGISTRY.md'
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
    }
}

function Test-SanitizedExample {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string]$Context
    )

    $json = $Value | ConvertTo-Json -Depth 50
    $forbiddenExamplePatterns = @(
        'Bearer\s+[A-Za-z0-9._~+/=-]+',
        'Basic\s+[A-Za-z0-9+/=]+',
        'Cookie\s*[:=]',
        'Set-Cookie\s*[:=]',
        'refresh[_-]?token\s*[:=]',
        'client[_-]?secret\s*[:=]',
        'session[_-]?id\s*[:=]',
        'password\s*[:=]',
        '-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----',
        '[A-Za-z0-9+/]{32,}={0,2}'
    )

    foreach ($pattern in $forbiddenExamplePatterns) {
        if ($json -match $pattern) {
            Add-Failure "$Context contains an unsanitized or secret-like value matching pattern '$pattern'."
        }
    }
}

$registry = Read-JsonForValidation -RelativePath $registryRelativePath
$apiCenter = Read-JsonForValidation -RelativePath $apiCenterRelativePath
$apiCenterProviderIds = @()
if ($null -ne $apiCenter) {
    $apiCenterProviderIds = @($apiCenter.providers | ForEach-Object { $_.providerId })
}

if ($null -ne $registry) {
    Test-RequiredFields -Value $registry -Fields @('schemaVersion', 'registryId', 'sourceOfTruth', 'apiCenterSource', 'generatedView', 'requiredFields', 'collections', 'boundaries') -Context 'Postman registry'

    foreach ($providerName in $requiredProviders) {
        $collection = @($registry.collections) | Where-Object { $_.providerName -eq $providerName } | Select-Object -First 1
        if ($null -eq $collection) {
            Add-Failure "Required Postman registry provider missing: $providerName"
            continue
        }

        Test-RequiredFields -Value $collection -Fields $requiredCollectionFields -Context "Postman registry collection '$providerName'"
        Test-EnvironmentVariableNames -Names $collection.environmentVariablesUsed -Context "Postman registry collection '$providerName'"
        if ($collection.linkedApiCenterProvider -notin $apiCenterProviderIds) {
            Add-Failure "Postman registry collection '$providerName' links to missing API Center provider '$($collection.linkedApiCenterProvider)'."
        }
        foreach ($request in @($collection.requestExamples)) {
            Test-SanitizedExample -Value $request -Context "Request example '$providerName/$($request.name)'"
        }
        foreach ($response in @($collection.responseExamples)) {
            Test-SanitizedExample -Value $response -Context "Response example '$providerName/$($response.name)'"
        }
    }

    $expectedBoundaries = [ordered]@{
        readOnlyRegistry = $true
        documentDriven = $true
        sanitizedExamplesOnly = $true
        storesSecrets = $false
        exposesTokens = $false
        readsSecretValues = $false
        validatesCredentials = $false
        performsApiCalls = $false
        callsProviders = $false
        executesCollections = $false
        executesDeployments = $false
        createsApprovals = $false
        createsAgents = $false
        createsWorkersQueuesOrSchedulers = $false
    }
    foreach ($key in $expectedBoundaries.Keys) {
        $property = $registry.boundaries.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $expectedBoundaries[$key]) {
            Add-Failure "Postman registry boundary '$key' must be $($expectedBoundaries[$key])."
        }
    }
}

$generatorPath = Join-Path $root $generatorRelativePath
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure "Postman registry generator missing: $generatorRelativePath"
}

if ($failures.Count -eq 0) {
    & $generatorPath | Out-Null
}

$view = Read-JsonForValidation -RelativePath $viewRelativePath
if ($null -ne $view) {
    Test-RequiredFields -Value $view -Fields $requiredViewFields -Context 'Postman registry dashboard view'
    if ($view.readOnly -ne $true) {
        Add-Failure 'Postman registry dashboard view must set readOnly=true.'
    }
    foreach ($providerName in $requiredProviders) {
        $card = @($view.cards) | Where-Object { $_.details.providerName -eq $providerName } | Select-Object -First 1
        if ($null -eq $card) {
            Add-Failure "Postman registry view misses required provider card: $providerName"
            continue
        }
        Test-RequiredFields -Value $card -Fields @('id', 'title', 'status', 'severity', 'description', 'sourceFile', 'lastUpdated', 'actionHint', 'details') -Context "Postman registry card '$providerName'"
        Test-RequiredFields -Value $card.details -Fields $requiredCollectionFields -Context "Postman registry card details '$providerName'"
        Test-EnvironmentVariableNames -Names $card.details.environmentVariablesUsed -Context "Postman registry card '$providerName'"
        foreach ($request in @($card.details.requestExamples)) {
            Test-SanitizedExample -Value $request -Context "View request example '$providerName/$($request.name)'"
        }
        foreach ($response in @($card.details.responseExamples)) {
            Test-SanitizedExample -Value $response -Context "View response example '$providerName/$($response.name)'"
        }
    }

    $expectedViewBoundaries = [ordered]@{
        readOnlyRegistry = $true
        sanitizedExamplesOnly = $true
        storesSecrets = $false
        exposesTokens = $false
        readsSecretValues = $false
        validatesCredentials = $false
        performsApiCalls = $false
        callsProviders = $false
        executesCollections = $false
        executesDeployments = $false
        createsApprovals = $false
        createsAgents = $false
        createsWorkersQueuesOrSchedulers = $false
    }
    foreach ($key in $expectedViewBoundaries.Keys) {
        $property = $view.boundaries.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $expectedViewBoundaries[$key]) {
            Add-Failure "Postman registry view boundary '$key' must be $($expectedViewBoundaries[$key])."
        }
    }
}

$secretPatterns = @(
    'api[_-]?key\s*[:=]\s*["''][^"'']+["'']',
    'token\s*[:=]\s*["''][^"'']+["'']',
    'secret\s*[:=]\s*["''][^"'']+["'']',
    'password\s*[:=]\s*["''][^"'']+["'']',
    'Bearer\s+[A-Za-z0-9._~+/=-]+',
    'Cookie\s*[:=]',
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
    ('new' + 'man'),
    ('postman\s+collection\s+' + 'run'),
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
                Add-Failure "Possible secret or credential found in Postman registry artifact: $($file.FullName)"
            }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Forbidden execution/provider/deployment capability found in Postman registry artifact: $($file.FullName) pattern=$pattern"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "Postman registry validation failed with $($failures.Count) failure(s)."
}

Write-Host "Studio OS V1 Postman Registry passed deterministic checks. Checked $(@($requiredProviders).Count) providers." -ForegroundColor Green
