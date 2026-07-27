[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]

$contractRelativePath = 'shared/contracts/github-execution/github-execution.contract.json'
$schemaRelativePath = 'shared/contracts/github-execution/github-execution.schema.json'
$generatorRelativePath = 'services/github-execution/generate-github-execution-plan.ps1'
$planRelativePath = 'runtime/github-execution/github-execution.plan.json'
$auditRelativePath = 'runtime/github-execution/github-execution.audit.json'
$approvalRelativePath = 'runtime/github-execution/github-execution-approval.report.json'

$allowedActionTypes = @(
    'BRANCH_CREATE',
    'COMMIT_CREATE',
    'PULL_REQUEST_CREATE',
    'DIFF_INSPECT',
    'REVIEW_GENERATE',
    'MERGE_RECOMMENDATION'
)
$allowedExecutionStates = @(
    'PLANNED',
    'READY_FOR_APPROVAL',
    'APPROVED',
    'REJECTED',
    'EXECUTED',
    'FAILED'
)
$allowedRequestingRoles = @('Orchestrator', 'Architect', 'Developer', 'QA')
$allowedBlockingRoles = @('QA', 'Security', 'Human')
$approvalRequiredActions = @('BRANCH_CREATE', 'COMMIT_CREATE', 'PULL_REQUEST_CREATE', 'MERGE_RECOMMENDATION')
$protectedBranches = @('main', 'master', 'production', 'release')
$requiredAuditFields = @('timestamp', 'requestId', 'requesterRole', 'action', 'targetRepository', 'targetBranch', 'result', 'approvalStatus')
$requiredActionFields = @('timestamp', 'requestId', 'requesterRole', 'actionType', 'targetRepository', 'targetBranch', 'sourceBranch', 'approvalState', 'executionState', 'result', 'blockers', 'riskLevel', 'humanApprovalRequired')

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

function Test-BooleanBoundary {
    param(
        [Parameter(Mandatory)]$Boundaries,
        [Parameter(Mandatory)][hashtable]$Expected,
        [Parameter(Mandatory)][string]$Context
    )

    foreach ($key in $Expected.Keys) {
        $property = $Boundaries.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $Expected[$key]) {
            Add-Failure "$Context boundary '$key' must be $($Expected[$key])."
        }
    }
}

$contract = Read-JsonForValidation -RelativePath $contractRelativePath
$schema = Read-JsonForValidation -RelativePath $schemaRelativePath

if ($null -ne $contract) {
    Test-RequiredFields -Value $contract -Fields @('schemaVersion', 'contractId', 'capability', 'mode', 'allowedActionTypes', 'allowedExecutionStates', 'allowedRequestingRoles', 'allowedBlockingRoles', 'humanApprovalRequiredActionTypes', 'protectedBranches', 'auditRequiredFields', 'approvalRules', 'boundaries', 'requests') -Context 'GitHub execution contract'

    foreach ($actionType in @($contract.allowedActionTypes)) {
        if ($actionType -notin $allowedActionTypes) {
            Add-Failure "Contract contains unsupported action type: $actionType"
        }
    }
    foreach ($state in @($contract.allowedExecutionStates)) {
        if ($state -notin $allowedExecutionStates) {
            Add-Failure "Contract contains unsupported execution state: $state"
        }
    }
    foreach ($role in @($contract.allowedRequestingRoles)) {
        if ($role -notin $allowedRequestingRoles) {
            Add-Failure "Contract contains unsupported requesting role: $role"
        }
    }
    foreach ($role in @($contract.allowedBlockingRoles)) {
        if ($role -notin $allowedBlockingRoles) {
            Add-Failure "Contract contains unsupported blocking role: $role"
        }
    }
    foreach ($requiredAction in $approvalRequiredActions) {
        if ($requiredAction -notin @($contract.humanApprovalRequiredActionTypes)) {
            Add-Failure "Contract must require human approval for action type: $requiredAction"
        }
    }

    $expectedContractBoundaries = @{
        offlinePlanningOnly = $true
        githubOnly = $true
        performsGitHubApiCalls = $false
        performsProviderCalls = $false
        performsDeployments = $false
        storesCredentials = $false
        storesSecrets = $false
        readsSecretValues = $false
        createsBackgroundJobs = $false
        createsWorkers = $false
        createsQueues = $false
        createsSchedulers = $false
        autonomousExecution = $false
        automaticMerging = $false
        automaticRebasing = $false
        directProtectedBranchWrites = $false
        aiWorkforceRuntimeExecution = $false
        softwareFactory = $false
    }
    Test-BooleanBoundary -Boundaries $contract.boundaries -Expected $expectedContractBoundaries -Context 'GitHub execution contract'

    foreach ($request in @($contract.requests)) {
        Test-RequiredFields -Value $request -Fields @('requestId', 'requesterRole', 'actionType', 'targetRepository', 'targetBranch', 'sourceBranch', 'approvalState', 'executionState', 'result', 'blockers', 'riskLevel', 'humanApprovalRequired', 'writesTargetBranch', 'directProtectedBranchWrite', 'preparedByRole', 'approverRole', 'approvedByRequester') -Context "GitHub execution request '$($request.requestId)'"

        if ($request.actionType -notin $allowedActionTypes) {
            Add-Failure "Request '$($request.requestId)' uses unsupported action type '$($request.actionType)'."
        }
        if ($request.executionState -notin $allowedExecutionStates) {
            Add-Failure "Request '$($request.requestId)' uses unsupported execution state '$($request.executionState)'."
        }
        if ($request.approvalState -notin $allowedExecutionStates) {
            Add-Failure "Request '$($request.requestId)' uses unsupported approval state '$($request.approvalState)'."
        }
        if ($request.requesterRole -notin $allowedRequestingRoles) {
            Add-Failure "Request '$($request.requestId)' uses unsupported requester role '$($request.requesterRole)'."
        }
        foreach ($blocker in @($request.blockers)) {
            if ($null -ne $blocker.PSObject.Properties['role'] -and $blocker.role -notin $allowedBlockingRoles) {
                Add-Failure "Request '$($request.requestId)' uses unsupported blocker role '$($blocker.role)'."
            }
        }
        if ($request.actionType -in $approvalRequiredActions -and $request.humanApprovalRequired -ne $true) {
            Add-Failure "Request '$($request.requestId)' must require human approval."
        }
        if ($request.actionType -in $approvalRequiredActions -and $request.approverRole -ne 'Human') {
            Add-Failure "Request '$($request.requestId)' must use Human as approver role."
        }
        if ($request.approvedByRequester -eq $true) {
            Add-Failure "Request '$($request.requestId)' violates no-self-approval."
        }
        if ($request.directProtectedBranchWrite -eq $true -and $request.targetBranch -in $protectedBranches -and $request.executionState -notin @('FAILED', 'REJECTED') -and $request.approvalState -notin @('FAILED', 'REJECTED')) {
            Add-Failure "Request '$($request.requestId)' attempts a direct protected branch write without FAILED or REJECTED state."
        }
    }
}

if ($null -ne $schema) {
    Test-RequiredFields -Value $schema -Fields @('$schema', '$id', 'title', 'type', 'required', 'properties') -Context 'GitHub execution schema'
}

$generatorPath = Join-Path $root $generatorRelativePath
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure "GitHub execution generator missing: $generatorRelativePath"
}

if ($failures.Count -eq 0) {
    & $generatorPath | Out-Null
}

$plan = Read-JsonForValidation -RelativePath $planRelativePath
$audit = Read-JsonForValidation -RelativePath $auditRelativePath
$approval = Read-JsonForValidation -RelativePath $approvalRelativePath

if ($null -ne $plan) {
    Test-RequiredFields -Value $plan -Fields @('schemaVersion', 'generatedAt', 'source', 'sourceFile', 'mode', 'status', 'summary', 'actions', 'boundaries') -Context 'GitHub execution plan'
    foreach ($action in @($plan.actions)) {
        Test-RequiredFields -Value $action -Fields $requiredActionFields -Context "GitHub execution plan action '$($action.requestId)'"
        if ($action.actionType -notin $allowedActionTypes) {
            Add-Failure "Plan action '$($action.requestId)' uses unsupported action type '$($action.actionType)'."
        }
        if ($action.executionState -notin $allowedExecutionStates) {
            Add-Failure "Plan action '$($action.requestId)' uses unsupported execution state '$($action.executionState)'."
        }
        if ($action.approvalState -notin $allowedExecutionStates) {
            Add-Failure "Plan action '$($action.requestId)' uses unsupported approval state '$($action.approvalState)'."
        }
        if ($action.actionType -in $approvalRequiredActions -and $action.humanApprovalRequired -ne $true) {
            Add-Failure "Plan action '$($action.requestId)' must require human approval."
        }
        if ($action.directProtectedBranchWrite -eq $true -and $action.targetBranch -in $protectedBranches -and $action.executionState -notin @('FAILED', 'REJECTED') -and $action.approvalState -notin @('FAILED', 'REJECTED')) {
            Add-Failure "Plan action '$($action.requestId)' attempts a direct protected branch write without FAILED or REJECTED state."
        }
    }
}

if ($null -ne $audit) {
    Test-RequiredFields -Value $audit -Fields @('schemaVersion', 'generatedAt', 'source', 'sourceFile', 'status', 'auditRequired', 'entries', 'boundaries') -Context 'GitHub execution audit report'
    if ($audit.auditRequired -ne $true) {
        Add-Failure 'GitHub execution audit report must set auditRequired=true.'
    }
    foreach ($entry in @($audit.entries)) {
        Test-RequiredFields -Value $entry -Fields $requiredAuditFields -Context "GitHub execution audit entry '$($entry.requestId)'"
        if ($entry.actionType -notin $allowedActionTypes) {
            Add-Failure "Audit entry '$($entry.requestId)' uses unsupported action type '$($entry.actionType)'."
        }
        if ($entry.executionState -notin $allowedExecutionStates) {
            Add-Failure "Audit entry '$($entry.requestId)' uses unsupported execution state '$($entry.executionState)'."
        }
    }
    if ($null -ne $plan -and @($audit.entries).Count -ne @($plan.actions).Count) {
        Add-Failure 'Every planned GitHub action must have one audit entry.'
    }
}

if ($null -ne $approval) {
    Test-RequiredFields -Value $approval -Fields @('schemaVersion', 'generatedAt', 'source', 'sourceFile', 'status', 'humanFinalAuthority', 'noAutomaticApproval', 'noSelfApproval', 'noRoleMayApproveOwnRequest', 'summary', 'approvals', 'boundaries') -Context 'GitHub execution approval report'
    if ($approval.humanFinalAuthority -ne $true -or $approval.noAutomaticApproval -ne $true -or $approval.noSelfApproval -ne $true -or $approval.noRoleMayApproveOwnRequest -ne $true) {
        Add-Failure 'GitHub execution approval report must enforce human authority, no automatic approval, no self-approval and no requester self-approval.'
    }
    foreach ($item in @($approval.approvals)) {
        if ($item.actionType -in $approvalRequiredActions -and $item.humanApprovalRequired -ne $true) {
            Add-Failure "Approval item '$($item.requestId)' must require human approval."
        }
        if ($item.approvedByRequester -eq $true) {
            Add-Failure "Approval item '$($item.requestId)' violates no-self-approval."
        }
    }
}

$scanPaths = @(
    $contractRelativePath,
    $schemaRelativePath,
    'services/github-execution',
    $planRelativePath,
    $auditRelativePath,
    $approvalRelativePath,
    'docs/governance/GITHUB_EXECUTION_LAYER.md',
    'docs/governance/GITHUB_EXECUTION_BOUNDARIES.md',
    'scripts/validation/validate-github-execution.ps1'
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
    ('New-' + 'Service'),
    ('Start-' + 'Service'),
    'gh\s+api',
    'gh\s+pr\s+merge',
    'gh\s+repo\s+',
    'vercel\s+deploy(\s|$)',
    'netlify\s+deploy(\s|$)',
    'firebase\s+deploy(\s|$)',
    'docker\s+',
    'npm\s+'
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
                Add-Failure "Possible secret or credential found in GitHub execution artifact: $($file.FullName)"
            }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Forbidden execution/provider/deployment capability found in GitHub execution artifact: $($file.FullName) pattern=$pattern"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "GitHub execution validation failed with $($failures.Count) failure(s)."
}

Write-Host "Studio OS V2.2 GitHub Execution Layer passed deterministic checks. Checked $(@($allowedActionTypes).Count) action types." -ForegroundColor Green
