[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]

$reportRelativePath = 'runtime/github-execution/github-live-execution.report.json'
$auditRelativePath = 'runtime/github-execution/github-live-execution.audit.json'
$historyRelativePath = 'runtime/github-execution/github-live-execution.history.json'
$executorRelativePath = 'services/github-execution/invoke-github-live-execution.ps1'
$allowedBranchPatterns = @(
    '^feature\/studio-os-v2-live-github-execution$',
    '^test\/github-live-execution-proof\/[A-Za-z0-9._-]+$',
    '^experiment\/github-live-execution-proof\/[A-Za-z0-9._-]+$'
)
$protectedBranches = @('main', 'master', 'production', 'release')
$allowedActions = @('BRANCH_CREATE')
$requiredAuditFields = @('timestamp', 'requestId', 'requesterRole', 'actionType', 'targetRepository', 'targetBranch', 'result', 'githubReference', 'approvalState', 'executionState')

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
        if ($property.Value -is [string] -and [string]::IsNullOrWhiteSpace($property.Value) -and $field -ne 'githubReference') {
            Add-Failure "$Context misses required field '$field'."
        }
    }
}

function Test-AllowedLiveBranch {
    param([Parameter(Mandatory)][string]$BranchName)

    foreach ($pattern in $allowedBranchPatterns) {
        if ($BranchName -match $pattern) {
            return $true
        }
    }
    return $false
}

function Test-LiveExecutionRecord {
    param(
        [Parameter(Mandatory)]$Record,
        [Parameter(Mandatory)][string]$Context
    )

    Test-RequiredFields -Value $Record -Fields $requiredAuditFields -Context $Context

    if ($Record.actionType -notin $allowedActions) {
        Add-Failure "$Context uses unsupported live action '$($Record.actionType)'."
    }
    if ($Record.targetBranch -in $protectedBranches) {
        Add-Failure "$Context targets protected branch '$($Record.targetBranch)'."
    }
    if (-not (Test-AllowedLiveBranch -BranchName $Record.targetBranch)) {
        Add-Failure "$Context target branch is outside V2.2B allowlist: $($Record.targetBranch)"
    }
    if ($Record.approvalState -ne 'APPROVED') {
        Add-Failure "$Context must have approvalState=APPROVED."
    }
    if ($Record.requesterRole -ne 'Human') {
        Add-Failure "$Context must have requesterRole=Human."
    }
    if ($Record.humanApprovalRequired -ne $true) {
        Add-Failure "$Context must require human approval."
    }
    if ($Record.PSObject.Properties['approvedByRequester'] -and $Record.approvedByRequester -eq $true) {
        Add-Failure "$Context violates no-self-approval."
    }
    if ($Record.executionState -eq 'EXECUTED') {
        if ($Record.result -notin @('live-branch-created', 'live-branch-created-or-confirmed')) {
            Add-Failure "$Context executed result must be live branch creation evidence."
        }
        if ([string]::IsNullOrWhiteSpace([string]$Record.githubReference)) {
            Add-Failure "$Context executed record must include githubReference."
        }
    }
    elseif ($Record.executionState -ne 'FAILED') {
        Add-Failure "$Context executionState must be EXECUTED or FAILED."
    }

    foreach ($denyField in @('merge', 'branchDelete', 'rebase', 'forcePush', 'protectedBranchWrite', 'repositorySettings', 'collaborators', 'secrets', 'deployments', 'providerExecution', 'backgroundWorkers', 'schedulers', 'queues', 'autonomousRunner', 'softwareFactory')) {
        if ($Record.denylist.$denyField -ne $false) {
            Add-Failure "$Context denylist.$denyField must be false."
        }
    }
}

$report = Read-JsonForValidation -RelativePath $reportRelativePath
$audit = Read-JsonForValidation -RelativePath $auditRelativePath
$history = Read-JsonForValidation -RelativePath $historyRelativePath

if ($null -ne $report) {
    Test-RequiredFields -Value $report -Fields @('schemaVersion', 'generatedAt', 'capability', 'status', 'summary', 'latestExecution') -Context 'GitHub live execution report'
    Test-LiveExecutionRecord -Record $report.latestExecution -Context "GitHub live latest execution '$($report.latestExecution.requestId)'"
    if ($report.summary.realLiveBranchCreated -ne $true) {
        Add-Failure 'GitHub live execution report must prove at least one real live branch was created.'
    }
    foreach ($capability in @('mergeCapability', 'deleteCapability', 'rebaseCapability', 'forcePushCapability', 'protectedBranchWriteCapability', 'deploymentCapability', 'broadApiExecutionCapability')) {
        if ($report.summary.$capability -ne $false) {
            Add-Failure "GitHub live execution report must set $capability=false."
        }
    }
}

if ($null -ne $audit) {
    Test-RequiredFields -Value $audit -Fields @('schemaVersion', 'generatedAt', 'capability', 'auditRequired', 'entries') -Context 'GitHub live execution audit'
    if ($audit.auditRequired -ne $true) {
        Add-Failure 'GitHub live execution audit must set auditRequired=true.'
    }
    foreach ($entry in @($audit.entries)) {
        Test-LiveExecutionRecord -Record $entry -Context "GitHub live audit entry '$($entry.requestId)'"
    }
}

if ($null -ne $history) {
    Test-RequiredFields -Value $history -Fields @('schemaVersion', 'generatedAt', 'capability', 'executions') -Context 'GitHub live execution history'
    if (@($history.executions).Count -lt 1) {
        Add-Failure 'GitHub live execution history must include at least one execution.'
    }
    foreach ($entry in @($history.executions)) {
        Test-LiveExecutionRecord -Record $entry -Context "GitHub live history entry '$($entry.requestId)'"
    }
    $successful = @($history.executions | Where-Object { $_.executionState -eq 'EXECUTED' -and (Test-AllowedLiveBranch -BranchName $_.targetBranch) })
    if ($successful.Count -lt 1) {
        Add-Failure 'GitHub live execution history must include at least one executed allowlisted branch creation.'
    }
}

$scanPaths = @(
    $executorRelativePath,
    $reportRelativePath,
    $auditRelativePath,
    $historyRelativePath,
    'docs/governance/GITHUB_LIVE_EXECUTION.md',
    'docs/governance/GITHUB_LIVE_EXECUTION_BOUNDARIES.md',
    'scripts/validation/validate-github-live-execution.ps1'
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
    'merge\s*=\\s*\\$true',
    'delete\s*=\\s*\\$true',
    'branchDelete\s*=\\s*\\$true',
    'rebase\s*=\\s*\\$true',
    'forcePush\s*=\\s*\\$true',
    'git\s+push\s+.*--delete',
    'git\s+push\s+.*--force',
    'git\s+rebase',
    'gh\s+pr\s+merge',
    'gh\s+repo\s+delete',
    'gh\s+secret',
    'gh\s+api',
    'vercel\s+deploy',
    ('Invoke-' + 'RestMethod'),
    ('Invoke-' + 'WebRequest'),
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
                Add-Failure "Possible secret or credential found in GitHub live execution artifact: $($file.FullName)"
            }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Forbidden GitHub live execution capability found in artifact: $($file.FullName) pattern=$pattern"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "GitHub live execution validation failed with $($failures.Count) failure(s)."
}

Write-Host 'Studio OS V2.2B GitHub Live Execution passed deterministic checks.' -ForegroundColor Green
