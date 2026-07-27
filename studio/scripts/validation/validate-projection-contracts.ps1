[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]
$contractDirectory = Join-Path $root 'shared/contracts/projections'

function Add-Failure {
    param([string]$Message)
    $failures.Add($Message) | Out-Null
}

function Read-ProjectionJson {
    param([Parameter(Mandatory)][string]$RelativePath)

    try {
        return Read-StudioJson -RelativePath $RelativePath
    }
    catch {
        Add-Failure "$RelativePath could not be read as JSON. $($_.Exception.Message)"
        return $null
    }
}

function Test-SchemaContract {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][string]$ExpectedSafetyClass
    )

    $schema = Read-ProjectionJson -RelativePath $RelativePath
    if ($null -eq $schema) { return }

    if ($schema.'$schema' -ne 'https://json-schema.org/draft/2020-12/schema') {
        Add-Failure "$RelativePath must use JSON Schema draft 2020-12."
    }
    if ($schema.type -ne 'object') {
        Add-Failure "$RelativePath root type must be object."
    }
    if ($schema.additionalProperties -ne $false) {
        Add-Failure "$RelativePath top-level additionalProperties must be false."
    }
    if (@($schema.required) -notcontains 'schemaVersion') {
        Add-Failure "$RelativePath must require schemaVersion."
    }
    if ($schema.properties.schemaVersion.const -ne '1.0.0') {
        Add-Failure "$RelativePath schemaVersion const must be 1.0.0."
    }
    if ($schema.'$defs'.nonExecutableMetadata.properties.phase.const -ne 'phase-13') {
        Add-Failure "$RelativePath must constrain metadata phase to phase-13."
    }
    if ($schema.'$defs'.nonExecutableMetadata.properties.safetyClass.const -ne $ExpectedSafetyClass) {
        Add-Failure "$RelativePath must constrain safetyClass to $ExpectedSafetyClass."
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
        Add-Failure "$Label missing boundary flag $Flag."
        return
    }
    if ($property.Value -ne $false) {
        Add-Failure "$Label boundary flag $Flag must be false."
    }
}

if (-not (Test-Path -LiteralPath $contractDirectory -PathType Container)) {
    Add-Failure 'Projection contract directory missing: shared/contracts/projections'
}

Test-SchemaContract -RelativePath 'shared/contracts/projections/dashboard-projection.schema.json' -ExpectedSafetyClass 'read-only-projection-contract'
Test-SchemaContract -RelativePath 'shared/contracts/projections/no-write-validator-interface.schema.json' -ExpectedSafetyClass 'no-write-validation-interface'

$manifest = Read-ProjectionJson -RelativePath 'shared/contracts/projections/projection-contract.manifest.json'
if ($null -ne $manifest) {
    if ($manifest.phase -ne 'phase-13') { Add-Failure 'Projection manifest phase must be phase-13.' }
    if ($manifest.runtimeTruthOwner -ne 'runtime') { Add-Failure 'Projection manifest must keep runtime as truth owner.' }
    if ($manifest.projectionProducer -ne 'apps/studio-dashboard/dashboard-adapter.ps1') { Add-Failure 'Projection manifest must keep dashboard adapter as producer.' }
    if ($manifest.dashboardRole -ne 'passive-visual-consumer') { Add-Failure 'Projection manifest must keep dashboard passive.' }
    if ($manifest.boundary.readOnly -ne $true) { Add-Failure 'Projection manifest boundary readOnly must be true.' }
    foreach ($flag in @('writesAllowed', 'runtimeMutationAllowed', 'dashboardMutationAllowed', 'executionAllowed', 'providerCallsAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'browserStorageAuthorityAllowed')) {
        Test-FalseBoundaryFlag -Object $manifest.boundary -Flag $flag -Label 'Projection manifest'
    }
}

$rawContracts = ''
if (Test-Path -LiteralPath $contractDirectory -PathType Container) {
    $rawContracts = (Get-ChildItem -LiteralPath $contractDirectory -Filter '*.json' -File | ForEach-Object {
        Get-Content -LiteralPath $_.FullName -Raw
    }) -join [Environment]::NewLine
}

$forbiddenPatterns = @(
    '"(command|commands|commandText|scriptPath|networkEndpoint|providerInvocation|deploymentPayload|approvalWritePayload|runtimeMutationPayload)"\s*:',
    '"(queueConfiguration|workerConfiguration|schedulerConfiguration|executorConfiguration|agentConfiguration)"\s*:',
    'Invoke-RestMethod|Invoke-WebRequest|Start-Job|Register-ScheduledTask|Start-Process|gh\s+api|vercel\s+deploy|netlify\s+deploy|firebase\s+deploy',
    'openai\.com|api\.anthropic\.com',
    'localStorage|sessionStorage',
    '"(apiKey|accessToken|refreshToken|clientSecret|password|credentialValue)"\s*:'
)

foreach ($pattern in $forbiddenPatterns) {
    if ($rawContracts -match $pattern) {
        Add-Failure "Projection contracts contain forbidden capability pattern: $pattern"
    }
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 13 projection contract validation failed.' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'Phase 13 projection contracts passed deterministic boundary checks.' -ForegroundColor Green
exit 0
