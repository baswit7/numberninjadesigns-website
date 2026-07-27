[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]

$contractRelativePath = 'shared/contracts/api-execution/api-execution.contract.json'
$schemaRelativePath = 'shared/contracts/api-execution/api-execution.schema.json'
$apiCenterRelativePath = 'config/api-center.config.json'
$generatorRelativePath = 'services/api-execution/generate-api-execution-plan.ps1'
$planRelativePath = 'runtime/api-execution/api-execution.plan.json'
$auditRelativePath = 'runtime/api-execution/api-execution.audit.json'
$approvalRelativePath = 'runtime/api-execution/api-execution-approval.report.json'

$allowedProviders = @('OpenAI', 'GitHub', 'Telegram', 'Notion', 'Etsy', 'TikTok', 'Pinterest', 'Instagram', 'Facebook', 'Vercel')
$allowedActionTypes = @(
    'API_REQUEST_PLAN',
    'API_AUTH_REQUIREMENT_REVIEW',
    'API_SCOPE_REVIEW',
    'API_COST_RISK_REVIEW',
    'API_RATE_LIMIT_REVIEW',
    'API_RESPONSE_SHAPE_REVIEW',
    'API_EXECUTION_RECOMMENDATION'
)
$allowedExecutionStates = @('PLANNED', 'READY_FOR_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED')
$allowedRequestingRoles = @('Orchestrator', 'Architect', 'Developer', 'QA', 'Security')
$allowedBlockingRoles = @('QA', 'Security', 'Human')
$requiredAuditFields = @('timestamp', 'requestId', 'providerName', 'actionType', 'requesterRole', 'usedByProject', 'authType', 'requiredEnvironmentVariables', 'scopesRequired', 'approvalState', 'executionState', 'riskLevel', 'costRisk', 'rateLimitRisk', 'dataAccessRisk', 'externalMutationRisk', 'humanApprovalRequired', 'result', 'blockers')
$requiredActionFields = $requiredAuditFields + @('dryRunOnly', 'preparedByRole', 'approverRole', 'approvedByRequester', 'evidence')
$environmentVariableNamePattern = '^[A-Z][A-Z0-9_]*$'

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

function Test-EnvironmentVariableNames {
    param(
        [Parameter(Mandatory)]$Names,
        [Parameter(Mandatory)][string]$Context
    )

    foreach ($name in @($Names)) {
        if ([string]::IsNullOrWhiteSpace([string]$name)) {
            Add-Failure "$Context contains an empty environment variable name."
            continue
        }
        if ([string]$name -notmatch $environmentVariableNamePattern) {
            Add-Failure "$Context contains a value that is not an environment variable name: $name"
        }
        if ([string]$name -match '^[A-Za-z0-9+/]{20,}={0,2}$') {
            Add-Failure "$Context contains a token-shaped value instead of an environment variable name."
        }
    }
}

function Test-ApiExecutionAction {
    param(
        [Parameter(Mandatory)]$Action,
        [Parameter(Mandatory)][hashtable]$ProviderByName,
        [Parameter(Mandatory)][string]$Context,
        [Parameter()][bool]$RequiresProviderMetadata = $false
    )

    $contractActionFields = @('requestId', 'providerName', 'requesterRole', 'usedByProject', 'actionType', 'approvalState', 'executionState', 'riskLevel', 'costRisk', 'rateLimitRisk', 'dataAccessRisk', 'externalMutationRisk', 'humanApprovalRequired', 'dryRunOnly', 'preparedByRole', 'approverRole', 'approvedByRequester', 'result', 'blockers', 'evidence')
    $fieldsToRequire = if ($RequiresProviderMetadata) { $requiredActionFields } else { $contractActionFields }
    Test-RequiredFields -Value $Action -Fields $fieldsToRequire -Context $Context

    if ($Action.providerName -notin $allowedProviders) {
        Add-Failure "$Context uses unsupported provider '$($Action.providerName)'."
    }
    if (-not $ProviderByName.ContainsKey([string]$Action.providerName)) {
        Add-Failure "$Context provider '$($Action.providerName)' is missing from API Center."
        return
    }
    if ($Action.actionType -notin $allowedActionTypes) {
        Add-Failure "$Context uses unsupported action type '$($Action.actionType)'."
    }
    if ($Action.executionState -notin $allowedExecutionStates) {
        Add-Failure "$Context uses unsupported execution state '$($Action.executionState)'."
    }
    if ($Action.approvalState -notin $allowedExecutionStates) {
        Add-Failure "$Context uses unsupported approval state '$($Action.approvalState)'."
    }
    if ($Action.requesterRole -notin $allowedRequestingRoles) {
        Add-Failure "$Context uses unsupported requester role '$($Action.requesterRole)'."
    }
    foreach ($blocker in @($Action.blockers)) {
        if ($null -ne $blocker.PSObject.Properties['role'] -and $blocker.role -notin $allowedBlockingRoles) {
            Add-Failure "$Context uses unsupported blocker role '$($blocker.role)'."
        }
    }
    if ($Action.humanApprovalRequired -ne $true) {
        Add-Failure "$Context must require human approval."
    }
    if ($Action.approverRole -ne 'Human') {
        Add-Failure "$Context must use Human as approver role."
    }
    if ($Action.approvedByRequester -eq $true) {
        Add-Failure "$Context violates no-self-approval."
    }
    if ($Action.executionState -eq 'EXECUTED' -and $Action.dryRunOnly -ne $true) {
        Add-Failure "$Context has non-dry-run EXECUTED state."
    }

    $provider = $ProviderByName[[string]$Action.providerName]
    if ($null -ne $Action.PSObject.Properties['authType'] -and $Action.authType -ne $provider.authType) {
        Add-Failure "$Context duplicates or diverges from API Center authType for provider '$($Action.providerName)'."
    }
    if ($null -ne $Action.PSObject.Properties['requiredEnvironmentVariables']) {
        $expectedEnv = @($provider.requiredEnvironmentVariables) | Sort-Object
        $actualEnv = @($Action.requiredEnvironmentVariables) | Sort-Object
        if (($expectedEnv -join '|') -ne ($actualEnv -join '|')) {
            Add-Failure "$Context requiredEnvironmentVariables must match API Center for provider '$($Action.providerName)'."
        }
        Test-EnvironmentVariableNames -Names $Action.requiredEnvironmentVariables -Context $Context
    }
    if ($null -ne $Action.PSObject.Properties['scopesRequired']) {
        $expectedScopes = @($provider.scopesRequired) | Sort-Object
        $actualScopes = @($Action.scopesRequired) | Sort-Object
        if (($expectedScopes -join '|') -ne ($actualScopes -join '|')) {
            Add-Failure "$Context scopesRequired must match API Center for provider '$($Action.providerName)'."
        }
    }
}

$contract = Read-JsonForValidation -RelativePath $contractRelativePath
$schema = Read-JsonForValidation -RelativePath $schemaRelativePath
$apiCenter = Read-JsonForValidation -RelativePath $apiCenterRelativePath

$providerByName = @{}
if ($null -ne $apiCenter) {
    foreach ($provider in @($apiCenter.providers)) {
        $providerByName[[string]$provider.providerName] = $provider
    }
}

if ($null -ne $contract) {
    Test-RequiredFields -Value $contract -Fields @('schemaVersion', 'contractId', 'capability', 'mode', 'providerCatalogSource', 'allowedProviders', 'allowedActionTypes', 'allowedExecutionStates', 'allowedRequestingRoles', 'allowedBlockingRoles', 'humanApprovalRequiredActionTypes', 'auditRequiredFields', 'approvalRules', 'boundaries', 'requests') -Context 'API execution contract'

    foreach ($providerName in @($contract.allowedProviders)) {
        if ($providerName -notin $allowedProviders) {
            Add-Failure "Contract contains unsupported provider: $providerName"
        }
        if (-not $providerByName.ContainsKey([string]$providerName)) {
            Add-Failure "Contract provider '$providerName' is missing from API Center."
        }
    }
    foreach ($actionType in @($contract.allowedActionTypes)) {
        if ($actionType -notin $allowedActionTypes) {
            Add-Failure "Contract contains unsupported action type: $actionType"
        }
    }
    foreach ($state in @($contract.allowedExecutionStates)) {
        if ($state -notin $allowedExecutionStates) {
            Add-Failure "Contract contains unsupported execution state: $state"
        }
    }
    foreach ($role in @($contract.allowedRequestingRoles)) {
        if ($role -notin $allowedRequestingRoles) {
            Add-Failure "Contract contains unsupported requesting role: $role"
        }
    }
    foreach ($field in $requiredAuditFields) {
        if ($field -notin @($contract.auditRequiredFields)) {
            Add-Failure "Contract audit model misses required field: $field"
        }
    }

    $expectedContractBoundaries = @{
        offlinePlanningOnly = $true
        planningApprovalAuditOnly = $true
        performsProviderCalls = $false
        performsOpenAiCalls = $false
        performsGitHubApiCalls = $false
        performsTelegramSends = $false
        performsNotionWrites = $false
        performsCommerceActions = $false
        performsSocialPublishing = $false
        performsDeployments = $false
        storesCredentials = $false
        storesSecrets = $false
        readsSecretValues = $false
        createsOAuthFlows = $false
        refreshesTokens = $false
        createsBackgroundJobs = $false
        createsWorkers = $false
        createsQueues = $false
        createsSchedulers = $false
        autonomousExecution = $false
        paidSpendExecution = $false
        contentPublication = $false
        aiWorkforceRuntimeExecution = $false
        softwareFactory = $false
    }
    Test-BooleanBoundary -Boundaries $contract.boundaries -Expected $expectedContractBoundaries -Context 'API execution contract'

    foreach ($request in @($contract.requests)) {
        Test-ApiExecutionAction -Action $request -ProviderByName $providerByName -Context "API execution request '$($request.requestId)'"
        if ($null -ne $request.PSObject.Properties['authType'] -or $null -ne $request.PSObject.Properties['requiredEnvironmentVariables'] -or $null -ne $request.PSObject.Properties['scopesRequired']) {
            Add-Failure "API execution request '$($request.requestId)' must not duplicate API Center provider metadata."
        }
    }
}

if ($null -ne $schema) {
    Test-RequiredFields -Value $schema -Fields @('$schema', '$id', 'title', 'type', 'required', 'properties') -Context 'API execution schema'
}

$generatorPath = Join-Path $root $generatorRelativePath
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure "API execution generator missing: $generatorRelativePath"
}

if ($failures.Count -eq 0) {
    & $generatorPath | Out-Null
}

$plan = Read-JsonForValidation -RelativePath $planRelativePath
$audit = Read-JsonForValidation -RelativePath $auditRelativePath
$approval = Read-JsonForValidation -RelativePath $approvalRelativePath

if ($null -ne $plan) {
    Test-RequiredFields -Value $plan -Fields @('schemaVersion', 'generatedAt', 'source', 'sourceFile', 'providerCatalogSource', 'mode', 'status', 'summary', 'actions', 'boundaries') -Context 'API execution plan'
    foreach ($action in @($plan.actions)) {
        Test-ApiExecutionAction -Action $action -ProviderByName $providerByName -Context "API execution plan action '$($action.requestId)'" -RequiresProviderMetadata $true
    }
}

if ($null -ne $audit) {
    Test-RequiredFields -Value $audit -Fields @('schemaVersion', 'generatedAt', 'source', 'sourceFile', 'providerCatalogSource', 'status', 'auditRequired', 'entries', 'boundaries') -Context 'API execution audit report'
    if ($audit.auditRequired -ne $true) {
        Add-Failure 'API execution audit report must set auditRequired=true.'
    }
    foreach ($entry in @($audit.entries)) {
        Test-RequiredFields -Value $entry -Fields $requiredAuditFields -Context "API execution audit entry '$($entry.requestId)'"
        Test-EnvironmentVariableNames -Names $entry.requiredEnvironmentVariables -Context "API execution audit entry '$($entry.requestId)'"
        if ($entry.executionState -eq 'EXECUTED' -and $entry.dryRunOnly -ne $true) {
            Add-Failure "API execution audit entry '$($entry.requestId)' has non-dry-run EXECUTED state."
        }
    }
    if ($null -ne $plan -and @($audit.entries).Count -ne @($plan.actions).Count) {
        Add-Failure 'Every planned API action must have one audit entry.'
    }
}

if ($null -ne $approval) {
    Test-RequiredFields -Value $approval -Fields @('schemaVersion', 'generatedAt', 'source', 'sourceFile', 'status', 'humanFinalAuthority', 'noAutomaticApproval', 'noSelfApproval', 'noRoleMayApproveOwnRequest', 'securityMayBlock', 'qaMayBlock', 'summary', 'approvals', 'boundaries') -Context 'API execution approval report'
    if ($approval.humanFinalAuthority -ne $true -or $approval.noAutomaticApproval -ne $true -or $approval.noSelfApproval -ne $true -or $approval.noRoleMayApproveOwnRequest -ne $true) {
        Add-Failure 'API execution approval report must enforce human authority, no automatic approval, no self-approval and no requester self-approval.'
    }
    foreach ($item in @($approval.approvals)) {
        if ($item.humanApprovalRequired -ne $true) {
            Add-Failure "Approval item '$($item.requestId)' must require human approval."
        }
        if ($item.approverRole -ne 'Human') {
            Add-Failure "Approval item '$($item.requestId)' must use Human as approver role."
        }
        if ($item.approvedByRequester -eq $true) {
            Add-Failure "Approval item '$($item.requestId)' violates no-self-approval."
        }
        if ($item.executionState -eq 'EXECUTED' -and $item.dryRunOnly -ne $true) {
            Add-Failure "Approval item '$($item.requestId)' has non-dry-run EXECUTED state."
        }
    }
}

$scanPaths = @(
    $contractRelativePath,
    $schemaRelativePath,
    'services/api-execution',
    $planRelativePath,
    $auditRelativePath,
    $approvalRelativePath,
    'docs/governance/API_EXECUTION_LAYER.md',
    'docs/governance/API_EXECUTION_BOUNDARIES.md',
    'scripts/validation/validate-api-execution.ps1'
)

$secretPatterns = @(
    'api[_-]?key\s*[:=]\s*["''][^"'']+["'']',
    'token\s*[:=]\s*["''][^"'']+["'']',
    'secret\s*[:=]\s*["''][^"'']+["'']',
    'password\s*[:=]\s*["''][^"'']+["'']',
    'Bearer\s+[A-Za-z0-9._~+/=-]+',
    'Cookie\s*[:=]',
    'refresh[_-]?token\s*[:=]',
    'client[_-]?secret\s*[:=]',
    '-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----'
)
$forbiddenCapabilityPatterns = @(
    ('Invoke-' + 'RestMethod'),
    ('Invoke-' + 'WebRequest'),
    ('Start-' + 'Job'),
    ('Register-' + 'ScheduledTask'),
    ('New-' + 'Service'),
    ('Start-' + 'Service'),
    ('Start-' + 'ThreadJob'),
    'New-Object\s+System\.Net\.WebClient',
    ('Http' + 'Client'),
    'gh\s+api',
    'gh\s+pr\s+merge',
    'gh\s+repo\s+',
    'vercel\s+deploy(\s|$)',
    'netlify\s+deploy(\s|$)',
    'firebase\s+deploy(\s|$)',
    'docker\s+',
    'npm\s+',
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
                Add-Failure "Possible secret or credential found in API execution artifact: $($file.FullName)"
            }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Forbidden provider/deployment/background capability found in API execution artifact: $($file.FullName) pattern=$pattern"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "API execution validation failed with $($failures.Count) failure(s)."
}

Write-Host "Studio OS V2.3 API Execution Layer passed deterministic checks. Checked $(@($allowedProviders).Count) providers and $(@($allowedActionTypes).Count) action types." -ForegroundColor Green
