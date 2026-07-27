[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]

$contractRelativePath = 'shared/contracts/deployment/deployment.contract.json'
$schemaRelativePath = 'shared/contracts/deployment/deployment.schema.json'
$generatorRelativePath = 'services/deployment/generate-deployment-plan.ps1'
$planRelativePath = 'runtime/deployment/deployment.plan.json'
$auditRelativePath = 'runtime/deployment/deployment.audit.json'
$approvalRelativePath = 'runtime/deployment/deployment.approval.report.json'

$allowedTargets = @('Vercel', 'GitHub Pages', 'Static Hosting', 'Future Custom Hosting')
$allowedDeploymentTypes = @('PREVIEW_DEPLOYMENT', 'STAGING_DEPLOYMENT', 'PRODUCTION_DEPLOYMENT', 'ROLLBACK_RECOMMENDATION', 'RELEASE_REVIEW')
$approvalRequiredDeploymentTypes = @('STAGING_DEPLOYMENT', 'PRODUCTION_DEPLOYMENT', 'ROLLBACK_RECOMMENDATION')
$allowedDeploymentStates = @('PLANNED', 'READY_FOR_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED')
$allowedEnvironments = @('preview', 'staging', 'production')
$allowedRequestingRoles = @('Orchestrator', 'Architect', 'Developer', 'QA', 'Security', 'Release Manager')
$allowedBlockingRoles = @('QA', 'Security', 'Human')
$requiredAuditFields = @('timestamp', 'deploymentId', 'project', 'deploymentType', 'targetEnvironment', 'targetPlatform', 'approvalState', 'executionState', 'rollbackAvailable', 'riskLevel', 'humanApprovalRequired', 'result', 'blockers')
$requiredDeploymentFields = $requiredAuditFields + @('rollbackStrategy', 'dryRunOnly', 'preparedByRole', 'approverRole', 'approvedByRequester', 'evidence')
$requiredConsumedInputs = @(
    'config/project-templates.config.json',
    'config/portfolio.projects.json',
    'runtime/github-execution/github-execution.plan.json',
    'runtime/api-execution/api-execution.plan.json'
)

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

function Test-DeploymentItem {
    param(
        [Parameter(Mandatory)]$Deployment,
        [Parameter(Mandatory)][string]$Context,
        [Parameter()][bool]$RequiresTimestamp = $false
    )

    $contractDeploymentFields = @('deploymentId', 'project', 'requesterRole', 'deploymentType', 'targetEnvironment', 'targetPlatform', 'approvalState', 'executionState', 'rollbackAvailable', 'rollbackStrategy', 'riskLevel', 'humanApprovalRequired', 'dryRunOnly', 'preparedByRole', 'approverRole', 'approvedByRequester', 'result', 'blockers', 'evidence')
    $fieldsToRequire = if ($RequiresTimestamp) { $requiredDeploymentFields } else { $contractDeploymentFields }
    Test-RequiredFields -Value $Deployment -Fields $fieldsToRequire -Context $Context

    if ($Deployment.deploymentType -notin $allowedDeploymentTypes) {
        Add-Failure "$Context uses unsupported deployment type '$($Deployment.deploymentType)'."
    }
    if ($Deployment.targetPlatform -notin $allowedTargets) {
        Add-Failure "$Context uses unsupported deployment target '$($Deployment.targetPlatform)'."
    }
    if ($Deployment.targetEnvironment -notin $allowedEnvironments) {
        Add-Failure "$Context uses unsupported target environment '$($Deployment.targetEnvironment)'."
    }
    if ($Deployment.executionState -notin $allowedDeploymentStates) {
        Add-Failure "$Context uses unsupported execution state '$($Deployment.executionState)'."
    }
    if ($Deployment.approvalState -notin $allowedDeploymentStates) {
        Add-Failure "$Context uses unsupported approval state '$($Deployment.approvalState)'."
    }
    if ($Deployment.requesterRole -notin $allowedRequestingRoles) {
        Add-Failure "$Context uses unsupported requester role '$($Deployment.requesterRole)'."
    }
    foreach ($blocker in @($Deployment.blockers)) {
        if ($null -ne $blocker.PSObject.Properties['role'] -and $blocker.role -notin $allowedBlockingRoles) {
            Add-Failure "$Context uses unsupported blocker role '$($blocker.role)'."
        }
    }

    if ($Deployment.rollbackAvailable -ne $true) {
        Add-Failure "$Context must have rollbackAvailable=true."
    }
    if ([string]::IsNullOrWhiteSpace([string]$Deployment.rollbackStrategy)) {
        Add-Failure "$Context must include a rollback strategy."
    }
    if ($Deployment.deploymentType -in $approvalRequiredDeploymentTypes) {
        if ($Deployment.humanApprovalRequired -ne $true) {
            Add-Failure "$Context must require human approval."
        }
        if ($Deployment.approverRole -ne 'Human') {
            Add-Failure "$Context must use Human as approver role."
        }
    }
    if ($Deployment.approvedByRequester -eq $true) {
        Add-Failure "$Context violates no-self-approval."
    }
    if ($Deployment.executionState -eq 'EXECUTED' -and $Deployment.dryRunOnly -ne $true) {
        Add-Failure "$Context has non-dry-run EXECUTED state."
    }
}

$contract = Read-JsonForValidation -RelativePath $contractRelativePath
$schema = Read-JsonForValidation -RelativePath $schemaRelativePath
$portfolio = Read-JsonForValidation -RelativePath 'config/portfolio.projects.json'

$knownProjects = @()
if ($null -ne $portfolio) {
    $knownProjects = @($portfolio.projects | ForEach-Object { $_.projectName })
}

if ($null -ne $contract) {
    Test-RequiredFields -Value $contract -Fields @('schemaVersion', 'contractId', 'capability', 'mode', 'sourceOfTruth', 'schema', 'generatedPlan', 'generatedAudit', 'generatedApprovalReport', 'consumes', 'allowedTargets', 'allowedDeploymentTypes', 'allowedDeploymentStates', 'approvalRequiredDeploymentTypes', 'auditRequiredFields', 'approvalRules', 'deploymentSafety', 'boundaries', 'deployments') -Context 'Deployment contract'

    foreach ($requiredInput in $requiredConsumedInputs) {
        $found = $false
        foreach ($property in @($contract.consumes.PSObject.Properties)) {
            if ([string]$property.Value -eq $requiredInput) {
                $found = $true
            }
        }
        if (-not $found) {
            Add-Failure "Deployment contract must consume '$requiredInput'."
        }
        if (-not (Test-Path -LiteralPath (Join-Path $root $requiredInput) -PathType Leaf)) {
            Add-Failure "Deployment consumed input missing: $requiredInput"
        }
    }

    foreach ($target in @($contract.allowedTargets)) {
        if ($target -notin $allowedTargets) {
            Add-Failure "Contract contains unsupported deployment target: $target"
        }
    }
    foreach ($type in @($contract.allowedDeploymentTypes)) {
        if ($type -notin $allowedDeploymentTypes) {
            Add-Failure "Contract contains unsupported deployment type: $type"
        }
    }
    foreach ($state in @($contract.allowedDeploymentStates)) {
        if ($state -notin $allowedDeploymentStates) {
            Add-Failure "Contract contains unsupported deployment state: $state"
        }
    }
    foreach ($requiredType in $approvalRequiredDeploymentTypes) {
        if ($requiredType -notin @($contract.approvalRequiredDeploymentTypes)) {
            Add-Failure "Contract must require human approval for deployment type: $requiredType"
        }
    }
    foreach ($field in $requiredAuditFields) {
        if ($field -notin @($contract.auditRequiredFields)) {
            Add-Failure "Contract audit model misses required field: $field"
        }
    }

    $expectedBoundaries = @{
        offlinePlanningOnly = $true
        planningApprovalAuditOnly = $true
        performsDeployments = $false
        performsVercelDeployment = $false
        performsGitHubPagesDeployment = $false
        performsGitHubActionsExecution = $false
        performsBuildExecution = $false
        performsHostingExecution = $false
        publishesContent = $false
        storesCredentials = $false
        storesSecrets = $false
        readsSecretValues = $false
        createsBackgroundJobs = $false
        createsWorkers = $false
        createsQueues = $false
        createsSchedulers = $false
        autonomousDeployment = $false
        automaticRollback = $false
        aiWorkforceRuntimeExecution = $false
        softwareFactory = $false
    }
    Test-BooleanBoundary -Boundaries $contract.boundaries -Expected $expectedBoundaries -Context 'Deployment contract'

    foreach ($safetyFlag in @('validateDeploymentTarget', 'validateEnvironment', 'validateRollbackStrategy', 'validateApprovalStatus', 'preDeploymentValidationRequired')) {
        $property = $contract.deploymentSafety.PSObject.Properties[$safetyFlag]
        if ($null -eq $property -or $property.Value -ne $true) {
            Add-Failure "Deployment safety flag '$safetyFlag' must be true."
        }
    }

    foreach ($deployment in @($contract.deployments)) {
        Test-DeploymentItem -Deployment $deployment -Context "Deployment contract item '$($deployment.deploymentId)'"
        if ($knownProjects.Count -gt 0 -and $deployment.project -notin $knownProjects) {
            Add-Failure "Deployment contract item '$($deployment.deploymentId)' references unknown portfolio project '$($deployment.project)'."
        }
    }
}

if ($null -ne $schema) {
    Test-RequiredFields -Value $schema -Fields @('$schema', '$id', 'title', 'type', 'required', 'properties') -Context 'Deployment schema'
}

$generatorPath = Join-Path $root $generatorRelativePath
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure "Deployment generator missing: $generatorRelativePath"
}

if ($failures.Count -eq 0) {
    & $generatorPath | Out-Null
}

$plan = Read-JsonForValidation -RelativePath $planRelativePath
$audit = Read-JsonForValidation -RelativePath $auditRelativePath
$approval = Read-JsonForValidation -RelativePath $approvalRelativePath

if ($null -ne $plan) {
    Test-RequiredFields -Value $plan -Fields @('schemaVersion', 'generatedAt', 'source', 'sourceFile', 'mode', 'status', 'consumedInputs', 'summary', 'deployments', 'boundaries') -Context 'Deployment plan'
    foreach ($inputName in @($plan.consumedInputs.PSObject.Properties.Name)) {
        if ($plan.consumedInputs.$inputName.exists -ne $true) {
            Add-Failure "Deployment plan consumed input '$inputName' must exist."
        }
    }
    foreach ($deployment in @($plan.deployments)) {
        Test-DeploymentItem -Deployment $deployment -Context "Deployment plan item '$($deployment.deploymentId)'" -RequiresTimestamp $true
        foreach ($checkName in @('deploymentTargetValidated', 'environmentValidated', 'rollbackStrategyValidated', 'approvalStatusValidated')) {
            if ($deployment.preDeploymentChecks.$checkName -ne $true) {
                Add-Failure "Deployment plan item '$($deployment.deploymentId)' preDeploymentChecks.$checkName must be true."
            }
        }
        if ($deployment.preDeploymentChecks.realDeploymentCapability -ne $false) {
            Add-Failure "Deployment plan item '$($deployment.deploymentId)' must not have real deployment capability."
        }
    }
}

if ($null -ne $audit) {
    Test-RequiredFields -Value $audit -Fields @('schemaVersion', 'generatedAt', 'source', 'sourceFile', 'status', 'auditRequired', 'entries', 'boundaries') -Context 'Deployment audit report'
    if ($audit.auditRequired -ne $true) {
        Add-Failure 'Deployment audit report must set auditRequired=true.'
    }
    foreach ($entry in @($audit.entries)) {
        Test-RequiredFields -Value $entry -Fields $requiredAuditFields -Context "Deployment audit entry '$($entry.deploymentId)'"
        if ($entry.executionState -eq 'EXECUTED' -and $entry.dryRunOnly -ne $true) {
            Add-Failure "Deployment audit entry '$($entry.deploymentId)' has non-dry-run EXECUTED state."
        }
        if ($entry.rollbackAvailable -ne $true) {
            Add-Failure "Deployment audit entry '$($entry.deploymentId)' must have rollbackAvailable=true."
        }
    }
    if ($null -ne $plan -and @($audit.entries).Count -ne @($plan.deployments).Count) {
        Add-Failure 'Every planned deployment must have one audit entry.'
    }
}

if ($null -ne $approval) {
    Test-RequiredFields -Value $approval -Fields @('schemaVersion', 'generatedAt', 'source', 'sourceFile', 'status', 'humanFinalAuthority', 'noAutomaticApproval', 'noApprovalBypass', 'noSelfApproval', 'noRoleMayApproveOwnRequest', 'qaMayBlock', 'securityMayBlock', 'summary', 'approvals', 'boundaries') -Context 'Deployment approval report'
    if ($approval.humanFinalAuthority -ne $true -or $approval.noAutomaticApproval -ne $true -or $approval.noApprovalBypass -ne $true -or $approval.noSelfApproval -ne $true -or $approval.noRoleMayApproveOwnRequest -ne $true) {
        Add-Failure 'Deployment approval report must enforce human authority, no automatic approval, no bypass, no self-approval and no requester self-approval.'
    }
    foreach ($item in @($approval.approvals)) {
        if ($item.deploymentType -in $approvalRequiredDeploymentTypes -and $item.humanApprovalRequired -ne $true) {
            Add-Failure "Deployment approval item '$($item.deploymentId)' must require human approval."
        }
        if ($item.deploymentType -in $approvalRequiredDeploymentTypes -and $item.approverRole -ne 'Human') {
            Add-Failure "Deployment approval item '$($item.deploymentId)' must use Human as approver role."
        }
        if ($item.approvedByRequester -eq $true) {
            Add-Failure "Deployment approval item '$($item.deploymentId)' violates no-self-approval."
        }
        if ($item.executionState -eq 'EXECUTED' -and $item.dryRunOnly -ne $true) {
            Add-Failure "Deployment approval item '$($item.deploymentId)' has non-dry-run EXECUTED state."
        }
    }
}

$scanPaths = @(
    $contractRelativePath,
    $schemaRelativePath,
    'services/deployment',
    $planRelativePath,
    $auditRelativePath,
    $approvalRelativePath,
    'docs/governance/DEPLOYMENT_LAYER.md',
    'docs/governance/DEPLOYMENT_BOUNDARIES.md',
    'scripts/validation/validate-deployment.ps1'
)

$secretPatterns = @(
    'api[_-]?key\s*[:=]\s*["''][^"'']+["'']',
    'token\s*[:=]\s*["''][^"'']+["'']',
    'secret\s*[:=]\s*["''][^"'']+["'']',
    'password\s*[:=]\s*["''][^"'']+["'']',
    'deployment[_-]?credential\s*[:=]',
    'hosting[_-]?credential\s*[:=]',
    'Bearer\s+[A-Za-z0-9._~+/=-]+',
    'Cookie\s*[:=]',
    '-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----'
)
$forbiddenCapabilityPatterns = @(
    ('Invoke-' + 'RestMethod'),
    ('Invoke-' + 'WebRequest'),
    ('Start-' + 'Job'),
    ('Start-' + 'ThreadJob'),
    ('Register-' + 'ScheduledTask'),
    ('New-' + 'Service'),
    ('Start-' + 'Service'),
    ('Http' + 'Client'),
    'New-Object\s+System\.Net\.WebClient',
    'gh\s+workflow\s+run',
    'gh\s+run\s+',
    'gh\s+pages\s+',
    'git\s+push\s+',
    'vercel\s+deploy(\s|$)',
    'vercel\s+--prod',
    'netlify\s+deploy(\s|$)',
    'firebase\s+deploy(\s|$)',
    'npm\s+(run\s+)?build',
    'pnpm\s+(run\s+)?build',
    'yarn\s+build',
    'docker\s+',
    'kubectl\s+',
    'terraform\s+apply',
    'Start-Sleep\s+-Seconds\s+[1-9][0-9]*'
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
                Add-Failure "Possible secret or credential found in deployment artifact: $($file.FullName)"
            }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Forbidden deployment/build/background capability found in deployment artifact: $($file.FullName) pattern=$pattern"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "Deployment validation failed with $($failures.Count) failure(s)."
}

Write-Host "Studio OS V2.4 Deployment Layer passed deterministic checks. Checked $(@($allowedTargets).Count) targets and $(@($allowedDeploymentTypes).Count) deployment types." -ForegroundColor Green
