[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$scripts = @(
    'services/operational-intelligence/scoring/generate-operational-health.ps1',
    'services/operational-intelligence/trends/generate-trend-intelligence.ps1',
    'services/operational-intelligence/change-analysis/generate-change-intelligence.ps1',
    'services/operational-intelligence/risk/generate-risk-intelligence.ps1',
    'services/operational-intelligence/maturity/generate-maturity.ps1',
    'services/operational-intelligence/governance/generate-governance.ps1',
    'services/operational-intelligence/executive-summary/generate-executive-summary.ps1',
    'services/operational-intelligence/explainability/generate-explainability.ps1',
    'services/operational-intelligence/confidence/generate-confidence.ps1'
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
