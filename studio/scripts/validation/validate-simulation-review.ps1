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

function Read-ReviewJson {
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

& (Join-Path $PSScriptRoot 'validate-execution-simulation.ps1') | Out-Null
& (Join-Path $root 'services/simulation-review/generate-simulation-review.ps1') | Out-Null

$requiredPaths = @(
    'shared/contracts/simulation-review/simulation-review.schema.json',
    'shared/contracts/simulation-review/review.manifest.json',
    'services/simulation-review/README.md',
    'services/simulation-review/generate-simulation-review.ps1',
    'runtime/review/simulation-review.report.json',
    'runtime/review/simulation-review-validation.report.json',
    'scripts/validation/validate-simulation-review.ps1',
    'docs/governance/PHASE_23_SIMULATION_EVIDENCE_REVIEW.md',
    'docs/governance/PHASE_23_BOUNDARY_AUDIT.md'
)

foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        Add-Failure "Required Phase 23 simulation review artifact missing: $relativePath"
    }
}

$manifest = Read-ReviewJson -RelativePath 'shared/contracts/simulation-review/review.manifest.json'
$report = Read-ReviewJson -RelativePath 'runtime/review/simulation-review.report.json'

$trueFlags = @('reviewOnly', 'explanationOnly', 'readOnly', 'derivedOnly', 'reportWritingOnly', 'ownsReviewReports')
$falseFlags = @('ownsAuthorityTruth', 'ownsGovernanceTruth', 'ownsEvidenceTruth', 'ownsMonitoringTruth', 'ownsHistoryTruth', 'ownsObservabilityTruth', 'ownsSimulationTruth', 'createsDecisions', 'createsApprovals', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'workflowExecutionAllowed', 'commandExecutionAllowed', 'orchestrationAllowed', 'automationAllowed', 'repairAllowed', 'synchronizationAllowed', 'approvalWorkflowAllowed', 'approvalMutationAllowed', 'authorityMutationAllowed', 'evidenceMutationAllowed', 'simulationMutationAllowed', 'contractMutationAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeMutationAllowed', 'dashboardMutationAllowed', 'queueAllowed', 'workerAllowed', 'schedulerAllowed', 'backgroundJobAllowed', 'selfHealingAllowed', 'retryAllowed', 'providerAdapterAllowed', 'stateChangingRecommendationAllowed')

if ($null -ne $manifest) {
    Test-RequiredFields -Value $manifest -RequiredFields @('schemaVersion', 'phase', 'manifestId', 'sourceContracts', 'consumedRuntimeReports', 'runtimeReports', 'nonExecutable', 'boundary') -Label 'Simulation evidence review manifest'
    if ($manifest.phase -ne 'phase-23') { Add-Failure 'Simulation evidence review manifest phase must be phase-23.' }
    if ($manifest.nonExecutable -ne $true) { Add-Failure 'Simulation evidence review manifest must be nonExecutable=true.' }
    foreach ($path in @($manifest.runtimeReports)) {
        if ($path -notlike 'runtime/review/*.json') {
            Add-Failure "Simulation evidence review output must stay under runtime/review: $path"
        }
    }
    foreach ($flag in $trueFlags) { Test-Flag -Value $manifest.boundary -Field $flag -Expected $true -Label 'Simulation evidence review manifest' }
    foreach ($flag in $falseFlags) { Test-Flag -Value $manifest.boundary -Field $flag -Expected $false -Label 'Simulation evidence review manifest' }
    $checks.Add([ordered]@{ id = 'review-manifest'; status = 'checked'; consumedReports = @($manifest.consumedRuntimeReports).Count }) | Out-Null
}

if ($null -ne $report) {
    Test-RequiredFields -Value $report -RequiredFields @('schemaVersion', 'phase', 'reportId', 'generatedBy', 'generatedAt', 'reviewQuestion', 'sourceOfTruth', 'consumedReports', 'status', 'summary', 'outcomeReview', 'rootCauseClassification', 'evidenceAttribution', 'reviewConfidence', 'explainability', 'unknowns', 'boundary') -Label 'Simulation evidence review report'
    if ($report.phase -ne 'phase-23') { Add-Failure 'Simulation evidence review report phase must be phase-23.' }
    if ($report.generatedBy -ne 'services/simulation-review/generate-simulation-review.ps1') { Add-Failure 'Simulation evidence review report generatedBy must identify the Phase 23 generator.' }
    if ($report.summary.knownInputCount + $report.summary.unknownInputCount -ne @($report.consumedReports).Count) {
        Add-Failure 'Review known/unknown input counts must match consumed reports.'
    }
    foreach ($input in @($report.consumedReports)) {
        Test-RequiredFields -Value $input -RequiredFields @('path', 'role', 'exists', 'validJson', 'isStale', 'isComplete', 'verdict', 'reason') -Label "Review consumed report '$($input.path)'"
        if (($input.exists -ne $true -or $input.validJson -ne $true -or $input.isStale -eq $true -or $input.isComplete -ne $true) -and $input.verdict -ne 'unknown') {
            Add-Failure "Missing, unreadable, stale or incomplete review input '$($input.path)' must be unknown, not $($input.verdict)."
        }
    }
    foreach ($groupName in @('outcomeReview', 'rootCauseClassification', 'evidenceAttribution', 'reviewConfidence', 'explainability', 'unknowns')) {
        $group = $report.$groupName
        Test-RequiredFields -Value $group -RequiredFields @('status', 'items') -Label "Review $groupName"
        foreach ($item in @($group.items)) {
            Test-RequiredFields -Value $item -RequiredFields @('id', 'status', 'summary', 'source', 'safe') -Label "Review $groupName item '$($item.id)'"
            if ($item.status -ne 'pass' -and $item.safe -ne $false) {
                Add-Failure "Review $groupName item '$($item.id)' must not be safe when status is $($item.status)."
            }
        }
    }
    foreach ($flag in $trueFlags) { Test-Flag -Value $report.boundary -Field $flag -Expected $true -Label 'Simulation evidence review report' }
    foreach ($flag in $falseFlags) { Test-Flag -Value $report.boundary -Field $flag -Expected $false -Label 'Simulation evidence review report' }
    if (($report.summary.unknownInputCount -gt 0 -or $report.summary.unknownCount -gt 0 -or $report.summary.sourceSimulationStatus -eq 'unknown') -and $report.status -eq 'pass') {
        Add-Failure 'Simulation evidence review report must not pass while evidence, inputs or source simulation state are unknown.'
    }
    $checks.Add([ordered]@{ id = 'review-report'; status = 'checked'; statusValue = $report.status; reviewConfidenceScore = $report.summary.reviewConfidenceScore }) | Out-Null
}

$phase23Files = @(
    'shared/contracts/simulation-review/simulation-review.schema.json',
    'shared/contracts/simulation-review/review.manifest.json',
    'services/simulation-review/README.md',
    'services/simulation-review/generate-simulation-review.ps1',
    'scripts/validation/validate-simulation-review.ps1',
    'runtime/review/simulation-review.report.json',
    'docs/governance/PHASE_23_SIMULATION_EVIDENCE_REVIEW.md',
    'docs/governance/PHASE_23_BOUNDARY_AUDIT.md'
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

foreach ($relativePath in $phase23Files) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }
    foreach ($pattern in $forbiddenPatterns) {
        $match = Select-String -LiteralPath $path -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($match) {
            Add-Failure "Forbidden Phase 23 implementation pattern '$pattern' in $relativePath line $($match.LineNumber)."
        }
    }
}
$checks.Add([ordered]@{ id = 'phase-23-forbidden-pattern-scan'; status = 'checked'; files = @($phase23Files).Count }) | Out-Null

$reportStatus = 'failed'
$reportSummary = "Simulation evidence review validation failed with $($failures.Count) issue(s)."
if ($failures.Count -eq 0) {
    $reportStatus = 'passed'
    $reportSummary = 'Simulation evidence review passed deterministic explanation-only checks.'
}

$validationReport = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-23'
    reportId = 'simulation-review-validation'
    status = $reportStatus
    summary = $reportSummary
    checks = $checks.ToArray()
    failures = $failures.ToArray()
    boundary = [ordered]@{
        machineReadableReportOnly = $true
        reviewOnly = $true
        explanationOnly = $true
        readOnly = $true
        derivedOnly = $true
        reportWritingOnly = $true
        ownsReviewReports = $true
        ownsAuthorityTruth = $false
        ownsGovernanceTruth = $false
        ownsEvidenceTruth = $false
        ownsMonitoringTruth = $false
        ownsHistoryTruth = $false
        ownsObservabilityTruth = $false
        ownsSimulationTruth = $false
        createsDecisions = $false
        createsApprovals = $false
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        workflowExecutionAllowed = $false
        commandExecutionAllowed = $false
        orchestrationAllowed = $false
        automationAllowed = $false
        repairAllowed = $false
        synchronizationAllowed = $false
        approvalWorkflowAllowed = $false
        approvalMutationAllowed = $false
        authorityMutationAllowed = $false
        evidenceMutationAllowed = $false
        simulationMutationAllowed = $false
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
        stateChangingRecommendationAllowed = $false
    }
}

Write-StudioJson -RelativePath 'runtime/review/simulation-review-validation.report.json' -Value $validationReport

if ($failures.Count -gt 0) {
    Write-Host 'Phase 23 simulation evidence review validation failed.' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'Phase 23 simulation evidence review passed deterministic checks.' -ForegroundColor Green
exit 0
