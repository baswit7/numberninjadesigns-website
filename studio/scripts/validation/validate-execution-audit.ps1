[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]

$contractRelativePath = 'shared/contracts/execution-audit/execution-audit.contract.json'
$schemaRelativePath = 'shared/contracts/execution-audit/execution-audit.schema.json'
$generatorRelativePath = 'services/execution-audit/generate-execution-audit.ps1'
$reportRelativePath = 'runtime/execution-audit/audit.report.json'
$summaryRelativePath = 'runtime/execution-audit/audit.summary.json'
$boundaryRelativePath = 'runtime/execution-audit/audit.boundary.json'

$requiredEntryFields = @(
    'auditId',
    'timestamp',
    'sourceLayer',
    'decisionLayer',
    'decisionOutcome',
    'evidencePresent',
    'authoritySource',
    'reviewSource',
    'reviewOutcome',
    'dispatchEligible',
    'unknownState',
    'notes',
    'manualEvidenceRequired',
    'manualEvidencePresent',
    'manualEvidenceVerified'
)
$allowedDecisionOutcomes = @('UNKNOWN', 'PASS', 'DENY', 'BLOCK')

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

function Test-Boundaries {
    param(
        [Parameter(Mandatory)]$Boundaries,
        [Parameter(Mandatory)][string]$Context
    )

    $expected = @{
        readOnly = $true
        nonExecuting = $true
        nonDispatching = $true
        performsExecution = $false
        executionEngine = $false
        dispatchEngine = $false
        providerExecution = $false
        githubExecution = $false
        deploymentExecution = $false
        automaticApproval = $false
        automaticDispatch = $false
        queues = $false
        workers = $false
        schedulers = $false
        backgroundJobs = $false
        agentExecution = $false
        credentialAccess = $false
        secretAccess = $false
        branchWrites = $false
        repositorySettingsMutation = $false
        collaboratorMutation = $false
    }

    foreach ($key in $expected.Keys) {
        $property = $Boundaries.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $expected[$key]) {
            Add-Failure "$Context boundary '$key' must be $($expected[$key])."
        }
    }
}

function Test-DerivationRules {
    param([Parameter(Mandatory)]$Rules)

    $expected = @{
        ownsTruth = $false
        ownsExecution = $false
        ownsDispatch = $false
        ownsAuditReports = $true
        readsExecutionRequest = $true
        readsExecutionApproval = $true
        readsExecutionPreflight = $true
        readsExecutionReview = $true
        readsExecutionDispatch = $true
        writesOnlyExecutionAuditRuntime = $true
    }

    foreach ($key in $expected.Keys) {
        $property = $Rules.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $expected[$key]) {
            Add-Failure "Execution audit derivation rule '$key' must be $($expected[$key])."
        }
    }
}

function Test-AuditEntry {
    param(
        [Parameter(Mandatory)]$Entry,
        [Parameter(Mandatory)][string]$Context
    )

    Test-RequiredFields -Value $Entry -Fields $requiredEntryFields -Context $Context

    if ($Entry.decisionOutcome -notin $allowedDecisionOutcomes) {
        Add-Failure "$Context has invalid decisionOutcome '$($Entry.decisionOutcome)'."
    }
    if ($Entry.sourceLayer -ne 'execution-dispatch-registry') {
        Add-Failure "$Context must derive from the execution dispatch registry."
    }
    if ($Entry.decisionLayer -ne 'execution-audit-trail') {
        Add-Failure "$Context must identify execution-audit-trail as decisionLayer."
    }
    if ($Entry.manualEvidenceRequired -ne $true) {
        Add-Failure "$Context must require manual evidence."
    }
    if ($Entry.manualEvidencePresent -ne $true -and $Entry.dispatchEligible -eq $true) {
        Add-Failure "$Context missing manual evidence must not be dispatch eligible."
    }
    if ($Entry.manualEvidenceVerified -ne $true -and $Entry.decisionOutcome -eq 'PASS') {
        Add-Failure "$Context cannot PASS without verified manual evidence."
    }
    if ($Entry.unknownState -eq $true -and $Entry.decisionOutcome -eq 'PASS') {
        Add-Failure "$Context UNKNOWN must never become PASS."
    }
    if ($Entry.unknownState -eq $true -and $Entry.dispatchEligible -eq $true) {
        Add-Failure "$Context UNKNOWN must never become DISPATCH_ELIGIBLE."
    }
    if ($Entry.evidencePresent -ne $true -and $Entry.decisionOutcome -ne 'UNKNOWN') {
        Add-Failure "$Context missing evidence must produce UNKNOWN."
    }
    if ($Entry.manualEvidencePresent -ne $true -and $Entry.decisionOutcome -ne 'UNKNOWN') {
        Add-Failure "$Context unknown or missing manual evidence must produce UNKNOWN."
    }
    if (@($Entry.evidenceReferences).Count -lt 5) {
        Add-Failure "$Context must reference request, approval, preflight, review and dispatch evidence."
    }
    if ($Entry.authorityReference.automaticApproval -ne $false) {
        Add-Failure "$Context must forbid automatic approval."
    }
    if ($Entry.decisionTrace.dispatchEligible -ne $Entry.dispatchEligible) {
        Add-Failure "$Context decision trace must preserve dispatch eligibility."
    }
}

$contract = Read-JsonForValidation -RelativePath $contractRelativePath
$schema = Read-JsonForValidation -RelativePath $schemaRelativePath

if ($null -ne $contract) {
    Test-RequiredFields -Value $contract -Fields @('schemaVersion', 'contractId', 'capability', 'mode', 'sourceOfTruth', 'schema', 'inputs', 'outputs', 'artifactTypes', 'requiredAuditFields', 'decisionOutcomes', 'manualEvidenceGate', 'derivationRules', 'boundaries') -Context 'Execution audit contract'
    foreach ($field in $requiredEntryFields) {
        if ($field -notin @($contract.requiredAuditFields)) {
            Add-Failure "Execution audit contract misses required field '$field'."
        }
    }
    foreach ($artifactType in @('AUDIT_ENTRY', 'EVIDENCE_REFERENCE', 'AUTHORITY_REFERENCE', 'DECISION_TRACE')) {
        if ($artifactType -notin @($contract.artifactTypes)) {
            Add-Failure "Execution audit contract misses artifact type '$artifactType'."
        }
    }
    foreach ($outcome in $allowedDecisionOutcomes) {
        if ($outcome -notin @($contract.decisionOutcomes)) {
            Add-Failure "Execution audit contract misses decision outcome '$outcome'."
        }
    }
    foreach ($rule in @('dispatchEligibilityRequiresEvidence', 'manualEvidenceRequired', 'missingEvidenceNotEligible', 'unknownEvidenceProducesUnknown', 'automaticApprovalForbidden', 'unknownNeverPass', 'unknownNeverDispatchEligible')) {
        $property = $contract.manualEvidenceGate.PSObject.Properties[$rule]
        if ($null -eq $property -or $property.Value -ne $true) {
            Add-Failure "Execution audit manual evidence rule '$rule' must be true."
        }
    }
    Test-DerivationRules -Rules $contract.derivationRules
    Test-Boundaries -Boundaries $contract.boundaries -Context 'Execution audit contract'
}

if ($null -ne $schema) {
    Test-RequiredFields -Value $schema -Fields @('$schema', '$id', 'title', 'type', 'required', 'properties') -Context 'Execution audit schema'
}

$generatorPath = Join-Path $root $generatorRelativePath
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure "Execution audit generator missing: $generatorRelativePath"
}
if ($failures.Count -eq 0) {
    & $generatorPath | Out-Null
}

$report = Read-JsonForValidation -RelativePath $reportRelativePath
$summary = Read-JsonForValidation -RelativePath $summaryRelativePath
$boundary = Read-JsonForValidation -RelativePath $boundaryRelativePath

if ($null -ne $report) {
    Test-RequiredFields -Value $report -Fields @('schemaVersion', 'generatedAt', 'capability', 'sourceFile', 'entries', 'summary', 'boundaries') -Context 'Execution audit report'
    foreach ($entry in @($report.entries)) {
        Test-AuditEntry -Entry $entry -Context "Execution audit entry '$($entry.auditId)'"
    }
    Test-Boundaries -Boundaries $report.boundaries -Context 'Execution audit report'
}

if ($null -ne $summary) {
    Test-RequiredFields -Value $summary -Fields @('schemaVersion', 'generatedAt', 'capability', 'totalAuditEntries', 'passCount', 'unknownCount', 'dispatchEligibleCount', 'manualEvidenceRequiredCount', 'manualEvidencePresentCount', 'manualEvidenceVerifiedCount', 'eligibleWithoutVerifiedManualEvidence', 'unknownPassCount', 'unknownDispatchEligibleCount', 'automaticApprovalCount', 'executionPerformed', 'dispatchPerformed', 'externalCallsMade') -Context 'Execution audit summary'
    if ($summary.eligibleWithoutVerifiedManualEvidence -ne 0) { Add-Failure 'Manual evidence gate failed: eligible without verified manual evidence.' }
    if ($summary.unknownPassCount -ne 0) { Add-Failure 'UNKNOWN must never become PASS.' }
    if ($summary.unknownDispatchEligibleCount -ne 0) { Add-Failure 'UNKNOWN must never become DISPATCH_ELIGIBLE.' }
    if ($summary.automaticApprovalCount -ne 0) { Add-Failure 'Automatic approval must remain forbidden.' }
    if ($summary.executionPerformed -ne $false -or $summary.dispatchPerformed -ne $false -or $summary.externalCallsMade -ne $false) {
        Add-Failure 'Execution audit must not execute, dispatch, or call external systems.'
    }
}

if ($null -ne $boundary) {
    Test-RequiredFields -Value $boundary -Fields @('schemaVersion', 'generatedAt', 'capability', 'derivationRules', 'boundaries', 'forbiddenCapabilitiesPresent', 'writesOnly', 'readsOnly') -Context 'Execution audit boundary report'
    Test-DerivationRules -Rules $boundary.derivationRules
    Test-Boundaries -Boundaries $boundary.boundaries -Context 'Execution audit boundary report'
    if ($boundary.forbiddenCapabilitiesPresent -ne $false) {
        Add-Failure 'Execution audit boundary report must not detect forbidden capabilities.'
    }
    if ($boundary.writesOnly -ne 'runtime/execution-audit') {
        Add-Failure 'Execution audit boundary report must write only to runtime/execution-audit.'
    }
}

$scanPaths = @(
    $contractRelativePath,
    $schemaRelativePath,
    'services/execution-audit',
    $reportRelativePath,
    $summaryRelativePath,
    $boundaryRelativePath,
    'docs/governance/EXECUTION_AUDIT_TRAIL.md',
    'docs/governance/EXECUTION_AUDIT_BOUNDARIES.md'
)
$secretPatterns = @(
    'api[_-]?key\s*[:=]\s*["''][^"'']+["'']',
    'token\s*[:=]\s*["''][^"'']+["'']',
    'secret\s*[:=]\s*["''][^"'']+["'']',
    'password\s*[:=]\s*["''][^"'']+["'']',
    'Bearer\s+[A-Za-z0-9._~+/=-]+',
    'Cookie\s*[:=]',
    'client[_-]?secret\s*[:=]',
    '-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----'
)
$forbiddenCapabilityPatterns = @(
    ('Invoke-' + 'RestMethod'),
    ('Invoke-' + 'WebRequest'),
    ('Start-' + 'Job'),
    ('Register-' + 'ScheduledTask'),
    ('Start-' + 'ThreadJob'),
    '(?m)^\s*git\s+push\b',
    '(?m)^\s*git\s+merge\b',
    '(?m)^\s*git\s+rebase\b',
    '(?m)^\s*gh\s+',
    'vercel\s+deploy(\s|$)',
    '"performsExecution"\s*:\s*true',
    '"executionEngine"\s*:\s*true',
    '"dispatchEngine"\s*:\s*true',
    '"providerExecution"\s*:\s*true',
    '"githubExecution"\s*:\s*true',
    '"deploymentExecution"\s*:\s*true',
    '"automaticApproval"\s*:\s*true',
    '"automaticDispatch"\s*:\s*true',
    '"queues"\s*:\s*true',
    '"workers"\s*:\s*true',
    '"schedulers"\s*:\s*true',
    '"backgroundJobs"\s*:\s*true',
    '"agentExecution"\s*:\s*true',
    '"credentialAccess"\s*:\s*true',
    '"secretAccess"\s*:\s*true',
    '"branchWrites"\s*:\s*true',
    '"repositorySettingsMutation"\s*:\s*true',
    '"collaboratorMutation"\s*:\s*true'
)

foreach ($relativePath in $scanPaths) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path)) { continue }
    $files = if (Test-Path -LiteralPath $path -PathType Container) { Get-ChildItem -LiteralPath $path -File -Recurse } else { Get-Item -LiteralPath $path }
    foreach ($file in $files) {
        $content = Get-Content -LiteralPath $file.FullName -Raw
        foreach ($pattern in $secretPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Possible secret or credential found in execution audit artifact: $($file.FullName)"
            }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Forbidden execution audit capability found in artifact: $($file.FullName) pattern=$pattern"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "Execution audit validation failed with $($failures.Count) failure(s)."
}

Write-Host 'Studio OS V2.8 Dispatch Audit Trail & Manual Evidence Gate passed deterministic checks.' -ForegroundColor Green
