[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'scripts/lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$generatedAt = Get-StudioTimestamp

function Get-RelativeTextEvidence {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][string[]]$Needles,
        [Parameter(Mandatory)][string]$EvidenceId
    )

    $path = Join-Path $root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return [pscustomobject]@{
            evidenceId = $EvidenceId
            status = 'UNKNOWN'
            source = $RelativePath.Replace('\', '/')
            summary = 'Source file is missing; evidence remains UNKNOWN.'
        }
    }

    $content = Get-Content -LiteralPath $path -Raw
    $matches = @($Needles | Where-Object { $content -match [regex]::Escape($_) })
    if ($matches.Count -eq 0) {
        return [pscustomobject]@{
            evidenceId = $EvidenceId
            status = 'UNKNOWN'
            source = $RelativePath.Replace('\', '/')
            summary = 'Source file exists but expected evidence terms were not found.'
        }
    }

    return [pscustomobject]@{
        evidenceId = $EvidenceId
        status = 'connected'
        source = $RelativePath.Replace('\', '/')
        summary = "Matched local evidence terms: $($matches -join ', ')."
    }
}

function Get-Classification {
    param([double]$Confidence)

    if ($Confidence -ge 0.9) { return 'A' }
    if ($Confidence -ge 0.75) { return 'B' }
    if ($Confidence -ge 0.6) { return 'C' }
    return 'UNKNOWN'
}

function Get-ReportStatus {
    param([object[]]$Items)

    $itemsArray = @($Items)
    if ($itemsArray.Count -eq 0) { return 'unknown' }
    if (@($itemsArray | Where-Object { $_.status -eq 'failed' }).Count -gt 0) { return 'failed' }
    if (@($itemsArray | Where-Object { $_.status -eq 'connected' }).Count -gt 0) { return 'connected' }
    return 'unknown'
}

function New-Boundary {
    return [ordered]@{
        readOnly = $true
        usesPublicSignalsOnly = $true
        usesLoginAutomation = $false
        usesOAuthAutomation = $false
        usesPrivateScraping = $false
        publishesContent = $false
        executesPosting = $false
        executesApprovalActions = $false
        mutatesExternalSystems = $false
        exposesSecrets = $false
        storesSecrets = $false
    }
}

$productMasterEvidence = Get-RelativeTextEvidence `
    -RelativePath 'projects/NumberNinjaDesigns/products/pivot-table-operator/PRODUCT_MASTER.md' `
    -Needles @('Pivot Table Operator', 'Excel users', 'data analysts', 'Commercial strength: high') `
    -EvidenceId 'numberninjadesigns.pivot-table-operator.product-master'

$seoEvidence = Get-RelativeTextEvidence `
    -RelativePath 'projects/NumberNinjaDesigns/products/pivot-table-operator/SEO_KEYWORDS.md' `
    -Needles @('pivot table shirt', 'excel humor shirt', 'data analyst shirt', 'spreadsheet gift') `
    -EvidenceId 'numberninjadesigns.pivot-table-operator.seo-keywords'

$backlogEvidence = Get-RelativeTextEvidence `
    -RelativePath 'projects/NumberNinjaDesigns/docs/PRODUCT_IDEA_BACKLOG.md' `
    -Needles @('Pivot Table Operator', 'Query Before Coffee', 'Model Is Overfitting', 'I Survived VLOOKUP') `
    -EvidenceId 'numberninjadesigns.product-idea-backlog'

$socialEvidence = Get-RelativeTextEvidence `
    -RelativePath 'projects/NumberNinjaDesigns/products/pivot-table-operator/SOCIAL_CONTENT.md' `
    -Needles @('TikTok Ideas', 'Pinterest Pin Ideas', 'Hashtag Pool') `
    -EvidenceId 'numberninjadesigns.pivot-table-operator.social-content'

$providerHealthPath = 'runtime/api-connections/api-connection-validation.report.json'
$providerHealthSafe = Read-StudioJsonSafe -RelativePath $providerHealthPath
$providerHealth = @()
if ($providerHealthSafe.validJson) {
    $allowedProviderStatuses = @('connected', 'failed', 'not-configured', 'unknown')
    $providerHealth = @($providerHealthSafe.value.providers | ForEach-Object {
        [pscustomobject]@{
            providerName = $_.providerName
            status = if ($_.status -in $allowedProviderStatuses) { $_.status } else { 'unknown' }
            checkedAt = $_.checkedAt
        }
    })
}

$signals = @(
    [pscustomobject]@{
        signalId = 'signal.local.product-catalog.pivot-table-operator'
        sourceType = 'current-studio-knowledge'
        status = $productMasterEvidence.status
        classification = if ($productMasterEvidence.status -eq 'connected') { 'A' } else { 'UNKNOWN' }
        confidence = if ($productMasterEvidence.status -eq 'connected') { 0.92 } else { 0.0 }
        summary = 'Local product master identifies a ready Pivot Table Operator product concept.'
        evidence = @($productMasterEvidence)
        sourceLineage = @($productMasterEvidence.source)
    },
    [pscustomobject]@{
        signalId = 'signal.local.seo-keywords.pivot-table-operator'
        sourceType = 'current-studio-knowledge'
        status = $seoEvidence.status
        classification = if ($seoEvidence.status -eq 'connected') { 'B' } else { 'UNKNOWN' }
        confidence = if ($seoEvidence.status -eq 'connected') { 0.84 } else { 0.0 }
        summary = 'Local SEO keyword file contains high-intent buyer and product phrases.'
        evidence = @($seoEvidence)
        sourceLineage = @($seoEvidence.source)
    },
    [pscustomobject]@{
        signalId = 'signal.local.product-backlog.top-five'
        sourceType = 'current-studio-knowledge'
        status = $backlogEvidence.status
        classification = if ($backlogEvidence.status -eq 'connected') { 'A' } else { 'UNKNOWN' }
        confidence = if ($backlogEvidence.status -eq 'connected') { 0.9 } else { 0.0 }
        summary = 'Local backlog ranks first-batch product ideas with explicit confidence and readiness notes.'
        evidence = @($backlogEvidence)
        sourceLineage = @($backlogEvidence.source)
    },
    [pscustomobject]@{
        signalId = 'signal.public.tiktok-creator-search-insights'
        sourceType = 'public-signal'
        status = 'unknown'
        classification = 'UNKNOWN'
        confidence = 0.0
        summary = 'TikTok Creator Search Insights was not queried in this read-only phase; no fabricated trend data is allowed.'
        evidence = @([pscustomobject]@{ evidenceId = 'public.tiktok-csi.not-collected'; status = 'UNKNOWN'; source = 'not-collected'; summary = 'Unavailable source remains UNKNOWN.' })
        sourceLineage = @('not-collected')
    },
    [pscustomobject]@{
        signalId = 'signal.public.etsy-marketplace-manual-research'
        sourceType = 'public-signal'
        status = 'unknown'
        classification = 'UNKNOWN'
        confidence = 0.0
        summary = 'Etsy marketplace research was not performed by automation; manual checklist remains the only source.'
        evidence = @([pscustomobject]@{ evidenceId = 'public.etsy-manual-research.not-collected'; status = 'UNKNOWN'; source = 'not-collected'; summary = 'Unavailable source remains UNKNOWN.' })
        sourceLineage = @('not-collected')
    },
    [pscustomobject]@{
        signalId = 'signal.public.pinterest-trends'
        sourceType = 'public-signal'
        status = 'unknown'
        classification = 'UNKNOWN'
        confidence = 0.0
        summary = 'Pinterest trend evidence is not available in this phase; recommendations must not infer demand.'
        evidence = @([pscustomobject]@{ evidenceId = 'public.pinterest-trends.not-collected'; status = 'UNKNOWN'; source = 'not-collected'; summary = 'Unavailable source remains UNKNOWN.' })
        sourceLineage = @('not-collected')
    }
)

$opportunitySeed = @(
    [pscustomobject]@{ id = 'pivot-table-operator'; title = 'Pivot Table Operator'; audience = 'Excel Users, Data Analysts, Spreadsheet Nerds'; confidence = 0.92; kind = 'product'; evidence = @($productMasterEvidence, $seoEvidence, $backlogEvidence) },
    [pscustomobject]@{ id = 'query-before-coffee'; title = 'Query Before Coffee'; audience = 'SQL Developers, Programmers, Software Engineers'; confidence = 0.86; kind = 'product'; evidence = @($backlogEvidence) },
    [pscustomobject]@{ id = 'model-is-overfitting'; title = 'Model Is Overfitting'; audience = 'Machine Learning Engineers, AI Engineers, Data Scientists'; confidence = 0.85; kind = 'product'; evidence = @($backlogEvidence) },
    [pscustomobject]@{ id = 'pivot-table-content-system'; title = 'Pivot Table Operator content angles'; audience = 'Excel Users, Data Analysts, Business Analysts'; confidence = 0.79; kind = 'content'; evidence = @($socialEvidence, $productMasterEvidence) },
    [pscustomobject]@{ id = 'pivot-table-seo-cluster'; title = 'Pivot Table Operator SEO cluster'; audience = 'Etsy buyers searching Excel and analyst gifts'; confidence = 0.84; kind = 'seo'; evidence = @($seoEvidence) },
    [pscustomobject]@{ id = 'manual-platform-mix'; title = 'Manual Etsy, TikTok and Pinterest visibility mix'; audience = 'Manual content operations'; confidence = 0.62; kind = 'platform'; evidence = @($socialEvidence, $seoEvidence) }
)

$opportunities = @($opportunitySeed | ForEach-Object {
    $validEvidence = @($_.evidence | Where-Object { $_.status -eq 'connected' })
    $confidence = if ($validEvidence.Count -gt 0) { [double]$_.confidence } else { 0.0 }
    [pscustomobject]@{
        opportunityId = "opp.$($_.id)"
        kind = $_.kind
        title = $_.title
        audience = $_.audience
        status = if ($validEvidence.Count -gt 0) { 'connected' } else { 'unknown' }
        classification = Get-Classification -Confidence $confidence
        confidence = $confidence
        evidence = @($_.evidence)
        sourceLineage = @($_.evidence | ForEach-Object { $_.source } | Sort-Object -Unique)
        nextAction = 'Review evidence and decide APPROVED or REJECTED in a future human-controlled approval pass.'
    }
})

$approvalItems = @($opportunities | ForEach-Object {
    [pscustomobject]@{
        approvalId = "approval.$($_.opportunityId)"
        opportunityId = $_.opportunityId
        title = $_.title
        status = if ($_.classification -eq 'UNKNOWN') { 'UNKNOWN' } else { 'PENDING_REVIEW' }
        confidence = $_.confidence
        evidence = @($_.evidence)
        sourceLineage = @($_.sourceLineage)
        readOnly = $true
        canPublish = $false
        canExecute = $false
    }
})

$approvedOpportunityIds = @($approvalItems | Where-Object { $_.status -eq 'APPROVED' } | ForEach-Object { $_.opportunityId })
$recommendations = @($opportunities | Where-Object { $_.opportunityId -in $approvedOpportunityIds } | ForEach-Object {
    $hashtags = @('#ExcelHumor', '#DataAnalyst', '#SpreadsheetNerd', '#BusinessAnalyst', '#OfficeHumor')
    [pscustomobject]@{
        recommendationId = "rec.$($_.opportunityId)"
        opportunityId = $_.opportunityId
        approvalStatus = 'APPROVED'
        confidence = $_.confidence
        evidence = @($_.evidence)
        sourceLineage = @($_.sourceLineage)
        outputs = [ordered]@{
            productIdea = $_.title
            audience = $_.audience
            titleAngle = "$($_.title) as a premium tactical identity product."
            contentAngle = 'Show the work-culture moment, then reveal the product as the identity marker.'
            tikTokCaption = 'When the spreadsheet is broken and everyone looks at you.'
            hashtags = $hashtags
            etsyTitle = "$($_.title) Shirt, Excel Humor Tee, Spreadsheet Analyst Gift"
            etsyTags = @('excel humor shirt', 'spreadsheet gift', 'data analyst tee', 'office nerd shirt', 'analyst gift')
            pinterestTitle = "$($_.title) Shirt for Data Analysts"
            pinterestDescription = 'A dark tactical premium shirt concept for spreadsheet-heavy office data professionals.'
        }
    }
})

$marketSignalsReport = [pscustomobject][ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $generatedAt
    source = 'services/market-intelligence/generate-market-intelligence.ps1'
    status = Get-ReportStatus -Items $signals
    signalSources = [ordered]@{
        currentStudioKnowledge = 'connected'
        numberNinjaDesignsCatalog = if ($productMasterEvidence.status -eq 'connected' -or $backlogEvidence.status -eq 'connected') { 'connected' } else { 'unknown' }
        publicSignals = 'unknown'
    }
    providerHealth = $providerHealth
    signals = $signals
    boundaries = New-Boundary
}

$opportunitiesReport = [pscustomobject][ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $generatedAt
    source = 'services/market-intelligence/generate-market-intelligence.ps1'
    status = Get-ReportStatus -Items $opportunities
    opportunities = $opportunities
    boundaries = New-Boundary
}

$recommendationsReport = [pscustomobject][ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $generatedAt
    source = 'services/market-intelligence/generate-market-intelligence.ps1'
    status = if ($recommendations.Count -gt 0) { 'connected' } else { 'unknown' }
    summary = if ($recommendations.Count -gt 0) { "$($recommendations.Count) approved recommendations generated." } else { 'No recommendations generated because no opportunity is APPROVED.' }
    recommendations = $recommendations
    pendingRecommendationInputs = @($approvalItems | Where-Object { $_.status -eq 'PENDING_REVIEW' } | ForEach-Object { $_.opportunityId })
    boundaries = New-Boundary
}

$approvalQueueReport = [pscustomobject][ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $generatedAt
    source = 'services/market-intelligence/generate-market-intelligence.ps1'
    status = if ($approvalItems.Count -gt 0) { 'connected' } else { 'unknown' }
    items = $approvalItems
    boundaries = New-Boundary
}

Write-StudioJson -RelativePath 'runtime/market-intelligence/market-signals.report.json' -Value $marketSignalsReport
Write-StudioJson -RelativePath 'runtime/market-intelligence/opportunities.report.json' -Value $opportunitiesReport
Write-StudioJson -RelativePath 'runtime/market-intelligence/recommendations.report.json' -Value $recommendationsReport
Write-StudioJson -RelativePath 'runtime/market-intelligence/approval-queue.report.json' -Value $approvalQueueReport

Write-Output "market-signals: $($marketSignalsReport.status)"
Write-Output "opportunities: $($opportunitiesReport.status)"
Write-Output "recommendations: $($recommendationsReport.status)"
Write-Output "approval-queue: $($approvalQueueReport.status)"
