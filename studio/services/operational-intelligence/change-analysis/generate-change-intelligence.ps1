[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
Import-Module (Join-Path $Root 'services/operational-intelligence/OperationalIntelligence.psm1') -Force

$result = New-OIChangeIntelligence
Write-OIView -RelativePath 'runtime/dashboard/change-intelligence.view.json' -Value $result | Out-Null
Write-Output ($result | ConvertTo-Json -Depth 50)
