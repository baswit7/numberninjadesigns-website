[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$runtimeDir = Join-Path $root 'runtime\market-intelligence'
$adapterDir = Join-Path $root 'services\market-intelligence\adapters'
$scoringScript = Join-Path $root 'services\market-intelligence\scoring\score-opportunities.ps1'
$recommendationScript = Join-Path $root 'services\market-intelligence\output\generate-recommendations.ps1'
$dashboardDataPath = Join-Path $root 'tools\market-intelligence\js\market-data.js'

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dashboardDataPath) | Out-Null

$seeds = @(
    'excel',
    'spreadsheet',
    'data analyst',
    'power bi',
    'sql',
    'python',
    'coding',
    'programmer',
    'machine learning',
    'ai engineer',
    'dashboard',
    'data science',
    'vlookup',
    'pivot table',
    'debug',
    'overfitting',
    'algorithm'
)

$adapterSpecs = @(
    @{ id = 'tiktok-creative-center'; script = 'tiktok-creative-center.ps1' },
    @{ id = 'tiktok-public-search'; script = 'tiktok-public-search.ps1' },
    @{ id = 'etsy-public-search'; script = 'etsy-public-search.ps1' },
    @{ id = 'pinterest-public-search'; script = 'pinterest-public-search.ps1' },
    @{ id = 'google-trends-public'; script = 'google-trends-public.ps1' }
)

$sourceReports = New-Object System.Collections.Generic.List[object]
foreach ($adapter in $adapterSpecs) {
    $scriptPath = Join-Path $adapterDir $adapter.script
    $outputPath = Join-Path $runtimeDir "$($adapter.id).source.json"

    if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
        $sourceReports.Add([ordered]@{
            sourceId = $adapter.id
            status = 'failed'
            sourceUrl = $null
            checkedAt = (Get-Date).ToUniversalTime().ToString('o')
            query = $null
            extractionMethod = 'adapter-missing'
            extractedSignals = @()
            riskNotes = @('Adapter script is missing.')
        }) | Out-Null
        continue
    }

    & $scriptPath -Seeds $seeds -OutputPath $outputPath | Out-Null
    $sourceReports.Add((Get-Content -LiteralPath $outputPath -Raw | ConvertFrom-Json)) | Out-Null
}

$marketReport = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    engine = 'numberninjadesigns-market-intelligence-v1'
    seeds = $seeds
    sourceStatuses = @($sourceReports | ForEach-Object {
        [ordered]@{
            sourceId = $_.sourceId
            status = $_.status
            checkedAt = $_.checkedAt
            sourceUrl = $_.sourceUrl
            extractionMethod = $_.extractionMethod
        }
    })
    sources = $sourceReports
    boundaries = [ordered]@{
        loginAutomation = $false
        creatorSearchInsightsAutomation = $false
        privateAccountScraping = $false
        storesTokens = $false
        usesEnvFile = $false
        publicPagesOnly = $true
        manualKeywordInputRequired = $false
    }
}

$marketSignalsPath = Join-Path $runtimeDir 'market-signals.report.json'
$marketReport | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $marketSignalsPath -Encoding UTF8

& $scoringScript -MarketSignalsPath $marketSignalsPath -OutputPath (Join-Path $runtimeDir 'opportunities.report.json') | Out-Null
& $recommendationScript `
    -MarketSignalsPath $marketSignalsPath `
    -OpportunitiesPath (Join-Path $runtimeDir 'opportunities.report.json') `
    -OutputPath (Join-Path $runtimeDir 'recommendations.report.json') | Out-Null

$signalsJson = Get-Content -LiteralPath $marketSignalsPath -Raw
$opportunitiesJson = Get-Content -LiteralPath (Join-Path $runtimeDir 'opportunities.report.json') -Raw
$recommendationsJson = Get-Content -LiteralPath (Join-Path $runtimeDir 'recommendations.report.json') -Raw
$dashboardData = "window.MarketIntelligenceRuntime = {`n  marketSignals: $signalsJson,`n  opportunities: $opportunitiesJson,`n  recommendations: $recommendationsJson`n};"
$dashboardData | Set-Content -LiteralPath $dashboardDataPath -Encoding UTF8

Write-Host 'Market intelligence collection complete.'
Write-Host "Signals: $marketSignalsPath"
Write-Host "Opportunities: $(Join-Path $runtimeDir 'opportunities.report.json')"
Write-Host "Recommendations: $(Join-Path $runtimeDir 'recommendations.report.json')"
Write-Host "Dashboard: $(Join-Path $root 'tools\market-intelligence\index.html')"
