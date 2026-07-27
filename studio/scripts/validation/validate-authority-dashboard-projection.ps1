[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]
$checks = New-Object System.Collections.Generic.List[object]

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message) | Out-Null
}

function Read-ProjectionJson {
    param([Parameter(Mandatory)][string]$RelativePath)

    try {
        return Read-StudioJson -RelativePath $RelativePath
    }
    catch {
        Add-Failure "$RelativePath could not be read as JSON. $($_.Exception.Message)"
        return $null
    }
}

function Test-RequiredFields {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string[]]$RequiredFields,
        [Parameter(Mandatory)][string]$Label
    )

    foreach ($field in $RequiredFields) {
        $property = $Value.PSObject.Properties[$field]
        if ($null -eq $property -or $null -eq $property.Value) {
            Add-Failure "$Label misses required field '$field'."
            continue
        }
        if ($property.Value -is [string] -and [string]::IsNullOrWhiteSpace($property.Value)) {
            Add-Failure "$Label misses required field '$field'."
        }
    }
}

& (Join-Path $PSScriptRoot 'validate-authority-control-plane.ps1') | Out-Null
& (Join-Path $PSScriptRoot 'validate-authority-read-model.ps1') | Out-Null

$requiredPaths = @(
    'runtime/dashboard/authority.view.json',
    'apps/studio-dashboard/dashboard-adapter.ps1',
    'apps/studio-dashboard/index.html',
    'apps/studio-dashboard/js/dashboard-loader.js',
    'apps/studio-dashboard/js/dashboard-state.js',
    'apps/studio-dashboard/js/dashboard-renderers.js',
    'apps/studio-dashboard/js/dashboard.js',
    'docs/governance/AUTHORITY_DASHBOARD_PROJECTION.md',
    'docs/governance/PHASE_17_AUTHORITY_DASHBOARD_PROJECTION.md',
    'docs/governance/PHASE_17_BOUNDARY_AUDIT.md'
)

foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        Add-Failure "Required Phase 17 authority dashboard artifact missing: $relativePath"
    }
}

$authorityView = Read-ProjectionJson -RelativePath 'runtime/dashboard/authority.view.json'
$readModel = Read-ProjectionJson -RelativePath 'runtime/authority/authority-read-model.report.json'
$queryResponses = Read-ProjectionJson -RelativePath 'runtime/authority/authority-query-responses.report.json'

if ($null -ne $authorityView -and $null -ne $readModel -and $null -ne $queryResponses) {
    Test-RequiredFields -Value $authorityView -RequiredFields @('generatedAt', 'source', 'status', 'summary', 'cards', 'warnings', 'errors', 'nextRecommendedAction') -Label 'Authority dashboard view'
    if ($authorityView.source -ne 'studio-dashboard:authority') {
        Add-Failure 'Authority dashboard view source must be studio-dashboard:authority.'
    }
    $cards = @($authorityView.cards)
    if ($cards.Count -eq 0) {
        Add-Failure 'Authority dashboard view must contain safe read-only cards or a safe empty-state card.'
    }
    $summaryCard = @($cards | Where-Object { $_.id -eq 'authority.summary' })
    if ($summaryCard.Count -ne 1) {
        Add-Failure 'Authority dashboard view must include one authority.summary card.'
    }
    foreach ($card in $cards) {
        Test-RequiredFields -Value $card -RequiredFields @('id', 'title', 'status', 'severity', 'description', 'sourceFile', 'actionHint', 'details') -Label "Authority dashboard card '$($card.id)'"
        if ($card.sourceFile -notlike 'runtime/authority/*.json') {
            Add-Failure "Authority dashboard card '$($card.id)' must source from runtime/authority/*.json."
        }
        if ($card.details.PSObject.Properties['canExecute'] -and $card.details.canExecute -ne $false) {
            Add-Failure "Authority dashboard card '$($card.id)' must keep canExecute=false."
        }
        if ($card.details.PSObject.Properties['canMutate'] -and $card.details.canMutate -ne $false) {
            Add-Failure "Authority dashboard card '$($card.id)' must keep canMutate=false."
        }
    }
    foreach ($requiredDenied in @('provider.invoke', 'deployment.start', 'execution.run', 'credential.read', 'secret.write', 'github.repo.write')) {
        $match = @($cards | Where-Object { $_.details.PSObject.Properties['authorityId'] -and $_.details.authorityId -eq $requiredDenied -and $_.details.decision -eq 'DENY' })
        if ($match.Count -ne 1) {
            Add-Failure "Authority dashboard view must expose denied authority '$requiredDenied'."
        }
    }
    if ($summaryCard.Count -eq 1) {
        if ($summaryCard[0].details.authorityCount -ne $readModel.summary.authorityCount) {
            Add-Failure 'Authority dashboard summary authorityCount must match Phase 16 read model.'
        }
        if ($summaryCard[0].details.queryResponseCount -ne @($queryResponses.responses).Count) {
            Add-Failure 'Authority dashboard summary queryResponseCount must match Phase 16 query responses.'
        }
        if ($summaryCard[0].details.ownsAuthority -ne $false) {
            Add-Failure 'Authority dashboard summary must keep ownsAuthority=false.'
        }
    }
    $checks.Add([ordered]@{ id = 'authority-dashboard-view'; status = 'checked'; cards = $cards.Count }) | Out-Null
}

$textChecks = @(
    [pscustomobject]@{ path = 'apps/studio-dashboard/dashboard-adapter.ps1'; required = @('New-AuthorityView', 'runtime/authority/authority-read-model.report.json', 'runtime/dashboard/authority.view.json') },
    [pscustomobject]@{ path = 'apps/studio-dashboard/js/dashboard-loader.js'; required = @('authority.view.json') },
    [pscustomobject]@{ path = 'apps/studio-dashboard/js/dashboard-state.js'; required = @('"authority"') },
    [pscustomobject]@{ path = 'apps/studio-dashboard/js/dashboard-renderers.js'; required = @('renderAuthorityCenter') },
    [pscustomobject]@{ path = 'apps/studio-dashboard/js/dashboard.js'; required = @('renderAuthorityCenter', 'authority-module') },
    [pscustomobject]@{ path = 'apps/studio-dashboard/index.html'; required = @('authority-module', 'Authority Dashboard Projection') }
)

foreach ($check in $textChecks) {
    $fullPath = Join-Path $root $check.path
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        continue
    }
    $content = Get-Content -LiteralPath $fullPath -Raw
    foreach ($required in $check.required) {
        if ($content -notlike "*$required*") {
            Add-Failure "$($check.path) must include '$required'."
        }
    }
}
$checks.Add([ordered]@{ id = 'dashboard-integration-paths'; status = 'checked'; files = $textChecks.Count }) | Out-Null

$phase17Files = @(
    'runtime/dashboard/authority.view.json',
    'apps/studio-dashboard/dashboard-adapter.ps1',
    'apps/studio-dashboard/index.html',
    'apps/studio-dashboard/js/dashboard-loader.js',
    'apps/studio-dashboard/js/dashboard-state.js',
    'apps/studio-dashboard/js/dashboard-renderers.js',
    'apps/studio-dashboard/js/dashboard.js',
    'scripts/validation/validate-authority-dashboard-projection.ps1',
    'docs/governance/AUTHORITY_DASHBOARD_PROJECTION.md',
    'docs/governance/PHASE_17_AUTHORITY_DASHBOARD_PROJECTION.md',
    'docs/governance/PHASE_17_BOUNDARY_AUDIT.md'
)

$forbiddenPatterns = @(
    ('Invoke-' + 'RestMethod'),
    ('Invoke-' + 'WebRequest'),
    ('Start-' + 'Process'),
    ('Start-' + 'Job'),
    ('Register-' + 'ScheduledTask'),
    'gh\s+api',
    'gh\s+pr',
    'git\s+push',
    'vercel\s+deploy',
    'netlify\s+deploy',
    'firebase\s+deploy',
    ('New-' + 'StoredCredential'),
    ('Set-' + 'StoredCredential'),
    ('local' + 'Storage'),
    ('session' + 'Storage'),
    '"apiKey"\s*:',
    '"accessToken"\s*:',
    '"refreshToken"\s*:',
    '"clientSecret"\s*:',
    '"credentialValue"\s*:',
    '"secretValue"\s*:'
)

foreach ($relativePath in $phase17Files) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }
    foreach ($pattern in $forbiddenPatterns) {
        $match = Select-String -LiteralPath $path -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($match) {
            Add-Failure "Forbidden Phase 17 capability pattern '$pattern' in $relativePath line $($match.LineNumber)."
        }
    }
}
$checks.Add([ordered]@{ id = 'phase-17-forbidden-pattern-scan'; status = 'checked'; files = $phase17Files.Count }) | Out-Null

$reportStatus = 'failed'
$reportSummary = "Authority dashboard projection validation failed with $($failures.Count) issue(s)."
if ($failures.Count -eq 0) {
    $reportStatus = 'passed'
    $reportSummary = 'Authority dashboard projection passed deterministic read-only boundary checks.'
}

$report = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-17'
    reportId = 'authority-dashboard-projection-validation'
    status = $reportStatus
    summary = $reportSummary
    checks = $checks.ToArray()
    failures = $failures.ToArray()
    boundary = [ordered]@{
        machineReadableReportOnly = $true
        dashboardReadOnly = $true
        derivedOnly = $true
        ownsAuthority = $false
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        credentialAccessAllowed = $false
        secretAccessAllowed = $false
        runtimeMutationAllowed = $false
        approvalAutomationAllowed = $false
    }
}

Write-StudioJson -RelativePath 'runtime/dashboard/authority-dashboard-validation.report.json' -Value $report

if ($failures.Count -gt 0) {
    Write-Host 'Phase 17 authority dashboard projection validation failed.' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'Phase 17 authority dashboard projection passed deterministic checks.' -ForegroundColor Green
exit 0
