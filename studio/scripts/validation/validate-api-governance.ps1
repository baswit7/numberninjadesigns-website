[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]
$requiredApis = @(
    'openai',
    'github',
    'notion',
    'vercel',
    'etsy',
    'printify',
    'meta',
    'instagram',
    'tiktok',
    'pinterest',
    'reddit',
    'google-analytics',
    'google-search-console',
    'elevenlabs',
    'exa',
    'postman'
)
$requiredRegistryFields = @('name', 'provider', 'projectsUsing', 'requiredEnvVars', 'requiredScopes', 'requiredPermissions', 'status', 'lastValidation', 'criticality', 'owner')
$requiredFiles = @(
    'shared/contracts/api-governance/api-registry.json',
    'shared/contracts/api-governance/api-readiness-contract.json',
    'shared/contracts/api-governance/api-scope-contract.json',
    'shared/contracts/api-governance/api-permission-contract.json',
    'runtime/api-governance/api-registry.report.json',
    'runtime/api-governance/api-readiness.report.json',
    'runtime/api-governance/api-scope-validation.report.json',
    'runtime/api-governance/api-permission-validation.report.json',
    'runtime/api-governance/api-dependency-map.report.json',
    'runtime/dashboard/api-governance.view.json'
)
$envVarPattern = '^[A-Z][A-Z0-9_]*$'
$secretPatterns = @(
    'sk-[A-Za-z0-9_\-]{20,}',
    'ghp_[A-Za-z0-9_]{20,}',
    'github_pat_[A-Za-z0-9_]{20,}',
    '-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----',
    '(?i)bearer\s+[A-Za-z0-9._\-]{20,}'
)
$forbiddenPatterns = @(
    ('Invoke-' + 'RestMethod'),
    ('Invoke-' + 'WebRequest'),
    ('Start-' + 'Job'),
    ('Register-' + 'ScheduledTask'),
    ('Start-' + 'Process'),
    'gh\s+api',
    'vercel\s+deploy',
    'docker\s+',
    'npm\s+'
)

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message) | Out-Null
}

function Read-Json {
    param([Parameter(Mandatory)][string]$RelativePath)

    $path = Join-Path $root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Required API governance file missing: $RelativePath"
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

function Test-Fields {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string[]]$Fields,
        [Parameter(Mandatory)][string]$Context
    )

    foreach ($field in $Fields) {
        $property = $Value.PSObject.Properties[$field]
        if ($null -eq $property -or $null -eq $property.Value) {
            Add-Failure "$Context misses required field '$field'."
        }
    }
}

function Get-MissingValues {
    param(
        [Parameter(Mandatory)]$Required,
        [Parameter(Mandatory)]$Granted
    )

    $grantedValues = @($Granted)
    return @(@($Required) | Where-Object { $grantedValues -notcontains $_ })
}

function Get-NonEmptyCount {
    param($Values)

    return @(@($Values) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }).Count
}

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        Add-Failure "Required API governance artifact missing: $relativePath"
    }
}

$registry = Read-Json 'shared/contracts/api-governance/api-registry.json'
$readinessContract = Read-Json 'shared/contracts/api-governance/api-readiness-contract.json'
$scopeContract = Read-Json 'shared/contracts/api-governance/api-scope-contract.json'
$permissionContract = Read-Json 'shared/contracts/api-governance/api-permission-contract.json'
$registryReport = Read-Json 'runtime/api-governance/api-registry.report.json'
$readinessReport = Read-Json 'runtime/api-governance/api-readiness.report.json'
$scopeReport = Read-Json 'runtime/api-governance/api-scope-validation.report.json'
$permissionReport = Read-Json 'runtime/api-governance/api-permission-validation.report.json'
$dependencyReport = Read-Json 'runtime/api-governance/api-dependency-map.report.json'
$dashboardView = Read-Json 'runtime/dashboard/api-governance.view.json'

if ($null -ne $registry) {
    Test-Fields -Value $registry -Fields @('schemaVersion', 'contractId', 'sourceOfTruth', 'projection', 'allowedStatuses', 'requiredFields', 'apis', 'boundaries') -Context 'API governance registry'

    $apis = @($registry.apis)
    $allowedStatuses = @($registry.allowedStatuses)
    $duplicateIds = @($apis | Group-Object id | Where-Object { $_.Count -gt 1 })
    $duplicateNames = @($apis | Group-Object name | Where-Object { $_.Count -gt 1 })
    foreach ($duplicate in $duplicateIds) { Add-Failure "Duplicate API id found: $($duplicate.Name)" }
    foreach ($duplicate in $duplicateNames) { Add-Failure "Duplicate API name found: $($duplicate.Name)" }

    foreach ($apiId in $requiredApis) {
        if (-not (@($apis.id) -contains $apiId)) {
            Add-Failure "Required API missing from governance registry: $apiId"
        }
    }

    foreach ($api in $apis) {
        Test-Fields -Value $api -Fields $requiredRegistryFields -Context "API '$($api.id)'"
        if ($allowedStatuses -notcontains $api.status) {
            Add-Failure "API '$($api.id)' has unsupported status '$($api.status)'."
        }
        foreach ($envVar in @($api.requiredEnvVars)) {
            if ([string]$envVar -notmatch $envVarPattern) {
                Add-Failure "API '$($api.id)' has invalid env var name '$envVar'."
            }
        }
    }

    $expectedBoundaries = [ordered]@{
        readOnly = $true
        contractFirst = $true
        validatorFirst = $true
        storesSecrets = $false
        exposesTokens = $false
        readsSecretValues = $false
        performsApiCalls = $false
        callsProviders = $false
        executesDeployments = $false
        dashboardWritesAllowed = $false
    }
    foreach ($key in $expectedBoundaries.Keys) {
        $property = $registry.boundaries.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $expectedBoundaries[$key]) {
            Add-Failure "API governance boundary '$key' must be $($expectedBoundaries[$key])."
        }
    }
}

foreach ($contractPair in @(
    @{ Name = 'readiness contract'; Value = $readinessContract },
    @{ Name = 'scope contract'; Value = $scopeContract },
    @{ Name = 'permission contract'; Value = $permissionContract }
)) {
    if ($null -ne $contractPair.Value) {
        Test-Fields -Value $contractPair.Value -Fields @('schemaVersion', 'contractId', 'sourceRegistry', 'runtimeReport', 'requiredFields', 'boundaries') -Context $contractPair.Name
        if ($contractPair.Value.boundaries.providerExecutionAllowed -ne $false) {
            Add-Failure "$($contractPair.Name) must disallow provider execution."
        }
    }
}

if ($null -ne $registry -and $null -ne $registryReport) {
    if ($registryReport.totalApis -ne @($registry.apis).Count) {
        Add-Failure 'API registry report totalApis does not match registry API count.'
    }
    foreach ($api in @($registry.apis)) {
        if (-not (@($registryReport.apis.id) -contains $api.id)) {
            Add-Failure "API registry report misses API '$($api.id)'."
        }
    }
}

if ($null -ne $registry -and $null -ne $scopeReport) {
    foreach ($api in @($registry.apis)) {
        $entry = @($scopeReport.apis) | Where-Object { $_.apiId -eq $api.id } | Select-Object -First 1
        if ($null -eq $entry) {
            Add-Failure "Scope validation report misses API '$($api.id)'."
            continue
        }
        $expectedMissing = Get-MissingValues -Required $api.requiredScopes -Granted $api.grantedScopes
        $actualMissing = @($entry.missingScopes)
        if (($expectedMissing -join '|') -ne ($actualMissing -join '|')) {
            Add-Failure "Scope validation mismatch for API '$($api.id)'."
        }
    }
}

if ($null -ne $registry -and $null -ne $permissionReport) {
    foreach ($api in @($registry.apis)) {
        $entry = @($permissionReport.apis) | Where-Object { $_.apiId -eq $api.id } | Select-Object -First 1
        if ($null -eq $entry) {
            Add-Failure "Permission validation report misses API '$($api.id)'."
            continue
        }
        $expectedMissing = Get-MissingValues -Required $api.requiredPermissions -Granted $api.grantedPermissions
        $actualMissing = @($entry.missingPermissions)
        if (($expectedMissing -join '|') -ne ($actualMissing -join '|')) {
            Add-Failure "Permission validation mismatch for API '$($api.id)'."
        }
    }
}

if ($null -ne $readinessReport -and $null -ne $scopeReport -and $null -ne $permissionReport) {
    if ($readinessReport.summary.totalApis -ne @($readinessReport.apis).Count) {
        Add-Failure 'Readiness report totalApis does not match readiness API count.'
    }
    if ($readinessReport.summary.missingScopes -ne @($scopeReport.apis | Where-Object { (Get-NonEmptyCount $_.missingScopes) -gt 0 }).Count) {
        Add-Failure 'Readiness report missingScopes count does not match scope validation report.'
    }
    if ($readinessReport.summary.missingPermissions -ne @($permissionReport.apis | Where-Object { (Get-NonEmptyCount $_.missingPermissions) -gt 0 }).Count) {
        Add-Failure 'Readiness report missingPermissions count does not match permission validation report.'
    }
}

if ($null -ne $dependencyReport -and $null -ne $registry) {
    $knownApiIds = @($registry.apis.id)
    foreach ($dependency in @($dependencyReport.dependencies)) {
        foreach ($apiId in @($dependency.apis)) {
            if ($knownApiIds -notcontains $apiId) {
                Add-Failure "Dependency map references unknown API '$apiId' for project '$($dependency.project)'."
            }
        }
    }
}

if ($null -ne $dashboardView -and $null -ne $readinessReport) {
    Test-Fields -Value $dashboardView -Fields @('schemaVersion', 'generatedAt', 'source', 'sourceFile', 'status', 'severity', 'readOnly', 'summary', 'metrics', 'topCriticalFailures', 'dependencyMap', 'cards', 'warnings', 'errors', 'nextRecommendedAction', 'boundaries') -Context 'API governance dashboard projection'
    if ($dashboardView.readOnly -ne $true) {
        Add-Failure 'API governance dashboard projection must set readOnly=true.'
    }
    if (@($dashboardView.cards).Count -ne $readinessReport.summary.totalApis) {
        Add-Failure 'API governance dashboard projection card count does not match readiness totalApis.'
    }
    if ($dashboardView.metrics.readinessPercentage -ne $readinessReport.summary.readinessPercentage) {
        Add-Failure 'API governance dashboard projection readinessPercentage does not match readiness report.'
    }
    if ($dashboardView.boundaries.dashboardWritesAllowed -ne $false) {
        Add-Failure 'API governance dashboard projection must disallow dashboard writes.'
    }
}

foreach ($relativePath in $requiredFiles + @('scripts/validation/validate-api-governance.ps1')) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }
    $content = Get-Content -LiteralPath $path -Raw
    foreach ($pattern in $secretPatterns) {
        if ($content -match $pattern) {
            Add-Failure "Possible secret or credential found in API governance artifact: $relativePath"
        }
    }
    foreach ($pattern in $forbiddenPatterns) {
        if ($content -match $pattern) {
            Add-Failure "Forbidden execution/provider/deployment capability found in API governance artifact: $relativePath pattern=$pattern"
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "API governance validation failed with $($failures.Count) failure(s)."
}

Write-Host "API governance validation passed. Checked $(@($registry.apis).Count) APIs." -ForegroundColor Green
