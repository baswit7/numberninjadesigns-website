[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]

$contractRelativePath = 'shared/contracts/execution-preflight/execution-preflight.contract.json'
$schemaRelativePath = 'shared/contracts/execution-preflight/execution-preflight.schema.json'
$packagesRelativePath = 'runtime/execution-request/execution-request.packages.json'
$requestReportRelativePath = 'runtime/execution-request/execution-request.report.json'
$generatorRelativePath = 'services/execution-preflight/generate-execution-preflight.ps1'
$decisionsRelativePath = 'runtime/execution-preflight/execution-preflight.decisions.json'
$auditRelativePath = 'runtime/execution-preflight/execution-preflight.audit.json'
$reportRelativePath = 'runtime/execution-preflight/execution-preflight.report.json'

$allowedPreflightStates = @('UNKNOWN', 'BLOCKED', 'FAILED', 'PASSED', 'READY_FOR_MANUAL_REVIEW')
$requiredDecisionFields = @('timestamp', 'preflightId', 'requestId', 'sourceApprovalId', 'approvalState', 'requestedAction', 'targetSystem', 'packageReadinessState', 'preflightState', 'riskClassification', 'executionDispatchAllowed', 'result', 'checks', 'blockers')

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

function Test-ArrayContainsAll {
    param(
        [Parameter(Mandatory)]$Actual,
        [Parameter(Mandatory)]$Expected,
        [Parameter(Mandatory)][string]$Context
    )

    foreach ($item in @($Expected)) {
        if ($item -notin @($Actual)) {
            Add-Failure "$Context misses '$item'."
        }
    }
}

function Test-Boundaries {
    param(
        [Parameter(Mandatory)]$Boundaries,
        [Parameter(Mandatory)][string]$Context
    )

    $expected = @{
        preflightOnly = $true
        performsExecution = $false
        automaticExecution = $false
        dispatchExecution = $false
        liveGitHubActionExecution = $false
        providerExecution = $false
        deploymentExecution = $false
        mergeExecution = $false
        approvalMutation = $false
        requestPackageMutation = $false
        autoApproval = $false
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
    param(
        [Parameter(Mandatory)]$Ownership,
        [Parameter(Mandatory)][string]$Context
    )

    $expected = @{
        ownsPreflightDecisions = $true
        ownsPreflightAuditTrail = $true
        ownsPreflightEvidence = $true
        ownsExecutionRequestPackages = $false
        ownsApprovalStatus = $false
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

function Test-PreflightDecision {
    param(
        [Parameter(Mandatory)]$Decision,
        [Parameter(Mandatory)]$Package,
        [Parameter(Mandatory)]$Contract,
        [Parameter(Mandatory)][string]$Context
    )

    Test-RequiredFields -Value $Decision -Fields $requiredDecisionFields -Context $Context

    if ($Decision.preflightState -notin $allowedPreflightStates) {
        Add-Failure "$Context has invalid preflightState '$($Decision.preflightState)'."
    }
    if ($Decision.requestId -ne $Package.requestId -or $Decision.sourceApprovalId -ne $Package.sourceApprovalId) {
        Add-Failure "$Context does not preserve package identity."
    }
    if ($Decision.executionDispatchAllowed -ne $false) {
        Add-Failure "$Context must not allow execution dispatch."
    }
    if ($Package.approvalState -eq 'UNKNOWN' -and $Decision.preflightState -eq 'PASSED') {
        Add-Failure "$Context UNKNOWN approval must never become PASSED."
    }
    if ($Package.executionReadinessState -eq 'BLOCKED' -and $Decision.preflightState -ne 'BLOCKED') {
        Add-Failure "$Context BLOCKED package must remain BLOCKED."
    }
    if ($Package.executionDispatchAllowed -ne $false -and $Decision.preflightState -ne 'FAILED') {
        Add-Failure "$Context package with executionDispatchAllowed != false must fail."
    }
    foreach ($validator in @($Contract.requiredPackageValidators)) {
        if ($validator -notin @($Package.requiredValidators) -and $Decision.preflightState -ne 'FAILED') {
            Add-Failure "$Context package without required validator '$validator' must fail."
        }
    }
    foreach ($evidence in @($Contract.requiredPackageEvidence)) {
        if ($evidence -notin @($Package.requiredEvidence) -and $Decision.preflightState -ne 'FAILED') {
            Add-Failure "$Context package without required evidence '$evidence' must fail."
        }
    }
    if ($Package.allowedActionType -in @($Package.deniedActionTypes) -and $Decision.preflightState -ne 'FAILED') {
        Add-Failure "$Context package with denied action type must fail."
    }
    if ($Decision.preflightState -eq 'READY_FOR_MANUAL_REVIEW' -and $Package.executionReadinessState -ne 'READY_FOR_REVIEW') {
        Add-Failure "$Context only READY_FOR_REVIEW packages may become READY_FOR_MANUAL_REVIEW."
    }
    if ($Decision.preflightState -in @('PASSED', 'READY_FOR_MANUAL_REVIEW') -and $Decision.executionDispatchAllowed -ne $false) {
        Add-Failure "$Context PASSED or READY_FOR_MANUAL_REVIEW must not mean executed."
    }
}

$contract = Read-JsonForValidation -RelativePath $contractRelativePath
$schema = Read-JsonForValidation -RelativePath $schemaRelativePath
$packageDocument = Read-JsonForValidation -RelativePath $packagesRelativePath
$requestReport = Read-JsonForValidation -RelativePath $requestReportRelativePath

if ($null -ne $contract) {
    Test-RequiredFields -Value $contract -Fields @('schemaVersion', 'contractId', 'capability', 'mode', 'sourceOfTruth', 'schema', 'packageInput', 'packageReportInput', 'generatedDecisions', 'generatedAudit', 'generatedReport', 'allowedPreflightStates', 'requiredPackageEvidence', 'requiredPackageValidators', 'preflightRules', 'ownership', 'boundaries') -Context 'Execution preflight contract'

    foreach ($state in $allowedPreflightStates) {
        if ($state -notin @($contract.allowedPreflightStates)) {
            Add-Failure "Execution preflight contract misses required state '$state'."
        }
    }
    foreach ($rule in @('unknownNeverPassesAutomatically', 'blockedPackagesRemainBlocked', 'dispatchAllowedMustFail', 'missingRequiredValidatorsMustFail', 'missingRequiredEvidenceMustFail', 'deniedActionTypesMustFail', 'onlyReadyForReviewMayBecomeReadyForManualReview', 'passedDoesNotMeanExecuted', 'readyForManualReviewDoesNotMeanExecuted', 'preflightDoesNotExecute')) {
        $property = $contract.preflightRules.PSObject.Properties[$rule]
        if ($null -eq $property -or $property.Value -ne $true) {
            Add-Failure "Execution preflight rule '$rule' must be true."
        }
    }
    Test-Boundaries -Boundaries $contract.boundaries -Context 'Execution preflight contract'
    Test-Ownership -Ownership $contract.ownership -Context 'Execution preflight contract'
}

if ($null -ne $schema) {
    Test-RequiredFields -Value $schema -Fields @('$schema', '$id', 'title', 'type', 'required', 'properties') -Context 'Execution preflight schema'
}

if ($null -ne $packageDocument -and $null -ne $contract) {
    foreach ($package in @($packageDocument.packages)) {
        Test-ArrayContainsAll -Actual $package.requiredValidators -Expected $contract.requiredPackageValidators -Context "Execution request package '$($package.requestId)' required validators"
        Test-ArrayContainsAll -Actual $package.requiredEvidence -Expected $contract.requiredPackageEvidence -Context "Execution request package '$($package.requestId)' required evidence"
    }
}

if ($null -ne $requestReport) {
    if ($requestReport.summary.executionDispatched -ne $false -or $requestReport.summary.externalCallsMade -ne $false) {
        Add-Failure 'Execution preflight input report must not show dispatched execution or external calls.'
    }
}

$generatorPath = Join-Path $root $generatorRelativePath
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure "Execution preflight generator missing: $generatorRelativePath"
}

if ($failures.Count -eq 0) {
    & $generatorPath | Out-Null
}

$decisionsDocument = Read-JsonForValidation -RelativePath $decisionsRelativePath
$audit = Read-JsonForValidation -RelativePath $auditRelativePath
$report = Read-JsonForValidation -RelativePath $reportRelativePath

$packageByRequestId = @{}
if ($null -ne $packageDocument) {
    foreach ($package in @($packageDocument.packages)) {
        $packageByRequestId[[string]$package.requestId] = $package
    }
}

if ($null -ne $decisionsDocument) {
    Test-RequiredFields -Value $decisionsDocument -Fields @('schemaVersion', 'generatedAt', 'capability', 'sourceFile', 'packageInput', 'packageReportInput', 'allowedPreflightStates', 'decisions') -Context 'Execution preflight decisions'
    foreach ($decision in @($decisionsDocument.decisions)) {
        if (-not $packageByRequestId.ContainsKey([string]$decision.requestId)) {
            Add-Failure "Execution preflight decision '$($decision.preflightId)' references unknown request package '$($decision.requestId)'."
            continue
        }
        Test-PreflightDecision -Decision $decision -Package $packageByRequestId[[string]$decision.requestId] -Contract $contract -Context "Execution preflight decision '$($decision.preflightId)'"
    }
}

if ($null -ne $audit) {
    Test-RequiredFields -Value $audit -Fields @('schemaVersion', 'generatedAt', 'capability', 'auditRequired', 'entries', 'boundaries', 'ownership') -Context 'Execution preflight audit'
    if ($audit.auditRequired -ne $true) {
        Add-Failure 'Execution preflight audit must set auditRequired=true.'
    }
    Test-Boundaries -Boundaries $audit.boundaries -Context 'Execution preflight audit'
    Test-Ownership -Ownership $audit.ownership -Context 'Execution preflight audit'
}

if ($null -ne $report) {
    Test-RequiredFields -Value $report -Fields @('schemaVersion', 'generatedAt', 'capability', 'status', 'summary', 'preflightStates', 'preflightRules', 'boundaries', 'ownership', 'decisionsFile', 'auditFile') -Context 'Execution preflight report'
    if ($report.summary.unknownPassedAutomatically -ne $false) {
        Add-Failure 'Execution preflight report must prove UNKNOWN never became PASSED.'
    }
    if ($report.summary.executionDispatchAllowed -ne 0 -or $report.summary.executionPerformed -ne $false -or $report.summary.requestPackagesMutated -ne $false -or $report.summary.externalCallsMade -ne $false) {
        Add-Failure 'Execution preflight report must not dispatch execution, execute, mutate packages, or make external calls.'
    }
    Test-Boundaries -Boundaries $report.boundaries -Context 'Execution preflight report'
    Test-Ownership -Ownership $report.ownership -Context 'Execution preflight report'
}

$scanPaths = @(
    $contractRelativePath,
    $schemaRelativePath,
    'services/execution-preflight',
    $decisionsRelativePath,
    $auditRelativePath,
    $reportRelativePath,
    'docs/governance/EXECUTION_PREFLIGHT_GATE.md',
    'docs/governance/EXECUTION_PREFLIGHT_BOUNDARIES.md',
    'scripts/validation/validate-execution-preflight.ps1'
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
    'netlify\s+deploy(\s|$)',
    'firebase\s+deploy(\s|$)',
    '"performsExecution"\s*:\s*true',
    '"automaticExecution"\s*:\s*true',
    '"dispatchExecution"\s*:\s*true',
    '"liveGitHubActionExecution"\s*:\s*true',
    '"providerExecution"\s*:\s*true',
    '"deploymentExecution"\s*:\s*true',
    '"mergeExecution"\s*:\s*true',
    '"approvalMutation"\s*:\s*true',
    '"requestPackageMutation"\s*:\s*true',
    '"autoApproval"\s*:\s*true',
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
                Add-Failure "Possible secret or credential found in execution preflight artifact: $($file.FullName)"
            }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Forbidden execution preflight capability found in artifact: $($file.FullName) pattern=$pattern"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "Execution preflight validation failed with $($failures.Count) failure(s)."
}

Write-Host 'Studio OS V2.5 Execution Preflight Gate passed deterministic checks.' -ForegroundColor Green
