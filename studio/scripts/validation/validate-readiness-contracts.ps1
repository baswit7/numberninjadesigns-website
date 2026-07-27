[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$failures = New-Object System.Collections.Generic.List[string]
$contracts = @(
    'execution-plan.schema.json',
    'execution-step.schema.json',
    'dependency-check.schema.json',
    'preflight-check.schema.json',
    'approval-chain.schema.json',
    'readiness-decision.schema.json',
    'readiness-report.schema.json'
)

function Add-Failure { param([string]$Message) $failures.Add($Message) | Out-Null }
function Get-Strings {
    param([object]$Value)
    $items = New-Object System.Collections.Generic.List[string]
    function Visit { param([object]$Node)
        if ($null -eq $Node) { return }
        if ($Node -is [string]) { $items.Add($Node) | Out-Null; return }
        if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [string])) { foreach ($entry in $Node) { Visit $entry }; return }
        if (-not ($Node -is [pscustomobject]) -and -not ($Node -is [hashtable])) { return }
        foreach ($property in @($Node.PSObject.Properties)) { Visit $property.Value }
    }
    Visit $Value
    return @($items)
}
function Test-SafeStrings {
    param([object]$Value, [string]$Label)
    $secretPattern = '(?i)(api[_-]?key|access[_-]?token|refresh[_-]?token|bearer\s+[a-z0-9._-]+|password\s*[:=]|client[_-]?secret|credential\s*[:=])'
    $executionPattern = '(?i)(Invoke-Expression|Invoke-RestMethod|Invoke-WebRequest|Start-Process|Start-Job|Register-ScheduledTask|gh\s+api|vercel\s+deploy|netlify\s+deploy|firebase\s+deploy|openai\.com|api\.anthropic\.com)'
    foreach ($text in Get-Strings -Value $Value) {
        if ($text -match $secretPattern) { Add-Failure "$Label contains credential-like wording: $text" }
        if ($text -match $executionPattern) { Add-Failure "$Label contains execution or provider-call wording: $text" }
    }
}

foreach ($contract in $contracts) {
    $relativePath = "shared/contracts/readiness/$contract"
    try { $schema = Read-StudioJson -RelativePath $relativePath }
    catch { Add-Failure "$relativePath could not be read as JSON. $($_.Exception.Message)"; continue }

    if ($schema.'$schema' -ne 'https://json-schema.org/draft/2020-12/schema') { Add-Failure "$contract does not use JSON Schema draft 2020-12." }
    if ($schema.additionalProperties -ne $false) { Add-Failure "$contract top-level additionalProperties must be false." }
    foreach ($field in @('schemaVersion', 'executionAllowed', 'readinessOnly', 'nonExecutableMetadata')) {
        if (@($schema.required) -notcontains $field) { Add-Failure "$contract must require '$field'." }
    }
    if ($schema.properties.executionAllowed.const -ne $false) { Add-Failure "$contract must constrain executionAllowed to false." }
    if ($schema.properties.readinessOnly.const -ne $true) { Add-Failure "$contract must constrain readinessOnly to true." }
    if ($schema.'$defs'.nonExecutableMetadata.properties.phase.const -ne 'phase-10') { Add-Failure "$contract must constrain metadata phase to phase-10." }
    Test-SafeStrings -Value $schema -Label $contract
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 10 readiness contract validation failed.' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }
    exit 1
}

Write-Host "Phase 10 readiness contracts passed deterministic checks. Checked $($contracts.Count) schemas." -ForegroundColor Green
exit 0