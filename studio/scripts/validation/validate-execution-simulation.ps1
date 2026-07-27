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

function Read-SimulationJson {
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

& (Join-Path $PSScriptRoot 'validate-authority-observability.ps1') | Out-Null
& (Join-Path $root 'services/execution-simulation/generate-execution-simulation.ps1') | Out-Null

$requiredPaths = @(
    'shared/contracts/execution-simulation/execution-simulation.schema.json',
    'shared/contracts/execution-simulation/simulation.manifest.json',
    'services/execution-simulation/README.md',
    'services/execution-simulation/generate-execution-simulation.ps1',
    'runtime/simulation/execution-simulation.report.json',
    'scripts/validation/validate-execution-simulation.ps1',
    'docs/governance/PHASE_22_EXECUTION_GOVERNANCE_SIMULATION.md',
    'docs/governance/PHASE_22_BOUNDARY_AUDIT.md'
)

foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        Add-Failure "Required Phase 22 simulation artifact missing: $relativePath"
    }
}

$manifest = Read-SimulationJson -RelativePath 'shared/contracts/execution-simulation/simulation.manifest.json'
$report = Read-SimulationJson -RelativePath 'runtime/simulation/execution-simulation.report.json'

if ($null -ne $manifest) {
    Test-RequiredFields -Value $manifest -RequiredFields @('schemaVersion', 'phase', 'manifestId', 'sourceContracts', 'consumedRuntimeReports', 'runtimeReports', 'nonExecutable', 'boundary') -Label 'Execution governance simulation manifest'
    if ($manifest.phase -ne 'phase-22') { Add-Failure 'Execution governance simulation manifest phase must be phase-22.' }
    if ($manifest.nonExecutable -ne $true) { Add-Failure 'Execution governance simulation manifest must be nonExecutable=true.' }
    foreach ($path in @($manifest.runtimeReports)) {
        if ($path -notlike 'runtime/simulation/*.json') {
            Add-Failure "Execution governance simulation output must stay under runtime/simulation: $path"
        }
    }
    foreach ($flag in @('simulationOnly', 'hypotheticalOnly', 'readOnly', 'derivedOnly', 'reportWritingOnly', 'ownsSimulationReports')) {
        Test-Flag -Value $manifest.boundary -Field $flag -Expected $true -Label 'Execution governance simulation manifest'
    }
    foreach ($flag in @('ownsAuthorityTruth', 'ownsGovernanceTruth', 'ownsEvidenceTruth', 'ownsMonitoringTruth', 'ownsHistoryTruth', 'ownsObservabilityTruth', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'workflowExecutionAllowed', 'commandExecutionAllowed', 'orchestrationAllowed', 'automationAllowed', 'repairAllowed', 'synchronizationAllowed', 'approvalMutationAllowed', 'authorityMutationAllowed', 'evidenceMutationAllowed', 'contractMutationAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeMutationAllowed', 'dashboardMutationAllowed', 'queueAllowed', 'workerAllowed', 'schedulerAllowed', 'backgroundJobAllowed', 'selfHealingAllowed', 'retryAllowed', 'providerAdapterAllowed')) {
        Test-Flag -Value $manifest.boundary -Field $flag -Expected $false -Label 'Execution governance simulation manifest'
    }
    $checks.Add([ordered]@{ id = 'simulation-manifest'; status = 'checked'; consumedReports = @($manifest.consumedRuntimeReports).Count }) | Out-Null
}

if ($null -ne $report) {
    Test-RequiredFields -Value $report -RequiredFields @('schemaVersion', 'phase', 'reportId', 'generatedBy', 'generatedAt', 'simulationQuestion', 'sourceOfTruth', 'consumedReports', 'status', 'summary', 'readinessSimulation', 'governanceImpact', 'riskSimulation', 'readinessScoring', 'explainability', 'unknowns', 'boundary') -Label 'Execution governance simulation report'
    if ($report.phase -ne 'phase-22') { Add-Failure 'Execution governance simulation report phase must be phase-22.' }
    if ($report.generatedBy -ne 'services/execution-simulation/generate-execution-simulation.ps1') { Add-Failure 'Execution governance simulation report generatedBy must identify the Phase 22 generator.' }
    if ($report.summary.knownInputCount + $report.summary.unknownInputCount -ne @($report.consumedReports).Count) {
        Add-Failure 'Simulation known/unknown input counts must match consumed reports.'
    }
    foreach ($input in @($report.consumedReports)) {
        Test-RequiredFields -Value $input -RequiredFields @('path', 'role', 'exists', 'validJson', 'isStale', 'isComplete', 'verdict', 'reason') -Label "Simulation consumed report '$($input.path)'"
        if (($input.exists -ne $true -or $input.validJson -ne $true -or $input.isStale -eq $true -or $input.isComplete -ne $true) -and $input.verdict -ne 'unknown') {
            Add-Failure "Missing, unreadable, stale or incomplete simulation input '$($input.path)' must be unknown, not $($input.verdict)."
        }
    }
    foreach ($groupName in @('readinessSimulation', 'governanceImpact', 'riskSimulation', 'readinessScoring', 'explainability', 'unknowns')) {
        $group = $report.$groupName
        Test-RequiredFields -Value $group -RequiredFields @('status', 'items') -Label "Simulation $groupName"
        foreach ($item in @($group.items)) {
            Test-RequiredFields -Value $item -RequiredFields @('id', 'status', 'summary', 'source', 'safe') -Label "Simulation $groupName item '$($item.id)'"
            if ($item.status -ne 'pass' -and $item.safe -ne $false) {
                Add-Failure "Simulation $groupName item '$($item.id)' must not be safe when status is $($item.status)."
            }
        }
    }
    foreach ($flag in @('simulationOnly', 'hypotheticalOnly', 'readOnly', 'derivedOnly', 'reportWritingOnly', 'ownsSimulationReports')) {
        Test-Flag -Value $report.boundary -Field $flag -Expected $true -Label 'Execution governance simulation report'
    }
    foreach ($flag in @('ownsAuthorityTruth', 'ownsGovernanceTruth', 'ownsEvidenceTruth', 'ownsMonitoringTruth', 'ownsHistoryTruth', 'ownsObservabilityTruth', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'workflowExecutionAllowed', 'commandExecutionAllowed', 'orchestrationAllowed', 'automationAllowed', 'repairAllowed', 'synchronizationAllowed', 'approvalMutationAllowed', 'authorityMutationAllowed', 'evidenceMutationAllowed', 'contractMutationAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeMutationAllowed', 'dashboardMutationAllowed', 'queueAllowed', 'workerAllowed', 'schedulerAllowed', 'backgroundJobAllowed', 'selfHealingAllowed', 'retryAllowed', 'providerAdapterAllowed')) {
        Test-Flag -Value $report.boundary -Field $flag -Expected $false -Label 'Execution governance simulation report'
    }
    if ($report.status -eq 'pass') {
        Add-Failure 'Execution governance simulation report must not pass while upstream readiness denies execution or contains unknown states.'
    }
    $checks.Add([ordered]@{ id = 'simulation-report'; status = 'checked'; statusValue = $report.status; simulationReadinessScore = $report.summary.simulationReadinessScore }) | Out-Null
}

$phase22Files = @(
    'shared/contracts/execution-simulation/execution-simulation.schema.json',
    'shared/contracts/execution-simulation/simulation.manifest.json',
    'services/execution-simulation/README.md',
    'services/execution-simulation/generate-execution-simulation.ps1',
    'scripts/validation/validate-execution-simulation.ps1',
    'runtime/simulation/execution-simulation.report.json',
    'docs/governance/PHASE_22_EXECUTION_GOVERNANCE_SIMULATION.md',
    'docs/governance/PHASE_22_BOUNDARY_AUDIT.md'
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

foreach ($relativePath in $phase22Files) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }
    foreach ($pattern in $forbiddenPatterns) {
        $match = Select-String -LiteralPath $path -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($match) {
            Add-Failure "Forbidden Phase 22 implementation pattern '$pattern' in $relativePath line $($match.LineNumber)."
        }
    }
}
$checks.Add([ordered]@{ id = 'phase-22-forbidden-pattern-scan'; status = 'checked'; files = @($phase22Files).Count }) | Out-Null

$reportStatus = 'failed'
$reportSummary = "Execution governance simulation validation failed with $($failures.Count) issue(s)."
if ($failures.Count -eq 0) {
    $reportStatus = 'passed'
    $reportSummary = 'Execution governance simulation passed deterministic non-execution checks.'
}

$validationReport = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-22'
    reportId = 'execution-simulation-validation'
    status = $reportStatus
    summary = $reportSummary
    checks = $checks.ToArray()
    failures = $failures.ToArray()
    boundary = [ordered]@{
        machineReadableReportOnly = $true
        simulationOnly = $true
        hypotheticalOnly = $true
        readOnly = $true
        derivedOnly = $true
        reportWritingOnly = $true
        ownsSimulationReports = $true
        ownsAuthorityTruth = $false
        ownsGovernanceTruth = $false
        ownsEvidenceTruth = $false
        ownsMonitoringTruth = $false
        ownsHistoryTruth = $false
        ownsObservabilityTruth = $false
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        workflowExecutionAllowed = $false
        commandExecutionAllowed = $false
        orchestrationAllowed = $false
        automationAllowed = $false
        repairAllowed = $false
        synchronizationAllowed = $false
        approvalMutationAllowed = $false
        authorityMutationAllowed = $false
        evidenceMutationAllowed = $false
        contractMutationAllowed = $false
        credentialAccessAllowed = $false
        secretAccessAllowed = $false
        runtimeMutationAllowed = $false
        dashboardMutationAllowed = $false
        queueAllowed = $false
        workerAllowed = $false
        schedulerAllowed = $false
        backgroundJobAllowed = $false
        selfHealingAllowed = $false
        retryAllowed = $false
        providerAdapterAllowed = $false
    }
}

Write-StudioJson -RelativePath 'runtime/simulation/execution-simulation-validation.report.json' -Value $validationReport

if ($failures.Count -gt 0) {
    Write-Host 'Phase 22 execution governance simulation validation failed.' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'Phase 22 execution governance simulation passed deterministic checks.' -ForegroundColor Green
exit 0
