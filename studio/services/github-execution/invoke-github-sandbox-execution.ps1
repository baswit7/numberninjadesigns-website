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
    [string]$RequesterRole = 'Human',

    [Parameter()]
    [ValidateSet('APPROVED')]
    [string]$ApprovalState = 'APPROVED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runtimeDir = Join-Path $repositoryRoot 'runtime/github-execution'
$reportPath = Join-Path $runtimeDir 'github-sandbox-execution.report.json'
$auditPath = Join-Path $runtimeDir 'github-sandbox-execution.audit.json'
$historyPath = Join-Path $runtimeDir 'github-sandbox-execution.history.json'

$allowedBranchPattern = '^(sandbox|test|experiment)\/[A-Za-z0-9._\/-]+$'
$protectedBranches = @('main', 'master', 'production', 'release')
$targetRepository = 'baswit7/professionele-ai-development-studio'
$timestamp = '2026-06-09T00:00:00.0000000Z'

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

function New-GitHubSandboxRecord {
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
        sandboxOnly = $true
        protectedBranchWrite = $false
        forbiddenCapabilities = [ordered]@{
            merge = $false
            delete = $false
            rebase = $false
            forcePush = $false
            repositorySettings = $false
            collaborators = $false
            secrets = $false
            deployments = $false
            softwareFactory = $false
            autonomousRunner = $false
        }
    }
}

$record = $null

try {
    if ($ApprovalState -ne 'APPROVED') {
        throw "Sandbox execution requires approvalState=APPROVED."
    }
    if ($RequesterRole -ne 'Human') {
        throw "Sandbox execution must be requested by Human to satisfy mandatory approval."
    }
    if ($TargetBranch -in $protectedBranches) {
        $record = New-GitHubSandboxRecord -ExecutionState 'FAILED' -Result 'blocked-protected-branch' -GitHubReference '' -ErrorDetails "Protected branch writes are forbidden: $TargetBranch"
        $record.protectedBranchWrite = $true
        throw $record.errorDetails
    }
    if ($TargetBranch -notmatch $allowedBranchPattern) {
        throw "Target branch must start with sandbox/, test/ or experiment/: $TargetBranch"
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
            $record = New-GitHubSandboxRecord -ExecutionState 'EXECUTED' -Result 'sandbox-branch-created' -GitHubReference $githubReference -ErrorDetails ''
        }
        else {
            throw "Remote branch already exists at unexpected ref: $TargetBranch"
        }
    }
    else {
        $refSpec = "$sourceSha`:refs/heads/$TargetBranch"
        $pushOutput = & git -C $repositoryRoot push origin $refSpec 2>&1
        if ($LASTEXITCODE -ne 0) {
            $createdBranch = @(& git -C $repositoryRoot ls-remote --heads origin $TargetBranch)
            $createdSha = (($createdBranch -join "`n") -split "\s+")[0]
            if ($createdSha -ne $sourceSha) {
                throw ($pushOutput -join "`n")
            }
        }

        $githubReference = "refs/heads/$TargetBranch@$sourceSha"
        $record = New-GitHubSandboxRecord -ExecutionState 'EXECUTED' -Result 'sandbox-branch-created' -GitHubReference $githubReference -ErrorDetails ''
    }
}
catch {
    if ($null -eq $record) {
        $record = New-GitHubSandboxRecord -ExecutionState 'FAILED' -Result 'sandbox-execution-failed' -GitHubReference '' -ErrorDetails $_.Exception.Message
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
    capability = 'github-sandbox-execution'
    status = if ($record.executionState -eq 'EXECUTED') { 'ok' } else { 'failed' }
    summary = [ordered]@{
        totalExecutions = @($historyItems).Count
        successfulExecutions = @($historyItems | Where-Object { $_.executionState -eq 'EXECUTED' }).Count
        failedExecutions = @($historyItems | Where-Object { $_.executionState -eq 'FAILED' }).Count
        realSandboxBranchCreated = ($record.executionState -eq 'EXECUTED')
        mergeCapability = $false
        deleteCapability = $false
        deploymentCapability = $false
    }
    latestExecution = $record
}

$audit = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $timestamp
    capability = 'github-sandbox-execution'
    auditRequired = $true
    entries = @($historyItems)
}

$history = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $timestamp
    capability = 'github-sandbox-execution'
    executions = @($historyItems)
}

$jsonOptions = @{ Depth = 50 }
$report | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $reportPath -Encoding UTF8
$audit | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $auditPath -Encoding UTF8
$history | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $historyPath -Encoding UTF8

if ($record.executionState -ne 'EXECUTED') {
    throw "GitHub sandbox execution failed: $($record.errorDetails)"
}

Write-Host "GitHub sandbox branch created: $($record.githubReference)" -ForegroundColor Green
