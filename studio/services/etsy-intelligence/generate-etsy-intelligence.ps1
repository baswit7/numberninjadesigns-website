[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSCommandPath))) 'scripts/lib/StudioRuntime.psm1') -Force

function New-EtsyBoundary {
    return [ordered]@{
        readOnly = $true
        derivedOnly = $true
        reportWritingOnly = $true
        ownsTruth = $false
        createsListings = $false
        updatesListings = $false
        publishesListings = $false
        updatesInventory = $false
        updatesOrders = $false
        respondsToReviews = $false
        providerExecution = $false
        automationExecution = $false
        schedulingAllowed = $false
        deploymentAllowed = $false
        agentExecution = $false
        storesSecrets = $false
        exposesSecrets = $false
        writesProviderResponseBodies = $false
    }
}

function Read-LocalEnv {
    $path = Get-StudioEnvironmentPath
    $values = @{}
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $values }

    foreach ($rawLine in Get-Content -LiteralPath $path) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) { continue }
        if ($line -notmatch '^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { continue }
        $name = $Matches[1]
        $value = $Matches[2].Trim()
        if ($value.Length -ge 2) {
            $first = $value.Substring(0, 1)
            $last = $value.Substring($value.Length - 1, 1)
            if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }
        $values[$name] = $value
    }
    return $values
}

function Test-EnvPresent {
    param([Parameter(Mandatory)][hashtable]$Values, [Parameter(Mandatory)][string]$Name)
    return $Values.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace([string]$Values[$Name])
}

function Invoke-EtsyReadJson {
    param(
        [Parameter(Mandatory)][string]$Uri,
        [Parameter(Mandatory)][hashtable]$Headers
    )

    try {
        $response = Invoke-RestMethod -Uri $Uri -Method GET -Headers $Headers -TimeoutSec 25
        return [pscustomobject]@{ ok = $true; value = $response; error = $null }
    }
    catch {
        return [pscustomobject]@{ ok = $false; value = $null; error = $_.Exception.Message }
    }
}

function Get-ArrayValue {
    param([AllowNull()]$Value)
    if ($null -eq $Value) { return @() }
    if ($Value -is [array]) { return @($Value) }
    return @($Value)
}

function Get-PropertyValue {
    param($Object, [string]$Name, $Default = $null)
    if ($null -eq $Object) { return $Default }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $Default }
    return $property.Value
}

function New-ListingRow {
    param($Listing)

    $listingId = [string](Get-PropertyValue -Object $Listing -Name 'listing_id' -Default '')
    $views = [int](Get-PropertyValue -Object $Listing -Name 'views' -Default 0)
    $favorites = [int](Get-PropertyValue -Object $Listing -Name 'num_favorers' -Default 0)
    return [ordered]@{
        listingId = $listingId
        title = [string](Get-PropertyValue -Object $Listing -Name 'title' -Default '')
        state = [string](Get-PropertyValue -Object $Listing -Name 'state' -Default 'unknown')
        views = $views
        favorites = $favorites
        orders = 0
        conversionRate = 0.0
        url = [string](Get-PropertyValue -Object $Listing -Name 'url' -Default '')
        tagsCount = @(Get-ArrayValue -Value (Get-PropertyValue -Object $Listing -Name 'tags' -Default @())).Count
        taxonomyId = [string](Get-PropertyValue -Object $Listing -Name 'taxonomy_id' -Default '')
        priceAmount = [string](Get-PropertyValue -Object (Get-PropertyValue -Object $Listing -Name 'price' -Default $null) -Name 'amount' -Default '')
        lastModified = [string](Get-PropertyValue -Object $Listing -Name 'updated_timestamp' -Default '')
    }
}

function Get-SumValue {
    param([Parameter(Mandatory)]$Items, [Parameter(Mandatory)][string]$Property)
    $measure = @($Items | Measure-Object -Property $Property -Sum)
    if ($measure.Count -eq 0 -or $null -eq $measure[0].Sum) { return 0 }
    return [int]$measure[0].Sum
}

function New-Report {
    param(
        [Parameter(Mandatory)][string]$ReportId,
        [Parameter(Mandatory)][string]$Status,
        [Parameter(Mandatory)]$Summary,
        [Parameter(Mandatory)]$Data,
        [string[]]$Warnings = @()
    )

    return [ordered]@{
        schemaVersion = '1.0.0'
        reportId = $ReportId
        generatedAt = Get-StudioTimestamp
        source = 'services/etsy-intelligence/generate-etsy-intelligence.ps1'
        status = $Status
        summary = $Summary
        data = $Data
        warnings = @($Warnings)
        boundaries = New-EtsyBoundary
    }
}

$generatedAt = Get-StudioTimestamp
$envValues = Read-LocalEnv
$required = @('ETSY_CLIENT_ID', 'ETSY_CLIENT_SECRET', 'ETSY_ACCESS_TOKEN', 'ETSY_REFRESH_TOKEN', 'ETSY_REDIRECT_URI')
$missing = @($required | Where-Object { -not (Test-EnvPresent -Values $envValues -Name $_) })
$boundary = New-EtsyBoundary

if ($missing.Count -gt 0) {
    $summary = [ordered]@{ totalListings = 0; activeListings = 0; views = 0; favorites = 0; orders = 0; conversionRate = 0.0; healthStatus = 'unknown' }
    $warnings = @("Missing Etsy environment variables: $($missing -join ', ')")
    $empty = @()
    Write-StudioJson -RelativePath 'runtime/etsy-intelligence/shop-overview.report.json' -Value (New-Report -ReportId 'etsy-shop-overview' -Status 'missing' -Summary $summary -Data ([ordered]@{ shop = $null }) -Warnings $warnings)
    Write-StudioJson -RelativePath 'runtime/etsy-intelligence/listing-performance.report.json' -Value (New-Report -ReportId 'etsy-listing-performance' -Status 'missing' -Summary $summary -Data ([ordered]@{ listings = $empty }) -Warnings $warnings)
    Write-StudioJson -RelativePath 'runtime/etsy-intelligence/seo-opportunities.report.json' -Value (New-Report -ReportId 'etsy-seo-opportunities' -Status 'missing' -Summary ([ordered]@{ opportunityCount = 0 }) -Data ([ordered]@{ opportunities = $empty }) -Warnings $warnings)
    Write-StudioJson -RelativePath 'runtime/etsy-intelligence/conversion-health.report.json' -Value (New-Report -ReportId 'etsy-conversion-health' -Status 'missing' -Summary $summary -Data ([ordered]@{ weakestListings = $empty }) -Warnings $warnings)
    Write-StudioJson -RelativePath 'runtime/etsy-intelligence/top-products.report.json' -Value (New-Report -ReportId 'etsy-top-products' -Status 'missing' -Summary ([ordered]@{ topProductCount = 0 }) -Data ([ordered]@{ topListings = $empty }) -Warnings $warnings)
    Write-StudioJson -RelativePath 'runtime/dashboard/etsy-intelligence.view.json' -Value ([ordered]@{ schemaVersion = '1.0.0'; generatedAt = $generatedAt; source = 'services/etsy-intelligence/generate-etsy-intelligence.ps1'; status = 'missing'; summary = $summary; cards = @(); boundaries = $boundary; warnings = $warnings })
    Write-Output 'etsy-intelligence: missing'
    exit 0
}

$headers = @{
    'x-api-key' = "$($envValues.ETSY_CLIENT_ID):$($envValues.ETSY_CLIENT_SECRET)"
    Authorization = "Bearer $($envValues.ETSY_ACCESS_TOKEN)"
}
$warningsList = New-Object System.Collections.Generic.List[string]
$status = 'connected'

$userResult = Invoke-EtsyReadJson -Uri 'https://openapi.etsy.com/v3/application/users/me' -Headers $headers
if (-not $userResult.ok) {
    $warningsList.Add('Read-only Etsy user endpoint failed.') | Out-Null
    $status = 'failed'
}

$userId = [string](Get-PropertyValue -Object $userResult.value -Name 'user_id' -Default '')
$shop = $null
$listings = @()
$receipts = @()

if ($status -ne 'failed' -and -not [string]::IsNullOrWhiteSpace($userId)) {
    $shopsResult = Invoke-EtsyReadJson -Uri "https://openapi.etsy.com/v3/application/users/$userId/shops" -Headers $headers
    if ($shopsResult.ok) {
        $shopResults = Get-ArrayValue -Value (Get-PropertyValue -Object $shopsResult.value -Name 'results' -Default $shopsResult.value)
        $shop = @($shopResults | Select-Object -First 1)[0]
    }
    else {
        $warningsList.Add('Read-only Etsy shops endpoint failed.') | Out-Null
        $status = 'degraded'
    }
}
else {
    $warningsList.Add('Etsy user id unavailable from read-only user endpoint.') | Out-Null
    if ($status -ne 'failed') { $status = 'degraded' }
}

$shopId = [string](Get-PropertyValue -Object $shop -Name 'shop_id' -Default '')
if (-not [string]::IsNullOrWhiteSpace($shopId)) {
    $listingResult = Invoke-EtsyReadJson -Uri "https://openapi.etsy.com/v3/application/shops/$shopId/listings/active?limit=100" -Headers $headers
    if ($listingResult.ok) {
        $listings = Get-ArrayValue -Value (Get-PropertyValue -Object $listingResult.value -Name 'results' -Default $listingResult.value)
    }
    else {
        $warningsList.Add('Read-only Etsy active listings endpoint failed.') | Out-Null
        $status = 'degraded'
    }

    $receiptResult = Invoke-EtsyReadJson -Uri "https://openapi.etsy.com/v3/application/shops/$shopId/receipts?limit=100" -Headers $headers
    if ($receiptResult.ok) {
        $receipts = Get-ArrayValue -Value (Get-PropertyValue -Object $receiptResult.value -Name 'results' -Default $receiptResult.value)
    }
    else {
        $warningsList.Add('Read-only Etsy receipts endpoint unavailable; orders default to 0.') | Out-Null
        if ($status -eq 'connected') { $status = 'degraded' }
    }
}
else {
    $warningsList.Add('Etsy shop id unavailable; listing and order reads skipped.') | Out-Null
    if ($status -ne 'failed') { $status = 'degraded' }
}

$listingRows = @($listings | ForEach-Object { New-ListingRow -Listing $_ })
$orderLookup = @{}
foreach ($receipt in @($receipts)) {
    $transactions = Get-ArrayValue -Value (Get-PropertyValue -Object $receipt -Name 'transactions' -Default @())
    foreach ($transaction in $transactions) {
        $listingId = [string](Get-PropertyValue -Object $transaction -Name 'listing_id' -Default '')
        if ([string]::IsNullOrWhiteSpace($listingId)) { continue }
        if (-not $orderLookup.ContainsKey($listingId)) { $orderLookup[$listingId] = 0 }
        $orderLookup[$listingId]++
    }
}

foreach ($row in $listingRows) {
    if ($orderLookup.ContainsKey($row.listingId)) { $row.orders = [int]$orderLookup[$row.listingId] }
    $row.conversionRate = if ($row.views -gt 0) { [math]::Round(([double]$row.orders / [double]$row.views) * 100, 2) } else { 0.0 }
}

$totalListings = $listingRows.Count
$activeListings = @($listingRows | Where-Object { $_.state -eq 'active' -or $_.state -eq 'unknown' }).Count
$totalViews = Get-SumValue -Items $listingRows -Property 'views'
$totalFavorites = Get-SumValue -Items $listingRows -Property 'favorites'
$totalOrders = Get-SumValue -Items $listingRows -Property 'orders'
$conversionRate = if ($totalViews -gt 0) { [math]::Round(([double]$totalOrders / [double]$totalViews) * 100, 2) } else { 0.0 }
$healthStatus = if ($totalListings -eq 0) { 'unknown' } elseif ($conversionRate -ge 2) { 'healthy' } elseif ($conversionRate -gt 0) { 'watch' } else { 'weak' }

$summary = [ordered]@{
    totalListings = $totalListings
    activeListings = $activeListings
    views = $totalViews
    favorites = $totalFavorites
    orders = $totalOrders
    conversionRate = $conversionRate
    healthStatus = $healthStatus
}

$topListings = @($listingRows | Sort-Object -Property @{ Expression = 'orders'; Descending = $true }, @{ Expression = 'views'; Descending = $true }, @{ Expression = 'favorites'; Descending = $true } | Select-Object -First 10)
$weakestListings = @($listingRows | Sort-Object -Property @{ Expression = 'conversionRate'; Descending = $false }, @{ Expression = 'views'; Descending = $true } | Select-Object -First 10)
$opportunities = New-Object System.Collections.Generic.List[object]
foreach ($row in $listingRows) {
    if ($row.views -ge 20 -and $row.orders -eq 0) {
        $opportunities.Add([ordered]@{ opportunityId = "etsy-seo.$($row.listingId).views-no-orders"; listingId = $row.listingId; title = $row.title; severity = 'high'; reason = 'Listing has views but no attributed orders in the read-only sample.'; recommendation = 'Review title, tags, thumbnail, price, and offer positioning manually before making any Etsy change.' }) | Out-Null
    }
    elseif ($row.favorites -gt 0 -and $row.orders -eq 0) {
        $opportunities.Add([ordered]@{ opportunityId = "etsy-seo.$($row.listingId).favorites-no-orders"; listingId = $row.listingId; title = $row.title; severity = 'medium'; reason = 'Listing receives favorites without sampled orders.'; recommendation = 'Review buyer intent and listing conversion context manually.' }) | Out-Null
    }
    if ($row.tagsCount -gt 0 -and $row.tagsCount -lt 13) {
        $opportunities.Add([ordered]@{ opportunityId = "etsy-seo.$($row.listingId).tag-count"; listingId = $row.listingId; title = $row.title; severity = 'low'; reason = 'Listing appears to use fewer than 13 tags in read-only metadata.'; recommendation = 'Manually assess whether additional relevant tags are warranted.' }) | Out-Null
    }
}

$shopOverviewData = [ordered]@{
    shop = if ($null -eq $shop) { $null } else { [ordered]@{ shopId = $shopId; shopName = [string](Get-PropertyValue -Object $shop -Name 'shop_name' -Default ''); listingActiveCount = [int](Get-PropertyValue -Object $shop -Name 'listing_active_count' -Default $activeListings) } }
}

Write-StudioJson -RelativePath 'runtime/etsy-intelligence/shop-overview.report.json' -Value (New-Report -ReportId 'etsy-shop-overview' -Status $status -Summary $summary -Data $shopOverviewData -Warnings @($warningsList))
Write-StudioJson -RelativePath 'runtime/etsy-intelligence/listing-performance.report.json' -Value (New-Report -ReportId 'etsy-listing-performance' -Status $status -Summary $summary -Data ([ordered]@{ listings = $listingRows }) -Warnings @($warningsList))
Write-StudioJson -RelativePath 'runtime/etsy-intelligence/seo-opportunities.report.json' -Value (New-Report -ReportId 'etsy-seo-opportunities' -Status $status -Summary ([ordered]@{ opportunityCount = $opportunities.Count; highSeverity = @($opportunities | Where-Object { $_.severity -eq 'high' }).Count; mediumSeverity = @($opportunities | Where-Object { $_.severity -eq 'medium' }).Count; lowSeverity = @($opportunities | Where-Object { $_.severity -eq 'low' }).Count }) -Data ([ordered]@{ opportunities = $opportunities.ToArray() }) -Warnings @($warningsList))
Write-StudioJson -RelativePath 'runtime/etsy-intelligence/conversion-health.report.json' -Value (New-Report -ReportId 'etsy-conversion-health' -Status $status -Summary $summary -Data ([ordered]@{ weakestListings = $weakestListings }) -Warnings @($warningsList))
Write-StudioJson -RelativePath 'runtime/etsy-intelligence/top-products.report.json' -Value (New-Report -ReportId 'etsy-top-products' -Status $status -Summary ([ordered]@{ topProductCount = @($topListings).Count }) -Data ([ordered]@{ topListings = $topListings }) -Warnings @($warningsList))

$cards = @(
    [ordered]@{ id = 'etsy.total-listings'; title = 'Total listings'; value = $totalListings; severity = 'info' }
    [ordered]@{ id = 'etsy.active-listings'; title = 'Active listings'; value = $activeListings; severity = 'success' }
    [ordered]@{ id = 'etsy.views'; title = 'Views'; value = $totalViews; severity = 'info' }
    [ordered]@{ id = 'etsy.favorites'; title = 'Favorites'; value = $totalFavorites; severity = 'info' }
    [ordered]@{ id = 'etsy.orders'; title = 'Orders'; value = $totalOrders; severity = 'info' }
    [ordered]@{ id = 'etsy.conversion-rate'; title = 'Conversion rate'; value = $conversionRate; unit = 'percent'; severity = $(if ($healthStatus -eq 'healthy') { 'success' } elseif ($healthStatus -eq 'watch') { 'warning' } else { 'error' }) }
    [ordered]@{ id = 'etsy.shop-health'; title = 'Shop health'; value = $healthStatus; severity = $(if ($healthStatus -eq 'healthy') { 'success' } elseif ($healthStatus -eq 'watch') { 'warning' } else { 'error' }) }
)

$view = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $generatedAt
    source = 'services/etsy-intelligence/generate-etsy-intelligence.ps1'
    sourceReports = @(
        'runtime/etsy-intelligence/shop-overview.report.json',
        'runtime/etsy-intelligence/listing-performance.report.json',
        'runtime/etsy-intelligence/seo-opportunities.report.json',
        'runtime/etsy-intelligence/conversion-health.report.json',
        'runtime/etsy-intelligence/top-products.report.json'
    )
    status = $status
    summary = $summary
    cards = $cards
    topListings = @($topListings)
    weakestListings = @($weakestListings)
    seoOpportunities = @($opportunities.ToArray() | Select-Object -First 20)
    shopHealth = [ordered]@{ healthStatus = $healthStatus; reason = 'Derived from read-only listing, view, favorite, and sampled order metrics.' }
    boundaries = $boundary
    warnings = @($warningsList)
}
Write-StudioJson -RelativePath 'runtime/dashboard/etsy-intelligence.view.json' -Value $view
Write-Output "etsy-intelligence: $status"
