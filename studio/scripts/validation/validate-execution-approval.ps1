[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]

$contractRelativePath = 'shared/contracts/approval/execution-approval.contract.json'
$schemaRelativePath = 'shared/contracts/approval/execution-approval.schema.json'
$generatorRelativePath = 'services/execution-approval/generate-execution-approval.ps1'
$reportRelativePath = 'runtime/approval/execution-approval.report.json'
$auditRelativePath = 'runtime/approval/execution-approval.audit.json'
$recordsRelativePath = 'runtime/approval/execution-approval.records.json'

$requiredStates = @('UNKNOWN', 'REQUESTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED')
$requiredRecordFields = @('timestamp', 'approvalId', 'requestId', 'intentType', 'requestedAction', 'requestedByRole', 'approvalState', 'targetSystem', 'targetReference', 'riskLevel', 'humanApprovalRequired', 'requestedAt', 'expiresAt', 'approvedByRole', 'approvedAt', 'approvedByRequester', 'executionRefusedUntilApproved', 'executionDispatchAllowed', 'evidence', 'blockers')

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
        if ($property.Value -is [string] -and [string]::IsNullOrWhiteSpace($property.Value) -and $field -notin @('approvedByRole', 'approvedAt')) {
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
        approvalGatewayOnly = $true
        performsExecution = $false
        automaticExecution = $false
        backgroundWorkers = $false
        schedulers = $false
        queues = $false
        autonomousRunner = $false
        softwareFactory = $false
        providerExecution = $false
        deploymentExecution = $false
        mergeExecution = $false
        autoApproval = $false
        credentialAccess = $false
        secretAccess = $false
        repositorySettingsMutation = $false
        collaboratorMutation = $false
        protectedBranchWrites = $false
        agentAutonomy = $false
        selfHealingSystems = $false
        selfModifyingSystems = $false
        approvalBypass = $false
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
        ownsApprovalStatus = $true
        ownsApprovalEvidence = $true
        ownsApprovalAuditTrail = $true
        ownsExecutionTruth = $false
        ownsProviderTruth = $false
        ownsDeploymentTruth = $false
        ownsGithubTruth = $false
        ownsRuntimeTruth = $false
        ownsDashboardTruth = $false
    }

    foreach ($key in $expected.Keys) {
        $property = $Ownership.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $expected[$key]) {
            Add-Failure "$Context ownership '$key' must be $($expected[$key])."
        }
    }
}

function Test-ApprovalRecord {
    param(
        [Parameter(Mandatory)]$Record,
        [Parameter(Mandatory)][string]$Context
    )

    Test-RequiredFields -Value $Record -Fields $requiredRecordFields -Context $Context

    if ($Record.approvalState -notin $requiredStates) {
        Add-Failure "$Context has invalid approvalState '$($Record.approvalState)'."
    }
    if ($Record.humanApprovalRequired -ne $true) {
        Add-Failure "$Context must require human approval."
    }
    if ($Record.approvedByRequester -eq $true) {
        Add-Failure "$Context violates no-self-approval."
    }
    if ($Record.executionDispatchAllowed -ne $false) {
        Add-Failure "$Context must not dispatch execution."
    }
    if ($Record.approvalState -eq 'UNKNOWN' -and $Record.executionRefusedUntilApproved -ne $true) {
        Add-Failure "$Context UNKNOWN state must refuse execution."
    }
    if ($Record.approvalState -eq 'UNKNOWN' -and -not [string]::IsNullOrWhiteSpace([string]$Record.approvedAt)) {
        Add-Failure "$Context UNKNOWN state must not have approvedAt."
    }
    if ($Record.approvalState -eq 'APPROVED' -and $Record.approvedByRole -ne 'Human') {
        Add-Failure "$Context APPROVED state must be approved by Human."
    }
    if ($Record.approvalState -ne 'APPROVED' -and $Record.executionRefusedUntilApproved -ne $true) {
        Add-Failure "$Context non-approved state must refuse execution."
    }
}

$contract = Read-JsonForValidation -RelativePath $contractRelativePath
$schema = Read-JsonForValidation -RelativePath $schemaRelativePath

if ($null -ne $contract) {
    Test-RequiredFields -Value $contract -Fields @('schemaVersion', 'contractId', 'capability', 'mode', 'sourceOfTruth', 'schema', 'generatedReport', 'generatedAudit', 'generatedRecords', 'allowedApprovalStates', 'allowedIntentTypes', 'ownership', 'approvalRules', 'boundaries', 'approvalRequests') -Context 'Execution approval contract'

    foreach ($state in $requiredStates) {
        if ($state -notin @($contract.allowedApprovalStates)) {
            Add-Failure "Execution approval contract misses required state '$state'."
        }
    }
    Test-Ownership -Ownership $contract.ownership -Context 'Execution approval contract'
    Test-Boundaries -Boundaries $contract.boundaries -Context 'Execution approval contract'

    foreach ($rule in @('humanApprovalRequired', 'noAutomaticApproval', 'noApprovalBypass', 'noSelfApproval', 'unknownNeverAutoApproves', 'approvedDoesNotExecute', 'executionRequiresExternalExecutor')) {
        $property = $contract.approvalRules.PSObject.Properties[$rule]
        if ($null -eq $property -or $property.Value -ne $true) {
            Add-Failure "Execution approval rule '$rule' must be true."
        }
    }

    foreach ($record in @($contract.approvalRequests)) {
        $contractRecord = [pscustomobject]@{
            timestamp = $record.requestedAt
            approvalId = $record.approvalId
            requestId = $record.requestId
            intentType = $record.intentType
            requestedAction = $record.requestedAction
            requestedByRole = $record.requestedByRole
            approvalState = $record.approvalState
            targetSystem = $record.targetSystem
            targetReference = $record.targetReference
            riskLevel = $record.riskLevel
            humanApprovalRequired = $record.humanApprovalRequired
            requestedAt = $record.requestedAt
            expiresAt = $record.expiresAt
            approvedByRole = $record.approvedByRole
            approvedAt = $record.approvedAt
            approvedByRequester = $record.approvedByRequester
            executionRefusedUntilApproved = $record.executionRefusedUntilApproved
            executionDispatchAllowed = $record.executionDispatchAllowed
            evidence = $record.evidence
            blockers = $record.blockers
        }
        Test-ApprovalRecord -Record $contractRecord -Context "Execution approval contract record '$($record.approvalId)'"
    }
}

if ($null -ne $schema) {
    Test-RequiredFields -Value $schema -Fields @('$schema', '$id', 'title', 'type', 'required', 'properties') -Context 'Execution approval schema'
}

$generatorPath = Join-Path $root $generatorRelativePath
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure "Execution approval generator missing: $generatorRelativePath"
}

if ($failures.Count -eq 0) {
    & $generatorPath | Out-Null
}

$report = Read-JsonForValidation -RelativePath $reportRelativePath
$audit = Read-JsonForValidation -RelativePath $auditRelativePath
$recordsDocument = Read-JsonForValidation -RelativePath $recordsRelativePath

if ($null -ne $report) {
    Test-RequiredFields -Value $report -Fields @('schemaVersion', 'generatedAt', 'capability', 'status', 'summary', 'stateModel', 'ownership', 'approvalRules', 'boundaries', 'recordsFile', 'auditFile') -Context 'Execution approval report'
    Test-Ownership -Ownership $report.ownership -Context 'Execution approval report'
    Test-Boundaries -Boundaries $report.boundaries -Context 'Execution approval report'
    if ($report.summary.executionDispatched -ne $false -or $report.summary.autoApprovalAllowed -ne $false -or $report.summary.unknownAutoApproved -ne $false) {
        Add-Failure 'Execution approval report must not dispatch execution, allow auto approval, or auto-approve UNKNOWN.'
    }
}

if ($null -ne $audit) {
    Test-RequiredFields -Value $audit -Fields @('schemaVersion', 'generatedAt', 'capability', 'auditRequired', 'entries', 'boundaries', 'ownership') -Context 'Execution approval audit'
    if ($audit.auditRequired -ne $true) {
        Add-Failure 'Execution approval audit must set auditRequired=true.'
    }
    Test-Ownership -Ownership $audit.ownership -Context 'Execution approval audit'
    Test-Boundaries -Boundaries $audit.boundaries -Context 'Execution approval audit'
}

if ($null -ne $recordsDocument) {
    Test-RequiredFields -Value $recordsDocument -Fields @('schemaVersion', 'generatedAt', 'capability', 'sourceFile', 'allowedApprovalStates', 'records') -Context 'Execution approval records'
    foreach ($record in @($recordsDocument.records)) {
        Test-ApprovalRecord -Record $record -Context "Execution approval runtime record '$($record.approvalId)'"
    }
}

$scanPaths = @(
    $contractRelativePath,
    $schemaRelativePath,
    'services/execution-approval',
    $reportRelativePath,
    $auditRelativePath,
    $recordsRelativePath,
    'docs/governance/EXECUTION_APPROVAL_GATEWAY.md',
    'docs/governance/EXECUTION_APPROVAL_BOUNDARIES.md',
    'scripts/validation/validate-execution-approval.ps1'
)

$secretPatterns = @(
    'api[_-]?key\s*[:=]\s*["''][^"'']+["'']',
    'token\s*[:=]\s*["''][^"'']+["'']',
    'secret\s*[:=]\s*["''][^"'']+["'']',
    'password\s*[:=]\s*["''][^"'']+["'']',
    'Bearer\s+[A-Za-z0-9._~+/=-]+',
    'Cookie\s*[:=]',
    '-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----'
)
$forbiddenCapabilityPatterns = @(
    '"performsExecution"\s*:\s*true',
    '"automaticExecution"\s*:\s*true',
    '"backgroundWorkers"\s*:\s*true',
    '"schedulers"\s*:\s*true',
    '"queues"\s*:\s*true',
    '"autonomousRunner"\s*:\s*true',
    '"softwareFactory"\s*:\s*true',
    '"providerExecution"\s*:\s*true',
    '"deploymentExecution"\s*:\s*true',
    '"mergeExecution"\s*:\s*true',
    '"autoApproval"\s*:\s*true',
    '"approvalBypass"\s*:\s*true',
    ('Invoke-' + 'RestMethod'),
    ('Invoke-' + 'WebRequest'),
    'git\s+push',
    'gh\s+',
    ('Start-' + 'Job'),
    ('Register-' + 'ScheduledTask'),
    ('Start-' + 'ThreadJob')
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
                Add-Failure "Possible secret or credential found in execution approval artifact: $($file.FullName)"
            }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Forbidden execution approval capability found in artifact: $($file.FullName) pattern=$pattern"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "Execution approval validation failed with $($failures.Count) failure(s)."
}

Write-Host 'Studio OS Execution Approval Gateway passed deterministic checks.' -ForegroundColor Green
