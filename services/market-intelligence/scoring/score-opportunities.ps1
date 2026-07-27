[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$MarketSignalsPath,
    [Parameter(Mandatory)][string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$marketSignals = Get-Content -LiteralPath $MarketSignalsPath -Raw | ConvertFrom-Json
$sourceWeights = @{
    'tiktok-creative-center' = 18
    'tiktok-public-search' = 14
    'etsy-public-search' = 24
    'pinterest-public-search' = 14
    'google-trends-public' = 16
}

function Get-BaseFit {
    param([Parameter(Mandatory)][string]$Seed)

    $high = @('excel', 'spreadsheet', 'data analyst', 'power bi', 'sql', 'python', 'coding', 'programmer', 'dashboard', 'vlookup', 'pivot table', 'debug', 'overfitting', 'algorithm')
    if ($Seed -in $high) { return 82 }
    return 70
}

function Get-Novelty {
    param([Parameter(Mandatory)][string]$Seed)

    if ($Seed -in @('overfitting', 'debug', 'algorithm', 'vlookup', 'pivot table')) { return 86 }
    if ($Seed -in @('excel', 'spreadsheet', 'python', 'sql')) { return 62 }
    return 72
}

$opportunities = New-Object System.Collections.Generic.List[object]
foreach ($seed in $marketSignals.seeds) {
    $evidence = New-Object System.Collections.Generic.List[object]
    $sourceScore = 0
    $sourceCount = 0
    $passOrPartial = 0

    foreach ($source in @($marketSignals.sources)) {
        $matchingSignals = @($source.extractedSignals | Where-Object { $_.query -eq $seed })
        if ($matchingSignals.Count -eq 0) {
            continue
        }

        foreach ($signal in $matchingSignals) {
            $status = [string]$source.status
            if ($status -in @('pass', 'partial')) {
                $passOrPartial += 1
                $weight = if ($sourceWeights.ContainsKey($source.sourceId)) { $sourceWeights[$source.sourceId] } else { 8 }
                $strength = [double]$signal.signalStrength
                $sourceScore += [math]::Min($weight, [math]::Round($weight * $strength, 2))
            }

            $evidence.Add([ordered]@{
                sourceId = $source.sourceId
                status = $status
                sourceUrl = $signal.sourceUrl
                query = $seed
                observedTerms = @($signal.observedTerms)
                signalStrength = $signal.signalStrength
                extractionMethod = $source.extractionMethod
            }) | Out-Null
            $sourceCount += 1
        }
    }

    $relevance = Get-BaseFit -Seed $seed
    $commercialIntent = if (@($evidence | Where-Object { $_.sourceId -eq 'etsy-public-search' -and $_.status -in @('pass', 'partial') }).Count -gt 0) { 82 } else { 58 }
    $trendSignal = [math]::Min(100.0, 38 + $sourceScore)
    $competitionSignal = if (@($evidence | Where-Object { $_.sourceId -eq 'etsy-public-search' }).Count -gt 0) { 64 } else { 45 }
    $platformFitTikTok = if ($seed -in @('debug', 'overfitting', 'algorithm', 'excel', 'python', 'sql')) { 82 } else { 68 }
    $platformFitEtsy = if ($seed -in @('excel', 'spreadsheet', 'vlookup', 'pivot table', 'data analyst', 'power bi')) { 88 } else { 70 }
    $platformFitPinterest = if ($seed -in @('excel', 'spreadsheet', 'dashboard', 'data science')) { 80 } else { 64 }
    $productDesignFit = if ($seed -in @('debug', 'overfitting', 'pivot table', 'vlookup', 'algorithm')) { 90 } else { 76 }
    $novelty = Get-Novelty -Seed $seed
    $confidence = if ($sourceCount -eq 0) { 0.18 } else { [math]::Min(0.92, [math]::Round((0.22 + ($passOrPartial * 0.12)), 2)) }

    $weightedTotal = [math]::Round((
        ($relevance * 0.18) +
        ($commercialIntent * 0.13) +
        ($trendSignal * 0.14) +
        ($competitionSignal * 0.09) +
        ($platformFitTikTok * 0.09) +
        ($platformFitEtsy * 0.12) +
        ($platformFitPinterest * 0.07) +
        ($productDesignFit * 0.12) +
        ($novelty * 0.06)
    ), 2)

    $grade = if ($weightedTotal -ge 76 -and $confidence -ge 0.46) {
        'A'
    }
    elseif ($weightedTotal -ge 58 -and $confidence -ge 0.30) {
        'B'
    }
    else {
        'C'
    }

    $riskNotes = New-Object System.Collections.Generic.List[string]
    if ($confidence -lt 0.45) {
        $riskNotes.Add('Low confidence: public sources were blocked, partial, or thin for this query.') | Out-Null
    }
    if (@($evidence | Where-Object { $_.status -in @('failed', 'unknown') }).Count -gt 0) {
        $riskNotes.Add('Some public sources failed or were unknown and were not converted into positive evidence.') | Out-Null
    }

    $opportunities.Add([ordered]@{
        id = ($seed.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')
        query = $seed
        grade = $grade
        totalScore = $weightedTotal
        confidence = $confidence
        scoreBreakdown = [ordered]@{
            relevanceToNumberNinjaDesigns = $relevance
            commercialIntent = $commercialIntent
            trendSignal = $trendSignal
            competitionSignal = $competitionSignal
            platformFitTikTok = $platformFitTikTok
            platformFitEtsy = $platformFitEtsy
            platformFitPinterest = $platformFitPinterest
            productDesignFit = $productDesignFit
            novelty = $novelty
            confidence = $confidence
        }
        evidenceSources = @($evidence.ToArray())
        riskNotes = @($riskNotes.ToArray())
    }) | Out-Null
}

$report = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    scoringModel = 'transparent-weighted-v1'
    gradePolicy = [ordered]@{
        A = 'high priority'
        B = 'useful'
        C = 'weak / avoid'
    }
    opportunities = @($opportunities.ToArray() | Sort-Object -Property @{ Expression = 'grade'; Ascending = $true }, @{ Expression = 'totalScore'; Descending = $true })
}

$directory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$report | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
