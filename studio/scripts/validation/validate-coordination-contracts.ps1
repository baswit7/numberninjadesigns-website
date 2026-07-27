[CmdletBinding()]
param([string]$RepositoryRoot)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    $RepositoryRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
}
else {
    $RepositoryRoot = Resolve-Path $RepositoryRoot
}

. (Join-Path $PSScriptRoot 'coordination-validation-lib.ps1')

$failures = New-Object System.Collections.Generic.List[string]
$schemaDraft = 'https://json-schema.org/draft/2020-12/schema'
$contracts = @(
    'agent-registry.schema.json',
    'workflow-registry.schema.json',
    'coordination-request.schema.json',
    'coordination-graph.schema.json',
    'coordination-report.schema.json',
    'coordination-health.schema.json'
)

foreach ($contract in $contracts) {
    $path = Join-Path $RepositoryRoot "shared/contracts/coordination/$contract"
    $schema = Read-CoordinationJson -Path $path -Label $contract -Failures $failures
    if ($null -eq $schema) {
        continue
    }

    if ($schema.'$schema' -ne $schemaDraft) {
        Add-CoordinationFailure -Failures $failures -Message "$contract does not use JSON Schema draft 2020-12."
    }
    if ($schema.additionalProperties -ne $false) {
        Add-CoordinationFailure -Failures $failures -Message "$contract top-level additionalProperties must be false."
    }
    foreach ($field in @('schemaVersion')) {
        if (@($schema.required) -notcontains $field) {
            Add-CoordinationFailure -Failures $failures -Message "$contract misses required top-level field '$field'."
        }
    }
    if ($contract -notin @('coordination-report.schema.json', 'coordination-health.schema.json') -and @($schema.required) -notcontains 'executionAllowed') {
        Add-CoordinationFailure -Failures $failures -Message "$contract must require executionAllowed."
    }
    if ($contract -in @('coordination-report.schema.json', 'coordination-health.schema.json') -and @($schema.required) -notcontains 'executionAllowed') {
        Add-CoordinationFailure -Failures $failures -Message "$contract must require executionAllowed in report outputs."
    }
}

Complete-CoordinationValidation -Failures $failures -FailureTitle 'Phase 8 coordination contract validation failed.' -SuccessMessage "Phase 8 coordination contracts passed deterministic checks. Checked $($contracts.Count) schemas."
