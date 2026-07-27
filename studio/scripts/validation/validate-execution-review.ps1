[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]

$contractRelativePath = 'shared/contracts/execution-review/execution-review.contract.json'
$schemaRelativePath = 'shared/contracts/execution-review/execution-review.schema.json'
$preflightDecisionsRelativePath = 'runtime/execution-preflight/execution-preflight.decisions.json'
$preflightReportRelativePath = 'runtime/execution-preflight/execution-preflight.report.json'
$generatorRelativePath = 'services/execution-review/generate-execution-review.ps1'
$recordsRelativePath = 'runtime/execution-review/execution-review.records.json'
$auditRelativePath = 'runtime/execution-review/execution-review.audit.json'
$reportRelativePath = 'runtime/execution-review/execution-review.report.json'

$allowedReviewStates = @('UNKNOWN', 'BLOCKED', 'PENDING_REVIEW', 'APPROVED_FOR_DISPATCH', 'REJECTED', 'EXPIRED')
$requiredRecordFields = @('timestamp', 'reviewId', 'preflightId', 'requestId', 'sourceApprovalId', 'preflightState', 'reviewState', 'requestedAction', 'targetSystem', 'riskClassification', 'manualReviewRequired', 'manualEvidencePresent', 'executionDispatchAllowed', 'result', 'blockers')

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

function Test-Boundaries {
    param([Parameter(Mandatory)]$Boundaries, [Parameter(Mandatory)][string]$Context)
    $expected = @{
        manualReviewOnly = $true
        performsExecution = $false
        executionDispatch = $false
        automaticExecution = $false
        liveGitHubActionExecution = $false
        providerExecution = $false
        deploymentExecution = $false
        mergeExecution = $false
        approvalMutation = $false
        requestPackageMutation = $false
        preflightMutation = $false
        autoApproval = $false
        autoReviewApproval = $false
        autoMerge = $false
        backgroundWorkers = $false
        schedulers = $false
        queues = $false
        autonomousRunner = $false
        softwareFactory = $false
        secretAccess = $false
        credentialAccess = $false
        protectedBranchWrites = $false
        repositorySettingsMutation = $false
        collaboratorMutation = $false
        deploymentMutation = $false
        mutatesFilesOutsideRuntimeReports = $false
    }
    foreach ($key in $expected.Keys) {
        $property = $Boundaries.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $expected[$key]) {
            Add-Failure "$Context boundary '$key' must be $($expected[$key])."
        }
    }
}

function Test-Ownership {
    param([Parameter(Mandatory)]$Ownership, [Parameter(Mandatory)][string]$Context)
    $expected = @{
        ownsManualReviewRecords = $true
        ownsManualReviewAuditTrail = $true
        ownsManualReviewEvidence = $true
        ownsPreflightDecisions = $false
        ownsExecutionRequestPackages = $false
        ownsApprovalRecords = $false
        ownsExecutionTruth = $false
        ownsProviderTruth = $false
        ownsDeploymentTruth = $false
        ownsGithubTruth = $false
    }
    foreach ($key in $expected.Keys) {
        $property = $Ownership.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $expected[$key]) {
            Add-Failure "$Context ownership '$key' must be $($expected[$key])."
        }
    }
}

function Test-ReviewRecord {
    param(
        [Parameter(Mandatory)]$Record,
        [Parameter(Mandatory)]$PreflightDecision,
        [Parameter(Mandatory)][string]$Context
    )

    Test-RequiredFields -Value $Record -Fields $requiredRecordFields -Context $Context
    if ($Record.reviewState -notin $allowedReviewStates) {
        Add-Failure "$Context has invalid reviewState '$($Record.reviewState)'."
    }
    if ($Record.preflightId -ne $PreflightDecision.preflightId -or $Record.requestId -ne $PreflightDecision.requestId) {
        Add-Failure "$Context does not preserve preflight identity."
    }
    if ($Record.executionDispatchAllowed -ne $false) {
        Add-Failure "$Context must not allow execution dispatch."
    }
    if ($PreflightDecision.preflightState -eq 'UNKNOWN' -and $Record.reviewState -eq 'APPROVED_FOR_DISPATCH') {
        Add-Failure "$Context UNKNOWN must never become APPROVED_FOR_DISPATCH automatically."
    }
    if ($PreflightDecision.preflightState -eq 'READY_FOR_MANUAL_REVIEW' -and $Record.reviewState -ne 'PENDING_REVIEW') {
        Add-Failure "$Context READY_FOR_MANUAL_REVIEW must become PENDING_REVIEW only."
    }
    if ($PreflightDecision.preflightState -eq 'BLOCKED' -and $Record.reviewState -ne 'BLOCKED') {
        Add-Failure "$Context BLOCKED preflight decision must remain BLOCKED."
    }
    if ($PreflightDecision.preflightState -eq 'FAILED' -and $Record.reviewState -notin @('REJECTED', 'BLOCKED')) {
        Add-Failure "$Context FAILED preflight decision must become REJECTED or BLOCKED."
    }
    if ($Record.reviewState -eq 'APPROVED_FOR_DISPATCH' -and $Record.manualEvidencePresent -ne $true) {
        Add-Failure "$Context APPROVED_FOR_DISPATCH requires explicit manual review evidence."
    }
    if ($Record.reviewState -eq 'APPROVED_FOR_DISPATCH' -and $Record.executionDispatchAllowed -ne $false) {
        Add-Failure "$Context APPROVED_FOR_DISPATCH must not execute anything."
    }
}

$contract = Read-JsonForValidation -RelativePath $contractRelativePath
$schema = Read-JsonForValidation -RelativePath $schemaRelativePath
$preflightDecisions = Read-JsonForValidation -RelativePath $preflightDecisionsRelativePath
$preflightReport = Read-JsonForValidation -RelativePath $preflightReportRelativePath

if ($null -ne $contract) {
    Test-RequiredFields -Value $contract -Fields @('schemaVersion', 'contractId', 'capability', 'mode', 'sourceOfTruth', 'schema', 'preflightDecisionInput', 'preflightReportInput', 'generatedRecords', 'generatedAudit', 'generatedReport', 'allowedReviewStates', 'requiredManualEvidence', 'reviewRules', 'ownership', 'boundaries') -Context 'Execution review contract'
    foreach ($state in $allowedReviewStates) {
        if ($state -notin @($contract.allowedReviewStates)) {
            Add-Failure "Execution review contract misses required state '$state'."
        }
    }
    foreach ($rule in @('unknownNeverApprovesForDispatchAutomatically', 'onlyReadyForManualReviewMayBecomePendingReview', 'blockedPreflightRemainsBlocked', 'failedPreflightBecomesRejectedOrBlocked', 'approvedForDispatchRequiresManualEvidence', 'approvedForDispatchDoesNotExecute', 'reviewGateDoesNotMutateInputs', 'reviewGateDoesNotDispatch')) {
        $property = $contract.reviewRules.PSObject.Properties[$rule]
        if ($null -eq $property -or $property.Value -ne $true) {
            Add-Failure "Execution review rule '$rule' must be true."
        }
    }
    Test-Boundaries -Boundaries $contract.boundaries -Context 'Execution review contract'
    Test-Ownership -Ownership $contract.ownership -Context 'Execution review contract'
}

if ($null -ne $schema) {
    Test-RequiredFields -Value $schema -Fields @('$schema', '$id', 'title', 'type', 'required', 'properties') -Context 'Execution review schema'
}

if ($null -ne $preflightReport) {
    if ($preflightReport.summary.executionPerformed -ne $false -or $preflightReport.summary.executionDispatchAllowed -ne 0 -or $preflightReport.summary.externalCallsMade -ne $false) {
        Add-Failure 'Execution review input report must not show performed execution, dispatch, or external calls.'
    }
}

$generatorPath = Join-Path $root $generatorRelativePath
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure "Execution review generator missing: $generatorRelativePath"
}

if ($failures.Count -eq 0) {
    & $generatorPath | Out-Null
}

$recordsDocument = Read-JsonForValidation -RelativePath $recordsRelativePath
$audit = Read-JsonForValidation -RelativePath $auditRelativePath
$report = Read-JsonForValidation -RelativePath $reportRelativePath

$preflightById = @{}
if ($null -ne $preflightDecisions) {
    foreach ($decision in @($preflightDecisions.decisions)) {
        $preflightById[[string]$decision.preflightId] = $decision
    }
}

if ($null -ne $recordsDocument) {
    Test-RequiredFields -Value $recordsDocument -Fields @('schemaVersion', 'generatedAt', 'capability', 'sourceFile', 'preflightDecisionInput', 'preflightReportInput', 'allowedReviewStates', 'records') -Context 'Execution review records'
    foreach ($record in @($recordsDocument.records)) {
        if (-not $preflightById.ContainsKey([string]$record.preflightId)) {
            Add-Failure "Execution review record '$($record.reviewId)' references unknown preflight decision '$($record.preflightId)'."
            continue
        }
        Test-ReviewRecord -Record $record -PreflightDecision $preflightById[[string]$record.preflightId] -Context "Execution review record '$($record.reviewId)'"
    }
}

if ($null -ne $audit) {
    Test-RequiredFields -Value $audit -Fields @('schemaVersion', 'generatedAt', 'capability', 'auditRequired', 'entries', 'boundaries', 'ownership') -Context 'Execution review audit'
    if ($audit.auditRequired -ne $true) {
        Add-Failure 'Execution review audit must set auditRequired=true.'
    }
    Test-Boundaries -Boundaries $audit.boundaries -Context 'Execution review audit'
    Test-Ownership -Ownership $audit.ownership -Context 'Execution review audit'
}

if ($null -ne $report) {
    Test-RequiredFields -Value $report -Fields @('schemaVersion', 'generatedAt', 'capability', 'status', 'summary', 'reviewStates', 'reviewRules', 'boundaries', 'ownership', 'recordsFile', 'auditFile') -Context 'Execution review report'
    if ($report.summary.unknownApprovedAutomatically -ne $false -or $report.summary.approvedForDispatchWithoutManualEvidence -ne 0 -or $report.summary.executionDispatchAllowed -ne 0) {
        Add-Failure 'Execution review report must not auto-approve UNKNOWN, approve without evidence, or allow dispatch.'
    }
    if ($report.summary.executionPerformed -ne $false -or $report.summary.preflightMutated -ne $false -or $report.summary.requestPackagesMutated -ne $false -or $report.summary.approvalsMutated -ne $false -or $report.summary.externalCallsMade -ne $false) {
        Add-Failure 'Execution review report must not execute, mutate inputs, or call external systems.'
    }
    Test-Boundaries -Boundaries $report.boundaries -Context 'Execution review report'
    Test-Ownership -Ownership $report.ownership -Context 'Execution review report'
}

$scanPaths = @(
    $contractRelativePath,
    $schemaRelativePath,
    'services/execution-review',
    $recordsRelativePath,
    $auditRelativePath,
    $reportRelativePath,
    'docs/governance/EXECUTION_REVIEW_GATE.md',
    'docs/governance/EXECUTION_REVIEW_BOUNDARIES.md',
    'scripts/validation/validate-execution-review.ps1'
)
$secretPatterns = @(
    'api[_-]?key\s*[:=]\s*["''][^"'']+["'']',
    'token\s*[:=]\s*["''][^"'']+["'']',
    'secret\s*[:=]\s*["''][^"'']+["'']',
    'password\s*[:=]\s*["''][^"'']+["'']',
    'Bearer\s+[A-Za-z0-9._~+/=-]+',
    'Cookie\s*[:=]',
    'refresh[_-]?token\s*[:=]',
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
    '"performsExecution"\s*:\s*true',
    '"executionDispatch"\s*:\s*true',
    '"automaticExecution"\s*:\s*true',
    '"liveGitHubActionExecution"\s*:\s*true',
    '"providerExecution"\s*:\s*true',
    '"deploymentExecution"\s*:\s*true',
    '"mergeExecution"\s*:\s*true',
    '"approvalMutation"\s*:\s*true',
    '"requestPackageMutation"\s*:\s*true',
    '"preflightMutation"\s*:\s*true',
    '"autoApproval"\s*:\s*true',
    '"autoReviewApproval"\s*:\s*true',
    '"autoMerge"\s*:\s*true',
    '"backgroundWorkers"\s*:\s*true',
    '"schedulers"\s*:\s*true',
    '"queues"\s*:\s*true',
    '"autonomousRunner"\s*:\s*true',
    '"softwareFactory"\s*:\s*true',
    '"secretAccess"\s*:\s*true',
    '"credentialAccess"\s*:\s*true',
    '"protectedBranchWrites"\s*:\s*true',
    '"repositorySettingsMutation"\s*:\s*true',
    '"collaboratorMutation"\s*:\s*true',
    '"deploymentMutation"\s*:\s*true',
    '"mutatesFilesOutsideRuntimeReports"\s*:\s*true'
)

foreach ($relativePath in $scanPaths) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path)) {
        continue
    }
    $files = if (Test-Path -LiteralPath $path -PathType Container) {
        Get-ChildItem -LiteralPath $path -File -Recurse
    }
    else {
        Get-Item -LiteralPath $path
    }
    foreach ($file in $files) {
        $content = Get-Content -LiteralPath $file.FullName -Raw
        foreach ($pattern in $secretPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Possible secret or credential found in execution review artifact: $($file.FullName)"
            }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Forbidden execution review capability found in artifact: $($file.FullName) pattern=$pattern"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "Execution review validation failed with $($failures.Count) failure(s)."
}

Write-Host 'Studio OS V2.6 Manual Execution Review Gate passed deterministic checks.' -ForegroundColor Green
