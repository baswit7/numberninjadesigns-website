[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]
$generatorRelativePath = 'scripts/generation/generate-numberninja-launch-package.mjs'
$generatorPath = Join-Path $root $generatorRelativePath

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message) | Out-Null
}

if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure "OpenAI generation engine missing: $generatorRelativePath"
}
else {
    $content = Get-Content -LiteralPath $generatorPath -Raw
    foreach ($pattern in @('OPENAI_API_KEY', 'process\.env', '\.env', 'parseEnvFile')) {
        if ($content -notmatch $pattern) {
            Add-Failure "Generator misses required pattern: $pattern"
        }
    }
    foreach ($forbiddenPattern in @('dotenv', 'localStorage', 'sessionStorage', 'console\.log\([^)]*OPENAI_API_KEY')) {
        if ($content -match $forbiddenPattern) {
            Add-Failure "Generator contains forbidden pattern: $forbiddenPattern"
        }
    }

    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($null -ne $node) {
        & node --check $generatorPath | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Add-Failure 'Generator failed node syntax check.'
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "OpenAI generation engine validation failed with $($failures.Count) failure(s)."
}

Write-Host 'OpenAI generation engine validation passed.' -ForegroundColor Green
