[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$contractPath = Join-Path $repositoryRoot 'shared/contracts/execution-request/execution-request.contract.json'
$approvalRecordsPath = Join-Path $repositoryRoot 'runtime/approval/execution-approval.records.json'
$runtimeDir = Join-Path $repositoryRoot 'runtime/execution-request'
$packagesPath = Join-Path $runtimeDir 'execution-request.packages.json'
$auditPath = Join-Path $runtimeDir 'execution-request.audit.json'
$reportPath = Join-Path $runtimeDir 'execution-request.report.json'

if (-not (Test-Path -LiteralPath $contractPath -PathType Leaf)) {
    throw "Execution request contract missing: $contractPath"
}
if (-not (Test-Path -LiteralPath $approvalRecordsPath -PathType Leaf)) {
    throw "Approval records missing: $approvalRecordsPath"
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

$contract = Get-Content -LiteralPath $contractPath -Raw | ConvertFrom-Json
$approvalRecords = Get-Content -LiteralPath $approvalRecordsPath -Raw | ConvertFrom-Json
$generatedAt = '2026-06-09T00:00:00.0000000Z'

function Get-ExecutionReadinessState {
    param([Parameter(Mandatory)][string]$ApprovalState)

    switch ($ApprovalState) {
        'APPROVED' { return 'READY_FOR_REVIEW' }
        'REJECTED' { return 'REJECTED' }
        'UNKNOWN' { return 'BLOCKED' }
        default { return 'BLOCKED' }
    }
}

function Get-PackageResult {
    param([Parameter(Mandatory)][string]$ReadinessState)

    switch ($ReadinessState) {
        'READY_FOR_REVIEW' { return 'packaged-for-human-review' }
        'REJECTED' { return 'rejected-by-approval-state' }
        default { return 'blocked-by-approval-state' }
    }
}

$packages = @($approvalRecords.records | ForEach-Object {
    $readinessState = Get-ExecutionReadinessState -ApprovalState ([string]$_.approvalState)
    $blockers = @($_.blockers)
    if ($readinessState -eq 'BLOCKED' -and $blockers.Count -eq 0) {
        $blockers = @(
            [ordered]@{
                role = 'Human'
                status = 'approval-required'
                reason = 'Execution request package is blocked until approval state is APPROVED.'
            }
        )
    }
    if ($readinessState -eq 'REJECTED' -and $blockers.Count -eq 0) {
        $blockers = @(
            [ordered]@{
                role = 'Human'
                status = 'rejected'
                reason = 'Rejected approval records cannot become ready for review.'
            }
        )
    }

    [ordered]@{
        timestamp = $generatedAt
        requestId = "EXREQ-$($_.requestId)"
        sourceApprovalId = $_.approvalId
        sourceRequestId = $_.requestId
        approvalState = $_.approvalState
        requestedAction = $_.requestedAction
        targetSystem = $_.targetSystem
        targetReference = $_.targetReference
        allowedActionType = $_.requestedAction
        deniedActionTypes = @($contract.deniedActionTypes)
        requiredEvidence = @($contract.requiredEvidence)
        requiredValidators = @($contract.requiredValidators)
        riskClassification = $_.riskLevel
        executionReadinessState = $readinessState
        executionDispatchAllowed = $false
        packagedOnly = $true
        result = Get-PackageResult -ReadinessState $readinessState
        evidence = @($_.evidence) + @(
            'Execution request package was generated from approval evidence.',
            'Package is non-executing and requires review before any future executor may use it.'
        )
        blockers = $blockers
    }
})

$readyForReview = @($packages | Where-Object { $_['executionReadinessState'] -eq 'READY_FOR_REVIEW' })
$blocked = @($packages | Where-Object { $_['executionReadinessState'] -eq 'BLOCKED' })
$rejected = @($packages | Where-Object { $_['executionReadinessState'] -eq 'REJECTED' })
$unknownReady = @($packages | Where-Object { $_['approvalState'] -eq 'UNKNOWN' -and $_['executionReadinessState'] -eq 'READY_FOR_REVIEW' })

$packageDocument = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    capability = $contract.capability
    sourceFile = 'shared/contracts/execution-request/execution-request.contract.json'
    approvalRecordsSource = 'runtime/approval/execution-approval.records.json'
    allowedReadinessStates = @($contract.allowedReadinessStates)
    packages = $packages
}

$audit = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    capability = $contract.capability
    auditRequired = $true
    entries = @($packages | ForEach-Object {
        [ordered]@{
            timestamp = $_['timestamp']
            requestId = $_['requestId']
            sourceApprovalId = $_['sourceApprovalId']
            approvalState = $_['approvalState']
            requestedAction = $_['requestedAction']
            targetSystem = $_['targetSystem']
            riskClassification = $_['riskClassification']
            executionReadinessState = $_['executionReadinessState']
            executionDispatchAllowed = $_['executionDispatchAllowed']
            result = $_['result']
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
        totalPackages = @($packages).Count
        readyForReviewPackages = @($readyForReview).Count
        blockedPackages = @($blocked).Count
        rejectedPackages = @($rejected).Count
        unknownAutoReadyForReview = @($unknownReady).Count -gt 0
        executionDispatched = $false
        approvalsMutated = $false
        externalCallsMade = $false
    }
    readinessStates = @($contract.allowedReadinessStates)
    readinessRules = $contract.readinessRules
    boundaries = $contract.boundaries
    ownership = $contract.ownership
    packagesFile = 'runtime/execution-request/execution-request.packages.json'
    auditFile = 'runtime/execution-request/execution-request.audit.json'
}

$jsonOptions = @{ Depth = 50 }
$packageDocument | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $packagesPath -Encoding UTF8
$audit | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $auditPath -Encoding UTF8
$report | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host "Execution request packages generated: runtime/execution-request" -ForegroundColor Green
