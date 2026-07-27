[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
Import-Module (Join-Path $Root 'services/operational-intelligence/OperationalIntelligence.psm1') -Force

$views = Read-OIDashboardViews
$result = New-OIConfidenceView -Views $views
Write-OIView -RelativePath 'runtime/dashboard/confidence.view.json' -Value $result | Out-Null
Write-Output ($result | ConvertTo-Json -Depth 50)
