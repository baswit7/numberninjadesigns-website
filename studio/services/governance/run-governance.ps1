[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$scripts = @(
    'services/governance/scoring/generate-governance-score.ps1',
    'services/governance/compliance/generate-compliance.ps1',
    'services/governance/exceptions/generate-exceptions.ps1',
    'services/governance/release-readiness/generate-release-readiness.ps1',
    'services/governance/quality-gates/generate-quality-gates.ps1',
    'services/governance/drift-detection/generate-governance-drift.ps1'
)

$results = @()
foreach ($relativePath in $scripts) {
    $path = Join-Path $Root $relativePath
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $path 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "$relativePath failed. $($output -join [Environment]::NewLine)"
    }
    $results += [pscustomobject]@{
        script = $relativePath
        status = 'ok'
    }
}

Write-Output ($results | ConvertTo-Json -Depth 10)
