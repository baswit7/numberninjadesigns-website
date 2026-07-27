[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
Import-Module (Join-Path $Root 'services/governance/Governance.psm1') -Force

$result = New-ExceptionsView
Write-GovView -RelativePath 'runtime/dashboard/exceptions.view.json' -Value $result | Out-Null
Write-Output ($result | ConvertTo-Json -Depth 50)
