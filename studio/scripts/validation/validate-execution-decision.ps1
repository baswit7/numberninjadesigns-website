[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]
$checks = New-Object System.Collections.Generic.List[object]
$allowedDecisionStates = @('PASS', 'FAIL', 'BLOCKED', 'UNKNOWN')

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message) | Out-Null
}

function Read-DecisionJson {
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

function Test-DecisionState {
    param(
        [Parameter(Mandatory)][string]$State,
        [Parameter(Mandatory)][string]$Label
    )

    if ($State -notin $allowedDecisionStates) {
        Add-Failure "$Label uses invalid decision state '$State'."
    }
}

& (Join-Path $PSScriptRoot 'validate-simulation-review.ps1') | Out-Null
& (Join-Path $root 'services/execution-decision/generate-execution-decision.ps1') | Out-Null

$requiredPaths = @(
    'shared/contracts/decision/decision.contract.json',
    'shared/contracts/decision/decision-report.schema.json',
    'services/execution-decision/README.md',
    'services/execution-decision/generate-execution-decision.ps1',
    'runtime/decision/execution-readiness-decision.report.json',
    'runtime/decision/execution-readiness-decision-summary.json',
    'runtime/decision/execution-readiness-decision-validation.report.json',
    'scripts/validation/validate-execution-decision.ps1',
    'docs/governance/PHASE_24_EXECUTION_DECISION_REPORT.md'
)

foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        Add-Failure "Required Phase 24 decision artifact missing: $relativePath"
    }
}

$contract = Read-DecisionJson -RelativePath 'shared/contracts/decision/decision.contract.json'
$schema = Read-DecisionJson -RelativePath 'shared/contracts/decision/decision-report.schema.json'
$report = Read-DecisionJson -RelativePath 'runtime/decision/execution-readiness-decision.report.json'
$summary = Read-DecisionJson -RelativePath 'runtime/decision/execution-readiness-decision-summary.json'

$trueFlags = @('decisionOnly', 'readOnly', 'derivedOnly', 'reportWritingOnly', 'ownsDecisionReports')
$falseFlags = @('ownsAuthorityTruth', 'ownsEvidenceTruth', 'ownsMonitoringTruth', 'ownsHistoryTruth', 'ownsObservabilityTruth', 'ownsSimulationTruth', 'ownsReviewTruth', 'ownsDashboardTruth', 'ownsRuntimeTruth', 'createsApprovals', 'approvalWorkflowAllowed', 'approvalMutationAllowed', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'workflowExecutionAllowed', 'commandExecutionAllowed', 'queueAllowed', 'workerAllowed', 'schedulerAllowed', 'repairAllowed', 'autoRemediationAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeMutationAllowed', 'dashboardMutationAllowed', 'localStorageAuthorityAllowed', 'sessionStorageAuthorityAllowed', 'backgroundExecutionAllowed')

if ($null -ne $contract) {
    Test-RequiredFields -Value $contract -RequiredFields @('schemaVersion', 'phase', 'contractId', 'allowedDecisionStates', 'sourceReports', 'runtimeReports', 'nonExecutable', 'manualOverrideSupported', 'approvalSupported', 'exceptionEditingSupported', 'boundary') -Label 'Execution decision contract'
    if ($contract.phase -ne 'phase-24') { Add-Failure 'Execution decision contract phase must be phase-24.' }
    $contractStates = (@($contract.allowedDecisionStates | Sort-Object) -join ',')
    $expectedStates = (@($allowedDecisionStates | Sort-Object) -join ',')
    if ($contractStates -ne $expectedStates) {
        Add-Failure 'Execution decision contract must define exactly PASS, FAIL, BLOCKED and UNKNOWN.'
    }
    if ($contract.nonExecutable -ne $true) { Add-Failure 'Execution decision contract must be nonExecutable=true.' }
    if ($contract.manualOverrideSupported -ne $false) { Add-Failure 'Execution decision contract must not support manual overrides.' }
    if ($contract.approvalSupported -ne $false) { Add-Failure 'Execution decision contract must not support approvals.' }
    if ($contract.exceptionEditingSupported -ne $false) { Add-Failure 'Execution decision contract must not support exception editing.' }
    foreach ($path in @($contract.runtimeReports)) {
        if ($path -notlike 'runtime/decision/*.json') {
            Add-Failure "Execution decision output must stay under runtime/decision: $path"
        }
    }
    foreach ($flag in $trueFlags) { Test-Flag -Value $contract.boundary -Field $flag -Expected $true -Label 'Execution decision contract' }
    foreach ($flag in $falseFlags) { Test-Flag -Value $contract.boundary -Field $flag -Expected $false -Label 'Execution decision contract' }
    $checks.Add([ordered]@{ id = 'decision-contract'; status = 'checked'; sourceReports = @($contract.sourceReports).Count }) | Out-Null
}

if ($null -ne $schema) {
    Test-RequiredFields -Value $schema -RequiredFields @('$schema', '$id', 'title', 'type', 'required', 'properties') -Label 'Execution decision schema'
    $schemaText = Get-Content -LiteralPath (Join-Path $root 'shared/contracts/decision/decision-report.schema.json') -Raw
    foreach ($state in $allowedDecisionStates) {
        if ($schemaText -notmatch ('"' + $state + '"')) {
            Add-Failure "Execution decision schema does not include allowed state $state."
        }
    }
    $checks.Add([ordered]@{ id = 'decision-schema'; status = 'checked' }) | Out-Null
}

if ($null -ne $report) {
    Test-RequiredFields -Value $report -RequiredFields @('schemaVersion', 'phase', 'reportId', 'generatedBy', 'generatedAt', 'decisionQuestion', 'decision', 'sourceOfTruth', 'consumedReports', 'summary', 'reasons', 'blockingConditions', 'requiredEvidence', 'missingInputs', 'unknownPropagation', 'boundary') -Label 'Execution readiness decision report'
    if ($report.phase -ne 'phase-24') { Add-Failure 'Execution readiness decision report phase must be phase-24.' }
    if ($report.generatedBy -ne 'services/execution-decision/generate-execution-decision.ps1') { Add-Failure 'Execution readiness decision report generatedBy must identify the Phase 24 generator.' }
    Test-DecisionState -State ([string]$report.decision) -Label 'Execution readiness decision report'
    if ($report.summary.knownInputCount + $report.summary.unknownInputCount -ne @($report.consumedReports).Count) {
        Add-Failure 'Decision known/unknown input counts must match consumed reports.'
    }
    foreach ($input in @($report.consumedReports)) {
        Test-RequiredFields -Value $input -RequiredFields @('path', 'role', 'exists', 'validJson', 'isStale', 'isComplete', 'verdict', 'reason') -Label "Decision consumed report '$($input.path)'"
        if (($input.exists -ne $true -or $input.validJson -ne $true -or $input.isStale -eq $true -or $input.isComplete -ne $true) -and $input.verdict -ne 'unknown') {
            Add-Failure "Missing, unreadable, stale or incomplete decision input '$($input.path)' must be unknown, not $($input.verdict)."
        }
    }
    foreach ($collectionName in @('reasons', 'blockingConditions', 'requiredEvidence', 'missingInputs')) {
        foreach ($item in @($report.$collectionName)) {
            Test-RequiredFields -Value $item -RequiredFields @('id', 'state', 'summary', 'source', 'authoritative') -Label "Decision $collectionName item '$($item.id)'"
            Test-DecisionState -State ([string]$item.state) -Label "Decision $collectionName item '$($item.id)'"
            if ($item.authoritative -ne $false) {
                Add-Failure "Decision $collectionName item '$($item.id)' must be non-authoritative."
            }
        }
    }
    Test-RequiredFields -Value $report.unknownPropagation -RequiredFields @('status', 'items') -Label 'Decision unknownPropagation'
    Test-DecisionState -State ([string]$report.unknownPropagation.status) -Label 'Decision unknownPropagation'
    foreach ($item in @($report.unknownPropagation.items)) {
        Test-RequiredFields -Value $item -RequiredFields @('id', 'state', 'summary', 'source', 'authoritative') -Label "Decision unknownPropagation item '$($item.id)'"
        Test-DecisionState -State ([string]$item.state) -Label "Decision unknownPropagation item '$($item.id)'"
        if ($item.authoritative -ne $false) {
            Add-Failure "Decision unknownPropagation item '$($item.id)' must be non-authoritative."
        }
    }
    foreach ($flag in $trueFlags) { Test-Flag -Value $report.boundary -Field $flag -Expected $true -Label 'Execution readiness decision report' }
    foreach ($flag in $falseFlags) { Test-Flag -Value $report.boundary -Field $flag -Expected $false -Label 'Execution readiness decision report' }
    if (($report.summary.unknownInputCount -gt 0 -or $report.summary.sourceSimulationStatus -eq 'unknown' -or $report.summary.sourceReviewStatus -eq 'unknown' -or $report.unknownPropagation.status -eq 'UNKNOWN') -and $report.decision -eq 'PASS') {
        Add-Failure 'Execution readiness decision must not PASS while inputs, simulation, review or unknownPropagation are UNKNOWN.'
    }
    if ($report.summary.blockingConditionCount -gt 0 -and $report.decision -eq 'PASS') {
        Add-Failure 'Execution readiness decision must not PASS while blocking conditions exist.'
    }
    $checks.Add([ordered]@{ id = 'decision-report'; status = 'checked'; decision = $report.decision; unknownPropagation = $report.unknownPropagation.status }) | Out-Null
}

if ($null -ne $summary) {
    Test-RequiredFields -Value $summary -RequiredFields @('schemaVersion', 'phase', 'reportId', 'generatedBy', 'generatedAt', 'decision', 'reasonCount', 'blockingConditionCount', 'missingInputCount', 'unknownPropagationStatus', 'sourceSimulationStatus', 'sourceReviewStatus', 'authoritative', 'executionAllowed') -Label 'Execution readiness decision summary'
    Test-DecisionState -State ([string]$summary.decision) -Label 'Execution readiness decision summary'
    Test-DecisionState -State ([string]$summary.unknownPropagationStatus) -Label 'Execution readiness decision summary unknownPropagationStatus'
    if ($summary.authoritative -ne $false) { Add-Failure 'Execution readiness decision summary must be non-authoritative.' }
    if ($summary.executionAllowed -ne $false) { Add-Failure 'Execution readiness decision summary must keep executionAllowed=false.' }
    if ($null -ne $report -and $summary.decision -ne $report.decision) {
        Add-Failure 'Execution readiness decision summary decision must match report decision.'
    }
    $checks.Add([ordered]@{ id = 'decision-summary'; status = 'checked'; decision = $summary.decision }) | Out-Null
}

$phase24Files = @(
    'shared/contracts/decision/decision.contract.json',
    'shared/contracts/decision/decision-report.schema.json',
    'services/execution-decision/README.md',
    'services/execution-decision/generate-execution-decision.ps1',
    'scripts/validation/validate-execution-decision.ps1',
    'runtime/decision/execution-readiness-decision.report.json',
    'runtime/decision/execution-readiness-decision-summary.json',
    'docs/governance/PHASE_24_EXECUTION_DECISION_REPORT.md'
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
    ('local' + 'Storage\.'),
    ('session' + 'Storage\.'),
    ('window\.local' + 'Storage'),
    ('window\.session' + 'Storage')
)

foreach ($relativePath in $phase24Files) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }
    foreach ($pattern in $forbiddenPatterns) {
        $match = Select-String -LiteralPath $path -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($match) {
            Add-Failure "Forbidden Phase 24 implementation pattern '$pattern' in $relativePath line $($match.LineNumber)."
        }
    }
}
$checks.Add([ordered]@{ id = 'phase-24-forbidden-pattern-scan'; status = 'checked'; files = @($phase24Files).Count }) | Out-Null

$reportStatus = 'failed'
$reportSummary = "Execution readiness decision validation failed with $($failures.Count) issue(s)."
if ($failures.Count -eq 0) {
    $reportStatus = 'passed'
    $reportSummary = 'Execution readiness decision passed deterministic read-only checks.'
}

$validationReport = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-24'
    reportId = 'execution-readiness-decision-validation'
    status = $reportStatus
    summary = $reportSummary
    checks = $checks.ToArray()
    failures = $failures.ToArray()
    boundary = [ordered]@{
        machineReadableReportOnly = $true
        decisionOnly = $true
        readOnly = $true
        derivedOnly = $true
        reportWritingOnly = $true
        ownsDecisionReports = $true
        ownsAuthorityTruth = $false
        ownsEvidenceTruth = $false
        ownsMonitoringTruth = $false
        ownsHistoryTruth = $false
        ownsObservabilityTruth = $false
        ownsSimulationTruth = $false
        ownsReviewTruth = $false
        ownsDashboardTruth = $false
        ownsRuntimeTruth = $false
        createsApprovals = $false
        approvalWorkflowAllowed = $false
        approvalMutationAllowed = $false
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        workflowExecutionAllowed = $false
        commandExecutionAllowed = $false
        queueAllowed = $false
        workerAllowed = $false
        schedulerAllowed = $false
        repairAllowed = $false
        autoRemediationAllowed = $false
        credentialAccessAllowed = $false
        secretAccessAllowed = $false
        runtimeMutationAllowed = $false
        dashboardMutationAllowed = $false
        localStorageAuthorityAllowed = $false
        sessionStorageAuthorityAllowed = $false
        backgroundExecutionAllowed = $false
    }
}

Write-StudioJson -RelativePath 'runtime/decision/execution-readiness-decision-validation.report.json' -Value $validationReport

if ($failures.Count -gt 0) {
    Write-Host 'Phase 24 execution readiness decision validation failed.' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'Phase 24 execution readiness decision passed deterministic checks.' -ForegroundColor Green
exit 0
