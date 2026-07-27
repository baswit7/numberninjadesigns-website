[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$checks = New-Object System.Collections.Generic.List[object]

function Add-Check {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Status,
        [Parameter(Mandatory)][string]$Message
    )
    $checks.Add([ordered]@{ name = $Name; status = $Status; message = $Message }) | Out-Null
}

function Get-RepoPath {
    param([Parameter(Mandatory)][string]$RelativePath)
    return Join-Path $root $RelativePath
}

function Assert-Exists {
    param([Parameter(Mandatory)][string]$RelativePath)
    $path = Get-RepoPath -RelativePath $RelativePath
    if (Test-Path -LiteralPath $path) {
        Add-Check -Name "file:$RelativePath" -Status 'PASS' -Message 'required path exists'
        return $path
    }
    Add-Check -Name "file:$RelativePath" -Status 'FAIL' -Message 'required path is missing'
    return $null
}

function Assert-Json {
    param([Parameter(Mandatory)][string]$RelativePath)
    $path = Assert-Exists -RelativePath $RelativePath
    if ($null -eq $path) { return $null }
    try {
        $json = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        Add-Check -Name "json:$RelativePath" -Status 'PASS' -Message 'json parsed'
        return $json
    }
    catch {
        Add-Check -Name "json:$RelativePath" -Status 'FAIL' -Message "json parse failed: $($_.Exception.Message)"
        return $null
    }
}

function Assert-PowerShellParses {
    param([Parameter(Mandatory)][string]$RelativePath)
    $path = Assert-Exists -RelativePath $RelativePath
    if ($null -eq $path) { return }
    try {
        [scriptblock]::Create((Get-Content -LiteralPath $path -Raw)) | Out-Null
        Add-Check -Name "parse:$RelativePath" -Status 'PASS' -Message 'PowerShell parsed'
    }
    catch {
        Add-Check -Name "parse:$RelativePath" -Status 'FAIL' -Message "PowerShell parse failed: $($_.Exception.Message)"
    }
}

$requiredFiles = @(
    'tools\market-intelligence\collect-market-signals.ps1',
    'tools\market-intelligence\index.html',
    'tools\market-intelligence\css\market-intelligence.css',
    'tools\market-intelligence\js\dashboard.js',
    'tools\market-intelligence\js\scoring-engine.js',
    'services\market-intelligence\adapters\tiktok-creative-center.ps1',
    'services\market-intelligence\adapters\tiktok-public-search.ps1',
    'services\market-intelligence\adapters\etsy-public-search.ps1',
    'services\market-intelligence\adapters\pinterest-public-search.ps1',
    'services\market-intelligence\adapters\google-trends-public.ps1',
    'services\market-intelligence\scoring\score-opportunities.ps1',
    'services\market-intelligence\output\generate-recommendations.ps1',
    'docs\MARKET_INTELLIGENCE_ENGINE.md'
)

foreach ($file in $requiredFiles) {
    Assert-Exists -RelativePath $file | Out-Null
}

$psFiles = @($requiredFiles | Where-Object { $_ -like '*.ps1' })
foreach ($file in $psFiles) {
    Assert-PowerShellParses -RelativePath $file
}

$runtimeReports = @(
    'runtime\market-intelligence\market-signals.report.json',
    'runtime\market-intelligence\opportunities.report.json',
    'runtime\market-intelligence\recommendations.report.json'
)
$presentRuntimeReports = @($runtimeReports | Where-Object {
    Test-Path -LiteralPath (Get-RepoPath -RelativePath $_) -PathType Leaf
})

$marketSignals = $null
$opportunities = $null
$recommendations = $null
if ($presentRuntimeReports.Count -eq 0) {
    Add-Check -Name 'runtime-report-set' -Status 'PASS' -Message 'runtime reports are absent in the clean source state'
}
elseif ($presentRuntimeReports.Count -ne $runtimeReports.Count) {
    Add-Check -Name 'runtime-report-set' -Status 'FAIL' -Message 'runtime report set is incomplete; regenerate all reports atomically'
}
else {
    Add-Check -Name 'runtime-report-set' -Status 'PASS' -Message 'complete runtime report set is present'
    $marketSignals = Assert-Json -RelativePath $runtimeReports[0]
    $opportunities = Assert-Json -RelativePath $runtimeReports[1]
    $recommendations = Assert-Json -RelativePath $runtimeReports[2]
}

$scanRoots = @(
    'tools\market-intelligence',
    'services\market-intelligence'
)
$scanFiles = New-Object System.Collections.Generic.List[object]
foreach ($relativePath in $scanRoots) {
    $path = Get-RepoPath -RelativePath $relativePath
    if (Test-Path -LiteralPath $path -PathType Container) {
        Get-ChildItem -LiteralPath $path -File -Recurse | ForEach-Object { $scanFiles.Add($_) | Out-Null }
    }
    elseif (Test-Path -LiteralPath $path -PathType Leaf) {
        $scanFiles.Add((Get-Item -LiteralPath $path)) | Out-Null
    }
}

$forbiddenEndpointPatterns = @(
    'creator/search',
    'creator_search',
    'creator-search-insights',
    'oauth',
    '/upload',
    '/publish',
    '/posting',
    '/login',
    'password',
    'client[_-]?secret',
    'private account',
    'session',
    'cookie',
    '\.env',
    'localStorage',
    'sessionStorage'
)

$violations = New-Object System.Collections.Generic.List[string]
foreach ($file in $scanFiles) {
    if ($file.FullName.EndsWith('validate-market-intelligence.ps1')) {
        continue
    }
    $content = Get-Content -LiteralPath $file.FullName -Raw
    foreach ($pattern in $forbiddenEndpointPatterns) {
        if ($content -match $pattern) {
            $relative = $file.FullName.Substring($root.Path.Length).TrimStart('\', '/')
            $violations.Add("$relative pattern=$pattern") | Out-Null
        }
    }
}
if ($violations.Count -eq 0) {
    Add-Check -Name 'forbidden-capability-scan' -Status 'PASS' -Message 'no forbidden endpoint, credential, storage, or private workflow patterns found'
}
else {
    Add-Check -Name 'forbidden-capability-scan' -Status 'FAIL' -Message ($violations -join '; ')
}

if ($null -ne $marketSignals) {
    $allowedStatuses = @('pass', 'partial', 'unknown', 'failed')
    $invalidSources = @($marketSignals.sources | Where-Object { $_.status -notin $allowedStatuses })
    if ($invalidSources.Count -eq 0) {
        Add-Check -Name 'source-status-labels' -Status 'PASS' -Message 'source statuses use allowed labels'
    }
    else {
        Add-Check -Name 'source-status-labels' -Status 'FAIL' -Message 'one or more sources use invalid labels'
    }

    $badFailedSources = @($marketSignals.sources | Where-Object { $_.status -in @('failed', 'unknown') -and @($_.extractedSignals).Count -gt 0 })
    if ($badFailedSources.Count -eq 0) {
        Add-Check -Name 'failed-source-boundary' -Status 'PASS' -Message 'failed and unknown sources do not contain positive extracted signals'
    }
    else {
        Add-Check -Name 'failed-source-boundary' -Status 'FAIL' -Message 'failed or unknown sources contain extracted signals'
    }

    if ($marketSignals.boundaries.usesEnvFile -eq $false -and $marketSignals.boundaries.publicPagesOnly -eq $true -and $marketSignals.boundaries.manualKeywordInputRequired -eq $false) {
        Add-Check -Name 'boundary-report' -Status 'PASS' -Message 'runtime report preserves no-env public-page automated boundary'
    }
    else {
        Add-Check -Name 'boundary-report' -Status 'FAIL' -Message 'runtime report boundary is incorrect'
    }
}

if ($null -ne $recommendations) {
    $requiredRecommendationFields = @(
        'designIdea',
        'productTitleAngle',
        'tiktokHook',
        'tiktokCaption',
        'hashtagSet',
        'etsyTitle',
        'etsyTags',
        'pinterestTitle',
        'pinterestDescription',
        'confidenceReason',
        'evidenceSources',
        'riskNotes'
    )
    $invalidRecommendations = New-Object System.Collections.Generic.List[string]
    foreach ($recommendation in @($recommendations.recommendations)) {
        foreach ($field in $requiredRecommendationFields) {
            if ($null -eq $recommendation.PSObject.Properties[$field] -or $null -eq $recommendation.$field) {
                $invalidRecommendations.Add("$($recommendation.id):$field") | Out-Null
            }
        }
        if (@($recommendation.etsyTags).Count -ne 13) {
            $invalidRecommendations.Add("$($recommendation.id):etsyTags-count") | Out-Null
        }
    }
    if ($invalidRecommendations.Count -eq 0) {
        Add-Check -Name 'recommendation-schema' -Status 'PASS' -Message 'recommendations contain all required fields'
    }
    else {
        Add-Check -Name 'recommendation-schema' -Status 'FAIL' -Message ($invalidRecommendations -join ', ')
    }
}

$dashboardFiles = @(
    'tools\market-intelligence\index.html',
    'tools\market-intelligence\css\market-intelligence.css',
    'tools\market-intelligence\js\dashboard.js',
    'tools\market-intelligence\js\scoring-engine.js'
)
$externalRefs = New-Object System.Collections.Generic.List[string]
foreach ($relativePath in $dashboardFiles) {
    $path = Get-RepoPath -RelativePath $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
    $content = Get-Content -LiteralPath $path -Raw
    if ($content -match 'https?://|//cdn\.|unpkg|npmcdn|fonts\.googleapis|googletagmanager|analytics') {
        $externalRefs.Add($relativePath) | Out-Null
    }
}
if ($externalRefs.Count -eq 0) {
    Add-Check -Name 'dashboard-local-only' -Status 'PASS' -Message 'dashboard references local files only'
}
else {
    Add-Check -Name 'dashboard-local-only' -Status 'FAIL' -Message ($externalRefs -join ', ')
}

$failed = @($checks | Where-Object { $_.status -eq 'FAIL' })
$status = if ($failed.Count -gt 0) { 'FAIL' } else { 'PASS' }
$report = [ordered]@{
    name = 'validate-market-intelligence'
    status = $status
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    checks = @($checks.ToArray())
}

$reportDir = Get-RepoPath -RelativePath 'runtime\market-intelligence'
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$reportPath = Join-Path $reportDir 'validate-market-intelligence.report.json'
$report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $reportPath -Encoding UTF8
Write-Host "Report: $reportPath"

if ($status -eq 'FAIL') {
    exit 1
}

exit 0
