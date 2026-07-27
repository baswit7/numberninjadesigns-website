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

function Read-ObservabilityJson {
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

function Test-Flag {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string]$Field,
        [Parameter(Mandatory)][bool]$Expected,
        [Parameter(Mandatory)][string]$Label
    )

    $property = $Value.PSObject.Properties[$Field]
    if ($null -eq $property) {
        Add-Failure "$Label misses boundary field '$Field'."
        return
    }
    if ($property.Value -ne $Expected) {
        Add-Failure "$Label boundary field '$Field' must be $Expected."
    }
}

& (Join-Path $PSScriptRoot 'validate-authority-evidence-history.ps1') | Out-Null
& (Join-Path $root 'services/authority-observability/generate-authority-observability.ps1') | Out-Null

$requiredPaths = @(
    'shared/contracts/authority/observability/authority-observability.schema.json',
    'shared/contracts/authority/observability/observability.manifest.json',
    'services/authority-observability/README.md',
    'services/authority-observability/generate-authority-observability.ps1',
    'runtime/authority/authority-observability.report.json',
    'scripts/validation/validate-authority-observability.ps1',
    'docs/governance/PHASE_21_AUTHORITY_EVIDENCE_OBSERVABILITY.md',
    'docs/governance/PHASE_21_BOUNDARY_AUDIT.md'
)

foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        Add-Failure "Required Phase 21 authority observability artifact missing: $relativePath"
    }
}

$manifest = Read-ObservabilityJson -RelativePath 'shared/contracts/authority/observability/observability.manifest.json'
$report = Read-ObservabilityJson -RelativePath 'runtime/authority/authority-observability.report.json'

if ($null -ne $manifest) {
    Test-RequiredFields -Value $manifest -RequiredFields @('schemaVersion', 'phase', 'manifestId', 'sourceContracts', 'consumedRuntimeReports', 'runtimeReports', 'nonExecutable', 'boundary') -Label 'Authority observability manifest'
    if ($manifest.phase -ne 'phase-21') { Add-Failure 'Authority observability manifest phase must be phase-21.' }
    if ($manifest.nonExecutable -ne $true) { Add-Failure 'Authority observability manifest must be nonExecutable=true.' }
    foreach ($path in @($manifest.consumedRuntimeReports)) {
        if ($path -notlike 'runtime/authority/*.json' -and $path -notlike 'runtime/dashboard/*.json') {
            Add-Failure "Authority observability consumed report must stay under runtime/authority or runtime/dashboard: $path"
        }
    }
    foreach ($path in @($manifest.runtimeReports)) {
        if ($path -notlike 'runtime/authority/*.json') {
            Add-Failure "Authority observability report output must stay under runtime/authority: $path"
        }
    }
    foreach ($flag in @('observabilityOnly', 'visibilityOnly', 'readOnly', 'derivedOnly', 'reportWritingOnly')) {
        Test-Flag -Value $manifest.boundary -Field $flag -Expected $true -Label 'Authority observability manifest'
    }
    foreach ($flag in @('ownsAuthorityTruth', 'ownsEvidenceTruth', 'ownsMonitoringTruth', 'ownsProjectionTruth', 'ownsHistoryTruth', 'ownsRetentionTruth', 'createsDecisions', 'createsApprovals', 'repairsProjection', 'synchronizesProjection', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeTruthMutationAllowed', 'dashboardMutationAllowed', 'approvalMutationAllowed', 'workflowExecutionAllowed', 'workerAllowed', 'schedulerAllowed', 'queueAllowed', 'automationAllowed', 'selfHealingAllowed', 'browserAuthorityStorageAllowed')) {
        Test-Flag -Value $manifest.boundary -Field $flag -Expected $false -Label 'Authority observability manifest'
    }
    $checks.Add([ordered]@{ id = 'observability-manifest'; status = 'checked'; consumedReports = @($manifest.consumedRuntimeReports).Count }) | Out-Null
}

if ($null -ne $report) {
    Test-RequiredFields -Value $report -RequiredFields @('schemaVersion', 'phase', 'reportId', 'generatedBy', 'generatedAt', 'sourceOfTruth', 'consumedReports', 'status', 'summary', 'freshness', 'lineage', 'coverage', 'trend', 'retention', 'health', 'unknowns', 'boundary') -Label 'Authority observability report'
    if ($report.phase -ne 'phase-21') { Add-Failure 'Authority observability report phase must be phase-21.' }
    if ($report.generatedBy -ne 'services/authority-observability/generate-authority-observability.ps1') { Add-Failure 'Authority observability report generatedBy must identify the Phase 21 generator.' }
    foreach ($sourceField in @('authority', 'readModel', 'projection', 'monitoring', 'evidence', 'history')) {
        if ($null -eq $report.sourceOfTruth.PSObject.Properties[$sourceField]) {
            Add-Failure "Authority observability sourceOfTruth misses '$sourceField'."
        }
    }
    if ($report.summary.knownInputCount + $report.summary.unknownInputCount -ne @($report.consumedReports).Count) {
        Add-Failure 'Observability known/unknown input counts must match consumed reports.'
    }
    foreach ($input in @($report.consumedReports)) {
        Test-RequiredFields -Value $input -RequiredFields @('path', 'role', 'exists', 'validJson', 'isStale', 'isComplete', 'verdict', 'reason') -Label "Observability consumed report '$($input.path)'"
        if (($input.exists -ne $true -or $input.validJson -ne $true -or $input.isStale -eq $true -or $input.isComplete -ne $true) -and $input.verdict -ne 'unknown') {
            Add-Failure "Missing, unreadable, stale or incomplete observability input '$($input.path)' must be unknown, not $($input.verdict)."
        }
    }
    foreach ($groupName in @('freshness', 'lineage', 'coverage', 'trend', 'retention', 'health', 'unknowns')) {
        $group = $report.$groupName
        Test-RequiredFields -Value $group -RequiredFields @('status', 'items') -Label "Observability $groupName"
        foreach ($item in @($group.items)) {
            Test-RequiredFields -Value $item -RequiredFields @('id', 'status', 'summary', 'source', 'safe') -Label "Observability $groupName item '$($item.id)'"
            if ($item.status -ne 'pass' -and $item.safe -ne $false) {
                Add-Failure "Observability $groupName item '$($item.id)' must not be safe when status is $($item.status)."
            }
        }
    }
    foreach ($flag in @('observabilityOnly', 'visibilityOnly', 'readOnly', 'derivedOnly', 'reportWritingOnly')) {
        Test-Flag -Value $report.boundary -Field $flag -Expected $true -Label 'Authority observability report'
    }
    foreach ($flag in @('ownsAuthorityTruth', 'ownsEvidenceTruth', 'ownsMonitoringTruth', 'ownsProjectionTruth', 'ownsHistoryTruth', 'ownsRetentionTruth', 'createsDecisions', 'createsApprovals', 'repairsProjection', 'synchronizesProjection', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeTruthMutationAllowed', 'dashboardMutationAllowed', 'approvalMutationAllowed', 'workflowExecutionAllowed', 'workerAllowed', 'schedulerAllowed', 'queueAllowed', 'automationAllowed', 'selfHealingAllowed', 'browserAuthorityStorageAllowed')) {
        Test-Flag -Value $report.boundary -Field $flag -Expected $false -Label 'Authority observability report'
    }
    $checks.Add([ordered]@{ id = 'observability-report'; status = 'checked'; statusValue = $report.status; coveragePercent = $report.summary.coveragePercent }) | Out-Null
}

$phase21Files = @(
    'shared/contracts/authority/observability/authority-observability.schema.json',
    'shared/contracts/authority/observability/observability.manifest.json',
    'services/authority-observability/README.md',
    'services/authority-observability/generate-authority-observability.ps1',
    'scripts/validation/validate-authority-observability.ps1',
    'runtime/authority/authority-observability.report.json',
    'docs/governance/PHASE_21_AUTHORITY_EVIDENCE_OBSERVABILITY.md',
    'docs/governance/PHASE_21_BOUNDARY_AUDIT.md'
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
    '"secretValue"\s*:',
    ('local' + 'Storage')
)

foreach ($relativePath in $phase21Files) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }
    foreach ($pattern in $forbiddenPatterns) {
        $match = Select-String -LiteralPath $path -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($match) {
            Add-Failure "Forbidden Phase 21 capability pattern '$pattern' in $relativePath line $($match.LineNumber)."
        }
    }
}
$checks.Add([ordered]@{ id = 'phase-21-forbidden-pattern-scan'; status = 'checked'; files = @($phase21Files).Count }) | Out-Null

$reportStatus = 'failed'
$reportSummary = "Authority observability validation failed with $($failures.Count) issue(s)."
if ($failures.Count -eq 0) {
    $reportStatus = 'passed'
    $reportSummary = 'Authority observability passed deterministic read-only visibility checks.'
}

$validationReport = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-21'
    reportId = 'authority-observability-validation'
    status = $reportStatus
    summary = $reportSummary
    checks = $checks.ToArray()
    failures = $failures.ToArray()
    boundary = [ordered]@{
        machineReadableReportOnly = $true
        observabilityOnly = $true
        visibilityOnly = $true
        readOnly = $true
        derivedOnly = $true
        reportWritingOnly = $true
        ownsAuthorityTruth = $false
        ownsEvidenceTruth = $false
        ownsMonitoringTruth = $false
        ownsProjectionTruth = $false
        ownsHistoryTruth = $false
        ownsRetentionTruth = $false
        createsDecisions = $false
        createsApprovals = $false
        repairsProjection = $false
        synchronizesProjection = $false
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        credentialAccessAllowed = $false
        secretAccessAllowed = $false
        runtimeTruthMutationAllowed = $false
        dashboardMutationAllowed = $false
        approvalMutationAllowed = $false
        workflowExecutionAllowed = $false
        workerAllowed = $false
        schedulerAllowed = $false
        queueAllowed = $false
        automationAllowed = $false
        selfHealingAllowed = $false
        browserAuthorityStorageAllowed = $false
    }
}

Write-StudioJson -RelativePath 'runtime/authority/authority-observability-validation.report.json' -Value $validationReport

if ($failures.Count -gt 0) {
    Write-Host 'Phase 21 authority observability validation failed.' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'Phase 21 authority observability passed deterministic checks.' -ForegroundColor Green
exit 0
