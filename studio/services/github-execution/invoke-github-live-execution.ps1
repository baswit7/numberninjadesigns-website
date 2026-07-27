[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('BRANCH_CREATE')]
    [string]$ActionType,

    [Parameter(Mandatory)]
    [string]$RequestId,

    [Parameter(Mandatory)]
    [string]$TargetBranch,

    [Parameter()]
    [string]$SourceRef = 'origin/main',

    [Parameter()]
    [ValidateSet('Human')]
    [string]$RequesterRole = 'Human',

    [Parameter()]
    [ValidateSet('APPROVED')]
    [string]$ApprovalState = 'APPROVED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runtimeDir = Join-Path $repositoryRoot 'runtime/github-execution'
$reportPath = Join-Path $runtimeDir 'github-live-execution.report.json'
$auditPath = Join-Path $runtimeDir 'github-live-execution.audit.json'
$historyPath = Join-Path $runtimeDir 'github-live-execution.history.json'

$targetRepository = 'baswit7/professionele-ai-development-studio'
$timestamp = '2026-06-09T00:00:00.0000000Z'
$protectedBranches = @('main', 'master', 'production', 'release')
$allowedBranchPatterns = @(
    '^feature\/studio-os-v2-live-github-execution$',
    '^test\/github-live-execution-proof\/[A-Za-z0-9._-]+$',
    '^experiment\/github-live-execution-proof\/[A-Za-z0-9._-]+$'
)

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

function Test-AllowedLiveBranch {
    param([Parameter(Mandatory)][string]$BranchName)

    foreach ($pattern in $allowedBranchPatterns) {
        if ($BranchName -match $pattern) {
            return $true
        }
    }
    return $false
}

function New-GitHubLiveRecord {
    param(
        [Parameter(Mandatory)][string]$ExecutionState,
        [Parameter(Mandatory)][string]$Result,
        [Parameter(Mandatory)][AllowEmptyString()][string]$GitHubReference,
        [Parameter(Mandatory)][AllowEmptyString()][string]$ErrorDetails
    )

    return [ordered]@{
        timestamp = $timestamp
        requestId = $RequestId
        requesterRole = $RequesterRole
        actionType = $ActionType
        targetRepository = $targetRepository
        sourceBranch = $SourceRef
        targetBranch = $TargetBranch
        result = $Result
        githubReference = $GitHubReference
        approvalState = $ApprovalState
        executionState = $ExecutionState
        errorDetails = $ErrorDetails
        riskLevel = 'medium'
        humanApprovalRequired = $true
        approvedByRequester = $false
        liveExecution = $true
        protectedBranchWrite = $false
        denylist = [ordered]@{
            merge = $false
            branchDelete = $false
            rebase = $false
            forcePush = $false
            protectedBranchWrite = $false
            repositorySettings = $false
            collaborators = $false
            secrets = $false
            deployments = $false
            providerExecution = $false
            backgroundWorkers = $false
            schedulers = $false
            queues = $false
            autonomousRunner = $false
            softwareFactory = $false
        }
    }
}

$record = $null

try {
    if ($ApprovalState -ne 'APPROVED') {
        throw 'Live GitHub execution requires approvalState=APPROVED.'
    }
    if ($RequesterRole -ne 'Human') {
        throw 'Live GitHub execution requires explicit Human approval.'
    }
    if ($TargetBranch -in $protectedBranches) {
        $record = New-GitHubLiveRecord -ExecutionState 'FAILED' -Result 'blocked-protected-branch' -GitHubReference '' -ErrorDetails "Protected branch writes are forbidden: $TargetBranch"
        $record.protectedBranchWrite = $true
        $record.denylist.protectedBranchWrite = $true
        throw $record.errorDetails
    }
    if (-not (Test-AllowedLiveBranch -BranchName $TargetBranch)) {
        throw "Target branch is outside the V2.2B live execution allowlist: $TargetBranch"
    }

    $sourceSha = (& git -C $repositoryRoot rev-parse $SourceRef).Trim()
    if ([string]::IsNullOrWhiteSpace($sourceSha)) {
        throw "Unable to resolve source ref: $SourceRef"
    }

    $existingBranch = @(& git -C $repositoryRoot ls-remote --heads origin $TargetBranch)
    if (-not [string]::IsNullOrWhiteSpace(($existingBranch -join ''))) {
        $existingSha = (($existingBranch -join "`n") -split "\s+")[0]
        if ($existingSha -eq $sourceSha) {
            $githubReference = "refs/heads/$TargetBranch@$sourceSha"
            $record = New-GitHubLiveRecord -ExecutionState 'EXECUTED' -Result 'live-branch-created-or-confirmed' -GitHubReference $githubReference -ErrorDetails ''
        }
        else {
            throw "Remote branch already exists at an unexpected ref: $TargetBranch"
        }
    }
    else {
        $refSpec = "$sourceSha`:refs/heads/$TargetBranch"
        $pushOutput = & git -C $repositoryRoot push origin $refSpec 2>&1
        if ($LASTEXITCODE -ne 0) {
            $createdBranch = @(& git -C $repositoryRoot ls-remote --heads origin $TargetBranch)
            $createdBranchText = $createdBranch -join "`n"
            if ($createdBranchText -notmatch [regex]::Escape($sourceSha)) {
                throw ($pushOutput -join "`n")
            }
        }

        $githubReference = "refs/heads/$TargetBranch@$sourceSha"
        $record = New-GitHubLiveRecord -ExecutionState 'EXECUTED' -Result 'live-branch-created' -GitHubReference $githubReference -ErrorDetails ''
    }
}
catch {
    if ($null -eq $record) {
        $record = New-GitHubLiveRecord -ExecutionState 'FAILED' -Result 'live-execution-failed' -GitHubReference '' -ErrorDetails $_.Exception.Message
    }
}

$existingHistory = @()
if (Test-Path -LiteralPath $historyPath -PathType Leaf) {
    try {
        $historyJson = Get-Content -LiteralPath $historyPath -Raw | ConvertFrom-Json
        $existingHistory = @($historyJson.executions)
    }
    catch {
        $existingHistory = @()
    }
}

$historyItems = @($existingHistory + @($record))
$report = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $timestamp
    capability = 'github-live-execution'
    status = if ($record.executionState -eq 'EXECUTED') { 'ok' } else { 'failed' }
    summary = [ordered]@{
        totalExecutions = @($historyItems).Count
        successfulExecutions = @($historyItems | Where-Object { $_.executionState -eq 'EXECUTED' }).Count
        failedExecutions = @($historyItems | Where-Object { $_.executionState -eq 'FAILED' }).Count
        realLiveBranchCreated = ($record.executionState -eq 'EXECUTED')
        allowedAction = 'BRANCH_CREATE'
        mergeCapability = $false
        deleteCapability = $false
        rebaseCapability = $false
        forcePushCapability = $false
        protectedBranchWriteCapability = $false
        deploymentCapability = $false
        broadApiExecutionCapability = $false
    }
    latestExecution = $record
}

$audit = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $timestamp
    capability = 'github-live-execution'
    auditRequired = $true
    entries = @($historyItems)
}

$history = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $timestamp
    capability = 'github-live-execution'
    executions = @($historyItems)
}

$jsonOptions = @{ Depth = 50 }
$report | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $reportPath -Encoding UTF8
$audit | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $auditPath -Encoding UTF8
$history | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $historyPath -Encoding UTF8

if ($record.executionState -ne 'EXECUTED') {
    throw "GitHub live execution failed: $($record.errorDetails)"
}

Write-Host "GitHub live branch created or confirmed: $($record.githubReference)" -ForegroundColor Green
