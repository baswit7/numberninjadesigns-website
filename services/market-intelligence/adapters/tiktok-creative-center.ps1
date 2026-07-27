[CmdletBinding()]
param(
    [Parameter(Mandatory)][string[]]$Seeds,
    [Parameter(Mandatory)][string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sourceId = 'tiktok-creative-center'
$sourceUrl = 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/mobile/en'
$checkedAt = (Get-Date).ToUniversalTime().ToString('o')
$signals = New-Object System.Collections.Generic.List[object]
$riskNotes = New-Object System.Collections.Generic.List[string]
$status = 'unknown'
$method = 'public-page-html-term-observation'
$headers = @{
    'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36'
    'Accept-Language' = 'en-US,en;q=0.9'
}

try {
    $response = Invoke-WebRequest -Uri $sourceUrl -Method GET -Headers $headers -TimeoutSec 20 -UseBasicParsing
    $content = [string]$response.Content
    if ($content -match '(?i)captcha|verify you are human|login|sign in') {
        $status = 'failed'
        $riskNotes.Add('Public page returned a captcha, verification, or login wall.') | Out-Null
    }
    else {
        foreach ($seed in $Seeds) {
            $terms = @($seed -split '\s+' | Where-Object { $_.Length -gt 2 })
            $observed = @($terms | Where-Object { $content -match [regex]::Escape($_) })
            if ($observed.Count -gt 0) {
                $signals.Add([ordered]@{
                    query = $seed
                    sourceUrl = $sourceUrl
                    observedTerms = $observed
                    signalStrength = [math]::Min(1.0, [math]::Round(($observed.Count / [math]::Max(1, $terms.Count)), 2))
                    evidenceType = 'term-observed'
                }) | Out-Null
            }
        }
        $status = if ($signals.Count -gt 0) { 'partial' } else { 'unknown' }
        if ($status -eq 'unknown') {
            $riskNotes.Add('Public page loaded, but no query seed terms were visible in static HTML.') | Out-Null
        }
    }
}
catch {
    $status = 'failed'
    $riskNotes.Add('Public page request failed or was blocked.') | Out-Null
}

$report = [ordered]@{
    sourceId = $sourceId
    status = $status
    sourceUrl = $sourceUrl
    checkedAt = $checkedAt
    query = ($Seeds -join ', ')
    extractionMethod = $method
    extractedSignals = @($signals.ToArray())
    riskNotes = @($riskNotes.ToArray())
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
$report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
