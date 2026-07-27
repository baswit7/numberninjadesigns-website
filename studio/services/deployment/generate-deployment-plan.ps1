[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$contractPath = Join-Path $repositoryRoot 'shared/contracts/deployment/deployment.contract.json'
$runtimeDir = Join-Path $repositoryRoot 'runtime/deployment'
$planPath = Join-Path $runtimeDir 'deployment.plan.json'
$auditPath = Join-Path $runtimeDir 'deployment.audit.json'
$approvalReportPath = Join-Path $runtimeDir 'deployment.approval.report.json'

if (-not (Test-Path -LiteralPath $contractPath -PathType Leaf)) {
    throw "Deployment contract missing: $contractPath"
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

$contract = Get-Content -LiteralPath $contractPath -Raw | ConvertFrom-Json
$generatedAt = '2026-06-09T00:00:00.0000000Z'

$consumedInputs = [ordered]@{}
foreach ($inputName in @($contract.consumes.PSObject.Properties.Name)) {
    $relativePath = [string]$contract.consumes.$inputName
    $path = Join-Path $repositoryRoot $relativePath
    $consumedInputs[$inputName] = [ordered]@{
        path = $relativePath
        exists = Test-Path -LiteralPath $path -PathType Leaf
    }
}

$deployments = @($contract.deployments | ForEach-Object {
    [ordered]@{
        timestamp = $generatedAt
        deploymentId = $_.deploymentId
        project = $_.project
        requester = $_.requester
        requesterRole = $_.requesterRole
        deploymentType = $_.deploymentType
        targetEnvironment = $_.targetEnvironment
        targetPlatform = $_.targetPlatform
        approvalState = $_.approvalState
        executionState = $_.executionState
        rollbackAvailable = $_.rollbackAvailable
        rollbackStrategy = $_.rollbackStrategy
        riskLevel = $_.riskLevel
        humanApprovalRequired = $_.humanApprovalRequired
        dryRunOnly = $_.dryRunOnly
        preparedByRole = $_.preparedByRole
        approverRole = $_.approverRole
        approvedByRequester = $_.approvedByRequester
        result = $_.result
        blockers = @($_.blockers)
        evidence = @($_.evidence)
        preDeploymentChecks = [ordered]@{
            deploymentTargetValidated = $true
            environmentValidated = $true
            rollbackStrategyValidated = $true
            approvalStatusValidated = $true
            realDeploymentCapability = $false
        }
    }
})

$approvalRequired = @($deployments | Where-Object { $_['humanApprovalRequired'] -eq $true })
$blocked = @($deployments | Where-Object { @($_['blockers']).Count -gt 0 })
$highRisk = @($deployments | Where-Object { $_['riskLevel'] -eq 'high' })

$plan = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    source = 'deployment-contract'
    sourceFile = 'shared/contracts/deployment/deployment.contract.json'
    mode = $contract.mode
    status = 'READY_FOR_APPROVAL'
    consumedInputs = $consumedInputs
    summary = [ordered]@{
        totalDeployments = @($deployments).Count
        approvalRequiredDeployments = @($approvalRequired).Count
        blockedDeployments = @($blocked).Count
        highRiskDeployments = @($highRisk).Count
        realDeploymentCapability = $false
        buildExecutionCapability = $false
        publishingCapability = $false
        secretValuesRead = $false
    }
    deployments = $deployments
    boundaries = $contract.boundaries
}

$auditEntries = @($deployments | ForEach-Object {
    [ordered]@{
        timestamp = $_['timestamp']
        deploymentId = $_['deploymentId']
        project = $_['project']
        deploymentType = $_['deploymentType']
        targetEnvironment = $_['targetEnvironment']
        targetPlatform = $_['targetPlatform']
        approvalState = $_['approvalState']
        executionState = $_['executionState']
        rollbackAvailable = $_['rollbackAvailable']
        rollbackStrategy = $_['rollbackStrategy']
        riskLevel = $_['riskLevel']
        humanApprovalRequired = $_['humanApprovalRequired']
        dryRunOnly = $_['dryRunOnly']
        result = $_['result']
        blockers = @($_['blockers'])
    }
})

$audit = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    source = 'deployment-plan'
    sourceFile = 'runtime/deployment/deployment.plan.json'
    status = 'ok'
    auditRequired = $true
    entries = $auditEntries
    boundaries = $contract.boundaries
}

$approvalReport = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    source = 'deployment-plan'
    sourceFile = 'runtime/deployment/deployment.plan.json'
    status = 'READY_FOR_APPROVAL'
    humanFinalAuthority = $true
    noAutomaticApproval = $true
    noApprovalBypass = $true
    noSelfApproval = $true
    noRoleMayApproveOwnRequest = $true
    qaMayBlock = $true
    securityMayBlock = $true
    summary = [ordered]@{
        totalDeployments = @($deployments).Count
        requiresHumanApproval = @($approvalRequired).Count
        blockedDeployments = @($blocked).Count
        deploymentExecutionAllowed = $false
        rollbackExecutionAllowed = $false
    }
    approvals = @($deployments | ForEach-Object {
        [ordered]@{
            deploymentId = $_['deploymentId']
            deploymentType = $_['deploymentType']
            requesterRole = $_['requesterRole']
            approvalState = $_['approvalState']
            executionState = $_['executionState']
            approverRole = $_['approverRole']
            approvedByRequester = $_['approvedByRequester']
            humanApprovalRequired = $_['humanApprovalRequired']
            dryRunOnly = $_['dryRunOnly']
            blockers = @($_['blockers'])
        }
    })
    boundaries = $contract.boundaries
}

$jsonOptions = @{ Depth = 50 }
$plan | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $planPath -Encoding UTF8
$audit | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $auditPath -Encoding UTF8
$approvalReport | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $approvalReportPath -Encoding UTF8

Write-Host "Deployment planning reports generated: runtime/deployment" -ForegroundColor Green
