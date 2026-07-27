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

function Read-HistoryJson {
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

& (Join-Path $PSScriptRoot 'validate-authority-evidence-center.ps1') | Out-Null
& (Join-Path $root 'services/authority-history/generate-authority-evidence-history.ps1') | Out-Null

$requiredPaths = @(
    'shared/contracts/authority/history/authority-evidence-history.schema.json',
    'shared/contracts/authority/history/history.manifest.json',
    'services/authority-history/README.md',
    'services/authority-history/generate-authority-evidence-history.ps1',
    'runtime/authority/authority-evidence-history.report.json',
    'scripts/validation/validate-authority-evidence-history.ps1',
    'docs/governance/PHASE_20_AUTHORITY_EVIDENCE_HISTORY.md',
    'docs/governance/PHASE_20_BOUNDARY_AUDIT.md'
)

foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        Add-Failure "Required Phase 20 authority evidence history artifact missing: $relativePath"
    }
}

$manifest = Read-HistoryJson -RelativePath 'shared/contracts/authority/history/history.manifest.json'
$report = Read-HistoryJson -RelativePath 'runtime/authority/authority-evidence-history.report.json'
$monitoring = Read-HistoryJson -RelativePath 'runtime/authority/authority-projection-monitoring.report.json'
$evidence = Read-HistoryJson -RelativePath 'runtime/authority/authority-monitoring-evidence.report.json'

if ($null -ne $manifest) {
    Test-RequiredFields -Value $manifest -RequiredFields @('schemaVersion', 'phase', 'manifestId', 'sourceContracts', 'consumedRuntimeReports', 'runtimeReports', 'retention', 'nonExecutable', 'boundary') -Label 'Authority evidence history manifest'
    if ($manifest.phase -ne 'phase-20') { Add-Failure 'Authority evidence history manifest phase must be phase-20.' }
    if ($manifest.nonExecutable -ne $true) { Add-Failure 'Authority evidence history manifest must be nonExecutable=true.' }
    foreach ($path in @($manifest.consumedRuntimeReports)) {
        if ($path -notlike 'runtime/authority/*.json' -and $path -notlike 'runtime/dashboard/*.json') {
            Add-Failure "Authority evidence history consumed report must stay under runtime/authority or runtime/dashboard: $path"
        }
    }
    foreach ($path in @($manifest.runtimeReports)) {
        if ($path -notlike 'runtime/authority/*.json') {
            Add-Failure "Authority evidence history report output must stay under runtime/authority: $path"
        }
    }
    foreach ($flag in @('historyOnly', 'trendOnly', 'readOnly', 'derivedOnly', 'reportWritingOnly')) {
        Test-Flag -Value $manifest.boundary -Field $flag -Expected $true -Label 'Authority evidence history manifest'
    }
    foreach ($flag in @('ownsAuthorityTruth', 'ownsEvidenceTruth', 'createsDecisions', 'createsApprovals', 'repairsProjection', 'synchronizesProjection', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeTruthMutationAllowed', 'dashboardMutationAllowed', 'approvalMutationAllowed', 'workflowExecutionAllowed', 'workerAllowed', 'schedulerAllowed', 'queueAllowed', 'automationAllowed', 'selfHealingAllowed', 'browserAuthorityStorageAllowed')) {
        Test-Flag -Value $manifest.boundary -Field $flag -Expected $false -Label 'Authority evidence history manifest'
    }
    if ($manifest.retention.pruningAllowed -ne $false -or $manifest.retention.repairAllowed -ne $false -or $manifest.retention.synchronizationAllowed -ne $false) {
        Add-Failure 'Authority evidence history manifest retention must not allow pruning, repair or synchronization.'
    }
    $checks.Add([ordered]@{ id = 'history-manifest'; status = 'checked'; consumedReports = @($manifest.consumedRuntimeReports).Count }) | Out-Null
}

if ($null -ne $report -and $null -ne $monitoring -and $null -ne $evidence) {
    Test-RequiredFields -Value $report -RequiredFields @('schemaVersion', 'phase', 'reportId', 'generatedBy', 'generatedAt', 'sourceOfTruth', 'consumedReports', 'status', 'summary', 'history', 'trend', 'retention', 'lineage', 'freshness', 'regressions', 'unknowns', 'boundary') -Label 'Authority evidence history report'
    if ($report.phase -ne 'phase-20') { Add-Failure 'Authority evidence history report phase must be phase-20.' }
    if ($report.generatedBy -ne 'services/authority-history/generate-authority-evidence-history.ps1') { Add-Failure 'Authority evidence history report generatedBy must identify the Phase 20 generator.' }
    if ($report.sourceOfTruth.monitoring -ne 'runtime/authority/authority-projection-monitoring.report.json') { Add-Failure 'History report must preserve Phase 18 monitoring as source.' }
    if ($report.sourceOfTruth.evidence -ne 'runtime/authority/authority-monitoring-evidence.report.json') { Add-Failure 'History report must preserve Phase 19 evidence as source.' }
    if ($report.history.mode -ne 'derived-current-snapshot') { Add-Failure 'History report mode must be derived-current-snapshot.' }
    if ($report.summary.snapshotCount -ne @($report.history.snapshots).Count) { Add-Failure 'History report snapshotCount must match snapshots length.' }
    if ($report.summary.knownInputCount + $report.summary.unknownInputCount -ne @($report.consumedReports).Count) { Add-Failure 'History known/unknown input counts must match consumed reports.' }
    if ($report.retention.pruningAllowed -ne $false -or $report.retention.repairAllowed -ne $false -or $report.retention.synchronizationAllowed -ne $false) {
        Add-Failure 'History retention must not allow pruning, repair or synchronization.'
    }
    foreach ($input in @($report.consumedReports)) {
        Test-RequiredFields -Value $input -RequiredFields @('path', 'role', 'exists', 'validJson', 'verdict', 'reason') -Label "History consumed report '$($input.path)'"
        if (($input.exists -ne $true -or $input.validJson -ne $true) -and $input.verdict -ne 'unknown') {
            Add-Failure "Missing or unreadable history input '$($input.path)' must be unknown, not $($input.verdict)."
        }
    }
    foreach ($groupName in @('trend', 'lineage', 'freshness', 'regressions', 'unknowns')) {
        $group = $report.$groupName
        Test-RequiredFields -Value $group -RequiredFields @('status', 'items') -Label "History $groupName"
        foreach ($item in @($group.items)) {
            Test-RequiredFields -Value $item -RequiredFields @('id', 'status', 'summary', 'source', 'safe') -Label "History $groupName item '$($item.id)'"
            if ($item.status -ne 'pass' -and $item.safe -ne $false) {
                Add-Failure "History $groupName item '$($item.id)' must not be safe when status is $($item.status)."
            }
        }
    }
    if ($report.unknowns.status -ne 'unknown') {
        Add-Failure 'History unknowns group must remain unknown when prior history is absent.'
    }
    foreach ($flag in @('historyOnly', 'trendOnly', 'readOnly', 'derivedOnly', 'reportWritingOnly')) {
        Test-Flag -Value $report.boundary -Field $flag -Expected $true -Label 'Authority evidence history report'
    }
    foreach ($flag in @('ownsAuthorityTruth', 'ownsEvidenceTruth', 'createsDecisions', 'createsApprovals', 'repairsProjection', 'synchronizesProjection', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeTruthMutationAllowed', 'dashboardMutationAllowed', 'approvalMutationAllowed', 'workflowExecutionAllowed', 'workerAllowed', 'schedulerAllowed', 'queueAllowed', 'automationAllowed', 'selfHealingAllowed', 'browserAuthorityStorageAllowed')) {
        Test-Flag -Value $report.boundary -Field $flag -Expected $false -Label 'Authority evidence history report'
    }
    $checks.Add([ordered]@{ id = 'history-report'; status = 'checked'; snapshots = @($report.history.snapshots).Count; statusValue = $report.status }) | Out-Null
}

$phase20Files = @(
    'shared/contracts/authority/history/authority-evidence-history.schema.json',
    'shared/contracts/authority/history/history.manifest.json',
    'services/authority-history/README.md',
    'services/authority-history/generate-authority-evidence-history.ps1',
    'scripts/validation/validate-authority-evidence-history.ps1',
    'runtime/authority/authority-evidence-history.report.json',
    'docs/governance/PHASE_20_AUTHORITY_EVIDENCE_HISTORY.md',
    'docs/governance/PHASE_20_BOUNDARY_AUDIT.md'
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

foreach ($relativePath in $phase20Files) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }
    foreach ($pattern in $forbiddenPatterns) {
        $match = Select-String -LiteralPath $path -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($match) {
            Add-Failure "Forbidden Phase 20 capability pattern '$pattern' in $relativePath line $($match.LineNumber)."
        }
    }
}
$checks.Add([ordered]@{ id = 'phase-20-forbidden-pattern-scan'; status = 'checked'; files = @($phase20Files).Count }) | Out-Null

$reportStatus = 'failed'
$reportSummary = "Authority evidence history validation failed with $($failures.Count) issue(s)."
if ($failures.Count -eq 0) {
    $reportStatus = 'passed'
    $reportSummary = 'Authority evidence history passed deterministic read-only trend and retention checks.'
}

$validationReport = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-20'
    reportId = 'authority-evidence-history-validation'
    status = $reportStatus
    summary = $reportSummary
    checks = $checks.ToArray()
    failures = $failures.ToArray()
    boundary = [ordered]@{
        machineReadableReportOnly = $true
        historyOnly = $true
        trendOnly = $true
        readOnly = $true
        derivedOnly = $true
        reportWritingOnly = $true
        ownsAuthorityTruth = $false
        ownsEvidenceTruth = $false
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

Write-StudioJson -RelativePath 'runtime/authority/authority-evidence-history-validation.report.json' -Value $validationReport

if ($failures.Count -gt 0) {
    Write-Host 'Phase 20 authority evidence history validation failed.' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'Phase 20 authority evidence history passed deterministic checks.' -ForegroundColor Green
exit 0
