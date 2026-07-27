[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$failures = New-Object System.Collections.Generic.List[string]
function Add-Failure { param([string]$Message) $failures.Add($Message) | Out-Null }
function Test-RequiredFields { param($Value, [string[]]$Fields, [string]$Label) foreach ($field in $Fields) { if ($null -eq $Value.PSObject.Properties[$field]) { Add-Failure "$Label misses required field '$field'." } } }
function Test-ReadinessFlags { param($Value, [string]$Label) if ($null -eq $Value.PSObject.Properties['executionAllowed'] -or $Value.executionAllowed -ne $false) { Add-Failure "$Label must keep executionAllowed=false." }; if ($null -eq $Value.PSObject.Properties['readinessOnly'] -or $Value.readinessOnly -ne $true) { Add-Failure "$Label must keep readinessOnly=true." }; if ($null -eq $Value.PSObject.Properties['nonExecutableMetadata'] -or $Value.nonExecutableMetadata.phase -ne 'phase-10') { Add-Failure "$Label must declare phase-10 nonExecutableMetadata." } }
function Get-Strings { param([object]$Value) $items = New-Object System.Collections.Generic.List[string]; function Visit { param([object]$Node) if ($null -eq $Node) { return }; if ($Node -is [string]) { $items.Add($Node) | Out-Null; return }; if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [string])) { foreach ($entry in $Node) { Visit $entry }; return }; if (-not ($Node -is [pscustomobject]) -and -not ($Node -is [hashtable])) { return }; foreach ($property in @($Node.PSObject.Properties)) { Visit $property.Value } }; Visit $Value; return @($items) }
function Test-SafeStrings {
    param($Value, [string]$Label)
    $secretParts = @('api[_-]?key', 'access[_-]?token', 'refresh[_-]?token', 'bearer\s+[a-z0-9._-]+', 'password\s*[:=]', ('client' + '[_-]?secret'), 'credential\s*[:=]')
    $commandParts = @(
        ('Invoke' + '-Expression'),
        ('Invoke' + '-RestMethod'),
        ('Invoke' + '-WebRequest'),
        ('Start' + '-Process'),
        ('Start' + '-Job'),
        ('Register' + '-ScheduledTask'),
        ('gh' + '\s+api'),
        ('vercel' + '\s+deploy'),
        ('netlify' + '\s+deploy'),
        ('firebase' + '\s+deploy'),
        ('openai' + '\.com'),
        ('api' + '\.anthropic\.com')
    )
    $pattern = '(?i)(' + (($secretParts + $commandParts) -join '|') + ')'
    foreach ($text in Get-Strings -Value $Value) {
        if ($text -match $pattern) { Add-Failure "$Label contains prohibited wording: $text" }
    }
}
function Complete-Validation { param([string]$FailureTitle, [string]$SuccessMessage) if ($failures.Count -gt 0) { Write-Host $FailureTitle -ForegroundColor Red; foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }; exit 1 }; Write-Host $SuccessMessage -ForegroundColor Green; exit 0 }
try { $plan = Read-StudioJson -RelativePath 'runtime/readiness/execution-plan.sample.json' }
catch { Add-Failure "Readiness execution plan sample could not be read. $($_.Exception.Message)"; Complete-Validation 'Phase 10 execution plan validation failed.' 'Phase 10 execution plan samples passed deterministic checks.' }
Test-RequiredFields -Value $plan -Fields @('schemaVersion','planId','createdAt','objective','steps','forbiddenCapabilities','readinessDecisionId','executionAllowed','readinessOnly','nonExecutableMetadata') -Label 'Readiness execution plan sample'
Test-ReadinessFlags -Value $plan -Label 'Readiness execution plan sample'
Test-SafeStrings -Value $plan -Label 'Readiness execution plan sample'
foreach ($step in @($plan.steps)) {
    Test-RequiredFields -Value $step -Fields @('stepId','title','readinessStatus','executionAllowed') -Label "Readiness plan step '$($step.stepId)'"
    if ($step.executionAllowed -ne $false) { Add-Failure "Readiness plan step '$($step.stepId)' must keep executionAllowed=false." }
}
if (@($plan.forbiddenCapabilities).Count -lt 12) { Add-Failure 'Readiness execution plan sample must keep a complete forbiddenCapabilities boundary.' }
Complete-Validation 'Phase 10 execution plan validation failed.' 'Phase 10 execution plan samples passed deterministic checks.'
