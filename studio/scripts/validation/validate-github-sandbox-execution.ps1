[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]

$reportRelativePath = 'runtime/github-execution/github-sandbox-execution.report.json'
$auditRelativePath = 'runtime/github-execution/github-sandbox-execution.audit.json'
$historyRelativePath = 'runtime/github-execution/github-sandbox-execution.history.json'
$executorRelativePath = 'services/github-execution/invoke-github-sandbox-execution.ps1'
$allowedBranchPattern = '^(sandbox|test|experiment)\/[A-Za-z0-9._\/-]+$'
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

function Test-SandboxExecutionRecord {
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
    if ($Record.targetBranch -notmatch $allowedBranchPattern) {
        Add-Failure "$Context target branch must be sandbox/, test/ or experiment/: $($Record.targetBranch)"
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
        if ($Record.result -ne 'sandbox-branch-created') {
            Add-Failure "$Context executed result must be sandbox-branch-created."
        }
        if ([string]::IsNullOrWhiteSpace([string]$Record.githubReference)) {
            Add-Failure "$Context executed record must include githubReference."
        }
    }
    elseif ($Record.executionState -ne 'FAILED') {
        Add-Failure "$Context executionState must be EXECUTED or FAILED."
    }
}

$report = Read-JsonForValidation -RelativePath $reportRelativePath
$audit = Read-JsonForValidation -RelativePath $auditRelativePath
$history = Read-JsonForValidation -RelativePath $historyRelativePath

if ($null -ne $report) {
    Test-RequiredFields -Value $report -Fields @('schemaVersion', 'generatedAt', 'capability', 'status', 'summary', 'latestExecution') -Context 'GitHub sandbox execution report'
    Test-SandboxExecutionRecord -Record $report.latestExecution -Context "GitHub sandbox latest execution '$($report.latestExecution.requestId)'"
    if ($report.summary.realSandboxBranchCreated -ne $true) {
        Add-Failure 'GitHub sandbox execution report must prove at least one real sandbox branch was created.'
    }
    if ($report.summary.mergeCapability -ne $false -or $report.summary.deleteCapability -ne $false -or $report.summary.deploymentCapability -ne $false) {
        Add-Failure 'GitHub sandbox execution report must not expose merge, delete or deployment capability.'
    }
}

if ($null -ne $audit) {
    Test-RequiredFields -Value $audit -Fields @('schemaVersion', 'generatedAt', 'capability', 'auditRequired', 'entries') -Context 'GitHub sandbox execution audit'
    if ($audit.auditRequired -ne $true) {
        Add-Failure 'GitHub sandbox execution audit must set auditRequired=true.'
    }
    foreach ($entry in @($audit.entries)) {
        Test-SandboxExecutionRecord -Record $entry -Context "GitHub sandbox audit entry '$($entry.requestId)'"
    }
}

if ($null -ne $history) {
    Test-RequiredFields -Value $history -Fields @('schemaVersion', 'generatedAt', 'capability', 'executions') -Context 'GitHub sandbox execution history'
    if (@($history.executions).Count -lt 1) {
        Add-Failure 'GitHub sandbox execution history must include at least one execution.'
    }
    foreach ($entry in @($history.executions)) {
        Test-SandboxExecutionRecord -Record $entry -Context "GitHub sandbox history entry '$($entry.requestId)'"
    }
    $successful = @($history.executions | Where-Object { $_.executionState -eq 'EXECUTED' -and $_.targetBranch -match $allowedBranchPattern })
    if ($successful.Count -lt 1) {
        Add-Failure 'GitHub sandbox execution history must include at least one executed sandbox branch creation.'
    }
}

$scanPaths = @(
    $executorRelativePath,
    $reportRelativePath,
    $auditRelativePath,
    $historyRelativePath,
    'docs/governance/GITHUB_SANDBOX_EXECUTION.md',
    'docs/governance/GITHUB_SANDBOX_EXECUTION_BOUNDARIES.md',
    'scripts/validation/validate-github-sandbox-execution.ps1'
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
                Add-Failure "Possible secret or credential found in GitHub sandbox execution artifact: $($file.FullName)"
            }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Forbidden GitHub sandbox execution capability found in artifact: $($file.FullName) pattern=$pattern"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "GitHub sandbox execution validation failed with $($failures.Count) failure(s)."
}

Write-Host 'Studio OS V2.2A GitHub Sandbox Execution passed deterministic checks.' -ForegroundColor Green
