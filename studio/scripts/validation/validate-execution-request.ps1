[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]

$contractRelativePath = 'shared/contracts/execution-request/execution-request.contract.json'
$schemaRelativePath = 'shared/contracts/execution-request/execution-request.schema.json'
$approvalRecordsRelativePath = 'runtime/approval/execution-approval.records.json'
$generatorRelativePath = 'services/execution-request/generate-execution-request-package.ps1'
$packagesRelativePath = 'runtime/execution-request/execution-request.packages.json'
$auditRelativePath = 'runtime/execution-request/execution-request.audit.json'
$reportRelativePath = 'runtime/execution-request/execution-request.report.json'

$allowedReadinessStates = @('UNKNOWN', 'BLOCKED', 'PACKAGED', 'READY_FOR_REVIEW', 'REJECTED')
$requiredPackageFields = @('timestamp', 'requestId', 'sourceApprovalId', 'approvalState', 'requestedAction', 'targetSystem', 'allowedActionType', 'deniedActionTypes', 'requiredEvidence', 'requiredValidators', 'riskClassification', 'executionReadinessState', 'executionDispatchAllowed', 'packagedOnly', 'result', 'blockers')

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
    param(
        [Parameter(Mandatory)]$Boundaries,
        [Parameter(Mandatory)][string]$Context
    )

    $expected = @{
        packagingOnly = $true
        performsExecution = $false
        automaticExecution = $false
        liveGitHubActionExecution = $false
        providerExecution = $false
        deploymentExecution = $false
        mergeExecution = $false
        approvalMutation = $false
        autoApproval = $false
        backgroundWorkers = $false
        schedulers = $false
        queues = $false
        autonomousRunner = $false
        softwareFactory = $false
        selfHealing = $false
        secretAccess = $false
        credentialAccess = $false
        repositorySettingsMutation = $false
        collaboratorMutation = $false
        protectedBranchWrites = $false
        mutatesBranches = $false
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
        ownsExecutionRequestPackages = $true
        ownsExecutionRequestAuditTrail = $true
        ownsExecutionRequestEvidence = $true
        ownsApprovalStatus = $false
        ownsApprovalMutation = $false
        ownsExecutionTruth = $false
        ownsProviderTruth = $false
        ownsDeploymentTruth = $false
        ownsGithubTruth = $false
        ownsRuntimeTruthOutsideExecutionRequest = $false
    }

    foreach ($key in $expected.Keys) {
        $property = $Ownership.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $expected[$key]) {
            Add-Failure "$Context ownership '$key' must be $($expected[$key])."
        }
    }
}

function Test-ExecutionRequestPackage {
    param(
        [Parameter(Mandatory)]$Package,
        [Parameter(Mandatory)]$SourceRecord,
        [Parameter(Mandatory)]$Contract,
        [Parameter(Mandatory)][string]$Context
    )

    Test-RequiredFields -Value $Package -Fields $requiredPackageFields -Context $Context

    if ($Package.executionReadinessState -notin $allowedReadinessStates) {
        Add-Failure "$Context has invalid executionReadinessState '$($Package.executionReadinessState)'."
    }
    if ($Package.sourceApprovalId -ne $SourceRecord.approvalId) {
        Add-Failure "$Context does not preserve source approval id."
    }
    if ($Package.approvalState -ne $SourceRecord.approvalState) {
        Add-Failure "$Context does not preserve approval state."
    }
    if ($Package.requestedAction -ne $SourceRecord.requestedAction -or $Package.allowedActionType -ne $SourceRecord.requestedAction) {
        Add-Failure "$Context must package the requested action as the allowed action type."
    }
    if ($Package.targetSystem -ne $SourceRecord.targetSystem) {
        Add-Failure "$Context does not preserve target system."
    }
    if ($Package.executionDispatchAllowed -ne $false) {
        Add-Failure "$Context must not allow execution dispatch."
    }
    if ($Package.packagedOnly -ne $true) {
        Add-Failure "$Context must be packaging-only."
    }
    if ($Package.approvalState -eq 'UNKNOWN' -and $Package.executionReadinessState -eq 'READY_FOR_REVIEW') {
        Add-Failure "$Context UNKNOWN approval must never become READY_FOR_REVIEW."
    }
    if ($Package.approvalState -notin @('APPROVED', 'REJECTED') -and $Package.executionReadinessState -ne 'BLOCKED') {
        Add-Failure "$Context unapproved action must become BLOCKED."
    }
    if ($Package.approvalState -eq 'REJECTED' -and $Package.executionReadinessState -ne 'REJECTED') {
        Add-Failure "$Context rejected action must become REJECTED."
    }
    if ($Package.approvalState -eq 'APPROVED' -and $Package.executionReadinessState -ne 'READY_FOR_REVIEW') {
        Add-Failure "$Context approved action must become READY_FOR_REVIEW."
    }
    foreach ($deniedAction in @($Contract.deniedActionTypes)) {
        if ($deniedAction -notin @($Package.deniedActionTypes)) {
            Add-Failure "$Context misses denied action type '$deniedAction'."
        }
    }
    foreach ($validator in @($Contract.requiredValidators)) {
        if ($validator -notin @($Package.requiredValidators)) {
            Add-Failure "$Context misses required validator '$validator'."
        }
    }
}

$contract = Read-JsonForValidation -RelativePath $contractRelativePath
$schema = Read-JsonForValidation -RelativePath $schemaRelativePath
$approvalRecords = Read-JsonForValidation -RelativePath $approvalRecordsRelativePath

if ($null -ne $contract) {
    Test-RequiredFields -Value $contract -Fields @('schemaVersion', 'contractId', 'capability', 'mode', 'sourceOfTruth', 'schema', 'approvalRecordsSource', 'generatedPackages', 'generatedAudit', 'generatedReport', 'allowedReadinessStates', 'allowedTargetSystems', 'allowedActionTypes', 'deniedActionTypes', 'requiredEvidence', 'requiredValidators', 'readinessRules', 'ownership', 'boundaries') -Context 'Execution request contract'

    foreach ($state in $allowedReadinessStates) {
        if ($state -notin @($contract.allowedReadinessStates)) {
            Add-Failure "Execution request contract misses required readiness state '$state'."
        }
    }
    foreach ($rule in @('unknownNeverReadyForReview', 'unapprovedActionsBlocked', 'rejectedActionsRejected', 'approvedActionsReadyForReview', 'packagedDoesNotExecute', 'noApprovalMutation', 'noProviderCalls', 'noDeploymentCalls', 'noGitHubCalls')) {
        $property = $contract.readinessRules.PSObject.Properties[$rule]
        if ($null -eq $property -or $property.Value -ne $true) {
            Add-Failure "Execution request readiness rule '$rule' must be true."
        }
    }
    Test-Boundaries -Boundaries $contract.boundaries -Context 'Execution request contract'
    Test-Ownership -Ownership $contract.ownership -Context 'Execution request contract'
}

if ($null -ne $schema) {
    Test-RequiredFields -Value $schema -Fields @('$schema', '$id', 'title', 'type', 'required', 'properties') -Context 'Execution request schema'
}

$generatorPath = Join-Path $root $generatorRelativePath
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure "Execution request generator missing: $generatorRelativePath"
}

if ($failures.Count -eq 0) {
    & $generatorPath | Out-Null
}

$packagesDocument = Read-JsonForValidation -RelativePath $packagesRelativePath
$audit = Read-JsonForValidation -RelativePath $auditRelativePath
$report = Read-JsonForValidation -RelativePath $reportRelativePath

$approvalById = @{}
if ($null -ne $approvalRecords) {
    foreach ($record in @($approvalRecords.records)) {
        $approvalById[[string]$record.approvalId] = $record
    }
}

if ($null -ne $packagesDocument) {
    Test-RequiredFields -Value $packagesDocument -Fields @('schemaVersion', 'generatedAt', 'capability', 'sourceFile', 'approvalRecordsSource', 'allowedReadinessStates', 'packages') -Context 'Execution request packages'
    foreach ($package in @($packagesDocument.packages)) {
        if (-not $approvalById.ContainsKey([string]$package.sourceApprovalId)) {
            Add-Failure "Execution request package '$($package.requestId)' references unknown approval '$($package.sourceApprovalId)'."
            continue
        }
        Test-ExecutionRequestPackage -Package $package -SourceRecord $approvalById[[string]$package.sourceApprovalId] -Contract $contract -Context "Execution request package '$($package.requestId)'"
    }
}

if ($null -ne $audit) {
    Test-RequiredFields -Value $audit -Fields @('schemaVersion', 'generatedAt', 'capability', 'auditRequired', 'entries', 'boundaries', 'ownership') -Context 'Execution request audit'
    if ($audit.auditRequired -ne $true) {
        Add-Failure 'Execution request audit must set auditRequired=true.'
    }
    Test-Boundaries -Boundaries $audit.boundaries -Context 'Execution request audit'
    Test-Ownership -Ownership $audit.ownership -Context 'Execution request audit'
}

if ($null -ne $report) {
    Test-RequiredFields -Value $report -Fields @('schemaVersion', 'generatedAt', 'capability', 'status', 'summary', 'readinessStates', 'readinessRules', 'boundaries', 'ownership', 'packagesFile', 'auditFile') -Context 'Execution request report'
    if ($report.summary.unknownAutoReadyForReview -ne $false) {
        Add-Failure 'Execution request report must prove UNKNOWN never became READY_FOR_REVIEW.'
    }
    if ($report.summary.executionDispatched -ne $false -or $report.summary.approvalsMutated -ne $false -or $report.summary.externalCallsMade -ne $false) {
        Add-Failure 'Execution request report must not dispatch execution, mutate approvals, or make external calls.'
    }
    Test-Boundaries -Boundaries $report.boundaries -Context 'Execution request report'
    Test-Ownership -Ownership $report.ownership -Context 'Execution request report'
}

$scanPaths = @(
    $contractRelativePath,
    $schemaRelativePath,
    'services/execution-request',
    $packagesRelativePath,
    $auditRelativePath,
    $reportRelativePath,
    'docs/governance/EXECUTION_REQUEST_PACKAGER.md',
    'docs/governance/EXECUTION_REQUEST_BOUNDARIES.md',
    'scripts/validation/validate-execution-request.ps1'
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
    '"liveGitHubActionExecution"\s*:\s*true',
    '"providerExecution"\s*:\s*true',
    '"deploymentExecution"\s*:\s*true',
    '"mergeExecution"\s*:\s*true',
    '"approvalMutation"\s*:\s*true',
    '"autoApproval"\s*:\s*true',
    '"backgroundWorkers"\s*:\s*true',
    '"schedulers"\s*:\s*true',
    '"queues"\s*:\s*true',
    '"autonomousRunner"\s*:\s*true',
    '"softwareFactory"\s*:\s*true',
    '"secretAccess"\s*:\s*true',
    '"credentialAccess"\s*:\s*true',
    '"repositorySettingsMutation"\s*:\s*true',
    '"collaboratorMutation"\s*:\s*true',
    '"protectedBranchWrites"\s*:\s*true',
    '"mutatesBranches"\s*:\s*true',
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
                Add-Failure "Possible secret or credential found in execution request artifact: $($file.FullName)"
            }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Forbidden execution request capability found in artifact: $($file.FullName) pattern=$pattern"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "Execution request validation failed with $($failures.Count) failure(s)."
}

Write-Host 'Studio OS V2.4 Execution Request Packager passed deterministic checks.' -ForegroundColor Green
