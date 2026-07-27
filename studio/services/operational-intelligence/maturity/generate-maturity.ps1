[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
Import-Module (Join-Path $Root 'services/operational-intelligence/OperationalIntelligence.psm1') -Force

$views = Read-OIDashboardViews
$result = New-OIMaturityIntelligence -Views $views
Write-OIView -RelativePath 'runtime/dashboard/maturity.view.json' -Value $result | Out-Null
Write-Output ($result | ConvertTo-Json -Depth 50)
