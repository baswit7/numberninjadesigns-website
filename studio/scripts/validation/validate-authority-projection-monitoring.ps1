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

function Read-MonitoringJson {
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

function Test-FalseFlag {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string]$Field,
        [Parameter(Mandatory)][string]$Label
    )

    $property = $Value.PSObject.Properties[$Field]
    if ($null -eq $property) {
        Add-Failure "$Label misses boundary field '$Field'."
        return
    }
    if ($property.Value -ne $false) {
        Add-Failure "$Label boundary field '$Field' must be false."
    }
}

function Test-TrueFlag {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string]$Field,
        [Parameter(Mandatory)][string]$Label
    )

    $property = $Value.PSObject.Properties[$Field]
    if ($null -eq $property) {
        Add-Failure "$Label misses boundary field '$Field'."
        return
    }
    if ($property.Value -ne $true) {
        Add-Failure "$Label boundary field '$Field' must be true."
    }
}

& (Join-Path $PSScriptRoot 'validate-authority-control-plane.ps1') | Out-Null
& (Join-Path $PSScriptRoot 'validate-authority-read-model.ps1') | Out-Null
& (Join-Path $PSScriptRoot 'validate-authority-dashboard-projection.ps1') | Out-Null
& (Join-Path $root 'services/authority-monitoring/generate-authority-projection-monitoring.ps1') | Out-Null

$requiredPaths = @(
    'shared/contracts/authority/monitoring/authority-projection-monitoring.schema.json',
    'shared/contracts/authority/monitoring/monitoring.manifest.json',
    'services/authority-monitoring/README.md',
    'services/authority-monitoring/generate-authority-projection-monitoring.ps1',
    'runtime/authority/authority-projection-monitoring.report.json',
    'docs/governance/AUTHORITY_PROJECTION_MONITORING.md',
    'docs/governance/PHASE_18_BOUNDARY_AUDIT.md'
)

foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        Add-Failure "Required Phase 18 authority projection monitoring artifact missing: $relativePath"
    }
}

$manifest = Read-MonitoringJson -RelativePath 'shared/contracts/authority/monitoring/monitoring.manifest.json'
$report = Read-MonitoringJson -RelativePath 'runtime/authority/authority-projection-monitoring.report.json'
$readModel = Read-MonitoringJson -RelativePath 'runtime/authority/authority-read-model.report.json'
$authorityView = Read-MonitoringJson -RelativePath 'runtime/dashboard/authority.view.json'

if ($null -ne $manifest) {
    Test-RequiredFields -Value $manifest -RequiredFields @('schemaVersion', 'phase', 'manifestId', 'sourceContracts', 'consumedRuntimeReports', 'runtimeReports', 'nonExecutable', 'boundary') -Label 'Authority projection monitoring manifest'
    if ($manifest.phase -ne 'phase-18') { Add-Failure 'Authority projection monitoring manifest phase must be phase-18.' }
    if ($manifest.nonExecutable -ne $true) { Add-Failure 'Authority projection monitoring manifest must be nonExecutable=true.' }
    foreach ($path in @($manifest.sourceContracts)) {
        if ($path -notlike 'shared/contracts/authority/*') {
            Add-Failure "Authority projection monitoring source contract is outside authority contracts: $path"
        }
    }
    foreach ($path in @($manifest.consumedRuntimeReports)) {
        if ($path -notlike 'runtime/authority/*.json' -and $path -notlike 'runtime/dashboard/*.json') {
            Add-Failure "Authority projection monitoring consumed report must stay under runtime/authority or runtime/dashboard: $path"
        }
    }
    foreach ($path in @($manifest.runtimeReports)) {
        if ($path -notlike 'runtime/authority/*.json') {
            Add-Failure "Authority projection monitoring report output must stay under runtime/authority: $path"
        }
    }
    Test-TrueFlag -Value $manifest.boundary -Field 'monitoringOnly' -Label 'Authority projection monitoring manifest'
    Test-TrueFlag -Value $manifest.boundary -Field 'derivedOnly' -Label 'Authority projection monitoring manifest'
    Test-TrueFlag -Value $manifest.boundary -Field 'reportWritingOnly' -Label 'Authority projection monitoring manifest'
    foreach ($flag in @('ownsAuthority', 'repairsProjection', 'synchronizesProjection', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeMutationAllowed', 'dashboardActionAllowed', 'approvalAutomationAllowed')) {
        Test-FalseFlag -Value $manifest.boundary -Field $flag -Label 'Authority projection monitoring manifest'
    }
    $checks.Add([ordered]@{ id = 'monitoring-manifest'; status = 'checked'; consumedReports = @($manifest.consumedRuntimeReports).Count }) | Out-Null
}

if ($null -ne $report -and $null -ne $readModel -and $null -ne $authorityView) {
    Test-RequiredFields -Value $report -RequiredFields @('schemaVersion', 'phase', 'reportId', 'generatedBy', 'generatedAt', 'sourceOfTruth', 'consumedSources', 'monitoredProjection', 'status', 'summary', 'freshness', 'lineage', 'completeness', 'structuralChecks', 'findings', 'boundary') -Label 'Authority projection monitoring report'
    if ($report.phase -ne 'phase-18') { Add-Failure 'Authority projection monitoring report phase must be phase-18.' }
    if ($report.generatedBy -ne 'services/authority-monitoring/generate-authority-projection-monitoring.ps1') { Add-Failure 'Authority projection monitoring generatedBy must identify the Phase 18 generator.' }
    if ($report.sourceOfTruth.constitution -ne 'shared/contracts/authority/constitution.rules.json') { Add-Failure 'Monitoring report must preserve Constitution as source of truth.' }
    if ($report.sourceOfTruth.authorityRegistry -ne 'shared/contracts/authority/authority-registry.json') { Add-Failure 'Monitoring report must preserve Authority Registry as source of truth.' }
    if ($report.sourceOfTruth.readModel -ne 'runtime/authority/authority-read-model.report.json') { Add-Failure 'Monitoring report must preserve Phase 16 read model as intelligence source.' }
    if ($report.monitoredProjection.path -ne 'runtime/dashboard/authority.view.json') { Add-Failure 'Monitoring report must monitor runtime/dashboard/authority.view.json.' }
    if ($report.summary.authorityCount -ne $readModel.summary.authorityCount) { Add-Failure 'Monitoring report authorityCount must match authority read model.' }
    if ($report.summary.expectedProjectionCount -lt 1) { Add-Failure 'Monitoring report must compute expectedProjectionCount.' }
    if ($report.summary.findingCount -ne @($report.findings).Count) { Add-Failure 'Monitoring report findingCount must match findings length.' }
    foreach ($finding in @($report.findings)) {
        Test-RequiredFields -Value $finding -RequiredFields @('id', 'type', 'severity', 'source', 'projection', 'summary') -Label "Monitoring finding '$($finding.id)'"
    }
    Test-TrueFlag -Value $report.boundary -Field 'monitoringOnly' -Label 'Authority projection monitoring report'
    Test-TrueFlag -Value $report.boundary -Field 'derivedOnly' -Label 'Authority projection monitoring report'
    Test-TrueFlag -Value $report.boundary -Field 'reportWritingOnly' -Label 'Authority projection monitoring report'
    foreach ($flag in @('ownsAuthority', 'repairsProjection', 'synchronizesProjection', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeMutationAllowed', 'dashboardActionAllowed', 'approvalAutomationAllowed')) {
        Test-FalseFlag -Value $report.boundary -Field $flag -Label 'Authority projection monitoring report'
    }
    $checks.Add([ordered]@{ id = 'monitoring-report'; status = 'checked'; findings = @($report.findings).Count; statusValue = $report.status }) | Out-Null
}

$phase18Files = @(
    'shared/contracts/authority/monitoring/authority-projection-monitoring.schema.json',
    'shared/contracts/authority/monitoring/monitoring.manifest.json',
    'services/authority-monitoring/README.md',
    'services/authority-monitoring/generate-authority-projection-monitoring.ps1',
    'scripts/validation/validate-authority-projection-monitoring.ps1',
    'runtime/authority/authority-projection-monitoring.report.json',
    'docs/governance/AUTHORITY_PROJECTION_MONITORING.md',
    'docs/governance/PHASE_18_BOUNDARY_AUDIT.md'
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
    ('Repair' + '-'),
    ('Sync' + '-'),
    '"apiKey"\s*:',
    '"accessToken"\s*:',
    '"refreshToken"\s*:',
    '"clientSecret"\s*:',
    '"credentialValue"\s*:',
    '"secretValue"\s*:'
)

foreach ($relativePath in $phase18Files) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }
    foreach ($pattern in $forbiddenPatterns) {
        $match = Select-String -LiteralPath $path -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($match) {
            Add-Failure "Forbidden Phase 18 capability pattern '$pattern' in $relativePath line $($match.LineNumber)."
        }
    }
}
$checks.Add([ordered]@{ id = 'phase-18-forbidden-pattern-scan'; status = 'checked'; files = @($phase18Files).Count }) | Out-Null

$reportStatus = 'failed'
$reportSummary = "Authority projection monitoring validation failed with $($failures.Count) issue(s)."
if ($failures.Count -eq 0) {
    $reportStatus = 'passed'
    $reportSummary = 'Authority projection monitoring passed deterministic read-only drift and boundary checks.'
}

$validationReport = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-18'
    reportId = 'authority-projection-monitoring-validation'
    status = $reportStatus
    summary = $reportSummary
    checks = $checks.ToArray()
    failures = $failures.ToArray()
    boundary = [ordered]@{
        machineReadableReportOnly = $true
        monitoringOnly = $true
        derivedOnly = $true
        reportWritingOnly = $true
        ownsAuthority = $false
        repairsProjection = $false
        synchronizesProjection = $false
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        credentialAccessAllowed = $false
        secretAccessAllowed = $false
        runtimeMutationAllowed = $false
        dashboardActionAllowed = $false
        approvalAutomationAllowed = $false
    }
}

Write-StudioJson -RelativePath 'runtime/authority/authority-projection-monitoring-validation.report.json' -Value $validationReport

if ($failures.Count -gt 0) {
    Write-Host 'Phase 18 authority projection monitoring validation failed.' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'Phase 18 authority projection monitoring passed deterministic checks.' -ForegroundColor Green
exit 0
