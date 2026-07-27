[CmdletBinding()]
param(
    [Parameter(Mandatory)][string[]]$Seeds,
    [Parameter(Mandatory)][string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sourceId = 'google-trends-public'
$checkedAt = (Get-Date).ToUniversalTime().ToString('o')
$signals = New-Object System.Collections.Generic.List[object]
$riskNotes = New-Object System.Collections.Generic.List[string]
$method = 'public-trends-page-term-observation'
$status = 'unknown'
$headers = @{
    'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36'
    'Accept-Language' = 'en-US,en;q=0.9'
}

foreach ($seed in $Seeds) {
    $url = 'https://trends.google.com/trends/explore?geo=US&q=' + [uri]::EscapeDataString($seed)
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -Headers $headers -TimeoutSec 18 -UseBasicParsing
        $content = [string]$response.Content
        if ($content -match '(?i)captcha|unusual traffic|sign in') {
            $riskNotes.Add("Google Trends public page blocked for query: $seed") | Out-Null
            continue
        }
        $terms = @($seed -split '\s+' | Where-Object { $_.Length -gt 2 })
        $observed = @($terms | Where-Object { $content -match [regex]::Escape($_) })
        if ($observed.Count -gt 0) {
            $signals.Add([ordered]@{
                query = $seed
                sourceUrl = $url
                observedTerms = $observed
                signalStrength = [math]::Min(1.0, [math]::Round(($observed.Count / [math]::Max(1, $terms.Count)), 2))
                evidenceType = 'term-observed'
            }) | Out-Null
        }
    }
    catch {
        $riskNotes.Add("Google Trends public page request failed for query: $seed") | Out-Null
    }
}

if ($signals.Count -gt 0) {
    $status = 'partial'
}
elseif ($riskNotes.Count -gt 0) {
    $status = 'failed'
}

$report = [ordered]@{
    sourceId = $sourceId
    status = $status
    sourceUrl = 'https://trends.google.com/trends/explore'
    checkedAt = $checkedAt
    query = ($Seeds -join ', ')
    extractionMethod = $method
    extractedSignals = @($signals.ToArray())
    riskNotes = @($riskNotes.ToArray())
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
$report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
