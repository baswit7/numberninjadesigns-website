[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]

$contractRelativePath = 'shared/contracts/execution-dispatch/execution-dispatch.contract.json'
$schemaRelativePath = 'shared/contracts/execution-dispatch/execution-dispatch.schema.json'
$reviewRecordsRelativePath = 'runtime/execution-review/execution-review.records.json'
$reviewReportRelativePath = 'runtime/execution-review/execution-review.report.json'
$generatorRelativePath = 'services/execution-dispatch/generate-execution-dispatch-registry.ps1'
$registryRelativePath = 'runtime/execution-dispatch/execution-dispatch.registry.json'
$auditRelativePath = 'runtime/execution-dispatch/execution-dispatch.audit.json'
$reportRelativePath = 'runtime/execution-dispatch/execution-dispatch.report.json'

$allowedDispatchStates = @('UNKNOWN', 'BLOCKED', 'DISPATCH_ELIGIBLE', 'DISPATCH_DENIED', 'EXPIRED')
$requiredEntryFields = @('timestamp', 'dispatchId', 'reviewId', 'requestId', 'sourceApprovalId', 'reviewState', 'dispatchState', 'requestedAction', 'targetSystem', 'riskClassification', 'dispatchEligible', 'executionTriggered', 'providerActionTriggered', 'githubActionTriggered', 'result', 'blockers')

function Add-Failure { param([Parameter(Mandatory)][string]$Message) $failures.Add($Message) | Out-Null }

function Read-JsonForValidation {
    param([Parameter(Mandatory)][string]$RelativePath)
    $path = Join-Path $root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Required JSON file missing: $RelativePath"
        return $null
    }
    try { return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json }
    catch {
        Add-Failure "Invalid JSON in $RelativePath. $($_.Exception.Message)"
        return $null
    }
}

function Test-RequiredFields {
    param([Parameter(Mandatory)]$Value, [Parameter(Mandatory)][string[]]$Fields, [Parameter(Mandatory)][string]$Context)
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
        registryOnly = $true
        performsExecution = $false
        dispatchEngine = $false
        providerExecution = $false
        githubExecution = $false
        deploymentExecution = $false
        mergeExecution = $false
        automaticExecution = $false
        automaticDispatch = $false
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
        ownsDispatchEligibility = $true
        ownsDispatchEvidence = $true
        ownsDispatchAuditTrail = $true
        ownsExecution = $false
        ownsProviderTruth = $false
        ownsGithubTruth = $false
        ownsDeploymentTruth = $false
        ownsRuntimeTruth = $false
    }
    foreach ($key in $expected.Keys) {
        $property = $Ownership.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $expected[$key]) {
            Add-Failure "$Context ownership '$key' must be $($expected[$key])."
        }
    }
}

function Test-DispatchEntry {
    param([Parameter(Mandatory)]$Entry, [Parameter(Mandatory)]$ReviewRecord, [Parameter(Mandatory)][string]$Context)

    Test-RequiredFields -Value $Entry -Fields $requiredEntryFields -Context $Context
    if ($Entry.dispatchState -notin $allowedDispatchStates) {
        Add-Failure "$Context has invalid dispatchState '$($Entry.dispatchState)'."
    }
    if ($Entry.reviewId -ne $ReviewRecord.reviewId -or $Entry.requestId -ne $ReviewRecord.requestId) {
        Add-Failure "$Context does not preserve review identity."
    }
    if ($Entry.reviewState -eq 'UNKNOWN' -and $Entry.dispatchState -eq 'DISPATCH_ELIGIBLE') {
        Add-Failure "$Context UNKNOWN never becomes DISPATCH_ELIGIBLE."
    }
    if ($Entry.reviewState -eq 'PENDING_REVIEW' -and $Entry.dispatchState -eq 'DISPATCH_ELIGIBLE') {
        Add-Failure "$Context PENDING_REVIEW never becomes DISPATCH_ELIGIBLE."
    }
    if ($Entry.reviewState -eq 'BLOCKED' -and $Entry.dispatchState -ne 'BLOCKED') {
        Add-Failure "$Context BLOCKED must remain BLOCKED."
    }
    if ($Entry.reviewState -eq 'APPROVED_FOR_DISPATCH' -and $Entry.dispatchState -ne 'DISPATCH_ELIGIBLE') {
        Add-Failure "$Context APPROVED_FOR_DISPATCH may become DISPATCH_ELIGIBLE."
    }
    if ($Entry.dispatchState -eq 'DISPATCH_ELIGIBLE' -and $Entry.dispatchEligible -ne $true) {
        Add-Failure "$Context DISPATCH_ELIGIBLE must set dispatchEligible=true."
    }
    if ($Entry.dispatchState -ne 'DISPATCH_ELIGIBLE' -and $Entry.dispatchEligible -ne $false) {
        Add-Failure "$Context non-eligible states must set dispatchEligible=false."
    }
    if ($Entry.executionTriggered -ne $false -or $Entry.providerActionTriggered -ne $false -or $Entry.githubActionTriggered -ne $false) {
        Add-Failure "$Context must not trigger execution, provider actions or GitHub actions."
    }
}

$contract = Read-JsonForValidation -RelativePath $contractRelativePath
$schema = Read-JsonForValidation -RelativePath $schemaRelativePath
$reviewRecords = Read-JsonForValidation -RelativePath $reviewRecordsRelativePath
$reviewReport = Read-JsonForValidation -RelativePath $reviewReportRelativePath

if ($null -ne $contract) {
    Test-RequiredFields -Value $contract -Fields @('schemaVersion', 'contractId', 'capability', 'mode', 'sourceOfTruth', 'schema', 'reviewRecordsInput', 'reviewReportInput', 'generatedRegistry', 'generatedAudit', 'generatedReport', 'allowedDispatchStates', 'dispatchRules', 'ownership', 'boundaries') -Context 'Execution dispatch contract'
    foreach ($state in $allowedDispatchStates) {
        if ($state -notin @($contract.allowedDispatchStates)) { Add-Failure "Execution dispatch contract misses required state '$state'." }
    }
    foreach ($rule in @('unknownNeverDispatchEligible', 'pendingReviewNeverDispatchEligible', 'blockedRemainsBlocked', 'approvedForDispatchMayBecomeDispatchEligible', 'noStateCausesExecution', 'noStateTriggersExecution', 'noStateTriggersProviderActions', 'noStateTriggersGitHubActions')) {
        $property = $contract.dispatchRules.PSObject.Properties[$rule]
        if ($null -eq $property -or $property.Value -ne $true) { Add-Failure "Execution dispatch rule '$rule' must be true." }
    }
    Test-Boundaries -Boundaries $contract.boundaries -Context 'Execution dispatch contract'
    Test-Ownership -Ownership $contract.ownership -Context 'Execution dispatch contract'
}

if ($null -ne $schema) {
    Test-RequiredFields -Value $schema -Fields @('$schema', '$id', 'title', 'type', 'required', 'properties') -Context 'Execution dispatch schema'
}

if ($null -ne $reviewReport) {
    if ($reviewReport.summary.executionPerformed -ne $false -or $reviewReport.summary.executionDispatchAllowed -ne 0 -or $reviewReport.summary.externalCallsMade -ne $false) {
        Add-Failure 'Execution dispatch input report must not show performed execution, dispatch, or external calls.'
    }
}

$generatorPath = Join-Path $root $generatorRelativePath
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) { Add-Failure "Execution dispatch generator missing: $generatorRelativePath" }
if ($failures.Count -eq 0) { & $generatorPath | Out-Null }

$registry = Read-JsonForValidation -RelativePath $registryRelativePath
$audit = Read-JsonForValidation -RelativePath $auditRelativePath
$report = Read-JsonForValidation -RelativePath $reportRelativePath

$reviewById = @{}
if ($null -ne $reviewRecords) {
    foreach ($record in @($reviewRecords.records)) { $reviewById[[string]$record.reviewId] = $record }
}

if ($null -ne $registry) {
    Test-RequiredFields -Value $registry -Fields @('schemaVersion', 'generatedAt', 'capability', 'sourceFile', 'reviewRecordsInput', 'reviewReportInput', 'allowedDispatchStates', 'entries') -Context 'Execution dispatch registry'
    foreach ($entry in @($registry.entries)) {
        if (-not $reviewById.ContainsKey([string]$entry.reviewId)) {
            Add-Failure "Execution dispatch entry '$($entry.dispatchId)' references unknown review '$($entry.reviewId)'."
            continue
        }
        Test-DispatchEntry -Entry $entry -ReviewRecord $reviewById[[string]$entry.reviewId] -Context "Execution dispatch entry '$($entry.dispatchId)'"
    }
}

if ($null -ne $audit) {
    Test-RequiredFields -Value $audit -Fields @('schemaVersion', 'generatedAt', 'capability', 'auditRequired', 'entries', 'boundaries', 'ownership') -Context 'Execution dispatch audit'
    if ($audit.auditRequired -ne $true) { Add-Failure 'Execution dispatch audit must set auditRequired=true.' }
    Test-Boundaries -Boundaries $audit.boundaries -Context 'Execution dispatch audit'
    Test-Ownership -Ownership $audit.ownership -Context 'Execution dispatch audit'
}

if ($null -ne $report) {
    Test-RequiredFields -Value $report -Fields @('schemaVersion', 'generatedAt', 'capability', 'status', 'summary', 'dispatchStates', 'dispatchRules', 'boundaries', 'ownership', 'registryFile', 'auditFile') -Context 'Execution dispatch report'
    if ($report.summary.unknownDispatchEligible -ne 0 -or $report.summary.pendingReviewDispatchEligible -ne 0 -or $report.summary.triggeredActions -ne 0) {
        Add-Failure 'Execution dispatch report must not make UNKNOWN/PENDING_REVIEW eligible or trigger actions.'
    }
    if ($report.summary.executionPerformed -ne $false -or $report.summary.automaticDispatch -ne $false -or $report.summary.externalCallsMade -ne $false) {
        Add-Failure 'Execution dispatch report must not execute, dispatch automatically, or call external systems.'
    }
    Test-Boundaries -Boundaries $report.boundaries -Context 'Execution dispatch report'
    Test-Ownership -Ownership $report.ownership -Context 'Execution dispatch report'
}

$scanPaths = @(
    $contractRelativePath,
    $schemaRelativePath,
    'services/execution-dispatch',
    $registryRelativePath,
    $auditRelativePath,
    $reportRelativePath,
    'docs/governance/EXECUTION_DISPATCH_REGISTRY.md',
    'docs/governance/EXECUTION_DISPATCH_BOUNDARIES.md',
    'scripts/validation/validate-execution-dispatch.ps1'
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
    '"performsExecution"\s*:\s*true',
    '"dispatchEngine"\s*:\s*true',
    '"providerExecution"\s*:\s*true',
    '"githubExecution"\s*:\s*true',
    '"deploymentExecution"\s*:\s*true',
    '"mergeExecution"\s*:\s*true',
    '"automaticExecution"\s*:\s*true',
    '"automaticDispatch"\s*:\s*true',
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
    '"mutatesFilesOutsideRuntimeReports"\s*:\s*true'
)

foreach ($relativePath in $scanPaths) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path)) { continue }
    $files = if (Test-Path -LiteralPath $path -PathType Container) { Get-ChildItem -LiteralPath $path -File -Recurse } else { Get-Item -LiteralPath $path }
    foreach ($file in $files) {
        $content = Get-Content -LiteralPath $file.FullName -Raw
        foreach ($pattern in $secretPatterns) { if ($content -match $pattern) { Add-Failure "Possible secret or credential found in execution dispatch artifact: $($file.FullName)" } }
        foreach ($pattern in $forbiddenCapabilityPatterns) { if ($content -match $pattern) { Add-Failure "Forbidden execution dispatch capability found in artifact: $($file.FullName) pattern=$pattern" } }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "Execution dispatch validation failed with $($failures.Count) failure(s)."
}

Write-Host 'Studio OS V2.7 Execution Dispatch Registry passed deterministic checks.' -ForegroundColor Green
