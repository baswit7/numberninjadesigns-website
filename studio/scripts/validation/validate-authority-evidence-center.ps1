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

function Read-EvidenceJson {
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

& (Join-Path $PSScriptRoot 'validate-authority-projection-monitoring.ps1') | Out-Null
& (Join-Path $root 'services/authority-evidence/generate-authority-monitoring-evidence.ps1') | Out-Null

$requiredPaths = @(
    'shared/contracts/authority/evidence/authority-monitoring-evidence.schema.json',
    'shared/contracts/authority/evidence/evidence.manifest.json',
    'services/authority-evidence/README.md',
    'services/authority-evidence/generate-authority-monitoring-evidence.ps1',
    'runtime/authority/authority-monitoring-evidence.report.json',
    'scripts/validation/validate-authority-evidence-center.ps1',
    'docs/governance/AUTHORITY_MONITORING_EVIDENCE_CENTER.md',
    'docs/governance/PHASE_19_BOUNDARY_AUDIT.md'
)

foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        Add-Failure "Required Phase 19 authority evidence artifact missing: $relativePath"
    }
}

$manifest = Read-EvidenceJson -RelativePath 'shared/contracts/authority/evidence/evidence.manifest.json'
$report = Read-EvidenceJson -RelativePath 'runtime/authority/authority-monitoring-evidence.report.json'
$monitoring = Read-EvidenceJson -RelativePath 'runtime/authority/authority-projection-monitoring.report.json'

if ($null -ne $manifest) {
    Test-RequiredFields -Value $manifest -RequiredFields @('schemaVersion', 'phase', 'manifestId', 'sourceContracts', 'consumedRuntimeReports', 'runtimeReports', 'dashboardViews', 'nonExecutable', 'boundary') -Label 'Authority evidence manifest'
    if ($manifest.phase -ne 'phase-19') { Add-Failure 'Authority evidence manifest phase must be phase-19.' }
    if ($manifest.nonExecutable -ne $true) { Add-Failure 'Authority evidence manifest must be nonExecutable=true.' }
    foreach ($path in @($manifest.sourceContracts)) {
        if ($path -notlike 'shared/contracts/authority/*') {
            Add-Failure "Authority evidence source contract is outside authority contracts: $path"
        }
    }
    foreach ($path in @($manifest.consumedRuntimeReports)) {
        if ($path -notlike 'runtime/authority/*.json' -and $path -notlike 'runtime/dashboard/*.json') {
            Add-Failure "Authority evidence consumed report must stay under runtime/authority or runtime/dashboard: $path"
        }
    }
    foreach ($path in @($manifest.runtimeReports)) {
        if ($path -notlike 'runtime/authority/*.json') {
            Add-Failure "Authority evidence report output must stay under runtime/authority: $path"
        }
    }
    foreach ($path in @($manifest.dashboardViews)) {
        if ($path -notlike 'runtime/dashboard/*.json') {
            Add-Failure "Authority evidence dashboard output must stay under runtime/dashboard: $path"
        }
    }
    foreach ($flag in @('evidenceOnly', 'readOnly', 'derivedOnly', 'reportWritingOnly')) {
        Test-TrueFlag -Value $manifest.boundary -Field $flag -Label 'Authority evidence manifest'
    }
    foreach ($flag in @('ownsAuthority', 'ownsTruth', 'createsDecisions', 'createsApprovals', 'repairsProjection', 'synchronizesProjection', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeMutationAllowed', 'dashboardActionAllowed', 'approvalAutomationAllowed', 'workflowExecutionAllowed', 'browserAuthorityStorageAllowed')) {
        Test-FalseFlag -Value $manifest.boundary -Field $flag -Label 'Authority evidence manifest'
    }
    $checks.Add([ordered]@{ id = 'evidence-manifest'; status = 'checked'; consumedReports = @($manifest.consumedRuntimeReports).Count }) | Out-Null
}

if ($null -ne $report -and $null -ne $monitoring) {
    Test-RequiredFields -Value $report -RequiredFields @('schemaVersion', 'phase', 'reportId', 'generatedBy', 'generatedAt', 'sourceOfTruth', 'monitoringSource', 'status', 'summary', 'sourceFileEvidence', 'projectionFileEvidence', 'lineageEvidence', 'verdictEvidence', 'freshnessEvidence', 'completenessEvidence', 'mismatchEvidence', 'safetyEvidence', 'unknownEvidence', 'unknownStateProof', 'boundary') -Label 'Authority monitoring evidence report'
    if ($report.phase -ne 'phase-19') { Add-Failure 'Authority monitoring evidence report phase must be phase-19.' }
    if ($report.generatedBy -ne 'services/authority-evidence/generate-authority-monitoring-evidence.ps1') { Add-Failure 'Authority monitoring evidence generatedBy must identify the Phase 19 generator.' }
    if ($report.sourceOfTruth.constitution -ne 'shared/contracts/authority/constitution.rules.json') { Add-Failure 'Evidence report must preserve Constitution as source of truth.' }
    if ($report.sourceOfTruth.authorityRegistry -ne 'shared/contracts/authority/authority-registry.json') { Add-Failure 'Evidence report must preserve Authority Registry as ownership source.' }
    if ($report.sourceOfTruth.monitoring -ne 'runtime/authority/authority-projection-monitoring.report.json') { Add-Failure 'Evidence report must preserve Phase 18 monitoring as monitoring source.' }
    if ($report.monitoringSource.path -ne 'runtime/authority/authority-projection-monitoring.report.json') { Add-Failure 'Evidence report monitoringSource must point at Phase 18 monitoring report.' }
    if ($report.summary.findingCount -ne @($monitoring.findings).Count) { Add-Failure 'Evidence report findingCount must match Phase 18 monitoring findings.' }
    if ($report.summary.sourceFileCount -ne @($report.sourceFileEvidence).Count) { Add-Failure 'Evidence sourceFileCount must match sourceFileEvidence length.' }
    if ($report.summary.projectionFileCount -ne @($report.projectionFileEvidence).Count) { Add-Failure 'Evidence projectionFileCount must match projectionFileEvidence length.' }

    foreach ($fileEvidence in @($report.sourceFileEvidence + $report.projectionFileEvidence + @($report.monitoringSource))) {
        Test-RequiredFields -Value $fileEvidence -RequiredFields @('path', 'kind', 'role', 'exists', 'validJson', 'verdict', 'reason') -Label "Evidence file '$($fileEvidence.path)'"
        if (($fileEvidence.exists -ne $true -or $fileEvidence.validJson -ne $true) -and $fileEvidence.verdict -ne 'unknown') {
            Add-Failure "Missing or unreadable evidence input '$($fileEvidence.path)' must be unknown, not $($fileEvidence.verdict)."
        }
    }

    foreach ($groupName in @('lineageEvidence', 'verdictEvidence', 'freshnessEvidence', 'completenessEvidence', 'mismatchEvidence', 'safetyEvidence', 'unknownEvidence')) {
        $group = $report.$groupName
        Test-RequiredFields -Value $group -RequiredFields @('status', 'items') -Label $groupName
        foreach ($item in @($group.items)) {
            Test-RequiredFields -Value $item -RequiredFields @('id', 'verdict', 'source', 'projection', 'summary', 'safe') -Label "$groupName item '$($item.id)'"
            if ($item.verdict -eq 'unknown' -and $item.safe -ne $false) {
                Add-Failure "$groupName item '$($item.id)' must not be safe when verdict is unknown."
            }
            if ($item.verdict -eq 'fail' -and $item.safe -ne $false) {
                Add-Failure "$groupName item '$($item.id)' must not be safe when verdict is fail."
            }
        }
    }

    if ($report.unknownStateProof.verdict -ne 'unknown') {
        Add-Failure 'Evidence unknownStateProof must prove missing input becomes unknown.'
    }
    if ($report.unknownEvidence.status -ne 'unknown') {
        Add-Failure 'Evidence unknownEvidence group must stay unknown to prove missing evidence cannot pass.'
    }

    foreach ($flag in @('evidenceOnly', 'readOnly', 'derivedOnly', 'reportWritingOnly')) {
        Test-TrueFlag -Value $report.boundary -Field $flag -Label 'Authority monitoring evidence report'
    }
    foreach ($flag in @('ownsAuthority', 'ownsTruth', 'createsDecisions', 'createsApprovals', 'repairsProjection', 'synchronizesProjection', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeMutationAllowed', 'dashboardActionAllowed', 'approvalAutomationAllowed', 'workflowExecutionAllowed', 'browserAuthorityStorageAllowed')) {
        Test-FalseFlag -Value $report.boundary -Field $flag -Label 'Authority monitoring evidence report'
    }
    $checks.Add([ordered]@{ id = 'evidence-report'; status = 'checked'; pass = $report.summary.passCount; fail = $report.summary.failCount; unknown = $report.summary.unknownCount }) | Out-Null
}

$phase19Files = @(
    'shared/contracts/authority/evidence/authority-monitoring-evidence.schema.json',
    'shared/contracts/authority/evidence/evidence.manifest.json',
    'services/authority-evidence/README.md',
    'services/authority-evidence/generate-authority-monitoring-evidence.ps1',
    'scripts/validation/validate-authority-evidence-center.ps1',
    'runtime/authority/authority-monitoring-evidence.report.json',
    'docs/governance/AUTHORITY_MONITORING_EVIDENCE_CENTER.md',
    'docs/governance/PHASE_19_BOUNDARY_AUDIT.md'
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

foreach ($relativePath in $phase19Files) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }
    foreach ($pattern in $forbiddenPatterns) {
        $match = Select-String -LiteralPath $path -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($match) {
            Add-Failure "Forbidden Phase 19 capability pattern '$pattern' in $relativePath line $($match.LineNumber)."
        }
    }
}
$checks.Add([ordered]@{ id = 'phase-19-forbidden-pattern-scan'; status = 'checked'; files = @($phase19Files).Count }) | Out-Null

$reportStatus = 'failed'
$reportSummary = "Authority Monitoring Evidence Center validation failed with $($failures.Count) issue(s)."
if ($failures.Count -eq 0) {
    $reportStatus = 'passed'
    $reportSummary = 'Authority Monitoring Evidence Center passed deterministic read-only evidence and boundary checks.'
}

$validationReport = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-19'
    reportId = 'authority-monitoring-evidence-validation'
    status = $reportStatus
    summary = $reportSummary
    checks = $checks.ToArray()
    failures = $failures.ToArray()
    boundary = [ordered]@{
        machineReadableReportOnly = $true
        evidenceOnly = $true
        readOnly = $true
        derivedOnly = $true
        reportWritingOnly = $true
        ownsAuthority = $false
        ownsTruth = $false
        createsDecisions = $false
        createsApprovals = $false
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
        workflowExecutionAllowed = $false
        browserAuthorityStorageAllowed = $false
    }
}

Write-StudioJson -RelativePath 'runtime/authority/authority-monitoring-evidence-validation.report.json' -Value $validationReport

if ($failures.Count -gt 0) {
    Write-Host 'Phase 19 Authority Monitoring Evidence Center validation failed.' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'Phase 19 Authority Monitoring Evidence Center passed deterministic checks.' -ForegroundColor Green
exit 0
