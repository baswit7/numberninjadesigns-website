[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]
$generatorRelativePath = 'services/dashboard-adapter/generate-execution-control-dashboard.ps1'
$viewRelativePath = 'runtime/dashboard/execution-control.view.json'
$requiredSources = @(
    'runtime/execution-request/execution-request.packages.json',
    'runtime/execution-request/execution-request.report.json',
    'runtime/approval/execution-approval.records.json',
    'runtime/approval/execution-approval.report.json',
    'runtime/execution-preflight/execution-preflight.decisions.json',
    'runtime/execution-preflight/execution-preflight.report.json',
    'runtime/execution-review/execution-review.records.json',
    'runtime/execution-review/execution-review.report.json',
    'runtime/execution-dispatch/execution-dispatch.registry.json',
    'runtime/execution-dispatch/execution-dispatch.report.json',
    'runtime/execution-audit/audit.report.json',
    'runtime/execution-audit/audit.summary.json',
    'runtime/execution-audit/audit.boundary.json'
)
$requiredViewFields = @('schemaVersion', 'generatedAt', 'source', 'sourceFiles', 'status', 'readOnly', 'projectionOnly', 'ownsTruth', 'summary', 'statusSummary', 'auditSummary', 'evidenceSummary', 'unknownSummary', 'boundarySummary', 'cards', 'warnings', 'errors', 'nextRecommendedAction')

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message) | Out-Null
}

function Read-JsonForValidation {
    param([Parameter(Mandatory)][string]$RelativePath)

    $path = Join-Path $root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Required JSON file missing: $RelativePath"
        return $null
    }
    try {
        return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    }
    catch {
        Add-Failure "Invalid JSON in $RelativePath. $($_.Exception.Message)"
        return $null
    }
}

function Test-RequiredFields {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string[]]$Fields,
        [Parameter(Mandatory)][string]$Context
    )

    foreach ($field in $Fields) {
        $property = $Value.PSObject.Properties[$field]
        if ($null -eq $property -or $null -eq $property.Value) {
            Add-Failure "$Context misses required field '$field'."
            continue
        }
        if ($property.Value -is [string] -and [string]::IsNullOrWhiteSpace($property.Value)) {
            Add-Failure "$Context misses required field '$field'."
        }
    }
}

function Test-BoundarySummary {
    param([Parameter(Mandatory)]$Boundary)

    $expected = @{
        readOnlyDashboard = $true
        visualizationOnly = $true
        ownsTruth = $false
        ownsExecutionTruth = $false
        ownsApprovalTruth = $false
        ownsPreflightTruth = $false
        ownsReviewTruth = $false
        ownsDispatchTruth = $false
        ownsAuditTruth = $false
        performsExecution = $false
        executionEngine = $false
        dispatchEngine = $false
        providerExecution = $false
        githubExecution = $false
        deploymentExecution = $false
        approvalMutation = $false
        dispatchMutation = $false
        runtimeMutation = $false
        queues = $false
        workers = $false
        schedulers = $false
        backgroundJobs = $false
        agentExecution = $false
        credentialAccess = $false
        secretAccess = $false
        branchWrites = $false
        repositorySettingsMutation = $false
        collaboratorMutation = $false
        localStorageAuthority = $false
        sessionStorageAuthority = $false
        actionEndpoints = $false
        actionControls = $false
        consumesReportsOnly = $true
    }

    foreach ($key in $expected.Keys) {
        $property = $Boundary.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $expected[$key]) {
            Add-Failure "Execution dashboard boundary '$key' must be $($expected[$key])."
        }
    }
    if ($Boundary.writesOnly -ne 'runtime/dashboard/execution-control.view.json') {
        Add-Failure 'Execution dashboard must write only runtime/dashboard/execution-control.view.json.'
    }
}

foreach ($source in $requiredSources) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $source) -PathType Leaf)) {
        Add-Failure "Execution dashboard source report missing: $source"
    }
}

$generatorPath = Join-Path $root $generatorRelativePath
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure "Execution dashboard generator missing: $generatorRelativePath"
}
if ($failures.Count -eq 0) {
    & $generatorPath | Out-Null
}

$view = Read-JsonForValidation -RelativePath $viewRelativePath
if ($null -ne $view) {
    Test-RequiredFields -Value $view -Fields $requiredViewFields -Context 'Execution control dashboard view'
    if ($view.readOnly -ne $true -or $view.projectionOnly -ne $true -or $view.ownsTruth -ne $false) {
        Add-Failure 'Execution control dashboard must be read-only, projection-only and own no truth.'
    }
    foreach ($source in $requiredSources) {
        if ($source -notin @($view.sourceFiles.PSObject.Properties.Value)) {
            Add-Failure "Execution control dashboard does not consume required report: $source"
        }
    }
    Test-RequiredFields -Value $view.summary -Fields @('totalRequests', 'approvedRequests', 'pendingRequests', 'blockedRequests', 'unknownRequests', 'dispatchEligible', 'dispatchDenied', 'manualEvidenceRequired', 'manualEvidencePresent', 'manualEvidenceVerified', 'unknownCount') -Context 'Execution control dashboard summary'
    Test-RequiredFields -Value $view.statusSummary -Fields @('requestStatus', 'approvalStatus', 'preflightStatus', 'reviewStatus', 'dispatchStatus') -Context 'Execution control dashboard status summary'
    Test-RequiredFields -Value $view -Fields @('auditSummary', 'evidenceSummary', 'unknownSummary', 'boundarySummary') -Context 'Execution control dashboard summaries'
    Test-BoundarySummary -Boundary $view.boundarySummary

    if ($view.summary.totalRequests -ne 4) { Add-Failure 'Execution dashboard totalRequests must be 4 for current runtime proof.' }
    if ($view.summary.dispatchEligible -ne 0) { Add-Failure 'Execution dashboard dispatchEligible must remain 0.' }
    if ($view.summary.manualEvidenceRequired -ne 4) { Add-Failure 'Execution dashboard manualEvidenceRequired must be 4.' }
    if ($view.summary.manualEvidencePresent -ne 0) { Add-Failure 'Execution dashboard manualEvidencePresent must be 0.' }
    if ($view.summary.manualEvidenceVerified -ne 0) { Add-Failure 'Execution dashboard manualEvidenceVerified must be 0.' }
    if ($view.unknownSummary.unknownRemainsUnknown -ne $true) { Add-Failure 'Execution dashboard must preserve UNKNOWN as UNKNOWN.' }
    if ($view.unknownSummary.unknownPassCount -ne 0) { Add-Failure 'Execution dashboard UNKNOWN must never become PASS.' }
    if ($view.unknownSummary.unknownDispatchEligibleCount -ne 0) { Add-Failure 'Execution dashboard UNKNOWN must never become DISPATCH_ELIGIBLE.' }
    if ($view.auditSummary.passCount -ne 0) { Add-Failure 'Execution dashboard must not report audit PASS for current proof.' }
    if (@($view.cards).Count -lt 7) { Add-Failure 'Execution dashboard must render request, approval, preflight, review, dispatch, audit and manual evidence cards.' }
}

$scanPaths = @(
    $generatorRelativePath,
    $viewRelativePath,
    'scripts/validation/validate-execution-dashboard.ps1',
    'docs/governance/EXECUTION_CONTROL_DASHBOARD.md',
    'docs/governance/EXECUTION_CONTROL_DASHBOARD_BOUNDARIES.md'
)
$secretPatterns = @(
    'api[_-]?key\s*[:=]\s*["''][^"'']+["'']',
    'token\s*[:=]\s*["''][^"'']+["'']',
    'secret\s*[:=]\s*["''][^"'']+["'']',
    'password\s*[:=]\s*["''][^"'']+["'']',
    'Bearer\s+[A-Za-z0-9._~+/=-]+',
    'Cookie\s*[:=]',
    'client[_-]?secret\s*[:=]',
    '-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----'
)
$forbiddenCapabilityPatterns = @(
    ('Invoke-' + 'RestMethod'),
    ('Invoke-' + 'WebRequest'),
    ('Start-' + 'Job'),
    ('Register-' + 'ScheduledTask'),
    ('Start-' + 'ThreadJob'),
    '(?m)^\s*git\s+push\b',
    '(?m)^\s*git\s+merge\b',
    '(?m)^\s*git\s+rebase\b',
    '(?m)^\s*gh\s+',
    'vercel\s+deploy(\s|$)',
    'localStorage\.',
    'sessionStorage\.',
    '"performsExecution"\s*:\s*true',
    '"executionEngine"\s*:\s*true',
    '"dispatchEngine"\s*:\s*true',
    '"providerExecution"\s*:\s*true',
    '"githubExecution"\s*:\s*true',
    '"deploymentExecution"\s*:\s*true',
    '"approvalMutation"\s*:\s*true',
    '"dispatchMutation"\s*:\s*true',
    '"runtimeMutation"\s*:\s*true',
    '"queues"\s*:\s*true',
    '"workers"\s*:\s*true',
    '"schedulers"\s*:\s*true',
    '"backgroundJobs"\s*:\s*true',
    '"agentExecution"\s*:\s*true',
    '"credentialAccess"\s*:\s*true',
    '"secretAccess"\s*:\s*true',
    '"branchWrites"\s*:\s*true',
    '"repositorySettingsMutation"\s*:\s*true',
    '"collaboratorMutation"\s*:\s*true',
    '"localStorageAuthority"\s*:\s*true',
    '"sessionStorageAuthority"\s*:\s*true',
    '"actionEndpoints"\s*:\s*true',
    '"actionControls"\s*:\s*true'
)

foreach ($relativePath in $scanPaths) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path)) { continue }
    $files = if (Test-Path -LiteralPath $path -PathType Container) { Get-ChildItem -LiteralPath $path -File -Recurse } else { Get-Item -LiteralPath $path }
    foreach ($file in $files) {
        $content = Get-Content -LiteralPath $file.FullName -Raw
        foreach ($pattern in $secretPatterns) {
            if ($content -match $pattern) { Add-Failure "Possible secret or credential found in execution dashboard artifact: $($file.FullName)" }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) { Add-Failure "Forbidden execution dashboard capability found in artifact: $($file.FullName) pattern=$pattern" }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "Execution dashboard validation failed with $($failures.Count) failure(s)."
}

Write-Host 'Studio OS V2.9 Execution Control Dashboard Integration passed deterministic checks.' -ForegroundColor Green
