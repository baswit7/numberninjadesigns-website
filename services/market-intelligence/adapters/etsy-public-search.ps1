[CmdletBinding()]
param(
    [Parameter(Mandatory)][string[]]$Seeds,
    [Parameter(Mandatory)][string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sourceId = 'etsy-public-search'
$checkedAt = (Get-Date).ToUniversalTime().ToString('o')
$signals = New-Object System.Collections.Generic.List[object]
$riskNotes = New-Object System.Collections.Generic.List[string]
$method = 'public-search-html-title-and-term-observation'
$status = 'unknown'
$headers = @{
    'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36'
    'Accept-Language' = 'en-US,en;q=0.9'
}

foreach ($seed in $Seeds) {
    $query = "$seed shirt"
    $url = 'https://www.etsy.com/search?q=' + [uri]::EscapeDataString($query)
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -Headers $headers -TimeoutSec 20 -UseBasicParsing
        $content = [string]$response.Content
        if ($content -match '(?i)captcha|verify you are human|sign in to continue') {
            $riskNotes.Add("Etsy public search blocked for query: $seed") | Out-Null
            continue
        }

        $terms = @($seed -split '\s+' | Where-Object { $_.Length -gt 2 })
        $observed = @($terms | Where-Object { $content -match [regex]::Escape($_) })
        $listingHints = ([regex]::Matches($content, '(?i)listing|shop|cart|handmade')).Count
        if ($observed.Count -gt 0 -or $listingHints -gt 20) {
            $signals.Add([ordered]@{
                query = $seed
                sourceUrl = $url
                observedTerms = $observed
                signalStrength = [math]::Min(1.0, [math]::Round((0.35 + ($observed.Count * 0.2) + [math]::Min(0.3, ([double]$listingHints / 300.0))), 2))
                evidenceType = 'commerce-page-observed'
            }) | Out-Null
        }
    }
    catch {
        $riskNotes.Add("Etsy public search request failed for query: $seed") | Out-Null
    }
}

if ($signals.Count -gt 0) {
    $status = 'pass'
}
elseif ($riskNotes.Count -gt 0) {
    $status = 'failed'
}

$report = [ordered]@{
    sourceId = $sourceId
    status = $status
    sourceUrl = 'https://www.etsy.com/search'
    checkedAt = $checkedAt
    query = ($Seeds -join ', ')
    extractionMethod = $method
    extractedSignals = @($signals.ToArray())
    riskNotes = @($riskNotes.ToArray())
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
$report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
