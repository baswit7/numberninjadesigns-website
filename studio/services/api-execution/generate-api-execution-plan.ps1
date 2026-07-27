[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$contractPath = Join-Path $repositoryRoot 'shared/contracts/api-execution/api-execution.contract.json'
$apiCenterPath = Join-Path $repositoryRoot 'config/api-center.config.json'
$runtimeDir = Join-Path $repositoryRoot 'runtime/api-execution'
$planPath = Join-Path $runtimeDir 'api-execution.plan.json'
$auditPath = Join-Path $runtimeDir 'api-execution.audit.json'
$approvalReportPath = Join-Path $runtimeDir 'api-execution-approval.report.json'

if (-not (Test-Path -LiteralPath $contractPath -PathType Leaf)) {
    throw "API execution contract missing: $contractPath"
}
if (-not (Test-Path -LiteralPath $apiCenterPath -PathType Leaf)) {
    throw "API Center catalog missing: $apiCenterPath"
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

$contract = Get-Content -LiteralPath $contractPath -Raw | ConvertFrom-Json
$apiCenter = Get-Content -LiteralPath $apiCenterPath -Raw | ConvertFrom-Json
$generatedAt = '2026-06-09T00:00:00.0000000Z'

$providerByName = @{}
foreach ($provider in @($apiCenter.providers)) {
    $providerByName[[string]$provider.providerName] = $provider
}

$actions = @($contract.requests | ForEach-Object {
    if (-not $providerByName.ContainsKey([string]$_.providerName)) {
        throw "API execution request '$($_.requestId)' references provider outside API Center: $($_.providerName)"
    }

    $provider = $providerByName[[string]$_.providerName]
    [ordered]@{
        timestamp = $generatedAt
        requestId = $_.requestId
        providerName = $_.providerName
        providerCatalogSource = 'config/api-center.config.json'
        requester = $_.requester
        requesterRole = $_.requesterRole
        usedByProject = $_.usedByProject
        actionType = $_.actionType
        authType = $provider.authType
        requiredEnvironmentVariables = @($provider.requiredEnvironmentVariables)
        scopesRequired = @($provider.scopesRequired)
        approvalState = $_.approvalState
        executionState = $_.executionState
        riskLevel = $_.riskLevel
        costRisk = $_.costRisk
        rateLimitRisk = $_.rateLimitRisk
        dataAccessRisk = $_.dataAccessRisk
        externalMutationRisk = $_.externalMutationRisk
        humanApprovalRequired = $_.humanApprovalRequired
        dryRunOnly = $_.dryRunOnly
        preparedByRole = $_.preparedByRole
        approverRole = $_.approverRole
        approvedByRequester = $_.approvedByRequester
        result = $_.result
        blockers = @($_.blockers)
        evidence = @($_.evidence)
    }
})

$approvalRequiredActions = @($actions | Where-Object { $_.humanApprovalRequired -eq $true })
$blockedActions = @($actions | Where-Object { @($_.blockers).Count -gt 0 })
$highRiskActions = @($actions | Where-Object { $_.riskLevel -eq 'high' })

$plan = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    source = 'api-execution-contract'
    sourceFile = 'shared/contracts/api-execution/api-execution.contract.json'
    providerCatalogSource = 'config/api-center.config.json'
    mode = $contract.mode
    status = 'READY_FOR_APPROVAL'
    summary = [ordered]@{
        totalActions = @($actions).Count
        providerCount = @($actions | ForEach-Object { $_['providerName'] } | Sort-Object -Unique).Count
        approvalRequiredActions = @($approvalRequiredActions).Count
        blockedActions = @($blockedActions).Count
        highRiskActions = @($highRiskActions).Count
        executesProviderCalls = $false
        deploymentCapability = $false
        secretValuesRead = $false
    }
    actions = $actions
    boundaries = $contract.boundaries
}

$auditEntries = @($actions | ForEach-Object {
    [ordered]@{
        timestamp = $_.timestamp
        requestId = $_.requestId
        providerName = $_.providerName
        actionType = $_.actionType
        requesterRole = $_.requesterRole
        usedByProject = $_.usedByProject
        authType = $_.authType
        requiredEnvironmentVariables = @($_.requiredEnvironmentVariables)
        scopesRequired = @($_.scopesRequired)
        approvalState = $_.approvalState
        executionState = $_.executionState
        riskLevel = $_.riskLevel
        costRisk = $_.costRisk
        rateLimitRisk = $_.rateLimitRisk
        dataAccessRisk = $_.dataAccessRisk
        externalMutationRisk = $_.externalMutationRisk
        humanApprovalRequired = $_.humanApprovalRequired
        dryRunOnly = $_.dryRunOnly
        result = $_.result
        blockers = @($_.blockers)
    }
})

$audit = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    source = 'api-execution-plan'
    sourceFile = 'runtime/api-execution/api-execution.plan.json'
    providerCatalogSource = 'config/api-center.config.json'
    status = 'ok'
    auditRequired = $true
    entries = $auditEntries
    boundaries = $contract.boundaries
}

$approvalReport = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    source = 'api-execution-plan'
    sourceFile = 'runtime/api-execution/api-execution.plan.json'
    status = 'READY_FOR_APPROVAL'
    humanFinalAuthority = $true
    noAutomaticApproval = $true
    noSelfApproval = $true
    noRoleMayApproveOwnRequest = $true
    securityMayBlock = $true
    qaMayBlock = $true
    summary = [ordered]@{
        totalActions = @($actions).Count
        requiresHumanApproval = @($approvalRequiredActions).Count
        blockedActions = @($blockedActions).Count
        approvalBypassAllowed = $false
        providerCallsAllowed = $false
    }
    approvals = @($actions | ForEach-Object {
        [ordered]@{
            requestId = $_.requestId
            providerName = $_.providerName
            actionType = $_.actionType
            requesterRole = $_.requesterRole
            approvalState = $_.approvalState
            executionState = $_.executionState
            approverRole = $_.approverRole
            approvedByRequester = $_.approvedByRequester
            humanApprovalRequired = $_.humanApprovalRequired
            dryRunOnly = $_.dryRunOnly
            blockers = @($_.blockers)
        }
    })
    boundaries = $contract.boundaries
}

$jsonOptions = @{ Depth = 50 }
$plan | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $planPath -Encoding UTF8
$audit | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $auditPath -Encoding UTF8
$approvalReport | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $approvalReportPath -Encoding UTF8

Write-Host "API execution planning reports generated: runtime/api-execution" -ForegroundColor Green
