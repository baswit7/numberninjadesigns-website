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

function Read-AuthorityReadModelJson {
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

function Test-FalseFlag {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string]$Field,
        [Parameter(Mandatory)][string]$Label
    )

    $property = $Value.PSObject.Properties[$Field]
    if ($null -eq $property) {
        Add-Failure "$Label misses boundary field '$Field'."
        return
    }
    if ($property.Value -ne $false) {
        Add-Failure "$Label boundary field '$Field' must be false."
    }
}

function Test-TrueFlag {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string]$Field,
        [Parameter(Mandatory)][string]$Label
    )

    $property = $Value.PSObject.Properties[$Field]
    if ($null -eq $property) {
        Add-Failure "$Label misses boundary field '$Field'."
        return
    }
    if ($property.Value -ne $true) {
        Add-Failure "$Label boundary field '$Field' must be true."
    }
}

& (Join-Path $PSScriptRoot 'validate-authority-control-plane.ps1') | Out-Null
& (Join-Path $root 'services/authority-read-model/generate-authority-read-model.ps1') | Out-Null

$requiredPaths = @(
    'shared/contracts/authority/read-model/authority-read-model.schema.json',
    'shared/contracts/authority/read-model/authority-query-response.schema.json',
    'shared/contracts/authority/read-model/read-model.manifest.json',
    'services/authority-read-model/README.md',
    'services/authority-read-model/generate-authority-read-model.ps1',
    'runtime/authority/authority-read-model.report.json',
    'runtime/authority/authority-query-responses.report.json',
    'docs/governance/AUTHORITY_READ_MODEL.md',
    'docs/governance/PHASE_16_AUTHORITY_READ_MODEL.md',
    'docs/governance/PHASE_16_BOUNDARY_AUDIT.md'
)

foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        Add-Failure "Required Phase 16 authority read-model artifact missing: $relativePath"
    }
}

$manifest = Read-AuthorityReadModelJson -RelativePath 'shared/contracts/authority/read-model/read-model.manifest.json'
$readModel = Read-AuthorityReadModelJson -RelativePath 'runtime/authority/authority-read-model.report.json'
$queryResponses = Read-AuthorityReadModelJson -RelativePath 'runtime/authority/authority-query-responses.report.json'
$registry = Read-AuthorityReadModelJson -RelativePath 'shared/contracts/authority/authority-registry.json'
$constitution = Read-AuthorityReadModelJson -RelativePath 'shared/contracts/authority/constitution.rules.json'

if ($null -ne $manifest) {
    Test-RequiredFields -Value $manifest -RequiredFields @('schemaVersion', 'phase', 'manifestId', 'sourceContracts', 'contracts', 'runtimeReports', 'boundary') -Label 'Authority read-model manifest'
    if ($manifest.phase -ne 'phase-16') { Add-Failure 'Authority read-model manifest phase must be phase-16.' }
    if ($manifest.nonExecutable -ne $true) { Add-Failure 'Authority read-model manifest must be nonExecutable=true.' }
    Test-TrueFlag -Value $manifest.boundary -Field 'derivedOnly' -Label 'Authority read-model manifest'
    foreach ($flag in @('ownsAuthority', 'writesAuthorityDecisions', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeMutationAllowed', 'approvalAutomationAllowed', 'workflowExecutionAllowed', 'browserAuthorityStorageAllowed')) {
        Test-FalseFlag -Value $manifest.boundary -Field $flag -Label 'Authority read-model manifest'
    }
    foreach ($sourcePath in @($manifest.sourceContracts)) {
        if ($sourcePath -notlike 'shared/contracts/authority/*') {
            Add-Failure "Authority read-model manifest source path is outside Phase 15 authority contracts: $sourcePath"
        }
        if (-not (Test-Path -LiteralPath (Join-Path $root $sourcePath) -PathType Leaf)) {
            Add-Failure "Authority read-model manifest source path missing: $sourcePath"
        }
    }
    foreach ($runtimeReport in @($manifest.runtimeReports)) {
        if ($runtimeReport -notlike 'runtime/authority/*.json') {
            Add-Failure "Authority read-model manifest runtime report must stay under runtime/authority: $runtimeReport"
        }
    }
    $checks.Add([ordered]@{ id = 'read-model-manifest'; status = 'checked'; sources = @($manifest.sourceContracts).Count }) | Out-Null
}

if ($null -ne $readModel -and $null -ne $registry -and $null -ne $constitution) {
    Test-RequiredFields -Value $readModel -RequiredFields @('schemaVersion', 'phase', 'projectionId', 'sourceContracts', 'generatedBy', 'summary', 'authorities', 'relationships', 'boundary') -Label 'Authority read model'
    if ($readModel.phase -ne 'phase-16') { Add-Failure 'Authority read model phase must be phase-16.' }
    if ($readModel.generatedBy -ne 'services/authority-read-model/generate-authority-read-model.ps1') { Add-Failure 'Authority read model generatedBy must identify the Phase 16 generator.' }
    Test-TrueFlag -Value $readModel.boundary -Field 'derivedOnly' -Label 'Authority read model'
    foreach ($flag in @('ownsAuthority', 'writesAuthorityDecisions', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeMutationAllowed', 'approvalAutomationAllowed', 'workflowExecutionAllowed', 'browserAuthorityStorageAllowed')) {
        Test-FalseFlag -Value $readModel.boundary -Field $flag -Label 'Authority read model'
    }

    $registryIds = @(@($registry.authorities) | ForEach-Object { $_.authorityId } | Sort-Object)
    $readModelIds = @(@($readModel.authorities) | ForEach-Object { $_.authorityId } | Sort-Object)
    if (@($registryIds).Count -ne @($readModelIds).Count) {
        Add-Failure 'Authority read model authority count must match authority registry count.'
    }
    foreach ($authorityId in $registryIds) {
        if ($readModelIds -notcontains $authorityId) {
            Add-Failure "Authority read model misses registry authority '$authorityId'."
        }
    }

    $denied = @(@($readModel.authorities) | Where-Object { $_.decision -eq 'DENY' })
    foreach ($requiredDenied in @('provider.invoke', 'deployment.start', 'execution.run', 'credential.read', 'secret.write', 'github.repo.write')) {
        $match = @($denied | Where-Object { $_.authorityId -eq $requiredDenied })
        if ($match.Count -ne 1) {
            Add-Failure "Authority read model must expose required denied authority '$requiredDenied'."
        }
    }
    if ($readModel.summary.authorityCount -ne @($registry.authorities).Count) {
        Add-Failure 'Authority read model summary authorityCount must match registry.'
    }
    if ($readModel.summary.constitutionalRuleCount -ne @($constitution.rules).Count) {
        Add-Failure 'Authority read model summary constitutionalRuleCount must match constitution.'
    }
    $checks.Add([ordered]@{ id = 'authority-read-model-report'; status = 'checked'; authorities = @($readModel.authorities).Count; relationships = @($readModel.relationships).Count }) | Out-Null
}

if ($null -ne $queryResponses) {
    Test-RequiredFields -Value $queryResponses -RequiredFields @('schemaVersion', 'phase', 'reportId', 'generatedBy', 'sourceProjection', 'responses', 'boundary') -Label 'Authority query responses'
    if ($queryResponses.phase -ne 'phase-16') { Add-Failure 'Authority query responses phase must be phase-16.' }
    if ($queryResponses.sourceProjection -ne 'runtime/authority/authority-read-model.report.json') { Add-Failure 'Authority query responses must point at the authority read model projection.' }
    Test-TrueFlag -Value $queryResponses.boundary -Field 'readOnly' -Label 'Authority query responses'
    Test-TrueFlag -Value $queryResponses.boundary -Field 'derivedOnly' -Label 'Authority query responses'
    foreach ($flag in @('executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeMutationAllowed')) {
        Test-FalseFlag -Value $queryResponses.boundary -Field $flag -Label 'Authority query responses'
    }
    foreach ($requiredQuery in @('owners-by-authority', 'consumers-by-authority', 'denied-authorities', 'decisions-by-authority', 'rules-by-authority', 'contracts-by-authority')) {
        $match = @(@($queryResponses.responses) | Where-Object { $_.queryType -eq $requiredQuery })
        if ($match.Count -ne 1) {
            Add-Failure "Authority query responses must include exactly one '$requiredQuery' response."
        }
    }
    foreach ($response in @($queryResponses.responses)) {
        Test-TrueFlag -Value $response.boundary -Field 'readOnly' -Label "Authority query response '$($response.responseId)'"
        foreach ($flag in @('executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeMutationAllowed')) {
            Test-FalseFlag -Value $response.boundary -Field $flag -Label "Authority query response '$($response.responseId)'"
        }
    }
    $checks.Add([ordered]@{ id = 'authority-query-responses'; status = 'checked'; responses = @($queryResponses.responses).Count }) | Out-Null
}

$phase16Files = @(
    'shared/contracts/authority/read-model/authority-read-model.schema.json',
    'shared/contracts/authority/read-model/authority-query-response.schema.json',
    'shared/contracts/authority/read-model/read-model.manifest.json',
    'services/authority-read-model/README.md',
    'services/authority-read-model/generate-authority-read-model.ps1',
    'scripts/validation/validate-authority-read-model.ps1',
    'runtime/authority/authority-read-model.report.json',
    'runtime/authority/authority-query-responses.report.json',
    'docs/governance/AUTHORITY_READ_MODEL.md',
    'docs/governance/PHASE_16_AUTHORITY_READ_MODEL.md',
    'docs/governance/PHASE_16_BOUNDARY_AUDIT.md'
)

$forbiddenPatterns = @(
    ('Invoke-' + 'RestMethod'),
    ('Invoke-' + 'WebRequest'),
    ('Start-' + 'Process'),
    ('Start-' + 'Job'),
    ('Register-' + 'ScheduledTask'),
    'gh\s+api',
    'gh\s+pr',
    'git\s+push',
    'vercel\s+deploy',
    'netlify\s+deploy',
    'firebase\s+deploy',
    ('New-' + 'StoredCredential'),
    ('Set-' + 'StoredCredential'),
    '"apiKey"\s*:',
    '"accessToken"\s*:',
    '"refreshToken"\s*:',
    '"clientSecret"\s*:',
    '"credentialValue"\s*:',
    '"secretValue"\s*:'
)

foreach ($relativePath in $phase16Files) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }
    foreach ($pattern in $forbiddenPatterns) {
        $match = Select-String -LiteralPath $path -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($match) {
            Add-Failure "Forbidden Phase 16 capability pattern '$pattern' in $relativePath line $($match.LineNumber)."
        }
    }
}
$checks.Add([ordered]@{ id = 'phase-16-forbidden-pattern-scan'; status = 'checked'; files = @($phase16Files).Count }) | Out-Null

$reportStatus = 'failed'
$reportSummary = "Authority read model validation failed with $($failures.Count) issue(s)."
if ($failures.Count -eq 0) {
    $reportStatus = 'passed'
    $reportSummary = 'Authority read model passed deterministic read-only boundary checks.'
}

$report = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-16'
    reportId = 'authority-read-model-validation'
    status = $reportStatus
    summary = $reportSummary
    checks = $checks.ToArray()
    failures = $failures.ToArray()
    boundary = [ordered]@{
        machineReadableReportOnly = $true
        readOnly = $true
        derivedOnly = $true
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        credentialAccessAllowed = $false
        secretAccessAllowed = $false
        runtimeMutationAllowed = $false
    }
}

Write-StudioJson -RelativePath 'runtime/authority/authority-read-model-validation.report.json' -Value $report

if ($failures.Count -gt 0) {
    Write-Host 'Phase 16 authority read model validation failed.' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'Phase 16 authority read model passed deterministic checks.' -ForegroundColor Green
exit 0
