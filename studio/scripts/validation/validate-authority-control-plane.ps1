[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]
$checks = New-Object System.Collections.Generic.List[object]

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message) | Out-Null
}

function Read-AuthorityJson {
    param([Parameter(Mandatory)][string]$RelativePath)

    try {
        return Read-StudioJson -RelativePath $RelativePath
    }
    catch {
        Add-Failure "$RelativePath could not be read as JSON. $($_.Exception.Message)"
        return $null
    }
}

function Test-RequiredFields {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string[]]$RequiredFields,
        [Parameter(Mandatory)][string]$Label
    )

    foreach ($field in $RequiredFields) {
        $property = $Value.PSObject.Properties[$field]
        if ($null -eq $property -or $null -eq $property.Value) {
            Add-Failure "$Label misses required field '$field'."
            continue
        }
        if ($property.Value -is [string] -and [string]::IsNullOrWhiteSpace($property.Value)) {
            Add-Failure "$Label misses required field '$field'."
        }
    }
}

function Test-FalseBoundaryFlag {
    param(
        [Parameter(Mandatory)]$Object,
        [Parameter(Mandatory)][string]$Flag,
        [Parameter(Mandatory)][string]$Label
    )

    $property = $Object.PSObject.Properties[$Flag]
    if ($null -eq $property) {
        Add-Failure "$Label missing boundary flag '$Flag'."
        return
    }
    if ($property.Value -ne $false) {
        Add-Failure "$Label boundary flag '$Flag' must be false."
    }
}

function Test-PathOrKnownOwner {
    param(
        [Parameter(Mandatory)][string]$Value,
        [Parameter(Mandatory)][string]$Label
    )

    if ($Value -in @('constitution')) {
        return
    }

    $path = Join-Path $root $Value
    if (-not (Test-Path -LiteralPath $path)) {
        Add-Failure "$Label references missing path or unknown owner '$Value'."
    }
}

function Test-ConsumerReference {
    param(
        [Parameter(Mandatory)][string]$Value,
        [Parameter(Mandatory)][string]$Label
    )

    $path = Join-Path $root $Value
    if (-not (Test-Path -LiteralPath $path)) {
        Add-Failure "$Label references missing consumer path '$Value'."
    }
}

$requiredPaths = @(
    'shared/contracts/authority/constitution.rules.json',
    'shared/contracts/authority/authority-classifications.json',
    'shared/contracts/authority/authority-decisions.json',
    'shared/contracts/authority/authority-registry.json',
    'shared/contracts/authority/validation-reports/authority-validation-report.json',
    'docs/governance/CONSTITUTION_AUTHORITY_CONTROL_PLANE.md',
    'docs/governance/PHASE_15_CONSTITUTION_AUTHORITY_CONTROL_PLANE.md',
    'docs/governance/PHASE_15_BOUNDARY_AUDIT.md'
)

foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath))) {
        Add-Failure "Required Phase 15 authority artifact missing: $relativePath"
    }
}

$constitution = Read-AuthorityJson -RelativePath 'shared/contracts/authority/constitution.rules.json'
$classifications = Read-AuthorityJson -RelativePath 'shared/contracts/authority/authority-classifications.json'
$decisions = Read-AuthorityJson -RelativePath 'shared/contracts/authority/authority-decisions.json'
$registry = Read-AuthorityJson -RelativePath 'shared/contracts/authority/authority-registry.json'

$validClassifications = @()
if ($null -ne $classifications) {
    Test-RequiredFields -Value $classifications -RequiredFields @('schemaVersion', 'phase', 'contractId', 'sourceOfTruth', 'nonExecutable', 'classifications', 'boundary') -Label 'Authority classification model'
    if ($classifications.phase -ne 'phase-15') { Add-Failure 'Authority classification model phase must be phase-15.' }
    if ($classifications.nonExecutable -ne $true) { Add-Failure 'Authority classification model must be nonExecutable=true.' }
    foreach ($classification in @($classifications.classifications)) {
        Test-RequiredFields -Value $classification -RequiredFields @('id', 'description', 'requiresApproval', 'defaultDecision') -Label "Classification '$($classification.id)'"
        $validClassifications += $classification.id
    }
    foreach ($duplicate in @($validClassifications | Group-Object | Where-Object { $_.Count -gt 1 })) {
        Add-Failure "Duplicate authority classification '$($duplicate.Name)'."
    }
    $checks.Add([ordered]@{ id = 'authority-classifications'; status = 'checked'; count = @($classifications.classifications).Count }) | Out-Null
}

$validDecisions = @()
if ($null -ne $decisions) {
    Test-RequiredFields -Value $decisions -RequiredFields @('schemaVersion', 'phase', 'contractId', 'sourceOfTruth', 'nonExecutable', 'decisions', 'boundary') -Label 'Authority decision model'
    if ($decisions.phase -ne 'phase-15') { Add-Failure 'Authority decision model phase must be phase-15.' }
    if ($decisions.nonExecutable -ne $true) { Add-Failure 'Authority decision model must be nonExecutable=true.' }
    foreach ($decision in @($decisions.decisions)) {
        Test-RequiredFields -Value $decision -RequiredFields @('id', 'meaning') -Label "Decision '$($decision.id)'"
        $validDecisions += $decision.id
    }
    foreach ($requiredDecision in @('ALLOW', 'DENY', 'REQUIRES_APPROVAL', 'OUT_OF_SCOPE')) {
        if ($validDecisions -notcontains $requiredDecision) {
            Add-Failure "Authority decision model misses required decision '$requiredDecision'."
        }
    }
    foreach ($duplicate in @($validDecisions | Group-Object | Where-Object { $_.Count -gt 1 })) {
        Add-Failure "Duplicate authority decision '$($duplicate.Name)'."
    }
    $checks.Add([ordered]@{ id = 'authority-decisions'; status = 'checked'; count = @($decisions.decisions).Count }) | Out-Null
}

if ($null -ne $constitution) {
    Test-RequiredFields -Value $constitution -RequiredFields @('schemaVersion', 'phase', 'contractId', 'sourceOfTruth', 'nonExecutable', 'rules', 'boundary') -Label 'Constitution'
    if ($constitution.phase -ne 'phase-15') { Add-Failure 'Constitution phase must be phase-15.' }
    if ($constitution.sourceOfTruth -ne 'constitution') { Add-Failure 'Constitution must be the constitution source of truth.' }
    if ($constitution.nonExecutable -ne $true) { Add-Failure 'Constitution must be nonExecutable=true.' }
    foreach ($flag in @('executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretMutationAllowed', 'githubWriteAllowed', 'runtimeMutationAllowed', 'dashboardCommandAuthorityAllowed', 'browserStorageAuthorityAllowed')) {
        Test-FalseBoundaryFlag -Object $constitution.boundary -Flag $flag -Label 'Constitution'
    }
    foreach ($rule in @($constitution.rules)) {
        Test-RequiredFields -Value $rule -RequiredFields @('ruleId', 'owner', 'classification', 'scope', 'subject', 'prohibitedOwnership', 'decision', 'reason') -Label "Constitution rule '$($rule.ruleId)'"
        if ($rule.owner -ne 'constitution') { Add-Failure "Constitution rule '$($rule.ruleId)' must be owned by constitution." }
        if ($validClassifications -notcontains $rule.classification) { Add-Failure "Constitution rule '$($rule.ruleId)' has invalid classification '$($rule.classification)'." }
        if ($validDecisions -notcontains $rule.decision) { Add-Failure "Constitution rule '$($rule.ruleId)' has invalid decision '$($rule.decision)'." }
        Test-PathOrKnownOwner -Value $rule.subject -Label "Constitution rule '$($rule.ruleId)' subject"
    }
    foreach ($duplicate in @(@($constitution.rules) | Group-Object ruleId | Where-Object { $_.Count -gt 1 })) {
        Add-Failure "Duplicate constitution rule '$($duplicate.Name)'."
    }
    $checks.Add([ordered]@{ id = 'constitution-rules'; status = 'checked'; count = @($constitution.rules).Count }) | Out-Null
}

$forbiddenAuthorityIds = @(
    'provider.invoke',
    'deployment.start',
    'execution.run',
    'credential.read',
    'secret.write',
    'github.repo.write'
)

if ($null -ne $registry) {
    Test-RequiredFields -Value $registry -RequiredFields @('schemaVersion', 'phase', 'registryId', 'sourceOfTruth', 'nonExecutable', 'authorities', 'boundary') -Label 'Authority registry'
    if ($registry.phase -ne 'phase-15') { Add-Failure 'Authority registry phase must be phase-15.' }
    if ($registry.sourceOfTruth -ne 'authority-registry') { Add-Failure 'Authority registry must be the authority-registry source of truth.' }
    if ($registry.nonExecutable -ne $true) { Add-Failure 'Authority registry must be nonExecutable=true.' }
    foreach ($flag in @('executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretMutationAllowed', 'githubWriteAllowed', 'runtimeMutationAllowed')) {
        Test-FalseBoundaryFlag -Object $registry.boundary -Flag $flag -Label 'Authority registry'
    }

    $authorityIds = @(@($registry.authorities) | ForEach-Object { $_.authorityId })
    foreach ($duplicate in @($authorityIds | Group-Object | Where-Object { $_.Count -gt 1 })) {
        Add-Failure "Duplicate authority '$($duplicate.Name)'."
    }

    foreach ($authority in @($registry.authorities)) {
        Test-RequiredFields -Value $authority -RequiredFields @('authorityId', 'owner', 'classification', 'allowedConsumers', 'forbiddenConsumers', 'approvalRequired', 'scope', 'decision') -Label "Authority '$($authority.authorityId)'"
        Test-PathOrKnownOwner -Value $authority.owner -Label "Authority '$($authority.authorityId)' owner"
        if ($validClassifications -notcontains $authority.classification) {
            Add-Failure "Authority '$($authority.authorityId)' has invalid classification '$($authority.classification)'."
        }
        if ($validDecisions -notcontains $authority.decision) {
            Add-Failure "Authority '$($authority.authorityId)' has invalid decision '$($authority.decision)'."
        }
        if ([string]::IsNullOrWhiteSpace($authority.scope)) {
            Add-Failure "Authority '$($authority.authorityId)' has invalid empty scope."
        }
        foreach ($consumer in @($authority.allowedConsumers)) {
            Test-ConsumerReference -Value $consumer -Label "Authority '$($authority.authorityId)' allowed consumer"
        }
        foreach ($consumer in @($authority.forbiddenConsumers)) {
            Test-ConsumerReference -Value $consumer -Label "Authority '$($authority.authorityId)' forbidden consumer"
        }
        foreach ($consumer in @($authority.allowedConsumers)) {
            if (@($authority.forbiddenConsumers) -contains $consumer) {
                Add-Failure "Authority '$($authority.authorityId)' lists '$consumer' as both allowed and forbidden."
            }
        }

        if ($forbiddenAuthorityIds -contains $authority.authorityId) {
            if ($authority.owner -ne 'constitution') { Add-Failure "Forbidden authority '$($authority.authorityId)' must be owned by constitution." }
            if ($authority.classification -ne 'forbidden-currently') { Add-Failure "Forbidden authority '$($authority.authorityId)' must be classified as forbidden-currently." }
            if ($authority.decision -ne 'DENY') { Add-Failure "Forbidden authority '$($authority.authorityId)' must have decision DENY." }
            if ($authority.approvalRequired -ne $true) { Add-Failure "Forbidden authority '$($authority.authorityId)' must require approval." }
            if (@($authority.allowedConsumers).Count -ne 0) { Add-Failure "Forbidden authority '$($authority.authorityId)' must have no allowed consumers." }
        }
    }

    foreach ($requiredForbiddenAuthority in $forbiddenAuthorityIds) {
        if ($authorityIds -notcontains $requiredForbiddenAuthority) {
            Add-Failure "Authority registry misses required forbidden authority '$requiredForbiddenAuthority'."
        }
    }

    if ($null -ne $constitution) {
        foreach ($rule in @($constitution.rules)) {
            foreach ($prohibitedOwnership in @($rule.prohibitedOwnership)) {
                foreach ($violation in @(@($registry.authorities) | Where-Object { $_.authorityId -eq $prohibitedOwnership -and $_.owner -eq $rule.subject })) {
                    Add-Failure "Constitutional violation: '$($rule.subject)' owns prohibited authority '$($violation.authorityId)' by rule '$($rule.ruleId)'."
                }
            }
        }
    }

    $checks.Add([ordered]@{ id = 'authority-registry'; status = 'checked'; count = @($registry.authorities).Count }) | Out-Null
}

$reportStatus = 'failed'
$reportSummary = "Authority control plane failed with $($failures.Count) issue(s)."
if ($failures.Count -eq 0) {
    $reportStatus = 'passed'
    $reportSummary = 'Authority control plane passed deterministic constitutional checks.'
}
$report = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-15'
    reportId = 'authority-control-plane-validation'
    status = $reportStatus
    summary = $reportSummary
    checks = $checks.ToArray()
    failures = $failures.ToArray()
    boundary = [ordered]@{
        machineReadableReportOnly = $true
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        credentialAccessAllowed = $false
        secretMutationAllowed = $false
        githubWriteAllowed = $false
        runtimeMutationAllowed = $false
    }
}

Write-StudioJson -RelativePath 'shared/contracts/authority/validation-reports/authority-validation-report.json' -Value $report

if ($failures.Count -gt 0) {
    Write-Host 'Phase 15 authority control plane validation failed.' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'Phase 15 authority control plane passed deterministic checks.' -ForegroundColor Green
exit 0
