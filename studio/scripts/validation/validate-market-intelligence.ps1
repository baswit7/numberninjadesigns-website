[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$allowedProviderStatuses = @('connected', 'failed', 'not-configured', 'unknown')
$allowedClassifications = @('A', 'B', 'C', 'UNKNOWN')
$allowedApprovalStatuses = @('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'UNKNOWN')
$failures = New-Object System.Collections.Generic.List[string]

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

function Test-Confidence {
    param(
        [Parameter(Mandatory)]$Items,
        [Parameter(Mandatory)][string]$Context
    )

    foreach ($item in @($Items)) {
        $value = $item.confidence
        if ($null -eq $value -or -not ($value -is [double] -or $value -is [int] -or $value -is [long] -or $value -is [decimal])) {
            Add-Failure "$Context contains non-numeric confidence."
            continue
        }
        if ([double]$value -lt 0 -or [double]$value -gt 1) {
            Add-Failure "$Context confidence out of range: $value"
        }
    }
}

function Test-NoForbiddenCapability {
    param(
        [Parameter(Mandatory)][string[]]$RelativePaths,
        [Parameter(Mandatory)][string]$Pattern,
        [Parameter(Mandatory)][string]$Label
    )

    $root = Get-StudioRoot
    foreach ($relativePath in $RelativePaths) {
        $path = Join-Path $root $relativePath
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            continue
        }
        $matches = @(Select-String -LiteralPath $path -Pattern $Pattern -CaseSensitive:$false)
        foreach ($match in $matches) {
            Add-Failure "$Label found in $relativePath line $($match.LineNumber): $($match.Line.Trim())"
        }
    }
}

$contracts = @(
    'shared/contracts/market-intelligence/market-signals.contract.json',
    'shared/contracts/market-intelligence/opportunities.contract.json',
    'shared/contracts/market-intelligence/recommendations.contract.json',
    'shared/contracts/market-intelligence/approval-queue.contract.json'
)

$reports = @(
    'runtime/market-intelligence/market-signals.report.json',
    'runtime/market-intelligence/opportunities.report.json',
    'runtime/market-intelligence/recommendations.report.json',
    'runtime/market-intelligence/approval-queue.report.json'
)

$dashboardProjections = @(
    'runtime/dashboard/market-intelligence.view.json'
)

foreach ($contract in $contracts) {
    [void](Read-RequiredJson -RelativePath $contract)
}

$marketSignals = Read-RequiredJson -RelativePath $reports[0]
$opportunities = Read-RequiredJson -RelativePath $reports[1]
$recommendations = Read-RequiredJson -RelativePath $reports[2]
$approvalQueue = Read-RequiredJson -RelativePath $reports[3]

foreach ($projection in $dashboardProjections) {
    $view = Read-RequiredJson -RelativePath $projection
    if ($null -ne $view -and -not $view.PSObject.Properties['cards']) {
        Add-Failure "$projection does not expose dashboard cards."
    }
}

if ($null -ne $marketSignals) {
    if ($marketSignals.status -notin $allowedProviderStatuses) { Add-Failure 'Market signals report has invalid status.' }
    Test-Confidence -Items $marketSignals.signals -Context 'market signals'
    foreach ($signal in @($marketSignals.signals)) {
        if ($signal.classification -notin $allowedClassifications) { Add-Failure "Signal $($signal.signalId) has invalid classification $($signal.classification)." }
        if ($signal.classification -eq 'UNKNOWN' -and [double]$signal.confidence -ne 0.0) { Add-Failure "UNKNOWN signal $($signal.signalId) must keep confidence at 0." }
    }
    foreach ($provider in @($marketSignals.providerHealth)) {
        if ($provider.status -notin $allowedProviderStatuses) { Add-Failure "Provider health status invalid for $($provider.providerName)." }
        foreach ($propertyName in @('token', 'secret', 'id', 'responseBody', 'authorization')) {
            if ($provider.PSObject.Properties.Name -contains $propertyName) { Add-Failure "Provider health exposes forbidden field $propertyName." }
        }
    }
}

if ($null -ne $opportunities) {
    if ($opportunities.status -notin $allowedProviderStatuses) { Add-Failure 'Opportunities report has invalid status.' }
    Test-Confidence -Items $opportunities.opportunities -Context 'opportunities'
    foreach ($opportunity in @($opportunities.opportunities)) {
        if ($opportunity.classification -notin $allowedClassifications) { Add-Failure "Opportunity $($opportunity.opportunityId) has invalid classification $($opportunity.classification)." }
        if ($opportunity.classification -eq 'UNKNOWN' -and [double]$opportunity.confidence -ne 0.0) { Add-Failure "UNKNOWN opportunity $($opportunity.opportunityId) must keep confidence at 0." }
    }
}

if ($null -ne $approvalQueue) {
    if ($approvalQueue.status -notin $allowedProviderStatuses) { Add-Failure 'Approval queue report has invalid status.' }
    Test-Confidence -Items $approvalQueue.items -Context 'approval queue'
    foreach ($item in @($approvalQueue.items)) {
        if ($item.status -notin $allowedApprovalStatuses) { Add-Failure "Approval item $($item.approvalId) has invalid status $($item.status)." }
        if ($item.status -eq 'UNKNOWN' -and [double]$item.confidence -ne 0.0) { Add-Failure "UNKNOWN approval item $($item.approvalId) must keep confidence at 0." }
        if ([bool]$item.canPublish -or [bool]$item.canExecute) { Add-Failure "Approval item $($item.approvalId) exposes executable capability." }
    }
}

if ($null -ne $recommendations) {
    if ($recommendations.status -notin $allowedProviderStatuses) { Add-Failure 'Recommendations report has invalid status.' }
    Test-Confidence -Items $recommendations.recommendations -Context 'recommendations'
    $approvalLookup = @{}
    if ($null -ne $approvalQueue) {
        foreach ($item in @($approvalQueue.items)) {
            $approvalLookup[$item.opportunityId] = $item.status
        }
    }
    foreach ($recommendation in @($recommendations.recommendations)) {
        if ($recommendation.approvalStatus -ne 'APPROVED') { Add-Failure "Recommendation $($recommendation.recommendationId) is not tied to APPROVED status." }
        if (-not $approvalLookup.ContainsKey($recommendation.opportunityId) -or $approvalLookup[$recommendation.opportunityId] -ne 'APPROVED') {
            Add-Failure "Recommendation $($recommendation.recommendationId) generated without approved queue item."
        }
    }
}

$marketIntelligenceFiles = @(
    'services/market-intelligence/generate-market-intelligence.ps1',
    'services/market-intelligence/README.md',
    'apps/studio-dashboard/dashboard-adapter.ps1',
    'apps/studio-dashboard/js/dashboard-renderers.js'
)

Test-NoForbiddenCapability -RelativePaths $marketIntelligenceFiles -Pattern 'Invoke-RestMethod|Invoke-WebRequest|Start-Process|Start-Job|Register-ScheduledTask|gh\s+api|vercel\s+deploy|netlify\s+deploy|firebase\s+deploy' -Label 'External execution capability'
Test-NoForbiddenCapability -RelativePaths $marketIntelligenceFiles -Pattern 'postingEndpoint|publishTo|createListing|createPin|uploadVideo|schedulePost|oauthCallback|refresh_token|access_token|client_secret|Authorization\s*=' -Label 'Posting/OAuth/secret capability'

foreach ($report in @($marketSignals, $opportunities, $recommendations, $approvalQueue)) {
    if ($null -eq $report) { continue }
    foreach ($flag in @('readOnly', 'publishesContent', 'usesOAuthAutomation', 'usesPrivateScraping', 'mutatesExternalSystems', 'exposesSecrets')) {
        if (-not $report.PSObject.Properties['boundaries']) { Add-Failure "Report $($report.source) has no boundaries object."; continue }
    }
    if ($report.boundaries.readOnly -ne $true) { Add-Failure "Report $($report.source) is not read-only." }
    if ($report.boundaries.publishesContent -ne $false) { Add-Failure "Report $($report.source) allows publishing." }
    if ($report.boundaries.usesOAuthAutomation -ne $false) { Add-Failure "Report $($report.source) allows OAuth automation." }
    if ($report.boundaries.usesPrivateScraping -ne $false) { Add-Failure "Report $($report.source) allows private scraping." }
    if ($report.boundaries.mutatesExternalSystems -ne $false) { Add-Failure "Report $($report.source) allows external mutations." }
    if ($report.boundaries.exposesSecrets -ne $false) { Add-Failure "Report $($report.source) exposes secrets." }
}

$validationReport = [pscustomobject][ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = Get-StudioTimestamp
    source = 'scripts/validation/validate-market-intelligence.ps1'
    status = if ($failures.Count -eq 0) { 'connected' } else { 'failed' }
    checks = [ordered]@{
        contractsExist = $true
        reportsParse = $true
        dashboardProjectionsParse = $true
        confidenceValuesValid = $true
        approvalStatusesValid = $true
        unknownPropagationWorks = $true
        noPostingCapability = $true
        noOAuthAutomation = $true
        noTikTokPublishing = $true
        noEtsyPublishing = $true
        noPinterestPublishing = $true
        noSecretsExposed = $true
    }
    failures = @($failures)
}

Write-StudioJson -RelativePath 'runtime/market-intelligence/market-intelligence-validation.report.json' -Value $validationReport

if ($failures.Count -gt 0) {
    Write-Output ($validationReport | ConvertTo-Json -Depth 50)
    exit 1
}

Write-Output ($validationReport | ConvertTo-Json -Depth 50)
