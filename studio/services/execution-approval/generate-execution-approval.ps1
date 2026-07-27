[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$contractPath = Join-Path $repositoryRoot 'shared/contracts/approval/execution-approval.contract.json'
$runtimeDir = Join-Path $repositoryRoot 'runtime/approval'
$reportPath = Join-Path $runtimeDir 'execution-approval.report.json'
$auditPath = Join-Path $runtimeDir 'execution-approval.audit.json'
$recordsPath = Join-Path $runtimeDir 'execution-approval.records.json'

if (-not (Test-Path -LiteralPath $contractPath -PathType Leaf)) {
    throw "Execution approval contract missing: $contractPath"
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

$contract = Get-Content -LiteralPath $contractPath -Raw | ConvertFrom-Json
$generatedAt = '2026-06-09T00:00:00.0000000Z'

$records = @($contract.approvalRequests | ForEach-Object {
    [ordered]@{
        timestamp = $generatedAt
        approvalId = $_.approvalId
        requestId = $_.requestId
        intentType = $_.intentType
        requestedAction = $_.requestedAction
        requestedByRole = $_.requestedByRole
        approvalState = $_.approvalState
        targetSystem = $_.targetSystem
        targetReference = $_.targetReference
        riskLevel = $_.riskLevel
        humanApprovalRequired = $_.humanApprovalRequired
        requestedAt = $_.requestedAt
        expiresAt = $_.expiresAt
        approvedByRole = $_.approvedByRole
        approvedAt = $_.approvedAt
        approvedByRequester = $_.approvedByRequester
        executionRefusedUntilApproved = $_.executionRefusedUntilApproved
        executionDispatchAllowed = $_.executionDispatchAllowed
        evidence = @($_.evidence)
        blockers = @($_.blockers)
    }
})

$approved = @($records | Where-Object { $_['approvalState'] -eq 'APPROVED' })
$blocked = @($records | Where-Object { $_['executionRefusedUntilApproved'] -eq $true -or @($_['blockers']).Count -gt 0 })
$unknown = @($records | Where-Object { $_['approvalState'] -eq 'UNKNOWN' })

$recordsDocument = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    capability = $contract.capability
    sourceFile = 'shared/contracts/approval/execution-approval.contract.json'
    allowedApprovalStates = @($contract.allowedApprovalStates)
    records = $records
}

$audit = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    capability = $contract.capability
    auditRequired = $true
    entries = @($records | ForEach-Object {
        [ordered]@{
            timestamp = $_['timestamp']
            approvalId = $_['approvalId']
            requestId = $_['requestId']
            intentType = $_['intentType']
            requestedAction = $_['requestedAction']
            approvalState = $_['approvalState']
            humanApprovalRequired = $_['humanApprovalRequired']
            executionRefusedUntilApproved = $_['executionRefusedUntilApproved']
            executionDispatchAllowed = $_['executionDispatchAllowed']
            evidence = @($_['evidence'])
            blockers = @($_['blockers'])
        }
    })
    boundaries = $contract.boundaries
    ownership = $contract.ownership
}

$report = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    capability = $contract.capability
    status = 'ok'
    summary = [ordered]@{
        totalApprovalRecords = @($records).Count
        approvedRecords = @($approved).Count
        blockedRecords = @($blocked).Count
        unknownRecords = @($unknown).Count
        executionDispatched = $false
        autoApprovalAllowed = $false
        unknownAutoApproved = $false
    }
    stateModel = @($contract.allowedApprovalStates)
    ownership = $contract.ownership
    approvalRules = $contract.approvalRules
    boundaries = $contract.boundaries
    recordsFile = 'runtime/approval/execution-approval.records.json'
    auditFile = 'runtime/approval/execution-approval.audit.json'
}

$jsonOptions = @{ Depth = 50 }
$recordsDocument | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $recordsPath -Encoding UTF8
$audit | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $auditPath -Encoding UTF8
$report | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host "Execution approval gateway reports generated: runtime/approval" -ForegroundColor Green
