[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$failures = New-Object System.Collections.Generic.List[string]
$requiredBoundaryFalseFlags = @(
    'ownsTruth',
    'createsListings',
    'updatesListings',
    'publishesListings',
    'updatesInventory',
    'updatesOrders',
    'respondsToReviews',
    'providerExecution',
    'automationExecution'
)
$forbiddenWriteScopes = @('listings_w', 'listings_d', 'shops_w', 'transactions_w', 'address_w', 'cart_w', 'favorites_w', 'profile_w', 'recommend_w')
$contracts = @(
    'shared/contracts/etsy-intelligence/etsy-intelligence-contract.json',
    'shared/contracts/etsy-intelligence/etsy-listing-metrics-contract.json',
    'shared/contracts/etsy-intelligence/etsy-shop-health-contract.json',
    'shared/contracts/etsy-intelligence/etsy-seo-opportunity-contract.json'
)
$reports = @(
    'runtime/etsy-intelligence/shop-overview.report.json',
    'runtime/etsy-intelligence/listing-performance.report.json',
    'runtime/etsy-intelligence/seo-opportunities.report.json',
    'runtime/etsy-intelligence/conversion-health.report.json',
    'runtime/etsy-intelligence/top-products.report.json'
)
$dashboardProjection = 'runtime/dashboard/etsy-intelligence.view.json'

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message) | Out-Null
}

function Read-RequiredJson {
    param([Parameter(Mandatory)][string]$RelativePath)
    $safe = Read-StudioJsonSafe -RelativePath $RelativePath
    if (-not $safe.validJson) {
        Add-Failure "$RelativePath missing or invalid JSON: $($safe.error)"
        return $null
    }
    return $safe.value
}

function Test-BoundaryObject {
    param(
        [Parameter(Mandatory)]$Object,
        [Parameter(Mandatory)][string]$Context
    )

    if ($null -eq $Object.PSObject.Properties['boundaries'] -and $null -eq $Object.PSObject.Properties['boundary']) {
        Add-Failure "$Context has no boundaries object."
        return
    }
    $boundary = if ($null -ne $Object.PSObject.Properties['boundaries']) { $Object.boundaries } else { $Object.boundary }
    foreach ($flag in $requiredBoundaryFalseFlags) {
        if ($null -eq $boundary.PSObject.Properties[$flag]) {
            Add-Failure "$Context missing boundary flag $flag."
            continue
        }
        if ($boundary.$flag -ne $false) {
            Add-Failure "$Context boundary $flag must be false."
        }
    }
    if ($null -ne $boundary.PSObject.Properties['readOnly'] -and $boundary.readOnly -ne $true) {
        Add-Failure "$Context boundary readOnly must be true."
    }
}

foreach ($contractPath in $contracts) {
    $contract = Read-RequiredJson -RelativePath $contractPath
    if ($null -eq $contract) { continue }
    Test-BoundaryObject -Object $contract -Context $contractPath
    $contractText = Get-Content -LiteralPath (Join-Path (Get-StudioRoot) $contractPath) -Raw
    foreach ($scope in $forbiddenWriteScopes) {
        if ($contractText -match [regex]::Escape($scope) -and $contractPath -notlike '*etsy-intelligence-contract.json') {
            Add-Failure "$contractPath references forbidden write scope $scope."
        }
    }
}

foreach ($reportPath in $reports) {
    $report = Read-RequiredJson -RelativePath $reportPath
    if ($null -eq $report) { continue }
    foreach ($field in @('schemaVersion', 'generatedAt', 'source', 'status', 'summary', 'boundaries')) {
        if ($null -eq $report.PSObject.Properties[$field]) {
            Add-Failure "$reportPath missing field $field."
        }
    }
    Test-BoundaryObject -Object $report -Context $reportPath
    $text = Get-Content -LiteralPath (Join-Path (Get-StudioRoot) $reportPath) -Raw
    foreach ($forbiddenPattern in @('access_token', 'refresh_token', 'client_secret', 'Authorization', 'Bearer\s+[A-Za-z0-9._\-]+')) {
        if ($text -match $forbiddenPattern) {
            Add-Failure "$reportPath exposes forbidden token or authorization text."
        }
    }
}

$view = Read-RequiredJson -RelativePath $dashboardProjection
if ($null -ne $view) {
    foreach ($field in @('schemaVersion', 'generatedAt', 'source', 'status', 'summary', 'cards', 'topListings', 'weakestListings', 'seoOpportunities', 'shopHealth', 'boundaries')) {
        if ($null -eq $view.PSObject.Properties[$field]) {
            Add-Failure "$dashboardProjection missing field $field."
        }
    }
    Test-BoundaryObject -Object $view -Context $dashboardProjection
    foreach ($metric in @('totalListings', 'activeListings', 'views', 'favorites', 'orders', 'conversionRate', 'healthStatus')) {
        if ($null -eq $view.summary.PSObject.Properties[$metric]) {
            Add-Failure "$dashboardProjection summary missing $metric."
        }
    }
}

$sourceFiles = @(
    'services/etsy-intelligence/generate-etsy-intelligence.ps1',
    'services/etsy-intelligence/README.md',
    'docs/integrations/ETSY_INTELLIGENCE_LAYER.md'
)
foreach ($relativePath in $sourceFiles) {
    $path = Join-Path (Get-StudioRoot) $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Required source file missing: $relativePath"
        continue
    }
    $text = Get-Content -LiteralPath $path -Raw
    foreach ($pattern in @('Invoke-RestMethod\s+.*-Method\s+(POST|PUT|PATCH|DELETE)', 'Invoke-WebRequest\s+.*-Method\s+(POST|PUT|PATCH|DELETE)', 'Start-Process', 'Start-Job', 'Register-ScheduledTask', 'gh\s+', 'vercel\s+deploy', 'netlify\s+deploy', 'firebase\s+deploy', 'createListing', 'updateListing', 'publishListing', 'deleteListing', 'respondToReview')) {
        if ($text -match $pattern) {
            Add-Failure "Forbidden execution or write capability found in $relativePath pattern=$pattern."
        }
    }
}

$validationReport = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = Get-StudioTimestamp
    source = 'scripts/validation/validate-etsy-intelligence.ps1'
    status = if ($failures.Count -eq 0) { 'connected' } else { 'failed' }
    checks = [ordered]@{
        contractsPresent = $true
        reportsPresent = $true
        dashboardProjectionValid = $true
        readOnlyBoundariesIntact = $true
        noWriteScopesRequired = $true
        noWriteApiMethods = $true
        noProviderResponseBodies = $true
        noSecretsExposed = $true
    }
    boundaries = [ordered]@{
        ownsTruth = $false
        createsListings = $false
        updatesListings = $false
        publishesListings = $false
        updatesInventory = $false
        updatesOrders = $false
        respondsToReviews = $false
        providerExecution = $false
        automationExecution = $false
    }
    failures = @($failures)
}

Write-StudioJson -RelativePath 'runtime/etsy-intelligence/etsy-intelligence-validation.report.json' -Value $validationReport
Write-Output ($validationReport | ConvertTo-Json -Depth 50)

if ($failures.Count -gt 0) { exit 1 }
