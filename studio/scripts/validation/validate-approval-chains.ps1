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
function Test-SafeStrings { param($Value, [string]$Label) $pattern = '(?i)(api[_-]?key|access[_-]?token|refresh[_-]?token|bearer\s+[a-z0-9._-]+|password\s*[:=]|client[_-]?secret|credential\s*[:=]|Invoke-Expression|Invoke-RestMethod|Invoke-WebRequest|Start-Process|Start-Job|Register-ScheduledTask|gh\s+api|vercel\s+deploy|netlify\s+deploy|firebase\s+deploy|openai\.com|api\.anthropic\.com)'; foreach ($text in Get-Strings -Value $Value) { if ($text -match $pattern) { Add-Failure "$Label contains prohibited wording: $text" } } }
function Complete-Validation { param([string]$FailureTitle, [string]$SuccessMessage) if ($failures.Count -gt 0) { Write-Host $FailureTitle -ForegroundColor Red; foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }; exit 1 }; Write-Host $SuccessMessage -ForegroundColor Green; exit 0 }
try { $schema = Read-StudioJson -RelativePath 'shared/contracts/readiness/approval-chain.schema.json' }
catch { Add-Failure "Approval-chain schema could not be read. $($_.Exception.Message)"; Complete-Validation 'Phase 10 approval-chain validation failed.' 'Phase 10 approval-chain readiness contract passed deterministic checks.' }
foreach ($field in @('approvalChainId','planId','requiredReviewers','readinessStatus','approvalGranted','executionAllowed','readinessOnly','nonExecutableMetadata')) {
    if (@($schema.required) -notcontains $field) { Add-Failure "Approval-chain schema must require '$field'." }
}
if ($schema.properties.approvalGranted.const -ne $false) { Add-Failure 'Approval-chain schema must keep approvalGranted=false.' }
if ($schema.properties.executionAllowed.const -ne $false) { Add-Failure 'Approval-chain schema must keep executionAllowed=false.' }
Test-SafeStrings -Value $schema -Label 'approval-chain.schema.json'
Complete-Validation 'Phase 10 approval-chain validation failed.' 'Phase 10 approval-chain readiness contract passed deterministic checks.'
