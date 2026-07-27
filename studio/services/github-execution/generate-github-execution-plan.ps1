[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$contractPath = Join-Path $repositoryRoot 'shared/contracts/github-execution/github-execution.contract.json'
$runtimeDir = Join-Path $repositoryRoot 'runtime/github-execution'
$planPath = Join-Path $runtimeDir 'github-execution.plan.json'
$auditPath = Join-Path $runtimeDir 'github-execution.audit.json'
$approvalReportPath = Join-Path $runtimeDir 'github-execution-approval.report.json'

if (-not (Test-Path -LiteralPath $contractPath -PathType Leaf)) {
    throw "GitHub execution contract missing: $contractPath"
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

$contract = Get-Content -LiteralPath $contractPath -Raw | ConvertFrom-Json
$generatedAt = '2026-06-09T00:00:00.0000000Z'

$actions = @($contract.requests | ForEach-Object {
    [ordered]@{
        timestamp = $generatedAt
        requestId = $_.requestId
        requester = $_.requester
        requesterRole = $_.requesterRole
        actionType = $_.actionType
        targetRepository = $_.targetRepository
        targetBranch = $_.targetBranch
        sourceBranch = $_.sourceBranch
        approvalState = $_.approvalState
        executionState = $_.executionState
        result = $_.result
        blockers = @($_.blockers)
        riskLevel = $_.riskLevel
        humanApprovalRequired = $_.humanApprovalRequired
        writesTargetBranch = $_.writesTargetBranch
        directProtectedBranchWrite = $_.directProtectedBranchWrite
        preparedByRole = $_.preparedByRole
        approverRole = $_.approverRole
        approvedByRequester = $_.approvedByRequester
        evidence = @($_.evidence)
    }
})

$approvalRequiredActions = @($actions | Where-Object { $_.humanApprovalRequired -eq $true })
$readOnlyActions = @($actions | Where-Object { $_.humanApprovalRequired -eq $false })
$blockedActions = @($actions | Where-Object { @($_.blockers).Count -gt 0 })

$plan = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    source = 'github-execution-contract'
    sourceFile = 'shared/contracts/github-execution/github-execution.contract.json'
    mode = $contract.mode
    status = 'READY_FOR_APPROVAL'
    summary = [ordered]@{
        totalActions = @($actions).Count
        approvalRequiredActions = @($approvalRequiredActions).Count
        readOnlyPlanningActions = @($readOnlyActions).Count
        blockedActions = @($blockedActions).Count
        executesGitHubApiCalls = $false
        directProtectedBranchWrites = $false
    }
    actions = $actions
    boundaries = $contract.boundaries
}

$auditEntries = @($actions | ForEach-Object {
    [ordered]@{
        timestamp = $_.timestamp
        requestId = $_.requestId
        requesterRole = $_.requesterRole
        action = $_.actionType
        actionType = $_.actionType
        targetRepository = $_.targetRepository
        targetBranch = $_.targetBranch
        sourceBranch = $_.sourceBranch
        result = $_.result
        approvalStatus = $_.approvalState
        approvalState = $_.approvalState
        executionState = $_.executionState
        blockers = $_.blockers
        riskLevel = $_.riskLevel
        humanApprovalRequired = $_.humanApprovalRequired
    }
})

$audit = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    source = 'github-execution-plan'
    sourceFile = 'runtime/github-execution/github-execution.plan.json'
    status = 'ok'
    auditRequired = $true
    entries = $auditEntries
    boundaries = $contract.boundaries
}

$approvalReport = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    source = 'github-execution-plan'
    sourceFile = 'runtime/github-execution/github-execution.plan.json'
    status = 'READY_FOR_APPROVAL'
    humanFinalAuthority = $true
    noAutomaticApproval = $true
    noSelfApproval = $true
    noRoleMayApproveOwnRequest = $true
    summary = [ordered]@{
        totalActions = @($actions).Count
        requiresHumanApproval = @($approvalRequiredActions).Count
        readOnlyPlanningActions = @($readOnlyActions).Count
        blockedActions = @($blockedActions).Count
    }
    approvals = @($actions | ForEach-Object {
        [ordered]@{
            requestId = $_.requestId
            actionType = $_.actionType
            requesterRole = $_.requesterRole
            approvalState = $_.approvalState
            executionState = $_.executionState
            approverRole = $_.approverRole
            approvedByRequester = $_.approvedByRequester
            humanApprovalRequired = $_.humanApprovalRequired
            blockers = $_.blockers
        }
    })
    boundaries = $contract.boundaries
}

$jsonOptions = @{ Depth = 50 }
$plan | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $planPath -Encoding UTF8
$audit | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $auditPath -Encoding UTF8
$approvalReport | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $approvalReportPath -Encoding UTF8

Write-Host "GitHub execution planning reports generated: runtime/github-execution" -ForegroundColor Green
