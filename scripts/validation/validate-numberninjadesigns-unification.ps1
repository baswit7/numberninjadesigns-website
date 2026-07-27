[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message) | Out-Null
}

function Test-RequiredPath {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [ValidateSet('Any', 'File', 'Directory')][string]$Type = 'Any'
    )

    $path = Join-Path $repositoryRoot $RelativePath
    $exists = switch ($Type) {
        'File' { Test-Path -LiteralPath $path -PathType Leaf }
        'Directory' { Test-Path -LiteralPath $path -PathType Container }
        default { Test-Path -LiteralPath $path }
    }
    if (-not $exists) {
        Add-Failure "Required $($Type.ToLowerInvariant()) is missing: $RelativePath"
    }
}

function Test-JsonFile {
    param([Parameter(Mandatory)][string]$RelativePath)

    $path = Join-Path $repositoryRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Required JSON file is missing: $RelativePath"
        return $null
    }
    try {
        return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    }
    catch {
        Add-Failure "Invalid JSON: $RelativePath"
        return $null
    }
}

$requiredDirectories = @(
    'products/digital',
    'products/physical',
    'studio',
    'studio/projects/NumberNinjaDesigns',
    'studio/projects/NumberNinjaDesigns/initiatives',
    'studio/services/meta-social',
    'modules/etsy-intelligence-engine',
    'modules/listing-intelligence-engine',
    'services/etsy-open-api'
)
foreach ($relativePath in $requiredDirectories) {
    Test-RequiredPath -RelativePath $relativePath -Type Directory
}

$requiredFiles = @(
    '.env',
    '.env.example',
    'config/project.identity.json',
    'config/portfolio.registry.json',
    'config/channels.registry.json',
    'config/integration.sources.json',
    'MASTER_ARCHITECTURE.md',
    'IDEAS.md',
    'ROADMAP.md',
    'docs/consolidation/UNIFIED_ARCHITECTURE.md',
    'docs/consolidation/SOURCE_AUDIT_2026-07-27.md',
    'docs/consolidation/LEGACY_RETIREMENT_PLAN.md',
    'docs/consolidation/MEDIA_AND_CHANNELS.md'
)
foreach ($relativePath in $requiredFiles) {
    Test-RequiredPath -RelativePath $relativePath -Type File
}

foreach ($legacyPath in @(
    'studio/projects/TOKHub',
    'studio/projects/BoodschappenVergelijker',
    'studio/projects/AIDaytraden',
    'studio/projects/NiveauVerhogenPaul',
    'studio/projects/LeersystemenVerkoop',
    'studio/.env',
    'studio/.env.example'
)) {
    if (Test-Path -LiteralPath (Join-Path $repositoryRoot $legacyPath)) {
        Add-Failure "Legacy duplicate path must not exist: $legacyPath"
    }
}

$identity = Test-JsonFile -RelativePath 'config/project.identity.json'
$portfolio = Test-JsonFile -RelativePath 'config/portfolio.registry.json'
$channels = Test-JsonFile -RelativePath 'config/channels.registry.json'
$null = Test-JsonFile -RelativePath 'config/integration.sources.json'
$null = Test-JsonFile -RelativePath 'studio/config/projects.config.json'
$null = Test-JsonFile -RelativePath 'studio/config/providers.config.json'
$null = Test-JsonFile -RelativePath 'studio/config/api-center.config.json'
$null = Test-JsonFile -RelativePath 'studio/shared/contracts/api-governance/api-registry.json'

if ($null -ne $identity) {
    if ($identity.projectId -ne 'numberninjadesigns' -or $identity.brand -ne 'NumberNinjaDesigns') {
        Add-Failure 'Project identity must resolve to NumberNinjaDesigns.'
    }
    if ($identity.environment.source -ne '.env' -or $identity.environment.browserAccess -ne $false) {
        Add-Failure 'Project identity must enforce the server-only root .env boundary.'
    }
}

if ($null -ne $portfolio) {
    if ($portfolio.brand.name -ne 'NumberNinjaDesigns' -or $portfolio.boundaries.singleMasterBrand -ne $true) {
        Add-Failure 'Portfolio registry must enforce NumberNinjaDesigns as the single master brand.'
    }
    $initiativeIds = @($portfolio.domains | Where-Object { $_.id -eq 'initiatives' } | ForEach-Object { $_.items.id })
    foreach ($requiredInitiative in @('tok-hub', 'boodschappenvergelijker', 'ai-daytraden', 'niveau-verhogen-paul', 'leersystemen-verkoop')) {
        if ($requiredInitiative -notin $initiativeIds) {
            Add-Failure "Portfolio registry misses initiative: $requiredInitiative"
        }
    }
}

if ($null -ne $channels) {
    $channelIds = @($channels.channels.id)
    foreach ($requiredChannel in @('facebook', 'instagram', 'x-twitter', 'pinterest', 'blog', 'tiktok')) {
        if ($requiredChannel -notin $channelIds) {
            Add-Failure "Channel registry misses channel: $requiredChannel"
        }
    }
    if ($channels.publicationBoundary.automaticPublishingEnabled -ne $false) {
        Add-Failure 'Channel registry must keep automatic publishing disabled.'
    }
}

$envExamplePath = Join-Path $repositoryRoot '.env.example'
if (Test-Path -LiteralPath $envExamplePath -PathType Leaf) {
    $envNames = New-Object System.Collections.Generic.List[string]
    foreach ($rawLine in Get-Content -LiteralPath $envExamplePath) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
            continue
        }
        if ($line -notmatch '^([A-Z][A-Z0-9_]*)=$') {
            Add-Failure '.env.example must contain empty values only.'
            continue
        }
        $envNames.Add($Matches[1]) | Out-Null
    }
    foreach ($requiredName in @(
        'META_GRAPH_API_VERSION',
        'META_FACEBOOK_PAGE_ID',
        'META_FACEBOOK_PAGE_ACCESS_TOKEN',
        'INSTAGRAM_BUSINESS_ACCOUNT_ID',
        'ETSY_CLIENT_ID',
        'ETSY_CLIENT_SECRET',
        'PRINTIFY_API_KEY',
        'PRINTIFY_SHOP_ID'
    )) {
        if ($requiredName -notin $envNames) {
            Add-Failure ".env.example misses required variable name: $requiredName"
        }
    }
}

& git -C $repositoryRoot check-ignore -q -- .env
if ($LASTEXITCODE -ne 0) {
    Add-Failure '.env is not ignored by Git.'
}

$trackedEnv = @(& git -C $repositoryRoot ls-files -- .env)
if ($trackedEnv.Count -gt 0) {
    Add-Failure '.env is tracked by Git.'
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "NumberNinjaDesigns unification validation failed with $($failures.Count) failure(s)."
}

Write-Host 'NumberNinjaDesigns unification validation passed.' -ForegroundColor Green
